import { useRef, useState } from "react";
import { agrupar } from "../../resumen";
import { useLiveQuery } from "dexie-react-hooks";
import { archivosReferenciados, bloques, describirValor, esCantidades, esFirma, esNoObtenido, type VersionFormato } from "@teins/dominio";
import { Building, WifiOff, Boton, BotonSiguiente, sinMovimiento, ChevronDown, Confirmacion, ProcesoDeEnvio, type EstadoDeProceso, Pencil, Send, Smartphone, TriangleAlert, TablaCantidades, Trash, useSinRepetir, ValorLeido } from "@teins/ui";
import { db, repositorio } from "../../datos/instancia";
import { visitaDe, visitasDe } from "../../datos/lecturas";
import { subidosDe } from "../../datos/lecturasDeCaptura";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal } from "../../datos/modelo";
import { VisitaConOtroBorrador } from "../../datos/repositorio";
import { claseDeTono, estadoDeEnvio, estadoSegunServidor, porQueNoEntro, QUE_HACER_CON_EL_RECHAZO } from "../../mensajes";
import { useServidorAlcanzable } from "../../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../../sincronizacion/disparar";
import { agendaDeVisitas, hoyLocal } from "../../visitas";
import { armarChat, horaDelChat, sinLeer } from "../../conversacion";
import { leidoHasta, pendientesDe } from "../../datos/conversacion";
import { Chat } from "../Chat";
import { BocetoLeido } from "./Boceto";
import { FirmaLeida } from "./Firma";
import { FotosLeidas } from "./Fotos";
import { anclaDeDato } from "./contexto";

