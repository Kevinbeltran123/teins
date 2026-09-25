import { z } from "zod";
import { LIMITES } from "@teins/dominio";
import { Fecha, Huella, Respuestas, Uuid, Valor, VersionFormato } from "./dominio";
import type { CodigoProblema } from "./problemas";

/**
 * Catálogo del contrato HTTP (ADR-0014). El servidor registra un manejador por operación
 * y los clientes llaman por operación: un cambio aquí rompe la compilación, no la integración.
 */
export interface Operacion {
  metodo: "GET" | "POST";
  /** Ruta con parámetros al estilo OpenAPI: `/api/archivos/{huella}`. */
  ruta: string;
  resumen: string;
  /** Operaciones de sincronización: exigen la cabecera de versión del protocolo. */
  sincronizacion?: true;
  parametros?: z.ZodObject;
  consulta?: z.ZodObject;
  cuerpo?: z.ZodType;
  estadoExito: 200 | 201 | 202;
  respuesta: z.ZodType;
  errores: readonly CodigoProblema[];
}

// Sesión

const Rol = z.enum(["tecnico", "oficina"]);
export const Sesion = z
  .object({
    usuario: z.object({ id: z.string(), nombre: z.string(), rol: Rol }),
    /** Hasta cuándo el dispositivo puede trabajar sin contacto (ADR-0009, parte 2). Cada bajada lo renueva. */
    permisoLocalHasta: Fecha,
  })
  .meta({ id: "Sesion" });

// Archivos (ADR-0007)

export const TIPOS_DE_ARCHIVO = ["image/jpeg"] as const;

const AutorizarSubida = z
  .object({
    huella: Huella,
    bytes: z.int().positive(),
    tipo: z.enum(TIPOS_DE_ARCHIVO),
  })
  .meta({ id: "AutorizarSubida" });

const EstadoArchivo = z.enum(["pendiente", "subido", "verificado"]);

const SubidaAutorizada = z
  .discriminatedUnion("estado", [
    z.object({ estado: z.literal("existente"), archivo: EstadoArchivo }),
    z.object({
      estado: z.literal("autorizada"),
      url: z.url(),
      metodo: z.literal("PUT"),
      /** Cabeceras que el cliente debe enviar tal cual: la firma las incluye. */
      cabeceras: z.record(z.string(), z.string()),
      expiraEn: Fecha,
    }),
  ])
  .meta({ id: "SubidaAutorizada" });

// Sincronización (ADR-0003)

import { llaveDeEnvio } from "./llaves";
export { llaveDeEnvio };

export const EnviarLevantamiento = z
  .object({
    tipo: z.literal("EnviarLevantamiento"),
    /** Llave de idempotencia derivada del levantamiento: estable entre reintentos y reinstalaciones. */
    llave: z.string().regex(/^enviar:[0-9a-f-]{36}$/),
    levantamiento: z.object({
      id: Uuid,
      formato: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
      versionFormato: z.int().positive(),
      /** Opcional: los borradores de los cortes 0 y 1 no tienen visita (ADR-0015, expansión). */
      visitaId: Uuid.optional(),
      respuestas: Respuestas,
      creadoEn: Fecha,
      enviadoEn: Fecha,
    }),
  })
  .refine((c) => c.llave === llaveDeEnvio(c.levantamiento.id), { message: "La llave no corresponde al levantamiento", path: ["llave"] })
  .meta({ id: "EnviarLevantamiento" });
export type EnviarLevantamiento = z.infer<typeof EnviarLevantamiento>;

export const Comando = EnviarLevantamiento;

export const ResultadoComando = z
  .object({ resultado: z.literal("aceptado"), levantamientoId: Uuid, recibidoEn: Fecha })
  .meta({ id: "ResultadoComando" });
export type ResultadoComando = z.infer<typeof ResultadoComando>;

/** Estado de negocio después del envío (modelo de dominio, sección 5). */
const EstadoLevantamiento = z.enum(["enviado", "en_revision", "revisado"]);

const Persona = z.object({ id: z.string(), nombre: z.string() });

/** Nota de oficina al técnico, opcionalmente sobre un campo. No modifica datos. */
const ComentarioParaTecnico = z.object({
  id: Uuid,
  texto: z.string(),
  seccion: z.string().optional(),
  campo: z.string().optional(),
  autor: z.string(),
  creadoEn: Fecha,
});

// Bajada (ADR-0003): cambios del alcance del usuario desde un punto de control.

