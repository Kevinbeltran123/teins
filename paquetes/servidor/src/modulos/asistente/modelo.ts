import Anthropic from "@anthropic-ai/sdk";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { z } from "zod";
import type { UsoDelModelo } from "./costo";

/** Una herramienta como la ve el modelo. */
export interface DefinicionDeHerramienta {
  nombre: string;
  /** Sin `strict` en la API cuando es `false`: el pedido tiene un límite de complejidad para las estrictas. */
  estricta?: boolean;
  descripcion: string;
  entrada: z.ZodType;
}

export type MensajeDelModelo =
  | { tipo: "texto"; rol: "user" | "assistant"; texto: string }
  /** Lo que devolvió el modelo en una vuelta, tal cual: el razonamiento debe volver sin cambios dentro del mismo turno. */
  | { tipo: "turno"; contenido: unknown }
  | { tipo: "resultados"; resultados: { id: string; contenido: string; esError: boolean }[] };

export interface LlamadaAHerramienta {
  id: string;
  nombre: string;
  entrada: unknown;
}

export interface VueltaDelModelo {
  /** `contexto`: la conversación ya no cabe en la ventana del modelo. */
  motivo: "tool_use" | "end_turn" | "refusal" | "max_tokens" | "pause_turn" | "contexto";
  texto: string;
  llamadas: LlamadaAHerramienta[];
  contenido: unknown;
  uso: UsoDelModelo;
  /** Para el registro: el id de la solicitud y la categoría de un rechazo. No son contenido. */
  diagnostico?: { solicitud?: string | null | undefined; categoria?: string | null | undefined };
}

/** El modelo de lenguaje detrás del asistente (ADR-0060): el real o el simulado de las pruebas. */
export interface ModeloAsistente {
  /** El id con que se busca su precio. */
  nombre: string;
  responder(pedido: { sistema: string; herramientas: DefinicionDeHerramienta[]; mensajes: MensajeDelModelo[]; senal?: AbortSignal }): Promise<VueltaDelModelo>;
}

/** Un fallo del modelo con un mensaje para la persona y un código para el registro (nunca el contenido). */
export class ErrorDelModelo extends Error {
  constructor(
    mensaje: string,
    readonly codigo: string,
    readonly solicitud?: string | null,
  ) {
    super(mensaje);
  }
}

/** JSON Schema estricto: el mismo arreglo que hace la SDK con sus esquemas Zod. */
export const esquemaEstricto = (entrada: z.ZodType) => transformJSONSchema(sinLimitesDeEntero(z.toJSONSchema(entrada, { reused: "ref" }))) as Anthropic.Tool.InputSchema;

/**
 * Para las no estrictas: el JSON Schema de Zod con las definiciones en su lugar (con `additionalProperties: false` y las
 * descripciones), sin `$schema` ni el rango del entero seguro.
 */
export function esquemaNormal(entrada: z.ZodType): Anthropic.Tool.InputSchema {
  const { $schema: _version, ...esquema } = sinLimitesDeEntero(z.toJSONSchema(entrada)) as Record<string, unknown>;
  return esquema as Anthropic.Tool.InputSchema;
}

/**
 * Zod pone el rango del entero seguro (±9007199254740991) en todo `z.int()`; la conversión estricta lo pasaría a la
 * descripción, donde solo estorba al modelo. Los demás límites se conservan.
 */
function sinLimitesDeEntero<T>(esquema: T): T {
  if (Array.isArray(esquema)) return esquema.map(sinLimitesDeEntero) as T;
  if (!esquema || typeof esquema !== "object") return esquema;
  const copia: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(esquema)) {
    if ((clave === "minimum" && valor === Number.MIN_SAFE_INTEGER) || (clave === "maximum" && valor === Number.MAX_SAFE_INTEGER)) continue;
    copia[clave] = sinLimitesDeEntero(valor);
  }
  return copia as T;
}

/** Holgado: una respuesta con tablas y varias llamadas cabe de sobra; sin flujo, la SDK no corta por tiempo. */
const MAX_TOKENS = 16_000;

