import { z } from "zod";
import { LIMITES } from "@teins/dominio";
import { Fecha, Huella, Repeticiones, Respuestas, Uuid, Valor, VersionFormato } from "./dominio";
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
    usuario: z.object({
      id: z.string(),
      nombre: z.string(),
      rol: Rol,
      /** Persona de oficina que además administra (iteración 6). */
      administrador: z.boolean().default(false),
      /** Segundo factor activo: obligatorio para administrar (ADR-0009). */
      segundoFactor: z.boolean().default(false),
    }),
    /** Hasta cuándo el dispositivo puede trabajar sin contacto (ADR-0009, parte 2). Cada bajada lo renueva. */
    permisoLocalHasta: Fecha,
  })
  .meta({ id: "Sesion" });

// Archivos (ADR-0007)

/** Fotos desde campo; planos en PDF desde oficina (corte 4). */
export const TIPOS_DE_ARCHIVO = ["image/jpeg", "application/pdf"] as const;

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
      /** Solo en formatos con secciones repetibles (app 4, iteración 9): expansión, una app anterior no lo manda. */
      repeticiones: Repeticiones.optional(),
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
    /** Salió del alcance del usuario (la visita se reasignó o se canceló): el dispositivo la retira. */
    z.object({
      tipo: z.literal("fuera_de_alcance"),
      entidad: z.enum(["visita"]),
      id: Uuid,
      /** Iteración 7, expansión (ADR-0015): una app anterior no lo lee y la trata como reasignada. */
      motivo: z.enum(["reasignada", "cancelada"]).optional(),
    }),
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
  repeticiones: Repeticiones.default({}),
  formatoDefinicion: VersionFormato,
  creadoEnDispositivo: Fecha,
  enviadoEnDispositivo: Fecha,
  visita: z
    .object({ id: Uuid, cliente: z.string(), sitio: z.string(), direccion: z.string(), motivo: z.string(), programadaPara: z.iso.date() })
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

// Informes (corte 4)

const Plano = z.object({ huella: Huella, nombre: z.string().trim().min(1).max(200) });

/** "Publicada" y "visible para el cliente" son distintos: sin PDF listo, el cliente no la ve (ADR-0013). */
const EstadoPdf = z.enum(["generando", "listo", "fallido"]);

export const VersionPublicada = z
  .object({
    numero: z.int().positive(),
    publicadaEn: Fecha,
    publicadaPor: Persona,
    pdf: EstadoPdf,
    /** Retirada del portal por una persona administradora (el cliente ya no la ve); se conserva. */
    retirada: z.object({ en: Fecha, por: Persona, motivo: z.string() }).nullable().default(null),
  })
  .meta({ id: "VersionPublicada" });

const VisitaDelInforme = z.object({ cliente: z.string(), sitio: z.string(), direccion: z.string(), motivo: z.string(), programadaPara: z.iso.date() });

export const PaginaInformes = z
  .object({
    elementos: z.array(
      z.object({
        id: Uuid,
        visita: VisitaDelInforme,
        /** Número de la versión vigente; null mientras no se publica ninguna. */
        vigente: z.int().positive().nullable(),
        pdf: EstadoPdf.nullable(),
      }),
    ),
  })
  .meta({ id: "PaginaInformes" });

export const DetalleInforme = z
  .object({
    id: Uuid,
    visitaId: Uuid,
    visita: VisitaDelInforme,
    version: z.int().positive(),
    introduccion: z.string(),
    conclusiones: z.string(),
    levantamientos: z.array(Uuid),
    planos: z.array(Plano),
    /** Levantamientos de la visita, incluidos o no, para componer (solo los revisados se pueden incluir). */
    candidatos: z.array(z.object({ id: Uuid, formato: z.string(), tecnico: z.string(), estado: EstadoLevantamiento, recibidoEn: Fecha })),
    versiones: z.array(VersionPublicada),
  })
  .meta({ id: "DetalleInforme" });

// Portal del cliente (corte 5, ADR-0009 parte 4)

/** Identificador del acceso: aleatorio, no adivinable, viaja en el QR. Nunca la clave. */
export const IDENTIFICADOR_ACCESO = /^[a-hjkmnp-z2-9]{20}$/;

export const SesionPortal = z.object({ cliente: z.string() }).meta({ id: "SesionPortal" });

