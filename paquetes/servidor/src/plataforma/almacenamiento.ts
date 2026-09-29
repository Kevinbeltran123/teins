import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, NotFound, PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import type { Config } from "../config";

export interface SubidaFirmada {
  url: string;
  cabeceras: Record<string, string>;
  expiraEn: Date;
}

/** Objetos por contenido (ADR-0007): viven en `organizacion/huella`, nunca se sobrescriben ni se comparten entre organizaciones. */
export const claveDeObjeto = (organizacionId: string, huella: string) => `${organizacionId}/${huella}`;

/** Lee un objeto completo en memoria: solo para los que ya se sabe que son pequeños o se van a adjuntar. */
export async function leerTodo(almacenamiento: Almacenamiento, clave: string): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const trozo of await almacenamiento.leer(clave)) partes.push(trozo as Buffer);
  return Buffer.concat(partes);
}

/** Puerto del almacenamiento de objetos (ADR-0007): cualquier proveedor compatible con S3. */
export interface Almacenamiento {
  firmarSubida(clave: string, datos: { bytes: number; tipo: string; sha256Hex: string }): Promise<SubidaFirmada>;
  /**
   * Con `descargarComo`, el navegador guarda el archivo con ese nombre en vez de abrirlo (los PDF de los
   * informes). Sin él se abre en línea, como deben verse las fotos y los bocetos dentro de un <img>.
   */
  firmarDescarga(clave: string, opciones?: { descargarComo?: string }): Promise<{ url: string; expiraEn: Date }>;
  existe(clave: string): Promise<boolean>;
  leer(clave: string): Promise<Readable>;
  /** Objetos que genera el servidor (el PDF de una versión). La clave es la huella: nunca se sobrescribe otro contenido. */
  guardar(clave: string, datos: Uint8Array, tipo: string): Promise<void>;
  eliminar(clave: string): Promise<void>;
  /** Permite que las superficies suban directo desde el navegador. Se aplica al preparar un entorno. */
  permitirOrigenes(origenes: readonly string[]): Promise<void>;
}

/**
 * `Content-Disposition: attachment` con el nombre del archivo: en ASCII para navegadores viejos y en UTF-8
 * (RFC 5987) para que conserve las tildes del cliente y del sitio.
 */
export function disposicionAdjunto(nombre: string): string {
  const ascii = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7e]|["\\]/g, "-");
  const utf8 = encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

const SEGUNDOS_SUBIDA = 15 * 60;
const SEGUNDOS_DESCARGA = 5 * 60;

export function almacenamientoS3(config: Config): Almacenamiento {
  const s3 = new S3Client({
    region: config.S3_REGION,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
    forcePathStyle: config.S3_FORZAR_RUTA,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
    // Sin esto, el SDK agrega a la URL firmada una suma CRC32 del cuerpo vacío y la carga real no coincide.
    // La huella la decide `firmarSubida`, no el SDK.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = config.S3_BUCKET;

  return {
    async firmarSubida(clave, { bytes, tipo, sha256Hex }) {
      const sha256 = Buffer.from(sha256Hex, "hex").toString("base64");
      const huella = config.S3_EXIGIR_HUELLA;
      // La firma incluye tipo, tamaño y, si el proveedor la admite, la huella: el almacenamiento rechaza
      // un contenido distinto (ADR-0007). Sin huella firmada, el worker la verifica igual antes de aceptarlo.
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket, Key: clave, ContentType: tipo, ContentLength: bytes, ...(huella ? { ChecksumSHA256: sha256 } : {}) }),
        {
          expiresIn: SEGUNDOS_SUBIDA,
          signableHeaders: new Set(["content-type", "content-length", ...(huella ? ["x-amz-checksum-sha256"] : [])]),
        },
      );
      return {
        url,
        // content-length lo pone el navegador; las demás las envía el cliente tal cual.
        cabeceras: { "content-type": tipo, ...(huella ? { "x-amz-checksum-sha256": sha256 } : {}) },
        expiraEn: new Date(Date.now() + SEGUNDOS_SUBIDA * 1000),
      };
    },
    async firmarDescarga(clave, opciones) {
      const disposicion = opciones?.descargarComo ? { ResponseContentDisposition: disposicionAdjunto(opciones.descargarComo) } : {};
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: clave, ...disposicion }), { expiresIn: SEGUNDOS_DESCARGA });
      return { url, expiraEn: new Date(Date.now() + SEGUNDOS_DESCARGA * 1000) };
    },
    async existe(clave) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket, Key: clave }));
        return true;
      } catch (error) {
        if (error instanceof NotFound || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
          return false;
        }
        throw error;
      }
    },
    async leer(clave) {
      const respuesta = await s3.send(new GetObjectCommand({ Bucket, Key: clave }));
      return respuesta.Body as Readable;
    },
    async guardar(clave, datos, tipo) {
      await s3.send(new PutObjectCommand({ Bucket, Key: clave, Body: datos, ContentType: tipo, ContentLength: datos.byteLength }));
    },
    async eliminar(clave) {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: clave }));
    },
    async permitirOrigenes(origenes) {
      await s3.send(
        new PutBucketCorsCommand({
          Bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [...origenes],
                AllowedMethods: ["PUT", "GET"],
                AllowedHeaders: ["content-type", "x-amz-checksum-sha256"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
    },
  };
}