/** `fetch`: solo para las pruebas, que responden por la API sin salir a la red. */
export function modeloAnthropic({ llave, modelo, fetch }: { llave: string; modelo: string; fetch?: typeof globalThis.fetch }): ModeloAsistente {
  // Un reintento: la SDK repite lo que falla por red o sobrecarga. Una vuelta cortada por tiempo no queda contada en el
  // gasto (README del servidor); el respaldo es el límite de gasto en la consola de Anthropic.
  const cliente = new Anthropic({ apiKey: llave, maxRetries: 1, ...(fetch ? { fetch } : {}) });
  const cacheEsquemas = new Map<string, Anthropic.Tool.InputSchema>();

  return {
    nombre: modelo,
    async responder({ sistema, herramientas, mensajes, senal }) {
      const tools: Anthropic.Tool[] = herramientas.map((h) => {
        const estricta = h.estricta !== false;
        let esquema = cacheEsquemas.get(h.nombre);
        if (!esquema) cacheEsquemas.set(h.nombre, (esquema = estricta ? esquemaEstricto(h.entrada) : esquemaNormal(h.entrada)));
        // Las no estrictas no cuentan para el límite de complejidad de la API; su entrada la valida igual el bucle con Zod.
        return { name: h.nombre, description: h.descripcion, input_schema: esquema, ...(estricta ? { strict: true } : {}) };
      });
      let respuesta: Anthropic.Message;
      let solicitud: string | null | undefined;
      try {
        const recibida = await cliente.messages.create(
          {
            model: modelo,
            max_tokens: MAX_TOKENS,
            // La caché cubre herramientas y sistema (van primero y no cambian); la de nivel superior, la conversación
            // que crece de una vuelta a otra.
            system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
            cache_control: { type: "ephemeral" },
            tools,
            tool_choice: { type: "auto" },
            // Explícito: el valor por omisión cambia entre modelos. El pensamiento queda en el suyo.
            output_config: { effort: "medium" },
            messages: mensajes.map(aMensaje),
          },
          { signal: senal },
        );
        respuesta = recibida;
        solicitud = recibida._request_id;
      } catch (error) {
        throw traducirError(error);
      }
      const llamadas = respuesta.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, nombre: b.name, entrada: b.input }] : []));
      const texto = respuesta.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("\n\n")
        .trim();
      return {
        motivo: motivoDe(respuesta.stop_reason, llamadas.length),
        texto,
        llamadas,
        contenido: respuesta.content,
        diagnostico: { solicitud, categoria: respuesta.stop_details?.category },
        uso: {
          entrada: respuesta.usage.input_tokens,
          salida: respuesta.usage.output_tokens,
          cacheLeida: respuesta.usage.cache_read_input_tokens ?? 0,
          cacheEscrita: respuesta.usage.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}

function aMensaje(m: MensajeDelModelo): Anthropic.MessageParam {
  if (m.tipo === "texto") return { role: m.rol, content: m.texto };
  if (m.tipo === "turno") return { role: "assistant", content: m.contenido as Anthropic.ContentBlock[] };
  return { role: "user", content: m.resultados.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.contenido, is_error: r.esError })) };
}

function motivoDe(motivo: Anthropic.StopReason | null, llamadas: number): VueltaDelModelo["motivo"] {
  switch (motivo) {
    case "tool_use":
    case "refusal":
    case "pause_turn":
    case "max_tokens":
      return motivo;
    case "model_context_window_exceeded":
      return "contexto";
    default:
      return llamadas > 0 ? "tool_use" : "end_turn";
  }
}

/** Sin el mensaje original: podría traer partes de la pregunta o de los resultados (ADR-0017). */
function traducirError(error: unknown): ErrorDelModelo {
  const solicitud = error instanceof Anthropic.APIError ? error.requestID : null;
  const con = (mensaje: string, codigo: string) => new ErrorDelModelo(mensaje, codigo, solicitud);
  if (error instanceof Anthropic.APIUserAbortError) return con("La respuesta tardó demasiado. Vuelva a preguntar.", "tiempo_agotado");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return con("El servicio del asistente no respondió a tiempo. Vuelva a preguntar.", "tiempo_agotado");
  if (error instanceof Anthropic.APIConnectionError) return con("No hubo conexión con el servicio del asistente. Vuelva a preguntar en un momento.", "sin_conexion");
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return con("El asistente no está bien configurado en este entorno.", `api_${error.status}`);
  // El límite de gasto de la cuenta (o el crédito) se distingue por el código del error, no por el mensaje.
  const sinGasto = error instanceof Anthropic.RateLimitError && ["enforced_spend_limit_reached", "contract_spend_limit_reached"].includes(error.errorCode ?? "");
  if (sinGasto || error instanceof Anthropic.PaymentRequiredError) return con("Se alcanzó el límite de gasto de la cuenta del asistente: avise a administración.", `api_${error.status}_${error.errorCode ?? "gasto"}`);
  if (error instanceof Anthropic.RateLimitError) return con("El servicio del asistente está saturado. Vuelva a preguntar en un momento.", "api_429");
  if (error instanceof Anthropic.BadRequestError) return con("El asistente no pudo procesar esta pregunta.", "api_400");
  // Antes que InternalServerError, de la que deriva.
  if (error instanceof Anthropic.OverloadedError) return con("El servicio está saturado: intente en unos minutos.", "api_529");
  if (error instanceof Anthropic.InternalServerError) return con("El servicio del asistente tuvo una falla. Vuelva a preguntar en un momento.", `api_${error.status}`);
  if (error instanceof Anthropic.APIError) return con("El servicio del asistente respondió con un error. Vuelva a preguntar.", `api_${error.status ?? "desconocido"}`);
  return con("Algo falló al preparar la respuesta. Vuelva a preguntar.", "desconocido");
}