export const InformesDelCliente = z
  .object({
    cliente: z.string(),
    /** Por informe, la versión vigente con su PDF listo (regla 12, ADR-0013). */
    informes: z.array(
      z.object({
        id: Uuid,
        numero: z.int().positive(),
        publicadaEn: Fecha,
        sitio: z.string(),
        direccion: z.string(),
        motivo: z.string(),
        programadaPara: z.iso.date(),
      }),
    ),
  })
  .meta({ id: "InformesDelCliente" });

// Administración (iteración 6): solo personas administradoras con segundo factor activo.

export const UsuarioAdministrado = z
  .object({
    id: z.string(),
    usuario: z.string(),
    nombre: z.string(),
    rol: Rol,
    administrador: z.boolean(),
    segundoFactor: z.boolean(),
    desactivadoEn: Fecha.nullable(),
    creadoEn: Fecha,
  })
  .meta({ id: "UsuarioAdministrado" });

export const SaludDeDispositivo = z
  .object({
    id: Uuid,
    usuario: Persona,
    registradoEn: Fecha,
    ultimoContacto: Fecha,
    salud: SaludDispositivo.nullable(),
    ordenDeBorradoEn: Fecha.nullable(),
    borradoConfirmadoEn: Fecha.nullable(),
  })
  .meta({ id: "SaludDeDispositivo" });

/** Credenciales nuevas de un acceso de cliente: se muestran una sola vez. */
export const CredencialesDeAcceso = z.object({ identificador: z.string(), clave: z.string(), url: z.url() }).meta({ id: "CredencialesDeAcceso" });

// Programación (iteración 7): clientes, sitios y visitas, por oficina.

const Texto = (maximo: number) => z.string().trim().min(1).max(maximo);

export const ClienteConSitios = z
  .object({
    id: Uuid,
    nombre: z.string(),
    sitios: z.array(z.object({ id: Uuid, nombre: z.string(), direccion: z.string() })),
  })
  .meta({ id: "ClienteConSitios" });

export const VisitaProgramada = z
  .object({
    id: Uuid,
    /** Concurrencia optimista (QA-25): cada cambio lleva la versión que se tenía abierta. */
    version: z.int().positive(),
    cliente: z.object({ id: Uuid, nombre: z.string() }),
    sitio: z.object({ id: Uuid, nombre: z.string(), direccion: z.string() }),
    motivo: z.string(),
    programadaPara: z.iso.date(),
    tecnicos: z.array(Persona),
    /** Avance deducido de sus levantamientos (modelo de dominio, sección 5). */
    levantamientos: z.object({ enviados: z.int().min(0), enRevision: z.int().min(0), revisados: z.int().min(0) }),
    cancelada: z.object({ en: Fecha, por: Persona, motivo: z.string() }).nullable(),
  })
  .meta({ id: "VisitaProgramada" });

const erroresDeVisita = ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "estado_invalido", "entrada_invalida"] as const;

