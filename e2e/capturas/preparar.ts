import { execFileSync, spawn } from "node:child_process";
import { comando } from "../consola";
import { CONTRASENA, FORMATOS, MODO, ORGANIZACION, PERSONAS, SIMBOLOS } from "./comun";

/**
 * Deja lista la organización de las capturas: la vacía (cada corrida empieza igual), la crea con sus formatos y
 * símbolos, y crea a quienes entran con una contraseña elegida. Los que entran con una temporal los crea
 * Administración en `datos.setup.ts`. Solo en local: borra con el dueño de la base del docker compose.
 */
const TABLAS = [
  "levantamientos.comentarios",
  "levantamientos.lecturas",
  "levantamientos.lineas_cantidad",
  "levantamientos.comandos_procesados",
  "levantamientos.levantamientos",
  "informes.versiones",
  "informes.informes",
  "cotizaciones.versiones",
  "cotizaciones.cotizaciones",
  "cotizaciones.consecutivos",
  "envios.envios",
  "portal.sesiones",
  "portal.pedidos",
  "portal.accesos",
  "clientes.contactos",
  "clientes.sitios",
  "clientes.clientes",
  "visitas.visitas",
  "visitas.consecutivos_de_orden",
  "catalogo.precios",
  "catalogo.items",
  "archivos.archivos",
  "formatos.versiones",
  "simbolos.simbolos",
  "avisos.suscripciones",
  "cambios.registro",
  "cambios.epocas",
  "auditoria.registros",
  "identidad.dispositivos",
  "identidad.usuarios",
];

function vaciarOrganizacion() {
  // Solo las dos organizaciones de las capturas: nunca la de desarrollo ni las del extremo a extremo.
  if (!/^00000000-0000-4000-8000-0000000000c[12]$/.test(ORGANIZACION)) throw new Error("Organización de capturas inesperada");
  const sql = `begin;\n${TABLAS.map((t) => `delete from ${t} where organizacion_id = '${ORGANIZACION}';`).join("\n")}\ncommit;`;
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "teins_propietario", "-d", "teins"], {
    cwd: new URL("../../", import.meta.url).pathname,
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

export default function preparar() {
  const servidor = { cwd: new URL("../../paquetes/servidor/", import.meta.url).pathname, stdio: "inherit" as const };
  console.log(`Capturas con los formatos de ${MODO}: organización ${ORGANIZACION}`);
  execFileSync("pnpm", ["migrar"], servidor);
  vaciarOrganizacion();
  comando("crear-organizacion", ["--id", ORGANIZACION, "--nombre", "TEINS"]);
  for (const archivo of FORMATOS) comando("publicar-formato", ["--organizacion", ORGANIZACION, "--archivo", archivo]);
  comando("publicar-simbolos", ["--organizacion", ORGANIZACION, "--archivo", SIMBOLOS]);
  for (const [clave, p] of Object.entries(PERSONAS)) {
    if (clave === "tecnico" || clave === "oficina") continue;
    const rol = clave.startsWith("tecnico") ? "tecnico" : "oficina";
    comando("crear-usuario", ["--organizacion", ORGANIZACION, "--usuario", p.usuario, "--nombre", p.nombre, "--rol", rol], { TEINS_CONTRASENA: CONTRASENA });
    if (clave.startsWith("admin")) comando("marcar-administrador", ["--usuario", p.usuario]);
  }

  // El worker: PDF, verificación de fotos y envíos simulados (nada sale del equipo).
  const worker = spawn("npx", ["tsx", "--env-file=.env", "src/worker.ts"], { cwd: servidor.cwd, stdio: "ignore", env: { ...process.env, ENVIOS_SIMULADOS: "true" } });
  return async () => {
    worker.kill("SIGTERM");
  };
}
