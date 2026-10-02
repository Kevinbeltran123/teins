import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { nombreDelPdfDeCotizacion, piePaginaCotizacion, plantillaCotizacion } from "@teins/documentos";
import { calcularTotales, lineasDesdeCantidades, numeroDeCotizacion, validarCotizacion, type BorradorCotizacion, type LineaDeCotizacion } from "@teins/dominio";
import type { Config } from "../../config";
import { claveDeObjeto, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { fuenteIncrustada, imprimirPdf } from "../../plataforma/pdf";
import { politicas } from "../../plataforma/politicas";
import type { Actor } from "../../plataforma/actor";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import type { Catalogo } from "../catalogo";
import { cancelarEnvio, cancelarEnviosDeVersion, enviarAlQuedarListo, enviosDeVersiones, fallarEnviosDeVersion, programarEnvios, reanudarEnvio, versionesConEnvioSinEntregar, type MensajeDeCotizacion } from "../envios";
import type { Identidad } from "../identidad";
import type { Levantamientos } from "../levantamientos";
import type { Visitas } from "../visitas";
import { consecutivos, cotizaciones, versionesCotizacion, type ContenidoCotizacion, type EstadoPdfCotizacion } from "./esquema";

interface Dependencias {
  bd: BaseDeDatos;
  almacenamiento: Almacenamiento;
  levantamientos: Pick<Levantamientos, "cantidadesRevisadas">;
  visitas: Pick<Visitas, "resumenes" | "clienteDe">;
  catalogo: Pick<Catalogo, "items" | "preciosVigentes">;
  identidad: Pick<Identidad, "nombres" | "nombreDeOrganizacion">;
}

/** El PDF de una versión, en el worker. */
export interface GeneradorPdfCotizaciones {
  /** Trabajo del worker (cola `pdf`, de a uno). Idempotente: un PDF listo nunca se vuelve a generar. */
  generarPdf(datos: { organizacionId: string; versionId: string }, contexto: { ultimoIntento: boolean }): Promise<void>;
}

export interface Cotizaciones {
  registrarRutas(app: FastifyInstance): void;
}

const SIN_NOMBRE = "[Usuario no disponible]";
/** Id de línea: 8 caracteres, como los de las cantidades. */
const idDeLinea = () => BigInt(`0x${randomBytes(8).toString("hex")}`).toString(36).padStart(8, "0").slice(-8);

const CONDICIONES_INICIALES = { validezDias: 30, formaPago: "", notas: "" };

/** Año en Colombia: una cotización creada el 31 de diciembre a las 8 p. m. es de ese año. */
/** Ventana de la lista "Visitas para cotizar". */
const DIAS_PARA_COTIZAR = 90;
const anioEnColombia = (ahora = new Date()) => Number(ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 4));

