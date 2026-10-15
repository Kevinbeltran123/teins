import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  bloques,
  campoDeRuta,
  crearMedida,
  describirValor,
  esBoceto,
  esCantidades,
  esFirma,
  esNoObtenido,
  hojasDe,
  nombreDeDato,
  normalizarDecimal,
  rutaLegible,
  type ContenidoVersion,
  type DefinicionCampo,
  type DocumentoBoceto,
  type LineaCantidad,
  type Valor,
  type ValorFirma,
  type ValorMedida,
} from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  ArrowUp,
  Aviso,
  Boton,
  CampoMedida,
  CampoSeleccion,
  CampoTexto,
  BotonIcono,
  Check,
  ChevronLeft,
  ChevronRight,
  DestinoAccionesBarra,
  Dialogo,
  Confirmacion,
  EditorCantidades,
  EncabezadoPagina,
  EsqueletoLista,
  FileText,
  Firma,
  History,
  HojasDeBoceto,
  Insignia,
  Link2,
  LockKeyhole,
  nombreDeTransicion,
  MarcaNoObtenido,
  MessageSquare,
  PanelRight,
  Pencil,
  RefreshCw,
  Send,
  sinMovimiento,
  Smartphone,
  TriangleAlert,
  UserRound,
  useLoNuevo,
  MenuAcciones,
  useNotificar,
  VisorFotos,
  type AnclaDeHoja,
  type LineaEditable,
  type LucideIcon,
} from "@teins/ui";
import { consultas } from "../api";
import { consultasDeCatalogo, useVincular } from "../catalogo";
import { aDiaCorto, aFechaCorta, aHora, cuantoLleva, iniciales } from "../formato";
import { avisarConversacionAbierta } from "../conversacion";
import { useAbrirInformeDeVisita } from "../informes";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../mensajes";
import { alMarcarRevisado, seccionCorregida, useBandeja, useComentar, useCorregir, useCorregirComentario, useLeerConversacion, useMarcarRevisado, useTomar, type Escrito } from "../revision";
import { capituloDe, useRecursosDelInforme } from "../vistaInforme";
import { enLista } from "./Envios";
import { BotonMostrarVista, EditorConVista, Lienzo, useVistaPrevia, VistaDeDocumento } from "./Lienzo";
import type { Plantillas } from "../documentos";
import { esTexto, unoDe, usePreferencia } from "../preferencias";
import { useTeclaSuelta } from "../atajos";
import { useAnotarReciente } from "./Paleta";

type Levantamiento = Respuesta<"obtenerLevantamiento">;
type Historial = Respuesta<"historialLevantamiento">;
type Evento = Historial["eventos"][number];

const ESTADOS = {
  enviado: { texto: "Enviado", tono: "enviado" },
  en_revision: { texto: "En revisión", tono: "revision" },
  revisado: { texto: "Revisado", tono: "revisado" },
} as const;

const migas = (
  <Link to="/" className="migas">
    <ChevronLeft aria-hidden size={16} />
    Levantamientos
  </Link>
);

