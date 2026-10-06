import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { nombreDelPdfDeInforme, piePagina, plantillaInforme, type HojaDelInforme } from "@teins/documentos";
import type { Respuesta } from "@teins/protocolo";
import { aplicarSeleccion, bocetosReferenciados, esFirma, firmaASvg, fotosReferenciadas, hojaASvg, hojasDe, leerBoceto, validarBorrador, validarParaPublicar, type BorradorInforme, type ContenidoVersion, type ErrorInforme, type LevantamientoParaInforme } from "@teins/dominio";
import type { Config } from "../../config";
import { claveDeObjeto, leerTodo, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion, type TxPortal } from "../../plataforma/base-de-datos";
import { encolar } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import type { Actor } from "../../plataforma/actor";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Archivos } from "../archivos";
import { registrar } from "../auditoria";
import { cancelarEnvio, cancelarEnviosDeVersion, enviarAlQuedarListo, enviosDeVersiones, reanudarEnvio, fallarEnviosDeVersion, programarEnvios, versionesConEnvioSinEntregar, versionesConEnviosAtascados, type MensajeDeInforme } from "../envios";
import type { Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import type { Levantamientos } from "../levantamientos";
import type { Visitas } from "../visitas";
import { fuenteIncrustada, imprimirPdf, PlanoIlegible } from "../../plataforma/pdf";
import { informes, versionesPublicadas, type EstadoPdf } from "./esquema";

interface Dependencias {
  bd: BaseDeDatos;
  almacenamiento: Almacenamiento;
  config: Config;
  archivos: Pick<Archivos, "estados">;
  levantamientos: Pick<Levantamientos, "deVisita">;
  visitas: Pick<Visitas, "existe" | "resumenes" | "clienteDe">;
  identidad: Pick<Identidad, "nombres" | "nombreDeOrganizacion">;
  formatos: Pick<Formatos, "obtener">;
}

export interface VersionVigente {
  informeId: string;
  numero: number;
  publicadaEn: Date;
  visita: ContenidoVersion["visita"];
}

/** La visita tal como quedó congelada en la versión: de la misma fila, sin otra consulta. */
const visitaDeLaVersion = sql<ContenidoVersion["visita"]>`${versionesPublicadas.contenido} -> 'visita'`;

/**
 * Lo que el portal lee, siempre con la transacción del portal: la seguridad por fila ya restringe a
 * lo publicado con PDF listo del cliente de la sesión (ADR-0009, parte 3).
 */
export const informesParaElPortal = {
  /** Por informe, la versión más reciente visible (regla 12). */
  async vigentes(tx: TxPortal): Promise<VersionVigente[]> {
    const filas = await tx
      .selectDistinctOn([versionesPublicadas.informeId], {
        informeId: versionesPublicadas.informeId,
        numero: versionesPublicadas.numero,
        publicadaEn: versionesPublicadas.publicadaEn,
        visita: visitaDeLaVersion,
      })
      .from(versionesPublicadas)
      .orderBy(versionesPublicadas.informeId, desc(versionesPublicadas.numero));
    return filas.sort((a, b) => b.visita.programadaPara.localeCompare(a.visita.programadaPara));
  },
  async pdfVigente(tx: TxPortal, informeId: string): Promise<{ numero: number; huella: string; nombre: string } | undefined> {
    const [fila] = await tx
      .select({ numero: versionesPublicadas.numero, huella: versionesPublicadas.pdfHuella, visita: visitaDeLaVersion })
      .from(versionesPublicadas)
      .where(eq(versionesPublicadas.informeId, informeId))
      .orderBy(desc(versionesPublicadas.numero))
      .limit(1);
    return fila?.huella ? { numero: fila.numero, huella: fila.huella, nombre: nombreDelPdfDeInforme(fila.visita, fila.numero) } : undefined;
  },
};

/** El PDF de una versión, en el worker. */
export interface GeneradorPdf {
  /** Trabajo del worker (cola `pdf`, de a uno). Idempotente: un PDF listo nunca se vuelve a generar (QA-17). */
  generarPdf(datos: { organizacionId: string; versionId: string }, contexto: { ultimoIntento: boolean }): Promise<void>;
}

export interface Informes {
  registrarRutas(app: FastifyInstance): void;
}

const SIN_NOMBRE = "[Usuario no disponible]";

interface FilaVersion {
  numero: number;
  publicadaEn: Date;
  publicadaPor: string;
  pdf: EstadoPdf;
  retiradaEn: Date | null;
  retiradaPor: string | null;
  motivoRetiro: string | null;
}

const comoVersion = (v: FilaVersion, nombres: Map<string, string>, envios: Respuesta<"obtenerInforme">["versiones"][number]["envios"] = []) => ({
  numero: v.numero,
  publicadaEn: v.publicadaEn.toISOString(),
  publicadaPor: { id: v.publicadaPor, nombre: nombres.get(v.publicadaPor) ?? SIN_NOMBRE },
  pdf: v.pdf,
  retirada: v.retiradaEn
    ? { en: v.retiradaEn.toISOString(), por: { id: v.retiradaPor ?? "", nombre: nombres.get(v.retiradaPor ?? "") ?? SIN_NOMBRE }, motivo: v.motivoRetiro ?? "" }
    : null,
  envios,
});

/** Lo que dice el correo o el WhatsApp, de la copia congelada de la versión (ADR-0028). */
const mensajeDe = (c: ContenidoVersion): MensajeDeInforme => ({
  organizacion: c.organizacion.nombre,
  cliente: c.visita.cliente,
  sitio: c.visita.sitio,
  motivo: c.visita.motivo,
  programadaPara: c.visita.programadaPara,
  numero: c.numero,
  nombreArchivo: nombreDelPdfDeInforme(c.visita, c.numero),
});

const invalido = (errores: ErrorInforme[]) => problema("informe_invalido", "El informe no cumple sus reglas", { erroresInforme: errores.map((e) => ({ ...e })) });

/** Lo único que necesita el worker: generar el PDF de una versión desde su copia congelada. */
export function crearGeneradorPdf({ bd, almacenamiento, config }: Pick<Dependencias, "bd" | "almacenamiento" | "config">): GeneradorPdf {
  return {
    async generarPdf({ organizacionId, versionId }, { ultimoIntento }) {
      const [version] = await enOrganizacion(bd, organizacionId, (tx) => tx.select().from(versionesPublicadas).where(eq(versionesPublicadas.id, versionId)));
      if (!version || version.pdfEstado === "listo") return;
      const c = version.contenido;
      try {
        // Fotos incrustadas: el documento no depende de URL que vencen. Se descargan a la vez; el cliente
        // de S3 limita cuántas conexiones abre.
        const huellas = [...new Set(c.levantamientos.flatMap((l) => fotosReferenciadas(l.respuestas)))];
        const fotos = new Map(
          await Promise.all(huellas.map(async (h) => [h, `data:image/jpeg;base64,${(await leerTodo(almacenamiento, claveDeObjeto(organizacionId, h))).toString("base64")}`] as const)),
        );
        // Bocetos (ADR-0019): cada hoja del documento vectorial se convierte a SVG (ADR-0026).
        // Las firmas usan el mismo documento, sin cuadrícula y recortadas a sus trazos (ADR-0024).
        const valores = c.levantamientos.flatMap((l) => Object.values(l.respuestas).flatMap((seccion) => Object.values(seccion)));
        const deFirmas = new Set(valores.flatMap((valor) => (esFirma(valor) ? [valor.firma] : [])));
        const bocetos = new Map<string, HojaDelInforme[]>();
        const firmas = new Map<string, string>();
        for (const h of [...new Set(c.levantamientos.flatMap((l) => bocetosReferenciados(l.respuestas)))]) {
          const documento = leerBoceto((await leerTodo(almacenamiento, claveDeObjeto(organizacionId, h))).toString("utf8"));
          if (documento && deFirmas.has(h)) firmas.set(h, firmaASvg(documento));
          else if (documento) bocetos.set(h, hojasDe(documento).map((hoja) => ({ nombre: hoja.nombre, vertical: hoja.alto > hoja.ancho, svg: hojaASvg(hoja) })));
        }
        const planos = [];
        for (const p of c.planos) planos.push(await leerTodo(almacenamiento, claveDeObjeto(organizacionId, p.huella)));

        const pdf = await imprimirPdf({
          html: plantillaInforme(c, { salida: { tipo: "pdf", fuente: fuenteIncrustada() }, fotos, bocetos, firmas }),
          pie: piePagina(c),
          planos,
          metadatos: { titulo: `Informe técnico · ${c.visita.cliente} · versión ${c.numero}`, autor: c.organizacion.nombre, fecha: new Date(c.publicadaEn) },
          chromiumRuta: config.CHROMIUM_RUTA,
        });
        const huella = createHash("sha256").update(pdf).digest("hex");
        await almacenamiento.guardar(claveDeObjeto(organizacionId, huella), pdf, "application/pdf");
        await enOrganizacion(bd, organizacionId, async (tx) => {
          const listo = await tx
            .update(versionesPublicadas)
            .set({ pdfEstado: "listo", pdfHuella: huella, pdfGeneradoEn: new Date(), pdfError: null })
            .where(and(eq(versionesPublicadas.id, versionId), sql`${versionesPublicadas.pdfEstado} <> 'listo'`))
            .returning({ id: versionesPublicadas.id });
          // Los envíos al cliente salen ahora, no al publicar: antes no hay PDF que adjuntar (ADR-0028, parte 3).
          if (listo.length > 0) await enviarAlQuedarListo(tx, { organizacionId, versionId, pdfRuta: claveDeObjeto(organizacionId, huella) });
        });
      } catch (error) {
        const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        // Un plano ilegible no se arregla reintentando. Con reintentos pendientes sigue "generando";
        // al agotarlos, queda "fallido" y los envíos en cola se dan por no llegados, con aviso.
        const definitivo = ultimoIntento || error instanceof PlanoIlegible;
        await enOrganizacion(bd, organizacionId, async (tx) => {
          // Otra pasada, o esta misma sin saberlo, pudo dejarlo listo: un PDF listo no cambia (QA-17).
          const fallada = await tx
            .update(versionesPublicadas)
            .set({ pdfError: mensaje, ...(definitivo ? { pdfEstado: "fallido" as EstadoPdf } : {}) })
            .where(and(eq(versionesPublicadas.id, versionId), sql`${versionesPublicadas.pdfEstado} <> 'listo'`))
            .returning({ id: versionesPublicadas.id });
          if (definitivo && fallada.length > 0) await fallarEnviosDeVersion(tx, versionId);
        });
        if (!definitivo) throw error;
      }
    },

  };
}

/** Interfaz pública del módulo de informes (soporte, capas simples). */
export function crearInformes({ bd, almacenamiento, config, archivos, levantamientos, visitas, identidad, formatos }: Dependencias): Informes {
  async function leerInforme(tx: TxOrganizacion, id: string) {
    const [fila] = await tx.select().from(informes).where(eq(informes.id, id));
    if (!fila) throw problema("no_encontrado");
    return fila;
  }

  async function candidatosDe(tx: TxOrganizacion, visitaId: string) {
    const lista = await levantamientos.deVisita(tx, visitaId);
    const mapa = new Map<string, LevantamientoParaInforme>(lista.map((l) => [l.id, { id: l.id, visitaId: l.visitaId, estado: l.estado }]));
    return { lista, mapa };
  }

  async function versionesDe(tx: TxOrganizacion, informeId: string) {
    return tx
      .select({
        id: versionesPublicadas.id,
        numero: versionesPublicadas.numero,
        publicadaEn: versionesPublicadas.publicadaEn,
        publicadaPor: versionesPublicadas.publicadaPor,
        pdf: versionesPublicadas.pdfEstado,
        pdfHuella: versionesPublicadas.pdfHuella,
        retiradaEn: versionesPublicadas.retiradaEn,
        retiradaPor: versionesPublicadas.retiradaPor,
        motivoRetiro: versionesPublicadas.motivoRetiro,
      })
      .from(versionesPublicadas)
      .where(eq(versionesPublicadas.informeId, informeId))
      .orderBy(desc(versionesPublicadas.numero));
  }

  return {

    registrarRutas(app) {
      registrarOperacion(app, "listarInformes", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const filas = await tx.select({ id: informes.id, visitaId: informes.visitaId }).from(informes);
            // La versión vigente es la de mayor número sin retirar (regla 10), como en el detalle del informe.
            // El portal muestra la de mayor número con el PDF listo: mientras el de la vigente se genera, o si
            // falló, el cliente sigue viendo la anterior.
            const publicadas = await tx
              .select({ id: versionesPublicadas.id, informeId: versionesPublicadas.informeId, numero: versionesPublicadas.numero, pdf: versionesPublicadas.pdfEstado })
              .from(versionesPublicadas)
              .where(isNull(versionesPublicadas.retiradaEn))
              .orderBy(desc(versionesPublicadas.numero));
            const vigentes = new Map<string, { id: string; numero: number; pdf: EstadoPdf }>();
            for (const v of publicadas) if (!vigentes.has(v.informeId)) vigentes.set(v.informeId, v);
            const sinEntregar = await versionesConEnvioSinEntregar(tx, [...vigentes.values()].map((v) => v.id));
            const resumenes = await visitas.resumenes(tx, filas.map((f) => f.visitaId));
            return {
              elementos: filas
                .flatMap((f) => {
                  const v = resumenes.get(f.visitaId);
                  return v
                    ? [
                        {
                          id: f.id,
                          visita: { cliente: v.cliente.nombre, sitio: v.sitio.nombre, direccion: v.sitio.direccion, motivo: v.motivo, programadaPara: v.programadaPara },
                          vigente: vigentes.get(f.id)?.numero ?? null,
                          pdf: vigentes.get(f.id)?.pdf ?? null,
                          envioSinEntregar: sinEntregar.has(vigentes.get(f.id)?.id ?? ""),
                        },
                      ]
                    : [];
                })
                .sort((a, b) => b.visita.programadaPara.localeCompare(a.visita.programadaPara)),
            };
          }),
      });

      registrarOperacion(app, "abrirInformeDeVisita", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo: { visitaId }, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            if (!(await visitas.existe(tx, visitaId))) throw problema("no_encontrado", "La visita no existe");
            // Uno por visita (P26, supuesto): abrir dos veces devuelve el mismo.
            const [creado] = await tx
              .insert(informes)
              .values({ id: randomUUID(), organizacionId: actor.organizacionId, visitaId })
              .onConflictDoNothing()
              .returning({ id: informes.id });
            if (creado) return creado;
            const [existente] = await tx.select({ id: informes.id }).from(informes).where(eq(informes.visitaId, visitaId));
            return existente!;
          }),
      });

      registrarOperacion(app, "obtenerInforme", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const r = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const informe = await leerInforme(tx, id);
            const visita = (await visitas.resumenes(tx, [informe.visitaId])).get(informe.visitaId);
            const { lista } = await candidatosDe(tx, informe.visitaId);
            const nombresDeFormato = new Map<string, string>();
            for (const l of lista) {
              const k = `${l.formato}@${l.versionFormato}`;
              if (!nombresDeFormato.has(k)) nombresDeFormato.set(k, (await formatos.obtener(tx, l.formato, l.versionFormato))?.nombre ?? l.formato);
            }
            const versiones = await versionesDe(tx, id);
            return { informe, visita, lista, nombresDeFormato, versiones, clienteId: await visitas.clienteDe(tx, informe.visitaId), envios: await enviosDeVersiones(tx, versiones.map((v) => v.id), (ids) => identidad.nombres(actor.organizacionId, ids, tx)) };
          });
          if (!r.visita) throw problema("no_encontrado", "La visita del informe no existe");
          const nombres = await identidad.nombres(actor.organizacionId, [
            ...new Set([...r.lista.map((l) => l.tecnicoId), ...r.versiones.flatMap((v) => [v.publicadaPor, ...(v.retiradaPor ? [v.retiradaPor] : [])])]),
          ]);
          return {
            id: r.informe.id,
            visitaId: r.informe.visitaId,
            clienteId: r.clienteId ?? "",
            visita: { cliente: r.visita.cliente.nombre, sitio: r.visita.sitio.nombre, direccion: r.visita.sitio.direccion, motivo: r.visita.motivo, programadaPara: r.visita.programadaPara },
            version: r.informe.version,
            introduccion: r.informe.introduccion,
            conclusiones: r.informe.conclusiones,
            levantamientos: r.informe.levantamientos,
            planos: r.informe.planos,
            seleccion: { ocultos: [...r.informe.seleccion.ocultos], mostrados: [...r.informe.seleccion.mostrados] },
            candidatos: r.lista.map((l) => ({
              id: l.id,
              formato: r.nombresDeFormato.get(`${l.formato}@${l.versionFormato}`) ?? l.formato,
              tecnico: nombres.get(l.tecnicoId) ?? SIN_NOMBRE,
              estado: l.estado,
              recibidoEn: l.recibidoEn.toISOString(),
            })),
            versiones: r.versiones.map((v) => comoVersion(v, nombres, r.envios.get(v.id))),
          };
        },
      });

      registrarOperacion(app, "guardarInforme", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const informe = await leerInforme(tx, id);
            if (informe.version !== cuerpo.version) throw problema("conflicto_de_version", "Otra persona guardó este informe mientras usted lo tenía abierto", { versionActual: informe.version });
            // Una pestaña anterior al ADR-0039 no manda la selección: se conserva la guardada.
            const borrador: BorradorInforme = { introduccion: cuerpo.introduccion, conclusiones: cuerpo.conclusiones, levantamientos: cuerpo.levantamientos, planos: cuerpo.planos, seleccion: cuerpo.seleccion ?? informe.seleccion };
            const errores = validarBorrador(informe.visitaId, borrador, (await candidatosDe(tx, informe.visitaId)).mapa);
            if (errores.length > 0) throw invalido(errores);
            const guardado = await tx
              .update(informes)
              .set({
                ...borrador,
                levantamientos: [...borrador.levantamientos],
                planos: [...borrador.planos],
                seleccion: { ocultos: [...borrador.seleccion.ocultos], mostrados: [...borrador.seleccion.mostrados] },
                version: sql`${informes.version} + 1`,
              })
              .where(and(eq(informes.id, id), eq(informes.version, cuerpo.version)))
              .returning({ version: informes.version });
            if (guardado.length === 0) throw problema("conflicto_de_version", "Otra persona guardó este informe mientras usted lo tenía abierto");
            return guardado[0]!;
          }),
      });

      registrarOperacion(app, "publicarInforme", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const organizacion = await identidad.nombreDeOrganizacion(actor.organizacionId);
          const publicada = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const informe = await leerInforme(tx, id);
            if (informe.version !== cuerpo.version) throw problema("conflicto_de_version", "El informe cambió desde que lo abrió. Recargue antes de publicar", { versionActual: informe.version });
            const { lista, mapa } = await candidatosDe(tx, informe.visitaId);
            const errores = validarParaPublicar(informe.visitaId, informe, mapa);
            if (errores.length > 0) throw invalido(errores);

            // Los planos deben estar verificados (ADR-0007): un PDF a medio subir nunca entra en una versión.
            const estados = await archivos.estados(tx, informe.planos.map((p) => p.huella));
            const faltantes = informe.planos.map((p) => p.huella).filter((h) => !["subido", "verificado"].includes(estados.get(h)?.estado ?? ""));
            if (faltantes.length > 0) throw problema("archivos_faltantes", "Hay planos que no terminaron de subir", { faltantes });
            // Un plano es un PDF: una foto o un boceto con su huella no se puede anexar (ADR-0013).
            const deOtroTipo = informe.planos.filter((p) => estados.get(p.huella)?.tipo !== "application/pdf");
            if (deOtroTipo.length > 0) throw invalido(deOtroTipo.map((p) => ({ codigo: "plano_invalido", huella: p.huella })));
            const pendientes = informe.planos.map((p) => p.huella).filter((h) => estados.get(h)?.estado === "subido");
            if (pendientes.length > 0) throw problema("archivos_en_verificacion", "El servidor está verificando los planos", { pendientes, reintentarEnSegundos: 5 });

            // Nadie publica dos veces desde la misma versión del borrador.
            const reservado = await tx
              .update(informes)
              .set({ version: sql`${informes.version} + 1` })
              .where(and(eq(informes.id, id), eq(informes.version, cuerpo.version)))
              .returning({ version: informes.version });
            if (reservado.length === 0) throw problema("conflicto_de_version", "Otra persona publicó o guardó este informe al mismo tiempo");

            const visita = (await visitas.resumenes(tx, [informe.visitaId])).get(informe.visitaId);
            if (!visita) throw problema("no_encontrado", "La visita del informe no existe");
            const incluidos = informe.levantamientos.map((lid) => lista.find((l) => l.id === lid)!);
            const nombres = await identidad.nombres(actor.organizacionId, [...new Set([actor.usuarioId, ...incluidos.flatMap((l) => [l.tecnicoId, l.revisorId ?? ""])])], tx);
            const [{ numero } = { numero: 0 }] = await tx
              .select({ numero: sql<number>`coalesce(max(${versionesPublicadas.numero}), 0)` })
              .from(versionesPublicadas)
              .where(eq(versionesPublicadas.informeId, id));
            const publicadaEn = new Date();

            // Copia congelada: el PDF y el portal leen solo esto, nunca datos vivos (modelo de dominio, sección 5).
            const contenido: ContenidoVersion = {
              formatoContenido: 1,
              numero: numero + 1,
              publicadaEn: publicadaEn.toISOString(),
              publicadaPor: nombres.get(actor.usuarioId) ?? SIN_NOMBRE,
              organizacion: { nombre: organizacion },
              visita: { cliente: visita.cliente.nombre, sitio: visita.sitio.nombre, direccion: visita.sitio.direccion, motivo: visita.motivo, programadaPara: visita.programadaPara },
              introduccion: informe.introduccion,
              conclusiones: informe.conclusiones,
              levantamientos: [],
              planos: informe.planos,
            };
            for (const l of incluidos) {
              const formato = await formatos.obtener(tx, l.formato, l.versionFormato);
              if (!formato) throw problema("error_interno", "El formato de un levantamiento no existe");
              // Lo que oficina dejó fuera no entra en la copia (ADR-0039, regla 18): tampoco sus fotos en el PDF.
              contenido.levantamientos.push(
                aplicarSeleccion(
                  {
                    id: l.id,
                    formato,
                    tecnico: nombres.get(l.tecnicoId) ?? SIN_NOMBRE,
                    revisor: nombres.get(l.revisorId ?? "") ?? SIN_NOMBRE,
                    recibidoEn: l.recibidoEn.toISOString(),
                    respuestas: l.respuestas,
                    ...(Object.keys(l.repeticiones).length > 0 ? { repeticiones: l.repeticiones } : {}),
                  },
                  informe.seleccion,
                ),
              );
            }

            const versionId = randomUUID();
            const clienteId = await visitas.clienteDe(tx, informe.visitaId);
            await tx.insert(versionesPublicadas).values({ id: versionId, organizacionId: actor.organizacionId, informeId: id, clienteId, numero: contenido.numero, contenido, publicadaPor: actor.usuarioId, publicadaEn });
            await registrar(tx, [
              {
                organizacionId: actor.organizacionId,
                agregadoTipo: "informe",
                agregadoId: id,
                tipoEvento: "informe_publicado",
                autorId: actor.usuarioId,
                correlacion,
                valorNuevo: { numero: contenido.numero, levantamientos: informe.levantamientos, planos: informe.planos.map((p) => p.huella), destinatarios: cuerpo.destinatarios },
              },
            ]);
            // Quedan "En cola" y salen cuando el PDF esté listo (ADR-0028, parte 3).
            await programarEnvios(tx, {
              organizacionId: actor.organizacionId,
              versionId,
              clienteId,
              mensaje: mensajeDe(contenido),
              destinos: cuerpo.destinatarios.map((contactoId) => ({ contactoId })),
              por: actor.usuarioId,
              personal: cuerpo.mensaje,
            });
            // El PDF se genera en segundo plano, de a uno (ADR-0012); si la transacción se revierte, el trabajo no existe.
            await encolar(tx, "informes.generarPdf", { organizacionId: actor.organizacionId, versionId }, { cola: "pdf", llave: `informes.generarPdf:${versionId}` });
            return { numero: contenido.numero, publicadaEn, publicadaPor: contenido.publicadaPor };
          });
          return {
            numero: publicada.numero,
            publicadaEn: publicada.publicadaEn.toISOString(),
            publicadaPor: { id: actor.usuarioId, nombre: publicada.publicadaPor },
            pdf: "generando" as const,
          };
        },
      });

      registrarOperacion(app, "retirarVersion", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id, numero }, cuerpo, actor, correlacion }) => {
          const version = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await leerInforme(tx, id);
            const [existe] = await tx
              .select({ retiradaEn: versionesPublicadas.retiradaEn })
              .from(versionesPublicadas)
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero)));
            if (!existe) throw problema("no_encontrado", "La versión no existe");
            // Retirar es definitivo: para volver a entregar se publica una versión nueva (regla 10).
            if (existe.retiradaEn) throw problema("estado_invalido", "La versión ya estaba retirada");
            const [retiro] = await tx
              .update(versionesPublicadas)
              .set({ retiradaEn: new Date(), retiradaPor: actor.usuarioId, motivoRetiro: cuerpo.motivo })
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero), isNull(versionesPublicadas.retiradaEn)))
              .returning({ id: versionesPublicadas.id });
            // Otra persona la retiró al mismo tiempo: un solo evento en la auditoría.
            if (!retiro) throw problema("estado_invalido", "La versión ya estaba retirada");
            await cancelarEnviosDeVersion(tx, retiro.id);
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "informe", agregadoId: id, tipoEvento: "version_retirada", autorId: actor.usuarioId, correlacion, valorNuevo: { numero }, motivo: cuerpo.motivo },
            ]);
            const retirada = (await versionesDe(tx, id)).find((v) => v.numero === numero)!;
            return { ...retirada, envios: (await enviosDeVersiones(tx, [retirada.id], (ids) => identidad.nombres(actor.organizacionId, ids, tx))).get(retirada.id) };
          });
          const nombres = await identidad.nombres(actor.organizacionId, [version.publicadaPor, actor.usuarioId]);
          return comoVersion(version, nombres, version.envios);
        },
      });

      registrarOperacion(app, "enviarVersion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id, numero }, cuerpo, actor, correlacion }) => {
          const version = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [fila] = await tx
              .select()
              .from(versionesPublicadas)
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero)))
              // Bloquea la fila: si el PDF queda listo al mismo tiempo, uno espera al otro y ningún envío queda en cola sin salir.
              .for("update");
            if (!fila) throw problema("no_encontrado", "La versión no existe");
            // Lo retirado no se vuelve a entregar (regla 10): para eso se publica una versión nueva.
            if (fila.retiradaEn) throw problema("estado_invalido", "La versión está retirada del portal: publique una nueva para enviarla");
            // Sin PDF no hay qué adjuntar, y nada lo vuelve a generar: el envío quedaría en cola para siempre.
            if (fila.pdfEstado === "fallido") throw problema("estado_invalido", "No se pudo generar el PDF de esta versión: publique una nueva para enviarla");
            const programados = await programarEnvios(tx, {
              organizacionId: actor.organizacionId,
              versionId: fila.id,
              clienteId: fila.clienteId,
              mensaje: mensajeDe(fila.contenido),
              destinos: cuerpo.destinos,
              por: actor.usuarioId,
              personal: cuerpo.mensaje,
              pdfRuta: fila.pdfEstado === "listo" && fila.pdfHuella ? claveDeObjeto(actor.organizacionId, fila.pdfHuella) : undefined,
              llave: cuerpo.llave,
            });
            // Un pedido repetido con su llave no creó nada: no es otro envío que registrar.
            if (programados > 0) {
              await registrar(tx, [
                { organizacionId: actor.organizacionId, agregadoTipo: "informe", agregadoId: id, tipoEvento: "informe_enviado", autorId: actor.usuarioId, correlacion, valorNuevo: { numero, destinos: cuerpo.destinos } },
              ]);
            }
            const actual = (await versionesDe(tx, id)).find((v) => v.numero === numero)!;
            return { ...actual, envios: (await enviosDeVersiones(tx, [actual.id], (ids) => identidad.nombres(actor.organizacionId, ids, tx))).get(actual.id) };
          });
          const nombres = await identidad.nombres(actor.organizacionId, [version.publicadaPor, ...(version.retiradaPor ? [version.retiradaPor] : [])]);
          return comoVersion(version, nombres, version.envios);
        },
      });

      /**
       * Cancelar o reanudar un envío en cola (ADR-0034). La versión queda bloqueada, como al enviar: si el PDF queda
       * listo al mismo tiempo, uno espera al otro y lo reanudado sale con él.
       */
      const corregirEnvio = (accion: "cancelar" | "reanudar") =>
        async ({ parametros: { id, numero, envio }, actor, correlacion }: { parametros: { id: string; numero: number; envio: string }; actor: Actor; correlacion: string }) => {
          const version = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [fila] = await tx
              .select()
              .from(versionesPublicadas)
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero)))
              .for("update");
            if (!fila) throw problema("no_encontrado", "La versión no existe");
            if (accion === "cancelar") {
              const resultado = await cancelarEnvio(tx, { versionId: fila.id, envioId: envio, por: actor.usuarioId });
              if (resultado === "no_existe") throw problema("no_encontrado", "El envío no existe");
              if (resultado === "ya_salio") throw problema("estado_invalido", "El envío ya salió: lo enviado no se recupera");
              if (resultado === "ya_cancelado") throw problema("estado_invalido", "El envío ya estaba cancelado");
            } else {
              // Lo retirado no se vuelve a entregar (regla 10), y sin PDF no hay qué adjuntar.
              if (fila.retiradaEn) throw problema("estado_invalido", "La versión está retirada del portal: no se puede reanudar el envío");
              if (fila.pdfEstado === "fallido") throw problema("estado_invalido", "No se pudo generar el PDF de esta versión: publique una nueva para enviarla");
              const pdfRuta = fila.pdfEstado === "listo" && fila.pdfHuella ? claveDeObjeto(actor.organizacionId, fila.pdfHuella) : undefined;
              if (!(await reanudarEnvio(tx, { organizacionId: actor.organizacionId, versionId: fila.id, envioId: envio, pdfRuta }))) throw problema("estado_invalido", "El envío no estaba cancelado");
            }
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "informe", agregadoId: id, tipoEvento: accion === "cancelar" ? "envio_cancelado" : "envio_reanudado", autorId: actor.usuarioId, correlacion, valorNuevo: { numero, envio } },
            ]);
            const actual = (await versionesDe(tx, id)).find((v) => v.numero === numero)!;
            return { ...actual, envios: (await enviosDeVersiones(tx, [actual.id], (ids) => identidad.nombres(actor.organizacionId, ids, tx))).get(actual.id) };
          });
          const nombres = await identidad.nombres(actor.organizacionId, [version.publicadaPor, ...(version.retiradaPor ? [version.retiradaPor] : [])]);
          return comoVersion(version, nombres, version.envios);
        };
      registrarOperacion(app, "cancelarEnvio", { politica: politicas.oficina, manejar: corregirEnvio("cancelar") });
      registrarOperacion(app, "reanudarEnvio", { politica: politicas.oficina, manejar: corregirEnvio("reanudar") });

      registrarOperacion(app, "pdfDeVersion", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id, numero }, actor }) => {
          const [version] = await enOrganizacion(bd, actor.organizacionId, (tx) =>
            tx
              .select({ estado: versionesPublicadas.pdfEstado, huella: versionesPublicadas.pdfHuella, visita: visitaDeLaVersion })
              .from(versionesPublicadas)
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero))),
          );
          if (!version) throw problema("no_encontrado");
          if (version.estado !== "listo" || !version.huella) throw problema("estado_invalido", "El PDF de esta versión todavía no está listo");
          // Se descarga, no se abre: la aplicación de oficina no pierde la pantalla.
          const firma = await almacenamiento.firmarDescarga(claveDeObjeto(actor.organizacionId, version.huella), { descargarComo: nombreDelPdfDeInforme(version.visita, numero) });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });
    },
  };
}

