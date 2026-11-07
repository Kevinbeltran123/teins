import { z } from "zod";
import { DECIMAL_CANONICO, DOCUMENTO_DE_IDENTIDAD, ID_LINEA, LIMITES_SELECCION, PORCENTAJE, TIPO_ARCHIVO_BOCETO } from "@teins/dominio";
import type * as dominio from "@teins/dominio";
import { DocumentoBoceto, Fecha, Huella, IdFormato, Repeticiones, Respuestas, Uuid, Valor, VersionFormato } from "./dominio";
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
      /** Entró con una contraseña temporal: debe cambiarla antes de cualquier otra cosa (ADR-0033). */
      debeCambiarContrasena: z.boolean().default(false),
    }),
    /** Hasta cuándo el dispositivo puede trabajar sin contacto (ADR-0009, parte 2). Cada bajada lo renueva. */
    permisoLocalHasta: Fecha,
    /**
     * Con qué nombre firma los documentos y a qué portal lleva el correo del informe (iteración 26): oficina los pone en la
     * vista en vivo. `portal` es nulo si el entorno no lo configura, y entonces el correo no lleva el botón.
     */
    organizacion: z.object({ nombre: z.string(), portal: z.url().nullable() }),
  })
  .meta({ id: "Sesion" });

// Archivos (ADR-0007)

/** Fotos (JPEG), planos (PDF) y bocetos (JSON propio, ADR-0019). */
export const TIPOS_DE_ARCHIVO = ["image/jpeg", "application/pdf", TIPO_ARCHIVO_BOCETO] as const;

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
      formato: IdFormato,
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

/** Largo máximo de un mensaje de una conversación, en los dos lados (ADR-0040). */
const TextoDeMensaje = z.string().trim().min(1).max(1000);

/** Quién escribió un mensaje de una conversación (ADR-0040): oficina la abre y el técnico responde. */
export const LadoDelMensaje = z.enum(["oficina", "tecnico"]);

/** Una respuesta dentro de la conversación de un comentario, como la ve el técnico (ADR-0040). */
export const MensajeParaTecnico = z
  .object({
    id: Uuid,
    texto: z.string(),
    de: LadoDelMensaje,
    autor: z.string(),
    creadoEn: Fecha,
    /** Solo en los del técnico: la llave con que lo mandó el teléfono, para sacarlo de su cola. */
    llave: Uuid.optional(),
    /** Solo en los del técnico: alguien de oficina ya lo leyó («Leído»). */
    leido: z.boolean().optional(),
  })
  .meta({ id: "MensajeParaTecnico" });

/** Nota de oficina al técnico, opcionalmente sobre un campo. No modifica datos. */
const ComentarioParaTecnico = z.object({
  id: Uuid,
  texto: z.string(),
  seccion: z.string().optional(),
  campo: z.string().optional(),
  autor: z.string(),
  creadoEn: Fecha,
  /** Su autor lo corrigió (ADR-0035): el teléfono muestra "Editado". Ausente en la versión anterior del contrato. */
  editadoEn: Fecha.optional(),
  /** La conversación (ADR-0040), en orden. Opcional: la app 13 no la conoce y la descarta al validar. */
  respuestas: z.array(MensajeParaTecnico).optional(),
});

// Bajada (ADR-0003): cambios del alcance del usuario desde un punto de control.

/** Una hora del día, "09:30" (ADR-0037). */
export const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora en formato HH:MM");

