import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento } from "@teins/dominio";
import { Aviso, Boton, Marquilla } from "@teins/ui";
import { db, repositorio } from "../datos/instancia";
import type { EnvioLocal, LevantamientoLocal, UsuarioLocal } from "../datos/modelo";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { useConexionDelNavegador, useServidorAlcanzable } from "../dispositivo/useConexion";
import { fechaHora } from "../formato";
import { formatoVigente, NOMBRE_FORMATO } from "../formatos";
import { claseDeTono, estadoDeEnvio } from "../mensajes";
import { Diagnostico } from "./Diagnostico";

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

export function Inicio({ usuario, abrir, pedirSesion, actualizacion }: Props) {
  const levantamientos = useLiveQuery(() => repositorio.listar(usuario.id), [usuario.id]);
  const envios = useLiveQuery(async () => new Map((await db.envios.where("tecnicoId").equals(usuario.id).toArray()).map((e) => [e.levantamientoId, e])), [usuario.id]);
  const deOtros = useLiveQuery(() => repositorio.contarDeOtros(usuario.id), [usuario.id]);
  const enLinea = useConexionDelNavegador();
  const alcanzable = useServidorAlcanzable();

  const lista = [...(envios?.values() ?? [])];
  const porEnviar = lista.filter((e) => e.estado !== "recibido").length;
  const esperanSesion = lista.some((e) => e.estado === "requiere_sesion");
  const esperanActualizacion = lista.some((e) => e.estado === "requiere_actualizar");

  async function nuevo() {
    const levantamiento = crearLevantamiento(formatoVigente, uuidv7(), new Date());
    await repositorio.crear(levantamiento, usuario.id);
    abrir(levantamiento.id);
  }

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
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Levantamientos</h1>
        <p className="text-ayuda text-sobre-superficie-suave">
          {usuario.nombre}
          {porEnviar > 0 && <span className="font-bold text-sobre-superficie"> · {porEnviar} por enviar</span>}
        </p>
        <Boton variante="principal" className="mt-4 w-full" onClick={nuevo}>
          Nuevo levantamiento
        </Boton>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3 empty:hidden">
          {(!enLinea || (!alcanzable && porEnviar > 0)) && (
            <Aviso>Sin conexión. Todo lo que captures se guarda en este teléfono y se envía al recuperar señal.</Aviso>
          )}
          {esperanSesion && (
            <Aviso tono="alerta">
              <p>Tu sesión venció. Lo pendiente se enviará cuando inicies sesión de nuevo.</p>
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

        <section aria-labelledby="titulo-lista" className="flex flex-col gap-3">
          <h2 id="titulo-lista" className="text-subtitulo font-extrabold">
            En este teléfono
          </h2>
          {levantamientos === undefined || envios === undefined ? (
            <div aria-busy="true" aria-label="Cargando levantamientos" className="flex flex-col gap-2">
              <div className="h-[76px] animate-pulse rounded-panel bg-panel" />
              <div className="h-[76px] animate-pulse rounded-panel bg-panel" />
            </div>
          ) : levantamientos.length === 0 ? (
            <p className="text-cuerpo text-texto-secundario">Todavía no hay levantamientos. Toca “Nuevo levantamiento” para empezar uno.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {levantamientos.map((l) => (
                <li key={l.id}>
                  <Fila levantamiento={l} envio={envios.get(l.id)} enLinea={alcanzable} abrir={abrir} />
                </li>
              ))}
            </ul>
          )}
          {deOtros !== undefined && deOtros > 0 && (
            <p className="text-ayuda text-texto-secundario">
              Hay {deOtros === 1 ? "1 levantamiento" : `${deOtros} levantamientos`} de otra persona en este teléfono. Se conservan y se envían cuando esa persona inicie sesión.
            </p>
          )}
        </section>

        <Diagnostico />
      </main>
    </div>
  );
}

function Fila({ levantamiento: l, envio, enLinea, abrir }: { levantamiento: LevantamientoLocal; envio: EnvioLocal | undefined; enLinea: boolean; abrir: (id: string) => void }) {
  const estado = envio ? estadoDeEnvio(envio, enLinea) : null;
  return (
    <button
      type="button"
      onClick={() => abrir(l.id)}
      className="flex w-full items-center justify-between gap-3 rounded-panel border-[1.5px] border-division bg-panel px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-cuerpo font-bold">{NOMBRE_FORMATO}</span>
        <span className="text-ayuda text-texto-secundario">
          {fechaHora(l.creadoEn)} · {fotos(contarFotos(l))}
        </span>
        {estado && <span className={`text-ayuda font-bold ${claseDeTono[estado.tono]}`}>{estado.texto}</span>}
      </span>
      <Marquilla tono={l.estado === "borrador" ? "borrador" : "enviado"}>{l.estado === "borrador" ? "Borrador" : "Enviado"}</Marquilla>
    </button>
  );
}
