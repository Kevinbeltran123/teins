import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { bocetoASvg, bocetosReferenciados, esFirma, firmaASvg, fotosReferenciadas, leerBoceto, validarBorrador, validarParaPublicar, type BorradorInforme, type ContenidoVersion, type ErrorInforme, type LevantamientoParaInforme } from "@teins/dominio";
import type { Config } from "../../config";
import type { Almacenamiento } from "../../plataforma/almacenamiento";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion, type TxPortal } from "../../plataforma/base-de-datos";
import { encolar } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Archivos } from "../archivos";
import { registrar } from "../auditoria";
import type { Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import type { Levantamientos } from "../levantamientos";
import type { Visitas } from "../visitas";
import { imprimirInforme } from "./pdf/imprimir";
import { piePagina, plantillaInforme } from "./pdf/plantilla";
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
 * Nombre con que se guarda el PDF al descargarlo: quien lo recibe lo encuentra después en su carpeta de
 * descargas por el cliente, el sitio y la versión. Sin los caracteres que un sistema de archivos no admite.
 */
const nombreDelPdf = (visita: { cliente: string; sitio: string }, numero: number) =>
  `Informe ${visita.cliente} - ${visita.sitio} - versión ${numero}.pdf`.replace(/[/\\:*?"<>|]/g, "-");

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
    return fila?.huella ? { numero: fila.numero, huella: fila.huella, nombre: nombreDelPdf(fila.visita, fila.numero) } : undefined;
  },
};

export interface Informes {
  /** Trabajo del worker (cola `pdf`, de a uno). Idempotente: un PDF listo nunca se vuelve a generar (QA-17). */
  generarPdf(datos: { organizacionId: string; versionId: string }, contexto: { ultimoIntento: boolean }): Promise<void>;
  registrarRutas(app: FastifyInstance): void;
}

/** Objetos por contenido, como las fotos (ADR-0007). */
const clave = (organizacionId: string, huella: string) => `${organizacionId}/${huella}`;
const SIN_NOMBRE = "[Usuario no disponible]";

const requerir = createRequire(import.meta.url);
let fuente: string | undefined;
/** La misma familia de la interfaz, incrustada: el PDF no depende de las fuentes del servidor (ADR-0013). */
const fuenteIncrustada = () =>
  (fuente ??= readFileSync(requerir.resolve("@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2")).toString("base64"));

async function leerTodo(almacenamiento: Almacenamiento, ruta: string): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const trozo of await almacenamiento.leer(ruta)) partes.push(trozo as Buffer);
  return Buffer.concat(partes);
}

interface FilaVersion {
  numero: number;
  publicadaEn: Date;
  publicadaPor: string;
  pdf: EstadoPdf;
  retiradaEn: Date | null;
  retiradaPor: string | null;
  motivoRetiro: string | null;
}

const comoVersion = (v: FilaVersion, nombres: Map<string, string>) => ({
  numero: v.numero,
  publicadaEn: v.publicadaEn.toISOString(),
  publicadaPor: { id: v.publicadaPor, nombre: nombres.get(v.publicadaPor) ?? SIN_NOMBRE },
  pdf: v.pdf,
  retirada: v.retiradaEn
    ? { en: v.retiradaEn.toISOString(), por: { id: v.retiradaPor ?? "", nombre: nombres.get(v.retiradaPor ?? "") ?? SIN_NOMBRE }, motivo: v.motivoRetiro ?? "" }
    : null,
});

const invalido = (errores: ErrorInforme[]) => problema("informe_invalido", "El informe no cumple sus reglas", { erroresInforme: errores.map((e) => ({ ...e })) });

