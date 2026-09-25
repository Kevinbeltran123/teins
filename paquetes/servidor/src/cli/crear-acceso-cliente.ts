import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import QRCode from "qrcode";
import { leerConfig } from "../config";
import { conectar } from "../plataforma/base-de-datos";
import { crearAccesosDeClientes, urlDeAcceso, type CredencialesDeAcceso } from "../modulos/portal";

/**
 * Crea (o con --regenerar, reemplaza) el acceso de un cliente al portal (ADR-0009, parte 4). Muestra
 * una sola vez la clave: la base solo guarda su hash. El QR lleva la URL con el identificador, nunca la clave.
 *   pnpm crear-acceso-cliente --organizacion <uuid> --cliente <uuid> [--qr acceso.svg]
 *   pnpm regenerar-acceso-cliente --organizacion <uuid> --cliente <uuid> [--qr acceso.svg]
 */
const { values } = parseArgs({
  options: { organizacion: { type: "string" }, cliente: { type: "string" }, qr: { type: "string" }, regenerar: { type: "boolean" } },
});
const { organizacion, cliente, qr, regenerar } = values;
if (!organizacion || !cliente) {
  console.error("Uso: pnpm crear-acceso-cliente --organizacion <uuid> --cliente <uuid> [--qr archivo.svg]");
  process.exit(1);
}

const config = leerConfig();
if (!config.PORTAL_URL) {
  console.error("Falta PORTAL_URL: la dirección del portal que lleva el QR.");
  process.exit(1);
}
const conexion = conectar(config.DATABASE_URL, 2);
try {
  const accesos = crearAccesosDeClientes(conexion.bd);
  const contexto = { autorId: "administrador", correlacion: `consola:${randomUUID()}` };
  const c: CredencialesDeAcceso = regenerar ? await accesos.regenerar(organizacion, cliente, contexto) : await accesos.crear(organizacion, cliente, contexto);
  const url = urlDeAcceso(config.PORTAL_URL, c.identificador);
  console.log(`Identificador: ${c.identificador}\nClave: ${c.clave}\nURL del QR: ${url}`);
  console.log("Entregue la clave por un medio distinto al del QR. No se vuelve a mostrar.");
  console.log(await QRCode.toString(url, { type: "terminal", small: true }));
  if (qr) {
    writeFileSync(qr, await QRCode.toString(url, { type: "svg", margin: 2 }));
    console.log(`QR guardado en ${qr}`);
  }
} finally {
  await conexion.cerrar();
}
