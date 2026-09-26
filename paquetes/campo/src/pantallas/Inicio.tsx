import { lazy, Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { Aviso, Boton, BotonIcono, CalendarDays, CloudOff, Confirmacion, Dialogo, EsqueletoBloques, EstadoVacio, Insignia, LogOut } from "@teins/ui";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { estadosDe, visitasDe } from "../datos/lecturas";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal, UsuarioLocal, VisitaLocal } from "../datos/modelo";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { plataforma } from "../dispositivo/instalacion";
import { useConexionDelNavegador, useServidorAlcanzable } from "../dispositivo/useConexion";
import { fechaHora } from "../formato";
import { nombreDeFormato, useFormatos, vigentes } from "../formatos";
import { claseDeTono, comentariosDeOficina, estadoDeEnvio, estadoSegunServidor } from "../mensajes";
import { fechaDeVisita, hoyLocal, ordenarVisitas } from "../visitas";
import { Diagnostico } from "./Diagnostico";

// Secundarias: no entran en el JavaScript inicial (ADR-0011).
const SugerirLlave = lazy(() => import("./SugerirLlave"));
const TarjetaAvisos = lazy(() => import("./TarjetaAvisos"));
const GuiaDeInstalacion = lazy(() => import("./InstalarApp").then((m) => ({ default: m.GuiaDeInstalacion })));

interface Props {
  usuario: UsuarioLocal;
  abrir: (id: string) => void;
  pedirSesion: () => void;
  actualizacion: { disponible: boolean; aplicar: () => void };
}

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);
const levantamientos = (n: number) => (n === 1 ? "1 levantamiento" : `${n} levantamientos`);

function contarFotos(l: LevantamientoLocal): number {
  return Object.values(l.respuestas)
    .flatMap((seccion) => Object.values(seccion))
    .reduce<number>((total, valor) => total + (Array.isArray(valor) ? valor.length : 0), 0);
}

const cerrarSesion = () => import("../sesion/sesion").then((m) => m.cerrarSesion());

/** Lo que la pantalla necesita para mostrar y crear levantamientos. */
interface Contexto {
  formatos: VersionFormato[];
  envios: Map<string, EstadoDeEnvio>;
  servidor: Map<string, EstadoServidor>;
  enLinea: boolean;
  /** Vencido el permiso de trabajo local, no se crea ni se edita nada (ADR-0009, parte 2). */
  bloqueado: boolean;
  abrir: (id: string) => void;
  iniciar: (visitaId: string, formato: VersionFormato) => void;
}

