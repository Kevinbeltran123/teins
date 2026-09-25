// Interfaz pública del módulo de auditoría (ADR-0008).
export { leerCadena, registrar, verificarCadena } from "./registrar";
export type { EntradaAuditoria, RegistroLeido, ResultadoVerificacion, TipoAgregado, TipoEvento } from "./registrar";
