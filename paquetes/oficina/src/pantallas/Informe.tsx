import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { MensajeDeInforme, TextoPropio } from "@teins/documentos";
import { elegir, type ContenidoVersion, type SeleccionInforme } from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  ErrorDeCarga,
  Aviso,
  Boton,
  BotonIcono,
  CampoTextoLargo,
  ChevronLeft,
  Confirmacion,
  Consecuencias,
  Dialogo,
  Download,
  EncabezadoPagina,
  EsqueletoLista,
  Eye,
  FileText,
  Globe,
  History,
  Insignia,
  ListaOrdenable,
  Mail,
  MessageCircle,
  moverEnLista,
  SelectorDeArchivo,
  Send,
  Trash,
  TriangleAlert,
  useConexion,
  useNotificar,
  type AnclaDeHoja,
} from "@teins/ui";
import { cliente, consultas, esSesionVencida } from "../api";
import { useBorrador } from "../borrador";
import { aFechaCorta, aHora, diaConSemana, enLista } from "../formato";
import { mensajeDeAdministracion } from "../administracion";
import { mensajeDeInforme, resumenDelAvance, subirPlano, useGuardarInforme, usePublicarInforme } from "../informes";
import { consultasDeProgramacion } from "../programacion";
import { type Plantillas } from "../documentos";
import { useGuardadoAutomatico } from "../guardado";
import { capituloDe, useRecursosDelInforme } from "../vistaInforme";
import { ClienteArchivado, copiasEnviadas, Destinatarios, PanelEnvios, receptores, useCancelarEnvio } from "./Envios";
import { AvisoDeConflicto, EstadoDeGuardado } from "./Guardado";
import { BotonMostrarVista, CorreoDeContactos, EditorConVista, Lienzo, PestanasDeVista, useVistaPrevia, VistaDeDocumento, type EdicionDeCorreo, type QueSeVe } from "./Lienzo";
import { QueSaleEnElInforme } from "./QueSaleEnElInforme";
import { useAnotarReciente } from "./Paleta";

type Informe = Respuesta<"obtenerInforme">;
type Envio = Informe["versiones"][number]["envios"][number];
interface Borrador {
  introduccion: string;
  conclusiones: string;
  levantamientos: string[];
  planos: { huella: string; nombre: string }[];
  /** Qué sale de cada levantamiento (ADR-0039). */
  seleccion: SeleccionInforme;
}

const ESTADO_LEVANTAMIENTO = { enviado: "Enviado: falta revisarlo", en_revision: "En revisión", revisado: "Revisado" } as const;
/** La que ve el cliente: la más reciente sin retirar (regla 10). */
const vigenteDe = (informe: Informe) => informe.versiones.find((v) => v.retirada === null);
/** Lo que ve el cliente: la más reciente sin retirar con el PDF listo. Mientras el de la vigente se genera, o si falló, es otra. */
const enElPortalDe = (informe: Informe) => informe.versiones.find((v) => v.retirada === null && v.pdf === "listo")?.numero;
/** Qué ve el cliente mientras la vigente no tiene PDF. */
const loQueVeElCliente = (numero: number | undefined) => (numero ? `Mientras, el cliente ve la versión ${numero}` : "Mientras, el cliente no ve ninguna");


const migas = (
  <Link to="/informes" className="migas">
    <ChevronLeft aria-hidden size={16} />
    Informes
  </Link>
);

export function InformeDeVisita({ id }: { id: string }) {
  const consulta = useQuery({
    ...consultas.informe(id),
    // Mientras un PDF se genera o un envío espera, la lista de versiones se vuelve a leer sola (ADR-0013, ADR-0028).
    // Un envío recién aceptado espera la confirmación del proveedor (entrega o rebote): se mira cada 10 s durante 10 minutos.
    refetchInterval: (q) => {
      const versiones = q.state.data?.versiones ?? [];
      if (versiones.some((v) => v.pdf === "generando" || v.envios.some((e) => e.estado === "en_cola"))) return 3_000;
      const hace10Minutos = Date.now() - 10 * 60_000;
      return versiones.some((v) => v.envios.some((e) => e.estado === "enviado" && e.enviadoEn !== null && Date.parse(e.enviadoEn) > hace10Minutos)) ? 10_000 : false;
    },
  });

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Informe" />
        <EsqueletoLista etiqueta="Cargando el informe" />
      </>
    );
  }
  // Solo si nunca cargó: un error al releer (sin red, sesión vencida) deja el borrador donde está.
  if (consulta.data === undefined) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Informe" />
        <ErrorDeCarga texto={noExiste ? "Este informe no existe o no pertenece a su organización." : "No se pudo cargar el informe."} reintentar={noExiste ? undefined : () => void consulta.refetch()} />
      </>
    );
  }
  return <Composicion informe={consulta.data} recargar={() => void consulta.refetch()} />;
}

