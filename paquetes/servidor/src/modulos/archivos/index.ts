import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { leerBoceto, LIMITES_BOCETO, TIPO_ARCHIVO_BOCETO } from "@teins/dominio";
import type { Config } from "../../config";
import { claveDeObjeto, leerTodo, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar } from "../../plataforma/cola";
import { paginasDePlano } from "../../plataforma/pdf";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { archivos, type EstadoArchivo } from "./esquema";

export type { EstadoArchivo } from "./esquema";

export interface Archivos {
  /** Estado y tipo declarado de cada huella en la organización de la transacción; las desconocidas no aparecen. */
  estados(tx: TxOrganizacion, huellas: readonly string[]): Promise<Map<string, { estado: EstadoArchivo; tipo: string }>>;
  /**
   * Trabajo del worker: verifica firma interna, tamaño y huella (ADR-0007, paso 6). Idempotente. Si en
   * el último intento no se puede leer, queda rechazado: quien lo usa lo vuelve a subir.
   */
  verificar(datos: { organizacionId: string; huella: string }, contexto: { ultimoIntento: boolean; registro?: RegistroDeTrabajo }): Promise<void>;
  registrarRutas(app: FastifyInstance): void;
}

/**
 * Lo subido que nadie verificó en más de 12 horas vuelve a la cola, con la misma llave (ADR-0043): su trabajo se
 * perdió o murió a medias, y sin verificar el informe que lo usa no se puede publicar.
 */
export async function recuperarArchivosAtascados(tx: TxOrganizacion, organizacionId: string, antesDe: Date): Promise<number> {
  const atascados = await tx.select({ huella: archivos.huella }).from(archivos).where(and(eq(archivos.estado, "subido"), lt(archivos.subidoEn, antesDe)));
  for (const { huella } of atascados) await encolar(tx, "archivos.verificar", { organizacionId, huella }, { llave: `archivos.verificar:${organizacionId}:${huella}` });
  return atascados.length;
}

/** Fotos, bocetos y firmas de campo. Los planos no: los usan informes que este módulo no ve (ADR-0048). */
const TIPOS_QUE_SE_LIMPIAN = ["image/jpeg", TIPO_ARCHIVO_BOCETO];
/** Por organización y pasada: lo que quede sigue en la próxima hora. */
const LOTE_SIN_USO = 500;

/**
 * Limpieza de ADR-0007 (ADR-0048): de los archivos de campo sin actividad desde `antesDe`, borra la fila y el objeto
 * de los que ningún levantamiento usa (`enUso`) y marca los demás para no volver a mirarlos. Corre con la conexión
 * del dueño: la aplicación no borra archivos. Las filas se bloquean antes de preguntar por su uso y un envío las lee
 * con `for share` (`estados`): o el envío espera y ya no las encuentra (vuelve a subirlas), o la limpieza las salta.
 * El objeto se borra después de la fila: si eso falla queda un objeto sin fila, que una subida igual adopta.
 */
export async function borrarArchivosSinUso(
  bd: BaseDeDatos,
  almacenamiento: Almacenamiento,
  organizacionId: string,
  { antesDe, enUso }: { antesDe: Date; enUso: (tx: TxOrganizacion, huellas: readonly string[]) => Promise<Set<string>> },
): Promise<number> {
  const borradas = await enOrganizacion(bd, organizacionId, async (tx) => {
    // El dueño no pasa por la seguridad por fila: cada sentencia filtra la organización.
    const deLaOrganizacion = eq(archivos.organizacionId, organizacionId);
    const candidatas = (
      await tx
        .select({ huella: archivos.huella })
        .from(archivos)
        .where(
          and(
            deLaOrganizacion,
            isNull(archivos.enUsoComprobadoEn),
            inArray(archivos.tipo, TIPOS_QUE_SE_LIMPIAN),
            sql`greatest(${archivos.creadoEn}, ${archivos.subidoEn}, ${archivos.verificadoEn}) < ${antesDe.toISOString()}`,
          ),
        )
        .orderBy(archivos.creadoEn)
        .limit(LOTE_SIN_USO)
        .for("update", { skipLocked: true })
    ).map((f) => f.huella);
    if (candidatas.length === 0) return [];
    const usadas = await enUso(tx, candidatas);
    if (usadas.size > 0) await tx.update(archivos).set({ enUsoComprobadoEn: new Date() }).where(and(deLaOrganizacion, inArray(archivos.huella, [...usadas])));
    const sinUso = candidatas.filter((h) => !usadas.has(h));
    if (sinUso.length > 0) await tx.delete(archivos).where(and(deLaOrganizacion, inArray(archivos.huella, sinUso)));
    return sinUso;
  });
  const fallidas: string[] = [];
  for (const huella of borradas) {
    try {
      await almacenamiento.eliminar(claveDeObjeto(organizacionId, huella));
    } catch {
      fallidas.push(huella);
    }
  }
  if (fallidas.length > 0) throw new Error(`No se borraron ${fallidas.length} objetos sin uso de ${organizacionId}; quedan sin fila: ${fallidas.join(", ")}`);
  return borradas.length;
}