export function Inicio({ usuario, abrir, pedirSesion, actualizacion }: Props) {
  const lista = useLiveQuery(() => repositorio.listar(usuario.id), [usuario.id]);
  const envios = useLiveQuery(async () => new Map((await db.envios.where("tecnicoId").equals(usuario.id).toArray()).map((e) => [e.levantamientoId, e])), [usuario.id]);
  const servidor = useLiveQuery(async () => new Map((await estadosDe(db, usuario.id)).map((e) => [e.id, e])), [usuario.id]);
  const visitas = useLiveQuery(() => visitasDe(db, usuario.id), [usuario.id]);
  const bajada = useLiveQuery(async () => (await db.bajadas.get(usuario.id)) ?? null, [usuario.id]);
  const formatos = useFormatos();
  const deOtros = useLiveQuery(() => repositorio.contarDeOtros(usuario.id), [usuario.id]);
  const enLinea = useConexionDelNavegador();
  const alcanzable = useServidorAlcanzable();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [guiaAbierta, setGuiaAbierta] = useState(false);

  const deEnvios = [...(envios?.values() ?? [])];
  const porEnviar = deEnvios.filter((e) => e.estado !== "recibido").length;
  const esperanSesion = deEnvios.some((e) => e.estado === "requiere_sesion") || Boolean(bajada?.sesionVencida);
  const esperanActualizacion = deEnvios.some((e) => e.estado === "requiere_actualizar");
  const permisoVencido = bajada ? Date.parse(bajada.permisoLocalHasta) < Date.now() : false;
  const sinConexion = !enLinea || (!alcanzable && porEnviar > 0);

  async function iniciar(visitaId: string, formato: VersionFormato) {
    const levantamiento = crearLevantamiento(formato, uuidv7(), new Date(), visitaId, nuevoIdDeRepeticion);
    await repositorio.crear(levantamiento, usuario.id);
    abrir(levantamiento.id);
  }

  const cargando = lista === undefined || envios === undefined || servidor === undefined || visitas === undefined || bajada === undefined || formatos === undefined;
  const contexto: Contexto | undefined = cargando ? undefined : { formatos, envios, servidor, enLinea: alcanzable, bloqueado: permisoVencido, abrir, iniciar };

  // Visitas con sus levantamientos; una reasignada solo se muestra si el técnico ya empezó algo en ella (regla 17).
  const porVisita = Map.groupBy(lista ?? [], (l) => l.visitaId ?? "");
  const visitasCon = (estado: LevantamientoLocal["estado"]) => new Set((lista ?? []).filter((l) => l.estado === estado && l.visitaId).map((l) => l.visitaId!));
  const mostradas = ordenarVisitas(
    (visitas ?? []).filter((v) => !v.fueraDeAlcance || porVisita.has(v.id)),
    hoyLocal(),
    visitasCon("borrador"),
    visitasCon("enviado"),
  );
  const [siguiente, ...otras] = mostradas;
  const idsMostradas = new Set(mostradas.map((v) => v.id));
  const sueltos = (lista ?? []).filter((l) => !l.visitaId || !idsMostradas.has(l.visitaId));

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-division bg-panel">
        <div className="mx-auto flex max-w-xl items-center gap-2 py-3 pr-2 pl-4">
          <div className="flex min-w-0 grow flex-col">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">Mis visitas</h1>
            <p className="text-ayuda text-texto-secundario">{usuario.nombre}</p>
          </div>
          {/* Solo cuando dice algo: sin señal, o cuánto espera para salir del teléfono. */}
          {sinConexion ? (
            <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control bg-alerta-fondo px-2.5 text-ayuda font-bold text-alerta-texto [&_svg]:size-4">
              <CloudOff aria-hidden />
              Sin conexión
            </span>
          ) : (
            porEnviar > 0 && <span className="inline-flex min-h-8 shrink-0 items-center rounded-control bg-superficie-suave px-2.5 text-ayuda font-bold text-superficie">{`${porEnviar} por enviar`}</span>
          )}
          <BotonIcono icono={LogOut} etiqueta="Cerrar sesión" tamano="pequeno" onClick={() => (porEnviar > 0 ? setConfirmandoSalida(true) : void cerrarSesion())} />
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-5">
        <div className="flex flex-col gap-3 empty:hidden">
          {permisoVencido && <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>}
          {esperanSesion && (
            <Aviso tono="alerta">
              <p>Tu sesión venció. Inicia sesión para enviar lo pendiente y recibir tus visitas.</p>
              <Boton className="mt-3 w-full" onClick={pedirSesion}>
                Iniciar sesión
              </Boton>
            </Aviso>
          )}
          {esperanActualizacion && <Aviso tono="alerta">Esta versión de la app ya no puede enviar. Actualízala para enviar lo pendiente; nada se pierde.</Aviso>}
          {!estaInstalada() && (
            <Aviso tono="alerta">
              <p>
                Instala la app para que el teléfono no borre los datos y te lleguen los avisos.
                {/* En iPhone la app instalada no comparte datos con Safari (ADR-0023). */}
                {plataforma() === "iphone" && " Antes, envía lo que tengas: lo de Safari no pasa a la app instalada."}
              </p>
              <Boton className="mt-3 w-full" onClick={() => setGuiaAbierta(true)}>
                Cómo instalarla
              </Boton>
            </Aviso>
          )}
          {actualizacion.disponible && (
            <Aviso>
              <p>Hay una versión nueva de la app. Tus levantamientos se conservan.</p>
              <Boton className="mt-3 w-full" onClick={actualizacion.aplicar}>
                Actualizar la app
              </Boton>
            </Aviso>
          )}
        </div>

        {!contexto ? (
          <EsqueletoBloques etiqueta="Cargando visitas" altos={["alto", "bajo"]} />
        ) : (
          <>
            {siguiente && <VisitaFocal visita={siguiente} levantamientos={porVisita.get(siguiente.id) ?? []} contexto={contexto} />}

            {siguiente && (porVisita.get(siguiente.id)?.length ?? 0) > 0 && (
              <section aria-labelledby="titulo-esta-visita" className="flex flex-col gap-3">
                <h2 id="titulo-esta-visita" className="text-subtitulo font-extrabold">
                  En {siguiente.cliente.nombre}
                </h2>
                <Filas levantamientos={porVisita.get(siguiente.id)!} contexto={contexto} />
              </section>
            )}

            {mostradas.length === 0 && (
              <EstadoVacio icono={CalendarDays} titulo="Sin visitas asignadas">
                {!bajada?.ultimaEn && !alcanzable ? (
                  "Conéctate para descargar tus visitas y los formatos."
                ) : !bajada?.ultimaEn ? (
                  <span aria-busy="true">Descargando tus visitas…</span>
                ) : (
                  "Cuando oficina te asigne una visita, aparece aquí al tener señal."
                )}
              </EstadoVacio>
            )}

            {/* Bajo la siguiente visita: la acción principal de la pantalla sigue siendo la de la visita. */}
            <Suspense fallback={null}>
              <TarjetaAvisos usuarioId={usuario.id} enLinea={alcanzable} />
            </Suspense>

            {otras.length > 0 && (
              <section aria-labelledby="titulo-otras" className="flex flex-col gap-3">
                <h2 id="titulo-otras" className="text-subtitulo font-extrabold">
                  Otras visitas
                </h2>
                {otras.map((v) => (
                  <PanelVisita key={v.id} visita={v} levantamientos={porVisita.get(v.id) ?? []} contexto={contexto} />
                ))}
              </section>
            )}

            {sueltos.length > 0 && (
              <section aria-labelledby="titulo-sueltos" className="flex flex-col gap-3">
                <h2 id="titulo-sueltos" className="text-subtitulo font-extrabold">
                  Otros levantamientos en este teléfono
                </h2>
                <Filas levantamientos={sueltos} contexto={contexto} />
              </section>
            )}
          </>
        )}

        {deOtros !== undefined && deOtros > 0 && (
          <p className="text-ayuda text-texto-secundario">
            Hay {levantamientos(deOtros)} de otra persona en este teléfono. Se conservan y se envían cuando esa persona inicie sesión.
          </p>
        )}

        <Suspense fallback={null}>
          <SugerirLlave usuarioId={usuario.id} enLinea={alcanzable} />
        </Suspense>

        <Diagnostico />
      </main>

      {guiaAbierta && (
        <Dialogo forma="inferior" titulo="Instala la app" alCerrar={() => setGuiaAbierta(false)}>
          <Suspense fallback={null}>
            <GuiaDeInstalacion />
          </Suspense>
        </Dialogo>
      )}

      {confirmandoSalida && (
        <Confirmacion
          forma="inferior"
          titulo={`¿Cerrar sesión con ${levantamientos(porEnviar)} por enviar?`}
          confirmar="Cerrar sesión"
          accion={cerrarSesion}
          mensajeDeError={() => "No se pudo cerrar la sesión. Intenta de nuevo."}
          alCerrar={() => setConfirmandoSalida(false)}
        >
          <p>Lo que falta por enviar se queda en este teléfono y se envía cuando vuelvas a iniciar sesión.</p>
        </Confirmacion>
      )}
    </div>
  );
}

