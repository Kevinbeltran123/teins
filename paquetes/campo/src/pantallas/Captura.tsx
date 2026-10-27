import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Aviso, Boton, BotonRedondo, conTransicion, nombreDeTransicion, sinMovimiento, BotonIcono, ChevronLeft, EsqueletoBloques, Insignia } from "@teins/ui";
import { db, repositorio } from "../datos/instancia";
import { bajadaDe, estadoDe, visitaDe } from "../datos/lecturas";
import { envioDe } from "../datos/lecturasDeCaptura";
import { permisoLocal } from "../sesion/permiso";
import type { LevantamientoLocal } from "../datos/modelo";
import { horaExacta } from "../formato";
import { formatoDe, nombreDeFormato, useFormatos } from "../formatos";
import { useBotonAtras } from "../dispositivo/atras";
import { Borrador } from "./captura/Borrador";
import { Enviado } from "./captura/Enviado";
import { CabeceraDeLaVisita } from "./captura/contexto";

export function Captura({
  id,
  volver,
  alMostrar,
  alDescartar,
  conversacion = false,
  pedirSesion,
}: {
  id: string;
  volver: () => void;
  /** Abrir de una vez el chat con oficina: lo pidió un aviso (ADR-0040). */
  conversacion?: boolean;
  /** Con la captura bloqueada y la sesión vencida, conectarse no basta: se inicia sesión desde aquí (iteración 42). */
  pedirSesion?: () => void;
  /** Ya se ve lo del levantamiento (no el esqueleto): la tarjeta del inicio puede convertirse en la cabecera. */
  alMostrar?: () => void;
  /** Se descartó el borrador (ADR-0035): quien abrió la captura vuelve al inicio y lo dice. */
  alDescartar?: () => void;
}) {
  // `null` distingue "no existe" de `undefined` (cargando).
  const levantamiento = useLiveQuery(async () => (await repositorio.obtener(id)) ?? null, [id]);
  const envio = useLiveQuery(() => envioDe(db, id), [id]);
  const servidor = useLiveQuery(() => estadoDe(db, id), [id]);
  const formatos = useFormatos();
  const [chatAbierto, setChatAbierto] = useState(conversacion);
  const estadoChat = { abierto: chatAbierto, abrir: setChatAbierto };
  // El botón atrás del teléfono hace lo que la flecha de la pantalla (iteración 24c): el borrador dice cuál es.
  const atrasDelBorrador = useRef<(() => void) | null>(null);
  useBotonAtras(() => (atrasDelBorrador.current ?? volver)());
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? visitaDe(db, l.tecnicoId, l.visitaId) : null;
  }, [id]);
  // Vencido el permiso de trabajo local, el borrador se ve pero no se edita (ADR-0009, parte 2).
  const permiso = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return permisoLocal(l?.tecnicoId ? await bajadaDe(db, l.tecnicoId) : null, Date.now());
  }, [id]);
  const bloqueado = permiso === undefined ? undefined : permiso !== "vigente";
  // Los campos leen los valores una sola vez; después solo escriben (ver CampoTexto).
  const [inicial, setInicial] = useState<LevantamientoLocal>();
  useEffect(() => {
    if (levantamiento && !inicial) setInicial(levantamiento);
  }, [levantamiento, inicial]);

  const formato = levantamiento && formatos ? formatoDe(formatos, levantamiento) : undefined;
  // Al enviar, el borrador se queda a la vista mientras baja la hoja de confirmar; después la pantalla avanza a
  // "Enviado" en una transición, desde arriba (iteración 27).
  const [retenido, setRetenido] = useState(false);
  const borrador = levantamiento?.estado === "borrador" || (retenido && levantamiento?.estado === "enviado");
  const pantallaEnviado = Boolean(levantamiento && formato && levantamiento.estado === "enviado" && !retenido && envio !== undefined);
  const cargando = levantamiento === undefined || envio === undefined || formatos === undefined || bloqueado === undefined || visita === undefined || (levantamiento !== null && !inicial);
  const mostrado = pantallaEnviado || !cargando;
  useLayoutEffect(() => {
    if (mostrado) alMostrar?.();
  }, [mostrado]);
  const cabecera = levantamiento?.visitaId ? nombreDeTransicion("visita", levantamiento.visitaId) : nombreDeTransicion("lev", id);
  const soltar = () =>
    setTimeout(
      () =>
        void conTransicion(() => {
          setRetenido(false);
          window.scrollTo(0, 0);
        }, "adelante"),
      // Lo que tarda en bajar la hoja de confirmar.
      sinMovimiento() ? 0 : 220,
    );

  // Enviado: la pantalla de éxito del prototipo, con lo enviado debajo.
  if (pantallaEnviado && levantamiento && formato && envio !== undefined) {
    return (
      <div className="min-h-dvh bg-fondo">
        <div className="mx-auto flex max-w-xl items-center px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-1">
          <BotonRedondo icono={ChevronLeft} etiqueta="Volver a mis visitas" onClick={volver} />
        </div>
        <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-10">
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
        </main>
      </div>
    );
  }

  // Un borrador que se puede editar ocupa toda la pantalla con su recorrido (DESIGN.md, campo).
  if (levantamiento && inicial && formato && borrador && bloqueado === false && envio !== undefined) {
    return (
      <CabeceraDeLaVisita.Provider value={cabecera}>
        <div className="min-h-dvh bg-fondo">
          <Borrador
            id={id}
          formato={formato}
          inicial={inicial}
          actual={levantamiento}
          nombre={formatos ? nombreDeFormato(formatos, levantamiento.formato) : "Levantamiento"}
          contexto={visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : levantamiento.lugar ? `${levantamiento.lugar.cliente} · ${levantamiento.lugar.sitio}` : "Levantamiento suelto"}
            volver={volver}
            atras={atrasDelBorrador}
            retener={() => setRetenido(true)}
            soltar={soltar}
            alDescartar={alDescartar ?? volver}
          />
        </div>
      </CabeceraDeLaVisita.Provider>
    );
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-division bg-panel">
        <div className="mx-auto flex max-w-xl items-start gap-1 py-3 pr-4 pl-1">
          <BotonIcono icono={ChevronLeft} etiqueta="Volver a mis visitas" tamano="pequeno" onClick={volver} />
          <div className="flex min-w-0 grow flex-col gap-1 pt-0.5">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{levantamiento && formatos ? nombreDeFormato(formatos, levantamiento.formato) : "Levantamiento"}</h1>
            {visita && (
              <p className="text-ayuda text-texto-secundario">
                {visita.cliente.nombre} · {visita.sitio.nombre}
              </p>
            )}
            {levantamiento && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Insignia tono={borrador ? "borrador" : "enviado"}>{borrador ? "Borrador" : "Enviado"}</Insignia>
                {/* Cada dato se guarda al escribirlo: la hora confirma que nada se pierde si la app se cierra. */}
                {borrador && (
                  <p className="text-ayuda text-texto-secundario" aria-live="polite">
                    Guardado en este teléfono a las {horaExacta(levantamiento.actualizadoEn)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-5">
        {levantamiento === undefined || envio === undefined || formatos === undefined || bloqueado === undefined || (levantamiento && !inicial) ? (
          <EsqueletoBloques etiqueta="Cargando levantamiento" altos={["alto", "medio"]} />
        ) : levantamiento === null || !inicial ? (
          <>
            <Aviso tono="error">Este levantamiento no está en este teléfono.</Aviso>
            <Boton onClick={volver}>Volver a mis visitas</Boton>
          </>
        ) : !formato ? (
          <Aviso tono="error">Falta en este teléfono el formato de este levantamiento. Conéctate para descargarlo; el levantamiento se conserva.</Aviso>
        ) : levantamiento.estado === "enviado" ? (
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
        ) : bloqueado ? (
          <>
            {permiso === "vencido_sin_sesion" && pedirSesion ? (
              <Aviso tono="alerta">
                <p>Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: inicia sesión para seguir.</p>
                <Boton className="mt-3 w-full" onClick={pedirSesion}>
                  Iniciar sesión
                </Boton>
              </Aviso>
            ) : (
              <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>
            )}
            <Enviado levantamiento={levantamiento} formato={formato} envio={null} servidor={null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
          </>
        ) : (
          <EsqueletoBloques etiqueta="Cargando levantamiento" altos={["alto", "medio"]} />
        )}
      </main>
    </div>
  );
}
