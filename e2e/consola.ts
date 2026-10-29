import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { REMOTO } from "./destino";

/**
 * Comandos de administración del servidor (paquetes/servidor/src/cli), como los usaría TEINS: en local
 * con pnpm, y en un entorno desplegado dentro del servicio `campo` con `railway ssh`.
 * Todo lo que crean es ficticio (R5) y propio de la corrida.
 */
export const ORGANIZACION = "00000000-0000-4000-8000-000000000001";
const servidor = new URL("../paquetes/servidor/", import.meta.url).pathname;
const raiz = new URL("../", import.meta.url).pathname;

export function comando(nombre: string, args: string[], env: Record<string, string> = {}): string {
  if (REMOTO) {
    const variables = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    // La conexión SSH a Railway falla de vez en cuando; un comando que ya se aplicó falla al repetirse
    // (usuario existente) en lugar de duplicar nada.
    for (let intento = 1; ; intento++) {
      try {
        return execFileSync("railway", ["ssh", "-s", "campo", "--", "env", ...variables, "node", `dist/cli/${nombre}.js`, ...args], { cwd: raiz, encoding: "utf8" });
      } catch (error) {
        if (intento >= 3) throw error;
      }
    }
  }
  return execFileSync("pnpm", ["--silent", nombre, ...args], { cwd: servidor, env: { ...process.env, ...env }, encoding: "utf8" });
}

export interface Usuario {
  usuario: string;
  nombre: string;
  contrasena: string;
}

export function nuevoUsuario(rol: "tecnico" | "oficina", prefijo: string): Usuario {
  const sufijo = randomBytes(3).toString("hex");
  const u = { usuario: `${prefijo}.${sufijo}`, nombre: `${rol === "oficina" ? "Oficina" : "Técnico"} E2E ${sufijo}`, contrasena: randomBytes(12).toString("base64url") };
  comando("crear-usuario", ["--organizacion", ORGANIZACION, "--usuario", u.usuario, "--nombre", u.nombre, "--rol", rol], { TEINS_CONTRASENA: u.contrasena });
  return u;
}

/** Persona de oficina marcada como administradora; el segundo factor lo activa ella (iteración 6). */
export function nuevoAdministrador(): Usuario {
  const u = nuevoUsuario("oficina", "admin");
  comando("marcar-administrador", ["--usuario", u.usuario]);
  return u;
}

/** Cliente ficticio con una visita para hoy asignada al técnico. Devuelve el nombre del cliente. */
export function nuevaVisita(tecnico: Usuario): string {
  return nuevaVisitaConCliente(tecnico).cliente;
}

/** `diasDespues`: la visita se programa para dentro de tantos días (hoy en Bogotá si es 0). */
export function nuevaVisitaConCliente(tecnico: Usuario, diasDespues = 0): { cliente: string; clienteId: string; visitaId: string } {
  const cliente = `Cliente E2E ${randomBytes(3).toString("hex")}`;
  const salida = comando("crear-cliente", ["--organizacion", ORGANIZACION, "--nombre", cliente, "--sitio", "Sede E2E", "--direccion", "Calle [N] # [N]-[N]"]);
  const [clienteId, sitioId] = [...salida.matchAll(/creado: ([0-9a-f-]{36})/g)].map((m) => m[1]!);
  const fecha = new Date(Date.now() + diasDespues * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const visita = comando("crear-visita", ["--organizacion", ORGANIZACION, "--cliente", clienteId!, "--sitio", sitioId!, "--motivo", "Mantenimiento", "--fecha", fecha, "--tecnicos", tecnico.usuario]);
  return { cliente, clienteId: clienteId!, visitaId: /Visita creada: ([0-9a-f-]{36})/.exec(visita)![1]! };
}

/** Acceso de cliente al portal: identificador, clave y la URL que lleva el QR. */
export function nuevoAcceso(clienteId: string): { identificador: string; clave: string; url: string } {
  const salida = comando("crear-acceso-cliente", ["--organizacion", ORGANIZACION, "--cliente", clienteId]);
  const valor = (etiqueta: string) => new RegExp(`${etiqueta}: (\\S+)`).exec(salida)?.[1] ?? "";
  return { identificador: valor("Identificador"), clave: valor("Clave"), url: valor("URL del QR") };
}
