import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { bloquesVisibles, esNoObtenido } from "@teins/dominio";
import { ErrorApi } from "@teins/protocolo";
import { ErrorDeCarga, BotonIcono, ChevronLeft, Dialogo, EncabezadoPagina, EsqueletoLista, nombreDeTransicion, PanelRight, sinMovimiento } from "@teins/ui";
import { consultas } from "../api";
import { aFechaCorta } from "../formato";
import { avisarConversacionAbierta } from "../conversacion";
import { claveDato, correccionesDe, seccionCorregida, useLeerConversacion } from "../revision";
import { hayCorreccionAbierta, SinEnviar, sinEnviarDe } from "../sinEnviar";
import { BotonMostrarVista, EditorConVista, useVistaPrevia } from "./Lienzo";
import { esTexto, unoDe, usePreferencia } from "../preferencias";
import { useTeclaSuelta } from "../atajos";
import { recienteDeLevantamiento, useAnotarReciente } from "./Paleta";
import { CorreccionEnCurso, VerConversacion, type EnCurso, type Pestana } from "./detalle/contexto";
import { PanelDeRevision } from "./detalle/PanelDeRevision";
import { EstadoDeRevision } from "./detalle/EstadoDeRevision";
import { FilaCampo } from "./detalle/FilaCampo";

const migas = (
  <Link to="/" className="migas">
    <ChevronLeft aria-hidden size={16} />
    Levantamientos
  </Link>
);

/** Con la conversación a la vista se consulta cada 15 s (ADR-0040): lo que responde el técnico llega sin aviso. */
const CONSULTA_CONVERSACION_MS = 15_000;

/**
 * Detalle de un levantamiento (prototipos/oficina): se lee como un documento, con las secciones del recorrido de
 * campo; "Corregir" y "Comentar" aparecen al pasar por cada fila y el comentario se escribe debajo del dato. Desde la
 * iteración 38 (prototipos/revision-al-lado) se arma como el informe: los datos a la izquierda y, a la derecha, un
 * panel a todo el alto con el capítulo como saldrá en el informe, los comentarios y el historial. El estado y su acción
 * van en la barra.
 */
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
  useAnotarReciente(abierto ? recienteDeLevantamiento(abierto) : null);
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
        <ErrorDeCarga texto={noExiste ? "Este levantamiento no existe o no pertenece a su organización." : "No se pudo cargar el levantamiento."} reintentar={noExiste ? undefined : () => void consulta.refetch()} />
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
  // Sin lo que el formato oculta por sus condiciones (ADR-0058): no aplica, no se revisa ni sale en el informe.
  const todos = bloquesVisibles(l.formatoDefinicion, l.repeticiones, l.respuestas);
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
