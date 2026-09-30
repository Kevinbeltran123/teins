import { lazy, Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { Aviso, Boton, BotonSiguiente, CalendarDays, Confirmacion, Dialogo, EsqueletoBloques, EstadoVacio, FranjaSincronizacion, GrupoDeOpciones, Insignia, LogOut, MapPin, OPCIONES_DE_TEMA, Smartphone, useSinRepetir, useTema } from "@teins/ui";
import { resumenDeRecorrido } from "../recorrido";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { estadosDe, visitasDe } from "../datos/lecturas";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal, UsuarioLocal, VisitaLocal } from "../datos/modelo";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { plataforma } from "../dispositivo/instalacion";
import { useConexionDelNavegador, useServidorAlcanzable } from "../dispositivo/useConexion";
import { fechaHora } from "../formato";
import { formatoDe, nombreDeFormato, useFormatos, vigentes } from "../formatos";
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
  const [cuentaAbierta, setCuentaAbierta] = useState(false);

  const deEnvios = [...(envios?.values() ?? [])];
  const porEnviar = deEnvios.filter((e) => e.estado !== "recibido").length;
  const esperanSesion = deEnvios.some((e) => e.estado === "requiere_sesion") || Boolean(bajada?.sesionVencida);
  const esperanActualizacion = deEnvios.some((e) => e.estado === "requiere_actualizar");
  const permisoVencido = bajada ? Date.parse(bajada.permisoLocalHasta) < Date.now() : false;
  const sinConexion = !enLinea || (!alcanzable && porEnviar > 0);

  // Un doble toque crea uno solo.
  const [iniciar] = useSinRepetir(async (visitaId: string, formato: VersionFormato) => {
    const levantamiento = crearLevantamiento(formato, uuidv7(), new Date(), visitaId, nuevoIdDeRepeticion);
    await repositorio.crear(levantamiento, usuario.id);
    abrir(levantamiento.id);
  });

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

  const enviados = (lista ?? []).filter((l) => l.estado === "enviado");
  const borradoresSueltos = sueltos.filter((l) => l.estado === "borrador");
  const primerNombre = usuario.nombre.split(" ")[0] ?? usuario.nombre;

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-4 pb-2">
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <p className="text-ayuda font-extrabold text-texto-secundario first-letter:uppercase">{hoyLargo.format(new Date())}</p>
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{`Hola, ${primerNombre}`}</h1>
          </div>
          <button
            type="button"
            onClick={() => setCuentaAbierta(true)}
            aria-label="Tu cuenta"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-panel-hundido text-ayuda font-extrabold active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {iniciales(usuario.nombre)}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-1 pb-10">
        <FranjaSincronizacion enLinea={!sinConexion} porSubir={porEnviar} />
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
          {/* Una línea, no un bloque: la visita de hoy sigue siendo lo primero (crítica del rediseño, problema 14). */}
          {!estaInstalada() && (
            <div className="flex items-center gap-3 rounded-panel border border-dashed border-borde-suave py-1.5 pr-1.5 pl-4 text-ayuda text-texto-secundario">
              <Smartphone aria-hidden className="size-5 shrink-0" />
              <p className="grow">
                Instala TEINS para no perder datos.
                {/* En iPhone la app instalada no comparte datos con Safari (ADR-0023). */}
                {plataforma() === "iphone" && " Antes, envía lo que tengas en Safari."}
              </p>
              <Boton variante="fantasma" tamano="pequeno" onClick={() => setGuiaAbierta(true)}>
                Cómo instalarla
              </Boton>
            </div>
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
              <section aria-labelledby="titulo-otras" className="flex flex-col gap-2.5">
                <h2 id="titulo-otras" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Después
                </h2>
                {otras.map((v) => (
                  <FilaVisita key={v.id} visita={v} levantamientos={porVisita.get(v.id) ?? []} contexto={contexto} />
                ))}
              </section>
            )}

            {borradoresSueltos.length > 0 && (
              <section aria-labelledby="titulo-sueltos" className="flex flex-col gap-2.5">
                <h2 id="titulo-sueltos" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Sin terminar
                </h2>
                <Filas levantamientos={borradoresSueltos} contexto={contexto} />
              </section>
            )}

            {enviados.length > 0 && (
              <section aria-labelledby="titulo-enviados" className="flex flex-col gap-2.5">
                <h2 id="titulo-enviados" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Enviados
                </h2>
                <Filas levantamientos={enviados} contexto={contexto} />
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
      </main>

      {cuentaAbierta && (
        <Dialogo forma="inferior" titulo="Tu cuenta" alCerrar={() => setCuentaAbierta(false)} focoEnElDialogo>
          <div className="flex flex-col gap-3">
            {/* Quién está en este teléfono, como la cabecera de una ficha de ajustes. */}
            <div className="flex items-center gap-3.5 rounded-panel bg-panel-hundido px-4 py-3.5">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-superficie text-cuerpo font-extrabold text-sobre-superficie">
                {iniciales(usuario.nombre)}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-cuerpo">{usuario.nombre}</strong>
                <span className="text-ayuda text-texto-secundario">{sinConexion ? "Sin señal · lo capturado queda aquí" : "Conectado · todo al día"}</span>
              </span>
            </div>
            <SelectorDeTema />
            <Diagnostico tecnicoId={usuario.id} />
            <button
              type="button"
              onClick={() => {
                setCuentaAbierta(false);
                if (porEnviar > 0) setConfirmandoSalida(true);
                else void cerrarSesion();
              }}
              className="flex min-h-tactil items-center gap-3 rounded-panel bg-panel-hundido px-4 text-left text-cuerpo font-bold text-error focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco [&_svg]:size-5"
            >
              <LogOut aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </Dialogo>
      )}

      {guiaAbierta && (
        <Dialogo forma="inferior" titulo="Instala la app" alCerrar={() => setGuiaAbierta(false)}>
          <Suspense fallback={null}>
            <GuiaDeInstalacion />
          </Suspense>
        </Dialogo>
      )}

      {confirmandoSalida && (
        <Confirmacion
          nivel="consecuencia"
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

const hoyLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/**
 * Punto focal (DESIGN.md; prototipos/base-visual, campo): la visita de ahora en una tarjeta de borde fino, con
 * cuándo es en azul, el avance del levantamiento por pasos y la única acción principal.
 */
function VisitaFocal({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  const borrador = levantamientos.find((l) => l.estado === "borrador");
  const formato = borrador ? formatoDe(contexto.formatos, borrador) : undefined;
  const resumen = borrador && formato ? resumenDeRecorrido(formato, borrador) : undefined;
  return (
    <section aria-label="Siguiente visita" className="flex flex-col gap-3 rounded-2xl border border-division bg-panel p-4">
      <div className="flex justify-between gap-3 text-[12px] font-medium text-texto-secundario">
        <span aria-hidden>Siguiente visita</span>
        <span className="text-superficie first-letter:uppercase">{fechaDeVisita(visita.programadaPara, hoyLocal())}</span>
      </div>
      <h2 className="text-subtitulo leading-tight font-semibold tracking-[-0.01em]">{visita.cliente.nombre}</h2>
      <p className="-mt-1 flex flex-col gap-0.5 text-[13px] text-texto-secundario">
        <span className="flex items-start gap-1.5">
          <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {visita.sitio.nombre} · {visita.sitio.direccion}
        </span>
        <span>{visita.motivo}</span>
      </p>
      {resumen && (
        <div className="flex flex-col gap-2">
          <div aria-hidden className="flex gap-1">
            {resumen.pasos.map((p, i) => (
              <i key={p.id} className={`h-[3px] flex-1 rounded-full ${resumen.hechos[i] ? "bg-sync-ok" : p === resumen.siguiente ? "bg-superficie" : "bg-superficie-pista"}`} />
            ))}
          </div>
          <span className="text-ayuda text-texto-secundario">
            {`${resumen.hechos.filter(Boolean).length} de ${resumen.pasos.length} pasos`}
            {resumen.siguiente ? ` · sigue ${resumen.siguiente.titulo.toLowerCase()}` : " · listo para revisar y enviar"}
          </span>
        </div>
      )}
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="principal" />
    </section>
  );
}

/** Otra visita (DoorDash): el día a la izquierda, el cliente y el sitio; tocarla ofrece empezar o seguir. */
function FilaVisita({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <article className="flex flex-col gap-3 border-t border-division py-3">
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="flex min-h-11 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
        <span className="w-16 shrink-0 text-[12px] leading-tight text-texto-secundario first-letter:uppercase">{fechaDeVisita(visita.programadaPara, hoyLocal())}</span>
        <span className="flex min-w-0 flex-col">
          <strong className="text-[14px] leading-snug font-medium">{`${visita.cliente.nombre} · ${visita.sitio.nombre}`}</strong>
          <span className="text-[13px] text-texto-secundario">{visita.motivo}</span>
        </span>
      </button>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      {abierta && !visita.fueraDeAlcance && <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="secundaria" />}
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
    return variante === "principal" ? (
      <BotonSiguiente onClick={() => contexto.abrir(borrador.id)}>Continuar levantamiento</BotonSiguiente>
    ) : (
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
    return variante === "principal" ? (
      <BotonSiguiente onClick={() => contexto.iniciar(visita.id, disponibles[0]!)}>Iniciar levantamiento</BotonSiguiente>
    ) : (
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
  const comentarios = servidor?.comentarios?.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => contexto.abrir(l.id)}
      className="flex min-h-tactil w-full items-center gap-3.5 rounded-panel bg-panel p-4 text-left transition-colors hover:bg-panel-hundido focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      <span className="w-16 shrink-0 text-ayuda font-extrabold text-texto-secundario">{diaCorto(l.creadoEn)}</span>
      <span className="flex min-w-0 grow flex-col">
        <strong className="text-cuerpo leading-snug">{nombreDeFormato(contexto.formatos, l.formato)}</strong>
        <span className="text-ayuda text-texto-secundario">{fotos(contarFotos(l))}</span>
        {comentarios > 0 && <span className="text-ayuda font-bold">{comentariosDeOficina(comentarios)}</span>}
      </span>
      {/* El estado se dice una vez, en su pastilla (crítica, problema 16). */}
      {l.estado === "borrador" ? (
        <Insignia tono="borrador">Borrador</Insignia>
      ) : (
        estado && <span className={`shrink-0 rounded-full bg-panel-hundido px-3 py-1 text-right text-ayuda font-extrabold ${claseDeTono[estado.tono]}`}>{estado.texto}</span>
      )}
    </button>
  );
}

const diaCorto = (iso: string) => {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (fecha.toDateString() === hoy.toDateString()) return fechaHora(iso).split(" ").slice(-2).join(" ");
  if (fecha.toDateString() === ayer.toDateString()) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(fecha);
};

/** Claro, oscuro o el del sistema, recordado en este teléfono (DESIGN.md, "Tema"). */
function SelectorDeTema() {
  const [tema, setTema] = useTema();
  return (
    <div className="rounded-panel bg-panel-hundido px-4 py-3">
      <GrupoDeOpciones etiqueta="Tema" opciones={OPCIONES_DE_TEMA} valor={tema} onCambio={setTema} />
    </div>
  );
}