export const VisitaAsignada = z
  .object({
    id: Uuid,
    /** `nit` y `ciudad`, los del encabezado del informe (ADR-0051): opcionales para las apps anteriores y para lo que falta. */
    cliente: z.object({ nombre: z.string(), nit: z.string().nullable().optional() }),
    sitio: z.object({ nombre: z.string(), direccion: z.string(), ciudad: z.string().nullable().optional() }),
    motivo: z.string(),
    /** El servicio (ADR-0057): la clave del formato que se llena. Sin él, el teléfono ofrece todos; una app anterior lo ignora. */
    formato: z.string().nullable().optional(),
    programadaPara: z.iso.date(),
    /** Número de orden de servicio y referencia del cliente (ADR-0051); las visitas anteriores no tienen número. */
    ordenDeServicio: z.int().positive().nullable().optional(),
    referencia: z.string().nullable().optional(),
    /** Quien pidió la visita: el técnico pregunta por esta persona al llegar (ADR-0051). */
    solicitante: z.object({ nombre: z.string(), cargo: z.string().optional(), celular: z.string().nullable().optional() }).nullable().optional(),
    /**
     * Horario (ADR-0037), opcional para las apps anteriores (ADR-0015). Sin hora de inicio es todo el día; con inicio y
     * sin fin, el técnico queda ocupado hasta que la termine.
     */
    horaInicio: Hora.nullable().optional(),
    horaFin: Hora.nullable().optional(),
    /** Cuándo la terminó un técnico desde su teléfono (ADR-0037). */
    terminada: z.object({ en: Fecha }).nullable().optional(),
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
    /**
     * Ítem del catálogo (iteración 17, ADR-0025): solo a la app 8 o posterior. Sin precio (regla 7); uno
     * desactivado baja con `activo: false` y deja de sugerirse.
     */
    z.object({
      tipo: z.literal("item_catalogo"),
      item: z.object({ id: Uuid, codigo: z.string(), descripcion: z.string(), unidad: z.string(), activo: z.boolean() }),
    }),
    /**
     * Símbolo de la biblioteca de los bocetos (iteración 19, ADR-0027): solo a la app 10 o posterior. Uno retirado
     * baja con `activo: false` y deja de ofrecerse; los bocetos que ya lo usan lo llevan copiado.
     */
    z.object({
      tipo: z.literal("simbolo"),
      simbolo: z.object({
        id: Uuid,
        nombre: z.string(),
        categoria: z.string(),
        trazado: z.string(),
        relleno: z.string().optional(),
        texto: z.string().optional(),
        codigo: z.string().optional(),
        /** El orden de la biblioteca: así se muestran categorías y símbolos. */
        orden: z.int().min(0),
        activo: z.boolean(),
      }),
    }),
    /** Salió del alcance del usuario (la visita se reasignó o se canceló): el dispositivo la retira. */
    z.object({
      tipo: z.literal("fuera_de_alcance"),
      entidad: z.enum(["visita"]),
      id: Uuid,
      /** Iteración 7, expansión (ADR-0015): una app anterior no lo lee y la trata como reasignada. */
      // `atendida` (ADR-0041): solo a la app 15 o posterior; una anterior no lo conoce.
      motivo: z.enum(["reasignada", "cancelada", "atendida"]).optional(),
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
    /**
     * Época de la bajada (ADR-0038), opcional para las apps anteriores (ADR-0015). Cambia solo cuando se deja limpio
     * un entorno: el teléfono que ve otra quita lo que bajó del servidor y baja todo desde cero.
     */
    epoca: z.string().min(1).max(100).optional(),
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
  /** Nombre del formato que ve la persona ("Levantamiento UPS"), si la versión lo tiene (iteración 23). */
  nombreFormato: z.string().optional(),
  estado: EstadoLevantamiento,
  tecnico: Persona,
  /** Quién tiene la revisión (I-1): visible para todos. */
  revisor: Persona.nullable(),
  recibidoEn: Fecha,
  fotos: z.int(),
  /** De qué cliente y sitio es (iteración 14): lo primero que oficina busca en la bandeja. Nulo antes de las visitas. */
  visita: z.object({ id: Uuid, cliente: z.string(), sitio: z.string() }).nullable(),
  /** Concurrencia optimista (ADR-0005): cada guardado lleva la versión que la persona tenía abierta. */
  version: z.int().positive(),
  /**
   * La última respuesta del técnico (ADR-0040) y si quien la debe leer (quien revisa o, si nadie lo ha tomado, quien
   * escribió el comentario) no la ha leído. Nulo si el técnico no ha respondido.
   */
  conversacion: z.object({ sinLeer: z.boolean(), ultima: z.object({ autor: z.string(), en: Fecha }) }).nullable().default(null),
});

export const Comentario = z
  .object({
    id: Uuid,
    texto: z.string(),
    seccion: z.string().optional(),
    campo: z.string().optional(),
    autor: Persona,
    creadoEn: Fecha,
    /** Su autor lo corrigió (ADR-0035). */
    editadoEn: Fecha.nullable().default(null),
    /** Retirado (anulado) por su autor: el técnico deja de verlo; se restaura con "Deshacer". */
    retirado: z.object({ en: Fecha, por: Persona }).nullable().default(null),
    /** El comentario que abre la conversación de la que esta es una respuesta (ADR-0040); nulo si la abre. */
    enRespuestaA: Uuid.nullable().default(null),
    de: LadoDelMensaje.default("oficina"),
  })
  .meta({ id: "Comentario" });

export const PaginaLevantamientos = z
  .object({ elementos: z.array(ResumenLevantamiento), siguienteCursor: z.string().nullable(), total: z.int().min(0) })
  .meta({ id: "PaginaLevantamientos" });

/** Vínculo de una línea de cantidad a un ítem del catálogo, que pone oficina (regla 6). */
export const VinculoDeLinea = z
  .object({
    seccion: z.string(),
    campo: z.string(),
    linea: z.string(),
    item: z.object({ id: Uuid, codigo: z.string(), descripcion: z.string(), unidad: z.string() }),
    /** Lo eligió el técnico en campo y nadie lo ha cambiado (iteración 17, ADR-0025). */
    elegidoEnCampo: z.boolean().default(false),
  })
  .meta({ id: "VinculoDeLinea" });

/**
 * La visita de un informe. Los datos del encabezado (ADR-0051) son opcionales: solo el detalle los llena, y lo que falta
 * sale como marcador en el informe. El número de orden va ya escrito, como queda en la versión.
 */
const VisitaDelInforme = z.object({
  cliente: z.string(),
  sitio: z.string(),
  direccion: z.string(),
  motivo: z.string(),
  programadaPara: z.iso.date(),
  nit: z.string().optional(),
  ciudad: z.string().optional(),
  solicitante: z.object({ nombre: z.string(), telefono: z.string().optional() }).optional(),
  ordenDeServicio: z.string().optional(),
  referencia: z.string().optional(),
});

export const DetalleLevantamiento = ResumenLevantamiento.extend({
  respuestas: Respuestas,
  repeticiones: Repeticiones.default({}),
  /** Vínculos de las líneas de cantidad al catálogo (iteración 11). */
  vinculos: z.array(VinculoDeLinea).default([]),
  formatoDefinicion: VersionFormato,
  creadoEnDispositivo: Fecha,
  enviadoEnDispositivo: Fecha,
  /** Con el encabezado del informe (ADR-0051): la revisión muestra el capítulo como saldrá. */
  visita: VisitaDelInforme.extend({ id: Uuid }).nullable(),
  comentarios: z.array(Comentario),
  /** Hasta cuándo leyó quien consulta las conversaciones (ADR-0040): lo posterior va bajo la línea «Nuevo». */
  leidoHasta: Fecha.nullable().default(null),
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

/**
 * Un plano de oficina antes de publicar (iteración 26): `verificando` mientras el worker lo revisa; `listo` con las páginas
 * que anexa (nulas si se verificó antes de contarlas); `ilegible` si el PDF del informe no podría anexarlo; `rechazado`
 * si no pasó la verificación.
 */
export const EstadoDePlano = z
  .object({ estado: z.enum(["verificando", "listo", "ilegible", "rechazado"]), paginas: z.int().positive().nullable() })
  .meta({ id: "EstadoDePlano" });

// Informes (corte 4)

const Plano = z.object({ huella: Huella, nombre: z.string().trim().min(1).max(200) });

/** "Publicada" y "visible para el cliente" son distintos: sin PDF listo, el cliente no la ve (ADR-0013). */
const EstadoPdf = z.enum(["generando", "listo", "fallido"]);

/** Canales por los que el informe le llega al cliente (ADR-0028). */
/**
 * Una decisión de enviar (regla 4): el mismo pedido repetido con su llave (doble clic, respuesta perdida) sale una
 * sola vez. Opcional para la versión anterior del protocolo (N-1, ADR-0015).
 */
const LlaveDeEnvioAlCliente = Uuid.optional();

export const CanalDeEnvio = z.enum(["correo", "whatsapp"]);
/**
 * Estado de un envío (ADR-0028, parte 4): solo avanza, salvo un rebote después de entregado. "cancelado": oficina lo
 * detuvo mientras esperaba en cola y nunca sale; mientras no salga nada, se puede reanudar (ADR-0034). Al retirar la
 * versión, lo que esperaba queda cancelado con el motivo "Versión retirada" y ya no se reanuda (ADR-0047).
 */
export const EstadoDeEnvio = z.enum(["en_cola", "enviado", "entregado", "fallido", "cancelado"]);

/** Una copia del informe enviada a un contacto por un canal. Nombre y destino copiados: el contacto puede cambiar o quitarse. */
export const EnvioDeVersion = z
  .object({
    id: Uuid,
    contacto: z.object({ id: Uuid, nombre: z.string() }),
    canal: CanalDeEnvio,
    destino: z.string(),
    estado: EstadoDeEnvio,
    /** Por qué no llegó, o por qué se canceló sin que nadie lo pidiera uno a uno ("Versión retirada"), en palabras para oficina. */
    error: z.string().nullable(),
    creadoEn: Fecha,
    enviadoEn: Fecha.nullable(),
    /** Quién lo canceló y cuándo (ADR-0034); null si no está cancelado. */
    cancelado: z.object({ en: Fecha, por: Persona }).nullable().default(null),
    /** Salió con el asunto y el texto que escribió oficina, no con los de TEINS (ADR-0036). */
    personalizado: z.boolean().default(false),
  })
  .meta({ id: "EnvioDeVersion" });


export const VersionPublicada = z
  .object({
    numero: z.int().positive(),
    publicadaEn: Fecha,
    publicadaPor: Persona,
    pdf: EstadoPdf,
    /** Retirada del portal por una persona administradora (el cliente ya no la ve); se conserva. */
    retirada: z.object({ en: Fecha, por: Persona, motivo: z.string() }).nullable().default(null),
    /** Copias enviadas al cliente, de la más reciente a la más antigua (ADR-0028). */
    envios: z.array(EnvioDeVersion).default([]),
  })
  .meta({ id: "VersionPublicada" });

export const PaginaInformes = z
  .object({
    elementos: z.array(
      z.object({
        id: Uuid,
        visita: VisitaDelInforme,
        /** Número de la versión vigente; null mientras no se publica ninguna. */
        vigente: z.int().positive().nullable(),
        /** Se publicó y se retiraron todas sus versiones: el cliente no ve nada. */
        todasRetiradas: z.boolean().default(false),
        pdf: EstadoPdf.nullable(),
        /** La versión vigente tiene una copia que no llegó y no se ha vuelto a enviar (ADR-0028). */
        envioSinEntregar: z.boolean().default(false),
      }),
    ),
  })
  .meta({ id: "PaginaInformes" });

/** Qué sale de cada levantamiento en el informe (ADR-0039): lo que oficina ocultó y lo que volvió a mostrar. */
const ClaveOcultable = z.string().min(1).max(LIMITES_SELECCION.largoClave);
export const SeleccionInforme = z
  .object({ ocultos: z.array(ClaveOcultable).max(LIMITES_SELECCION.claves), mostrados: z.array(ClaveOcultable).max(LIMITES_SELECCION.claves) })
  .meta({ id: "SeleccionInforme" });

export const DetalleInforme = z
  .object({
    id: Uuid,
    visitaId: Uuid,
    /** Para elegir a quién se envía (sus contactos, ADR-0028). */
    clienteId: Uuid,
    visita: VisitaDelInforme,
    version: z.int().positive(),
    introduccion: z.string(),
    conclusiones: z.string(),
    levantamientos: z.array(Uuid),
    planos: z.array(Plano),
    seleccion: SeleccionInforme,
    /** Levantamientos de la visita, incluidos o no, para componer (solo los revisados se pueden incluir). */
    candidatos: z.array(
      z.object({
        id: Uuid,
        formato: z.string(),
        tecnico: z.string(),
        estado: EstadoLevantamiento,
        recibidoEn: Fecha,
        /**
         * Lo que firma el informe (ADR-0051): si quien capturó y quien revisó tienen cédula, y cuándo revisó. El número
         * no: solo lo ve quien administra; el servidor lo copia a la versión al publicar.
         */
        tecnicoConCedula: z.boolean(),
        revisorConCedula: z.boolean(),
        revisadoEn: Fecha.optional(),
      }),
    ),
    versiones: z.array(VersionPublicada),
  })
  .meta({ id: "DetalleInforme" });

// Portal del cliente, por contacto (ADR-0053; antes, ADR-0009 parte 4)

/** El código que llega al correo: 6 dígitos (ADR-0053). */
export const CODIGO_DEL_PORTAL = /^\d{6}$/;

/** El correo como lo escriba la persona: se recorta y va en minúsculas, como se guarda el del acceso. */
const CorreoDelPortal = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email().max(320));

/** Quién entró y qué ve: lo que recibe como contacto (ADR-0053). */
export const SesionPortal = z
  .object({ cliente: z.string(), contacto: z.string(), ve: z.object({ informes: z.boolean(), cotizaciones: z.boolean() }) })
  .meta({ id: "SesionPortal" });

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

/**
 * Por cotización, la versión vigente con su PDF listo (ADR-0053): solo ver y descargar. La lista no lleva precios: el
 * total está en el PDF, que es lo que el cliente guarda.
 */
export const CotizacionesDelCliente = z
  .object({
    cotizaciones: z.array(
      z.object({
        id: Uuid,
        numero: z.string(),
        version: z.int().positive(),
        publicadaEn: Fecha,
        sitio: z.string(),
        programadaPara: z.iso.date(),
      }),
    ),
  })
  .meta({ id: "CotizacionesDelCliente" });

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
    /** Todavía tiene la contraseña temporal que se le entregó (ADR-0033). */
    debeCambiarContrasena: z.boolean(),
    /** Cédula, para firmar los informes (ADR-0051): solo la ve quien administra. */
    documento: z.string().nullable().default(null),
    creadoEn: Fecha,
  })
  .meta({ id: "UsuarioAdministrado" });

/** La cédula como la acepta el formato de firma: de 5 a 12 dígitos. */
const Documento = z.string().regex(DOCUMENTO_DE_IDENTIDAD, "La cédula son de 5 a 12 dígitos, sin puntos");

/** Contraseñas como las acepta el ingreso: de 10 a 128 caracteres (ADR-0009). */
const ContrasenaNueva = z.string().min(10).max(128);
const ContrasenaEscrita = z.string().min(1).max(128);

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


// Programación (iteración 7): clientes, sitios y visitas, por oficina.

const Texto = (maximo: number) => z.string().trim().min(1).max(maximo);

/**
 * El asunto y el texto del correo que escribió oficina (ADR-0036). El saludo, el adjunto, el botón del portal y el pie
 * los pone la plantilla; WhatsApp no lo usa (Meta solo acepta la plantilla aprobada). Sin esto, sale el texto de TEINS.
 */
export const TextoDeCorreoPropio = z.object({ asunto: Texto(200), texto: Texto(5000) }).meta({ id: "TextoDeCorreoPropio" });

/** Quién y cuándo (archivar, editar): ADR-0035. */
const Marca = z.object({ en: Fecha, por: Persona });

export const ClienteConSitios = z
  .object({
    id: Uuid,
    nombre: z.string(),
    /** NIT, para el encabezado del informe (ADR-0051). */
    nit: z.string().nullable().default(null),
    /** Sus sitios activos: a los archivados ya no se les programa (ADR-0035). */
    sitios: z.array(z.object({ id: Uuid, nombre: z.string(), direccion: z.string(), ciudad: z.string().nullable().default(null) })),
    /** Contactos que reciben el informe por algún canal: con cero, el informe solo queda en el portal. */
    reciben: z.int().nonnegative(),
    /** Archivado (ADR-0035): sale de las listas y de programar, y no recibe envíos; se recupera. */
    archivado: Marca.nullable().default(null),
  })
  .meta({ id: "ClienteConSitios" });

/** Celular en formato internacional (E.164), como lo exige WhatsApp: +573105550142. */
export const CELULAR = /^\+[1-9]\d{7,14}$/;

/** Contacto del cliente (ADR-0028, parte 5). */
export const Contacto = z
  .object({
    id: Uuid,
    nombre: z.string(),
    cargo: z.string(),
    correo: z.string().nullable(),
    celular: z.string().nullable(),
    recibeCorreo: z.boolean(),
    recibeWhatsapp: z.boolean(),
    /** Qué documentos recibe por esos canales (ADR-0029): se marcan por omisión al publicar. */
    recibeInformes: z.boolean(),
    recibeCotizaciones: z.boolean(),
    /** Quién de oficina confirmó que el contacto autorizó WhatsApp, y cuándo. Cambiar el celular la borra. */
    whatsappAutorizado: z.object({ por: Persona, en: Fecha }).nullable(),
    /** El último correo rebotó: sigue marcado hasta que oficina cambie la dirección. */
    correoRebotado: z.object({ en: Fecha, motivo: z.string() }).nullable(),
    /** Acceso al portal (ADR-0053): ve en el portal lo que recibe. */
    accesoPortal: z.object({ activo: z.boolean(), ultimoIngreso: Fecha.nullable() }),
  })
  .meta({ id: "Contacto" });

export const DetalleCliente = z
  .object({
    id: Uuid,
    nombre: z.string(),
    nit: z.string().nullable().default(null),
    /** Todos sus sitios, los archivados con su marca: se recuperan desde aquí. */
    sitios: z.array(z.object({ id: Uuid, nombre: z.string(), direccion: z.string(), ciudad: z.string().nullable().default(null), archivado: Marca.nullable().default(null) })),
    contactos: z.array(Contacto),
    /** La última corrección del nombre (ADR-0035); el registro completo queda en la auditoría. */
    editado: Marca.nullable().default(null),
    archivado: Marca.nullable().default(null),
    /** Visitas sin cancelar desde hoy: mientras haya, el cliente (o ese sitio) no se archiva. */
    visitasPorHacer: z.array(z.object({ id: Uuid, programadaPara: z.iso.date(), sitioId: Uuid, sitio: z.string(), tecnicos: z.array(z.string()) })).default([]),
  })
  .meta({ id: "DetalleCliente" });

/** Recorta el texto pegado; vacío es nulo. */
const vacioANulo = (v: unknown) => (typeof v === "string" ? v.trim() || null : v);

/** Datos de un contacto. Recibir por un canal exige su dato; por WhatsApp, además, la autorización. */
export const DatosContacto = z
  .object({
    nombre: Texto(200),
    cargo: z.string().trim().max(200).default(""),
    correo: z.preprocess(vacioANulo, z.email().max(320).nullable()).default(null),
    celular: z.preprocess(vacioANulo, z.string().regex(CELULAR, "Celular con indicativo, por ejemplo +573105550142").nullable()).default(null),
    recibeCorreo: z.boolean(),
    recibeWhatsapp: z.boolean(),
    recibeInformes: z.boolean().default(true),
    recibeCotizaciones: z.boolean().default(false),
    whatsappAutorizado: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.recibeCorreo && !d.correo) ctx.addIssue({ code: "custom", path: ["correo"], message: "Para recibir el informe por correo hace falta el correo" });
    if (d.recibeWhatsapp && !d.celular) ctx.addIssue({ code: "custom", path: ["celular"], message: "Para recibir el informe por WhatsApp hace falta el celular" });
    if (d.recibeWhatsapp && !d.whatsappAutorizado) ctx.addIssue({ code: "custom", path: ["whatsappAutorizado"], message: "WhatsApp exige que el contacto lo autorice" });
  });