const NombreDeUsuario = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/);

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
        .array(z.object({ seccion: z.string().max(80), campo: z.string().max(64), /** null borra el dato. */ valor: Valor.nullable() }))
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
    cuerpo: z.object({ texto: z.string().trim().min(1).max(2000), seccion: z.string().max(80).optional(), campo: z.string().max(64).optional() }),
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
  listarInformes: {
    metodo: "GET",
    ruta: "/api/informes",
    resumen: "Informes de la organización, de la visita más reciente a la más antigua",
    estadoExito: 200,
    respuesta: PaginaInformes,
    errores: ["no_autenticado", "sin_permiso"],
  },
  abrirInformeDeVisita: {
    metodo: "POST",
    ruta: "/api/informes",
    resumen: "Informe de una visita; lo crea en borrador si no existe (uno por visita)",
    cuerpo: z.object({ visitaId: Uuid }),
    estadoExito: 200,
    respuesta: z.object({ id: Uuid }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  obtenerInforme: {
    metodo: "GET",
    ruta: "/api/informes/{id}",
    resumen: "Borrador del informe, levantamientos de la visita y versiones publicadas",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleInforme,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  guardarInforme: {
    metodo: "POST",
    ruta: "/api/informes/{id}/borrador",
    resumen: "Guarda el borrador: textos, levantamientos incluidos y planos, en orden",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({
      ...ConVersion,
      introduccion: z.string().max(20_000),
      conclusiones: z.string().max(20_000),
      levantamientos: z.array(Uuid).max(50),
      planos: z.array(Plano).max(20),
    }),
    estadoExito: 200,
    respuesta: z.object({ version: z.int().positive() }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "informe_invalido"],
  },
  publicarInforme: {
    metodo: "POST",
    ruta: "/api/informes/{id}/publicar",
    resumen: "Publica una versión inmutable y encola su PDF (QA-9, QA-17)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object(ConVersion),
    estadoExito: 201,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "informe_invalido", "archivos_faltantes", "archivos_en_verificacion"],
  },
  pdfDeVersion: {
    metodo: "GET",
    ruta: "/api/informes/{id}/versiones/{numero}/pdf",
    resumen: "URL firmada del PDF de una versión publicada",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  ingresarAlPortal: {
    metodo: "POST",
    ruta: "/api/portal/ingresar",
    resumen: "Ingreso del cliente con el identificador del QR y su clave; límite de intentos (QA-7)",
    cuerpo: z.object({ identificador: z.string().trim().toLowerCase().regex(IDENTIFICADOR_ACCESO), clave: z.string().max(64) }),
    estadoExito: 200,
    respuesta: SesionPortal,
    errores: ["no_autenticado", "demasiadas_solicitudes", "entrada_invalida"],
  },
  sesionDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/sesion",
    resumen: "Cliente de la sesión del portal",
    estadoExito: 200,
    respuesta: SesionPortal,
    errores: ["no_autenticado"],
  },
  salirDelPortal: {
    metodo: "POST",
    ruta: "/api/portal/salir",
    resumen: "Cierra la sesión del portal",
    estadoExito: 200,
    respuesta: z.object({}),
    errores: [],
  },
  informesDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/informes",
    resumen: "Informes vigentes del cliente de la sesión",
    estadoExito: 200,
    respuesta: InformesDelCliente,
    errores: ["no_autenticado"],
  },
  pdfDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/informes/{id}/pdf",
    resumen: "URL firmada del PDF vigente de un informe del cliente; la descarga queda registrada",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "no_encontrado"],
  },
  listarUsuarios: {
    metodo: "GET",
    ruta: "/api/administracion/usuarios",
    resumen: "Usuarios de la organización",
    estadoExito: 200,
    respuesta: z.object({ usuarios: z.array(UsuarioAdministrado) }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido"],
  },
  crearUsuarioAdministrado: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios",
    resumen: "Crea un técnico o una persona de oficina con contraseña temporal (se muestra una vez)",
    cuerpo: z.object({ usuario: NombreDeUsuario, nombre: z.string().trim().min(1).max(120), rol: Rol }),
    estadoExito: 201,
    respuesta: z.object({ usuario: UsuarioAdministrado, contrasena: z.string() }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "conflicto", "entrada_invalida"],
  },
  restablecerContrasenaAdministrada: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios/{id}/restablecer-contrasena",
    resumen: "Contraseña temporal nueva (se muestra una vez); cierra las sesiones del usuario",
    parametros: z.object({ id: z.string() }),
    estadoExito: 200,
    respuesta: z.object({ contrasena: z.string() }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "estado_invalido"],
  },
  desactivarUsuarioAdministrado: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios/{id}/desactivar",
    resumen: "Revoca: sin acceso y sus teléfonos borran sus datos al conectarse (regla 13)",
    parametros: z.object({ id: z.string() }),
    estadoExito: 200,
    respuesta: UsuarioAdministrado,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "estado_invalido"],
  },
  marcarAdministrador: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios/{id}/administrador",
    resumen: "Da o quita la marca de administrador a una persona de oficina",
    parametros: z.object({ id: z.string() }),
    cuerpo: z.object({ administrador: z.boolean() }),
    estadoExito: 200,
    respuesta: UsuarioAdministrado,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "estado_invalido"],
  },
  listarDispositivos: {
    metodo: "GET",
    ruta: "/api/administracion/dispositivos",
    resumen: "Salud de los teléfonos de campo (ADR-0017)",
    estadoExito: 200,
    respuesta: z.object({ dispositivos: z.array(SaludDeDispositivo) }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido"],
  },
  listarAccesosDeClientes: {
    metodo: "GET",
    ruta: "/api/administracion/accesos",
    resumen: "Clientes de la organización y su acceso al portal",
    estadoExito: 200,
    respuesta: z.object({
      clientes: z.array(z.object({ id: Uuid, nombre: z.string(), acceso: z.object({ creadoEn: Fecha, regeneradoEn: Fecha.nullable() }).nullable() })),
    }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido"],
  },
  crearAccesoDeCliente: {
    metodo: "POST",
    ruta: "/api/administracion/accesos/{clienteId}",
    resumen: "Crea o regenera el acceso de un cliente; regenerar invalida el QR, la clave y las sesiones anteriores",
    parametros: z.object({ clienteId: Uuid }),
    cuerpo: z.object({ regenerar: z.boolean().default(false) }),
    estadoExito: 200,
    respuesta: CredencialesDeAcceso,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "conflicto"],
  },
  retirarVersion: {
    metodo: "POST",
    ruta: "/api/informes/{id}/versiones/{numero}/retirar",
    resumen: "Retira una versión del portal; se conserva y queda registrado",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    cuerpo: z.object({ motivo: z.string().trim().min(1).max(500) }),
    estadoExito: 200,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "estado_invalido"],
  },
  listarClientes: {
    metodo: "GET",
    ruta: "/api/clientes",
    resumen: "Clientes de la organización con sus sitios",
    estadoExito: 200,
    respuesta: z.object({ clientes: z.array(ClienteConSitios) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  crearCliente: {
    metodo: "POST",
    ruta: "/api/clientes",
    resumen: "Crea un cliente con su primer sitio",
    cuerpo: z.object({ nombre: Texto(200), sitio: z.object({ nombre: Texto(200), direccion: Texto(300) }) }),
    estadoExito: 201,
    respuesta: ClienteConSitios,
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
  },
  agregarSitio: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/sitios",
    resumen: "Agrega un sitio a un cliente",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ nombre: Texto(200), direccion: Texto(300) }),
    estadoExito: 201,
    respuesta: ClienteConSitios,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  listarTecnicos: {
    metodo: "GET",
    ruta: "/api/tecnicos",
    resumen: "Técnicos activos de la organización, para asignar visitas",
    estadoExito: 200,
    respuesta: z.object({ tecnicos: z.array(z.object({ id: z.string(), nombre: z.string(), usuario: z.string() })) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  listarVisitas: {
    metodo: "GET",
    ruta: "/api/visitas",
    resumen: "Visitas de una vista: próximas (desde hoy), anteriores (las 100 más recientes) o canceladas",
    consulta: z.object({ vista: z.enum(["proximas", "anteriores", "canceladas"]), hoy: z.iso.date() }),
    estadoExito: 200,
    respuesta: z.object({ visitas: z.array(VisitaProgramada) }),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
  },
  programarVisita: {
    metodo: "POST",
    ruta: "/api/visitas",
    resumen: "Programa una visita; llega a los teléfonos de sus técnicos en la siguiente bajada",
    cuerpo: z.object({ clienteId: Uuid, sitioId: Uuid, motivo: Texto(120), programadaPara: z.iso.date(), tecnicos: z.array(z.string()).min(1).max(20) }),
    estadoExito: 201,
    respuesta: VisitaProgramada,
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
  },
  reasignarVisita: {
    metodo: "POST",
    ruta: "/api/visitas/{id}/tecnicos",
    resumen: "Reemplaza los técnicos; sale del teléfono de quien deja de tenerla (regla 17: lo empezado se conserva)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ version: z.int().positive(), tecnicos: z.array(z.string()).min(1).max(20) }),
    estadoExito: 200,
    respuesta: VisitaProgramada,
    errores: [...erroresDeVisita],
  },
  reprogramarVisita: {
    metodo: "POST",
    ruta: "/api/visitas/{id}/reprogramar",
    resumen: "Cambia la fecha y el motivo; los teléfonos lo reciben en la siguiente bajada",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ version: z.int().positive(), programadaPara: z.iso.date(), motivo: Texto(120) }),
    estadoExito: 200,
    respuesta: VisitaProgramada,
    errores: [...erroresDeVisita],
  },
  cancelarVisita: {
    metodo: "POST",
    ruta: "/api/visitas/{id}/cancelar",
    resumen: "Cancela la visita (único estado explícito); sale de los teléfonos y lo empezado se conserva",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ version: z.int().positive(), motivo: Texto(500) }),
    estadoExito: 200,
    respuesta: VisitaProgramada,
    errores: [...erroresDeVisita],
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