export interface RegistroDeTrabajo {
  warn(datos: Record<string, unknown>, mensaje: string): void;
}

const BYTES_PARA_DETECTAR_TIPO = 4100;
/** Campo sube fotos y bocetos; oficina, planos en PDF. Ninguno sube el tipo del otro. */
const TIPOS_POR_ROL: Record<"tecnico" | "oficina", readonly string[]> = { tecnico: ["image/jpeg", TIPO_ARCHIVO_BOCETO], oficina: ["application/pdf"] };

/** Interfaz pública del módulo de archivos (ADR-0007). */
export function crearArchivos({ bd, almacenamiento, config }: { bd: BaseDeDatos; almacenamiento: Almacenamiento; config: Config }): Archivos {
  async function leerFila(organizacionId: string, huella: string) {
    const [fila] = await enOrganizacion(bd, organizacionId, (tx) => tx.select().from(archivos).where(eq(archivos.huella, huella)));
    return fila;
  }

  async function marcar(organizacionId: string, huella: string, desde: EstadoArchivo, cambios: Partial<typeof archivos.$inferInsert>) {
    await enOrganizacion(bd, organizacionId, (tx) =>
      tx.update(archivos).set(cambios).where(and(eq(archivos.huella, huella), eq(archivos.estado, desde))),
    );
  }

  /**
   * Lee lo guardado y dice por qué no es lo declarado (tamaño, huella, firma interna o, en un boceto, su estructura), o
   * null si lo es. De un plano cuenta además las páginas que anexa al informe (iteración 26).
   */
  async function examinar(organizacionId: string, huella: string, declarado: { tipo: string; bytes: number }): Promise<{ motivo: string | null; paginas?: number }> {
    const hash = createHash("sha256");
    let bytes = 0;
    const partes: Buffer[] = [];
    let cabecera = 0;
    // Un boceto no tiene firma de tipo: se lee completo (es pequeño) para validar su estructura. Un plano también,
    // para contar sus páginas.
    const esBoceto = declarado.tipo === TIPO_ARCHIVO_BOCETO;
    const esPlano = declarado.tipo === "application/pdf";
    for await (const trozo of await almacenamiento.leer(claveDeObjeto(organizacionId, huella))) {
      const b = trozo as Buffer;
      bytes += b.length;
      // Se corta la lectura apenas supera el límite: un objeto enorme no consume memoria.
      if (bytes > config.BYTES_MAXIMOS_ARCHIVO) break;
      hash.update(b);
      if (esBoceto || esPlano || cabecera < BYTES_PARA_DETECTAR_TIPO) {
        partes.push(b);
        cabecera += b.length;
      }
    }
    const contenido = Buffer.concat(partes);
    const tipoValido = esBoceto
      ? contenido.length <= LIMITES_BOCETO.bytes && leerBoceto(contenido.toString("utf8")) !== null
      : (await fileTypeFromBuffer(contenido.subarray(0, BYTES_PARA_DETECTAR_TIPO)))?.mime === declarado.tipo;

    const motivo =
      bytes > config.BYTES_MAXIMOS_ARCHIVO
        ? "supera el tamaño permitido"
        : bytes !== declarado.bytes
          ? "el tamaño no coincide con el declarado"
          : hash.digest("hex") !== huella
            ? "la huella no coincide con el contenido"
            : !tipoValido
              ? `el contenido no es ${esBoceto ? "un boceto válido" : declarado.tipo}`
              : null;
    return motivo === null && esPlano ? { motivo, paginas: await paginasDePlano(contenido) } : { motivo };
  }

  async function verificarContenido(fila: typeof archivos.$inferSelect, registro: RegistroDeTrabajo | undefined) {
    const { organizacionId, huella } = fila;
    const { motivo, paginas } = await examinar(organizacionId, huella, fila);
    if (motivo === null) {
      await marcar(organizacionId, huella, "subido", { estado: "verificado", verificadoEn: new Date(), ...(paginas !== undefined ? { paginas } : {}) });
      return;
    }
    // Un contenido que no pasa la verificación nunca fue aceptado por ningún envío: se elimina. Primero el
    // objeto: si falla, la fila sigue subida y el reintento vuelve a verificar; y mientras está subida nadie
    // puede autorizar una subida nueva que este borrado se llevaría.
    registro?.warn({ huella, motivo }, "Archivo rechazado");
    await almacenamiento.eliminar(claveDeObjeto(organizacionId, huella));
    await marcar(organizacionId, huella, "subido", { estado: "rechazado", motivoRechazo: motivo });
  }

  return {
    async estados(tx, huellas) {
      if (huellas.length === 0) return new Map();
      // `for share`: mientras la transacción que los usa no termine, la limpieza no los borra (ADR-0048).
      const filas = await tx
        .select({ huella: archivos.huella, estado: archivos.estado, tipo: archivos.tipo })
        .from(archivos)
        .where(inArray(archivos.huella, [...huellas]))
        .for("share");
      return new Map(filas.map((f) => [f.huella, { estado: f.estado, tipo: f.tipo }]));
    },

    async verificar({ organizacionId, huella }, { ultimoIntento, registro }) {
      const fila = await leerFila(organizacionId, huella);
      if (!fila || fila.estado !== "subido") return;
      try {
        await verificarContenido(fila, registro);
      } catch (error) {
        if (!ultimoIntento) throw error;
        // Sin poder leerlo, no se sabe si es válido: rechazado sin borrar, y al volver a subirlo se verifica de nuevo.
        const motivo = `no se pudo verificar: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300);
        registro?.warn({ huella, motivo }, "Archivo sin verificar");
        await marcar(organizacionId, huella, "subido", { estado: "rechazado", motivoRechazo: motivo });
      }
    },


    registrarRutas(app) {
      registrarOperacion(app, "autorizarSubida", {
        politica: politicas.autenticado,
        manejar: async ({ cuerpo, actor }) => {
          if (cuerpo.bytes > config.BYTES_MAXIMOS_ARCHIVO) throw problema("archivo_demasiado_grande");
          if (cuerpo.tipo === TIPO_ARCHIVO_BOCETO && cuerpo.bytes > LIMITES_BOCETO.bytes) throw problema("archivo_demasiado_grande");
          if (!TIPOS_POR_ROL[actor.rol].includes(cuerpo.tipo)) throw problema("tipo_de_archivo_no_permitido");
          // Una clave ocupada sin fila es de un PDF generado (informe o cotización), o de un archivo cuya fila se perdió
          // al restaurar la base o dejar limpio el entorno. Nunca se autoriza escribir encima: el rechazo de la
          // verificación lo borraría (regla 7). Una foto o un boceto idéntico a lo declarado (el mismo examen del worker)
          // se adopta sin subirlo otra vez; un PDF no, porque un plano no se distingue de un documento generado.
          // Fuera de la transacción: no retiene conexión mientras lee el almacenamiento.
          if (!(await leerFila(actor.organizacionId, cuerpo.huella)) && (await almacenamiento.existe(claveDeObjeto(actor.organizacionId, cuerpo.huella)))) {
            if (cuerpo.tipo === "application/pdf") throw problema("estado_invalido", "Ese contenido ya está guardado como documento generado");
            if ((await examinar(actor.organizacionId, cuerpo.huella, cuerpo)).motivo !== null) {
              throw problema("estado_invalido", "Ya hay un archivo guardado con ese contenido que no coincide con lo declarado: no se reemplaza");
            }
            // Queda subido y lo verifica el worker, como cualquier subida (ADR-0007). Ya pasó el mismo examen, así que no lo
            // rechaza ni lo borra, tampoco si la recuperación de atascados lo vuelve a encolar (ADR-0043).
            await enOrganizacion(bd, actor.organizacionId, async (tx) => {
              const adoptado = await tx
                .insert(archivos)
                .values({ organizacionId: actor.organizacionId, huella: cuerpo.huella, tipo: cuerpo.tipo, bytes: cuerpo.bytes, estado: "subido", creadoPor: actor.usuarioId, subidoEn: new Date() })
                .onConflictDoNothing()
                .returning({ huella: archivos.huella });
              if (adoptado.length > 0) await encolar(tx, "archivos.verificar", { organizacionId: actor.organizacionId, huella: cuerpo.huella }, { llave: `archivos.verificar:${actor.organizacionId}:${cuerpo.huella}` });
            });
          }
          const existente = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [fila] = await tx.select().from(archivos).where(eq(archivos.huella, cuerpo.huella));
            if (fila && (fila.estado === "subido" || fila.estado === "verificado")) return fila.estado;
            if (fila?.estado === "pendiente") {
              // Una subida en curso se verifica contra lo que declaró quien la pidió primero: otra autorización
              // solo vuelve a firmarla (la URL venció) si declara lo mismo.
              if (fila.tipo !== cuerpo.tipo || fila.bytes !== cuerpo.bytes) {
                throw problema("conflicto", "Ese contenido ya se está subiendo con otro tamaño o tipo");
              }
            } else if (fila) {
              await tx
                .update(archivos)
                .set({ estado: "pendiente", tipo: cuerpo.tipo, bytes: cuerpo.bytes, creadoPor: actor.usuarioId, motivoRechazo: null, subidoEn: null, verificadoEn: null })
                .where(eq(archivos.huella, cuerpo.huella));
            } else {
              await tx.insert(archivos).values({
                organizacionId: actor.organizacionId,
                huella: cuerpo.huella,
                tipo: cuerpo.tipo,
                bytes: cuerpo.bytes,
                estado: "pendiente",
                creadoPor: actor.usuarioId,
              });
            }
            return null;
          });
          // Direccionado por contenido: si otro técnico de la organización ya subió la misma foto, no se sube dos veces.
          if (existente) return { estado: "existente" as const, archivo: existente };

          const firma = await almacenamiento.firmarSubida(claveDeObjeto(actor.organizacionId, cuerpo.huella), {
            bytes: cuerpo.bytes,
            tipo: cuerpo.tipo,
            sha256Hex: cuerpo.huella,
          });
          return { estado: "autorizada" as const, url: firma.url, metodo: "PUT" as const, cabeceras: firma.cabeceras, expiraEn: firma.expiraEn.toISOString() };
        },
      });

      registrarOperacion(app, "confirmarSubida", {
        politica: politicas.autenticado,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (!fila) throw problema("no_encontrado", "Pida autorización antes de subir el archivo");
          if (fila.estado === "subido" || fila.estado === "verificado") return { archivo: fila.estado };
          // Aunque el objeto siga guardado, un rechazado se vuelve a autorizar y a subir para verificarlo de nuevo.
          if (fila.estado === "rechazado") {
            throw problema("archivos_faltantes", "El archivo fue rechazado: pida autorización y súbalo de nuevo", { faltantes: [huella] });
          }
          // La consulta al almacenamiento va fuera de la transacción: no se retiene una conexión esperando la red.
          if (!(await almacenamiento.existe(claveDeObjeto(actor.organizacionId, huella)))) {
            throw problema("archivos_faltantes", "El archivo no llegó al almacenamiento", { faltantes: [huella] });
          }
          await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const actualizadas = await tx
              .update(archivos)
              .set({ estado: "subido", subidoEn: new Date() })
              .where(and(eq(archivos.huella, huella), eq(archivos.estado, "pendiente")))
              .returning({ huella: archivos.huella });
            if (actualizadas.length > 0) {
              await encolar(tx, "archivos.verificar", { organizacionId: actor.organizacionId, huella }, {
                // Sin cola con nombre: las verificaciones corren en paralelo (ADR-0012, regla 3).
                llave: `archivos.verificar:${actor.organizacionId}:${huella}`,
              });
            }
          });
          return { archivo: "subido" as const };
        },
      });

      registrarOperacion(app, "bocetoDeArchivo", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (fila?.estado !== "verificado" || fila.tipo !== TIPO_ARCHIVO_BOCETO) throw problema("no_encontrado");
          // Verificado al subir; se vuelve a leer con el mismo validador antes de entregarlo.
          const documento = leerBoceto((await leerTodo(almacenamiento, claveDeObjeto(actor.organizacionId, huella))).toString("utf8"));
          if (!documento) throw problema("error_interno", "El boceto guardado no es válido");
          return documento;
        },
      });

      // Lo que oficina dice de un plano antes de publicar: cuántas páginas anexa o que no se puede anexar (iteración 26).
      registrarOperacion(app, "estadoDePlano", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (!fila || fila.tipo !== "application/pdf") throw problema("no_encontrado");
          if (fila.estado === "rechazado") return { estado: "rechazado" as const, paginas: null };
          if (fila.estado !== "verificado") return { estado: "verificando" as const, paginas: null };
          return fila.paginas === 0 ? { estado: "ilegible" as const, paginas: null } : { estado: "listo" as const, paginas: fila.paginas };
        },
      });

      registrarOperacion(app, "urlDeArchivo", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { huella }, actor }) => {
          const fila = await leerFila(actor.organizacionId, huella);
          if (fila?.estado !== "verificado") throw problema("no_encontrado");
          const { url, expiraEn } = await almacenamiento.firmarDescarga(claveDeObjeto(actor.organizacionId, huella));
          return { url, expiraEn: expiraEn.toISOString() };
        },
      });
    },
  };
}