/** Lo único que necesita el worker: el PDF de una versión desde su copia congelada. */
export function crearGeneradorPdfDeCotizaciones({ bd, almacenamiento, config }: { bd: BaseDeDatos; almacenamiento: Almacenamiento; config: Config }): GeneradorPdfCotizaciones {
  return {
    async generarPdf({ organizacionId, versionId }, { ultimoIntento }) {
      const [version] = await enOrganizacion(bd, organizacionId, (tx) => tx.select().from(versionesCotizacion).where(eq(versionesCotizacion.id, versionId)));
      if (!version || version.pdfEstado === "listo") return;
      const c = version.contenido;
      try {
        const pdf = await imprimirPdf({
          html: plantillaCotizacion(c, { salida: { tipo: "pdf", fuente: fuenteIncrustada() } }),
          pie: piePaginaCotizacion(c),
          planos: [],
          metadatos: { titulo: `Cotización ${c.numero} · ${c.visita.cliente} · versión ${c.version}`, autor: c.organizacion.nombre, fecha: new Date(c.publicadaEn) },
          chromiumRuta: config.CHROMIUM_RUTA,
        });
        const huella = createHash("sha256").update(pdf).digest("hex");
        await almacenamiento.guardar(claveDeObjeto(organizacionId, huella), pdf, "application/pdf");
        await enOrganizacion(bd, organizacionId, async (tx) => {
          const listo = await tx
            .update(versionesCotizacion)
            .set({ pdfEstado: "listo", pdfHuella: huella, pdfGeneradoEn: new Date(), pdfError: null })
            .where(and(eq(versionesCotizacion.id, versionId), sql`${versionesCotizacion.pdfEstado} <> 'listo'`))
            .returning({ id: versionesCotizacion.id });
          // Los envíos al cliente salen ahora, con el PDF adjunto (ADR-0028, ADR-0029).
          if (listo.length > 0) await enviarAlQuedarListo(tx, { organizacionId, versionId, pdfRuta: claveDeObjeto(organizacionId, huella) });
        });
      } catch (error) {
        const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        // Con reintentos pendientes sigue "generando"; al agotarlos, queda "fallido" y los envíos en cola
        // se dan por no llegados, con aviso.
        await enOrganizacion(bd, organizacionId, async (tx) => {
          // Otra pasada, o esta misma sin saberlo, pudo dejarlo listo: un PDF listo no cambia.
          const fallada = await tx
            .update(versionesCotizacion)
            .set({ pdfError: mensaje, ...(ultimoIntento ? { pdfEstado: "fallido" as EstadoPdfCotizacion } : {}) })
            .where(and(eq(versionesCotizacion.id, versionId), sql`${versionesCotizacion.pdfEstado} <> 'listo'`))
            .returning({ id: versionesCotizacion.id });
          if (ultimoIntento && fallada.length > 0) await fallarEnviosDeVersion(tx, versionId);
        });
        if (!ultimoIntento) throw error;
      }
    },
  };
}

type FilaVersion = typeof versionesCotizacion.$inferSelect;

