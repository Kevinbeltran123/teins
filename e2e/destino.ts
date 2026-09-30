/**
 * Contra qué sistema corre el extremo a extremo: el local (por defecto) o un entorno desplegado,
 * con E2E_CAMPO_URL y E2E_OFICINA_URL. Los comandos de administración corren dentro del entorno
 * con `railway ssh` (docs/proceso/entorno-de-pruebas.md).
 */
export const REMOTO = Boolean(process.env.E2E_CAMPO_URL);
export const CAMPO = process.env.E2E_CAMPO_URL ?? "http://localhost:5173";
export const OFICINA = process.env.E2E_OFICINA_URL ?? "http://localhost:5174";
export const PORTAL = process.env.E2E_PORTAL_URL ?? "http://localhost:5175";