const claveDato = (seccion: string, campo: string) => `${seccion}|${campo}`;
const idDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`.replace(/[^a-zA-Z0-9_-]/g, "");

/** La corrección que se está escribiendo: el capítulo del informe la muestra antes de guardarla (iteración 26). */
type EnCurso = { seccion: string; campo: string; valor: Valor | undefined };
const CorreccionEnCurso = createContext<{ avisar: (c: EnCurso | null) => void; verCapitulo: (() => void) | null } | null>(null);

type Pendiente = { que: Escrito; valor: unknown };
/**
 * Lo escrito y no enviado en la revisión, por destino. Vive en el detalle y no en cada campo: cambiar de pestaña del
 * panel, ocultarlo, cerrar la hoja lateral o abrir el globo de otra fila no lo borra, y «Marcar revisado» dice qué se
 * pierde.
 */
const SinEnviar = createContext<Map<string, Pendiente> | null>(null);

/**
 * Lo escrito sin enviar de cada levantamiento, fuera del detalle: Esc, el menú, Atrás o «Siguiente» lo desmontan, y al
 * volver sigue ahí (iteración 42). Los comentarios se copian en la pestaña (`sessionStorage`) y también vuelven al
 * recargar; de una corrección solo queda la marca de que hay una abierta, que se va con su editor.
 */
class LoSinEnviar extends Map<string, Pendiente> {
  private readonly llave: string;
  constructor(levantamientoId: string) {
    super();
    this.llave = `revision-sin-enviar:${levantamientoId}`;
    try {
      for (const [clave, pendiente] of JSON.parse(sessionStorage.getItem(this.llave) ?? "[]") as [string, Pendiente][]) super.set(clave, pendiente);
    } catch {
      // Sin almacenamiento de la pestaña (navegación privada estricta), lo escrito vive mientras la app esté abierta.
    }
  }
  override set(clave: string, pendiente: Pendiente) {
    super.set(clave, pendiente);
    this.copiar();
    return this;
  }
  override delete(clave: string) {
    const habia = super.delete(clave);
    this.copiar();
    return habia;
  }
  override clear() {
    super.clear();
    this.copiar();
  }
  private copiar() {
    try {
      const comentarios = [...this].filter(([, p]) => p.que.tipo !== "correccion");
      if (comentarios.length === 0) sessionStorage.removeItem(this.llave);
      else sessionStorage.setItem(this.llave, JSON.stringify(comentarios));
    } catch {
      // Lleno o sin permiso: sigue en memoria.
    }
  }
}
const sinEnviarPorLevantamiento = new Map<string, LoSinEnviar>();
const sinEnviarDe = (levantamientoId: string) => {
  let registro = sinEnviarPorLevantamiento.get(levantamientoId);
  if (!registro) sinEnviarPorLevantamiento.set(levantamientoId, (registro = new LoSinEnviar(levantamientoId)));
  return registro;
};
const hayCorreccionAbierta = (pendientes: Iterable<Pendiente>) => [...pendientes].some((p) => p.que.tipo === "correccion");

/** Un texto de la revisión que sigue ahí si su campo se desmonta y vuelve a montarse. */
function useSinEnviar<T>(que: Escrito, inicial: T): [T, (valor: T) => void] {
  const pendientes = useContext(SinEnviar);
  const clave = JSON.stringify(que);
  const [valor, setValor] = useState<T>(() => (pendientes?.has(clave) ? (pendientes.get(clave)!.valor as T) : inicial));
  const poner = (nuevo: T) => {
    setValor(nuevo);
    pendientes?.set(clave, { que, valor: nuevo });
  };
  return [valor, poner];
}

/** La última corrección de cada dato y su valor original, para mostrar antes y después en la fila. */
function correccionesDe(historial: Historial | undefined) {
  const porDato = new Map<string, { original: unknown; autor: string; motivo: string | undefined }>();
  for (const e of historial?.eventos ?? []) {
    if (e.tipo !== "campo_corregido" || !e.seccion || !e.campo) continue;
    const clave = claveDato(e.seccion, e.campo);
    const previa = porDato.get(clave);
    porDato.set(clave, { original: previa ? previa.original : e.anterior, autor: e.autor.nombre, motivo: e.motivo ?? undefined });
  }
  return porDato;
}

/**
 * Detalle de un levantamiento (prototipos/oficina): se lee como un documento, con las secciones del recorrido de
 * campo; "Corregir" y "Comentar" aparecen al pasar por cada fila y el comentario se escribe debajo del dato. Desde la
 * iteración 38 (prototipos/revision-al-lado) se arma como el informe: los datos a la izquierda y, a la derecha, un
 * panel a todo el alto con el capítulo como saldrá en el informe, los comentarios y el historial. El estado y su acción
 * van en la barra.
 */
type Pestana = "informe" | "comentarios" | "historial";

/** Con la conversación a la vista se consulta cada 15 s (ADR-0040): lo que responde el técnico llega sin aviso. */
const CONSULTA_CONVERSACION_MS = 15_000;

/** Abre la pestaña «Comentarios» en una conversación (ADR-0040). */
const VerConversacion = createContext<((comentarioId: string) => void) | null>(null);

export function Detalle({ id, hilo }: { id: string; hilo?: string | undefined }) {
  const sesion = useQuery(consultas.sesion());
  const historial = useQuery(consultas.historial(id));
  const [comentandoEn, setComentandoEn] = useState<string | null>(null);
  // La primera vez abre en «En el informe»: es lo que muestra cómo queda lo que se revisa.
  const [pestana, setPestana] = usePreferencia<Pestana>("revision-pestana", "informe", unoDe("informe", "comentarios", "historial"));
  const vista = useVistaPrevia("revision");
  const [lateral, setLateral] = useState(false);
  // La conversación a la vista: la pestaña «Comentarios» con el panel mostrado (o la hoja lateral abierta).
  const conversando = pestana === "comentarios" && (vista.alLado ? !vista.oculta : lateral);
  const consulta = useQuery({ ...consultas.levantamiento(id), refetchInterval: conversando ? CONSULTA_CONVERSACION_MS : false });
  // El hilo al que lleva un aviso o «Ver la conversación»: la pestaña lo muestra y lo hace destellar.
  const [enfocado, setEnfocado] = useState<{ id: string; vez: number } | null>(hilo ? { id: hilo, vez: 1 } : null);
  const verConversacion = (comentarioId: string) => {
    setPestana("comentarios");
    if (vista.alLado) vista.setOculta(false);
    else setLateral(true);
    setEnfocado((e) => ({ id: comentarioId, vez: (e?.vez ?? 0) + 1 }));
  };
  useEffect(() => {
    if (hilo) verConversacion(hilo);
  }, [hilo]);
  // Lo que está a la vista se da por leído; mientras se ve, sus avisos no se muestran.
  const leer = useLeerConversacion(id);
  const sinLeer = consulta.data?.conversacion?.sinLeer ?? false;
  useEffect(() => {
    if (conversando && sinLeer && !leer.isPending) leer.mutate();
  }, [conversando, sinLeer]);
  useEffect(() => {
    if (!conversando) return;
    avisarConversacionAbierta(id);
    return () => avisarConversacionAbierta(null);
  }, [conversando, id]);
  // La bandeja marca la fila que se abrió al volver (prototipos/usabilidad-oficina).
  const [, setUltima] = usePreferencia("bandeja-ultima", "", esTexto, "pestana");
  useEffect(() => setUltima(id), [id, setUltima]);
  const abierto = consulta.data;
  useAnotarReciente(abierto ? { tipo: "levantamiento", id, titulo: abierto.visita ? `${abierto.visita.cliente} · ${abierto.visita.sitio}` : `Levantamiento de ${abierto.tecnico.nombre}`, detalle: `${abierto.tecnico.nombre} · ${{ enviado: "esperando revisión", en_revision: "en revisión", revisado: "revisado" }[abierto.estado]}` } : null);
  // Esc vuelve a la bandeja, con la fila de este levantamiento marcada (iteración 37).
  const volver = useNavigate();
  const [enCurso, setEnCurso] = useState<EnCurso | null>(null);
  const sinEnviar = sinEnviarDe(id);
  // Con una corrección abierta, Esc no sale: se perdería lo escrito en ella. Recargar o cerrar la pestaña pregunta.
  useTeclaSuelta("Escape", () => void (hayCorreccionAbierta(sinEnviar.values()) || volver({ to: "/" })));
  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (hayCorreccionAbierta(sinEnviar.values())) e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sinEnviar]);

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Levantamiento" />
        <EsqueletoLista etiqueta="Cargando el levantamiento" />
      </>
    );
  }
  // Solo si nunca cargó: un error al releer (foco, sondeo, sesión vencida) deja la revisión y lo escrito donde están.
  if (consulta.data === undefined) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Levantamiento" />
        <Aviso tono="error">
          <b>{noExiste ? "Este levantamiento no existe o no pertenece a su organización." : "No se pudo cargar el levantamiento."}</b>
          {!noExiste && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
                Reintentar
              </Boton>
            </div>
          )}
        </Aviso>
      </>
    );
  }

  const l = consulta.data;
  // Regla 4: solo quien tomó la revisión corrige, y solo mientras está en revisión.
  const mia = l.estado === "en_revision" && l.revisor?.id === sesion.data?.usuario.id;
  const correcciones = correccionesDe(historial.data);
  const recargar = () => void consulta.refetch();
  const titulo = l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : `Levantamiento de ${l.tecnico.nombre}`;

  // Las secciones del formato, con sus repeticiones juntas bajo el mismo título (prototipo: "Tableros").
  const todos = bloques(l.formatoDefinicion, l.repeticiones);
  const secciones = l.formatoDefinicion.secciones.map((s) => ({ seccion: s, bloques: todos.filter((b) => b.seccion.clave === s.clave) }));
  const corregidas = [...correcciones.keys()].map((k) => k.split("|")[0]!);
  const conCambios = (clave: string) => seccionCorregida(corregidas, clave);
  const conFaltantes = (bs: typeof todos) => bs.some((b) => b.seccion.campos.some((c) => esNoObtenido(l.respuestas[b.clave]?.[c.clave])));

  const irA = (seccion: string) => document.getElementById(`sec-${seccion}`)?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });
  const nombreFormato = `${l.formatoDefinicion.nombre ?? l.formato} v${l.versionFormato}`;
  // El capítulo se ve si el panel está a la vista en «En el informe»; si no, «Ver cómo queda» lo trae.
  const capituloVisible = pestana === "informe" && vista.alLadoVisible;
  const verCapitulo = () => {
    setPestana("informe");
    if (vista.alLado) vista.setOculta(false);
    else setLateral(true);
  };
  const panel = (
    <PanelDeRevision
      l={l}
      titulo={titulo}
      pestana={pestana}
      alCambiar={setPestana}
      historial={historial}
      correcciones={correcciones}
      enCurso={enCurso}
      organizacion={sesion.data?.organizacion.nombre ?? "[ORGANIZACIÓN]"}
      usuarioId={sesion.data?.usuario.id}
      enfocado={enfocado}
    />
  );
  // Con el panel oculto, el punto de «sin leer» va en el botón que lo muestra.
  const mostrarPanel = (
    <span className="con-punto">
      {vista.alLado ? <BotonMostrarVista vista={vista} etiqueta="Mostrar el panel" /> : <BotonIcono icono={PanelRight} etiqueta="Mostrar el panel" onClick={() => setLateral(true)} />}
      {sinLeer && (vista.alLado ? vista.oculta : !lateral) && <i className="punto" aria-label="Respuesta sin leer" />}
    </span>
  );

  return (
    <SinEnviar.Provider value={sinEnviar}>
    <VerConversacion.Provider value={verConversacion}>
    <CorreccionEnCurso.Provider value={{ avisar: setEnCurso, verCapitulo: capituloVisible ? null : verCapitulo }}>
      <EditorConVista
        vista={vista}
        hoja={panel}
        editor={
          <div className="editor-doc revision-doc">
            <EstadoDeRevision l={l} mia={mia} historial={historial.data} recargar={recargar} mostrarPanel={mostrarPanel} />
            <EncabezadoPagina
              migas={migas}
              titulo={titulo}
              transicion={nombreDeTransicion("lev", l.id)}
              descripcion={
                <>
                  <span>
                    {nombreFormato} de <b>{l.tecnico.nombre}</b>
                  </span>
                  <span>Recibido {aFechaCorta(l.recibidoEn)}</span>
                  {/* La hora del teléfono es declarativa (regla 16): la oficial es la del servidor. */}
                  <span>Enviado desde el teléfono {aFechaCorta(l.enviadoEnDispositivo)}</span>
                  {!l.visita && <span>Sin visita (capturado antes de las visitas)</span>}
                </>
              }
            />
            <nav className="nav-secciones" aria-label="Secciones del levantamiento">
              {secciones.map(({ seccion, bloques: bs }) => (
                <button key={seccion.clave} type="button" onClick={() => irA(seccion.clave)}>
                  {conCambios(seccion.clave) ? <i className="m-cambio" aria-label="con correcciones" /> : conFaltantes(bs) ? <i className="m-falta" aria-label="con datos no obtenidos" /> : null}
                  {seccion.titulo}
                </button>
              ))}
            </nav>
            <div className="doc">
              {secciones.map(({ seccion, bloques: bs }, k) => (
                <section key={seccion.clave} id={`sec-${seccion.clave}`} aria-labelledby={`titulo-${seccion.clave}`}>
                  <h2 id={`titulo-${seccion.clave}`}>
                    <span className="n">{k + 1}</span>
                    {seccion.titulo}
                  </h2>
                  {seccion.repetible && bs.length === 0 && <p className="ayuda">El técnico no agregó ninguno.</p>}
                  {bs.map((b) => (
                    <div key={b.clave} role={b.repeticion ? "region" : undefined} aria-label={b.repeticion ? b.titulo : undefined}>
                      {b.repeticion && <div className="rep-titulo">{b.repeticion.nombre}</div>}
                      <div className="datos">
                        {b.seccion.campos.map((campo) => (
                          <FilaCampo
                            key={campo.clave}
                            l={l}
                            seccion={b.clave}
                            campo={campo}
                            mia={mia}
                            correccion={correcciones.get(claveDato(b.clave, campo.clave))}
                            recargar={recargar}
                            comentando={comentandoEn === claveDato(b.clave, campo.clave)}
                            comentar={() => setComentandoEn(claveDato(b.clave, campo.clave))}
                            dejarDeComentar={() => setComentandoEn(null)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        }
      >
        {lateral && !vista.alLado && (
          <Dialogo forma="lateral" amplio titulo={titulo} subtitulo="El capítulo en el informe, los comentarios y el historial" alCerrar={() => setLateral(false)}>
            {panel}
          </Dialogo>
        )}
      </EditorConVista>
    </CorreccionEnCurso.Provider>
    </VerConversacion.Provider>
    </SinEnviar.Provider>
  );
}

/** El panel de la derecha (iteración 38): sus pestañas son la cabecera del lienzo, con «Ampliar» solo sobre la hoja. */
function PanelDeRevision({
  l,
  titulo,
  pestana,
  alCambiar,
  historial,
  correcciones,
  enCurso,
  organizacion,
  usuarioId,
  enfocado,
}: {
  l: Levantamiento;
  titulo: string;
  pestana: Pestana;
  alCambiar: (p: Pestana) => void;
  historial: ReturnType<typeof useQuery<Historial>>;
  correcciones: ReturnType<typeof correccionesDe>;
  enCurso: EnCurso | null;
  organizacion: string;
  usuarioId: string | undefined;
  enfocado: { id: string; vez: number } | null;
}) {
  const n = vigentes(l).length;
  const boton = (valor: Pestana, texto: string, Icono: LucideIcon, cuantos = 0, punto = false) => (
    <button type="button" role="tab" aria-selected={pestana === valor} onClick={() => alCambiar(valor)}>
      <Icono aria-hidden size={14} strokeWidth={1.6} />
      {texto}
      {cuantos > 0 && <span className="num-p"> {cuantos}</span>}
      {punto && <i className="punto" aria-label="Respuesta sin leer" />}
    </button>
  );
  return (
    <Lienzo
      clase="panel-revision"
      nota=""
      cabecera={
        <span className="pest-p" role="tablist" aria-label="El informe, los comentarios y el historial">
          {boton("informe", "En el informe", FileText)}
          {boton("comentarios", "Comentarios", MessageSquare, n, l.conversacion?.sinLeer ?? false)}
          {boton("historial", "Historial", History)}
        </span>
      }
      panel={{
        etiqueta: "El informe, los comentarios y el historial",
        ampliable: pestana === "informe",
        cabeceraAmpliada: (
          <span className="titulo-ampliado">
            <b>{titulo}</b> · el capítulo como saldrá en el informe
          </span>
        ),
        volver: "Volver a la revisión",
      }}
    >
      {pestana === "informe" ? (
        <CapituloEnVivo l={l} correcciones={correcciones} enCurso={enCurso} organizacion={organizacion} />
      ) : pestana === "comentarios" ? (
        <Comentarios l={l} usuarioId={usuarioId} enfocado={enfocado} />
      ) : (
        <HistorialDeCambios l={l} historial={historial} />
      )}
    </Lienzo>
  );
}

/** "8:41 p. m." si fue hoy; si no, con el día. */
const cuandoCorto = (iso: string) => (aDiaCorto(iso) === "hoy" ? aHora(Date.parse(iso)) : aFechaCorta(iso));

type Consecuencia = { icono: LucideIcon; texto: string; detalle?: string };

/**
 * Lo escrito que «Marcar revisado» deja atrás, como consecuencias de su confirmación (DESIGN.md, tabla de confirmar o
 * deshacer): lo que se pierde, y los comentarios sin enviar, que el técnico ya no podrá responder.
 */
function loEscritoAlMarcar(l: Levantamiento, pendientes: Iterable<Pendiente>): Consecuencia[] {
  const { sePierden, sinRespuesta } = alMarcarRevisado(pendientes);
  const dato = (seccion: string, campo: string) => `«${nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo)}»`;
  const enConversacion = (id: string | undefined) => {
    const raiz = l.comentarios.find((c) => c.id === id);
    return raiz?.seccion && raiz.campo ? `sobre ${dato(raiz.seccion, raiz.campo)}` : "en la conversación general";
  };
  const describir = ({ que, valor }: Pendiente): string => {
    switch (que.tipo) {
      case "correccion":
        return `la corrección sin guardar de ${dato(que.seccion, que.campo)}`;
      case "respuesta":
        return `la respuesta sin enviar ${enConversacion(que.comentarioId)}`;
      case "edicion":
        return `la edición sin guardar de su comentario ${enConversacion((valor as { id?: string }).id)}`;
      case "comentario":
        return `el comentario sin enviar sobre ${dato(que.seccion, que.campo)}`;
      case "general":
        return "el comentario general sin enviar";
    }
  };
  const corrige = sePierden.some((e) => e.que.tipo === "correccion");
  const conversa = sePierden.some((e) => e.que.tipo !== "correccion");
  return [
    ...(sePierden.length > 0
      ? [
          {
            icono: TriangleAlert,
            texto: `Se ${sePierden.length === 1 ? "pierde" : "pierden"} ${enLista(sePierden.map(describir))}`,
            detalle: corrige && conversa ? "Ya no se corrige y las conversaciones se cierran" : corrige ? "Después ya no se corrige: guarde antes lo que necesite" : "Las conversaciones se cierran: envíe antes lo que necesite",
          },
        ]
      : []),
    ...(sinRespuesta.length > 0
      ? [{ icono: MessageSquare, texto: `${l.tecnico.nombre} no podrá responder ${enLista(sinRespuesta.map(describir))}`, detalle: sinRespuesta.length === 1 ? "Envíelo antes si espera respuesta" : "Envíelos antes si espera respuesta" }]
      : []),
  ];
}

/**
 * El estado de la revisión va en la barra, junto a su acción (iteración 38), como «Guardado» junto a «Publicar»:
 * «● En revisión · la tomó usted» con «Marcar revisado». En la pantalla quedan «Siguiente», los errores y las
 * confirmaciones.
 */
function EstadoDeRevision({ l, mia, historial, recargar, mostrarPanel }: { l: Levantamiento; mia: boolean; historial: Historial | undefined; recargar: () => void; mostrarPanel: ReactNode }) {
  const tomar = useTomar();
  const marcar = useMarcarRevisado(l.id);
  const notificar = useNotificar();
  const destino = useContext(DestinoAccionesBarra);
  const sesion = useQuery(consultas.sesion());
  const [confirmando, setConfirmando] = useState<"revisado" | "reasignar" | null>(null);
  const tomada = () => notificar({ texto: "Revisión tomada: ya puede corregir" });
  const error = tomar.error ?? marcar.error;
  const invalidos = marcar.error instanceof ErrorApi ? (marcar.error.problema.errores ?? []) : [];
  const etiqueta = (seccion: string, campo?: string) => (campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo) : rutaLegible(l.formatoDefinicion, l.repeticiones, seccion));
  const nombre = l.revisor?.nombre ?? "otra persona";
  // Lo escrito y sin guardar ni enviar, al abrir la confirmación: sus consecuencias van primero.
  const pendientes = useContext(SinEnviar);
  const [loEscrito, setLoEscrito] = useState<Consecuencia[]>([]);
  const [sePierdeAlgo, setSePierdeAlgo] = useState(false);
  const confirmarRevisado = () => {
    setLoEscrito(loEscritoAlMarcar(l, pendientes?.values() ?? []));
    setSePierdeAlgo(alMarcarRevisado(pendientes?.values() ?? []).sePierden.length > 0);
    setConfirmando("revisado");
  };
  // El error de tomar o marcar revisado habla de la versión en que se intentó: con otra (una corrección guardada), se va.
  useEffect(() => {
    tomar.reset();
    marcar.reset();
  }, [l.version]);
  // Sin responsable: en revisión, pero quien la tenía fue desactivado. La toma quien llegue, sin quitársela a nadie.
  const sinResponsable = l.estado === "en_revision" && !l.revisor;
  // Revisar con el teclado (iteración 37): T toma y R marca revisado, con la confirmación de siempre.
  useTeclaSuelta("t", () => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada }), (l.estado === "enviado" || sinResponsable) && !tomar.isPending);
  useTeclaSuelta("r", confirmarRevisado, mia && l.estado === "en_revision");

  let linea: ReactNode;
  let accion: ReactNode = null;
  if (sinResponsable) {
    const soltada = [...(historial?.eventos ?? [])].reverse().find((e) => e.tipo === "revision_liberada");
    const quienLaTenia = (soltada?.anterior as { revisor?: string } | undefined)?.revisor;
    linea = (
      <>
        <b>En revisión</b> · nadie la tiene{quienLaTenia ? ` desde que se desactivó a ${quienLaTenia}` : ""}
      </>
    );
    accion = (
      <Boton variante="principal" title="Tomar para revisar · T" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada })}>
        Tomar para revisar
      </Boton>
    );
  } else if (l.estado === "enviado") {
    linea = (
      <>
        <b>Esperando revisión</b> · nadie la ha tomado
      </>
    );
    accion = (
      <Boton variante="principal" title="Tomar para revisar · T" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada })}>
        Tomar para revisar
      </Boton>
    );
  } else if (l.estado === "revisado") {
    const revisadoEn = [...(historial?.eventos ?? [])].reverse().find((e) => e.tipo === "levantamiento_revisado")?.hora;
    const quien = l.revisor?.id === sesion.data?.usuario.id ? "usted" : (l.revisor?.nombre ?? "[Sin responsable]");
    linea = (
      <>
        <b>Revisado</b> · por {quien}
        {revisadoEn ? `, ${cuandoCorto(revisadoEn)}` : ""}
      </>
    );
    accion = l.visita ? <AbrirInforme visitaId={l.visita.id} /> : null;
  } else if (mia) {
    linea = (
      <>
        <b>En revisión</b> · la tomó usted
      </>
    );
    accion = (
      <Boton variante="principal" icono={Check} title="Marcar revisado · R" onClick={confirmarRevisado}>
        Marcar revisado
      </Boton>
    );
  } else {
    linea = (
      <>
        <b>En revisión</b> · la tiene {nombre}
      </>
    );
    accion = <Boton onClick={() => setConfirmando("reasignar")}>Tomar la revisión de {nombre}</Boton>;
  }

  const barra = (
    <div className="acciones" role="region" aria-label="Revisión">
      {/* El estado cambia en su lugar al tomar o marcar revisado (iteración 27). */}
      <span className={`estado-rev ${l.estado}`} role="status" style={{ viewTransitionName: nombreDeTransicion("estado", l.id) }}>
        <i aria-hidden />
        <span>{linea}</span>
      </span>
      {mostrarPanel}
      {accion}
    </div>
  );

  return (
    <>
      {destino ? createPortal(barra, destino) : barra}
      {l.estado === "revisado" && <SiguienteEnSerie actual={l.id} />}
      {error && (
        <Aviso tono="error">
          <b>{mensajeDeError(error)}</b>
          {invalidos.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {invalidos.map((e) => (
                <li key={`${e.seccion}.${e.campo ?? ""}`}>
                  {etiqueta(e.seccion, e.campo)}: {mensajeDeValidacion[e.codigo as keyof typeof mensajeDeValidacion] ?? e.codigo}
                </li>
              ))}
            </ul>
          )}
          {pideRecargar(error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      {confirmando === "revisado" && (
        <Confirmacion
          // Con algo que se pierde, «R» y luego ↵ no lo aceptan sin leer: el foco empieza en Cancelar.
          nivel={sePierdeAlgo ? "irreversible" : "consecuencia"}
          titulo={`¿Marcar revisado el levantamiento de ${l.tecnico.nombre}?`}
          confirmar="Marcar revisado"
          consecuencias={[
            ...loEscrito,
            { icono: FileText, texto: l.visita ? "Queda listo para el informe de la visita" : "Queda listo para el informe", detalle: "Ya no se corrige desde la revisión" },
            {
              icono: Smartphone,
              texto: `${l.tecnico.nombre} lo ve como revisado en su teléfono`,
              ...(vigentes(l).length > 0 && { detalle: vigentes(l).length === 1 ? "Con el comentario de oficina" : `Con los ${vigentes(l).length} comentarios de oficina` }),
            },
            // ADR-0040: al marcar revisado, las conversaciones se cierran.
            ...(vigentes(l).length > 0 ? [{ icono: MessageSquare, texto: "Las conversaciones se cierran", detalle: `${l.tecnico.nombre} las sigue viendo en su teléfono, pero ya no responde` }] : []),
          ]}
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={async () => {
            await marcar.mutateAsync(l.version);
            // Revisado: lo que quedaba sin enviar ya no se puede enviar (la confirmación lo dijo).
            pendientes?.clear();
          }}
          alTerminar={() => notificar({ texto: "Marcado revisado" })}
        />
      )}
      {confirmando === "reasignar" && (
        <Confirmacion
          nivel="consecuencia"
          titulo={`¿Quitarle la revisión a ${nombre}?`}
          confirmar="Tomar la revisión"
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={() => tomar.mutateAsync({ id: l.id, version: l.version, reasignar: true })}
          alTerminar={tomada}
        >
          <p>Si tiene cambios sin guardar, los perderá. El cambio de responsable queda registrado.</p>
        </Confirmacion>
      )}
    </>
  );
}

/**
 * Revisar en serie (iteración 27): al marcar revisado, el que más lleva esperando, con cuántos quedan, para seguir
 * sin volver a la lista. Va encima de los datos (iteración 38), como fila y no como botón relleno: la acción principal
 * es abrir el informe.
 */
function SiguienteEnSerie({ actual }: { actual: string }) {
  const esperando = useBandeja("enviado");
  const navegar = useNavigate();
  const primera = esperando.data?.pages[0];
  const siguiente = primera?.elementos.find((e) => e.id !== actual);
  const quedan = primera ? primera.total - (primera.elementos.some((e) => e.id === actual) ? 1 : 0) : 0;
  useTeclaSuelta("s", () => siguiente && void navegar({ to: "/levantamientos/$id", params: { id: siguiente.id } }), Boolean(siguiente));
  if (esperando.isPending) return null;
  if (!siguiente) return <span className="quedan">No queda nada esperando revisión.</span>;
  return (
    <button type="button" className="siguiente-fila" title="Siguiente · S" onClick={() => void navegar({ to: "/levantamientos/$id", params: { id: siguiente.id } })}>
      <span>
        <b>Siguiente: {siguiente.visita?.cliente ?? `Levantamiento de ${siguiente.tecnico.nombre}`}</b>
        <small>
          {siguiente.nombreFormato ?? siguiente.formato} de {siguiente.tecnico.nombre} · lleva {cuantoLleva(siguiente.recibidoEn).texto} · {quedan === 1 ? "queda 1" : `quedan ${quedan}`}
        </small>
      </span>
      <ChevronRight aria-hidden size={16} />
    </button>
  );
}

function AbrirInforme({ visitaId }: { visitaId: string }) {
  const abrir = useAbrirInformeDeVisita();
  const navegar = useNavigate();
  return (
    <>
      <Boton variante="principal" icono={FileText} cargando={abrir.isPending} onClick={() => abrir.mutate(visitaId, { onSuccess: ({ id }) => void navegar({ to: "/informes/$id", params: { id } }) })}>
        Abrir el informe
      </Boton>
      {abrir.isError && <Aviso tono="error">{mensajeDeError(abrir.error)}</Aviso>}
    </>
  );
}

function FilaCampo({
  l,
  seccion,
  campo,
  mia,
  correccion,
  recargar,
  comentando,
  comentar,
  dejarDeComentar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  mia: boolean;
  correccion: { original: unknown; autor: string; motivo: string | undefined } | undefined;
  recargar: () => void;
  comentando: boolean;
  comentar: () => void;
  dejarDeComentar: () => void;
}) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  // Cada corrección guardada hace destellar el dato otra vez (iteración 27).
  const [corregido, setCorregido] = useState(0);
  const notificar = useNotificar();
  const valor = l.respuestas[seccion]?.[campo.clave];
  const hilo = vigentes(l).filter((c) => c.seccion === seccion && c.campo === campo.clave);
  // Cuántos mensajes hay en sus conversaciones: el comentario y sus respuestas (ADR-0040).
  const mensajes = hilo.reduce((n, c) => n + 1 + respuestasDe(l, c.id).length, 0);
  const verConversacion = useContext(VerConversacion);
  const nombreEnFrase = campo.etiqueta.toLowerCase();

  // Marcado revisado, la corrección abierta ya no se puede guardar: se pierde, como dijo la confirmación.
  if (corrigiendo && l.estado !== "revisado") {
    return (
      <div className="dato editando" id={idDato(seccion, campo.clave)}>
        <span className="nombre">{campo.etiqueta}</span>
        <EditorCorreccion
          l={l}
          seccion={seccion}
          campo={campo}
          valor={valor}
          cerrar={() => setCorrigiendo(false)}
          alGuardar={() => {
            setCorrigiendo(false);
            setCorregido((n) => n + 1);
            notificar({ texto: `Corrección guardada: ${campo.etiqueta}` });
          }}
          recargar={recargar}
        />
      </div>
    );
  }

  // Fotos, bocetos y firmas son de campo: oficina no los corrige (la firma, de quien recibió la visita).
  const corregible = mia && campo.tipo !== "foto" && campo.tipo !== "boceto" && campo.tipo !== "firma";

  return (
    <div key={corregido} className={`dato ${corregido > 0 ? "recien" : ""}`} id={idDato(seccion, campo.clave)}>
      <span className="nombre">
        {campo.etiqueta}
        {hilo.length > 0 && (
          <>
            <br />
            <span className="n-com">
              <MessageSquare aria-hidden size={12} />
              {mensajes}
            </span>
          </>
        )}
      </span>
      <div>
        <ValorDelCampo l={l} seccion={seccion} campo={campo} valor={valor} mia={mia} correccion={correccion} recargar={recargar} />
      </div>
      <div className="acc">
        {corregible && (
          <Boton variante="fantasma" tamano="pequeno" icono={Pencil} aria-label={`Corregir ${nombreEnFrase}`} onClick={() => setCorrigiendo(true)}>
            Corregir
          </Boton>
        )}
        <button type="button" className="icono-btn limpio chico" title={`Comentar sobre ${nombreEnFrase}`} aria-label={`Comentar ${nombreEnFrase}`} onClick={comentar}>
          <MessageSquare aria-hidden size={16} />
        </button>
      </div>
      {hilo.length > 0 && (
        <div className="hilo">
          {/* Bajo el dato, el comentario, la última respuesta y el camino a la conversación (ADR-0040). */}
          {hilo.map((c) => {
            const respuestas = respuestasDe(l, c.id);
            const delTecnico = respuestas.filter((r) => r.de === "tecnico").at(-1);
            const nueva = delTecnico && l.conversacion?.sinLeer && (!l.leidoHasta || delTecnico.creadoEn > l.leidoHasta);
            return (
              <button key={c.id} type="button" className="burbuja hilo-res" onClick={() => verConversacion?.(c.id)}>
                <small>
                  {c.autor.nombre} · {aFechaCorta(c.creadoEn)} · para el técnico{c.editadoEn ? " · Editado" : ""}
                </small>
                <span style={{ whiteSpace: "pre-line" }}>{c.texto}</span>
                {delTecnico && (
                  <span className="resp-r">
                    {nueva && <i className="punto" aria-label="Sin leer" />}
                    <b>{delTecnico.autor.nombre}:</b> {delTecnico.texto}
                  </span>
                )}
                <span className="ver-r">
                  {respuestas.length > 0 ? `${respuestas.length === 1 ? "1 respuesta" : `${respuestas.length} respuestas`} · ` : ""}Ver la conversación
                </span>
              </button>
            );
          })}
        </div>
      )}
      {comentando && <ComentarAqui l={l} seccion={seccion} campo={campo.clave} nombre={nombreEnFrase} cerrar={dejarDeComentar} />}
    </div>
  );
}

/** El valor, como lo lee una persona. Una medida se ve grande con su unidad; lo corregido, con el valor anterior tachado. */
function ValorDelCampo({
  l,
  seccion,
  campo,
  valor,
  mia,
  correccion,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  valor: Valor | undefined;
  mia: boolean;
  correccion: { original: unknown; autor: string; motivo: string | undefined } | undefined;
  recargar: () => void;
}) {
  if (campo.tipo === "foto" && Array.isArray(valor)) return <Fotos etiqueta={campo.etiqueta} huellas={valor as readonly string[]} puestos={campo.puestos} />;
  if (campo.tipo === "boceto" && esBoceto(valor)) return <BocetoDeCampo etiqueta={campo.etiqueta} huella={valor.boceto} />;
  if (campo.tipo === "firma" && esFirma(valor)) return <FirmaDeCampo valor={valor} tecnico={l.tecnico.nombre} />;
  if (campo.tipo === "cantidades" && esCantidades(valor)) return <LineasDeCantidad l={l} seccion={seccion} campo={campo} lineas={valor} mia={mia} recargar={recargar} />;
  if (esNoObtenido(valor)) {
    return (
      <span className="no-obtenido">
        <TriangleAlert aria-hidden size={18} />
        No obtenido{valor.motivo ? <span> · {valor.motivo}</span> : null}
      </span>
    );
  }

  const antes = correccion ? <span className="antes">{describirValor(campo, correccion.original as Valor | undefined)}</span> : null;
  const marca = correccion && (
    <span className="corregido">
      <Pencil aria-hidden size={13} />
      Corregido por {correccion.autor}
      {correccion.motivo ? ` · ${correccion.motivo}` : ""}
    </span>
  );
  if (valor === undefined || valor === null) {
    return (
      <>
        <div className="sec">
          {antes}
          {describirValor(campo, valor)}
        </div>
        {marca}
      </>
    );
  }
  if (campo.tipo === "medida" && typeof valor === "object" && "valor" in valor) {
    const m = valor as ValorMedida;
    return (
      <>
        <div className="valor-medida">
          {antes}
          <span>
            {m.valor.replace(".", ",")} <small>{m.unidad}</small>
          </span>
        </div>
        {marca}
      </>
    );
  }
  return (
    <>
      <div className="fuerte" style={{ whiteSpace: "pre-line" }}>
        {antes}
        <span>{describirValor(campo, valor)}</span>
      </div>
      {marca}
    </>
  );
}

/** Corrección de un campo, con las mismas reglas del envío (QA-8: queda con valor anterior y nuevo). */
function EditorCorreccion({
  l,
  seccion,
  campo,
  valor,
  cerrar,
  alGuardar,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  valor: Valor | undefined;
  cerrar: () => void;
  alGuardar: () => void;
  recargar: () => void;
}) {
  const corregir = useCorregir(l.id);
  const noObtenidoAntes = esNoObtenido(valor);
  const [nuevo, setNuevo] = useState<Valor | undefined>(valor);
  const [valido, setValido] = useState(true);
  // Lo que muestra el control y si se puede leer: marcar «No se pudo obtener» no lo borra, y desmarcarlo vuelve a él.
  const delControl = useRef<{ valor: Valor | undefined; valido: boolean }>({ valor: noObtenidoAntes ? undefined : valor, valido: true });
  const desdeElControl = (escrito: Valor | undefined, esValido = true) => {
    delControl.current = { valor: escrito, valido: esValido };
    setNuevo(escrito);
    setValido(esValido);
  };
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const idMotivo = `motivo-${seccion}-${campo.clave}`;
  const errorDelCampo = corregir.error instanceof ErrorApi ? corregir.error.problema.errores?.find((e) => e.seccion === seccion && e.campo === campo.clave) : undefined;
  const mensajeCampo = errorDelCampo ? mensajeDeValidacion[errorDelCampo.codigo as keyof typeof mensajeDeValidacion] : undefined;
  const marcado = esNoObtenido(nuevo);
  const enCurso = useContext(CorreccionEnCurso);
  useEffect(() => enCurso?.avisar({ seccion, campo: campo.clave, valor: nuevo }), [nuevo]);
  useEffect(() => () => enCurso?.avisar(null), []);
  // Escrita y sin guardar: «Marcar revisado» dice que se pierde.
  const pendientes = useContext(SinEnviar);
  const escrita = motivo.trim() !== "" || JSON.stringify(nuevo ?? null) !== JSON.stringify(valor ?? null);
  useEffect(() => {
    const que: Escrito = { tipo: "correccion", seccion, campo: campo.clave };
    const clave = JSON.stringify(que);
    if (escrita) pendientes?.set(clave, { que, valor: true });
    return () => void pendientes?.delete(clave);
  }, [escrita]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    // El motivo queda en el historial junto al valor anterior (regla 8): sin él, el registro no dice por qué.
    if (!motivo.trim()) {
      setFaltaMotivo(true);
      document.getElementById(idMotivo)?.focus();
      return;
    }
    try {
      await corregir.mutateAsync({ version: l.version, correcciones: [{ seccion, campo: campo.clave, valor: nuevo ?? null }], motivo: motivo.trim() });
      alGuardar();
    } catch {
      // El error queda a la vista en el formulario.
    }
  }

  const control = (() => {
    switch (campo.tipo) {
      case "texto":
        return (
          <CampoTexto
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            valorInicial={typeof valor === "string" ? valor : ""}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto) => desdeElControl(texto === "" ? undefined : texto)}
          />
        );
      case "medida": {
        const medida = valor && !noObtenidoAntes && typeof valor === "object" && "valor" in valor ? (valor as ValorMedida) : undefined;
        return (
          <CampoMedida
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            unidades={campo.unidades}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                desdeElControl(undefined);
                return true;
              }
              // Una medida que no se puede leer deja el último valor bueno, pero no se guarda.
              const m = crearMedida(texto, unidad, campo.unidades);
              desdeElControl(m ?? delControl.current.valor, m !== null);
              return m !== null;
            }}
          />
        );
      }
      case "cantidades": {
        const lineas = esCantidades(valor) ? valor : [];
        return <CorregirCantidades etiqueta={`Líneas corregidas de ${campo.etiqueta.toLowerCase()}`} inicial={lineas} unidades={campo.unidades} deshabilitado={marcado} error={marcado ? undefined : mensajeCampo} onCambio={(v) => desdeElControl(v)} />;
      }
      default:
        return null;
    }
  })();

  return (
    <form className="editor-inline" onSubmit={(e) => void guardar(e)} noValidate>
      {control}
      {campo.obligatorio && (
        <MarcaNoObtenido
          dato={campo.etiqueta}
          marcado={marcado}
          motivoInicial={noObtenidoAntes ? valor.motivo : ""}
          error={marcado ? mensajeCampo : undefined}
          // Marcar o desmarcar reinicia la validez: marcado no importa lo escrito; desmarcado, vale lo que muestra el control.
          onMarcar={(m, motivoNoObtenido) => {
            setNuevo(m ? { noObtenido: true, motivo: motivoNoObtenido } : delControl.current.valor);
            setValido(m || delControl.current.valido);
          }}
          onMotivo={(motivoNoObtenido) => setNuevo({ noObtenido: true, motivo: motivoNoObtenido })}
        />
      )}
      <div className="campo">
        <label htmlFor={idMotivo}>
          Motivo de la corrección <small className="sec">obligatorio · queda en el historial</small>
        </label>
        <input
          id={idMotivo}
          className={`control ${faltaMotivo && !motivo.trim() ? "error" : ""}`}
          placeholder="Por ejemplo: la placa dice 25 kVA"
          maxLength={500}
          value={motivo}
          aria-invalid={(faltaMotivo && !motivo.trim()) || undefined}
          aria-describedby={faltaMotivo && !motivo.trim() ? `${idMotivo}-error` : undefined}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {faltaMotivo && !motivo.trim() && (
          <p id={`${idMotivo}-error`} className="msj-error">
            Escriba el motivo: queda en el historial junto al valor anterior.
          </p>
        )}
      </div>
      {corregir.isError && !errorDelCampo && (
        <Aviso tono="error">
          <b>{mensajeDeError(corregir.error)}</b>
          {pideRecargar(corregir.error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      {enCurso &&
        (enCurso.verCapitulo ? (
          <Boton variante="fantasma" tamano="pequeno" icono={FileText} className="ir-capitulo" onClick={enCurso.verCapitulo}>
            Ver cómo queda en el informe
          </Boton>
        ) : (
          <p className="ayuda">El capítulo de la derecha ya muestra el valor nuevo, resaltado.</p>
        ))}
      <div className="fila-botones">
        <Boton onClick={cerrar} disabled={corregir.isPending}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="principal" cargando={corregir.isPending} disabled={!valido}>
          Guardar corrección
        </Boton>
      </div>
    </form>
  );
}

/** El comentario sobre un dato se escribe debajo de su fila: no hay que ir al panel y volver. */
function ComentarAqui({ l, seccion, campo, nombre, cerrar }: { l: Levantamiento; seccion: string; campo: string; nombre: string; cerrar: () => void }) {
  const comentar = useComentar(l.id);
  // Abrir el globo de otra fila no lo borra: al volver a este, sigue lo escrito.
  const [texto, setTexto] = useSinEnviar({ tipo: "comentario", seccion, campo }, "");
  const [vacio, setVacio] = useState(false);
  const descartar = () => {
    setTexto("");
    cerrar();
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) {
      setVacio(true);
      return;
    }
    try {
      await comentar.mutateAsync({ texto: texto.trim(), seccion, campo });
      descartar();
    } catch {
      // El error queda a la vista.
    }
  }

  return (
    <form className="comentar-aqui" onSubmit={(e) => void enviar(e)} noValidate>
      <label className="sr-only" htmlFor={`comentario-${seccion}-${campo}`}>
        Nuevo comentario
      </label>
      <textarea
        id={`comentario-${seccion}-${campo}`}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- se abre con el globo de la fila: el foco va donde se escribe
        autoFocus
        className={`control ${vacio ? "error" : ""}`}
        maxLength={1000}
        placeholder={`Qué debe revisar el técnico sobre ${nombre}`}
        style={{ minHeight: 70 }}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setVacio(false);
        }}
      />
      {comentar.isError && <Aviso tono="error">{mensajeDeError(comentar.error)}</Aviso>}
      <div className="fila-botones">
        <Boton tamano="pequeno" onClick={descartar}>
          Cancelar
        </Boton>
        <Boton type="submit" tamano="pequeno" variante="principal" icono={Send} cargando={comentar.isPending}>
          Enviar comentario
        </Boton>
      </div>
    </form>
  );
}

/** Las conversaciones que ve el técnico: los comentarios de oficina que no están retirados (ADR-0035, ADR-0040). */
const vigentes = (l: Levantamiento) => l.comentarios.filter((c) => !c.retirado && !c.enRespuestaA);
/** Las respuestas de una conversación, en orden. */
const respuestasDe = (l: Levantamiento, comentarioId: string) => l.comentarios.filter((c) => c.enRespuestaA === comentarioId);

type ComentarioDeOficina = Levantamiento["comentarios"][number];

/** Mensajes seguidos de la misma persona, a menos de 10 minutos: un solo nombre y una sola hora, como en Slack. */
const MISMO_GRUPO_MS = 10 * 60_000;

/**
 * Las conversaciones con el técnico (ADR-0040, prototipos/hilos, «Oficina · revisión»): una por comentario de oficina,
 * separadas por una línea fina, como un hilo de Slack: el dato del que habla, el comentario, «N respuestas», lo nuevo
 * bajo la línea «Nuevo» y el campo para responder. Se cierran al marcar revisado. Su autor edita o borra el comentario
 * que abre la conversación hasta que está Revisado (ADR-0035): borrar no pide confirmar, queda «Comentario retirado»
 * con «Deshacer». El campo de abajo es para un comentario general.
 */
function Comentarios({ l, usuarioId, enfocado }: { l: Levantamiento; usuarioId: string | undefined; enfocado: { id: string; vez: number } | null }) {
  const comentar = useComentar(l.id);
  const corregir = useCorregirComentario(l.id);
  const notificar = useNotificar();
  // Lo que se escribe aquí sigue ahí al cambiar de pestaña, ocultar el panel o cerrar la hoja lateral.
  const [editando, setEditando] = useSinEnviar<{ id: string; texto: string } | null>({ tipo: "edicion" }, null);
  // Lo leído al abrir la pestaña: la línea «Nuevo» se queda mientras se ve.
  const [leidoAlAbrir] = useState(l.leidoHasta);
  const revisado = l.estado === "revisado";
  const corregible = (c: ComentarioDeOficina) => c.autor.id === usuarioId && !revisado;
  // «Deshacer» (en la notificación o en el comentario) restaura una sola vez: si ya no está retirado, o ya se está
  // restaurando, no hace nada. Si no, la segunda vez el servidor respondería «no estaba retirado» como un error.
  const ultimo = useRef(l);
  ultimo.current = l;
  const restaurando = useRef(new Set<string>());
  const restaurar = (comentarioId: string) => {
    if (restaurando.current.has(comentarioId) || !ultimo.current.comentarios.find((c) => c.id === comentarioId)?.retirado) return;
    restaurando.current.add(comentarioId);
    void corregir
      .mutateAsync({ comentarioId, accion: { tipo: "restaurar" } })
      .catch(() => undefined)
      .finally(() => restaurando.current.delete(comentarioId));
  };
  const retirar = (comentarioId: string) =>
    corregir.mutate(
      { comentarioId, accion: { tipo: "retirar" } },
      { onSuccess: () => notificar({ texto: "Comentario retirado", accion: { texto: "Deshacer", alHacer: () => restaurar(comentarioId) } }) },
    );

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!editando?.texto.trim()) return;
    try {
      await corregir.mutateAsync({ comentarioId: editando.id, accion: { tipo: "editar", texto: editando.texto.trim() } });
      setEditando(null);
    } catch {
      // El error queda a la vista.
    }
  }
  // Solo lo recién llegado entra animado; lo demás no se anima otra vez al volver a la pestaña.
  const esNuevo = useLoNuevo(l.comentarios.map((c) => c.id));
  const [texto, setTexto] = useSinEnviar({ tipo: "general" }, "");
  const raices = l.comentarios.filter((c) => !c.enRespuestaA);

  function irALaFila(seccion: string, campo: string) {
    const fila = document.getElementById(idDato(seccion, campo));
    fila?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "center" });
    fila?.classList.remove("recien");
    void fila?.offsetWidth;
    fila?.classList.add("recien");
  }

  // El hilo al que lleva un aviso o «Ver la conversación»: a la vista y destellando.
  useEffect(() => {
    if (!enfocado) return;
    const hilo = document.getElementById(`hilo-${enfocado.id}`);
    hilo?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });
    hilo?.classList.remove("destella");
    void hilo?.offsetWidth;
    hilo?.classList.add("destella");
  }, [enfocado?.vez]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) return;
    try {
      await comentar.mutateAsync({ texto: texto.trim() });
      setTexto("");
    } catch {
      // El error queda a la vista.
    }
  }

  /** Avatar, nombre y hora una vez por grupo; los textos, planos y sin globos. */
  function mensajes(lista: ComentarioDeOficina[]) {
    const grupos: { autor: ComentarioDeOficina["autor"]; de: ComentarioDeOficina["de"]; en: string; textos: ComentarioDeOficina[] }[] = [];
    for (const c of lista) {
      const ultimo = grupos.at(-1);
      if (ultimo && ultimo.autor.id === c.autor.id && Date.parse(c.creadoEn) - Date.parse(ultimo.textos.at(-1)!.creadoEn) < MISMO_GRUPO_MS) ultimo.textos.push(c);
      else grupos.push({ autor: c.autor, de: c.de, en: c.creadoEn, textos: [c] });
    }
    return grupos.map((g) => (
      <div key={g.textos[0]!.id} className={`grupo-m ${g.textos.some((c) => esNuevo(c.id)) ? "llega" : ""}`}>
        <span className={`av-m ${g.de === "tecnico" ? "tec" : ""}`} aria-hidden>
          {iniciales(g.autor.nombre)}
        </span>
        <div>
          <div className="cab-m">
            <b>{g.autor.id === usuarioId ? "Usted" : g.autor.nombre}</b>
            <span>{cuandoCorto(g.en)}</span>
          </div>
          {g.textos.map((c) => (
            <p key={c.id} className="txt-m">
              {c.texto}
              {/* Su autor lo corrigió (ADR-0035): se dice cuándo. */}
              {c.editadoEn && <small className="editado-m">{`Editado ${aFechaCorta(c.editadoEn)}`}</small>}
            </p>
          ))}
        </div>
      </div>
    ));
  }

  function conversacion(raiz: ComentarioDeOficina) {
    const respuestas = respuestasDe(l, raiz.id);
    const definicion = raiz.seccion && raiz.campo ? campoDeRuta(l.formatoDefinicion, l.repeticiones, raiz.seccion, raiz.campo) : undefined;
    const valor = definicion && raiz.seccion ? (l.respuestas[raiz.seccion]?.[definicion.clave] as Valor | undefined) : undefined;
    const vacio = valor === undefined || valor === null || valor === "";
    // Lo nuevo: lo que respondió el técnico después de lo que se leyó al abrir.
    const primeraNueva = respuestas.findIndex((r) => r.de === "tecnico" && (!leidoAlAbrir || r.creadoEn > leidoAlAbrir));
    const antes = primeraNueva < 0 ? respuestas : respuestas.slice(0, primeraNueva);
    const nuevas = primeraNueva < 0 ? [] : respuestas.slice(primeraNueva);
    return (
      <section key={raiz.id} id={`hilo-${raiz.id}`} className="hilo-o" aria-label={definicion ? `Conversación sobre ${definicion.etiqueta}` : "Conversación general"}>
        {definicion && raiz.seccion && raiz.campo && (
          <button type="button" className="dato-o" title="Ir al dato" onClick={() => irALaFila(raiz.seccion!, raiz.campo!)}>
            <small>{rutaLegible(l.formatoDefinicion, l.repeticiones, raiz.seccion)}</small>
            <span className="fila-d">
              <b>{definicion.etiqueta}</b>
              {vacio ? <span className="sin">Sin dato</span> : <span>{describirValor(definicion, valor)}</span>}
            </span>
          </button>
        )}
        {raiz.retirado ? (
          <div className="nota-c retirado">
            <span>{`Comentario retirado por ${raiz.retirado.por.nombre} · ${aFechaCorta(raiz.retirado.en)}`}</span>
            {corregible(raiz) && (
              <button type="button" className="accion-envio" onClick={() => restaurar(raiz.id)}>
                Deshacer
              </button>
            )}
          </div>
        ) : editando?.id === raiz.id ? (
          <form className="nota-c" onSubmit={(e) => void guardarEdicion(e)} noValidate>
            <label className="sr-only" htmlFor={`editar-${raiz.id}`}>
              Comentario
            </label>
            <textarea
              id={`editar-${raiz.id}`}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- se abre con "Editar": el foco va donde se escribe
              autoFocus
              className="control"
              maxLength={1000}
              style={{ minHeight: 64 }}
              value={editando.texto}
              onChange={(e) => setEditando({ id: raiz.id, texto: e.target.value })}
            />
            <div className="fila-flex" style={{ justifyContent: "flex-end", gap: 6 }}>
              <Boton tamano="pequeno" onClick={() => setEditando(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" tamano="pequeno" variante="principal" cargando={corregir.isPending} disabled={!editando.texto.trim() || editando.texto.trim() === raiz.texto}>
                Guardar
              </Boton>
            </div>
          </form>
        ) : (
          <>
            <div className="raiz-m">
              {mensajes([raiz])}
              {corregible(raiz) && (
                <MenuAcciones
                  etiqueta="Más acciones para el comentario"
                  opciones={[
                    { texto: "Editar", alElegir: () => setEditando({ id: raiz.id, texto: raiz.texto }) },
                    { texto: "Borrar", peligro: true, alElegir: () => retirar(raiz.id) },
                  ]}
                />
              )}
            </div>
            {respuestas.length > 0 && <div className="n-resp">{respuestas.length === 1 ? "1 respuesta" : `${respuestas.length} respuestas`}</div>}
            {mensajes(antes)}
            {nuevas.length > 0 && <div className="nuevo-o">Nuevo</div>}
            {mensajes(nuevas)}
            {revisado ? (
              <p className="cerrado-h">
                <LockKeyhole aria-hidden size={14} />
                {`Cerrada al marcar revisado. ${l.tecnico.nombre} la sigue viendo.`}
              </p>
            ) : (
              <ResponderEnHilo l={l} raiz={raiz} sobre={definicion?.etiqueta} />
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Comentarios al técnico" className="hilos">
      <p className="nota-panel">{revisado ? "Cerradas al marcar revisado." : `Lo que escriba aquí le llega a ${l.tecnico.nombre} en su teléfono.`}</p>
      {raices.length === 0 ? <p className="ayuda">Sin comentarios. Para uno sobre un dato, use el globo de su fila.</p> : raices.map(conversacion)}
      {corregir.isError && <Aviso tono="error">{mensajeDeError(corregir.error)}</Aviso>}
      <form className="col general-o" style={{ gap: 8 }} onSubmit={(e) => void enviar(e)} noValidate>
        <label className="sr-only" htmlFor="comentario-general">
          Comentario general
        </label>
        <textarea
          id="comentario-general"
          className="control"
          maxLength={1000}
          placeholder="Comentario general. Para uno sobre un dato, use el globo de su fila"
          style={{ minHeight: 76 }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {comentar.isError && <Aviso tono="error">{mensajeDeError(comentar.error)}</Aviso>}
        <div>
          <Boton type="submit" tamano="pequeno" icono={Send} cargando={comentar.isPending} disabled={!texto.trim()}>
            Enviar comentario
          </Boton>
        </div>
      </form>
    </section>
  );
}

/** Responder en una conversación (ADR-0040): ↵ envía y ⇧↵ hace otra línea. */
function ResponderEnHilo({ l, raiz, sobre }: { l: Levantamiento; raiz: ComentarioDeOficina; sobre: string | undefined }) {
  const comentar = useComentar(l.id);
  // La respuesta a medias sigue ahí al cambiar de pestaña, ocultar el panel o cerrar la hoja lateral.
  const [texto, setTexto] = useSinEnviar({ tipo: "respuesta", comentarioId: raiz.id }, "");
  const vacio = !texto.trim();
  async function enviar() {
    if (vacio || comentar.isPending) return;
    try {
      await comentar.mutateAsync({ texto: texto.trim(), enRespuestaA: raiz.id });
      setTexto("");
    } catch {
      // El error queda a la vista.
    }
  }
  return (
    <form
      className="redactar-o"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <textarea
        rows={1}
        maxLength={1000}
        placeholder="Responder…"
        aria-label={sobre ? `Responder a ${l.tecnico.nombre} sobre ${sobre}` : `Responder a ${l.tecnico.nombre}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void enviar();
          }
        }}
      />
      <button type="submit" className="enviar-o" aria-label="Responder" title="Enviar · ↵ (⇧ ↵ para otra línea)" aria-disabled={vacio || comentar.isPending}>
        <ArrowUp aria-hidden size={15} strokeWidth={2.2} />
      </button>
      {comentar.isError && <Aviso tono="error">{mensajeDeError(comentar.error)}</Aviso>}
    </form>
  );
}

