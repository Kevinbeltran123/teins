import { useEffect, useRef, useState, type FormEvent } from "react";
import { campoDeRuta, describirValor, rutaLegible, type Valor } from "@teins/dominio";
import { ArrowUp, Aviso, Boton, LockKeyhole, Send, sinMovimiento, useLoNuevo, MenuAcciones, useNotificar } from "@teins/ui";
import { aFechaCorta, iniciales } from "../../formato";
import { mensajeDeError } from "../../mensajes";
import { useComentar, useCorregirComentario, type Levantamiento } from "../../revision";
import { useSinEnviar } from "../../sinEnviar";
import { cuandoCorto, idDato, respuestasDe } from "./contexto";

/** El comentario sobre un dato se escribe debajo de su fila: no hay que ir al panel y volver. */
export function ComentarAqui({ l, seccion, campo, nombre, cerrar }: { l: Levantamiento; seccion: string; campo: string; nombre: string; cerrar: () => void }) {
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
export function Comentarios({ l, usuarioId, enfocado }: { l: Levantamiento; usuarioId: string | undefined; enfocado: { id: string; vez: number } | null }) {
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
  const [texto, setTexto, vaciarSiSigue] = useSinEnviar({ tipo: "general" }, "");
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
    const enviado = texto;
    if (!enviado.trim()) return;
    try {
      await comentar.mutateAsync({ texto: enviado.trim() });
      vaciarSiSigue(enviado);
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
  const [texto, setTexto, vaciarSiSigue] = useSinEnviar({ tipo: "respuesta", comentarioId: raiz.id }, "");
  const vacio = !texto.trim();
  async function enviar() {
    if (vacio || comentar.isPending) return;
    const enviado = texto;
    try {
      await comentar.mutateAsync({ texto: enviado.trim(), enRespuestaA: raiz.id });
      vaciarSiSigue(enviado);
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
