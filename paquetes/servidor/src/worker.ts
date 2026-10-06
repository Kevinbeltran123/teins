import { run, Logger } from "graphile-worker";
import pino from "pino";
import { leerConfig, urlDelPropietario } from "./config";
import { crearArchivos } from "./modulos/archivos";
import { crearAvisos, enviadorSegunConfig } from "./modulos/avisos";
import { crearGeneradorPdfDeCotizaciones } from "./modulos/cotizaciones";
import { crearEnvios, proveedoresSegunConfig } from "./modulos/envios";
import { crearGeneradorPdf } from "./modulos/informes";
import { podarVencido, recuperarTrabajosAMedias } from "./modulos/mantenimiento";
import { almacenamientoS3 } from "./plataforma/almacenamiento";
import { conectar } from "./plataforma/base-de-datos";
import { cerrarNavegador } from "./plataforma/pdf";
import { definirTareas } from "./tareas";

/**
 * Rol worker (ADR-0001, ADR-0012). La cola usa la conexión del dueño (sus funciones lo exigen);
 * el trabajo de negocio usa la del rol de la aplicación, sujeta a seguridad por fila.
 */
const config = leerConfig();
const registro = pino({ level: config.NIVEL_REGISTRO, base: { rol: "worker" } });
const alFallar = (error: Error) => registro.error({ err: error }, "Error de conexión");
const negocio = conectar(config.DATABASE_URL, config.POOL_MAXIMO, alFallar);
const cola = conectar(urlDelPropietario(config), 4, alFallar);

const almacenamiento = almacenamientoS3(config);
const archivos = crearArchivos({ bd: negocio.bd, almacenamiento, config });
const informes = crearGeneradorPdf({ bd: negocio.bd, almacenamiento, config });
const avisos = crearAvisos({ bd: negocio.bd, config, enviador: enviadorSegunConfig(config) });
const envios = crearEnvios({ bd: negocio.bd, almacenamiento, config, proveedores: proveedoresSegunConfig(config) });
const cotizaciones = crearGeneradorPdfDeCotizaciones({ bd: negocio.bd, almacenamiento, config });

const logger = new Logger((alcance) => (nivel, mensaje, meta) => {
  const metodo = nivel === "error" ? "error" : nivel === "warning" ? "warn" : nivel === "debug" ? "debug" : "info";
  registro[metodo]({ ...alcance, ...meta }, mensaje);
});

/** La tarea periódica (ADR-0043, ADR-0044): recupera lo que quedó a medias y poda lo vencido. */
const mantener = async (bds: { negocio: typeof negocio.bd; propietario: typeof cola.bd }) => {
  await recuperarTrabajosAMedias(bds.negocio);
  await podarVencido(bds);
};

const corredor = await run({
  pgPool: cola.pool,
  taskList: definirTareas({ archivos, informes, avisos, envios, cotizaciones, mantenimiento: { recuperar: () => mantener({ negocio: negocio.bd, propietario: cola.bd }) } }),
  concurrency: 4,
  // Las tareas periódicas (ADR-0012, regla 5) se declaran aquí; nunca en un archivo suelto. Cada hora, en el minuto
  // 17 para no coincidir con otros procesos en punto: lo que quedó a medias vuelve a la cola (ADR-0043).
  crontab: "17 * * * * mantenimiento.recuperar",
  noHandleSignals: true,
  logger,
});

// Un trabajo que agota sus reintentos queda visible (ADR-0012, regla 4).
corredor.events.on("job:failed", ({ job, error }) => {
  if (job.attempts >= job.max_attempts) registro.error({ trabajo: job.task_identifier, id: job.id, err: error }, "Trabajo agotó sus reintentos");
});

let cerrando = false;
async function apagar(senal: string) {
  if (cerrando) return;
  cerrando = true;
  registro.info({ senal }, "Apagando: se terminan los trabajos en curso");
  await corredor.stop();
  await Promise.all([negocio.cerrar(), cola.cerrar(), cerrarNavegador()]);
  process.exit(0);
}
process.on("SIGTERM", () => void apagar("SIGTERM"));
process.on("SIGINT", () => void apagar("SIGINT"));
await corredor.promise;
