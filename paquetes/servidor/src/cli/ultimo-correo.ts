import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { leerConfig } from "../config";
import { archivoDelCorreoSimulado } from "../modulos/envios/proveedores";

/**
 * El último correo simulado que salió a una dirección: asunto y texto (ADR-0053). Lo usa la prueba de extremo a
 * extremo para leer el código del portal. Solo con envíos simulados: en producción, o con Resend, se niega.
 *   pnpm ultimo-correo --para ana@cliente.example
 */
const { values } = parseArgs({ options: { para: { type: "string" } } });
if (!values.para) {
  console.error("Uso: pnpm ultimo-correo --para <correo>");
  process.exit(1);
}
const config = leerConfig();
if (config.NODE_ENV === "production" || (!config.ENVIOS_SIMULADOS.correo && config.RESEND_CLAVE_API)) {
  console.error("Este comando solo lee los correos simulados: aquí el correo sale de verdad.");
  process.exit(1);
}
try {
  const { asunto, texto } = JSON.parse(readFileSync(archivoDelCorreoSimulado(values.para), "utf8")) as { asunto: string; texto: string };
  console.log(`Asunto: ${asunto}\n\n${texto}`);
} catch {
  console.error(`No hay correos simulados para ${values.para}`);
  process.exit(1);
}