/** Interfaz pública del módulo de cotizaciones (ADR-0029). */
export function crearCotizaciones({ bd, almacenamiento, config, levantamientos, visitas, catalogo, identidad }: Dependencias & { config: Config }): Cotizaciones {
  async function leer(tx: TxOrganizacion, id: string) {
    const [fila] = await tx.select().from(cotizaciones).where(eq(cotizaciones.id, id));
    if (!fila) throw problema("no_encontrado", "La cotización no existe");
    return fila;
  }

  /**
   * La copia de la siguiente versión desde el borrador: la que se congela al publicar. Oficina arma la misma copia
   * para su vista en vivo y la dibuja con la plantilla del PDF (ADR-0031).
   */
  async function siguienteVersion(tx: TxOrganizacion, c: typeof cotizaciones.$inferSelect, { organizacion, publicadaPor, publicadaEn }: { organizacion: string; publicadaPor: string; publicadaEn: Date }): Promise<ContenidoCotizacion> {
    const visita = (await visitas.resumenes(tx, [c.visitaId])).get(c.visitaId);
    if (!visita) throw problema("no_encontrado", "La visita de la cotización no existe");
    const [{ numero } = { numero: 0 }] = await tx
      .select({ numero: sql<number>`coalesce(max(${versionesCotizacion.numero}), 0)` })
      .from(versionesCotizacion)
      .where(eq(versionesCotizacion.cotizacionId, c.id));
    // Copia congelada con sus precios y totales: cambiar la lista después no la toca (ADR-0029).
    return {
      numero: c.numero,
      version: numero + 1,
      publicadaEn: publicadaEn.toISOString(),
      publicadaPor,
      organizacion: { nombre: organizacion },
      visita: { cliente: visita.cliente.nombre, sitio: visita.sitio.nombre, direccion: visita.sitio.direccion, programadaPara: visita.programadaPara },
      lineas: c.lineas,
      impuestos: c.impuestos,
      condiciones: c.condiciones,
      totales: calcularTotales(c.lineas, c.impuestos),
    };
  }

  /**
   * Las líneas de cada visita, desde sus cantidades revisadas y con los precios vigentes; sin `visitaIds`, de
   * todas, con `recibidosDesde` para no cargar la historia completa.
   */
  async function lineasPorVisita(tx: TxOrganizacion, visitaIds?: readonly string[], recibidosDesde?: Date): Promise<Map<string, { lineas: LineaDeCotizacion[]; levantamientos: number }>> {
    const revisadas = await levantamientos.cantidadesRevisadas(tx, visitaIds, recibidosDesde);
    const itemIds = [...new Set(revisadas.flatMap((l) => (l.itemId ? [l.itemId] : [])))];
    const [items, precios] = await Promise.all([catalogo.items(tx, itemIds), catalogo.preciosVigentes(tx, itemIds)]);
    const valores = new Map([...precios].map(([id, p]) => [id, p.valor]));
    const porVisita = new Map<string, typeof revisadas>();
    for (const l of revisadas) porVisita.set(l.visitaId, [...(porVisita.get(l.visitaId) ?? []), l]);
    return new Map(
      [...porVisita].map(([visitaId, lineas]) => [
        visitaId,
        {
          levantamientos: new Set(lineas.map((l) => l.levantamientoId)).size,
          lineas: lineasDesdeCantidades(
            lineas.map((l) => {
              const item = l.itemId ? items.get(l.itemId) : undefined;
              return { descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, item: item ? { id: item.id, codigo: item.codigo, descripcion: item.descripcion } : null };
            }),
            valores,
            idDeLinea,
          ),
        },
      ]),
    );
  }

  async function versionesDe(tx: TxOrganizacion, cotizacionIds: readonly string[]) {
    if (cotizacionIds.length === 0) return [];
    return tx.select().from(versionesCotizacion).where(inArray(versionesCotizacion.cotizacionId, [...cotizacionIds])).orderBy(desc(versionesCotizacion.numero));
  }

  const comoVersion = (v: FilaVersion, nombres: Map<string, string>, envios: Awaited<ReturnType<typeof enviosDeVersiones>>) => ({
    numero: v.numero,
    publicadaEn: v.publicadaEn.toISOString(),
    publicadaPor: { id: v.publicadaPor, nombre: nombres.get(v.publicadaPor) ?? SIN_NOMBRE },
    pdf: v.pdfEstado,
    total: v.total,
    envios: envios.get(v.id) ?? [],
    retirada: v.retiradaEn
      ? { en: v.retiradaEn.toISOString(), por: { id: v.retiradaPor ?? "", nombre: nombres.get(v.retiradaPor ?? "") ?? SIN_NOMBRE }, motivo: v.motivoRetiro ?? "" }
      : null,
  });

  /** Quienes aparecen en una versión: quien la publicó y quien la retiró. */
  const personasDe = (v: FilaVersion) => [v.publicadaPor, ...(v.retiradaPor ? [v.retiradaPor] : [])];

  /** Lo que dice el correo o el WhatsApp, de la copia congelada: el mismo nombre que el PDF adjunto. */
  const mensajeDe = (c: ContenidoCotizacion): MensajeDeCotizacion => ({
    documento: "cotizacion",
    organizacion: c.organizacion.nombre,
    cliente: c.visita.cliente,
    sitio: c.visita.sitio,
    cotizacion: c.numero,
    numero: c.version,
    nombreArchivo: nombreDelPdfDeCotizacion(c),
  });

  async function versionConEnvios(tx: TxOrganizacion, organizacionId: string, v: FilaVersion) {
    const envios = await enviosDeVersiones(tx, [v.id], (ids) => identidad.nombres(organizacionId, ids, tx));
    const nombres = await identidad.nombres(organizacionId, personasDe(v), tx);
    return comoVersion(v, nombres, envios);
  }

  return {

    registrarRutas(app) {
      registrarOperacion(app, "listarCotizaciones", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const filas = await tx.select().from(cotizaciones).orderBy(desc(cotizaciones.creadaEn));
            const ultimas = new Map<string, FilaVersion>();
            const conVersiones = new Set<string>();
            // La vigente es la más reciente sin retirar (ADR-0034).
            for (const v of await versionesDe(tx, filas.map((f) => f.id))) {
              conVersiones.add(v.cotizacionId);
              if (!ultimas.has(v.cotizacionId) && !v.retiradaEn) ultimas.set(v.cotizacionId, v);
            }
            const sinEntregar = await versionesConEnvioSinEntregar(tx, [...ultimas.values()].map((v) => v.id));
            const resumenes = await visitas.resumenes(tx, [...new Set(filas.map((f) => f.visitaId))]);
            return {
              cotizaciones: filas.flatMap((f) => {
                const visita = resumenes.get(f.visitaId);
                const vigente = ultimas.get(f.id);
                return visita
                  ? [
                      {
                        id: f.id,
                        numero: f.numero,
                        visita: { cliente: visita.cliente.nombre, sitio: visita.sitio.nombre, direccion: visita.sitio.direccion, programadaPara: visita.programadaPara },
                        vigente: vigente?.numero ?? null,
                        total: vigente?.total ?? null,
                        envioSinEntregar: vigente ? sinEntregar.has(vigente.id) : false,
                        todasRetiradas: !vigente && conVersiones.has(f.id),
                      },
                    ]
                  : [];
              }),
            };
          }),
      });

      registrarOperacion(app, "visitasParaCotizar", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // Lo que se cotiza es trabajo reciente: levantamientos recibidos en los últimos 90 días.
            const porVisita = await lineasPorVisita(tx, undefined, new Date(Date.now() - DIAS_PARA_COTIZAR * 24 * 60 * 60 * 1000));
            if (porVisita.size === 0) return { visitas: [] };
            const resumenes = await visitas.resumenes(tx, [...porVisita.keys()]);
            const existentes = await tx.select({ visitaId: cotizaciones.visitaId, numero: cotizaciones.numero }).from(cotizaciones).where(inArray(cotizaciones.visitaId, [...porVisita.keys()]));
            return {
              visitas: [...porVisita]
                .flatMap(([visitaId, { lineas, levantamientos: revisados }]) => {
                  const v = resumenes.get(visitaId);
                  return v
                    ? [
                        {
                          visitaId,
                          cliente: v.cliente.nombre,
                          sitio: v.sitio.nombre,
                          programadaPara: v.programadaPara,
                          levantamientosRevisados: revisados,
                          materiales: lineas.length,
                          sinPrecio: lineas.filter((l) => l.precio === null).length,
                          cotizaciones: existentes.filter((e) => e.visitaId === visitaId).map((e) => e.numero),
                        },
                      ]
                    : [];
                })
                .sort((a, b) => b.programadaPara.localeCompare(a.programadaPara)),
            };
          }),
      });

      registrarOperacion(app, "crearCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo: { visitaId }, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const clienteId = await visitas.clienteDe(tx, visitaId);
            if (!clienteId) throw problema("no_encontrado", "La visita no existe");
            const lineas = (await lineasPorVisita(tx, [visitaId])).get(visitaId)?.lineas ?? [];
            if (lineas.length === 0) throw problema("estado_invalido", "La visita no tiene cantidades de levantamientos revisados");
            // El consecutivo se incrementa en esta transacción: nunca se repite ni se reutiliza (ADR-0029, parte 2).
            const anio = anioEnColombia();
            const [{ ultimo } = { ultimo: 0 }] = await tx
              .insert(consecutivos)
              .values({ organizacionId: actor.organizacionId, anio, ultimo: 1 })
              .onConflictDoUpdate({ target: [consecutivos.organizacionId, consecutivos.anio], set: { ultimo: sql`${consecutivos.ultimo} + 1` } })
              .returning({ ultimo: consecutivos.ultimo });
            const id = randomUUID();
            const numero = numeroDeCotizacion(anio, ultimo);
            await tx.insert(cotizaciones).values({ id, organizacionId: actor.organizacionId, numero, visitaId, clienteId, lineas, impuestos: { tipo: "iva" }, condiciones: CONDICIONES_INICIALES, creadaPor: actor.usuarioId });
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "cotizacion", agregadoId: id, tipoEvento: "cotizacion_creada", autorId: actor.usuarioId, correlacion, valorNuevo: { numero, visitaId, lineas: lineas.length } },
            ]);
            return { id };
          }),
      });

      registrarOperacion(app, "obtenerCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const r = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await leer(tx, id);
            const versiones = await versionesDe(tx, [id]);
            return { c, visita: (await visitas.resumenes(tx, [c.visitaId])).get(c.visitaId), versiones, envios: await enviosDeVersiones(tx, versiones.map((v) => v.id), (ids) => identidad.nombres(actor.organizacionId, ids, tx)) };
          });
          if (!r.visita) throw problema("no_encontrado", "La visita de la cotización no existe");
          const nombres = await identidad.nombres(actor.organizacionId, [...new Set(r.versiones.flatMap(personasDe))]);
          return {
            id: r.c.id,
            numero: r.c.numero,
            visitaId: r.c.visitaId,
            clienteId: r.c.clienteId,
            visita: { cliente: r.visita.cliente.nombre, sitio: r.visita.sitio.nombre, direccion: r.visita.sitio.direccion, programadaPara: r.visita.programadaPara },
            version: r.c.version,
            lineas: r.c.lineas,
            impuestos: r.c.impuestos,
            condiciones: r.c.condiciones,
            versiones: r.versiones.map((v) => comoVersion(v, nombres, r.envios)),
          };
        },
      });

      registrarOperacion(app, "guardarCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await leer(tx, id);
            if (c.version !== cuerpo.version) throw problema("conflicto_de_version", "Otra persona guardó esta cotización mientras usted la tenía abierta", { versionActual: c.version });
            if (new Set(cuerpo.lineas.map((l) => l.id)).size !== cuerpo.lineas.length) throw problema("entrada_invalida", "Hay dos líneas con el mismo id");
            const guardada = await tx
              .update(cotizaciones)
              .set({ lineas: cuerpo.lineas, impuestos: cuerpo.impuestos, condiciones: cuerpo.condiciones, version: sql`${cotizaciones.version} + 1` })
              .where(and(eq(cotizaciones.id, id), eq(cotizaciones.version, cuerpo.version)))
              .returning({ version: cotizaciones.version });
            if (guardada.length === 0) throw problema("conflicto_de_version", "Otra persona guardó esta cotización mientras usted la tenía abierta");
            return guardada[0]!;
          }),
      });

      registrarOperacion(app, "publicarCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const organizacion = await identidad.nombreDeOrganizacion(actor.organizacionId);
          const nombres = await identidad.nombres(actor.organizacionId, [actor.usuarioId]);
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await leer(tx, id);
            if (c.version !== cuerpo.version) throw problema("conflicto_de_version", "La cotización cambió desde que la abrió. Recargue antes de publicar", { versionActual: c.version });
            const borrador: BorradorCotizacion = { lineas: c.lineas, impuestos: c.impuestos, condiciones: c.condiciones };
            const errores = validarCotizacion(borrador);
            if (errores.length > 0) throw problema("cotizacion_invalida", "A la cotización le falta algo para publicarse", { erroresCotizacion: errores.map((e) => ({ ...e })) });
            // Nadie publica dos veces desde la misma versión del borrador.
            const reservada = await tx
              .update(cotizaciones)
              .set({ version: sql`${cotizaciones.version} + 1` })
              .where(and(eq(cotizaciones.id, id), eq(cotizaciones.version, cuerpo.version)))
              .returning({ version: cotizaciones.version });
            if (reservada.length === 0) throw problema("conflicto_de_version", "Otra persona publicó o guardó esta cotización al mismo tiempo");

            const publicadaEn = new Date();
            const contenido = await siguienteVersion(tx, c, { organizacion, publicadaPor: nombres.get(actor.usuarioId) ?? SIN_NOMBRE, publicadaEn });
            const versionId = randomUUID();
            const [fila] = await tx
              .insert(versionesCotizacion)
              .values({ id: versionId, organizacionId: actor.organizacionId, cotizacionId: id, numero: contenido.version, contenido, total: contenido.totales.total, publicadaPor: actor.usuarioId, publicadaEn })
              .returning();
            await registrar(tx, [
              {
                organizacionId: actor.organizacionId,
                agregadoTipo: "cotizacion",
                agregadoId: id,
                tipoEvento: "cotizacion_publicada",
                autorId: actor.usuarioId,
                correlacion,
                valorNuevo: { version: contenido.version, total: contenido.totales.total, destinatarios: cuerpo.destinatarios },
              },
            ]);
            await encolar(tx, "cotizaciones.generarPdf", { organizacionId: actor.organizacionId, versionId }, { cola: "pdf", llave: `cotizaciones.generarPdf:${versionId}` });
            await programarEnvios(tx, {
              organizacionId: actor.organizacionId,
              versionId,
              clienteId: c.clienteId,
              mensaje: mensajeDe(contenido),
              destinos: cuerpo.destinatarios.map((contactoId) => ({ contactoId })),
              por: actor.usuarioId,
              personal: cuerpo.mensaje,
            });
            return versionConEnvios(tx, actor.organizacionId, fila!);
          });
        },
      });

      registrarOperacion(app, "pdfDeCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id, numero }, actor }) => {
          const [version] = await enOrganizacion(bd, actor.organizacionId, (tx) =>
            tx
              .select()
              .from(versionesCotizacion)
              .where(and(eq(versionesCotizacion.cotizacionId, id), eq(versionesCotizacion.numero, numero))),
          );
          if (!version) throw problema("no_encontrado");
          if (version.pdfEstado !== "listo" || !version.pdfHuella) throw problema("estado_invalido", "El PDF de esta versión todavía no está listo");
          const firma = await almacenamiento.firmarDescarga(claveDeObjeto(actor.organizacionId, version.pdfHuella), { descargarComo: nombreDelPdfDeCotizacion(version.contenido) });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });

      registrarOperacion(app, "enviarCotizacion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id, numero }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await leer(tx, id);
            const [version] = await tx
              .select()
              .from(versionesCotizacion)
              .where(and(eq(versionesCotizacion.cotizacionId, id), eq(versionesCotizacion.numero, numero)))
              // Bloquea la fila: si el PDF queda listo al mismo tiempo, uno espera al otro y ningún envío queda en cola sin salir.
              .for("update");
            if (!version) throw problema("no_encontrado", "La versión no existe");
            // Retirada, ya no vale: no se vuelve a enviar (ADR-0034).
            if (version.retiradaEn) throw problema("estado_invalido", "La versión está retirada: no se puede enviar");
            // Sin PDF no hay qué adjuntar, y nada lo vuelve a generar: el envío quedaría en cola para siempre.
            if (version.pdfEstado === "fallido") throw problema("estado_invalido", "No se pudo generar el PDF de esta versión: publique una nueva para enviarla");
            const programados = await programarEnvios(tx, {
              organizacionId: actor.organizacionId,
              versionId: version.id,
              clienteId: c.clienteId,
              mensaje: mensajeDe(version.contenido),
              destinos: cuerpo.destinos,
              por: actor.usuarioId,
              personal: cuerpo.mensaje,
              pdfRuta: version.pdfEstado === "listo" && version.pdfHuella ? claveDeObjeto(actor.organizacionId, version.pdfHuella) : undefined,
              llave: cuerpo.llave,
            });
            // Un pedido repetido con su llave no creó nada: no es otro envío que registrar.
            if (programados > 0) {
              await registrar(tx, [
                { organizacionId: actor.organizacionId, agregadoTipo: "cotizacion", agregadoId: id, tipoEvento: "cotizacion_enviada", autorId: actor.usuarioId, correlacion, valorNuevo: { numero, destinos: cuerpo.destinos } },
              ]);
            }
            return versionConEnvios(tx, actor.organizacionId, version);
          }),
      });

      registrarOperacion(app, "retirarVersionDeCotizacion", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id, numero }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await leer(tx, id);
            // Retirar es definitivo: la versión se conserva con su PDF y deja de valer (ADR-0034).
            const [retirada] = await tx
              .update(versionesCotizacion)
              .set({ retiradaEn: new Date(), retiradaPor: actor.usuarioId, motivoRetiro: cuerpo.motivo })
              .where(and(eq(versionesCotizacion.cotizacionId, id), eq(versionesCotizacion.numero, numero), isNull(versionesCotizacion.retiradaEn)))
              .returning();
            if (!retirada) {
              const [existe] = await tx.select({ id: versionesCotizacion.id }).from(versionesCotizacion).where(and(eq(versionesCotizacion.cotizacionId, id), eq(versionesCotizacion.numero, numero)));
              throw existe ? problema("estado_invalido", "La versión ya estaba retirada") : problema("no_encontrado", "La versión no existe");
            }
            // Lo que esperaba en cola ya no sale: la versión dejó de valer.
            await cancelarEnviosDeVersion(tx, retirada.id);
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "cotizacion", agregadoId: id, tipoEvento: "version_retirada", autorId: actor.usuarioId, correlacion, valorNuevo: { numero }, motivo: cuerpo.motivo },
            ]);
            return versionConEnvios(tx, actor.organizacionId, retirada);
          }),
      });

      /** Cancelar o reanudar un envío en cola (ADR-0034), con la versión bloqueada como al enviar. */
      const corregirEnvio = (accion: "cancelar" | "reanudar") =>
        async ({ parametros: { id, numero, envio }, actor, correlacion }: { parametros: { id: string; numero: number; envio: string }; actor: Actor; correlacion: string }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await leer(tx, id);
            const [version] = await tx
              .select()
              .from(versionesCotizacion)
              .where(and(eq(versionesCotizacion.cotizacionId, id), eq(versionesCotizacion.numero, numero)))
              .for("update");
            if (!version) throw problema("no_encontrado", "La versión no existe");
            if (accion === "cancelar") {
              const resultado = await cancelarEnvio(tx, { versionId: version.id, envioId: envio, por: actor.usuarioId });
              if (resultado === "no_existe") throw problema("no_encontrado", "El envío no existe");
              if (resultado === "ya_salio") throw problema("estado_invalido", "El envío ya salió: lo enviado no se recupera");
              if (resultado === "ya_cancelado") throw problema("estado_invalido", "El envío ya estaba cancelado");
            } else {
              if (version.retiradaEn) throw problema("estado_invalido", "La versión está retirada: no se puede reanudar el envío");
              if (version.pdfEstado === "fallido") throw problema("estado_invalido", "No se pudo generar el PDF de esta versión: publique una nueva para enviarla");
              const pdfRuta = version.pdfEstado === "listo" && version.pdfHuella ? claveDeObjeto(actor.organizacionId, version.pdfHuella) : undefined;
              if (!(await reanudarEnvio(tx, { organizacionId: actor.organizacionId, versionId: version.id, envioId: envio, pdfRuta }))) throw problema("estado_invalido", "El envío no estaba cancelado");
            }
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "cotizacion", agregadoId: id, tipoEvento: accion === "cancelar" ? "envio_cancelado" : "envio_reanudado", autorId: actor.usuarioId, correlacion, valorNuevo: { numero, envio } },
            ]);
            return versionConEnvios(tx, actor.organizacionId, version);
          });
      registrarOperacion(app, "cancelarEnvioDeCotizacion", { politica: politicas.oficina, manejar: corregirEnvio("cancelar") });
      registrarOperacion(app, "reanudarEnvioDeCotizacion", { politica: politicas.oficina, manejar: corregirEnvio("reanudar") });
    },
  };
}