/**
 * Lo que quedó a medias hace más de `antesDe` (ADR-0043) vuelve a la cola con la misma llave: el PDF que sigue
 * «generando» y, si ya está listo, los envíos que siguen «en cola». Lo retirado no se recupera.
 */
export async function recuperarInformesAtascados(tx: TxOrganizacion, organizacionId: string, antesDe: Date): Promise<number> {
  const generando = await tx
    .select({ id: versionesPublicadas.id })
    .from(versionesPublicadas)
    .where(and(eq(versionesPublicadas.pdfEstado, "generando"), lt(versionesPublicadas.publicadaEn, antesDe), isNull(versionesPublicadas.retiradaEn)));
  for (const { id } of generando) await encolar(tx, "informes.generarPdf", { organizacionId, versionId: id }, { cola: "pdf", llave: `informes.generarPdf:${id}` });
  const conEnvios = await versionesConEnviosAtascados(tx, antesDe);
  const listas = conEnvios.length
    ? await tx
        .select({ id: versionesPublicadas.id, huella: versionesPublicadas.pdfHuella })
        .from(versionesPublicadas)
        .where(and(inArray(versionesPublicadas.id, conEnvios), eq(versionesPublicadas.pdfEstado, "listo"), isNull(versionesPublicadas.retiradaEn)))
    : [];
  for (const { id, huella } of listas) if (huella) await enviarAlQuedarListo(tx, { organizacionId, versionId: id, pdfRuta: claveDeObjeto(organizacionId, huella) });
  return generando.length + listas.length;
}
