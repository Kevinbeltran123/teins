import { inArray, or, sql, type AnyColumn } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { bloques, rutaLegible, type EstadoRevision, type Repeticiones, type Respuestas } from "@teins/dominio";
import type { BaseDeDatos, TxOrganizacion } from "../../plataforma/base-de-datos";
import { enOrganizacion } from "../../plataforma/base-de-datos";
import { contieneTexto } from "../../plataforma/busqueda";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Archivos } from "../archivos";
import type { Catalogo } from "../catalogo";
import { leerCadena, registrar, verificarCadena } from "../auditoria";
import { avisar } from "../avisos";
import { registrarCambios } from "../cambios";
import type { Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import type { Visitas } from "../visitas";
import { recibirEnvio, type DependenciasEnvio } from "./aplicacion/recibir-envio";
import { comentar, corregirCampos, marcar, tomar, vincular, type DependenciasRevision, type EstadoDeRevision } from "./aplicacion/revision";
import { cantidadesRevisadas, comentariosDe, conteosPorVisita, detalle, deVisita, estadosDe, lineasDeVisita, paginaPorEstado, vinculosDe, type ConteoDeVisita, type LineaRevisadaDeVisita } from "./consultas";

export type { LineaRevisadaDeVisita } from "./consultas";
import { levantamientos } from "./esquema";
import { repositorioDrizzle, repositorioRevision } from "./repositorio";

export interface ComentarioParaElTecnico {
  id: string;
  autorId: string;
  texto: string;
  seccion: string | null;
  campo: string | null;
  creadoEn: Date;
}

export interface EstadoParaElTecnico {
  id: string;
  estado: EstadoRevision;
  recibidoEn: Date;
  comentarios: ComentarioParaElTecnico[];
}

export interface LevantamientoDeVisita {
  id: string;
  visitaId: string | null;
  estado: EstadoRevision;
  formato: string;
  versionFormato: number;
  tecnicoId: string;
  revisorId: string | null;
  recibidoEn: Date;
  respuestas: Respuestas;
  repeticiones: Repeticiones;
}

export interface Levantamientos {
  /** Levantamientos de una visita con sus respuestas, para componer y congelar su informe. */
  deVisita(tx: TxOrganizacion, visitaId: string): Promise<LevantamientoDeVisita[]>;
  /** Estado de negocio y comentarios de los levantamientos propios del técnico, para la bajada. */
  estados(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string): Promise<EstadoParaElTecnico[]>;
  /** Levantamientos por estado de cada visita: su avance (modelo de dominio, sección 5). */
  conteosPorVisita(tx: TxOrganizacion, visitaIds: readonly string[]): Promise<Map<string, ConteoDeVisita>>;
  /** Cantidades de los levantamientos revisados, para cotizar (ADR-0029). */
  cantidadesRevisadas(tx: TxOrganizacion, visitaIds?: readonly string[], recibidosDesde?: Date): Promise<LineaRevisadaDeVisita[]>;
  registrarRutas(app: FastifyInstance): void;
}

interface Dependencias {
  bd: BaseDeDatos;
  formatos: Formatos;
  archivos: Archivos;
  visitas: Pick<Visitas, "existe" | "resumenes" | "coincidentes">;
  identidad: Pick<Identidad, "nombres" | "buscarPorNombre">;
  catalogo: Pick<Catalogo, "items">;
}

const SIN_NOMBRE = "[Usuario no disponible]";

/** `inArray` con una lista vacía no coincide con nada. */
const inArrayONada = (columna: AnyColumn, ids: string[]) => (ids.length ? inArray(columna, ids) : sql`false`);

/** Interfaz pública del módulo de levantamientos: núcleo del sistema. */
export function crearLevantamientos({ bd, formatos, archivos, visitas, identidad, catalogo }: Dependencias): Levantamientos {
  const envio: DependenciasEnvio = { bd, repositorio: repositorioDrizzle, formatos, archivos, visitas, registrarAuditoria: registrar, registrarCambios, avisar, catalogo, nombres: identidad.nombres };
  const revision: DependenciasRevision = { bd, repositorio: repositorioRevision, formatos, registrarAuditoria: registrar, registrarCambios, avisar, nombres: identidad.nombres, catalogo };

  async function personas(organizacionId: string, ids: readonly (string | null)[]) {
    const nombres = await identidad.nombres(organizacionId, [...new Set(ids.filter((i): i is string => i !== null))]);
    return (id: string | null) => (id === null ? null : { id, nombre: nombres.get(id) ?? SIN_NOMBRE });
  }

  async function estadoDeRevision(organizacionId: string, e: EstadoDeRevision) {
    const persona = await personas(organizacionId, [e.revisorId]);
    return { estado: e.estado, revisor: persona(e.revisorId), version: e.version };
  }

  return {
    estados: estadosDe,
    deVisita,
    conteosPorVisita,
    cantidadesRevisadas,

    registrarRutas(app) {
      registrarOperacion(app, "enviarComando", {
        politica: politicas.tecnico,
        manejar: ({ cuerpo, actor, correlacion }) => recibirEnvio(envio, actor, cuerpo, correlacion),
      });

      registrarOperacion(app, "listarLevantamientos", {
        politica: politicas.oficina,
        manejar: async ({ consulta, actor }) => {
          const { filas, siguienteCursor, total, visitasDe, nombresFormato } = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // Búsqueda: clave del formato aquí y su nombre por la interfaz de formatos; cliente y sitio por la
            // de visitas; técnico por la de identidad.
            const texto = consulta.buscar?.trim();
            const filtro = texto
              ? or(
                  contieneTexto(levantamientos.formato, texto),
                  inArrayONada(levantamientos.formato, await formatos.coincidentes(tx, texto)),
                  inArrayONada(levantamientos.visitaId, await visitas.coincidentes(tx, texto)),
                  inArrayONada(levantamientos.tecnicoId, await identidad.buscarPorNombre(actor.organizacionId, texto, tx)),
                )
              : undefined;
            const pagina = await paginaPorEstado(tx, consulta.estado, consulta.cursor, consulta.limite, filtro);
            // Cliente y sitio de toda la página en una consulta, por la interfaz del módulo de visitas.
            const ids = [...new Set(pagina.filas.flatMap((f) => (f.visitaId ? [f.visitaId] : [])))];
            // Nombre de cada formato de la página: se ve "Levantamiento UPS", no su clave.
            const pares = [...new Map(pagina.filas.map((f) => [`${f.formato}@${f.versionFormato}`, f])).values()];
            const nombresFormato = new Map(await Promise.all(pares.map(async (f) => [`${f.formato}@${f.versionFormato}`, (await formatos.obtener(tx, f.formato, f.versionFormato))?.nombre] as const)));
            return { ...pagina, visitasDe: await visitas.resumenes(tx, ids), nombresFormato };
          });
          const persona = await personas(actor.organizacionId, filas.flatMap((f) => [f.tecnicoId, f.revisorId]));
          return {
            elementos: filas.map((f) => ({
              id: f.id,
              formato: f.formato,
              versionFormato: f.versionFormato,
              ...(nombresFormato.get(`${f.formato}@${f.versionFormato}`) ? { nombreFormato: `${nombresFormato.get(`${f.formato}@${f.versionFormato}`)} v${f.versionFormato}` } : {}),
              estado: f.estado as EstadoRevision,
              tecnico: persona(f.tecnicoId)!,
              revisor: persona(f.revisorId),
              recibidoEn: f.recibidoEn.toISOString(),
              fotos: f.cantidadFotos,
              visita: (() => {
                const v = f.visitaId ? visitasDe.get(f.visitaId) : undefined;
                return v ? { id: v.id, cliente: v.cliente.nombre, sitio: v.sitio.nombre } : null;
              })(),
              version: f.version,
            })),
            siguienteCursor,
            total,
          };
        },
      });

      registrarOperacion(app, "obtenerLevantamiento", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const resultado = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const fila = await detalle(tx, id);
            if (!fila) return null;
            const definicion = await formatos.obtener(tx, fila.formato, fila.versionFormato);
            if (!definicion) return null;
            const visita = fila.visitaId ? (await visitas.resumenes(tx, [fila.visitaId])).get(fila.visitaId) : undefined;
            const lineasVinculadas = await vinculosDe(tx, fila.id);
            const items = await catalogo.items(tx, lineasVinculadas.map((v) => v.itemId!));
            const vinculos = lineasVinculadas.flatMap((v) => {
              const item = items.get(v.itemId!);
              // Lo eligió el técnico y nadie de oficina lo ha cambiado (ADR-0025).
              const elegidoEnCampo = v.vinculadaPor === fila.tecnicoId;
              return item ? [{ seccion: v.seccion, campo: v.campo, linea: v.linea, item: { id: item.id, codigo: item.codigo, descripcion: item.descripcion, unidad: item.unidad }, elegidoEnCampo }] : [];
            });
            return { fila, definicion, visita, comentarios: await comentariosDe(tx, [fila.id]), vinculos };
          });
          if (!resultado) throw problema("no_encontrado");
          const { fila, definicion, visita, comentarios, vinculos } = resultado;
          const persona = await personas(actor.organizacionId, [fila.tecnicoId, fila.revisorId, ...comentarios.map((c) => c.autorId)]);
          return {
            id: fila.id,
            formato: fila.formato,
            versionFormato: fila.versionFormato,
            estado: fila.estado as EstadoRevision,
            tecnico: persona(fila.tecnicoId)!,
            revisor: persona(fila.revisorId),
            recibidoEn: fila.recibidoEn.toISOString(),
            fotos: fila.cantidadFotos,
            version: fila.version,
            respuestas: fila.respuestas,
            repeticiones: fila.repeticiones,
            vinculos,
            formatoDefinicion: definicion,
            creadoEnDispositivo: fila.creadoEnDispositivo.toISOString(),
            enviadoEnDispositivo: fila.enviadoEnDispositivo.toISOString(),
            visita: visita
              ? { id: visita.id, cliente: visita.cliente.nombre, sitio: visita.sitio.nombre, direccion: visita.sitio.direccion, motivo: visita.motivo, programadaPara: visita.programadaPara }
              : null,
            comentarios: comentarios.map((c) => ({
              id: c.id,
              texto: c.texto,
              ...(c.seccion ? { seccion: c.seccion } : {}),
              ...(c.campo ? { campo: c.campo } : {}),
              autor: persona(c.autorId)!,
              creadoEn: c.creadoEn.toISOString(),
            })),
          };
        },
      });

      registrarOperacion(app, "tomarLevantamiento", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          estadoDeRevision(actor.organizacionId, await tomar(revision, actor, id, cuerpo.version, cuerpo.reasignar, correlacion)),
      });

      registrarOperacion(app, "corregirLevantamiento", {
        politica: politicas.oficina,
        manejar: ({ parametros: { id }, cuerpo, actor, correlacion }) => corregirCampos(revision, actor, id, cuerpo.version, cuerpo.correcciones, cuerpo.motivo, correlacion),
      });

      registrarOperacion(app, "vincularLinea", {
        politica: politicas.oficina,
        manejar: ({ parametros: { id }, cuerpo, actor, correlacion }) => vincular(revision, actor, id, cuerpo, correlacion),
      });

      registrarOperacion(app, "cantidadesDeVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const r = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const visita = (await visitas.resumenes(tx, [id])).get(id);
            if (!visita) return null;
            const filas = await lineasDeVisita(tx, id);
            const items = await catalogo.items(tx, [...new Set(filas.flatMap((f) => (f.itemId ? [f.itemId] : [])))]);
            const definiciones = new Map<string, Awaited<ReturnType<typeof formatos.obtener>>>();
            for (const f of filas) {
              const k = `${f.formato}@${f.versionFormato}`;
              if (!definiciones.has(k)) definiciones.set(k, await formatos.obtener(tx, f.formato, f.versionFormato));
            }
            // La consulta agrupa por levantamiento; dentro de cada uno, el orden es el del formato y el de las
            // repeticiones, no el alfabético de su clave (el id de una repetición es aleatorio).
            const posicion = (f: (typeof filas)[number]) => {
              const definicion = definiciones.get(`${f.formato}@${f.versionFormato}`);
              if (!definicion) return [0, 0];
              const lista = bloques(definicion, f.repeticiones);
              const bloque = lista.findIndex((b) => b.clave === f.seccion);
              return [bloque, bloque < 0 ? 0 : lista[bloque]!.seccion.campos.findIndex((c) => c.clave === f.campo)];
            };
            const primera = new Map<string, number>();
            filas.forEach((f, i) => primera.set(f.levantamientoId, primera.get(f.levantamientoId) ?? i));
            const ordenadas = filas
              .map((f, i) => ({ f, llave: [primera.get(f.levantamientoId)!, ...posicion(f), i] }))
              .sort((a, b) => a.llave.reduce((d, v, k) => d || v - b.llave[k]!, 0))
              .map(({ f }) => f);
            return { visita, filas: ordenadas, items, definiciones };
          });
          if (!r) throw problema("no_encontrado", "La visita no existe");
          const persona = await personas(actor.organizacionId, r.filas.map((f) => f.tecnicoId));
          return {
            visita: { cliente: r.visita.cliente.nombre, sitio: r.visita.sitio.nombre, programadaPara: r.visita.programadaPara },
            lineas: r.filas.map((f) => {
              const definicion = r.definiciones.get(`${f.formato}@${f.versionFormato}`);
              const item = f.itemId ? r.items.get(f.itemId) : undefined;
              return {
                levantamientoId: f.levantamientoId,
                tecnico: persona(f.tecnicoId)!.nombre,
                estado: f.estado as EstadoRevision,
                ubicacion: definicion ? rutaLegible(definicion, f.repeticiones, f.seccion, f.campo) : `${f.seccion} · ${f.campo}`,
                descripcion: f.descripcion,
                cantidad: f.cantidad,
                unidad: f.unidad,
                observacion: f.observacion,
                item: item ? { codigo: item.codigo, descripcion: item.descripcion } : null,
              };
            }),
          };
        },
      });

      registrarOperacion(app, "marcarRevisado", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          estadoDeRevision(actor.organizacionId, await marcar(revision, actor, id, cuerpo.version, correlacion)),
      });

      registrarOperacion(app, "comentarLevantamiento", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const c = await comentar(revision, actor, id, cuerpo, correlacion);
          const persona = await personas(actor.organizacionId, [actor.usuarioId]);
          return {
            id: c.id,
            texto: c.texto,
            ...(c.seccion ? { seccion: c.seccion } : {}),
            ...(c.campo ? { campo: c.campo } : {}),
            autor: persona(actor.usuarioId)!,
            creadoEn: c.creadoEn.toISOString(),
          };
        },
      });

      registrarOperacion(app, "historialLevantamiento", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const resultado = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            if (!(await detalle(tx, id))) return null;
            return {
              eventos: await leerCadena(tx, actor.organizacionId, "levantamiento", id),
              verificacion: await verificarCadena(tx, actor.organizacionId, "levantamiento", id),
            };
          });
          if (!resultado) throw problema("no_encontrado");
          const revisores = resultado.eventos.flatMap((e) => [e.valorAnterior, e.valorNuevo]).map((v) => (v as { revisor?: string } | null)?.revisor ?? null);
          const persona = await personas(actor.organizacionId, [...resultado.eventos.map((e) => e.autorId), ...revisores]);
          // En la toma se guarda el identificador; la persona lo lee con su nombre.
          const legible = (v: unknown) => {
            const revisor = (v as { revisor?: string } | null)?.revisor;
            return revisor ? { revisor: persona(revisor)!.nombre } : v;
          };
          return {
            integra: resultado.verificacion.integra,
            eventos: resultado.eventos.map((e) => {
              const [seccion, campo] = e.rutaCampo?.split(".") ?? [];
              return {
                secuencia: e.secuencia,
                tipo: e.tipoEvento,
                ...(seccion ? { seccion } : {}),
                ...(campo ? { campo } : {}),
                ...(e.valorAnterior !== null ? { anterior: legible(e.valorAnterior) } : {}),
                ...(e.valorNuevo !== null ? { nuevo: legible(e.valorNuevo) } : {}),
                autor: persona(e.autorId)!,
                hora: e.horaServidor.toISOString(),
                ...(e.horaDispositivo ? { horaDispositivo: e.horaDispositivo.toISOString() } : {}),
                ...(e.motivo ? { motivo: e.motivo } : {}),
                correlacion: e.correlacion,
              };
            }),
          };
        },
      });
    },
  };
}