export const VisitaProgramada = z
  .object({
    id: Uuid,
    /** Concurrencia optimista (QA-25): cada cambio lleva la versión que se tenía abierta. */
    version: z.int().positive(),
    cliente: z.object({ id: Uuid, nombre: z.string() }),
    sitio: z.object({ id: Uuid, nombre: z.string(), direccion: z.string() }),
    /** El nombre del servicio (ADR-0057); en las visitas anteriores, el motivo que se escribió. */
    motivo: z.string(),
    /** La clave del formato de la visita (ADR-0057); null en las anteriores. */
    formato: z.string().nullable().default(null),
    programadaPara: z.iso.date(),
    /** Número de orden de servicio (ADR-0051): se asigna al programar y no cambia; las anteriores no tienen. */
    ordenDeServicio: z.int().positive().nullable().default(null),
    /** La referencia del cliente (el «Ticket No.») y quien pidió la visita, un contacto del mismo cliente. */
    referencia: z.string().nullable().default(null),
    solicitante: z.object({ id: Uuid, nombre: z.string(), cargo: z.string(), celular: z.string().nullable() }).nullable().default(null),
    /** Horario (ADR-0037): sin inicio, todo el día; con inicio y sin fin, hasta que la terminen. */
    horaInicio: Hora.nullable().default(null),
    horaFin: Hora.nullable().default(null),
    /** Quién la terminó desde su teléfono y cuándo (ADR-0037). */
    terminada: z.object({ en: Fecha, por: Persona }).nullable().default(null),
    tecnicos: z.array(Persona),
    /** Avance deducido de sus levantamientos (modelo de dominio, sección 5). */
    levantamientos: z.object({ enviados: z.int().min(0), enRevision: z.int().min(0), revisados: z.int().min(0) }),
    cancelada: z.object({ en: Fecha, por: Persona, motivo: z.string() }).nullable(),
  })
  .meta({ id: "VisitaProgramada" });

