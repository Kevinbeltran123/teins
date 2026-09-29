// Vacía el almacenamiento S3 del entorno de pruebas (fotos, bocetos, firmas, planos y PDF), después de
// infra/limpieza/dejar-limpio.sql. Los formatos y los símbolos viven en la base: no se tocan.
// No se deshace: solo en el entorno de pruebas. Sin CONFIRMAR=si, solo cuenta lo que borraría.
// Uso, desde paquetes/servidor:
//   railway run --service campo node scripts/vaciar-almacenamiento.mjs
//   railway run --service campo env CONFIRMAR=si node scripts/vaciar-almacenamiento.mjs
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const e = process.env;
// La misma guarda que sembrar: en producción solo corre si el entorno se declara de pruebas.
if (e.NODE_ENV === "production" && e.ENTORNO_DE_PRUEBAS !== "true") {
  console.error("vaciar-almacenamiento no corre en producción (en el entorno de pruebas, ENTORNO_DE_PRUEBAS=true).");
  process.exit(1);
}
const s3 = new S3Client({
  region: e.S3_REGION,
  ...(e.S3_ENDPOINT ? { endpoint: e.S3_ENDPOINT } : {}),
  forcePathStyle: e.S3_FORZAR_RUTA === "true",
  credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
});
const Bucket = e.S3_BUCKET;
const borrar = e.CONFIRMAR === "si";
let objetos = 0;
let bytes = 0;
let token;

// Al borrar se vuelve a pedir la primera página hasta que no quede nada; al contar, se recorren las páginas.
for (;;) {
  const pagina = await s3.send(new ListObjectsV2Command({ Bucket, MaxKeys: 1000, ...(borrar ? {} : { ContinuationToken: token }) }));
  const lista = pagina.Contents ?? [];
  if (lista.length === 0) break;
  objetos += lista.length;
  bytes += lista.reduce((s, o) => s + (o.Size ?? 0), 0);
  if (borrar) {
    const r = await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: lista.map((o) => ({ Key: o.Key })), Quiet: true } }));
    if (r.Errors?.length) throw new Error(`No se pudieron borrar ${r.Errors.length} objetos: ${r.Errors[0].Message}`);
  } else {
    token = pagina.NextContinuationToken;
    if (!token) break;
  }
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(borrar ? `Borrados ${objetos} objetos (${mb} MB) de ${Bucket}.` : `${Bucket} tiene ${objetos} objetos (${mb} MB). Para borrarlos, repita con CONFIRMAR=si.`);