/** Punto focal (DESIGN.md): la siguiente visita, en la primera tarjeta, con la fecha grande y la única acción principal. */
function VisitaFocal({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  return (
    <section aria-label="Siguiente visita" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
      <p className="text-cifra-focal leading-none font-extrabold tracking-tight text-superficie">{fechaDeVisita(visita.programadaPara, hoyLocal())}</p>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-subtitulo leading-snug font-extrabold">{visita.cliente.nombre}</h2>
        <p className="text-ayuda text-texto-secundario">
          {visita.sitio.nombre} · {visita.sitio.direccion}
        </p>
      </div>
      <div>
        <Insignia tono="neutro">{visita.motivo}</Insignia>
      </div>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="principal" />
    </section>
  );
}

function PanelVisita({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  return (
    <article className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-cuerpo font-bold">{visita.cliente.nombre}</h3>
          <p className="text-ayuda text-texto-secundario">
            {visita.sitio.nombre} · {visita.sitio.direccion}
          </p>
        </div>
        <p className="shrink-0 text-ayuda font-bold">{fechaDeVisita(visita.programadaPara, hoyLocal())}</p>
      </div>
      <div>
        <Insignia tono="neutro">{visita.motivo}</Insignia>
      </div>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      {levantamientos.length > 0 && <Filas levantamientos={levantamientos} contexto={contexto} />}
      {!visita.fueraDeAlcance && <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="secundaria" />}
    </article>
  );
}

/** Por qué la visita ya no es del técnico; solo se muestra si tiene algo empezado (regla 17). */
function AvisoDeSalida({ visita }: { visita: VisitaLocal }) {
  return (
    <p className="text-ayuda text-texto-secundario">
      {visita.motivoSalida === "cancelada" ? "Oficina canceló esta visita." : "Esta visita se asignó a otra persona."} Puedes terminar y enviar lo que ya empezaste.
    </p>
  );
}

/** Continuar el borrador de la visita, o iniciar uno con la versión vigente de cada formato. */
function Acciones({
  visita,
  levantamientos,
  contexto,
  variante,
}: {
  visita: VisitaLocal;
  levantamientos: LevantamientoLocal[];
  contexto: Contexto;
  variante: "principal" | "secundaria";
}) {
  const borrador = levantamientos.find((l) => l.estado === "borrador");
  const disponibles = vigentes(contexto.formatos);

  if (borrador) {
    return (
      <Boton variante={variante} className="w-full" onClick={() => contexto.abrir(borrador.id)}>
        Continuar levantamiento
      </Boton>
    );
  }
  // Una visita que ya no es del técnico no admite levantamientos nuevos.
  if (visita.fueraDeAlcance) return null;
  if (contexto.bloqueado) {
    return (
      <Boton variante={variante} className="w-full" disabled>
        Captura bloqueada: conéctate
      </Boton>
    );
  }
  if (disponibles.length === 0) {
    return <p className="text-ayuda text-texto-secundario">Faltan los formatos en este teléfono. Conéctate un momento para descargarlos.</p>;
  }
  if (disponibles.length === 1) {
    return (
      <Boton variante={variante} className="w-full" onClick={() => contexto.iniciar(visita.id, disponibles[0]!)}>
        Iniciar levantamiento
      </Boton>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ayuda font-bold">Iniciar levantamiento</p>
      {disponibles.map((f, i) => (
        <Boton key={f.formato} variante={i === 0 ? variante : "secundaria"} className="w-full" onClick={() => contexto.iniciar(visita.id, f)}>
          {nombreDeFormato(contexto.formatos, f.formato)}
        </Boton>
      ))}
    </div>
  );
}

function Filas({ levantamientos, contexto }: { levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  return (
    <ul className="flex flex-col gap-2">
      {levantamientos.map((l) => (
        <li key={l.id}>
          <Fila levantamiento={l} contexto={contexto} />
        </li>
      ))}
    </ul>
  );
}

function Fila({ levantamiento: l, contexto }: { levantamiento: LevantamientoLocal; contexto: Contexto }) {
  const envio = contexto.envios.get(l.id);
  const servidor = contexto.servidor.get(l.id);
  // El estado de negocio según el servidor manda sobre el de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, contexto.enLinea) : null;
  return (
    <button
      type="button"
      onClick={() => contexto.abrir(l.id)}
      className="flex min-h-tactil w-full items-center justify-between gap-3 rounded-panel border border-division bg-panel px-4 py-3 text-left transition-colors hover:bg-panel-hundido focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-cuerpo font-bold">{nombreDeFormato(contexto.formatos, l.formato)}</span>
        <span className="text-ayuda text-texto-secundario">
          {fechaHora(l.creadoEn)} · {fotos(contarFotos(l))}
        </span>
        {estado && <span className={`text-ayuda font-bold ${claseDeTono[estado.tono]}`}>{estado.texto}</span>}
        {(servidor?.comentarios?.length ?? 0) > 0 && <span className="text-ayuda font-bold">{comentariosDeOficina(servidor!.comentarios!.length)}</span>}
      </span>
      <Insignia tono={l.estado === "borrador" ? "borrador" : "enviado"}>{l.estado === "borrador" ? "Borrador" : "Enviado"}</Insignia>
    </button>
  );
}