function Composicion({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const notificar = useNotificar();
  const doc = useBorrador<Borrador>(informe.version, () => ({
    introduccion: informe.introduccion,
    conclusiones: informe.conclusiones,
    levantamientos: [...informe.levantamientos],
    planos: informe.planos.map((p) => ({ huella: p.huella, nombre: p.nombre })),
    seleccion: informe.seleccion,
  }));
  const { borrador, setBorrador } = doc;
  useAnotarReciente({ tipo: "informe", id: informe.id, titulo: `Informe de ${informe.visita.cliente}`, detalle: informe.visita.sitio });
  const [subiendo, setSubiendo] = useState(false);
  const [errorPlano, setErrorPlano] = useState<unknown>(null);
  const [confirmando, setConfirmando] = useState(false);
  // La versión publicada desde esta pantalla: su avance queda arriba del editor hasta salir (iteración 27).
  const [publicadaAqui, setPublicadaAqui] = useState<number | null>(null);
  const [destinatarios, setDestinatarios] = useState<string[] | null>(null);
  const contactos = useQuery(consultasDeProgramacion.cliente(informe.clienteId));
  // Un cliente archivado no recibe envíos (ADR-0035): se publica sin enviar a nadie.
  const elegidos = contactos.data?.archivado ? [] : (destinatarios ?? (contactos.data ? receptores(contactos.data, "informes") : []));
  const guardar = useGuardarInforme(informe.id);
  const enLinea = useConexion();
  // Se guarda solo (prototipos/usabilidad-oficina): sin botón y sin preguntar al salir.
  const auto = useGuardadoAutomatico({
    documento: `informe:${informe.id}`,
    borrador: doc,
    guardar: async (version, b) => (await guardar.mutateAsync({ version, ...b, seleccion: { ocultos: [...b.seleccion.ocultos], mostrados: [...b.seleccion.mostrados] } })).version,
    recargar,
  });
  const publicar = usePublicarInforme(informe.id);
  // El correo de la versión que se va a publicar, escrito sobre la pestaña "Correo" (ADR-0036): null es el de TEINS.
  const [textoCorreo, setTextoCorreo] = useState<TextoPropio | null>(null);
  const edicionCorreo = { propio: textoCorreo, alCambiar: setTextoCorreo };
  const siguiente = (informe.versiones[0]?.numero ?? 0) + 1;
  const nombreDe = (lid: string) => {
    const c = informe.candidatos.find((x) => x.id === lid);
    return c ? `${c.formato} de ${c.tecnico}` : "Un levantamiento";
  };
  // La sesión vencida se resuelve ingresando de nuevo encima (rutas.tsx): su error no queda a la vista después.
  // Lo que no se pudo guardar por las reglas del informe; sin red y el conflicto los dicen el estado y su aviso.
  // Un plano que no subió se dice junto a los planos: aquí tapaba el error de guardado.
  const error = auto.estado === "error" && !esSesionVencida(auto.error) ? auto.error : null;
  // Cuando la persona sigue con los planos (quita, renombra, mueve o sube otro), el error de subida ya no la describe.
  const planosEscritos = borrador.planos.map((p) => `${p.huella}|${p.nombre}`).join("\n");
  useEffect(() => setErrorPlano(null), [planosEscritos]);
  const actualizar = (cambio: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambio }));
  const vigente = vigenteDe(informe);
  const quienesReciben = contactos.data ? contactos.data.contactos.filter((c) => receptores(contactos.data, "informes").includes(c.id)) : [];
  const reciben = quienesReciben.map((c) => c.nombre);

  // La vista en vivo (ADR-0031): la siguiente versión tal como la congelaría el servidor al publicar, desde el borrador.
  const sesion = useQuery(consultas.sesion());
  const organizacion = sesion.data?.organizacion.nombre ?? "[ORGANIZACIÓN]";
  const vistaPrevia = useVistaPrevia();
  const alLado = vistaPrevia.alLado;
  const [vista, setVista] = useState<QueSeVe>("documento");
  const [vistaLateral, setVistaLateral] = useState(false);
  const [ancla, setAncla] = useState<AnclaDeHoja | null>(null);
  const irAParte = (selector: string | undefined) => selector && setAncla((a) => (a?.selector === selector ? a : { selector, vez: (a?.vez ?? 0) + 1 }));
  const detalles = useQueries({ queries: borrador.levantamientos.map((lid) => consultas.levantamiento(lid)) }).flatMap((q) => (q.data ? [q.data] : []));
  const recursos = useRecursosDelInforme(detalles);
  const documentoVista: ContenidoVersion = {
    formatoContenido: 1,
    numero: siguiente,
    publicadaEn: new Date().toISOString(),
    publicadaPor: sesion.data?.usuario.nombre ?? "",
    organizacion: { nombre: organizacion },
    visita: informe.visita,
    introduccion: borrador.introduccion,
    conclusiones: borrador.conclusiones,
    levantamientos: detalles.map(capituloDe),
    planos: borrador.planos,
  };
  const mensajeDeVersion = (p: Plantillas, numero: number): MensajeDeInforme => ({
    organizacion,
    cliente: informe.visita.cliente,
    sitio: informe.visita.sitio,
    motivo: informe.visita.motivo,
    programadaPara: informe.visita.programadaPara,
    numero,
    nombreArchivo: p.nombreDelPdfDeInforme(informe.visita, numero),
  });
  // Los planos no se dibujan (ADR-0031): una ficha por plano, al final, donde el PDF los anexa, con sus páginas o con
  // el aviso de que no se puede anexar (lo cuenta el servidor al verificarlo).
  const estadosDePlanos = new Map(useQueries({ queries: borrador.planos.map((p) => consultas.plano(p.huella)) }).map((q, i) => [borrador.planos[i]!.huella, q.data]));
  const clavePlanos = borrador.planos.map((p) => `${p.nombre}|${estadosDePlanos.get(p.huella)?.estado}|${estadosDePlanos.get(p.huella)?.paginas}`).join("\n");
  const fichasDePlanos = useCallback(
    (doc: Document) => {
      const lista = doc.getElementById("planos");
      for (const plano of borrador.planos) {
        const estado = estadosDePlanos.get(plano.huella);
        const ficha = doc.createElement("div");
        ficha.className = estado?.estado === "ilegible" || estado?.estado === "rechazado" ? "vista-anexo ilegible" : "vista-anexo";
        const marca = doc.createElement("i");
        marca.textContent = "PDF";
        const nombre = doc.createElement("b");
        nombre.textContent = plano.nombre;
        const texto = doc.createElement("span");
        texto.append(nombre, ` · ${fichaDePlano(estado)}`);
        ficha.append(marca, texto);
        lista?.append(ficha);
      }
    },
    [clavePlanos],
  );
  // «Ocultar» y «Mostrar» sobre la hoja (ADR-0039): la hoja entrega el botón tocado con su clave.
  const botonesDeLaHoja = {
    encima: ".vista-ocultable, .fotos figure",
    alTocar: (boton: HTMLElement) => {
      const ocultar = boton.dataset.ocultar !== undefined;
      const clave = ocultar ? boton.dataset.ocultar : boton.dataset.mostrar;
      if (clave) setBorrador((b) => ({ ...b, seleccion: elegir(b.seleccion, clave, ocultar, boton.dataset.omision === "1") }));
    },
  };
  const ilegibles = borrador.planos.filter((p) => ["ilegible", "rechazado"].includes(estadosDePlanos.get(p.huella)?.estado ?? ""));

  async function agregarPlanos(archivos: File[]) {
    setSubiendo(true);
    setErrorPlano(null);
    try {
      for (const archivo of archivos) {
        const plano = await subirPlano(archivo);
        setBorrador((b) => (b.planos.some((p) => p.huella === plano.huella) ? b : { ...b, planos: [...b.planos, plano] }));
      }
    } catch (e) {
      setErrorPlano(e);
    } finally {
      setSubiendo(false);
    }
  }

  async function guardarYPublicar() {
    // Lo que se publica es lo guardado: lo pendiente se guarda ya.
    const guardada = await auto.guardarAhora();
    await publicar.mutateAsync({ version: guardada, destinatarios: elegidos, mensaje: textoCorreo ?? undefined });
    setTextoCorreo(null);
  }

  const incluidos = borrador.levantamientos.map((lid) => informe.candidatos.find((c) => c.id === lid)).filter((c): c is Informe["candidatos"][number] => Boolean(c));
  const fuera = informe.candidatos.filter((c) => !borrador.levantamientos.includes(c.id));

  function capitulo(c: Informe["candidatos"][number], pos: number, asa: ReactNode = <span className="asa vacia" aria-hidden />) {
    const dentro = pos >= 0;
    const revisado = c.estado === "revisado";
    const detalle = dentro ? detalles.find((d) => d.id === c.id) : undefined;
    return (
      <div key={c.id}>
        <div className="capitulo-cab">
        {asa}
        <label className={`capitulo ${dentro ? "" : "fuera"}`}>
          <input
            type="checkbox"
            checked={dentro}
            disabled={!revisado && !dentro}
            onChange={(e) => actualizar({ levantamientos: e.target.checked ? [...borrador.levantamientos, c.id] : borrador.levantamientos.filter((x) => x !== c.id) })}
          />
          <span className="n">{dentro ? `2.${pos + 1}` : ""}</span>
          <span className="txt">
            <b>{c.formato}</b> de {c.tecnico}
            <small>
              recibido {aFechaCorta(c.recibidoEn)} · {ESTADO_LEVANTAMIENTO[c.estado]}
            </small>
          </span>
          {!dentro && !revisado && <Insignia tono={c.estado === "en_revision" ? "revision" : "enviado"}>{c.estado === "en_revision" ? "En revisión" : "Enviado"}</Insignia>}
        </label>
        </div>
        {detalle && <QueSaleEnElInforme detalle={detalle} seleccion={borrador.seleccion} alCambiar={(seleccion) => actualizar({ seleccion })} fotos={recursos.fotos} />}
      </div>
    );
  }

  return (
    <EditorConVista
      vista={vistaPrevia}
      hoja={
        <LienzoInforme vista={vista} alCambiar={setVista} documento={documentoVista} recursos={recursos} alPintar={fichasDePlanos} seleccion={borrador.seleccion} botones={botonesDeLaHoja} mensaje={(p) => mensajeDeVersion(p, siguiente)} contactos={quienesReciben} cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }} ancla={ancla} edicion={edicionCorreo} />
      }
      editor={
      <div className="editor-doc">
        <EncabezadoPagina
          migas={migas}
          accionesEnBarra
          titulo={`Informe de ${informe.visita.cliente}`}
          estado={vigente ? <Insignia tono="publicado">{`Versión ${vigente.numero} vigente`}</Insignia> : <Insignia tono={informe.versiones.length > 0 ? "anulado" : "borrador"}>{informe.versiones.length > 0 ? "Retirado del portal" : "Sin publicar"}</Insignia>}
          descripcion={
            <>
              <span>{informe.visita.sitio}</span>
              <span>Visita del {diaConSemana(informe.visita.programadaPara)}</span>
              <span>{informe.visita.motivo}</span>
              {contactos.data && (
                <span>
                  Recibe el PDF: <b>{reciben.length > 0 ? enLista(reciben) : "nadie"}</b>
                </span>
              )}
            </>
          }
          acciones={
            <>
              <EstadoDeGuardado estado={auto.estado} reintentar={auto.reintentar} />
              {!alLado && (
                <Boton icono={Eye} onClick={() => setVistaLateral(true)}>
                  Vista previa
                </Boton>
              )}
              <BotonMostrarVista vista={vistaPrevia} />
              <Boton
                variante="principal"
                icono={Send}
                // Publicar necesita la conexión; con un conflicto, primero se elige con cuál versión seguir.
                disabled={subiendo || !enLinea || auto.estado === "conflicto"}
                title={!enLinea ? "Publicar necesita conexión" : undefined}
                onClick={() => {
                  // Todos los que reciben el informe, marcados por omisión (ADR-0028, parte 3).
                  setDestinatarios(null);
                  setConfirmando(true);
                }}
              >
                Publicar versión {siguiente}
              </Boton>
            </>
          }
        />
        {publicadaAqui !== null && informe.versiones.some((v) => v.numero === publicadaAqui) && (
          <AvancePublicacion
            informeId={informe.id}
            version={informe.versiones.find((v) => v.numero === publicadaAqui)!}
            enElPortal={enElPortalDe(informe)}
            recargar={recargar}
            corregirEnvio={(envio, accion) => cliente.llamar(accion === "cancelar" ? "cancelarEnvio" : "reanudarEnvio", { parametros: { id: informe.id, numero: publicadaAqui, envio } })}
          />
        )}
        {error !== null && error !== undefined && (
          <Aviso tono="error">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {mensajeDeInforme(error, nombreDe).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
        {auto.estado === "conflicto" && <AvisoDeConflicto que="este informe" deAntes={auto.conflictoDeAntes} guardarLaMia={auto.guardarLaMia} cargarLaGuardada={auto.cargarLaGuardada} />}
        {/* En el orden del PDF: introducción, un capítulo por levantamiento, conclusiones y planos anexos. Al pasar a
            una sección, la hoja va hasta esa parte del documento. */}
        <div className="doc" onFocus={(e) => irAParte((e.target as HTMLElement).closest<HTMLElement>("[data-ancla]")?.dataset.ancla)}>
          <section aria-labelledby="titulo-intro" data-ancla="#introduccion">
            <h2 id="titulo-intro">
              <span className="n">1</span>Introducción
            </h2>
            <textarea className="texto-doc" aria-labelledby="titulo-intro" maxLength={20_000} value={borrador.introduccion} onChange={(e) => actualizar({ introduccion: e.target.value })} placeholder="Qué se visitó y para qué" />
          </section>
          <section aria-labelledby="titulo-incluidos" data-ancla=".capitulo">
            <h2 id="titulo-incluidos">
              <span className="n">2</span>Levantamientos
            </h2>
            <p className="ayuda">Cada uno es un capítulo del PDF, en este orden. Solo entran los revisados.</p>
            {informe.candidatos.length === 0 ? (
              <p className="sec">Esta visita todavía no tiene levantamientos enviados.</p>
            ) : (
              <>
                <ListaOrdenable elementos={incluidos} clave={(c) => c.id} nombre={(c) => `${c.formato} de ${c.tecnico}`} alMover={(de, a) => actualizar({ levantamientos: [...moverEnLista(incluidos.map((c) => c.id), de, a), ...borrador.levantamientos.filter((lid) => !incluidos.some((c) => c.id === lid))] })}>
                  {(c, k, asa) => capitulo(c, k, asa)}
                </ListaOrdenable>
                {fuera.length > 0 && (
                  <>
                    <h3>No entran</h3>
                    <div>{fuera.map((c) => capitulo(c, -1))}</div>
                  </>
                )}
              </>
            )}
          </section>
          <section aria-labelledby="titulo-concl" data-ancla="#conclusiones">
            <h2 id="titulo-concl">
              <span className="n">3</span>Conclusiones
            </h2>
            <textarea className="texto-doc" aria-labelledby="titulo-concl" maxLength={20_000} value={borrador.conclusiones} onChange={(e) => actualizar({ conclusiones: e.target.value })} placeholder="Qué se recomienda" />
          </section>
          <section aria-labelledby="titulo-planos" data-ancla="#planos">
            <h2 id="titulo-planos">
              <span className="n">4</span>Planos anexos
            </h2>
            <p className="ayuda">Los planos que elabora oficina, en PDF. Van al final del informe, en este orden.</p>
            <ListaOrdenable elementos={borrador.planos} clave={(p) => p.huella} nombre={(p) => p.nombre} alMover={(de, a) => actualizar({ planos: moverEnLista(borrador.planos, de, a) })}>
              {(p, i, asa) => (
              <div className="plano-fila">
                {asa}
                <span className="pdf" aria-hidden>
                  PDF
                </span>
                <label className="sr-only" htmlFor={`plano-${p.huella}`}>
                  {`Nombre del plano ${i + 1}`}
                </label>
                <div className="plano-nombre">
                  <input
                    id={`plano-${p.huella}`}
                    className="control chico"
                    style={{ background: "transparent" }}
                    aria-describedby={`plano-estado-${p.huella}`}
                    value={p.nombre}
                    onChange={(e) => actualizar({ planos: borrador.planos.map((x) => (x.huella === p.huella ? { ...x, nombre: e.target.value } : x)) })}
                  />
                  <EstadoDelPlano id={`plano-estado-${p.huella}`} estado={estadosDePlanos.get(p.huella)} />
                </div>
                {/* Quitar un plano del borrador no pierde nada: el archivo sigue subido y se vuelve a agregar igual. */}
                <BotonIcono icono={Trash} tamano="pequeno" etiqueta={`Quitar el plano ${i + 1}`} onClick={() => actualizar({ planos: borrador.planos.filter((x) => x.huella !== p.huella) })} />
              </div>
            )}
            </ListaOrdenable>
            <SelectorDeArchivo fila etiqueta={subiendo ? "Subiendo…" : "Agregar planos en PDF"} aceptar="application/pdf" deshabilitado={subiendo} onElegir={(a) => void agregarPlanos(a)} />
            {errorPlano !== null && <Aviso tono="error">{mensajeDeInforme(errorPlano, nombreDe).join(" ")}</Aviso>}
          </section>
          {/* El costado es la hoja: las versiones y sus envíos van al final del editor (prototipos/vista-en-vivo). */}
          <Versiones
            informe={informe}
            recargar={recargar}
            envios={
              vigente && (
                <PanelEnvios
                  cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }}
                  version={vigente}
                  contactos={contactos.data?.contactos}
                  mensaje={(p) => mensajeDeVersion(p, vigente.numero)}
                  enviar={(destinos, llave, mensaje) => cliente.llamar("enviarVersion", { parametros: { id: informe.id, numero: vigente.numero }, cuerpo: { destinos, llave, ...(mensaje && { mensaje }) } })}
                  corregirEnvio={(envio, accion) => cliente.llamar(accion === "cancelar" ? "cancelarEnvio" : "reanudarEnvio", { parametros: { id: informe.id, numero: vigente.numero, envio } })}
                  recargar={recargar}
                />
              )
            }
          />
        </div>
      </div>
      }
    >
      {vistaLateral && !alLado && (
        <Dialogo forma="lateral" amplio titulo="Vista previa" subtitulo={`Informe de ${informe.visita.cliente}, versión ${siguiente}`} alCerrar={() => setVistaLateral(false)}>
          <LienzoInforme vista={vista} alCambiar={setVista} documento={documentoVista} recursos={recursos} alPintar={fichasDePlanos} seleccion={borrador.seleccion} botones={botonesDeLaHoja} mensaje={(p) => mensajeDeVersion(p, siguiente)} contactos={quienesReciben} cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }} ancla={null} edicion={edicionCorreo} />
        </Dialogo>
      )}

      {confirmando && (
        <Confirmacion
          titulo={`¿Publicar la versión ${siguiente}?`}
          confirmar={elegidos.length > 0 ? `Publicar y enviar a ${elegidos.length}` : `Publicar versión ${siguiente}`}
          nivel="irreversible"
          mensajeDeError={(e) => mensajeDeInforme(e, nombreDe).join(" ")}
          alCerrar={() => setConfirmando(false)}
          alTerminar={() => {
            setPublicadaAqui(siguiente);
            notificar({ texto: `Versión ${siguiente} publicada` });
          }}
          accion={guardarYPublicar}
        >
          <Consecuencias
            lista={[
              { icono: Globe, texto: "El cliente la verá en el portal", detalle: "Queda congelada: no se podrá modificar" },
              { icono: FileText, texto: "Es el documento de la vista previa", detalle: "El PDF puede partir las páginas distinto" },
              { icono: History, texto: `Para corregir algo se publica la versión ${siguiente + 1}`, detalle: siguiente > 1 ? `La versión ${siguiente - 1} se conserva` : "Esta se conserva" },
              ...(textoCorreo && elegidos.length > 0 ? [{ icono: Mail, texto: "El correo va con el texto que usted escribió", detalle: `Asunto: ${textoCorreo.asunto}` }] : []),
              // Se puede publicar igual, pero se dice antes: un plano que no se anexa hace fallar el PDF y sus envíos.
              ...ilegibles.map((p) => ({ icono: TriangleAlert, texto: `El plano «${p.nombre}» no se puede anexar`, detalle: "El PDF del informe fallará y no se enviará: vuelva a exportar el plano y súbalo de nuevo" })),
            ]}
          />
          {contactos.isPending ? (
            <p className="ayuda">Cargando los contactos del cliente…</p>
          ) : contactos.isError ? (
            <Aviso tono="error">No se pudieron cargar los contactos: se publicará sin enviar. Podrá enviarla después desde "Envíos".</Aviso>
          ) : contactos.data.archivado ? (
            <ClienteArchivado cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }} />
          ) : (
            <Destinatarios contactos={contactos.data.contactos} elegidos={elegidos} alCambiar={setDestinatarios} cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }} titulo="Enviar el PDF cuando esté listo" />
          )}
          {elegidos.length > 0 && <p className="ayuda">Lo enviado no se puede recuperar, ni retirando la versión del portal.</p>}
        </Confirmacion>
      )}
    </EditorConVista>
  );
}

