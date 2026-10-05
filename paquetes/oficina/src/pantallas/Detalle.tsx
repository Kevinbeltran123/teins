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
  HojasDeBoceto,
  Insignia,
  Link2,
  Maximize2,
  nombreDeTransicion,
  MarcaNoObtenido,
  MessageSquare,
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
import { aFechaCorta, cuantoLleva } from "../formato";
import { useAbrirInformeDeVisita } from "../informes";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../mensajes";
import { useBandeja, useComentar, useCorregir, useCorregirComentario, useMarcarRevisado, useTomar } from "../revision";
import { capituloDe, useRecursosDelInforme } from "../vistaInforme";
import { Lienzo, VistaDeDocumento } from "./Lienzo";
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
 * campo; "Corregir" y "Comentar" aparecen al pasar por cada fila y el comentario se escribe debajo del dato. A la
 * derecha, un carril fijo con la revisión y su acción, los comentarios y el historial.
 */
export function Detalle({ id }: { id: string }) {
  const consulta = useQuery(consultas.levantamiento(id));
  const sesion = useQuery(consultas.sesion());
  const historial = useQuery(consultas.historial(id));
  const [comentandoEn, setComentandoEn] = useState<string | null>(null);
  const [pestana, setPestana] = usePreferencia<"comentarios" | "historial" | "informe">("revision-carril", "comentarios", unoDe("comentarios", "historial", "informe"));
  // La bandeja marca la fila que se abrió al volver (prototipos/usabilidad-oficina).
  const [, setUltima] = usePreferencia("bandeja-ultima", "", esTexto, "pestana");
  useEffect(() => setUltima(id), [id, setUltima]);
  const abierto = consulta.data;
  useAnotarReciente(abierto ? { tipo: "levantamiento", id, titulo: abierto.visita ? `${abierto.visita.cliente} · ${abierto.visita.sitio}` : `Levantamiento de ${abierto.tecnico.nombre}`, detalle: `${abierto.tecnico.nombre} · ${{ enviado: "esperando revisión", en_revision: "en revisión", revisado: "revisado" }[abierto.estado]}` } : null);
  // Esc vuelve a la bandeja, con la fila de este levantamiento marcada (iteración 37).
  const volver = useNavigate();
  useTeclaSuelta("Escape", () => void volver({ to: "/" }));
  const [enCurso, setEnCurso] = useState<EnCurso | null>(null);

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Levantamiento" />
        <EsqueletoLista etiqueta="Cargando el levantamiento" />
      </>
    );
  }
  if (consulta.isError) {
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
  const estado = ESTADOS[l.estado];
  const correcciones = correccionesDe(historial.data);
  const recargar = () => void consulta.refetch();

  // Las secciones del formato, con sus repeticiones juntas bajo el mismo título (prototipo: "Tableros").
  const todos = bloques(l.formatoDefinicion, l.repeticiones);
  const secciones = l.formatoDefinicion.secciones.map((s) => ({ seccion: s, bloques: todos.filter((b) => b.seccion.clave === s.clave) }));
  const conCambios = (clave: string) => [...correcciones.keys()].some((k) => k.split("|")[0]!.startsWith(clave));
  const conFaltantes = (bs: typeof todos) => bs.some((b) => b.seccion.campos.some((c) => esNoObtenido(l.respuestas[b.clave]?.[c.clave])));

  const irA = (seccion: string) => document.getElementById(`sec-${seccion}`)?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });
  const nombreFormato = `${l.formatoDefinicion.nombre ?? l.formato} v${l.versionFormato}`;

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : `Levantamiento de ${l.tecnico.nombre}`}
        transicion={nombreDeTransicion("lev", l.id)}
        estado={
          // El estado cambia en su lugar al tomar o marcar revisado (iteración 27).
          <span className="inline-flex" style={{ viewTransitionName: nombreDeTransicion("estado", l.id) }}>
            <Insignia tono={estado.tono}>{estado.texto}</Insignia>
          </span>
        }
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
      <CorreccionEnCurso.Provider value={{ avisar: setEnCurso, verCapitulo: pestana === "informe" ? null : () => setPestana("informe") }}>
        <div className={`con-carril ${pestana === "informe" ? "ancho" : ""}`}>
          <div className="principal">
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
          <aside className="carril" aria-label="Revisión y comentarios" style={{ viewTransitionName: "carril" }}>
            <PanelRevision l={l} mia={mia} correcciones={correcciones.size} recargar={recargar} />
            <div className="grupo-c">
              <div className="mini-tabs" role="tablist" aria-label="Comentarios, historial y el informe">
                <button type="button" role="tab" aria-selected={pestana === "comentarios"} onClick={() => setPestana("comentarios")}>
                  Comentarios{vigentes(l).length > 0 ? ` · ${vigentes(l).length}` : ""}
                </button>
                <button type="button" role="tab" aria-selected={pestana === "historial"} onClick={() => setPestana("historial")}>
                  Historial
                </button>
                <button type="button" role="tab" aria-selected={pestana === "informe"} onClick={() => setPestana("informe")}>
                  En el informe
                </button>
              </div>
              {pestana === "comentarios" ? (
                <Comentarios l={l} usuarioId={sesion.data?.usuario.id} />
              ) : pestana === "historial" ? (
                <HistorialDeCambios l={l} historial={historial} />
              ) : (
                <CapituloEnVivo l={l} correcciones={correcciones} enCurso={enCurso} organizacion={sesion.data?.organizacion.nombre ?? "[ORGANIZACIÓN]"} />
              )}
            </div>
          </aside>
        </div>
      </CorreccionEnCurso.Provider>
    </>
  );
}