export function Enviado({
  levantamiento,
  formato,
  envio,
  servidor,
  volver,
  estadoChat,
  alDescartar,
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  envio: EstadoDeEnvio | null;
  servidor: EstadoServidor | null;
  volver: () => void;
  /** El chat con oficina (ADR-0040): lo guarda Captura, porque esta vista se vuelve a montar al cambiar el estado. */
  estadoChat: { abierto: boolean; abrir: (abierto: boolean) => void };
  /** Descartó un envío que oficina rechazó para siempre: quien abrió la captura vuelve al inicio y lo dice. */
  alDescartar: () => void;
}) {
  const [descartando, setDescartando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const enLinea = useServidorAlcanzable();
  const { abierto: chatAbierto, abrir: setChatAbierto } = estadoChat;
  const loEnviado = useRef<HTMLDetailsElement>(null);
  const tecnicoId = levantamiento.tecnicoId;
  const pendientes = useLiveQuery(async () => (tecnicoId ? pendientesDe(db, tecnicoId, levantamiento.id) : []), [tecnicoId, levantamiento.id]);
  const leido = useLiveQuery(async () => (tecnicoId ? leidoHasta(db, tecnicoId, levantamiento.id) : null), [tecnicoId, levantamiento.id]);
  const sitio = useLiveQuery(async () => {
    const v = levantamiento.visitaId && tecnicoId ? await visitaDe(db, tecnicoId, levantamiento.visitaId) : null;
    // La visita atendida sale del teléfono al día siguiente (ADR-0041): el levantamiento guarda dónde fue (iteración 42).
    return v ? `${v.cliente.nombre} · ${v.sitio.nombre}` : levantamiento.lugar ? `${levantamiento.lugar.cliente} · ${levantamiento.lugar.sitio}` : "";
  }, [levantamiento.visitaId, tecnicoId, levantamiento.lugar?.cliente, levantamiento.lugar?.sitio]);
  const [reintentar, reintentando] = useSinRepetir(async () => {
    await repositorio.reintentarEnvio(levantamiento.id);
    sincronizarEnSegundoPlano();
  });
  // El avance real: cuántos de sus archivos (fotos, bocetos, firma) ya subieron, y si oficina lo recibió.
  const huellas = archivosReferenciados(levantamiento.respuestas);
  const totalArchivos = huellas.length;
  const subidos = useLiveQuery(() => subidosDe(db, huellas), [huellas.join(",")]);
  const recibido = Boolean(servidor) || envio?.estado === "recibido";
  const proceso: EstadoDeProceso = recibido ? "listo" : envio?.estado === "error" ? "error" : !enLinea || envio?.ultimoError?.codigo === "sin_conexion" ? "esperando" : "enviando";
  // La siguiente visita, si hay otra: el botón lleva a ella.
  const siguienteVisita = useLiveQuery(async () => {
    if (!levantamiento.tecnicoId) return null;
    // La misma agenda del inicio (iteración 40): lo atendido o terminado no es la siguiente; las atrasadas sí lo son.
    const propios = await repositorio.listar(levantamiento.tecnicoId);
    const con = (estado: LevantamientoLocal["estado"]) => new Set(propios.filter((l) => l.estado === estado && l.visitaId).map((l) => l.visitaId!));
    const visitas = (await visitasDe(db, levantamiento.tecnicoId)).filter((v) => v.id !== levantamiento.visitaId && !v.fueraDeAlcance);
    return agendaDeVisitas(visitas, hoyLocal(), con("borrador"), con("enviado")).pendientes[0] ?? null;
  }, [levantamiento.tecnicoId, levantamiento.visitaId]);
  // Lo que dijo el servidor en la bajada manda sobre el estado de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, enLinea) : null;
  const comentarios = servidor?.comentarios ?? [];
  const chat = armarChat(comentarios, pendientes ?? []);
  const ultimo = chat.at(-1);
  const nuevos = leido === undefined ? 0 : sinLeer(chat, leido);
  const enCola = chat.filter((m) => m.estado === "cola").length;
  // «Ver lo que enviaste» abierto en el dato del que habla la conversación.
  function verDato(seccion: string, campo: string) {
    setChatAbierto(false);
    if (loEnviado.current) loEnviado.current.open = true;
    requestAnimationFrame(() => document.getElementById(anclaDeDato(seccion, campo))?.scrollIntoView({ block: "center", behavior: sinMovimiento() ? "auto" : "smooth" }));
  }
  if (chatAbierto && tecnicoId) return <Chat levantamiento={levantamiento} formato={formato} servidor={servidor} sitio={sitio ?? ""} volver={() => setChatAbierto(false)} verDato={verDato} />;
  return (
    <>
      {levantamiento.estado === "enviado" ? (
        <>
          <ProcesoDeEnvio
            estado={proceso}
            avance={recibido ? 1 : totalArchivos > 0 && subidos !== undefined ? (subidos / (totalArchivos + 1)) : null}
            titulo={{ listo: "En oficina", enviando: "Enviando a oficina…", esperando: "Esperando señal", error: "No se pudo enviar" }[proceso]}
            detalle={
              proceso === "listo"
                ? "Oficina ya puede revisar este levantamiento."
                : proceso === "esperando"
                  ? "Se envía solo cuando vuelva la señal. Puedes seguir con otra visita."
                  : proceso === "error"
                    ? porQueNoEntro(envio?.ultimoError?.codigo)
                    : "Puedes salir de esta pantalla: el envío sigue solo."
            }
            etapas={[
              { clave: "guardado", texto: "Guardado en el teléfono", estado: "hecho" },
              {
                clave: "archivos",
                texto: totalArchivos > 0 ? `Fotos y dibujos · ${recibido ? totalArchivos : (subidos ?? 0)} de ${totalArchivos}` : "Datos del levantamiento",
                estado: recibido || (totalArchivos > 0 && subidos === totalArchivos) ? "hecho" : proceso === "error" ? "error" : proceso === "enviando" ? "en_curso" : "espera",
              },
              { clave: "recibido", texto: recibido ? "Recibido en oficina" : "Llega a oficina", estado: recibido ? "hecho" : proceso === "enviando" && (totalArchivos === 0 || subidos === totalArchivos) ? "en_curso" : "espera" },
            ]}
          />
          {envio?.estado === "error" && !recibido ? (
            <>
              <p className="-mt-2 text-center text-ayuda text-texto-secundario">{QUE_HACER_CON_EL_RECHAZO}</p>
              <Boton cargando={reintentando} onClick={() => void reintentar()}>
                Reintentar envío
              </Boton>
              {/* Oficina nunca lo recibió: si hay algo que corregir, vuelve a ser borrador (ADR-0045). */}
              <Boton variante="fantasma" icono={Pencil} onClick={() => setCorrigiendo(true)}>
                Volver a borrador para corregir
              </Boton>
              {corrigiendo && (
                <Confirmacion
                  nivel="consecuencia"
                  forma="inferior"
                  titulo="¿Volver a borrador?"
                  confirmar="Volver a borrador"
                  accion={() => repositorio.volverABorrador(levantamiento.id)}
                  mensajeDeError={(e) =>
                    e instanceof VisitaConOtroBorrador ? "Esta visita ya tiene otro levantamiento sin enviar. Envíalo o descártalo y vuelve a intentarlo." : "No se pudo volver a borrador. Intenta de nuevo."
                  }
                  alCerrar={() => setCorrigiendo(false)}
                  consecuencias={[
                    { icono: Pencil, texto: "Lo vuelves a editar en este teléfono", detalle: "Oficina nunca lo recibió: no hay otra copia que cambie" },
                    { icono: Send, texto: "Cuando lo envíes, sale otra vez a oficina" },
                  ]}
                />
              )}
              {/* Si oficina no lo va a aceptar nunca (otro ya lo envió, el formato se retiró), aquí sale del inicio. */}
              <Boton variante="fantasma" icono={Trash} onClick={() => setDescartando(true)}>
                Descartar levantamiento
              </Boton>
              {descartando && (
                <Confirmacion
                  nivel="irreversible"
                  forma="inferior"
                  titulo="¿Descartar este levantamiento?"
                  confirmar="Descartar"
                  descartar="Volver"
                  accion={() => repositorio.descartar(levantamiento.id, new Date())}
                  mensajeDeError={() => "No se pudo descartar. Intenta de nuevo."}
                  alCerrar={() => setDescartando(false)}
                  alTerminar={alDescartar}
                  consecuencias={[
                    { icono: Smartphone, texto: "Deja de esperar a oficina y sale de Mis visitas" },
                    { icono: Trash, texto: "Queda 30 días en Descartados, en tu cuenta", detalle: "De ahí lo recuperas con todo lo que tenía" },
                    { icono: TriangleAlert, texto: "Después se borra del teléfono con sus fotos", detalle: "Oficina nunca lo recibió: no queda otra copia" },
                  ]}
                />
              )}
            </>
          ) : (
            !recibido && estado && <p className="-mt-2 text-center text-ayuda text-texto-secundario">{estado.texto}</p>
          )}
          <BotonSiguiente onClick={volver}>
            {siguienteVisita ? (
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span>Ver la siguiente visita</span>
                <span className="max-w-full truncate text-ayuda font-bold opacity-75">{`${siguienteVisita.cliente.nombre} · ${siguienteVisita.sitio.nombre}`}</span>
              </span>
            ) : (
              "Ir a mis visitas"
            )}
          </BotonSiguiente>
        </>
      ) : (
        estado && (
          <div className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
            <p className={`text-cuerpo font-bold ${claseDeTono[estado.tono]}`} aria-live="polite">
              {estado.texto}
            </p>
          </div>
        )
      )}
      {comentarios.length > 0 && ultimo && (
        <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-2">
          {/* Sin señal y con respuestas en cola: quedan en el teléfono y salen solas (ADR-0040). */}
          {!enLinea && enCola > 0 && (
            <div className="flex gap-2.5 rounded-panel bg-alerta-fondo px-3.5 py-3 text-[14.5px] leading-snug" role="status">
              <WifiOff aria-hidden className="mt-0.5 size-[18px] flex-none text-alerta-texto" />
              <span>
                <b className="block font-semibold">Sin señal</b>
                {enCola === 1 ? "Tu mensaje está guardado en el teléfono y se envía solo" : "Tus mensajes están guardados en el teléfono y se envían solos"} cuando vuelva.
              </span>
            </div>
          )}
          <h2 id="titulo-comentarios" className="px-1 text-ayuda font-bold text-texto-secundario">
            Comentarios de oficina
          </h2>
          <button
            type="button"
            onClick={() => setChatAbierto(true)}
            className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-px rounded-panel border border-division bg-panel px-3.5 py-3 text-left focus-visible:outline-3 focus-visible:outline-foco"
          >
            <span className="row-span-2 grid size-11 place-items-center rounded-full bg-acento/12 text-acento">
              <Building aria-hidden className="size-[21px]" />
            </span>
            <b className="text-[16px] font-semibold">Oficina</b>
            <span className={`justify-self-end text-[13px] ${nuevos > 0 ? "font-semibold text-acento" : "text-texto-secundario"}`}>{horaDelChat(ultimo.en)}</span>
            <span className="min-w-0 truncate text-[14.5px] text-texto-secundario">
              {ultimo.de === "tecnico" ? "Tú: " : ""}
              {ultimo.texto}
            </span>
            {nuevos > 0 ? (
              <span className="inline-grid h-[22px] min-w-[22px] place-items-center justify-self-end rounded-full bg-acento px-[7px] text-[12.5px] font-semibold text-sobre-acento" aria-label={nuevos === 1 ? "1 sin leer" : `${nuevos} sin leer`}>
                {nuevos}
              </span>
            ) : (
              <span />
            )}
          </button>
        </section>
      )}
      <details ref={loEnviado} open={levantamiento.estado !== "enviado" || undefined} className="group flex flex-col rounded-panel border border-division bg-panel [&[open]>summary]:mb-1">
        <summary className="flex min-h-tactil cursor-pointer items-center justify-between gap-3 rounded-panel px-4 text-cuerpo font-bold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
          {levantamiento.estado === "enviado" ? "Ver lo que enviaste" : "Ver lo capturado"}
          <ChevronDown aria-hidden className="size-5 shrink-0 text-texto-secundario transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 px-2 pb-2 motion-safe:animate-aparecer">
      {bloques(formato, levantamiento.repeticiones ?? {}).map(({ seccion, clave, titulo }, _i, todos) =>
        agrupar(seccion.campos).map((grupo, g) => (
          <div key={`${clave}.${grupo[0]!.clave}`} className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-4">
            {g === 0 && todos.length > 1 && <h2 className="text-subtitulo font-extrabold">{titulo}</h2>}
            {grupo.map((campo) => {
              const valor = levantamiento.respuestas[clave]?.[campo.clave];
              // Cada dato con su id: el chat lleva al dato del que habla (ADR-0040).
              return <div key={campo.clave} id={anclaDeDato(clave, campo.clave)} className="scroll-mt-4">{campo.tipo === "foto" && !esNoObtenido(valor) ? (
                <FotosLeidas key={campo.clave} etiqueta={campo.etiqueta} ids={Array.isArray(valor) ? (valor as string[]) : []} />
              ) : campo.tipo === "cantidades" && esCantidades(valor) ? (
                <TablaCantidades key={campo.clave} etiqueta={campo.etiqueta} lineas={valor} />
              ) : campo.tipo === "boceto" && !esNoObtenido(valor) ? (
                <BocetoLeido key={campo.clave} etiqueta={campo.etiqueta} valor={valor} />
              ) : campo.tipo === "firma" && esFirma(valor) ? (
                <FirmaLeida key={campo.clave} etiqueta={campo.etiqueta} valor={valor} />
              ) : (
                <ValorLeido key={campo.clave} etiqueta={campo.etiqueta}>
                  {describirValor(campo, valor)}
                </ValorLeido>
              )}</div>;
            })}
          </div>
        )),
      )}
        </div>
      </details>
    </>
  );
}
