import { z } from "zod";
import { LIMITES } from "@teins/dominio";
import { Fecha, Huella, Respuestas, Uuid, VersionFormato } from "./dominio";
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
export const Sesion = z.object({ usuario: z.object({ id: z.string(), nombre: z.string(), rol: Rol }) }).meta({ id: "Sesion" });

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

export const llaveDeEnvio = (idLevantamiento: string) => `enviar:${idLevantamiento}`;

export const EnviarLevantamiento = z
  .object({
    tipo: z.literal("EnviarLevantamiento"),
    /** Llave de idempotencia derivada del levantamiento: estable entre reintentos y reinstalaciones. */
    llave: z.string().regex(/^enviar:[0-9a-f-]{36}$/),
    levantamiento: z.object({
      id: Uuid,
      formato: z.string().max(64),
      versionFormato: z.int().positive(),
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

// Oficina

const EstadoLevantamiento = z.enum(["enviado"]);

const ResumenLevantamiento = z.object({
  id: Uuid,
  formato: z.string(),
  versionFormato: z.int(),
  estado: EstadoLevantamiento,
  tecnico: z.object({ id: z.string(), nombre: z.string() }),
  recibidoEn: Fecha,
  fotos: z.int(),
});

export const PaginaLevantamientos = z
  .object({ elementos: z.array(ResumenLevantamiento), siguienteCursor: z.string().nullable() })
  .meta({ id: "PaginaLevantamientos" });

export const DetalleLevantamiento = ResumenLevantamiento.extend({
  respuestas: Respuestas,
  formatoDefinicion: VersionFormato,
  creadoEnDispositivo: Fecha,
  enviadoEnDispositivo: Fecha,
}).meta({ id: "DetalleLevantamiento" });

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
  listarLevantamientos: {
    metodo: "GET",
    ruta: "/api/levantamientos",
    resumen: "Levantamientos enviados, del más antiguo al más reciente",
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
export type Consulta<N extends NombreOperacion> = Salida<Operaciones[N] extends { consulta: infer Q } ? Q : undefined>;
export type ConsultaEntrada<N extends NombreOperacion> = Entrada<Operaciones[N] extends { consulta: infer Q } ? Q : undefined>;
export type Respuesta<N extends NombreOperacion> = z.output<Operaciones[N]["respuesta"]>;

/** Tamaño máximo de un archivo de campo: una foto recodificada pesa unos cientos de KB (ADR-0007). */
export const BYTES_MAXIMOS_ARCHIVO = 10 * 1024 * 1024;
void LIMITES;
