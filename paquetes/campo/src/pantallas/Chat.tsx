import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { bloques, campoDeRuta, describirValor, esNoObtenido, type Valor, type VersionFormato } from "@teins/dominio";
import { ArrowUp, ChevronLeft, Clock, LockKeyhole } from "@teins/ui";
import { db } from "../datos/instancia";
import { bajadaDe } from "../datos/lecturas";
import { leidoHasta, marcarLeido, pendientesDe, responder } from "../datos/conversacion";
import type { EstadoServidor, LevantamientoLocal } from "../datos/modelo";
import { armarChat, filasDelChat, horaDelChat, type MensajeDelChat } from "../conversacion";
import { useBotonAtras } from "../dispositivo/atras";
import { avisarConversacionAbierta } from "../dispositivo/conversacion";
import { useServidorAlcanzable } from "../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../sincronizacion/disparar";

/*
  El chat con oficina (ADR-0040, prototipos/hilos, «Campo»): una pantalla completa como WhatsApp, con todas las
  conversaciones de un levantamiento. Lo que escribe el técnico queda en el teléfono y sale solo con señal.
*/

/** Con el chat abierto se consulta cada 15 s (ADR-0040): sin aviso, lo nuevo llega igual. */
const CONSULTA_MS = 15_000;
const LARGO_MAXIMO = 1000;

const formatoDia = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" });
function diaYHora(iso: string): string {
  const fecha = new Date(iso);
  const dias = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  const dia = dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : formatoDia.format(fecha);
  return `${dia} ${horaDelChat(iso)}`;
}

const RECHAZOS = {
  revisado: "No se envió: oficina ya lo había marcado revisado. Si es importante, llama a oficina.",
  no_existe: "No se envió: oficina retiró esa pregunta. Si es importante, llama a oficina.",
  invalida: "No se envió. Si es importante, llama a oficina.",
} as const;