export const VisitaAsignada = z
  .object({
    id: Uuid,
    cliente: z.object({ nombre: z.string() }),
    sitio: z.object({ nombre: z.string(), direccion: z.string() }),
    motivo: z.string(),
    programadaPara: z.iso.date(),
  })
  .meta({ id: "VisitaAsignada" });
export type VisitaAsignada = z.infer<typeof VisitaAsignada>;

export const Cambio = z
  .discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("formato"), definicion: VersionFormato }),
    z.object({ tipo: z.literal("visita"), visita: VisitaAsignada }),
    /** Estado de negocio de un levantamiento propio, según el servidor. */
    z.object({
      tipo: z.literal("levantamiento"),
      id: Uuid,
      estado: EstadoLevantamiento,
      recibidoEn: Fecha,
      /** Desde la app versión 3; a una anterior el servidor le manda "enviado" y sin comentarios (ADR-0015). */
      comentarios: z.array(ComentarioParaTecnico).optional(),
    }),
    /** Salió del alcance del usuario (por ejemplo, la visita se reasignó): el dispositivo la retira. */
    z.object({ tipo: z.literal("fuera_de_alcance"), entidad: z.enum(["visita"]), id: Uuid }),
  ])
  .meta({ id: "Cambio" });
export type Cambio = z.infer<typeof Cambio>;

export const Bajada = z
  .object({
    cambios: z.array(Cambio),
    /** Se envía como `desde` en la siguiente bajada. Nunca retrocede. */
    puntoDeControl: z.int().min(0),
    /** Quedan cambios: pedir otra página de inmediato. */
    hayMas: z.boolean(),
    permisoLocalHasta: Fecha,
  })
  .meta({ id: "Bajada" });
export type Bajada = z.infer<typeof Bajada>;

// Dispositivo (ADR-0009, ADR-0017)

/** 32 bytes aleatorios en base64url, generados en el dispositivo. El servidor solo guarda su huella. */
const SecretoDispositivo = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Informe de salud: solo datos técnicos, nunca contenido de levantamientos (ADR-0017). */
export const SaludDispositivo = z
  .object({
    versionApp: z.int().min(1),
    versionEsquemaLocal: z.int().min(1),
    pendientes: z.int().min(0),
    pendienteMasAntiguo: Fecha.nullable(),
    bytesUsados: z.int().min(0).nullable(),
    bytesDisponibles: z.int().min(0).nullable(),
    persistente: z.boolean().nullable(),
    ultimoError: z.string().max(300).nullable(),
  })
  .meta({ id: "SaludDispositivo" });
export type SaludDispositivo = z.infer<typeof SaludDispositivo>;

const InformarDispositivo = z.object({ id: Uuid, secreto: SecretoDispositivo, salud: SaludDispositivo }).meta({ id: "InformarDispositivo" });

const ConsultarOrdenes = z
  .object({
    id: Uuid,
    secreto: SecretoDispositivo,
    /** Usuarios cuyos datos ya se borraron en el dispositivo desde la consulta anterior. */
    confirmados: z.array(z.string().max(100)).max(20).default([]),
  })
  .meta({ id: "ConsultarOrdenes" });

export const OrdenesDelDispositivo = z
  .object({ borrar: z.array(z.string()).describe("Usuarios revocados: el dispositivo borra sus datos") })
  .meta({ id: "OrdenesDelDispositivo" });

// Oficina

const ResumenLevantamiento = z.object({
  id: Uuid,
  formato: z.string(),
  versionFormato: z.int(),
  estado: EstadoLevantamiento,
  tecnico: Persona,
  /** Quién tiene la revisión (I-1): visible para todos. */
  revisor: Persona.nullable(),
  recibidoEn: Fecha,
  fotos: z.int(),
  /** Concurrencia optimista (ADR-0005): cada guardado lleva la versión que la persona tenía abierta. */
  version: z.int().positive(),
});

export const Comentario = z
  .object({ id: Uuid, texto: z.string(), seccion: z.string().optional(), campo: z.string().optional(), autor: Persona, creadoEn: Fecha })
  .meta({ id: "Comentario" });

export const PaginaLevantamientos = z
  .object({ elementos: z.array(ResumenLevantamiento), siguienteCursor: z.string().nullable(), total: z.int().min(0) })
  .meta({ id: "PaginaLevantamientos" });

export const DetalleLevantamiento = ResumenLevantamiento.extend({
  respuestas: Respuestas,
  formatoDefinicion: VersionFormato,
  creadoEnDispositivo: Fecha,
  enviadoEnDispositivo: Fecha,
  visita: z
    .object({ cliente: z.string(), sitio: z.string(), direccion: z.string(), motivo: z.string(), programadaPara: z.iso.date() })
    .nullable(),
  comentarios: z.array(Comentario),
}).meta({ id: "DetalleLevantamiento" });