/**
 * La revisión en el carril (iteración 29, prototipos/ajustes-oficina): una línea de estado (quién la tiene, o quién la
 * revisó) y, debajo, lo que ayuda a decidir. La acción de la pantalla ("Tomar para revisar", "Marcar revisado",
 * "Abrir el informe") va arriba a la derecha, en la barra, de tamaño normal: no un botón estirado en el carril.
 */
function PanelRevision({ l, mia, correcciones, recargar }: { l: Levantamiento; mia: boolean; correcciones: number; recargar: () => void }) {
  const tomar = useTomar();
  const marcar = useMarcarRevisado(l.id);
  const notificar = useNotificar();
  const destino = useContext(DestinoAccionesBarra);
  const [confirmando, setConfirmando] = useState<"revisado" | "reasignar" | null>(null);
  // El chulo se dibuja solo cuando se acaba de marcar revisado, no cada vez que se abre uno ya revisado.
  const revisadoAlAbrir = useRef(l.estado === "revisado");
  const tomada = () => notificar({ texto: "Revisión tomada: ya puede corregir" });
  const error = tomar.error ?? marcar.error;
  const invalidos = marcar.error instanceof ErrorApi ? (marcar.error.problema.errores ?? []) : [];
  const etiqueta = (seccion: string, campo?: string) => (campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo) : rutaLegible(l.formatoDefinicion, l.repeticiones, seccion));
  const nombre = l.revisor?.nombre ?? "otra persona";
  // Revisar con el teclado (iteración 37): T toma y R marca revisado, con la confirmación de siempre.
  useTeclaSuelta("t", () => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada }), l.estado === "enviado" && !tomar.isPending);
  useTeclaSuelta("r", () => setConfirmando("revisado"), mia && l.estado === "en_revision");

  let linea: ReactNode;
  let ayuda: ReactNode = null;
  let accion: ReactNode = null;
  if (l.estado === "enviado") {
    linea = (
      <>
        <Insignia tono="enviado">Esperando revisión</Insignia>
        <span>Nadie la ha tomado</span>
      </>
    );
    ayuda = "Tómelo para corregirlo y marcarlo revisado.";
    accion = (
      <Boton variante="principal" title="Tomar para revisar · T" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada })}>
        Tomar para revisar
      </Boton>
    );
  } else if (l.estado === "revisado") {
    linea = (
      <>
        <i className="chulo-linea" aria-hidden>
          <svg className={revisadoAlAbrir.current ? undefined : "chulo"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ "--largo": 24 } as CSSProperties}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </i>
        <span>
          <b>Revisado</b> · por {l.revisor?.nombre ?? "[Sin responsable]"}
        </span>
      </>
    );
    ayuda = l.visita ? `Ya puede ir en el informe de la visita; ${l.tecnico.nombre} lo ve como revisado en su teléfono.` : "No tiene visita, así que no entra en un informe.";
    accion = l.visita ? <AbrirInforme visitaId={l.visita.id} /> : null;
  } else if (mia) {
    linea = (
      <>
        <Insignia tono="revision">En revisión</Insignia>
        <span>La tomó usted</span>
      </>
    );
    ayuda = "Corrija lo que haga falta y márquelo revisado cuando esté listo.";
    accion = (
      <Boton variante="principal" icono={Check} title="Marcar revisado · R" onClick={() => setConfirmando("revisado")}>
        Marcar revisado
      </Boton>
    );
  } else {
    linea = (
      <>
        <Insignia tono="revision">En revisión</Insignia>
        <span>
          La tiene <b>{nombre}</b>
        </span>
      </>
    );
    accion = <Boton onClick={() => setConfirmando("reasignar")}>Tomar la revisión de {nombre}</Boton>;
  }

  return (
    <section className="grupo-c" aria-label="Revisión">
      <div className="rev-linea">{linea}</div>
      {ayuda && <p className="ayuda">{ayuda}</p>}
      {l.estado === "revisado" && <SiguienteEnSerie actual={l.id} />}
      {accion && (destino ? createPortal(<div className="acciones">{accion}</div>, destino) : <div className="col">{accion}</div>)}
      {correcciones > 0 && (
        <span className="corregido" style={{ margin: 0 }}>
          <Pencil aria-hidden size={13} />
          {correcciones === 1 ? "1 dato corregido" : `${correcciones} datos corregidos`}
        </span>
      )}
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
          nivel="consecuencia"
          titulo={`¿Marcar revisado el levantamiento de ${l.tecnico.nombre}?`}
          confirmar="Marcar revisado"
          consecuencias={[
            { icono: FileText, texto: l.visita ? "Queda listo para el informe de la visita" : "Queda listo para el informe", detalle: "Ya no se corrige desde la revisión" },
            {
              icono: Smartphone,
              texto: `${l.tecnico.nombre} lo ve como revisado en su teléfono`,
              ...(vigentes(l).length > 0 && { detalle: vigentes(l).length === 1 ? "Con el comentario de oficina" : `Con los ${vigentes(l).length} comentarios de oficina` }),
            },
          ]}
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={() => marcar.mutateAsync(l.version)}
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
    </section>
  );
}