// Cantidades con catálogo (iteración 11).

/** Pesos colombianos enteros, sin IVA (ADR-0029). */
const Pesos = z.int().min(0).max(1_000_000_000);

export const ItemCatalogo = z
  .object({
    id: Uuid,
    codigo: z.string(),
    descripcion: z.string(),
    unidad: z.string(),
    activo: z.boolean(),
    actualizadoEn: Fecha,
    /** Precio vigente sin IVA; nunca baja al teléfono (regla 7, ADR-0029). */
    precio: z.object({ valor: Pesos, desde: Fecha }).nullable(),
  })
  .meta({ id: "ItemCatalogo" });

const DatosItemCatalogo = { codigo: Texto(40), descripcion: Texto(200), unidad: Texto(20) };

export const PrecioDeItem = z
  .object({ valor: Pesos, desde: Fecha, por: Persona.nullable(), origen: z.enum(["manual", "importado"]) })
  .meta({ id: "PrecioDeItem" });

// Cotizaciones (iteración 21, ADR-0029)

const Porcentaje = z.string().regex(PORCENTAJE).refine((p) => Number(p) <= 100, "Entre 0 y 100");
export const Impuestos = z
  .discriminatedUnion("tipo", [z.object({ tipo: z.literal("iva") }), z.object({ tipo: z.literal("aiu"), administracion: Porcentaje, imprevistos: Porcentaje, utilidad: Porcentaje })])
  .meta({ id: "Impuestos" });

export const LineaDeCotizacion = z
  .object({
    id: z.string().regex(ID_LINEA),
    itemId: Uuid.nullable(),
    codigo: z.string().max(40).nullable(),
    descripcion: z.string().trim().min(1).max(200),
    cantidad: z.string().regex(DECIMAL_CANONICO).refine((c) => !/^0(\.0+)?$/.test(c), "Mayor que cero"),
    unidad: z.string().trim().min(1).max(20),
    precio: Pesos.nullable(),
    precioCatalogo: Pesos.nullable(),
    origen: z.enum(["cantidades", "oficina"]),
  })
  .meta({ id: "LineaDeCotizacion" });

export const CondicionesCotizacion = z
  .object({ validezDias: z.int().min(1).max(365), formaPago: z.string().trim().max(300), notas: z.string().trim().max(2000) })
  .meta({ id: "CondicionesCotizacion" });

export const VersionCotizacion = z
  .object({
    numero: z.int().positive(),
    publicadaEn: Fecha,
    publicadaPor: Persona,
    pdf: EstadoPdf,
    total: z.int().min(0),
    envios: z.array(EnvioDeVersion),
    /** Retirada por una persona administradora (ADR-0034): deja de ser la vigente y no se envía más; se conserva. */
    retirada: z.object({ en: Fecha, por: Persona, motivo: z.string() }).nullable().default(null),
  })
  .meta({ id: "VersionCotizacion" });

const VisitaDeCotizacion = z.object({ cliente: z.string(), sitio: z.string(), direccion: z.string(), programadaPara: z.iso.date() });

export const DetalleCotizacion = z
  .object({
    id: Uuid,
    numero: z.string(),
    visitaId: Uuid,
    clienteId: Uuid,
    visita: VisitaDeCotizacion,
    version: z.int().positive(),
    lineas: z.array(LineaDeCotizacion),
    impuestos: Impuestos,
    condiciones: CondicionesCotizacion,
    versiones: z.array(VersionCotizacion),
  })
  .meta({ id: "DetalleCotizacion" });

export const ResumenCotizacion = z
  .object({
    id: Uuid,
    numero: z.string(),
    visita: VisitaDeCotizacion,
    /** Número de la versión vigente (la más reciente sin retirar); null mientras es borrador o si todas se retiraron. */
    vigente: z.int().positive().nullable(),
    total: z.int().min(0).nullable(),
    envioSinEntregar: z.boolean(),
    /** Tuvo versiones publicadas y todas se retiraron (ADR-0034): no es un borrador. */
    todasRetiradas: z.boolean().default(false),
  })
  .meta({ id: "ResumenCotizacion" });