type Contacto = Respuesta<"obtenerCliente">["contactos"][number];
type EstadoDePlano = Respuesta<"estadoDePlano">;

/** Lo que dice la ficha del plano en la hoja. */
function fichaDePlano(estado: EstadoDePlano | undefined): string {
  if (estado?.estado === "ilegible") return "no se puede anexar: el PDF del informe fallaría";
  if (estado?.estado === "rechazado") return "no pasó la verificación: súbalo de nuevo";
  if (estado?.estado === "verificando") return "se está verificando";
  if (estado?.paginas) return `${estado.paginas === 1 ? "1 página, se anexa" : `${estado.paginas} páginas, se anexan`} al final del PDF`;
  return "se anexa al final del PDF";
}

/** Bajo el nombre del plano: sus páginas, que se está verificando o que no se puede anexar, antes de publicar. */
function EstadoDelPlano({ id, estado }: { id: string; estado: EstadoDePlano | undefined }) {
  if (!estado) return null;
  if (estado.estado === "ilegible" || estado.estado === "rechazado")
    return (
      <span id={id} className="msj-error">
        {estado.estado === "ilegible" ? "No se puede anexar al informe: vuelva a exportarlo como PDF y súbalo de nuevo." : "No pasó la verificación: súbalo de nuevo."}
      </span>
    );
  const texto = estado.estado === "verificando" ? "Verificando…" : estado.paginas ? (estado.paginas === 1 ? "1 página" : `${estado.paginas} páginas`) : null;
  return texto ? (
    <span id={id} className="ayuda" aria-live="polite">
      {texto}
    </span>
  ) : null;
}