/** Id de una línea nueva: 8 caracteres en base 36, como los que genera campo. */
const nuevoIdDeLinea = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");

/**
 * Las líneas de cantidad corregidas: la cantidad se escribe como la lee una persona ("12,5") y se guarda
 * como decimal canónico; si no se puede leer, va tal cual y el servidor la marca.
 */
function CorregirCantidades({
  etiqueta,
  inicial,
  unidades,
  deshabilitado,
  error,
  onCambio,
}: {
  etiqueta: string;
  inicial: readonly LineaCantidad[];
  unidades: readonly string[];
  deshabilitado: boolean;
  error: string | undefined;
  onCambio: (valor: Valor | undefined) => void;
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>(() => inicial.map((l) => ({ ...l, cantidad: l.cantidad.replace(".", ","), observacion: l.observacion ?? "" })));
  if (deshabilitado) return null;
  // El ítem que eligió el técnico viaja con su línea (ADR-0025): corregir la cantidad no lo borra del documento.
  const itemDe = new Map(inicial.flatMap((l) => (l.item ? [[l.id, l.item] as const] : [])));
  function cambiar(nuevas: LineaEditable[]) {
    setLineas(nuevas);
    onCambio(
      nuevas.length === 0
        ? undefined
        : nuevas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: normalizarDecimal(l.cantidad) ?? l.cantidad,
            unidad: l.unidad,
            ...(l.observacion.trim() ? { observacion: l.observacion.trim() } : {}),
            ...(itemDe.has(l.id) ? { item: itemDe.get(l.id)! } : {}),
          })),
    );
  }
  return <EditorCantidades etiqueta={etiqueta} lineas={lineas} unidades={unidades} onCambio={cambiar} nuevoId={nuevoIdDeLinea} error={error} disposicion="tabla" />;
}

