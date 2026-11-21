import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatearDia, ZONA_COLOMBIA } from "@teins/dominio";
import { ErrorApi, LARGO_MAXIMO_DE_PREGUNTA, type FuenteDelAsistente, type FuentesDelAsistente, type IntercambioDelAsistente, type RespuestaDelAsistente, type Respuesta, type SerieDelAsistente, type TablaDelAsistente } from "@teins/protocolo";
import {
  ArrowLeft,
  ArrowUp,
  Aviso,
  Boton,
  BotonIcono,
  Buscador,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  coincide,
  Copy,
  Destello,
  ErrorDeCarga,
  EsqueletoBloques,
  EsqueletoLista,
  EsqueletoTexto,
  etiquetaEnter,
  History,
  Insignia,
  LoaderCircle,
  MenuAcciones,
  OrbeAsistente,
  Package,
  Plus,
  Receipt,
  Square,
  useConexion,
  useNotificar,
  X,
  type LucideIcon,
} from "@teins/ui";
import { cliente } from "../api";
import {
  accionDeTecla,
  anuncioDelFinal,
  consultasDelAsistente,
  destinoDeFuente,
  escalaDeSerie,
  ID_PANEL_ASISTENTE,
  mensajeAlPreguntar,
  nombreDePila,
  ordenDeFuente,
  partirTexto,
  primeroDelMesSiguiente,
  respuestaComoTexto,
  tablaComoTsv,
  type ControlDelAsistente,
} from "../asistente";
import { aFechaCorta } from "../formato";
import { errorComun, textoDelServidor } from "../mensajes";
import { hoyLocal } from "../programacion";

/*
  El panel del asistente (iteración 53, prototipos/analisis, versión 5): a la derecha, debajo de la barra superior y
  sin velo, para que lo de atrás siga a la vista y se pueda usar. Se ve como los chats de IA conocidos: el saludo y las
  sugerencias al empezar, la pregunta en burbuja, la respuesta con el orbe y la caja de pregunta abajo.
*/

/** Enseñan qué se puede preguntar con los datos propios. */
/** Genéricas: sin lugares ni números de una empresa, porque otra puede usar el sistema (R7). */
export const SUGERENCIAS: [string, LucideIcon][] = [
  ["¿Cuánto cable se gastó en los últimos 12 meses?", Package],
  ["¿Cuánto UTP presupuesto para un cableado de 40 puntos?", Receipt],
  ["¿Cuántas visitas hubo cada mes este año?", CalendarDays],
  ["Resuma el último levantamiento revisado", ClipboardCheck],
];

const numero = (v: number) => v.toLocaleString("es-CO");
const diaCorto = (aaaaMmDd: string) => formatearDia(aaaaMmDd, { day: "numeric", month: "short" });
const conMayuscula = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
const preguntas = (n: number) => (n === 1 ? "1 pregunta" : `${numero(n)} preguntas`);