/** El lienzo del informe: el documento completo en el orden del PDF, o el correo que recibe cada contacto. */
function LienzoInforme({
  vista,
  alCambiar,
  documento,
  recursos,
  alPintar,
  mensaje,
  contactos,
  cliente: cl,
  ancla,
  edicion,
  seleccion,
  botones,
}: {
  vista: QueSeVe;
  alCambiar: (v: QueSeVe) => void;
  documento: ContenidoVersion;
  recursos: ReturnType<typeof useRecursosDelInforme>;
  alPintar: (doc: Document) => void;
  mensaje: (p: Plantillas) => MensajeDeInforme;
  contactos: readonly Contacto[];
  cliente: { id: string; nombre: string };
  ancla: AnclaDeHoja | null;
  edicion: EdicionDeCorreo;
  /** Lo oculto se ve rayado y con «Mostrar» (ADR-0039). */
  seleccion: SeleccionInforme;
  botones: { encima: string; alTocar: (boton: HTMLElement) => void };
}) {
  return (
    <Lienzo cabecera={<PestanasDeVista documento="Informe" vista={vista} alCambiar={alCambiar} />} sinConexion="Las fotos que no alcanzaron a cargar salen como [FOTO]. ">
      {vista === "documento" ? (
        <VistaDeDocumento titulo={`Vista previa del informe de ${documento.visita.cliente}`} generar={(p) => p.plantillaInforme(documento, { salida: { tipo: "vista" }, ...recursos, seleccion })} alPintar={alPintar} ancla={ancla} botones={botones} />
      ) : (
        <CorreoDeContactos contactos={contactos} mensaje={mensaje} cliente={cl} documento="el informe" edicion={edicion} />
      )}
    </Lienzo>
  );
}