export function Chat({
  levantamiento,
  formato,
  servidor,
  sitio,
  volver,
  verDato,
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  servidor: EstadoServidor | null;
  /** «Hotel Plaza Real · Torre A», bajo «Oficina». */
  sitio: string;
  volver: () => void;
  verDato: (seccion: string, campo: string) => void;
}) {
  useBotonAtras(volver);
  const tecnicoId = levantamiento.tecnicoId!;
  const enLinea = useServidorAlcanzable();
  const pendientes = useLiveQuery(() => pendientesDe(db, tecnicoId, levantamiento.id), [tecnicoId, levantamiento.id]);
  const comentarios = servidor?.comentarios ?? [];
  const chat = armarChat(comentarios, pendientes ?? []);
  const revisado = servidor?.estado === "revisado";

  // Lo leído al abrir: la franja «N mensajes sin leer» se queda mientras el chat esté abierto.
  const [leidoAlAbrir, setLeidoAlAbrir] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void leidoHasta(db, tecnicoId, levantamiento.id).then((l) => setLeidoAlAbrir(l));
  }, [tecnicoId, levantamiento.id]);
  // Lo que está a la vista se da por leído: el punto de «Enviados» se apaga.
  const ultimoDeOficina = chat.filter((m) => m.de === "oficina").at(-1)?.en;
  useEffect(() => {
    if (ultimoDeOficina) void marcarLeido(db, tecnicoId, levantamiento.id, ultimoDeOficina);
  }, [ultimoDeOficina, tecnicoId, levantamiento.id]);

  // Mientras se ve, sus avisos no se muestran (ADR-0040).
  useEffect(() => {
    avisarConversacionAbierta(levantamiento.id);
    return () => avisarConversacionAbierta(null);
  }, [levantamiento.id]);

  // Con el chat abierto y señal, se pregunta cada 15 s; al abrirlo, de una vez.
  useEffect(() => {
    if (!enLinea) return;
    sincronizarEnSegundoPlano({ bajar: true });
    const intervalo = setInterval(() => sincronizarEnSegundoPlano({ bajar: true }), CONSULTA_MS);
    return () => clearInterval(intervalo);
  }, [enLinea]);

  // A quién se responde: lo que tocó el técnico o, si no tocó nada, la última pregunta de oficina. Al empezar a escribir
  // queda fija: una pregunta nueva que llega mientras escribe no cambia el destino (iteración 42). Una que oficina retiró
  // deja de serlo, y se vuelve a la última que sigue.
  const [elegido, setElegido] = useState<{ comentarioId: string; vez: number } | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const sigue = (comentarioId: string | null | undefined): comentarioId is string => Boolean(comentarioId) && chat.some((m) => m.de === "oficina" && m.comentarioId === comentarioId);
  const ultima = chat.filter((m) => m.de === "oficina").at(-1)?.comentarioId;
  const objetivo = [elegido?.comentarioId, fijado].find(sigue) ?? ultima;
  const pregunta = chat.filter((m) => m.de === "oficina" && m.comentarioId === objetivo).at(-1)?.texto;
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [noSeGuardo, setNoSeGuardo] = useState(false);
  // Con la sesión vencida, lo que espera en la cola no sale hasta volver a iniciar sesión (desde el inicio).
  const sesionVencida = useLiveQuery(async () => Boolean((await bajadaDe(db, tecnicoId))?.sesionVencida), [tecnicoId]);

  function escribir(nuevo: string) {
    if (texto.trim() === "" && nuevo.trim() !== "") setFijado(objetivo ?? null);
    if (nuevo.trim() === "") setFijado(null);
    setTexto(nuevo);
  }

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || !objetivo || enviando) return;
    setEnviando(true);
    setNoSeGuardo(false);
    try {
      await responder(db, tecnicoId, { levantamientoId: levantamiento.id, comentarioId: objetivo, texto: limpio }, new Date());
      setTexto("");
      setFijado(null);
      sincronizarEnSegundoPlano();
    } catch (error) {
      // Lo escrito se queda en el campo; soporte necesita la causa (ADR-0017).
      console.error("No se pudo guardar la respuesta", error);
      setNoSeGuardo(true);
    } finally {
      setEnviando(false);
    }
  }

  // Al abrir, a la franja de sin leer o al final; después, cada mensaje nuevo baja al final.
  const lista = useRef<HTMLDivElement>(null);
  const cuantos = chat.length;
  const primeraVez = useRef(true);
  useLayoutEffect(() => {
    const caja = lista.current;
    if (!caja || leidoAlAbrir === undefined || pendientes === undefined) return;
    const franja = primeraVez.current ? caja.querySelector<HTMLElement>("[data-franja]") : null;
    if (franja) caja.scrollTop = franja.offsetTop - 12;
    else caja.scrollTop = caja.scrollHeight;
    primeraVez.current = false;
  }, [cuantos, leidoAlAbrir, pendientes === undefined]);

  const filas = leidoAlAbrir === undefined ? [] : filasDelChat(chat, leidoAlAbrir);
  const ultimoMio = chat.filter((m) => m.de === "tecnico").at(-1);
  const repeticiones = levantamiento.repeticiones ?? {};

  /** El dato del que habla la conversación, como quedó en lo que envió el técnico. */
  function dato(comentarioId: string) {
    const c = comentarios.find((x) => x.id === comentarioId);
    if (!c?.seccion || !c.campo) return null;
    const definicion = campoDeRuta(formato, repeticiones, c.seccion, c.campo);
    if (!definicion) return null;
    const valor = levantamiento.respuestas[c.seccion]?.[c.campo] as Valor | undefined;
    const vacio = valor === undefined || valor === null || valor === "" || esNoObtenido(valor);
    return {
      seccion: c.seccion,
      campo: c.campo,
      titulo: bloques(formato, repeticiones).find((b) => b.clave === c.seccion)?.titulo ?? c.seccion,
      pregunta: definicion.etiqueta,
      valor: vacio ? null : describirValor(definicion, valor),
    };
  }

  function estadoBajo(m: MensajeDelChat) {
    if (m.estado === "rechazada") {
      const motivo = pendientes?.find((p) => p.llave === m.id)?.rechazo ?? "invalida";
      return <span className="mx-1 mt-1 max-w-[78%] self-end text-right text-[12px] text-peligro">{RECHAZOS[motivo]}</span>;
    }
    if (m.estado === "cola")
      return sesionVencida ? (
        <span className="mx-1 mt-1 inline-flex items-center gap-1 self-end text-[12px] text-alerta-texto">
          <Clock aria-hidden className="size-[13px]" />
          Se envía cuando vuelvas a iniciar sesión
        </span>
      ) : enLinea ? (
        <span className="mx-1 mt-1 self-end text-[12px] text-texto-secundario">Enviando…</span>
      ) : (
        <span className="mx-1 mt-1 inline-flex items-center gap-1 self-end text-[12px] text-alerta-texto">
          <Clock aria-hidden className="size-[13px]" />
          Se envía cuando haya señal
        </span>
      );
    return <span className="mx-1 mt-1 self-end text-[12px] text-texto-secundario">{m.estado === "leido" ? "Leído" : "Enviado"}</span>;
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-fondo pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label="Chat con oficina">
      <header className="grid flex-none grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-division px-1.5 pb-2 pt-1">
        <button type="button" onClick={volver} aria-label="Volver" className="grid size-11 place-items-center rounded-control text-acento focus-visible:outline-3 focus-visible:outline-foco">
          <ChevronLeft aria-hidden className="size-[26px]" strokeWidth={2} />
        </button>
        <span className="flex min-w-0 flex-col text-center leading-tight">
          <b className="text-[16px] font-semibold">Oficina</b>
          {enLinea ? <small className="truncate text-[12.5px] text-texto-secundario">{sitio}</small> : <small className="text-[12.5px] text-alerta-texto">Esperando señal…</small>}
        </span>
        <span />
      </header>

      <div ref={lista} className="flex flex-1 flex-col overflow-y-auto px-3 pb-3 pt-1 [scrollbar-width:none]" aria-live="polite">
        <p className="mt-3 max-w-[86%] self-center text-center text-[12.5px] leading-snug text-texto-secundario">Oficina revisa lo que enviaste y te pregunta aquí. Toca un mensaje para responderlo.</p>
        {filas.map((f, i) => {
          if (f.tipo === "hora")
            return (
              <p key={`h${i}`} className="mb-0.5 mt-4 self-center text-[12px] font-medium text-texto-secundario">
                {diaYHora(f.en)}
              </p>
            );
          if (f.tipo === "sin_leer")
            return (
              <p key="franja" data-franja className="mt-3.5 flex items-center gap-2 text-[12px] font-semibold text-acento before:h-px before:flex-1 before:bg-acento/35 after:h-px after:flex-1 after:bg-acento/35">
                {f.cuantos === 1 ? "1 mensaje sin leer" : `${f.cuantos} mensajes sin leer`}
              </p>
            );
          const m = f.mensaje;
          const siguiente = filas[i + 1];
          const pegadoAbajo = siguiente?.tipo === "mensaje" && siguiente.sigue;
          const mio = m.de === "tecnico";
          const forma = mio
            ? `${f.sigue ? "mt-0.5 rounded-tr-[6px]" : "mt-2"} ${pegadoAbajo ? "rounded-br-[6px]" : ""}`
            : `${f.sigue ? "mt-0.5 rounded-tl-[6px]" : "mt-2"} ${pegadoAbajo ? "rounded-bl-[6px]" : ""}`;
          if (mio) {
            const color =
              m.estado === "rechazada"
                ? "bg-superficie-pista text-texto shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-peligro)_55%,transparent)]"
                : m.estado === "cola"
                  ? "bg-acento/60 text-sobre-acento"
                  : "bg-acento text-sobre-acento";
            return (
              <div key={m.id} className="flex flex-col">
                <div className={`flex max-w-[78%] flex-col self-end whitespace-pre-line rounded-[19px] px-[13px] py-2 text-[16px] leading-[1.35] [overflow-wrap:anywhere] ${color} ${forma}`}>
                  {f.cita && (
                    <span className="-mx-[5px] mb-1.5 flex flex-col rounded-[8px] border-l-[3px] border-white/85 bg-white/15 px-[9px] py-1 text-[13.5px] leading-tight text-white/90">
                      <b className="text-[12.5px] font-semibold text-white">Oficina</b>
                      <span className="truncate">{f.cita}</span>
                    </span>
                  )}
                  {m.texto}
                </div>
                {(m === ultimoMio || m.estado === "rechazada") && estadoBajo(m)}
              </div>
            );
          }
          const d = f.referencia ? dato(m.comentarioId) : null;
          const elegir = () => !revisado && setElegido((e) => ({ comentarioId: m.comentarioId, vez: (e?.vez ?? 0) + 1 }));
          return (
            // Tocar el globo elige la pregunta: el botón del texto lo cubre entero.
            <div key={m.id} className={`relative flex max-w-[78%] flex-col self-start rounded-[19px] bg-superficie-pista px-[13px] py-2 text-[16px] leading-[1.35] text-texto ${forma}`}>
              {d && (
                <button
                  type="button"
                  onClick={() => verDato(d.seccion, d.campo)}
                  className="relative z-10 -mx-[5px] mb-1.5 flex flex-col gap-px rounded-[8px] border-l-[3px] border-acento bg-texto/[0.07] px-2.5 py-1.5 text-left text-[14px] leading-tight text-texto focus-visible:outline-3 focus-visible:outline-foco"
                >
                  <small className="text-[12px] text-texto-secundario">Tu respuesta · {d.titulo}</small>
                  <span className="font-semibold">{d.pregunta}</span>
                  <span className={d.valor ? "" : "italic text-texto-secundario"}>{d.valor ?? "No la respondiste"}</span>
                </button>
              )}
              <button
                type="button"
                aria-label={`Responder: ${m.texto}`}
                disabled={revisado}
                onClick={elegir}
                className="whitespace-pre-line text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-3 focus-visible:outline-foco disabled:cursor-default"
              >
                {m.texto}
              </button>
            </div>
          );
        })}
      </div>

      {revisado ? (
        <div className="flex flex-none flex-col items-center gap-0.5 border-t border-division bg-fondo px-[18px] pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3.5 text-center text-[14px] text-texto-secundario">
          <b className="inline-flex items-center gap-1.5 font-semibold text-texto">
            <LockKeyhole aria-hidden className="size-4" />
            La conversación quedó cerrada
          </b>
          <span>Oficina marcó revisado el levantamiento.</span>
        </div>
      ) : (
        <form
          className="flex flex-none flex-col gap-1.5 bg-fondo px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          {pregunta && (
            <div key={elegido?.vez ?? 0} className={`flex items-stretch gap-2.5 rounded-[12px] bg-panel-hundido px-3 py-1.5 text-[13.5px] leading-tight ${elegido ? "motion-safe:animate-resaltar" : ""}`}>
              <span aria-hidden className="w-[3px] flex-none rounded-[3px] bg-acento" />
              <span className="flex min-w-0 flex-col">
                <small className="text-[12.5px] font-semibold text-acento">Respondiendo a Oficina</small>
                <span className="truncate text-texto-secundario">{pregunta}</span>
              </span>
            </div>
          )}
          {noSeGuardo && <p className="px-1 text-[13px] text-peligro">No se pudo guardar tu mensaje en el teléfono. Revisa que tenga espacio e intenta de nuevo.</p>}
          {!objetivo && <p className="px-1 text-[13px] text-texto-secundario">Cuando oficina te pregunte algo, lo respondes aquí.</p>}
          <div className="relative">
            <textarea
              rows={1}
              maxLength={LARGO_MAXIMO}
              placeholder="Mensaje"
              aria-label="Respuesta para oficina"
              value={texto}
              onChange={(e) => escribir(e.target.value)}
              className="block max-h-[120px] min-h-10 w-full resize-none rounded-[20px] border-0 bg-panel py-[9px] pl-4 pr-[46px] text-[16px] leading-[1.4] text-texto shadow-[inset_0_0_0_1px_var(--color-borde-control)] [field-sizing:content] placeholder:text-texto-terciario focus:shadow-[inset_0_0_0_1.5px_var(--color-acento)] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar"
              aria-disabled={!texto.trim() || enviando || !objetivo}
              className="absolute bottom-[5px] right-[5px] grid size-[30px] place-items-center before:absolute before:-inset-[7px] before:content-[''] rounded-full bg-acento text-sobre-acento aria-disabled:bg-superficie-pista aria-disabled:text-texto-terciario"
            >
              <ArrowUp aria-hidden className="size-[17px]" strokeWidth={2.4} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
