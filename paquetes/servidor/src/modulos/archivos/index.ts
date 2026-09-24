import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import type { Config } from "../../config";
import type { Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { archivos, type EstadoArchivo } from "./esquema";

export type { EstadoArchivo } from "./esquema";

export interface Archivos {
  /** Estado de cada huella en la organización de la transacción; las desconocidas no aparecen. */
  estados(tx: TxOrganizacion, huellas: readonly string[]): Promise<Map<string, EstadoArchivo>>;
  /** Trabajo del worker: verifica firma interna, tamaño y huella (ADR-0007, paso 6). Idempotente. */
  verificar(datos: { organizacionId: string; huella: string }, registro?: FastifyBaseLogger): Promise<void>;
  registrarRutas(app: FastifyInstance): void;
}

/** El objeto vive en `organizacion/huella`: nunca se sobrescribe ni se comparte entre organizaciones. */
const clave = (organizacionId: string, huella: string) => `${organizacionId}/${huella}`;
const BYTES_PARA_DETECTAR_TIPO = 4100;

/** Interfaz pública del módulo de archivos (ADR-0007). */
export function crearArchivos({ bd, almacenamiento, config }: { bd: BaseDeDatos; almacenamiento: Almacenamiento; config: Config }): Archivos {
  async function leerFila(organizacionId: string, huella: string) {
    const [fila] = await enOrganizacion(bd, organizacionId, (tx) => tx.select().from(archivos).where(eq(archivos.huella, huella)));
    return fila;
  }

  async function marcar(organizacionId: string, huella: string, desde: EstadoArchivo, cambios: Partial<typeof archivos.$inferInsert>) {
    await enOrganizacion(bd, organizacionId, (tx) =>
      tx.update(archivos).set(cambios).where(and(eq(archivos.huella, huella), eq(archivos.estado, desde))),
    );
  }

  return {
    async estados(tx, huellas) {
      if (huellas.length === 0) return new Map();
      const filas = await tx.select({ huella: archivos.huella, estado: archivos.estado }).from(archivos).where(inArray(archivos.huella, [...huellas]));
      return new Map(filas.map((f) => [f.huella, f.estado]));
    },

    async verificar({ organizacionId, huella }, registro) {
      const fila = await leerFila(organizacionId, huella);
      if (!fila || fila.estado !== "subido") return;

      const hash = createHash("sha256");
      let bytes = 0;
      const partes: Buffer[] = [];
      let cabecera = 0;
      for await (const trozo of await almacenamiento.leer(clave(organizacionId, huella))) {
        const b = trozo as Buffer;
        bytes += b.length;
        // Se corta la lectura apenas supera el límite: un objeto enorme no consume memoria.
        if (bytes > config.BYTES_MAXIMOS_ARCHIVO) break;
        hash.update(b);
        if (cabecera < BYTES_PARA_DETECTAR_TIPO) {
          partes.push(b);
          cabecera += b.length;
        }
      }
      const tipoReal = await fileTypeFromBuffer(Buffer.concat(partes).subarray(0, BYTES_PARA_DETECTAR_TIPO));

      const motivo =
        bytes > config.BYTES_MAXIMOS_ARCHIVO
          ? "supera el tamaño permitido"
          : bytes !== fila.bytes
            ? "el tamaño no coincide con el declarado"
            : hash.digest("hex") !== huella
              ? "la huella no coincide con el contenido"
              : tipoReal?.mime !== fila.tipo
                ? `el contenido no es ${fila.tipo}`
                : null;

      if (motivo === null) {
        await marcar(organizacionId, huella, "subido", { estado: "verificado", verificadoEn: new Date() });
        return;
      }
      // Un contenido que no pasa la verificación nunca fue aceptado por ningún envío: se elimina.
      registro?.warn({ huella, motivo }, "Archivo rechazado");
      await marcar(organizacionId, huella, "subido", { estado: "rechazado", motivoRechazo: motivo });
      await almacenamiento.eliminar(clave(organizacionId, huella));
    },

    registrarRutas(app) {
      registrarOperacion(app, "autorizarSubida", {
        politica: politicas.tecnico,
        manejar: async ({ cuerpo, actor }) => {
          if (cuerpo.bytes > config.BYTES_MAXIMOS_ARCHIVO) throw problema("archivo_demasiado_grande");
          const existente = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [fila] = await tx.select().from(archivos).where(eq(archivos.huella, cuerpo.huella));
            if (fila && (fila.estado === "subido" || fila.estado === "verificado")) return fila.estado;
            if (fila) {
              await tx
                .update(archivos)
                .set({ estado: "pendiente", tipo: cuerpo.tipo, bytes: cuerpo.bytes, creadoPor: actor.usuarioId, motivoRechazo: null })
                .where(eq(archivos.huella, cuerpo.huella));
            } else {
              await tx.insert(archivos).values({
                organizacionId: actor.organizacionId,
                huella: cuerpo.huella,
                tipo: cuerpo.tipo,
                bytes: cuerpo.bytes,
                estado: "pendiente",
                creadoPor: actor.usuarioId,
              });
            }
            return null;
          });
          // Direccionado por contenido: si otro técnico de la organización ya subió la misma foto, no se sube dos veces.
          if (existente) return { estado: "existente" as const, archivo: existente };

          const firma = await almacenamiento.firmarSubida(clave(actor.organizacionId, cuerpo.huella), {
            bytes: cuerpo.bytes,
            tipo: cuerpo.tipo,
            sha256Hex: cuerpo.huella,
          });
          return { estado: "autorizada" as const, url: firma.url, metodo: "PUT" as const, cabeceras: firma.cabeceras, expiraEn: firma.expiraEn.toISOString() };
        },
      });

      registrarOperacion(app, "confirmarSubida", {
        politica: politicas.tecnico,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (!fila) throw problema("no_encontrado", "Pida autorización antes de subir el archivo");
          if (fila.estado === "subido" || fila.estado === "verificado") return { archivo: fila.estado };
          // La consulta al almacenamiento va fuera de la transacción: no se retiene una conexión esperando la red.
          if (!(await almacenamiento.existe(clave(actor.organizacionId, huella)))) {
            throw problema("archivos_faltantes", "El archivo no llegó al almacenamiento", { faltantes: [huella] });
          }
          await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const actualizadas = await tx
              .update(archivos)
              .set({ estado: "subido", subidoEn: new Date() })
              .where(and(eq(archivos.huella, huella), eq(archivos.estado, "pendiente")))
              .returning({ huella: archivos.huella });
            if (actualizadas.length > 0) {
              await encolar(tx, "archivos.verificar", { organizacionId: actor.organizacionId, huella }, {
                // Sin cola con nombre: las verificaciones corren en paralelo (ADR-0012, regla 3).
                llave: `archivos.verificar:${actor.organizacionId}:${huella}`,
              });
            }
          });
          return { archivo: "subido" as const };
        },
      });

      registrarOperacion(app, "urlDeArchivo", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (fila?.estado !== "verificado") throw problema("no_encontrado");
          const { url, expiraEn } = await almacenamiento.firmarDescarga(clave(actor.organizacionId, huella));
          return { url, expiraEn: expiraEn.toISOString() };
        },
      });
    },
  };
}