export function PanelAsistente({ control: c, persona, administrador }: { control: ControlDelAsistente; persona: string; administrador: boolean }) {
  const cuerpo = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  // Al abrirlo, el foco va a la caja; si no se puede escribir (historial, tope agotado, sin conexión), al título.
  useEffect(() => {
    if (c.aperturas === 0) return;
    const caja = panel.current?.querySelector<HTMLTextAreaElement>("textarea:not([disabled])");
    (caja ?? titulo.current)?.focus();
  }, [c.aperturas]);
  // Pegado al final: la respuesta que se arma queda a la vista, salvo que la persona haya subido a leer.
  const pegado = useRef(true);
  const enHistorial = c.vista === "historial";

  useLayoutEffect(() => {
    pegado.current = true;
    if (cuerpo.current) cuerpo.current.scrollTop = c.vista === "conversacion" ? cuerpo.current.scrollHeight : 0;
  }, [c.vista, c.conversacionId]);

  function alTeclear(e: KeyboardEvent) {
    // Esc dentro de un menú de acciones cierra solo el menú.
    if (e.key !== "Escape" || e.defaultPrevented || (e.target as HTMLElement).closest("[popover]")) return;
    e.preventDefault();
    c.cerrar();
  }

  return (
    <aside ref={panel} id={ID_PANEL_ASISTENTE} className="asis-panel" aria-label={c.nombre} onKeyDown={alTeclear}>
      <header className="asis-cab">
        <h2 ref={titulo} tabIndex={-1}>
          {enHistorial ? (
            <>
              <BotonIcono icono={ArrowLeft} etiqueta="Volver" tamano="pequeno" className="asis-volver" onClick={c.volver} />
              Conversaciones
            </>
          ) : (
            <>
              <Destello />
              {c.nombre}
            </>
          )}
        </h2>
        {!enHistorial && <BotonIcono icono={History} etiqueta="Conversaciones" tamano="pequeno" onClick={c.irAlHistorial} />}
        <BotonIcono icono={Plus} etiqueta="Nueva conversación" tamano="pequeno" onClick={c.nueva} />
        <BotonIcono icono={X} etiqueta={`Cerrar ${c.nombre}`} tamano="pequeno" onClick={c.cerrar} />
      </header>
      <div
        ref={cuerpo}
        className="asis-cuerpo"
        onScroll={(e) => {
          const el = e.currentTarget;
          pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {enHistorial ? (
          <Historial c={c} />
        ) : c.vista === "conversacion" && c.conversacionId ? (
          <Conversacion key={c.conversacionId} c={c} id={c.conversacionId} cuerpo={cuerpo} pegado={pegado} />
        ) : (
          <Inicio c={c} persona={persona} />
        )}
      </div>
      {!enHistorial && <Pie c={c} administrador={administrador} />}
    </aside>
  );
}

/** Sin conexión o con el tope agotado no se puede preguntar. */
function useBloqueo(c: ControlDelAsistente) {
  const enLinea = useConexion();
  return { sinConexion: !enLinea, topeAgotado: c.estado.data?.topeAgotado === true, bloqueada: !enLinea || c.estado.data?.topeAgotado === true };
}

// Inicio ------------------------------------------------------------------------------------------

const enColombia = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CO", { ...opciones, timeZone: ZONA_COLOMBIA });
const diaYMes = enColombia({ day: "numeric", month: "long" });
const diaMesYAno = enColombia({ day: "numeric", month: "long", year: "numeric" });
const anoDe = (iso: string) => enColombia({ year: "numeric" }).format(new Date(iso));

/** «, del 12 de enero al 18 de noviembre»: con el año solo si no es el actual. */
function rangoDeCobertura(desde: string | null, hasta: string | null): string {
  if (!desde || !hasta) return "";
  const esteAno = anoDe(new Date().toISOString());
  const formato = anoDe(desde) === esteAno && anoDe(hasta) === esteAno ? diaYMes : diaMesYAno;
  const [a, b] = [formato.format(new Date(desde)), formato.format(new Date(hasta))];
  return a === b ? `, del ${a}` : `, del ${a} al ${b}`;
}

function Inicio({ c, persona }: { c: ControlDelAsistente; persona: string }) {
  const { bloqueada } = useBloqueo(c);
  const { cobertura } = c.estado.data!;
  const sinDatos = cobertura.revisados === 0;
  const pila = nombreDePila(persona);
  return (
    <>
      <div className="asis-bienvenida">
        <OrbeAsistente tamano="grande" />
        <h3>{pila ? `Hola, ${pila}` : "Hola"}</h3>
        {sinDatos ? (
          <p>
            Soy {c.nombre}. Todavía no hay levantamientos revisados: cuando oficina marque revisado el primero, podré decirle cuánto material se usó, cuántas visitas hubo y resumir levantamientos. Mientras tanto, le respondo sobre
            las visitas programadas.
          </p>
        ) : (
          <>
            <p>Soy {c.nombre}. ¿Qué quiere saber de sus visitas, materiales o servicios?</p>
            <p className="asis-cobertura">
              Respondo con <b>{numero(cobertura.revisados)}</b> {cobertura.revisados === 1 ? "levantamiento revisado" : "levantamientos revisados"}
              {rangoDeCobertura(cobertura.desde, cobertura.hasta)}.
            </p>
          </>
        )}
      </div>
      {!sinDatos && (
        <div className="asis-sugerencias" role="group" aria-label="Preguntas sugeridas">
          {SUGERENCIAS.map(([texto, Icono]) => (
            <button key={texto} type="button" className="asis-sugerencia" disabled={bloqueada || c.preguntando} onClick={() => c.preguntar(texto, null, "panel")}>
              <Icono aria-hidden size={16} strokeWidth={1.6} />
              <span>{texto}</span>
            </button>
          ))}
        </div>
      )}
      <Recientes c={c} />
    </>
  );
}

type Resumen = Respuesta<"listarConversacionesDelAsistente">["conversaciones"][number];

function FilaDeConversacion({ c, conv, conIcono }: { c: ControlDelAsistente; conv: Resumen; conIcono?: boolean }) {
  return (
    <button type="button" className="asis-conv-boton" onClick={() => c.verConversacion(conv.id)}>
      {conIcono && <History aria-hidden size={16} strokeWidth={1.6} />}
      <span>
        {conv.titulo}
        <small>
          {preguntas(conv.preguntas)} · {conMayuscula(aFechaCorta(conv.actualizadaEn))}
        </small>
      </span>
    </button>
  );
}

function Recientes({ c }: { c: ControlDelAsistente }) {
  const lista = useQuery(consultasDelAsistente.conversaciones());
  if (lista.isPending && lista.fetchStatus === "paused") return null;
  if (lista.isPending) return <EsqueletoTexto etiqueta="Cargando las conversaciones recientes" />;
  if (lista.isError) return <ErrorDeCarga texto="No se pudieron cargar sus conversaciones recientes." reintentar={() => void lista.refetch()} />;
  const recientes = lista.data.conversaciones.slice(0, 3);
  if (recientes.length === 0) return null;
  return (
    <section className="asis-bloque" aria-labelledby="asis-recientes">
      <div className="asis-bloque-cab">
        <h3 id="asis-recientes">Recientes</h3>
        <Boton variante="fantasma" tamano="pequeno" onClick={c.irAlHistorial}>
          Ver todas
        </Boton>
      </div>
      {recientes.map((conv) => (
        <FilaDeConversacion key={conv.id} c={c} conv={conv} conIcono />
      ))}
    </section>
  );
}

// Historial ---------------------------------------------------------------------------------------

function Historial({ c }: { c: ControlDelAsistente }) {
  const consultas = useQueryClient();
  const notificar = useNotificar();
  const lista = useQuery(consultasDelAsistente.conversaciones());
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clave = consultasDelAsistente.conversaciones().queryKey;

  async function restaurar(id: string) {
    try {
      await cliente.llamar("restaurarConversacionDelAsistente", { parametros: { id } });
    } catch (e) {
      setError(mensajeDeConversacion(e, "No se recuperó la conversación"));
    }
    void consultas.invalidateQueries({ queryKey: clave });
  }

  async function eliminar(conv: Resumen) {
    setError(null);
    try {
      await cliente.llamar("eliminarConversacionDelAsistente", { parametros: { id: conv.id } });
    } catch (e) {
      setError(mensajeDeConversacion(e, "No se eliminó nada"));
      return;
    }
    c.olvidarConversacion(conv.id);
    consultas.setQueryData(clave, (d) => (d ? { conversaciones: d.conversaciones.filter((x) => x.id !== conv.id) } : d));
    void consultas.invalidateQueries({ queryKey: clave });
    notificar({ texto: "Conversación eliminada", accion: { texto: "Deshacer", alHacer: () => void restaurar(conv.id) } });
  }

  const todas = lista.data?.conversaciones ?? [];
  const visibles = todas.filter((conv) => coincide(buscar, conv.titulo));
  return (
    <>
      <Buscador etiqueta="Buscar en sus conversaciones" ejemplo="Buscar en sus conversaciones" valor={buscar} onCambio={setBuscar} />
      {error && <Aviso tono="error">{error}</Aviso>}
      {lista.isPending && lista.fetchStatus === "paused" ? (
        <Aviso tono="alerta">Sin conexión. Sus conversaciones aparecen aquí al recuperar la conexión.</Aviso>
      ) : lista.isPending ? (
        <EsqueletoLista etiqueta="Cargando sus conversaciones" filas={4} />
      ) : lista.isError ? (
        <ErrorDeCarga texto="No se pudieron cargar sus conversaciones." reintentar={() => void lista.refetch()} />
      ) : visibles.length === 0 ? (
        <p className="asis-vacio">{todas.length ? `Ninguna conversación con «${buscar.trim()}».` : "Todavía no tiene conversaciones."}</p>
      ) : (
        <div>
          {visibles.map((conv) => (
            <div key={conv.id} className="asis-conv">
              <FilaDeConversacion c={c} conv={conv} />
              <MenuAcciones etiqueta={`Más acciones para ${conv.titulo}`} opciones={[{ texto: "Eliminar conversación", peligro: true, alElegir: () => void eliminar(conv) }]} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function mensajeDeConversacion(problema: unknown, sinCambios: string): string {
  const error = errorComun(problema, sinCambios, "No se pudo completar la acción. Intente de nuevo.");
  if (typeof error === "string") return error;
  if (error.codigo === "no_encontrado") return "Esa conversación ya no existe.";
  return textoDelServidor(error, "No se pudo completar la acción. Intente de nuevo.");
}

// Conversación ------------------------------------------------------------------------------------

function Conversacion({ c, id, cuerpo, pegado }: { c: ControlDelAsistente; id: string; cuerpo: RefObject<HTMLDivElement | null>; pegado: RefObject<boolean> }) {
  const q = useQuery(consultasDelAsistente.conversacion(id));
  useLayoutEffect(() => {
    if (pegado.current && cuerpo.current) cuerpo.current.scrollTop = cuerpo.current.scrollHeight;
  }, [q.data, cuerpo, pegado]);
  if (q.isPending && q.fetchStatus === "paused") return <Aviso tono="alerta">Sin conexión. La conversación aparece aquí al recuperar la conexión.</Aviso>;
  if (q.isPending) return <EsqueletoBloques etiqueta="Cargando la conversación" altos={["bajo", "medio"]} />;
  if (q.isError) {
    if (q.error instanceof ErrorApi && q.error.codigo === "no_encontrado") {
      return (
        <Aviso>
          <span>Esta conversación ya no existe.</span>
          <div>
            <Boton tamano="pequeno" onClick={c.nueva}>
              Empezar una nueva
            </Boton>
          </div>
        </Aviso>
      );
    }
    return <ErrorDeCarga texto="No se pudo cargar la conversación." reintentar={() => void q.refetch()} />;
  }
  return (
    <>
      {q.data.intercambios.map((i) => (
        <Intercambio key={i.id} c={c} i={i} conversacionId={id} />
      ))}
    </>
  );
}

function Intercambio({ c, i, conversacionId }: { c: ControlDelAsistente; i: IntercambioDelAsistente; conversacionId: string }) {
  const { bloqueada } = useBloqueo(c);
  // Solo se anuncia el final que la persona vio llegar, no el de las respuestas que ya estaban.
  const empezoEnCurso = useRef(i.estado === "en_curso");
  const consultado = i.pasos.length > 0 ? " Lo consultado hasta ahí queda arriba." : "";
  const volver = (
    <div>
      <Boton tamano="pequeno" disabled={bloqueada || c.preguntando} onClick={() => c.preguntar(i.pregunta, conversacionId, "panel")}>
        Volver a preguntar
      </Boton>
    </div>
  );
  return (
    <article className="asis-intercambio">
      <h3 className="asis-yo">
        <span className="sr-only">Usted preguntó: </span>
        {i.pregunta}
      </h3>
      <div className="asis-ia">
        <OrbeAsistente tamano="chico" pensando={i.estado === "en_curso"} />
        <div className="asis-cuerpo-ia">
          <span className="sr-only">{c.nombre} responde:</span>
          <span className="sr-only" aria-live="polite">
            {empezoEnCurso.current ? anuncioDelFinal(i.estado, c.nombre) : ""}
          </span>
          <Pasos i={i} />
          {i.estado === "lista" && i.respuesta && <RespuestaVista r={i.respuesta} />}
          {i.estado === "error" && (
            <Aviso tono="error">
              <span>
                No se pudo terminar la respuesta.{i.error ? ` ${i.error}` : ""}
                {consultado}
              </span>
              {volver}
            </Aviso>
          )}
          {i.estado === "detenida" && (
            <Aviso>
              <span>Detuvo la respuesta.{consultado}</span>
              {volver}
            </Aviso>
          )}
        </div>
      </div>
    </article>
  );
}

/** Las consultas a los datos: abiertas mientras corren; al terminar, plegadas en una pastilla. */
function Pasos({ i }: { i: IntercambioDelAsistente }) {
  const [abiertos, setAbiertos] = useState(false);
  const enCurso = i.estado === "en_curso";
  if (!enCurso && i.pasos.length === 0) return null;
  const abierta = i.estado !== "lista" || abiertos;
  const n = i.pasos.length;
  const escribiendo = enCurso && !i.pasos.some((p) => p.estado === "en_curso");
  return (
    <div>
      {i.estado === "lista" && (
        <button type="button" className="asis-pastilla" aria-expanded={abiertos} onClick={() => setAbiertos(!abiertos)}>
          <Check aria-hidden size={14} strokeWidth={2} />
          <span>
            {n === 1 ? "1 consulta a sus datos" : `${numero(n)} consultas a sus datos`}
            {i.duracionSegundos !== null && ` · ${numero(Math.max(1, Math.round(i.duracionSegundos)))} s`}
          </span>
          <ChevronRight aria-hidden size={14} className="asis-chev" />
        </button>
      )}
      {abierta && (
        <ul className="asis-pasos" aria-label="Consultas a sus datos" aria-live={enCurso ? "polite" : undefined}>
          {i.pasos.map((p, k) => (
            <li key={k} className={`asis-paso ${p.estado === "en_curso" ? "en-curso" : p.estado === "fallo" ? "fallo" : ""}`}>
              <span className="asis-marca-paso">
                {p.estado === "en_curso" ? <LoaderCircle aria-hidden size={14} className="asis-giro" /> : p.estado === "fallo" ? <X aria-hidden size={14} /> : <Check aria-hidden size={14} strokeWidth={2} />}
              </span>
              <span>
                {p.etiqueta}
                {p.estado === "hecho" && p.resultado && <span className="asis-res"> · {p.resultado}</span>}
              </span>
            </li>
          ))}
          {escribiendo && (
            <li className="asis-paso en-curso">
              <span className="asis-marca-paso">
                <Destello latiendo />
              </span>
              <span className="brillo-texto">Escribiendo la respuesta</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function RespuestaVista({ r }: { r: RespuestaDelAsistente }) {
  return (
    <div className="asis-respuesta">
      {r.destacado && (
        <div className="asis-resultado">
          <div className="asis-cifras">
            {r.destacado.cifras.map((cifra, k) => (
              <span key={k} className={`asis-cifra${k > 0 ? " segunda" : ""}`}>
                {cifra.valor}
                {cifra.unidad && <span className="asis-unidad">{cifra.unidad}</span>}
              </span>
            ))}
          </div>
          <span className="asis-cifra-que">{r.destacado.descripcion}</span>
        </div>
      )}
      {r.serie && r.serie.puntos.length > 0 && <Grafico serie={r.serie} />}
      <TextoPlano texto={r.texto} />
      {r.tablas.map((t, k) => (
        <TablaRespuesta key={k} t={t} />
      ))}
      {r.fuentes && r.fuentes.visitas.length > 0 && <Fuentes f={r.fuentes} />}
      <div className="asis-acciones">
        <Copiar texto={respuestaComoTexto(r)} etiqueta="Copiar la respuesta" hecho="Respuesta copiada" soloIcono />
      </div>
    </div>
  );
}

/**
 * El texto del modelo, como texto plano: párrafos y viñetas. React lo escapa, así que «<b>» sale como se escribió; ni
 * HTML, ni Markdown, ni enlaces o imágenes que vengan del modelo.
 */
export function TextoPlano({ texto }: { texto: string }) {
  const bloques = partirTexto(texto);
  if (bloques.length === 0) return null;
  return (
    <div className="asis-texto">
      {bloques.map((b, k) =>
        b.tipo === "parrafo" ? (
          <p key={k}>{b.texto}</p>
        ) : (
          <ul key={k}>
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Copia y lo confirma en el mismo botón, como `BotonCopiar`: el resultado queda donde se hizo. */
function Copiar({ texto, etiqueta, hecho, soloIcono }: { texto: string; etiqueta: string; hecho: string; soloIcono?: boolean }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "fallo">("listo");
  useEffect(() => {
    if (estado === "listo") return;
    const t = setTimeout(() => setEstado("listo"), 2500);
    return () => clearTimeout(t);
  }, [estado]);
  function copiar() {
    try {
      navigator.clipboard.writeText(texto).then(
        () => setEstado("copiado"),
        () => setEstado("fallo"),
      );
    } catch {
      setEstado("fallo");
    }
  }
  const rotulo = estado === "copiado" ? hecho : estado === "fallo" ? "No se pudo copiar" : etiqueta;
  const icono = estado === "copiado" ? Check : Copy;
  if (soloIcono) {
    return (
      <>
        <BotonIcono icono={icono} etiqueta={rotulo} tamano="pequeno" onClick={copiar} />
        <span className="sr-only" aria-live="polite">
          {estado === "listo" ? "" : rotulo}
        </span>
      </>
    );
  }
  return (
    <Boton variante="fantasma" tamano="pequeno" icono={icono} onClick={copiar}>
      <span aria-live="polite">{rotulo}</span>
    </Boton>
  );
}

function TablaRespuesta({ t }: { t: TablaDelAsistente }) {
  return (
    <div className="asis-tabla">
      <div className="asis-tabla-cab">
        <h4>{t.titulo}</h4>
        <Copiar texto={tablaComoTsv(t)} etiqueta="Copiar tabla" hecho="Tabla copiada" />
      </div>
      <div className="asis-desliza">
        <table aria-label={t.titulo}>
          <thead>
            <tr>
              {t.columnas.map((col, k) => (
                <th key={k} scope="col" className={col.numerica ? "num" : undefined}>
                  {col.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.filas.map((fila, f) => (
              <tr key={f}>
                {fila.map((celda, k) => (
                  <td key={k} className={t.columnas[k]?.numerica ? "num" : undefined}>
                    {k === 0 ? <span className="asis-principal">{celda.texto}</span> : celda.texto}
                    {celda.detalle && <span className="asis-detalle">{celda.detalle}</span>}
                    {celda.marca === "sin_vincular" && (
                      <span className="asis-detalle">
                        <Insignia tono="alerta">Sin vincular</Insignia>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.nota && <p className="asis-nota">{t.nota}</p>}
    </div>
  );
}

/** Barras de una sola serie, sin leyenda: solo el valor más alto lleva su cifra; los demás, al pasar el cursor. */
function Grafico({ serie }: { serie: SerieDelAsistente }) {
  const [datos, setDatos] = useState(false);
  const valores = serie.puntos.map((p) => p.valor);
  const { maximo, guias } = escalaDeSerie(valores);
  const mayor = Math.max(...valores);
  const columnas = { "--n": serie.puntos.length } as CSSProperties;
  const alto = (v: number) => `${(Math.max(0, v) / maximo) * 100}%`;
  return (
    <figure className="asis-grafico">
      <div className="asis-grafico-cab">
        <h4>{serie.titulo}</h4>
        <Boton variante="fantasma" tamano="pequeno" aria-expanded={datos} onClick={() => setDatos(!datos)}>
          {datos ? "Ocultar los datos" : "Ver los datos"}
        </Boton>
      </div>
      <div className="asis-trazado">
        <div className="asis-eje-y" aria-hidden>
          {guias.map((g) => (
            <span key={g} style={{ bottom: alto(g) }}>
              {numero(g)}
            </span>
          ))}
        </div>
        <div className="asis-area">
          {guias.slice(1).map((g) => (
            <span key={g} className="asis-guia" style={{ bottom: alto(g) }} />
          ))}
          <div className="asis-barras" style={columnas}>
            {serie.puntos.map((p, k) => {
              const esMayor = mayor > 0 && p.valor === mayor;
              return (
                <div key={k} className={`asis-barra${esMayor ? " max" : ""}`} style={{ "--h": alto(p.valor) } as CSSProperties} tabIndex={0} role="img" aria-label={`${p.etiqueta}: ${numero(p.valor)}`}>
                  {esMayor && (
                    <span className="asis-valor" aria-hidden>
                      {numero(p.valor)}
                    </span>
                  )}
                  <span className="asis-tip" aria-hidden>
                    {p.etiqueta}: {numero(p.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="asis-eje-x" aria-hidden>
        <span />
        <div style={columnas}>
          {serie.puntos.map((p, k) => (
            <span key={k}>{p.etiqueta}</span>
          ))}
        </div>
      </div>
      {datos && (
        <div className="asis-datos">
          <table aria-label={serie.titulo}>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col" className="num">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {serie.puntos.map((p, k) => (
                <tr key={k}>
                  <td>{p.etiqueta}</td>
                  <td className="num">{numero(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

/** Los únicos enlaces del panel: los arma la pantalla con los ids de las fuentes, nunca con texto del modelo. */
function EnlaceDeFuente({ f, hoy }: { f: FuenteDelAsistente; hoy: string }) {
  const destino = destinoDeFuente(f, hoy);
  const texto = ordenDeFuente(f);
  if (destino.a === "levantamiento") {
    return (
      <Link to="/levantamientos/$id" params={{ id: destino.id }} className="enlace">
        {texto}
      </Link>
    );
  }
  return (
    <Link to="/visitas" state={{ mostrarVisita: { vista: destino.vista, id: destino.id } }} className="enlace">
      {texto}
    </Link>
  );
}

function Fuentes({ f }: { f: FuentesDelAsistente }) {
  const [abiertas, setAbiertas] = useState(false);
  const hoy = hoyLocal();
  return (
    <div className="asis-fuente">
      <button type="button" className="asis-pastilla fuente" aria-expanded={abiertas} onClick={() => setAbiertas(!abiertas)}>
        <ClipboardCheck aria-hidden size={14} strokeWidth={1.8} />
        <span>{f.titulo}</span>
        <ChevronRight aria-hidden size={14} className="asis-chev" />
      </button>
      {abiertas && (
        <ul className="asis-fuentes">
          {f.visitas.map((v) => (
            <li key={v.visitaId}>
              <span className="asis-l1">
                <EnlaceDeFuente f={v} hoy={hoy} />
                <span className="asis-meta">{[diaCorto(v.fecha), v.ciudad].filter(Boolean).join(" · ")}</span>
                {!v.revisado && <Insignia tono="revision">Sin revisar</Insignia>}
              </span>
              <span className="asis-l2">
                {v.cliente} · {v.sitio}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Pie: avisos y caja de pregunta --------------------------------------------------------------------

function Pie({ c, administrador }: { c: ControlDelAsistente; administrador: boolean }) {
  const navegar = useNavigate();
  const { sinConexion, topeAgotado, bloqueada } = useBloqueo(c);
  const hoy = hoyLocal();
  const errorDeTope = c.errorAlPreguntar instanceof ErrorApi && c.errorAlPreguntar.codigo === "tope_agotado";
  return (
    <div className="asis-pie">
      {(topeAgotado || errorDeTope) && (
        <Aviso tono="alerta">
          <span>
            Se usó el tope de {c.nombre} de este mes. Se puede volver a preguntar el {primeroDelMesSiguiente(hoy)}.
          </span>
          {administrador && (
            <div>
              <Boton tamano="pequeno" onClick={() => void navegar({ to: "/administracion", state: { abrir: "tope" } })}>
                Cambiar el tope
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      {sinConexion && <Aviso tono="alerta">Sin conexión. Una respuesta que estaba en curso sigue en el servidor y aparece aquí al volver.</Aviso>}
      {c.errorAlPreguntar && !errorDeTope && <Aviso tono="error">{mensajeAlPreguntar(c.errorAlPreguntar, c.nombre, hoy)}</Aviso>}
      {c.errorAlDetener && <Aviso tono="error">No se pudo detener la respuesta. Intente de nuevo.</Aviso>}
      <Caja c={c} bloqueada={bloqueada} placeholder={sinConexion ? "Podrá preguntar cuando vuelva la conexión" : topeAgotado ? `Se podrá preguntar desde el ${primeroDelMesSiguiente(hoy)}` : c.vista === "conversacion" ? `Pregúntele algo más a ${c.nombre}` : `Pregúntele a ${c.nombre} por visitas, materiales o servicios`} />
      <p className="asis-pie-nota">{c.nombre} responde con los datos de la empresa y dice de dónde sale cada cifra.</p>
    </div>
  );
}

export function Caja({ c, bloqueada, placeholder }: { c: ControlDelAsistente; bloqueada: boolean; placeholder: string }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const enConversacion = c.vista === "conversacion" ? c.conversacionId : null;
  const conversacion = useQuery({ ...consultasDelAsistente.conversacion(enConversacion ?? ""), enabled: enConversacion !== null });
  const enCurso = enConversacion ? conversacion.data?.intercambios.find((i) => i.estado === "en_curso") : undefined;

  // La caja crece con lo escrito, hasta 140 px.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [c.borrador]);

  const enviar = () => {
    if (bloqueada || enCurso) return;
    c.preguntar(c.borrador, enConversacion, "caja");
  };

  return (
    <form
      className="asis-caja"
      aria-label="Pregunta"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <textarea
        ref={campo}
        rows={1}
        aria-label="Pregunta"
        placeholder={placeholder}
        maxLength={LARGO_MAXIMO_DE_PREGUNTA}
        value={c.borrador}
        disabled={bloqueada}
        onChange={(e) => c.setBorrador(e.target.value)}
        onKeyDown={(e) => {
          const accion = accionDeTecla({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }, { bloqueada, enCurso: Boolean(enCurso) });
          if (accion === "escribir") return;
          e.preventDefault();
          if (accion === "preguntar") enviar();
        }}
      />
      <div className="asis-caja-pie">
        <span className="asis-pista">
          {!bloqueada && (
            <>
              <span className="kbd">{etiquetaEnter()}</span> preguntar
            </>
          )}
        </span>
        {enCurso ? (
          <button type="button" className="asis-enviar detener" aria-label="Detener la respuesta" title="Detener la respuesta" aria-busy={c.deteniendo || undefined} onClick={() => !c.deteniendo && c.detener(enCurso.id)}>
            <Square aria-hidden size={12} />
          </button>
        ) : (
          <button type="submit" className="asis-enviar" aria-label="Preguntar" title={`Preguntar (${etiquetaEnter()})`} aria-busy={c.preguntando || undefined} disabled={!c.borrador.trim() || bloqueada}>
            <ArrowUp aria-hidden size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </form>
  );
}
