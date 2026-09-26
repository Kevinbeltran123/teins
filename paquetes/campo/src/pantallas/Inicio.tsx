import { lazy, Suspense } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { Aviso, Boton, Marquilla } from "@teins/ui";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { estadosDe, visitasDe } from "../datos/lecturas";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal, UsuarioLocal, VisitaLocal } from "../datos/modelo";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { useConexionDelNavegador, useServidorAlcanzable } from "../dispositivo/useConexion";
import { fechaHora } from "../formato";
import { nombreDeFormato, useFormatos, vigentes } from "../formatos";
import { claseDeTono, comentariosDeOficina, estadoDeEnvio, estadoSegunServidor } from "../mensajes";
import { fechaDeVisita, hoyLocal, ordenarVisitas } from "../visitas";
import { Diagnostico } from "./Diagnostico";

// Secundaria: no entra en el JavaScript inicial (ADR-0011).
const SugerirLlave = lazy(() => import("./SugerirLlave"));

interface Props {
  usuario: UsuarioLocal;
  abrir: (id: string) => void;
  pedirSesion: () => void;
  actualizacion: { disponible: boolean; aplicar: () => void };
}

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

function contarFotos(l: LevantamientoLocal): number {
  return Object.values(l.respuestas)
    .flatMap((seccion) => Object.values(seccion))
    .reduce<number>((total, valor) => total + (Array.isArray(valor) ? valor.length : 0), 0);
}

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
  const levantamientos = useLiveQuery(() => repositorio.listar(usuario.id), [usuario.id]);
  const envios = useLiveQuery(async () => new Map((await db.envios.where("tecnicoId").equals(usuario.id).toArray()).map((e) => [e.levantamientoId, e])), [usuario.id]);
  const servidor = useLiveQuery(async () => new Map((await estadosDe(db, usuario.id)).map((e) => [e.id, e])), [usuario.id]);
  const visitas = useLiveQuery(() => visitasDe(db, usuario.id), [usuario.id]);
  const bajada = useLiveQuery(async () => (await db.bajadas.get(usuario.id)) ?? null, [usuario.id]);
  const formatos = useFormatos();
  const deOtros = useLiveQuery(() => repositorio.contarDeOtros(usuario.id), [usuario.id]);
  const enLinea = useConexionDelNavegador();
  const alcanzable = useServidorAlcanzable();

  const lista = [...(envios?.values() ?? [])];
  const porEnviar = lista.filter((e) => e.estado !== "recibido").length;
  const esperanSesion = lista.some((e) => e.estado === "requiere_sesion") || Boolean(bajada?.sesionVencida);
  const esperanActualizacion = lista.some((e) => e.estado === "requiere_actualizar");
  const permisoVencido = bajada ? Date.parse(bajada.permisoLocalHasta) < Date.now() : false;

  async function iniciar(visitaId: string, formato: VersionFormato) {
    const levantamiento = crearLevantamiento(formato, uuidv7(), new Date(), visitaId, nuevoIdDeRepeticion);
    await repositorio.crear(levantamiento, usuario.id);
    abrir(levantamiento.id);
  }

  const cargando = levantamientos === undefined || envios === undefined || servidor === undefined || visitas === undefined || bajada === undefined || formatos === undefined;
  const contexto: Contexto | undefined = cargando ? undefined : { formatos, envios, servidor, enLinea: alcanzable, bloqueado: permisoVencido, abrir, iniciar };

  // Visitas con sus levantamientos; una reasignada solo se muestra si el técnico ya empezó algo en ella (regla 17).
  const porVisita = Map.groupBy(levantamientos ?? [], (l) => l.visitaId ?? "");
  const visitasCon = (estado: LevantamientoLocal["estado"]) =>
    new Set((levantamientos ?? []).filter((l) => l.estado === estado && l.visitaId).map((l) => l.visitaId!));
  const mostradas = ordenarVisitas(
    (visitas ?? []).filter((v) => !v.fueraDeAlcance || porVisita.has(v.id)),
    hoyLocal(),
    visitasCon("borrador"),
    visitasCon("enviado"),
  );
  const [siguiente, ...otras] = mostradas;
  const idsMostradas = new Set(mostradas.map((v) => v.id));
  const sueltos = (levantamientos ?? []).filter((l) => !l.visitaId || !idsMostradas.has(l.visitaId));

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-4 pt-5 pb-4 text-sobre-superficie">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-ayuda text-sobre-superficie-suave">Datos de prueba, no reales</p>
          <button
            type="button"
            onClick={() => void import("../sesion/sesion").then((m) => m.cerrarSesion())}
            className="min-h-tactil rounded-control px-2 text-ayuda font-bold text-sobre-superficie-suave underline focus-visible:outline-3 focus-visible:outline-acento"
          >
            Cerrar sesión
          </button>
        </div>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Mis visitas</h1>
        <p className="text-ayuda text-sobre-superficie-suave">
          {usuario.nombre}
          {porEnviar > 0 && <span className="font-bold text-sobre-superficie"> · {porEnviar} por enviar</span>}
        </p>
        {contexto && siguiente && <VisitaFocal visita={siguiente} levantamientos={porVisita.get(siguiente.id) ?? []} contexto={contexto} />}
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3 empty:hidden">
          {(!enLinea || (!alcanzable && porEnviar > 0)) && (
            <Aviso>Sin conexión. Todo lo que captures se guarda en este teléfono y se envía al recuperar señal.</Aviso>
          )}
          {permisoVencido && (
            <Aviso tono="alerta">
              Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.
            </Aviso>
          )}
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
              Instala la app para que el teléfono no borre los datos: en Safari, toca Compartir y luego “Agregar a inicio”. Después ábrela desde ese ícono.
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
          <div aria-busy="true" aria-label="Cargando visitas" className="flex flex-col gap-2">
            <div className="h-[132px] animate-pulse rounded-panel bg-panel" />
            <div className="h-[76px] animate-pulse rounded-panel bg-panel" />
          </div>
        ) : (
          <>
            {siguiente && (porVisita.get(siguiente.id)?.length ?? 0) > 0 && (
              <section aria-labelledby="titulo-esta-visita" className="flex flex-col gap-3">
                <h2 id="titulo-esta-visita" className="text-subtitulo font-extrabold">
                  En {siguiente.cliente.nombre}
                </h2>
                <Filas levantamientos={porVisita.get(siguiente.id)!} contexto={contexto} />
              </section>
            )}

            {mostradas.length === 0 && (
              <section aria-labelledby="titulo-sin-visitas" className="flex flex-col gap-2">
                <h2 id="titulo-sin-visitas" className="text-subtitulo font-extrabold">
                  Sin visitas asignadas
                </h2>
                {!bajada?.ultimaEn && !alcanzable ? (
                  <p className="text-cuerpo text-texto-secundario">Conéctate para descargar tus visitas y los formatos.</p>
                ) : !bajada?.ultimaEn ? (
                  <p className="text-cuerpo text-texto-secundario" aria-busy="true">
                    Descargando tus visitas…
                  </p>
                ) : (
                  <p className="text-cuerpo text-texto-secundario">Cuando oficina te asigne una visita, aparece aquí al tener señal.</p>
                )}
              </section>
            )}

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
            Hay {deOtros === 1 ? "1 levantamiento" : `${deOtros} levantamientos`} de otra persona en este teléfono. Se conservan y se envían cuando esa persona inicie sesión.
          </p>
        )}

        <Suspense fallback={null}>
          <SugerirLlave usuarioId={usuario.id} enLinea={alcanzable} />
        </Suspense>

        <Diagnostico />
      </main>
    </div>
  );
}