/**
 * Revisar en serie (iteración 27): al marcar revisado, el que más lleva esperando, con cuántos quedan, para seguir
 * sin volver a la lista. Es una fila del carril, no un botón relleno: la acción principal es abrir el informe.
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
        Abrir el informe de la visita
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
  const nombreEnFrase = campo.etiqueta.toLowerCase();

  if (corrigiendo) {
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
              {hilo.length}
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
          {hilo.map((c) => (
            <div key={c.id} className="burbuja">
              <small>
                {c.autor.nombre} · {aFechaCorta(c.creadoEn)} · para el técnico{c.editadoEn ? " · Editado" : ""}
              </small>
              <span style={{ whiteSpace: "pre-line" }}>{c.texto}</span>
            </div>
          ))}
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
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const idMotivo = `motivo-${seccion}-${campo.clave}`;
  const errorDelCampo = corregir.error instanceof ErrorApi ? corregir.error.problema.errores?.find((e) => e.seccion === seccion && e.campo === campo.clave) : undefined;
  const mensajeCampo = errorDelCampo ? mensajeDeValidacion[errorDelCampo.codigo as keyof typeof mensajeDeValidacion] : undefined;
  const marcado = esNoObtenido(nuevo);
  const enCurso = useContext(CorreccionEnCurso);
  useEffect(() => enCurso?.avisar({ seccion, campo: campo.clave, valor: nuevo }), [nuevo]);
  useEffect(() => () => enCurso?.avisar(null), []);

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
            onCambio={(texto) => setNuevo(texto === "" ? undefined : texto)}
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
                setNuevo(undefined);
                setValido(true);
                return true;
              }
              const m = crearMedida(texto, unidad, campo.unidades);
              if (m) setNuevo(m);
              setValido(m !== null);
              return m !== null;
            }}
          />
        );
      }
      case "cantidades": {
        const lineas = esCantidades(valor) ? valor : [];
        return <CorregirCantidades etiqueta={`Líneas corregidas de ${campo.etiqueta.toLowerCase()}`} inicial={lineas} unidades={campo.unidades} deshabilitado={marcado} error={marcado ? undefined : mensajeCampo} onCambio={setNuevo} />;
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
          onMarcar={(m, motivoNoObtenido) => setNuevo(m ? { noObtenido: true, motivo: motivoNoObtenido } : undefined)}
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

/** El comentario sobre un dato se escribe debajo de su fila: no hay que subir al carril y volver a bajar. */
function ComentarAqui({ l, seccion, campo, nombre, cerrar }: { l: Levantamiento; seccion: string; campo: string; nombre: string; cerrar: () => void }) {
  const comentar = useComentar(l.id);
  const [texto, setTexto] = useState("");
  const [vacio, setVacio] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) {
      setVacio(true);
      return;
    }
    try {
      await comentar.mutateAsync({ texto: texto.trim(), seccion, campo });
      cerrar();
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
        maxLength={2000}
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
        <Boton tamano="pequeno" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" tamano="pequeno" variante="principal" icono={Send} cargando={comentar.isPending}>
          Enviar comentario
        </Boton>
      </div>
    </form>
  );
}