/** Descargar el PDF de una versión: un enlace firmado que descarga el archivo (Content-Disposition: attachment); la pantalla no cambia. */
function useDescargaDePdf(informeId: string) {
  const [descargando, setDescargando] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);
  async function descargar(numero: number) {
    setDescargando(numero);
    setFallo(false);
    try {
      const { url } = await cliente.llamar("pdfDeVersion", { parametros: { id: informeId, numero } });
      window.location.assign(url);
    } catch {
      setFallo(true);
    } finally {
      setDescargando(null);
    }
  }
  return { descargando, fallo, setFallo, descargar };
}

/** La marca de un paso: hecho (el chulo se dibuja si se cumplió a la vista), trabajando o pendiente. */
function MarcaDePaso({ hecho, trabajando, nueva }: { hecho: boolean; trabajando: boolean; nueva: boolean }) {
  return (
    <span className={`marca-paso ${hecho ? "hecho" : trabajando ? "trabajando" : ""} ${hecho && nueva ? "nueva" : ""}`} aria-hidden>
      {hecho && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

const ESTADO_DEL_ENVIO = { en_cola: "En cola", enviado: "Enviado", entregado: "Entregado", fallido: "No llegó", cancelado: "Cancelado" } as const;

/**
 * Lo que pasa después de publicar, a la vista y en su lugar (iteración 27): publicada, el PDF, en el portal y cada
 * envío. Los envíos están hechos cuando ninguno queda en cola; un WhatsApp sigue en "Enviado" mientras Meta no
 * confirme, y eso también se dice.
 */
function AvancePublicacion({
  informeId,
  version: v,
  enElPortal,
  recargar,
  corregirEnvio,
}: {
  informeId: string;
  version: Informe["versiones"][number];
  enElPortal: number | undefined;
  recargar: () => void;
  corregirEnvio: (envioId: string, accion: "cancelar" | "reanudar") => Promise<unknown>;
}) {
  const { descargando, fallo, descargar } = useDescargaDePdf(informeId);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const cancelar = useCancelarEnvio(corregirEnvio, recargar, setErrorEnvio);
  const envios = v.envios;
  const entregados = envios.filter((e) => e.estado === "entregado").length;
  const enCola = envios.some((e) => e.estado === "en_cola");
  const pdfListo = v.pdf === "listo";
  // Retirada en esta misma sesión (ADR-0034): ya no se dice que está en el portal.
  const retirada = v.retirada !== null;
  const hechos = { pdf: pdfListo, portal: pdfListo && !retirada, envios: pdfListo && !enCola };
  // Lo que ya estaba hecho al aparecer no se anima; lo que se cumple a la vista, sí.
  const alAparecer = useRef(hechos);
  const nueva = (paso: keyof typeof hechos) => !alAparecer.current[paso];
  const resumen = resumenDelAvance(v);

  return (
    <section className="avance-pub" aria-label={`Avance de la versión ${v.numero}`}>
      <header>
        <b>Versión {v.numero}</b>
        <span aria-live="polite">{resumen}</span>
      </header>
      <ol>
        <li>
          <MarcaDePaso hecho trabajando={false} nueva={false} />
          <span>
            Publicada<small>Queda congelada · {aHora(Date.parse(v.publicadaEn))}</small>
          </span>
          <span />
        </li>
        <li>
          {v.pdf === "fallido" ? <span className="marca-paso mal" aria-hidden /> : <MarcaDePaso hecho={pdfListo} trabajando={!pdfListo} nueva={nueva("pdf")} />}
          <span>
            PDF<small className={v.pdf === "fallido" ? "mal" : undefined}>{pdfListo ? "Listo" : v.pdf === "fallido" ? "No se generó. Avísele a soporte." : "Generando, tarda unos segundos"}</small>
          </span>
          {pdfListo ? (
            // Su nombre no repite el de "Versiones publicadas": es el mismo archivo, recién hecho.
            <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label="Descargar el PDF recién publicado" cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
              PDF
            </Boton>
          ) : (
            <span />
          )}
        </li>
        <li>
          <MarcaDePaso hecho={hechos.portal} trabajando={false} nueva={nueva("portal")} />
          <span>
            En el portal
            <small>
              {retirada
                ? `Retirada: el cliente ya no la ve${enElPortal ? `; ve la versión ${enElPortal}` : ""}`
                : pdfListo
                  ? "El cliente ya lo puede descargar"
                  : v.pdf === "fallido"
                    ? `Sin PDF no aparece. ${loQueVeElCliente(enElPortal)}`
                    : `Aparece cuando el PDF esté listo. ${loQueVeElCliente(enElPortal)}`}
            </small>
          </span>
          <span />
        </li>
        {envios.length > 0 && (
          <li>
            <MarcaDePaso hecho={hechos.envios} trabajando={pdfListo && enCola} nueva={nueva("envios")} />
            <span>
              Envíos<small>{pdfListo ? `${entregados} de ${envios.length} ${envios.length === 1 ? "entregado" : "entregados"}` : "Salen cuando el PDF esté listo"}</small>
              <ul>
                {envios.map((e) => {
                  const Icono = e.canal === "correo" ? Mail : MessageCircle;
                  return (
                    <li key={e.id}>
                      <Icono aria-hidden size={14} />
                      {e.contacto.nombre}
                      <span className={`det ${e.estado === "entregado" ? "ok" : e.estado === "fallido" ? "mal" : ""}`}>
                        {e.canal === "correo" ? "Correo" : "WhatsApp"} · {ESTADO_DEL_ENVIO[e.estado]}
                        {e.estado === "cancelado" && e.error && `: ${e.error}`}
                        {e.estado === "enviado" && e.canal === "whatsapp" && ": Meta no ha confirmado la entrega"}
                        {e.estado === "en_cola" && (
                          <button type="button" className="accion-envio" onClick={() => void cancelar(e)} aria-label={`Cancelar el envío a ${e.contacto.nombre} por ${e.canal === "correo" ? "correo" : "WhatsApp"}`}>
                            Cancelar
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </span>
            <span />
          </li>
        )}
      </ol>
      {fallo && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
      {errorEnvio && <Aviso tono="error">{errorEnvio}</Aviso>}
    </section>
  );
}

function Versiones({ informe, recargar, envios }: { informe: Informe; recargar: () => void; envios: ReactNode }) {
  const { descargando, fallo: errorDescarga, setFallo: setErrorDescarga, descargar } = useDescargaDePdf(informe.id);
  const [retirando, setRetirando] = useState<number | null>(null);
  useEffect(() => setErrorDescarga(false), [informe.versiones.length]);
  const administrador = useQuery(consultas.sesion()).data?.usuario.administrador ?? false;
  const vigente = vigenteDe(informe)?.numero;
  const enElPortal = enElPortalDe(informe);

  return (
    <section aria-labelledby="titulo-versiones">
      <h2 id="titulo-versiones">Versiones publicadas</h2>
      {informe.versiones.length === 0 ? (
        <p className="ayuda">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <div>
          {informe.versiones.map((v) => (
            <div key={v.numero} className="ver">
              <div className="ver-cab">
                <b>Versión {v.numero}</b>
                {v.numero === vigente && <Insignia tono="publicado">Vigente</Insignia>}
                {v.retirada && <Insignia tono="anulado">Retirada</Insignia>}
                {v.pdf === "listo" ? (
                  <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label={`Descargar PDF de la versión ${v.numero}`} cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                    PDF
                  </Boton>
                ) : v.pdf === "generando" ? (
                  <span className="sec text-ayuda" aria-live="polite">
                    Generando el PDF…
                  </span>
                ) : (
                  <span className="msj-error">No se generó el PDF. Avísele a soporte.</span>
                )}
              </div>
              <span className="meta">{`Publicada ${aFechaCorta(v.publicadaEn)} por ${v.publicadaPor.nombre}${v.envios.length > 0 ? ` · ${v.envios.length === 1 ? "1 envío" : `${v.envios.length} envíos`}` : ""}`}</span>
              {v.retirada && <span className="meta">{`Retirada ${aFechaCorta(v.retirada.en)} por ${v.retirada.por.nombre}: ${v.retirada.motivo}`}</span>}
              {v.numero === vigente && v.pdf !== "listo" && <span className="meta">{`${loQueVeElCliente(enElPortal)}.`}</span>}
              {v.numero === vigente
                ? envios && (
                    <PanelConRetiro envios={envios} retirar={administrador && !v.retirada ? () => setRetirando(v.numero) : undefined} numero={v.numero} />
                  )
                : administrador &&
                  !v.retirada && (
                    <div>
                      <Boton variante="fantasma" tamano="pequeno" className="texto-peligro" aria-label={`Retirar la versión ${v.numero} del portal`} onClick={() => setRetirando(v.numero)}>
                        Retirar del portal
                      </Boton>
                    </div>
                  )}
            </div>
          ))}
        </div>
      )}
      <p className="ayuda">Una versión publicada queda congelada. Para corregir algo se publica otra y la anterior se conserva.</p>
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
      {retirando !== null && (
        <RetirarVersion informeId={informe.id} numero={retirando} envios={informe.versiones.find((v) => v.numero === retirando)?.envios ?? []} alCerrar={() => setRetirando(null)} alRetirar={recargar} />
      )}
    </section>
  );
}

/** Los envíos de la vigente, con "Retirar del portal" junto a "Enviar a otro contacto" (solo quien administra). */
function PanelConRetiro({ envios, retirar, numero }: { envios: ReactNode; retirar: (() => void) | undefined; numero: number }) {
  if (!retirar || !isValidElement<{ acciones?: ReactNode }>(envios)) return <>{envios}</>;
  return cloneElement(envios, {
    acciones: (
      <Boton variante="fantasma" tamano="pequeno" className="texto-peligro" aria-label={`Retirar la versión ${numero} del portal`} onClick={retirar}>
        Retirar del portal
      </Boton>
    ),
  });
}

/** Solo quien administra: el cliente deja de ver la versión; se conserva y queda registrado. */
function RetirarVersion({ informeId, numero, envios, alCerrar, alRetirar }: { informeId: string; numero: number; envios: Envio[]; alCerrar: () => void; alRetirar: () => void }) {
  const consultasCliente = useQueryClient();
  const notificar = useNotificar();
  const [motivo, setMotivo] = useState("");
  return (
    <Confirmacion
      titulo={`¿Retirar la versión ${numero} del portal?`}
      confirmar={`Retirar la versión ${numero}`}
      nivel="irreversible"
      validar={() => (motivo.trim() === "" ? "Escriba por qué se retira: queda en el registro." : null)}
      mensajeDeError={mensajeDeAdministracion}
      alCerrar={alCerrar}
      alTerminar={() => {
        alRetirar();
        notificar({ texto: `Versión ${numero} retirada del portal` });
      }}
      accion={async () => {
        await cliente.llamar("retirarVersion", { parametros: { id: informeId, numero }, cuerpo: { motivo: motivo.trim() } });
        await consultasCliente.invalidateQueries({ queryKey: ["informes"] });
      }}
    >
      <p>El cliente deja de verla: si hay una versión anterior sin retirar, verá esa. No se puede deshacer; para volver a entregar, publique una versión nueva.</p>
      {/* Lo enviado no se recupera (ADR-0028): se dice a quién le llegó, para avisarle. */}
      {copiasEnviadas(envios).length > 0 && (
        <Aviso tono="alerta">
          {`Ya se le envió a ${enLista(copiasEnviadas(envios))}. Esas copias no se pueden recuperar: ${copiasEnviadas(envios).length === 1 ? "avísele" : "avíseles"} que la versión ${numero} ya no vale.`}
        </Aviso>
      )}
      <CampoTextoLargo etiqueta={`Motivo del retiro de la versión ${numero}`} valor={motivo} onCambio={setMotivo} maximo={500} />
    </Confirmacion>
  );
}