/** Punto focal (DESIGN.md): la siguiente visita, en el bloque azul, con la única acción amarilla. */
function VisitaFocal({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  return (
    <section aria-label="Siguiente visita" className="mt-4 flex flex-col gap-1 border-t border-sobre-superficie-tenue pt-4">
      <p className="text-cifra-focal leading-none font-extrabold">{fechaDeVisita(visita.programadaPara, hoyLocal())}</p>
      <p className="mt-2 text-subtitulo font-bold">{visita.cliente.nombre}</p>
      <p className="text-ayuda text-sobre-superficie-suave">
        {visita.sitio.nombre} · {visita.sitio.direccion}
      </p>
      <div className="mt-2">
        <Marquilla tono="sobre-superficie">{visita.motivo}</Marquilla>
      </div>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} className="mt-2 text-sobre-superficie-suave" />}
      <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="principal" />
    </section>
  );
}

function PanelVisita({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  return (
    <article className="flex flex-col gap-3 rounded-panel bg-panel p-4">
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
        <Marquilla tono="superficie">{visita.motivo}</Marquilla>
      </div>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} className="text-texto-secundario" />}
      {levantamientos.length > 0 && <Filas levantamientos={levantamientos} contexto={contexto} />}
      {!visita.fueraDeAlcance && <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="secundaria" />}
    </article>
  );
}

/** Por qué la visita ya no es del técnico; solo se muestra si tiene algo empezado (regla 17). */
function AvisoDeSalida({ visita, className }: { visita: VisitaLocal; className: string }) {
  return (
    <p className={`text-ayuda ${className}`}>
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
  const clase = "mt-3 w-full";

  if (borrador) {
    return (
      <Boton variante={variante} className={clase} onClick={() => contexto.abrir(borrador.id)}>
        Continuar levantamiento
      </Boton>
    );
  }
  // Una visita que ya no es del técnico no admite levantamientos nuevos.
  if (visita.fueraDeAlcance) return null;
  if (contexto.bloqueado) {
    return (
      <Boton variante={variante} className={clase} disabled>
        Captura bloqueada: conéctate
      </Boton>
    );
  }
  if (disponibles.length === 0) {
    return <p className="mt-3 text-ayuda">Faltan los formatos en este teléfono. Conéctate un momento para descargarlos.</p>;
  }
  if (disponibles.length === 1) {
    return (
      <Boton variante={variante} className={clase} onClick={() => contexto.iniciar(visita.id, disponibles[0]!)}>
        Iniciar levantamiento
      </Boton>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-ayuda font-bold">Iniciar levantamiento</p>
      {disponibles.map((f, i) => (
        <Boton key={f.formato} variante={i === 0 ? variante : "secundaria"} onClick={() => contexto.iniciar(visita.id, f)}>
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
      className="flex w-full items-center justify-between gap-3 rounded-panel border-[1.5px] border-division bg-panel px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-cuerpo font-bold">{nombreDeFormato(contexto.formatos, l.formato)}</span>
        <span className="text-ayuda text-texto-secundario">
          {fechaHora(l.creadoEn)} · {fotos(contarFotos(l))}
        </span>
        {estado && <span className={`text-ayuda font-bold ${claseDeTono[estado.tono]}`}>{estado.texto}</span>}
        {(servidor?.comentarios?.length ?? 0) > 0 && <span className="text-ayuda font-bold">{comentariosDeOficina(servidor!.comentarios!.length)}</span>}
      </span>
      <Marquilla tono={l.estado === "borrador" ? "borrador" : "enviado"}>{l.estado === "borrador" ? "Borrador" : "Enviado"}</Marquilla>
    </button>
  );
}