/** Lo único que necesita el worker: generar el PDF de una versión desde su copia congelada. */
export function crearGeneradorPdf({ bd, almacenamiento, config }: Pick<Dependencias, "bd" | "almacenamiento" | "config">): Pick<Informes, "generarPdf"> {
  return {
    async generarPdf({ organizacionId, versionId }, { ultimoIntento }) {
      const [version] = await enOrganizacion(bd, organizacionId, (tx) => tx.select().from(versionesPublicadas).where(eq(versionesPublicadas.id, versionId)));
      if (!version || version.pdfEstado === "listo") return;
      const c = version.contenido;
      try {
        // Fotos incrustadas: el documento no depende de URL que vencen.
        const huellas = [...new Set(c.levantamientos.flatMap((l) => fotosReferenciadas(l.respuestas)))];
        const fotos = new Map<string, string>();
        for (const h of huellas) fotos.set(h, `data:image/jpeg;base64,${(await leerTodo(almacenamiento, clave(organizacionId, h))).toString("base64")}`);
        // Bocetos (ADR-0019): el documento vectorial se convierte a SVG con los colores de la marca.
        // Las firmas usan el mismo documento, sin cuadrícula y recortadas a sus trazos (ADR-0024).
        const valores = c.levantamientos.flatMap((l) => Object.values(l.respuestas).flatMap((seccion) => Object.values(seccion)));
        const deFirmas = new Set(valores.flatMap((valor) => (esFirma(valor) ? [valor.firma] : [])));
        const bocetos = new Map<string, string>();
        const firmas = new Map<string, string>();
        for (const h of [...new Set(c.levantamientos.flatMap((l) => bocetosReferenciados(l.respuestas)))]) {
          const documento = leerBoceto((await leerTodo(almacenamiento, clave(organizacionId, h))).toString("utf8"));
          if (documento && deFirmas.has(h)) firmas.set(h, firmaASvg(documento));
          else if (documento) bocetos.set(h, bocetoASvg(documento));
        }
        const planos = [];
        for (const p of c.planos) planos.push(await leerTodo(almacenamiento, clave(organizacionId, p.huella)));

        const pdf = await imprimirInforme({
          html: plantillaInforme(c, { fuente: fuenteIncrustada(), fotos, bocetos, firmas }),
          pie: piePagina(c),
          planos,
          metadatos: { titulo: `Informe técnico · ${c.visita.cliente} · versión ${c.numero}`, autor: c.organizacion.nombre, fecha: new Date(c.publicadaEn) },
          chromiumRuta: config.CHROMIUM_RUTA,
        });
        const huella = createHash("sha256").update(pdf).digest("hex");
        await almacenamiento.guardar(clave(organizacionId, huella), pdf, "application/pdf");
        await enOrganizacion(bd, organizacionId, (tx) =>
          tx
            .update(versionesPublicadas)
            .set({ pdfEstado: "listo", pdfHuella: huella, pdfGeneradoEn: new Date(), pdfError: null })
            .where(and(eq(versionesPublicadas.id, versionId), sql`${versionesPublicadas.pdfEstado} <> 'listo'`)),
        );
      } catch (error) {
        const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        // Con reintentos pendientes sigue "generando"; al agotarlos, el fallo queda a la vista de oficina.
        await enOrganizacion(bd, organizacionId, (tx) =>
          tx
            .update(versionesPublicadas)
            .set({ pdfError: mensaje, ...(ultimoIntento ? { pdfEstado: "fallido" as EstadoPdf } : {}) })
            .where(eq(versionesPublicadas.id, versionId)),
        );
        throw error;
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
    generarPdf: crearGeneradorPdf({ bd, almacenamiento, config }).generarPdf,

    registrarRutas(app) {
      registrarOperacion(app, "listarInformes", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const filas = await tx.select({ id: informes.id, visitaId: informes.visitaId }).from(informes);
            // La versión vigente es la de mayor número sin retirar (regla 10): la que ve el cliente.
            const publicadas = await tx
              .select({ informeId: versionesPublicadas.informeId, numero: versionesPublicadas.numero, pdf: versionesPublicadas.pdfEstado })
              .from(versionesPublicadas)
              .where(isNull(versionesPublicadas.retiradaEn))
              .orderBy(desc(versionesPublicadas.numero));
            const vigentes = new Map<string, { numero: number; pdf: EstadoPdf }>();
            for (const v of publicadas) if (!vigentes.has(v.informeId)) vigentes.set(v.informeId, v);
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
            return { informe, visita, lista, nombresDeFormato, versiones: await versionesDe(tx, id) };
          });
          if (!r.visita) throw problema("no_encontrado", "La visita del informe no existe");
          const nombres = await identidad.nombres(actor.organizacionId, [
            ...new Set([...r.lista.map((l) => l.tecnicoId), ...r.versiones.flatMap((v) => [v.publicadaPor, ...(v.retiradaPor ? [v.retiradaPor] : [])])]),
          ]);
          return {
            id: r.informe.id,
            visitaId: r.informe.visitaId,
            visita: { cliente: r.visita.cliente.nombre, sitio: r.visita.sitio.nombre, direccion: r.visita.sitio.direccion, motivo: r.visita.motivo, programadaPara: r.visita.programadaPara },
            version: r.informe.version,
            introduccion: r.informe.introduccion,
            conclusiones: r.informe.conclusiones,
            levantamientos: r.informe.levantamientos,
            planos: r.informe.planos,
            candidatos: r.lista.map((l) => ({
              id: l.id,
              formato: r.nombresDeFormato.get(`${l.formato}@${l.versionFormato}`) ?? l.formato,
              tecnico: nombres.get(l.tecnicoId) ?? SIN_NOMBRE,
              estado: l.estado,
              recibidoEn: l.recibidoEn.toISOString(),
            })),
            versiones: r.versiones.map((v) => comoVersion(v, nombres)),
          };
        },
      });

      registrarOperacion(app, "guardarInforme", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const informe = await leerInforme(tx, id);
            if (informe.version !== cuerpo.version) throw problema("conflicto_de_version", "Otra persona guardó este informe mientras usted lo tenía abierto", { versionActual: informe.version });
            const borrador: BorradorInforme = { introduccion: cuerpo.introduccion, conclusiones: cuerpo.conclusiones, levantamientos: cuerpo.levantamientos, planos: cuerpo.planos };
            const errores = validarBorrador(informe.visitaId, borrador, (await candidatosDe(tx, informe.visitaId)).mapa);
            if (errores.length > 0) throw invalido(errores);
            const guardado = await tx
              .update(informes)
              .set({ ...borrador, levantamientos: [...borrador.levantamientos], planos: [...borrador.planos], version: sql`${informes.version} + 1` })
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
            const faltantes = informe.planos.map((p) => p.huella).filter((h) => !["subido", "verificado"].includes(estados.get(h) ?? ""));
            if (faltantes.length > 0) throw problema("archivos_faltantes", "Hay planos que no terminaron de subir", { faltantes });
            const pendientes = informe.planos.map((p) => p.huella).filter((h) => estados.get(h) === "subido");
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
            const nombres = await identidad.nombres(actor.organizacionId, [...new Set([actor.usuarioId, ...incluidos.flatMap((l) => [l.tecnicoId, l.revisorId ?? ""])])]);
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
              contenido.levantamientos.push({
                id: l.id,
                formato,
                tecnico: nombres.get(l.tecnicoId) ?? SIN_NOMBRE,
                revisor: nombres.get(l.revisorId ?? "") ?? SIN_NOMBRE,
                recibidoEn: l.recibidoEn.toISOString(),
                respuestas: l.respuestas,
                ...(Object.keys(l.repeticiones).length > 0 ? { repeticiones: l.repeticiones } : {}),
              });
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
                valorNuevo: { numero: contenido.numero, levantamientos: informe.levantamientos, planos: informe.planos.map((p) => p.huella) },
              },
            ]);
            // El PDF se genera en segundo plano, de a uno (ADR-0012); si la transacción se revierte, el trabajo no existe.
            await encolar(tx, "informes.generarPdf", { organizacionId: actor.organizacionId, versionId }, { cola: "pdf", llave: `informes.generarPdf:${versionId}`, intentosMaximos: 5 });
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
            await tx
              .update(versionesPublicadas)
              .set({ retiradaEn: new Date(), retiradaPor: actor.usuarioId, motivoRetiro: cuerpo.motivo })
              .where(and(eq(versionesPublicadas.informeId, id), eq(versionesPublicadas.numero, numero), isNull(versionesPublicadas.retiradaEn)));
            await registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "informe", agregadoId: id, tipoEvento: "version_retirada", autorId: actor.usuarioId, correlacion, valorNuevo: { numero }, motivo: cuerpo.motivo },
            ]);
            return (await versionesDe(tx, id)).find((v) => v.numero === numero)!;
          });
          const nombres = await identidad.nombres(actor.organizacionId, [version.publicadaPor, actor.usuarioId]);
          return comoVersion(version, nombres);
        },
      });

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
          const firma = await almacenamiento.firmarDescarga(clave(actor.organizacionId, version.huella), { descargarComo: nombreDelPdf(version.visita, numero) });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });
    },
  };
}