export const VisitaParaCotizar = z
  .object({
    visitaId: Uuid,
    cliente: z.string(),
    sitio: z.string(),
    programadaPara: z.iso.date(),
    levantamientosRevisados: z.int().min(0),
    /** Filas que tendrá la cotización (sumadas por ítem y unidad). */
    materiales: z.int().min(0),
    sinPrecio: z.int().min(0),
    cotizaciones: z.array(z.string()),
  })
  .meta({ id: "VisitaParaCotizar" });

export const LineaDeVisita = z
  .object({
    levantamientoId: Uuid,
    tecnico: z.string(),
    estado: z.enum(["enviado", "en_revision", "revisado"]),
    /** "Tableros · Tablero 2 · Materiales". */
    ubicacion: z.string(),
    descripcion: z.string(),
    cantidad: z.string(),
    unidad: z.string(),
    observacion: z.string().nullable(),
    item: z.object({ codigo: z.string(), descripcion: z.string() }).nullable(),
  })
  .meta({ id: "LineaDeVisita" });

const erroresDeVisita = ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "estado_invalido", "entrada_invalida", "tecnico_ocupado"] as const;

/** El horario de una visita (ADR-0037): el fin exige el inicio y va después de él. */
const Horario = {
  horaInicio: Hora.nullable().default(null),
  horaFin: Hora.nullable().default(null),
};
/**
 * Quien pidió la visita y la referencia del cliente (ADR-0051). Al programar, omitir es no tener; al reprogramar, omitir
 * conserva lo que había y `null` lo quita.
 */
const DatosDePedido = {
  solicitanteId: Uuid.nullable().optional(),
  referencia: Texto(60).nullable().optional(),
};
const horarioValido = (d: { horaInicio: string | null; horaFin: string | null }, ctx: z.RefinementCtx) => {
  if (d.horaFin !== null && d.horaInicio === null) ctx.addIssue({ code: "custom", path: ["horaFin"], message: "La hora de fin necesita la de inicio" });
  if (d.horaFin !== null && d.horaInicio !== null && d.horaFin <= d.horaInicio) ctx.addIssue({ code: "custom", path: ["horaFin"], message: "La hora de fin va después de la de inicio" });
};

/** Lo que ocupa a un técnico un día (ADR-0037): con qué visita y de qué hora a qué hora. */
export const OcupacionDeTecnico = z
  .object({
    tecnicoId: z.string(),
    visitaId: Uuid,
    cliente: z.string(),
    sitio: z.string(),
    motivo: z.string(),
    horaInicio: Hora.nullable(),
    horaFin: Hora.nullable(),
    /** Sin fin y ya terminada: deja de ocupar desde que la terminaron. */
    terminadaEn: Fecha.nullable(),
  })
  .meta({ id: "OcupacionDeTecnico" });

const NombreDeUsuario = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/);

// Avisos push (ADR-0023)

const ClaveBase64Url = (maximo: number) => z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(maximo);

/** Lo que `PushSubscription.toJSON()` entrega; el servidor decide a quién pertenece y desde qué superficie. */
export const SuscripcionAvisos = z
  .object({
    endpoint: z.url({ protocol: /^https$/ }).max(2048),
    claves: z.object({ p256dh: ClaveBase64Url(200), auth: ClaveBase64Url(64) }),
  })
  .meta({ id: "SuscripcionAvisos" });