const EstadoDeRevision = z.object({ estado: EstadoLevantamiento, revisor: Persona.nullable(), version: z.int().positive() }).meta({ id: "EstadoDeRevision" });

const ConVersion = { version: z.int().positive() };

export const Historial = z
  .object({
    eventos: z.array(
      z.object({
        secuencia: z.int(),
        tipo: z.string(),
        seccion: z.string().optional(),
        campo: z.string().optional(),
        anterior: z.unknown().optional(),
        nuevo: z.unknown().optional(),
        autor: Persona,
        hora: Fecha,
        horaDispositivo: Fecha.optional(),
        motivo: z.string().optional(),
        /** Los cambios de un mismo guardado comparten correlación (ADR-0008). */
        correlacion: z.string(),
      }),
    ),
    /** Verificación de la cadena de hashes del levantamiento (ADR-0008, nivel 2b). */
    integra: z.boolean(),
  })
  .meta({ id: "Historial" });

export const UrlDeArchivo = z.object({ url: z.url(), expiraEn: Fecha }).meta({ id: "UrlDeArchivo" });

export const operaciones = {
  obtenerSesion: {
    metodo: "GET",
    ruta: "/api/sesion",
    resumen: "Usuario de la sesión actual",
    estadoExito: 200,
    respuesta: Sesion,
    errores: ["no_autenticado"],
  },
  autorizarSubida: {
    metodo: "POST",
    ruta: "/api/archivos/subidas",
    resumen: "Autoriza la carga directa de un archivo al almacenamiento",
    sincronizacion: true,
    cuerpo: AutorizarSubida,
    estadoExito: 200,
    respuesta: SubidaAutorizada,
    errores: ["no_autenticado", "sin_permiso", "archivo_demasiado_grande", "tipo_de_archivo_no_permitido", "version_protocolo_no_soportada"],
  },
  confirmarSubida: {
    metodo: "POST",
    ruta: "/api/archivos/{huella}/subido",
    resumen: "Avisa que la carga terminó; el servidor lo verifica en segundo plano",
    sincronizacion: true,
    parametros: z.object({ huella: Huella }),
    estadoExito: 202,
    respuesta: z.object({ archivo: EstadoArchivo }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "archivos_faltantes", "version_protocolo_no_soportada"],
  },
  enviarComando: {
    metodo: "POST",
    ruta: "/api/sync/comandos",
    resumen: "Procesa un comando del dispositivo de forma idempotente",
    sincronizacion: true,
    cuerpo: Comando,
    estadoExito: 200,
    respuesta: ResultadoComando,
    errores: [
      "no_autenticado",
      "sin_permiso",
      "conflicto",
      "archivos_faltantes",
      "archivos_en_verificacion",
      "respuestas_invalidas",
      "formato_desconocido",
      "version_protocolo_no_soportada",
    ],
  },
  obtenerCambios: {
    metodo: "GET",
    ruta: "/api/sync/cambios",
    resumen: "Cambios del alcance del usuario desde un punto de control",
    sincronizacion: true,
    consulta: z.object({
      desde: z.coerce.number().int().min(0).default(0),
      /** Versión de `campo`: la bajada no entrega formatos que esa versión no sabe mostrar (ADR-0015). */
      app: z.coerce.number().int().min(1),
      limite: z.coerce.number().int().min(1).max(500).default(200),
    }),
    estadoExito: 200,
    respuesta: Bajada,
    errores: ["no_autenticado", "sin_permiso", "version_protocolo_no_soportada"],
  },
  informarDispositivo: {
    metodo: "POST",
    ruta: "/api/sync/dispositivo",
    resumen: "Registra el dispositivo del usuario y su informe de salud",
    sincronizacion: true,
    cuerpo: InformarDispositivo,
    estadoExito: 202,
    respuesta: z.object({}),
    errores: ["no_autenticado", "sin_permiso", "conflicto", "version_protocolo_no_soportada"],
  },
  consultarOrdenes: {
    metodo: "POST",
    ruta: "/api/sync/dispositivo/ordenes",
    resumen: "Órdenes de borrado del dispositivo; se autentica con su secreto, no con la sesión",
    sincronizacion: true,
    cuerpo: ConsultarOrdenes,
    estadoExito: 200,
    respuesta: OrdenesDelDispositivo,
    errores: ["no_autenticado", "version_protocolo_no_soportada"],
  },
  listarLevantamientos: {
    metodo: "GET",
    ruta: "/api/levantamientos",
    resumen: "Levantamientos por estado, del que más lleva esperando al más reciente",
    consulta: z.object({
      estado: EstadoLevantamiento.default("enviado"),
      cursor: z.string().max(200).optional(),
      limite: z.coerce.number().int().min(1).max(100).default(50),
    }),
    estadoExito: 200,
    respuesta: PaginaLevantamientos,
    errores: ["no_autenticado", "sin_permiso"],
  },
  obtenerLevantamiento: {
    metodo: "GET",
    ruta: "/api/levantamientos/{id}",
    resumen: "Detalle de un levantamiento con la definición de su formato",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleLevantamiento,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  tomarLevantamiento: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/tomar",
    resumen: "Tomar para revisar; quitarle la revisión a otra persona exige `reasignar`",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ ...ConVersion, reasignar: z.boolean().default(false) }),
    estadoExito: 200,
    respuesta: EstadoDeRevision,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "tomado_por_otro", "estado_invalido"],
  },
  corregirLevantamiento: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/correcciones",
    resumen: "Corrige campos; cada cambio queda con valor anterior y nuevo (QA-8)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({
      ...ConVersion,
      correcciones: z
        .array(z.object({ seccion: z.string().max(64), campo: z.string().max(64), /** null borra el dato. */ valor: Valor.nullable() }))
        .min(1)
        .max(50),
      motivo: z.string().trim().max(500).optional(),
    }),
    estadoExito: 200,
    respuesta: z.object({ version: z.int().positive(), cambios: z.int().min(0) }).meta({ id: "CorreccionAplicada" }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "no_tomado", "estado_invalido", "respuestas_invalidas"],
  },
  marcarRevisado: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/marcar-revisado",
    resumen: "Marca revisado un levantamiento con respuestas válidas",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object(ConVersion),
    estadoExito: 200,
    respuesta: EstadoDeRevision,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "no_tomado", "estado_invalido", "respuestas_invalidas"],
  },
  comentarLevantamiento: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/comentarios",
    resumen: "Comentario de oficina al técnico; llega en la siguiente bajada",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ texto: z.string().trim().min(1).max(2000), seccion: z.string().max(64).optional(), campo: z.string().max(64).optional() }),
    estadoExito: 201,
    respuesta: Comentario,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  historialLevantamiento: {
    metodo: "GET",
    ruta: "/api/levantamientos/{id}/historial",
    resumen: "Historial de cambios del levantamiento con la verificación de su cadena",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: Historial,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  urlDeArchivo: {
    metodo: "GET",
    ruta: "/api/archivos/{huella}/url",
    resumen: "URL de descarga firmada y de corta duración",
    parametros: z.object({ huella: Huella }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
} as const satisfies Record<string, Operacion>;

export type Operaciones = typeof operaciones;
export type NombreOperacion = keyof Operaciones;

type Salida<T> = T extends z.ZodType ? z.output<T> : undefined;
type Entrada<T> = T extends z.ZodType ? z.input<T> : undefined;

/** Tipos de cada operación, para el servidor (salida de la validación) y los clientes (entrada). */
export type Cuerpo<N extends NombreOperacion> = Salida<Operaciones[N] extends { cuerpo: infer C } ? C : undefined>;
export type CuerpoEntrada<N extends NombreOperacion> = Entrada<Operaciones[N] extends { cuerpo: infer C } ? C : undefined>;
export type Parametros<N extends NombreOperacion> = Salida<Operaciones[N] extends { parametros: infer P } ? P : undefined>;
export type ParametrosEntrada<N extends NombreOperacion> = Entrada<Operaciones[N] extends { parametros: infer P } ? P : undefined>;
export type Consulta<N extends NombreOperacion> = Salida<Operaciones[N] extends { consulta: infer Q } ? Q : undefined>;
export type ConsultaEntrada<N extends NombreOperacion> = Entrada<Operaciones[N] extends { consulta: infer Q } ? Q : undefined>;
export type Respuesta<N extends NombreOperacion> = z.output<Operaciones[N]["respuesta"]>;
/** Lo que produce el manejador del servidor antes de validarse con el esquema de respuesta. */
export type RespuestaServidor<N extends NombreOperacion> = z.input<Operaciones[N]["respuesta"]>;

/** Tamaño máximo de un archivo de campo: una foto recodificada pesa unos cientos de KB (ADR-0007). */
export const BYTES_MAXIMOS_ARCHIVO = 10 * 1024 * 1024;
void LIMITES;
