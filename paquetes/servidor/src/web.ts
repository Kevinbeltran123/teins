import { construirApp } from "./app";
import { leerConfig } from "./config";
import { almacenamientoS3 } from "./plataforma/almacenamiento";
import { conectar } from "./plataforma/base-de-datos";

/** Rol web (ADR-0001): atiende solicitudes. Sin estado: se puede tener varias instancias. */
const config = leerConfig();
const conexion = conectar(config.DATABASE_URL, config.POOL_MAXIMO, (error) => app.log.error({ err: error }, "Error de conexión"));
const { app } = await construirApp({ config, bd: conexion.bd, almacenamiento: almacenamientoS3(config) });

let cerrando = false;
async function apagar(senal: string) {
  if (cerrando) return;
  cerrando = true;
  app.log.info({ senal }, "Apagando: se terminan las solicitudes en curso");
  // Termina lo que está en curso antes de cerrar las conexiones.
  await app.close();
  await conexion.cerrar();
  process.exit(0);
}
process.on("SIGTERM", () => void apagar("SIGTERM"));
process.on("SIGINT", () => void apagar("SIGINT"));

await app.listen({ host: config.HOST, port: config.PUERTO });