/**
 * Tabla de cantidades con su vínculo al catálogo (iteración 11). Quien tiene la revisión elige el ítem
 * de cada línea; el técnico escribió texto libre y no lo elige (regla 6).
 */
function LineasDeCantidad({ l, seccion, campo, lineas, mia, recargar }: { l: Levantamiento; seccion: string; campo: DefinicionCampo; lineas: readonly LineaCantidad[]; mia: boolean; recargar: () => void }) {
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: mia });
  const vincular = useVincular(l.id);
  const vinculoDe = (linea: string) => l.vinculos.find((v) => v.seccion === seccion && v.campo === campo.clave && v.linea === linea);
  // Lo eligió el técnico y nadie lo ha cambiado (ADR-0025): quien revisa sabe qué confirmar.
  const deCampo = (linea: string) => vinculoDe(linea)?.elegidoEnCampo && <span className="sub">Elegido en campo</span>;

  function celda(linea: string) {
    const actual = vinculoDe(linea)?.item;
    if (!mia) {
      return actual ? (
        <>
          <span className="fuerte">{`${actual.codigo} · ${actual.descripcion}`}</span>
          {deCampo(linea)}
        </>
      ) : (
        <Insignia tono="alerta">Sin vincular</Insignia>
      );
    }
    if (catalogo.isPending) return <span className="sec">Cargando el catálogo…</span>;
    if (catalogo.isError) return <span className="msj-error">No se pudo cargar el catálogo</span>;
    const activos = catalogo.data.items.filter((i) => i.activo || i.id === actual?.id);
    if (activos.length === 0) return <span className="sec">El catálogo está vacío</span>;
    const numero = lineas.findIndex((x) => x.id === linea) + 1;
    return (
      <div style={{ maxWidth: 300 }}>
        <CampoSeleccion
          etiqueta={`Ítem del catálogo para la línea ${numero}`}
          etiquetaOculta
          vacio="Sin vincular"
          valor={actual?.id ?? ""}
          deshabilitado={vincular.isPending}
          onCambio={(itemId) => vincular.mutate({ version: l.version, seccion, campo: campo.clave, linea, itemId: itemId || null })}
          opciones={activos.map((i) => ({ valor: i.id, texto: `${i.codigo} · ${i.descripcion} (${i.unidad})` }))}
        />
        {deCampo(linea)}
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="tabla-caja">
        <table className="tabla" aria-label={campo.etiqueta}>
          <thead>
            <tr>
              <th scope="col">Material</th>
              <th scope="col" className="num">
                Cantidad
              </th>
              <th scope="col">Catálogo</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((x, j) => (
              <tr key={x.id} style={{ "--i": j } as CSSProperties}>
                <td>
                  <span className="fuerte">{x.descripcion}</span>
                  {x.observacion && <span className="sub">{x.observacion}</span>}
                </td>
                <td className="num">
                  <span className="fuerte">{x.cantidad.replace(".", ",")}</span> <span className="sec">{x.unidad}</span>
                </td>
                <td>{celda(x.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vincular.isError && (
        <Aviso tono="error">
          <b>{mensajeDeError(vincular.error)}</b>
          {pideRecargar(vincular.error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
    </div>
  );
}

const QUE_PASO: Record<string, { texto: string; icono: LucideIcon }> = {
  levantamiento_creado: { texto: "Creó el levantamiento en el teléfono", icono: Smartphone },
  levantamiento_enviado: { texto: "Envió el levantamiento", icono: Send },
  revision_tomada: { texto: "Tomó la revisión", icono: UserRound },
  revision_reasignada: { texto: "Tomó la revisión", icono: UserRound },
  revision_liberada: { texto: "Dejó la revisión sin tomar", icono: UserRound },
  campo_corregido: { texto: "Corrigió", icono: Pencil },
  levantamiento_revisado: { texto: "Marcó el levantamiento revisado", icono: Check },
  comentario_agregado: { texto: "Comentó", icono: MessageSquare },
  comentario_respondido: { texto: "Respondió", icono: MessageSquare },
  comentario_editado: { texto: "Editó su comentario", icono: Pencil },
  comentario_retirado: { texto: "Retiró su comentario", icono: MessageSquare },
  comentario_restaurado: { texto: "Restauró su comentario", icono: MessageSquare },
  linea_vinculada: { texto: "Vinculó al catálogo", icono: Link2 },
};

/** Historial legible por campo (ADR-0008), con la verificación de la cadena. */
function HistorialDeCambios({ l, historial }: { l: Levantamiento; historial: ReturnType<typeof useQuery<Historial>> }) {
  const { formatoDefinicion: formato, repeticiones } = l;
  const vinculadas = historial.data?.eventos.some((e) => e.tipo === "linea_vinculada") ?? false;
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: vinculadas });
  const codigoDe = (itemId: string | null | undefined) => (itemId ? (catalogo.data?.items.find((i) => i.id === itemId)?.codigo ?? "un ítem") : "sin vincular");
  const descripcionDeLinea = (seccion: string | undefined, clave: string | undefined, linea: string | undefined) => {
    const valor = seccion && clave ? l.respuestas[seccion]?.[clave] : undefined;
    return (esCantidades(valor) ? valor.find((x) => x.id === linea)?.descripcion : undefined) ?? "una línea quitada";
  };
  const campo = (seccion?: string, clave?: string) => (seccion && clave ? campoDeRuta(formato, repeticiones, seccion, clave) : undefined);
  const nombreDe = (seccion: string | undefined, definicion: DefinicionCampo) => (seccion ? nombreDeDato(formato, repeticiones, seccion, definicion.clave, true) : definicion.etiqueta.toLowerCase());

  function detalle(e: Evento): ReactNode {
    const definicion = campo(e.seccion, e.campo);
    const revisorAnterior = (e.anterior as { revisor?: string } | undefined)?.revisor;
    if (e.tipo === "campo_corregido" && definicion) {
      return (
        <>
          <br />
          <span className="cambio">
            {nombreDe(e.seccion, definicion)}: <del>{describirValor(definicion, e.anterior as Valor | undefined)}</del> → <ins>{describirValor(definicion, e.nuevo as Valor | undefined)}</ins>
          </span>
        </>
      );
    }
    if (e.tipo === "revision_reasignada" && revisorAnterior) return ` que tenía ${revisorAnterior}`;
    if (e.tipo === "revision_liberada" && revisorAnterior) return ` al desactivar a ${revisorAnterior}`;
    if (e.tipo === "linea_vinculada") {
      const antes = e.anterior as { linea?: string; item?: string | null } | undefined;
      const despues = e.nuevo as { linea?: string; item?: string | null } | undefined;
      return ` “${descripcionDeLinea(e.seccion, e.campo, despues?.linea)}”: ${codigoDe(antes?.item)} → ${codigoDe(despues?.item)}`;
    }
    if (e.tipo === "comentario_editado") return `: “${(e.anterior as { texto?: string } | undefined)?.texto ?? ""}” → “${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
    if (e.tipo === "comentario_agregado" || e.tipo === "comentario_respondido") return ` ${definicion ? `sobre ${nombreDe(e.seccion, definicion)}: ` : ""}“${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
    return null;
  }

  return (
    <section aria-label="Historial de cambios" className="col" style={{ gap: 10 }}>
      <div className="fila-flex entre">
        <span className="ayuda">Todo cambio queda con autor y fecha.</span>
        {historial.data && <Insignia tono={historial.data.integra ? "exito" : "peligro"}>{historial.data.integra ? "Historial íntegro" : "El historial fue alterado fuera del sistema"}</Insignia>}
      </div>
      {historial.isPending ? (
        <EsqueletoLista etiqueta="Cargando el historial" filas={3} />
      ) : historial.isError ? (
        <Aviso tono="error">
          <b>No se pudo cargar el historial.</b>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void historial.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : (
        <ul className="historial">
          {[...historial.data.eventos].reverse().map((e) => {
            const que = QUE_PASO[e.tipo];
            const Icono = que?.icono ?? Pencil;
            return (
              <li key={e.secuencia}>
                <span className="ico">
                  <Icono aria-hidden size={15} />
                </span>
                <div className="que">
                  <b>{e.autor.nombre}</b> {que?.texto.toLowerCase() ?? e.tipo}
                  {detalle(e)}
                  <div className="cuando">
                    {aFechaCorta(e.hora)}
                    {e.motivo && ` · Motivo: ${e.motivo}`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Boceto (ADR-0019): el servidor entrega el documento ya verificado y se dibuja en papel claro, hoja por hoja (ADR-0026). */
function BocetoDeCampo({ etiqueta, huella }: { etiqueta: string; huella: string }) {
  const boceto = useQuery(consultas.boceto(huella));
  if (boceto.isPending) return <div aria-busy="true" aria-label="Cargando el boceto" className="esq" style={{ height: 200, marginTop: 10 }} />;
  if (boceto.isError) {
    return (
      <Aviso tono="error">
        <b>No se pudo cargar el boceto.</b>
        <div>
          <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void boceto.refetch()}>
            Reintentar
          </Boton>
        </div>
      </Aviso>
    );
  }
  return (
    <div className="hojas-papel">
      <HojasDeBoceto hojas={hojasDe(boceto.data)} cuadricula={boceto.data.cuadricula} etiqueta={`Boceto de ${etiqueta.toLowerCase()}`} />
    </div>
  );
}

/** La firma es un boceto de una sola hoja (ADR-0024). */
function FirmaDibujada({ documento, etiqueta }: { documento: DocumentoBoceto; etiqueta: string }) {
  const trazos = hojasDe(documento)[0]!;
  return <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={etiqueta} className="max-h-28" />;
}

/** Firma de quien recibe la visita (ADR-0024): la firma en papel, quién y cuándo, y la constancia que leyó. */
function FirmaDeCampo({ valor, tecnico }: { valor: ValorFirma; tecnico: string }) {
  const trazos = useQuery(consultas.boceto(valor.firma));
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      {trazos.isPending ? (
        <div aria-busy="true" aria-label="Cargando la firma" className="esq" style={{ height: 112 }} />
      ) : trazos.isError ? (
        <Aviso tono="error">
          <b>No se pudo cargar la firma.</b>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void trazos.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : (
        <div className="papel" data-tema="claro">
          <FirmaDibujada documento={trazos.data} etiqueta={`Firma de ${valor.nombre}`} />
        </div>
      )}
      <span className="sec" style={{ fontSize: 13 }}>
        <b style={{ color: "var(--texto)" }}>{`${valor.nombre}${valor.cargo ? ` · ${valor.cargo}` : ""}`}</b>
        <br />
        Firmó {aFechaCorta(valor.firmadoEn)}, en el teléfono de {tecnico}.
      </span>
      <span className="sec" style={{ fontSize: 13 }}>
        “{valor.declaracion}”
      </span>
    </div>
  );
}

function Fotos({ etiqueta, huellas, puestos }: { etiqueta: string; huellas: readonly string[]; puestos?: readonly string[] | undefined }) {
  const urls = useQueries({ queries: huellas.map((h) => consultas.urlDeArchivo(h)) });
  const [viendo, setViendo] = useState<number | null>(null);
  if (urls.some((u) => u.isPending)) return <p className="ayuda">Cargando fotos…</p>;
  if (urls.some((u) => u.isError)) {
    return (
      <Aviso tono="error">
        <b>No se pudieron cargar las fotos de {etiqueta.toLowerCase()}.</b>
        <div>
          <Boton tamano="pequeno" icono={RefreshCw} onClick={() => urls.forEach((u) => void u.refetch())}>
            Reintentar
          </Boton>
        </div>
      </Aviso>
    );
  }
  const fotos = urls.map((u, i) => ({ id: huellas[i]!, url: u.data!.url }));
  return (
    <>
      <div className="fotos">
        {fotos.map((f, i) => (
          <figure key={f.id} className="foto" style={{ margin: 0 }}>
            <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <figcaption>{puestos?.[i] ?? `Foto ${i + 1}`}</figcaption>
            <button type="button" className="ver-foto" aria-label={`Ver ${puestos?.[i] ?? `la foto ${i + 1}`} de ${etiqueta.toLowerCase()}`} onClick={() => setViendo(i)} />
          </figure>
        ))}
      </div>
      {viendo !== null && <VisorFotos etiqueta={etiqueta} fotos={fotos} inicial={viendo} alCerrar={() => setViendo(null)} />}
    </>
  );
}

/**
 * El capítulo del levantamiento como saldrá en el informe (ADR-0031), con la plantilla del PDF: lo corregido
 * resaltado con el valor anterior debajo y, mientras se escribe una corrección, el valor nuevo enmarcado. Lo azul es
 * de la pantalla: el PDF muestra el valor y nada más; el valor anterior queda en el historial.
 */
function CapituloEnVivo({ l, correcciones, enCurso, organizacion }: { l: Levantamiento; correcciones: ReturnType<typeof correccionesDe>; enCurso: EnCurso | null; organizacion: string }) {
  const editado: Levantamiento = enCurso ? { ...l, respuestas: { ...l.respuestas, [enCurso.seccion]: conValor(l.respuestas[enCurso.seccion] ?? {}, enCurso.campo, enCurso.valor) } } : l;
  const recursos = useRecursosDelInforme([editado]);
  const contenido: ContenidoVersion = {
    formatoContenido: 1,
    numero: 1,
    publicadaEn: new Date().toISOString(),
    publicadaPor: "",
    organizacion: { nombre: organizacion },
    visita: l.visita ?? { cliente: "[Cliente]", sitio: "[Sitio]", direccion: "", motivo: "", programadaPara: l.recibidoEn.slice(0, 10) },
    introduccion: "",
    conclusiones: "",
    levantamientos: [capituloDe(editado)],
    planos: [],
  };
  const definiciones = bloques(l.formatoDefinicion, l.repeticiones);
  const describir = (seccion: string, campo: string, valor: unknown) => {
    const definicion = definiciones.find((b) => b.clave === seccion)?.seccion.campos.find((c) => c.clave === campo);
    return definicion ? describirValor(definicion, valor as Valor | undefined) : "";
  };
  const claveEnCurso = enCurso ? `${enCurso.seccion}/${enCurso.campo}` : null;
  const huellaMarcas = `${[...correcciones.keys()].join()}|${claveEnCurso ?? ""}`;
  const marcar = useCallback(
    (doc: Document) => {
      doc.documentElement.classList.add("vista-capitulo");
      const poner = (clave: string, antes: string, clase: string) => {
        const fila = doc.querySelector(`tr[data-dato="${CSS.escape(clave)}"]`);
        const celda = fila?.querySelector<HTMLElement>("td");
        if (!fila || !celda) return;
        fila.classList.add(clase);
        celda.dataset.antes = antes;
      };
      for (const [k, c] of correcciones) {
        const [seccion = "", campo = ""] = k.split("|");
        poner(`${seccion}/${campo}`, `Antes: ${describir(seccion, campo, c.original)}`, "vista-corregido");
      }
      if (enCurso) poner(`${enCurso.seccion}/${enCurso.campo}`, `Antes: ${describir(enCurso.seccion, enCurso.campo, l.respuestas[enCurso.seccion]?.[enCurso.campo])} · sin guardar`, "vista-editando");
    },
    [huellaMarcas, l.version],
  );
  // Al empezar a corregir un dato, la hoja va hasta su fila.
  const [ancla, setAncla] = useState<AnclaDeHoja | null>(null);
  useEffect(() => {
    if (claveEnCurso) setAncla((a) => ({ selector: `tr[data-dato="${CSS.escape(claveEnCurso)}"]`, vez: (a?.vez ?? 0) + 1 }));
  }, [claveEnCurso]);
  const generar = (p: Plantillas) => p.plantillaInforme(contenido, { salida: { tipo: "vista" }, ...recursos });
  // Del ancho del panel (iteración 38); «Ampliar» la muestra a tamaño real.
  return (
    <>
      <p className="nota-panel">El capítulo como saldrá en el informe. Lo azul es lo corregido y no sale en el PDF.</p>
      <VistaDeDocumento titulo="Capítulo del informe" generar={generar} alPintar={marcar} ancla={ancla} />
    </>
  );
}

/** Las respuestas de una sección con un dato cambiado; sin valor, el dato sale. */
function conValor(seccion: Record<string, Valor>, campo: string, valor: Valor | undefined): Record<string, Valor> {
  const copia = { ...seccion };
  if (valor === undefined) delete copia[campo];
  else copia[campo] = valor;
  return copia;
}