export const ConfiguracionAvisos = z.object({ clavePublica: z.string().nullable() }).meta({ id: "ConfiguracionAvisos" });

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
    errores: ["no_autenticado", "sin_permiso", "archivo_demasiado_grande", "tipo_de_archivo_no_permitido", "conflicto", "estado_invalido", "version_protocolo_no_soportada"],
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
      /** Cliente, sitio, técnico o formato (iteración 23). Sin él, la bandeja completa del estado. */
      buscar: z.string().trim().max(100).optional(),
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
    // `enRespuestaA`: oficina responde en una conversación (ADR-0040); se cierra al marcar revisado.
    cuerpo: z.object({ texto: TextoDeMensaje, seccion: z.string().max(80).optional(), campo: z.string().max(64).optional(), enRespuestaA: Uuid.optional() }),
    estadoExito: 201,
    respuesta: Comentario,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  responderComentario: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/comentarios/{comentarioId}/respuestas",
    resumen: "El técnico responde la conversación de un comentario de oficina; idempotente por su llave (ADR-0040)",
    parametros: z.object({ id: Uuid, comentarioId: Uuid }),
    cuerpo: z.object({ llave: Uuid, texto: TextoDeMensaje }),
    estadoExito: 201,
    respuesta: MensajeParaTecnico,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  marcarConversacionLeida: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/lectura",
    resumen: "Quien consulta leyó las conversaciones del levantamiento hasta ahora (ADR-0040)",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: z.object({ leidoHasta: Fecha }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  editarComentario: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/comentarios/{comentarioId}",
    resumen: "Su autor corrige un comentario mientras el levantamiento no esté revisado (ADR-0035)",
    parametros: z.object({ id: Uuid, comentarioId: Uuid }),
    cuerpo: z.object({ texto: TextoDeMensaje }),
    estadoExito: 200,
    respuesta: Comentario,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  retirarComentario: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/comentarios/{comentarioId}/retirar",
    resumen: "Su autor retira (anula) un comentario: el técnico deja de verlo (ADR-0035)",
    parametros: z.object({ id: Uuid, comentarioId: Uuid }),
    estadoExito: 200,
    respuesta: Comentario,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  restaurarComentario: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/comentarios/{comentarioId}/restaurar",
    resumen: "Deshace el retiro de un comentario (ADR-0035)",
    parametros: z.object({ id: Uuid, comentarioId: Uuid }),
    estadoExito: 200,
    respuesta: Comentario,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
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
    resumen: "Informe de una visita; lo crea en borrador si no existe (uno por visita) y la visita no está cancelada",
    cuerpo: z.object({ visitaId: Uuid }),
    estadoExito: 200,
    respuesta: z.object({ id: Uuid }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
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
      /** Opcional para una pestaña anterior al despliegue: sin ella, la selección guardada no cambia. */
      seleccion: SeleccionInforme.optional(),
    }),
    estadoExito: 200,
    respuesta: z.object({ version: z.int().positive() }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "informe_invalido"],
  },
  publicarInforme: {
    metodo: "POST",
    ruta: "/api/informes/{id}/publicar",
    resumen: "Publica una versión inmutable y encola su PDF (QA-9, QA-17); los destinatarios reciben el PDF cuando esté listo (ADR-0028)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ ...ConVersion, destinatarios: z.array(Uuid).max(50).default([]), mensaje: TextoDeCorreoPropio.optional() }),
    estadoExito: 201,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "informe_invalido", "archivos_faltantes", "archivos_en_verificacion"],
  },
  enviarVersion: {
    metodo: "POST",
    ruta: "/api/informes/{id}/versiones/{numero}/enviar",
    resumen: "Envía una versión publicada a contactos del cliente: volver a enviar o enviar a otro contacto (ADR-0028)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    cuerpo: z.object({ destinos: z.array(z.object({ contactoId: Uuid, canal: CanalDeEnvio.optional() })).min(1).max(50), llave: LlaveDeEnvioAlCliente, mensaje: TextoDeCorreoPropio.optional() }),
    estadoExito: 200,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  cancelarEnvio: {
    metodo: "POST",
    ruta: "/api/informes/{id}/versiones/{numero}/envios/{envio}/cancelar",
    resumen: "Cancela un envío que todavía espera en cola: nunca sale (ADR-0034)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive(), envio: Uuid }),
    estadoExito: 200,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  reanudarEnvio: {
    metodo: "POST",
    ruta: "/api/informes/{id}/versiones/{numero}/envios/{envio}/reanudar",
    resumen: "Deshace la cancelación de un envío: vuelve a la cola (ADR-0034)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive(), envio: Uuid }),
    estadoExito: 200,
    respuesta: VersionPublicada,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
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
  pedirCodigoDelPortal: {
    metodo: "POST",
    ruta: "/api/portal/codigo",
    resumen: "Envía un código de 6 dígitos al correo, si tiene acceso; responde lo mismo si no lo tiene (ADR-0053, QA-7)",
    cuerpo: z.object({ correo: CorreoDelPortal }),
    estadoExito: 202,
    respuesta: z.object({}),
    errores: ["demasiadas_solicitudes", "entrada_invalida"],
  },
  ingresarConCodigo: {
    metodo: "POST",
    ruta: "/api/portal/ingresar",
    resumen: "Ingreso con el código del correo, desde el navegador que lo pidió; un solo uso y límite de intentos (ADR-0053, QA-7)",
    cuerpo: z.object({ correo: CorreoDelPortal, codigo: z.string().regex(CODIGO_DEL_PORTAL) }),
    estadoExito: 200,
    respuesta: SesionPortal,
    errores: ["no_autenticado", "demasiadas_solicitudes", "entrada_invalida"],
  },
  sesionDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/sesion",
    resumen: "Quién entró al portal y qué ve",
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
    resumen: "Informes vigentes del cliente de la sesión, si el contacto recibe informes",
    estadoExito: 200,
    respuesta: InformesDelCliente,
    errores: ["no_autenticado", "sin_permiso"],
  },
  pdfDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/informes/{id}/pdf",
    resumen: "URL firmada del PDF vigente de un informe del cliente; la descarga queda registrada",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  cotizacionesDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/cotizaciones",
    resumen: "Cotizaciones vigentes del cliente de la sesión (ADR-0053)",
    estadoExito: 200,
    respuesta: CotizacionesDelCliente,
    errores: ["no_autenticado", "sin_permiso"],
  },
  pdfDeCotizacionDelPortal: {
    metodo: "GET",
    ruta: "/api/portal/cotizaciones/{id}/pdf",
    resumen: "URL firmada del PDF vigente de una cotización del cliente; la descarga queda registrada (ADR-0053)",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
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
    cuerpo: z.object({ usuario: NombreDeUsuario, nombre: z.string().trim().min(1).max(120), rol: Rol, documento: Documento.optional() }),
    estadoExito: 201,
    respuesta: z.object({ usuario: UsuarioAdministrado, contrasena: z.string() }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "conflicto", "entrada_invalida"],
  },
  fijarDocumentoDeUsuario: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios/{id}/documento",
    resumen: "Pone, cambia o quita la cédula de una persona; el registro dice que cambió, nunca el valor (ADR-0051)",
    parametros: z.object({ id: z.string() }),
    cuerpo: z.object({ documento: Documento.nullable() }),
    estadoExito: 200,
    respuesta: UsuarioAdministrado,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "entrada_invalida"],
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
  reactivarUsuarioAdministrado: {
    metodo: "POST",
    ruta: "/api/administracion/usuarios/{id}/reactivar",
    resumen: "Vuelve a dar acceso a un usuario desactivado con contraseña temporal (se muestra una vez); no deshace órdenes de borrado (ADR-0033)",
    parametros: z.object({ id: z.string() }),
    estadoExito: 200,
    respuesta: z.object({ usuario: UsuarioAdministrado, contrasena: z.string() }),
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
  listarCatalogo: {
    metodo: "GET",
    ruta: "/api/catalogo",
    resumen: "Ítems del catálogo de la organización, activos e inactivos",
    estadoExito: 200,
    respuesta: z.object({ items: z.array(ItemCatalogo) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  crearItemCatalogo: {
    metodo: "POST",
    ruta: "/api/catalogo",
    resumen: "Crea un ítem del catálogo",
    cuerpo: z.object(DatosItemCatalogo),
    estadoExito: 201,
    respuesta: ItemCatalogo,
    errores: ["no_autenticado", "sin_permiso", "conflicto", "entrada_invalida"],
  },
  actualizarItemCatalogo: {
    metodo: "POST",
    ruta: "/api/catalogo/{id}",
    resumen: "Cambia la descripción o la unidad de un ítem, o lo desactiva (nunca se borra: hay líneas vinculadas)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ descripcion: Texto(200), unidad: Texto(20), activo: z.boolean() }),
    estadoExito: 200,
    respuesta: ItemCatalogo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  importarCatalogo: {
    metodo: "POST",
    ruta: "/api/catalogo/importar",
    resumen: "Crea o actualiza ítems por código, en bloque (por ejemplo, desde un CSV)",
    /** Con precio, exige administración con segundo factor (ADR-0029). */
    cuerpo: z.object({ items: z.array(z.object({ ...DatosItemCatalogo, precio: Pesos.optional() })).min(1).max(5000) }),
    estadoExito: 200,
    respuesta: z.object({ creados: z.int().min(0), actualizados: z.int().min(0) }),
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "entrada_invalida"],
  },
  cambiarPrecio: {
    metodo: "POST",
    ruta: "/api/catalogo/{id}/precio",
    resumen: "Nuevo precio vigente desde hoy; el anterior queda en la historia (solo administración, ADR-0029)",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ precio: Pesos }),
    estadoExito: 200,
    respuesta: ItemCatalogo,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado"],
  },
  historialDePrecio: {
    metodo: "GET",
    ruta: "/api/catalogo/{id}/precios",
    resumen: "Precios de un ítem, del más reciente al más antiguo",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: z.object({ precios: z.array(PrecioDeItem) }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  listarCotizaciones: {
    metodo: "GET",
    ruta: "/api/cotizaciones",
    resumen: "Cotizaciones de la organización, de la más reciente a la más antigua",
    estadoExito: 200,
    respuesta: z.object({ cotizaciones: z.array(ResumenCotizacion) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  visitasParaCotizar: {
    metodo: "GET",
    ruta: "/api/cotizaciones/visitas",
    resumen: "Visitas con levantamientos revisados y cantidades, para crear una cotización",
    estadoExito: 200,
    respuesta: z.object({ visitas: z.array(VisitaParaCotizar) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  crearCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones",
    resumen: "Crea el borrador desde las cantidades revisadas de la visita, con su número y los precios vigentes",
    cuerpo: z.object({ visitaId: Uuid }),
    estadoExito: 201,
    respuesta: z.object({ id: Uuid }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  obtenerCotizacion: {
    metodo: "GET",
    ruta: "/api/cotizaciones/{id}",
    resumen: "Borrador de la cotización y sus versiones publicadas",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCotizacion,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  guardarCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/borrador",
    resumen: "Guarda el borrador: líneas con su precio, impuestos y condiciones",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ ...ConVersion, lineas: z.array(LineaDeCotizacion).max(300), impuestos: Impuestos, condiciones: CondicionesCotizacion }),
    estadoExito: 200,
    respuesta: z.object({ version: z.int().positive() }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "entrada_invalida"],
  },
  publicarCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/publicar",
    resumen: "Publica una versión inmutable con sus precios y totales, encola su PDF y la envía cuando esté listo",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ ...ConVersion, destinatarios: z.array(Uuid).max(50).default([]), mensaje: TextoDeCorreoPropio.optional() }),
    estadoExito: 201,
    respuesta: VersionCotizacion,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "cotizacion_invalida", "entrada_invalida"],
  },
  pdfDeCotizacion: {
    metodo: "GET",
    ruta: "/api/cotizaciones/{id}/versiones/{numero}/pdf",
    resumen: "URL firmada del PDF de una versión publicada",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    estadoExito: 200,
    respuesta: UrlDeArchivo,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  enviarCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/versiones/{numero}/enviar",
    resumen: "Envía una versión publicada a contactos del cliente",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    cuerpo: z.object({ destinos: z.array(z.object({ contactoId: Uuid, canal: CanalDeEnvio.optional() })).min(1).max(50), llave: LlaveDeEnvioAlCliente, mensaje: TextoDeCorreoPropio.optional() }),
    estadoExito: 200,
    respuesta: VersionCotizacion,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  cancelarEnvioDeCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/versiones/{numero}/envios/{envio}/cancelar",
    resumen: "Cancela un envío de la cotización que todavía espera en cola (ADR-0034)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive(), envio: Uuid }),
    estadoExito: 200,
    respuesta: VersionCotizacion,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  reanudarEnvioDeCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/versiones/{numero}/envios/{envio}/reanudar",
    resumen: "Deshace la cancelación de un envío de la cotización (ADR-0034)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive(), envio: Uuid }),
    estadoExito: 200,
    respuesta: VersionCotizacion,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  retirarVersionDeCotizacion: {
    metodo: "POST",
    ruta: "/api/cotizaciones/{id}/versiones/{numero}/retirar",
    resumen: "Retira una versión de la cotización: deja de ser la vigente y no se envía más; se conserva (ADR-0034)",
    parametros: z.object({ id: Uuid, numero: z.coerce.number().int().positive() }),
    cuerpo: z.object({ motivo: z.string().trim().min(1).max(500) }),
    estadoExito: 200,
    respuesta: VersionCotizacion,
    errores: ["no_autenticado", "sin_permiso", "segundo_factor_requerido", "no_encontrado", "estado_invalido"],
  },
  vincularLinea: {
    metodo: "POST",
    ruta: "/api/levantamientos/{id}/lineas/vincular",
    resumen: "Vincula (o desvincula) una línea de cantidad a un ítem del catálogo; solo quien tiene la revisión",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ version: z.int().positive(), seccion: z.string().max(80), campo: z.string().max(64), linea: z.string().max(20), itemId: Uuid.nullable() }),
    estadoExito: 200,
    respuesta: z.object({ version: z.int().positive() }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "conflicto_de_version", "no_tomado", "estado_invalido", "entrada_invalida"],
  },
  cantidadesDeVisita: {
    metodo: "GET",
    ruta: "/api/visitas/{id}/cantidades",
    resumen: "Líneas de cantidad de los levantamientos de una visita, con su vínculo al catálogo, para exportar",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: z.object({
      visita: z.object({ cliente: z.string(), sitio: z.string(), programadaPara: z.iso.date() }),
      lineas: z.array(LineaDeVisita),
    }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  listarClientes: {
    metodo: "GET",
    ruta: "/api/clientes",
    resumen: "Clientes de la organización con sus sitios: los activos o los archivados (ADR-0035)",
    consulta: z.object({ vista: z.enum(["activos", "archivados"]).default("activos") }),
    estadoExito: 200,
    respuesta: z.object({ clientes: z.array(ClienteConSitios) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  crearCliente: {
    metodo: "POST",
    ruta: "/api/clientes",
    resumen: "Crea un cliente con su primer sitio y, si llega, su contacto principal (iteración 29)",
    cuerpo: z.object({
      nombre: Texto(200),
      nit: Texto(30).optional(),
      sitio: z.object({ nombre: Texto(200), direccion: Texto(300), ciudad: Texto(80).optional() }),
      /** Opcional para el comando y la API (expansión); oficina lo pide siempre: sin él, los documentos no le llegan a nadie. */
      contacto: DatosContacto.refine((d) => d.correo !== null || d.celular !== null, { path: ["correo"], message: "Escriba el correo, el celular o los dos" }).optional(),
    }),
    estadoExito: 201,
    respuesta: ClienteConSitios,
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
  },
  editarCliente: {
    metodo: "POST",
    ruta: "/api/clientes/{id}",
    resumen: "Corrige el nombre y el NIT del cliente; lo ya publicado conserva el suyo (ADR-0035). Sin `nit`, no se toca; con null, se quita",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ nombre: Texto(200), nit: Texto(30).nullable().optional() }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  archivarCliente: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/archivar",
    resumen: "Archiva el cliente: sale de las listas y de programar, y no recibe envíos. No se archiva con visitas por hacer (ADR-0035)",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  recuperarCliente: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/recuperar",
    resumen: "Recupera un cliente archivado (ADR-0035)",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  editarSitio: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/sitios/{sitioId}",
    resumen: "Corrige el nombre, la dirección o la ciudad de un sitio (ADR-0035). Sin `ciudad`, no se toca; con null, se quita",
    parametros: z.object({ id: Uuid, sitioId: Uuid }),
    cuerpo: z.object({ nombre: Texto(200), direccion: Texto(300), ciudad: Texto(80).nullable().optional() }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
  },
  archivarSitio: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/sitios/{sitioId}/archivar",
    resumen: "Archiva un sitio: ya no se le programan visitas. No se archiva con visitas por hacer ni el último sitio activo (ADR-0035)",
    parametros: z.object({ id: Uuid, sitioId: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  recuperarSitio: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/sitios/{sitioId}/recuperar",
    resumen: "Recupera un sitio archivado (ADR-0035)",
    parametros: z.object({ id: Uuid, sitioId: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido"],
  },
  obtenerCliente: {
    metodo: "GET",
    ruta: "/api/clientes/{id}",
    resumen: "Cliente con sus sitios y sus contactos",
    parametros: z.object({ id: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  crearContacto: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/contactos",
    resumen: "Agrega un contacto al cliente; la autorización de WhatsApp queda con quién y cuándo (ADR-0028)",
    parametros: z.object({ id: Uuid }),
    cuerpo: DatosContacto,
    estadoExito: 201,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  editarContacto: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/contactos/{contactoId}",
    resumen: "Cambia un contacto; cambiar el celular borra la autorización de WhatsApp y cambiar el correo, su rebote",
    parametros: z.object({ id: Uuid, contactoId: Uuid }),
    cuerpo: DatosContacto,
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  quitarContacto: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/contactos/{contactoId}/quitar",
    resumen: "Quita un contacto; sus envíos anteriores conservan el nombre y el destino",
    parametros: z.object({ id: Uuid, contactoId: Uuid }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  cambiarAccesoAlPortal: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/contactos/{contactoId}/portal",
    resumen: "Da o quita al contacto el acceso al portal (ADR-0053); darlo le envía una invitación, salvo al deshacer un retiro",
    parametros: z.object({ id: Uuid, contactoId: Uuid }),
    cuerpo: z.object({ activo: z.boolean(), invitar: z.boolean().default(true) }),
    estadoExito: 200,
    respuesta: DetalleCliente,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida", "estado_invalido", "conflicto"],
  },
  agregarSitio: {
    metodo: "POST",
    ruta: "/api/clientes/{id}/sitios",
    resumen: "Agrega un sitio a un cliente",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ nombre: Texto(200), direccion: Texto(300), ciudad: Texto(80).optional() }),
    estadoExito: 201,
    respuesta: ClienteConSitios,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "entrada_invalida"],
  },
  cambiarContrasena: {
    metodo: "POST",
    ruta: "/api/cuenta/contrasena",
    resumen: "Cambia la propia contraseña con la actual; cierra las demás sesiones y quita la marca de temporal (ADR-0033)",
    cuerpo: z.object({ actual: ContrasenaEscrita, nueva: ContrasenaNueva }),
    estadoExito: 200,
    respuesta: z.object({}),
    errores: ["no_autenticado", "entrada_invalida", "credencial_incorrecta", "demasiadas_solicitudes"],
  },
  quitarSegundoFactor: {
    metodo: "POST",
    ruta: "/api/cuenta/segundo-factor/quitar",
    resumen: "Quita el propio segundo factor con la contraseña y un código vigente; no para quien administra (ADR-0033)",
    cuerpo: z.object({ contrasena: ContrasenaEscrita, codigo: z.string().regex(/^\d{6}$/) }),
    estadoExito: 200,
    respuesta: z.object({}),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida", "credencial_incorrecta", "estado_invalido", "demasiadas_solicitudes"],
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
    /** `formato`: el servicio, uno de los formatos de la organización (ADR-0057); su nombre queda como motivo. */
    cuerpo: z.object({ clienteId: Uuid, sitioId: Uuid, formato: Texto(80), programadaPara: z.iso.date(), ...Horario, ...DatosDePedido, tecnicos: z.array(z.string()).min(1).max(20) }).superRefine(horarioValido),
    estadoExito: 201,
    respuesta: VisitaProgramada,
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida", "tecnico_ocupado"],
  },
  serviciosParaProgramar: {
    metodo: "GET",
    ruta: "/api/visitas/servicios",
    resumen: "Los servicios que se pueden programar: cada formato de la organización con su nombre (ADR-0057)",
    estadoExito: 200,
    respuesta: z.object({ servicios: z.array(z.object({ clave: z.string(), nombre: z.string() })) }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  ocupacionDeTecnicos: {
    metodo: "GET",
    ruta: "/api/visitas/ocupacion",
    resumen: "Lo que ocupa a cada técnico un día, para programar solo con los libres (ADR-0037)",
    consulta: z.object({ fecha: z.iso.date() }),
    estadoExito: 200,
    respuesta: z.object({ ocupaciones: z.array(OcupacionDeTecnico) }),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
  },
  terminarVisita: {
    metodo: "POST",
    ruta: "/api/visitas/{id}/terminar",
    resumen: "El técnico termina la visita desde su teléfono, también sin señal y después (ADR-0037); repetirlo no cambia nada",
    parametros: z.object({ id: Uuid }),
    cuerpo: z.object({ llave: Uuid, en: Fecha }),
    estadoExito: 200,
    respuesta: z.object({ terminada: z.object({ en: Fecha }) }),
    errores: ["no_autenticado", "sin_permiso", "no_encontrado", "estado_invalido", "entrada_invalida"],
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
    resumen: "Cambia la fecha, el horario y el servicio; los teléfonos lo reciben en la siguiente bajada. El servicio no cambia si ya se recibió un levantamiento (ADR-0057)",
    parametros: z.object({ id: Uuid }),
    /** Sin `formato`, el servicio se conserva (las visitas anteriores conservan su motivo). */
    cuerpo: z.object({ version: z.int().positive(), programadaPara: z.iso.date(), ...Horario, ...DatosDePedido, formato: Texto(80).optional() }).superRefine(horarioValido),
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
  bocetoDeArchivo: {
    metodo: "GET",
    ruta: "/api/archivos/{huella}/boceto",
    resumen: "El documento de un boceto verificado, para dibujarlo en oficina (ADR-0019)",
    parametros: z.object({ huella: Huella }),
    estadoExito: 200,
    respuesta: DocumentoBoceto,
    errores: ["no_autenticado", "sin_permiso", "no_encontrado"],
  },
  estadoDePlano: {
    metodo: "GET",
    ruta: "/api/archivos/{huella}/plano",
    resumen: "Si un plano ya se verificó y cuántas páginas anexa al informe, o que no se puede anexar (iteración 26)",
    parametros: z.object({ huella: Huella }),
    estadoExito: 200,
    respuesta: EstadoDePlano,
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
  // La foto de llegada (iteración 47, ADR-0052)
  horaDelServidor: {
    metodo: "GET",
    ruta: "/api/hora",
    resumen: "La hora oficial del servidor, la «hora de red» de la franja de la foto de llegada",
    estadoExito: 200,
    respuesta: z.object({ ahora: Fecha }),
    errores: ["no_autenticado", "sin_permiso"],
  },
  mapaDeLlegada: {
    metodo: "GET",
    ruta: "/api/mapa",
    resumen:
      "El mapa de la foto de llegada, como imagen incrustada. Las coordenadas se redondean a 3 decimales antes de pedirlo y nunca se registran; la llave del servicio no sale del servidor. 30 por minuto por técnico",
    consulta: z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }),
    estadoExito: 200,
    respuesta: z.object({
      /** `data:` con el JPEG: campo la dibuja en el lienzo sin problemas de origen. */
      imagen: z.string().startsWith("data:image/"),
      /** El punto central ya redondeado: campo calcula desde él dónde dibujar el pin exacto. */
      centro: z.object({ lat: z.number(), lon: z.number() }),
      zoom: z.number(),
      /** Va dentro del mapa, al tamaño final: en una foto reenviada no hay enlace que seguir. */
      atribucion: z.string(),
    }),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida", "demasiadas_solicitudes", "no_disponible"],
  },
  // Avisos push (ADR-0023)
  configuracionAvisos: {
    metodo: "GET",
    ruta: "/api/avisos/configuracion",
    resumen: "Clave pública VAPID para suscribirse; nula si los avisos están apagados en este entorno",
    estadoExito: 200,
    respuesta: ConfiguracionAvisos,
    errores: ["no_autenticado", "sin_permiso"],
  },
  suscribirAvisos: {
    metodo: "POST",
    ruta: "/api/avisos/suscripciones",
    resumen: "Guarda la suscripción de este navegador para la persona de la sesión (reemplaza la de otra persona en un teléfono compartido)",
    cuerpo: SuscripcionAvisos,
    estadoExito: 200,
    respuesta: z.object({}),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida", "no_encontrado"],
  },
  quitarSuscripcionAvisos: {
    metodo: "POST",
    ruta: "/api/avisos/suscripciones/quitar",
    resumen: "Quita la suscripción de este navegador (al cerrar sesión o al desactivar los avisos)",
    cuerpo: SuscripcionAvisos.pick({ endpoint: true }),
    estadoExito: 200,
    respuesta: z.object({}),
    errores: ["no_autenticado", "sin_permiso", "entrada_invalida"],
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

// Comprobaciones en compilación (como en ./dominio): lo que la frontera acepta cabe en lo que usa el dominio.
// Aquí y no en ./dominio, que este archivo ya importa. El estado excluye "borrador" a propósito: solo existe en el teléfono.
type Asignable<A, B> = [A] extends [B] ? true : false;
const _impuestos: Asignable<z.output<typeof Impuestos>, dominio.Impuestos> = true;
const _linea: Asignable<z.output<typeof LineaDeCotizacion>, dominio.LineaDeCotizacion> = true;
const _condiciones: Asignable<z.output<typeof CondicionesCotizacion>, dominio.CondicionesCotizacion> = true;
const _seleccion: Asignable<z.output<typeof SeleccionInforme>, dominio.SeleccionInforme> = true;
const _estado: Asignable<z.output<typeof EstadoLevantamiento>, dominio.EstadoLevantamiento> = true;
void [_impuestos, _linea, _condiciones, _seleccion, _estado];