/** Lo que el técnico ve: los comentarios retirados no cuentan (ADR-0035). */
const vigentes = (l: Levantamiento) => l.comentarios.filter((c) => !c.retirado);

/**
 * Todos los comentarios; cada uno lleva a su fila. El campo de aquí es para lo general. Su autor edita o borra el
 * suyo hasta que el levantamiento está Revisado (ADR-0035): borrar no pide confirmar, queda "Comentario retirado"
 * con "Deshacer".
 */
function Comentarios({ l, usuarioId }: { l: Levantamiento; usuarioId: string | undefined }) {
  const comentar = useComentar(l.id);
  const corregir = useCorregirComentario(l.id);
  const notificar = useNotificar();
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const corregible = (c: Levantamiento["comentarios"][number]) => c.autor.id === usuarioId && l.estado !== "revisado";
  const restaurar = (comentarioId: string) => corregir.mutate({ comentarioId, accion: { tipo: "restaurar" } });
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
  // Solo el comentario recién escrito entra animado; los demás no se animan otra vez al volver a la pestaña.
  const esNuevo = useLoNuevo(l.comentarios.map((c) => c.id));
  const [texto, setTexto] = useState("");
  const etiqueta = (seccion?: string, campo?: string) => (seccion && campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo, true) : undefined);

  function irALaFila(seccion: string, campo: string) {
    const fila = document.getElementById(idDato(seccion, campo));
    fila?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "center" });
    fila?.classList.remove("recien");
    void fila?.offsetWidth;
    fila?.classList.add("recien");
  }

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

  return (
    <section aria-label="Comentarios al técnico" className="col" style={{ gap: 10 }}>
      <div>
        {l.comentarios.length === 0 ? (
          <p className="ayuda">Sin comentarios. El técnico los ve en su teléfono en la siguiente sincronización.</p>
        ) : (
          l.comentarios.map((c) =>
            c.retirado ? (
              <div key={c.id} className="nota-c retirado">
                <span>{`Comentario retirado por ${c.retirado.por.nombre} · ${aFechaCorta(c.retirado.en)}`}</span>
                {corregible(c) && (
                  <button type="button" className="accion-envio" onClick={() => restaurar(c.id)}>
                    Deshacer
                  </button>
                )}
              </div>
            ) : editando?.id === c.id ? (
              <form key={c.id} className="nota-c" onSubmit={(e) => void guardarEdicion(e)} noValidate>
                <small>{c.autor.nombre}</small>
                <label className="sr-only" htmlFor={`editar-${c.id}`}>
                  Comentario
                </label>
                <textarea
                  id={`editar-${c.id}`}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- se abre con "Editar": el foco va donde se escribe
                  autoFocus
                  className="control"
                  maxLength={2000}
                  style={{ minHeight: 64 }}
                  value={editando.texto}
                  onChange={(e) => setEditando({ id: c.id, texto: e.target.value })}
                />
                <div className="fila-flex" style={{ justifyContent: "flex-end", gap: 6 }}>
                  <Boton tamano="pequeno" onClick={() => setEditando(null)}>
                    Cancelar
                  </Boton>
                  <Boton type="submit" tamano="pequeno" variante="principal" cargando={corregir.isPending} disabled={!editando.texto.trim() || editando.texto.trim() === c.texto}>
                    Guardar
                  </Boton>
                </div>
              </form>
            ) : (
              <div key={c.id} className={`nota-c ${esNuevo(c.id) ? "nueva" : ""}`}>
                <small className="fila-flex entre">
                  <span>
                    {c.autor.nombre} · {aFechaCorta(c.creadoEn)}
                    {c.seccion && c.campo && (
                      <>
                        {" · Sobre "}
                        <button type="button" className="ir-dato" onClick={() => irALaFila(c.seccion!, c.campo!)}>
                          {etiqueta(c.seccion, c.campo) ?? c.campo}
                        </button>
                      </>
                    )}
                  </span>
                  {corregible(c) && (
                    <MenuAcciones
                      etiqueta="Más acciones para el comentario"
                      opciones={[
                        { texto: "Editar", alElegir: () => setEditando({ id: c.id, texto: c.texto }) },
                        { texto: "Borrar", peligro: true, alElegir: () => retirar(c.id) },
                      ]}
                    />
                  )}
                </small>
                <span style={{ whiteSpace: "pre-line" }}>{c.texto}</span>
                {c.editadoEn && <small>{`Editado ${aFechaCorta(c.editadoEn)}`}</small>}
              </div>
            ),
          )
        )}
        {corregir.isError && <Aviso tono="error">{mensajeDeError(corregir.error)}</Aviso>}
      </div>
      <form className="col" style={{ gap: 8 }} onSubmit={(e) => void enviar(e)} noValidate>
        <label className="sr-only" htmlFor="comentario-general">
          Comentario general
        </label>
        <textarea
          id="comentario-general"
          className="control"
          maxLength={2000}
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
  campo_corregido: { texto: "Corrigió", icono: Pencil },
  levantamiento_revisado: { texto: "Marcó el levantamiento revisado", icono: Check },
  comentario_agregado: { texto: "Comentó", icono: MessageSquare },
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
    if (e.tipo === "linea_vinculada") {
      const antes = e.anterior as { linea?: string; item?: string | null } | undefined;
      const despues = e.nuevo as { linea?: string; item?: string | null } | undefined;
      return ` “${descripcionDeLinea(e.seccion, e.campo, despues?.linea)}”: ${codigoDe(antes?.item)} → ${codigoDe(despues?.item)}`;
    }
    if (e.tipo === "comentario_editado") return `: “${(e.anterior as { texto?: string } | undefined)?.texto ?? ""}” → “${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
    if (e.tipo === "comentario_agregado") return ` ${definicion ? `sobre ${nombreDe(e.seccion, definicion)}: ` : ""}“${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
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
  // "Ver en grande" (iteración 29): el capítulo a tamaño real en un diálogo ancho; en el carril se lee reducido.
  const [enGrande, setEnGrande] = useState(false);
  const generar = (p: Plantillas) => p.plantillaInforme(contenido, { salida: { tipo: "vista" }, ...recursos });
  return (
    <>
      <Lienzo
        clase="en-carril"
        cabecera={
          <span className="fila-flex" style={{ gap: 6 }}>
            <span className="nota-l">El capítulo, como saldrá en el informe</span>
            <BotonIcono icono={Maximize2} etiqueta="Ver el capítulo en grande" tamano="pequeno" onClick={() => setEnGrande(true)} />
          </span>
        }
        nota="Lo azul no sale en el PDF"
      >
        <VistaDeDocumento ancho={740} titulo="Capítulo del informe" generar={generar} alPintar={marcar} ancla={ancla} />
      </Lienzo>
      {enGrande && (
        <Dialogo forma="formulario" ancho="previa" titulo="El capítulo en el informe" subtitulo="Vista previa · lo azul es lo corregido y no sale en el PDF" alCerrar={() => setEnGrande(false)}>
          <div className="capitulo-grande">
            <VistaDeDocumento ancho={740} titulo="Capítulo del informe, en grande" generar={generar} alPintar={marcar} />
          </div>
        </Dialogo>
      )}
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
