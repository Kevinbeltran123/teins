import { useLiveQuery } from "dexie-react-hooks";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento, type Levantamiento } from "@teins/dominio";
import { Aviso, Boton, Marquilla } from "@teins/ui";
import { repositorio } from "../datos/instancia";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { useConexion } from "../dispositivo/useConexion";
import { fechaHora } from "../formato";
import { formatoDemo, NOMBRE_FORMATO_DEMO } from "../formato-demo";
import { Diagnostico } from "./Diagnostico";

interface Props {
  abrir: (id: string) => void;
  actualizacion: { disponible: boolean; aplicar: () => void };
}

function contarFotos(l: Levantamiento): number {
  return Object.values(l.respuestas)
    .flatMap((seccion) => Object.values(seccion))
    .reduce<number>((total, valor) => total + (Array.isArray(valor) ? valor.length : 0), 0);
}

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

export function Inicio({ abrir, actualizacion }: Props) {
  const levantamientos = useLiveQuery(() => repositorio.listar());
  const enLinea = useConexion();

  async function nuevo() {
    const levantamiento = crearLevantamiento(formatoDemo, uuidv7(), new Date());
    await repositorio.crear(levantamiento);
    abrir(levantamiento.id);
  }

  return (
    <div className="min-h-dvh bg-fondo-campo">
      <header className="bg-superficie px-4 pt-8 pb-5 text-sobre-superficie">
        <p className="text-ayuda text-sobre-superficie-suave">Datos de prueba, no reales</p>
        <h1 className="font-display text-titulo leading-none font-bold">Levantamientos</h1>
        <Boton variante="principal" className="mt-5 w-full" onClick={nuevo}>
          Nuevo levantamiento
        </Boton>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3 empty:hidden">
          {!enLinea && <Aviso>Sin conexión. Todo lo que captures se guarda en este teléfono.</Aviso>}
          {!estaInstalada() && (
            <Aviso tono="alerta">
              Instala la app para que el teléfono no borre los datos: en Safari, toca Compartir y luego “Agregar a
              inicio”. Después ábrela desde ese ícono.
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
          <h2 id="titulo-lista" className="font-display text-2xl font-bold">
            En este teléfono
          </h2>
          {levantamientos === undefined ? (
            <div aria-busy="true" aria-label="Cargando levantamientos" className="flex flex-col gap-2">
              <div className="h-[76px] animate-pulse rounded-panel bg-division" />
              <div className="h-[76px] animate-pulse rounded-panel bg-division" />
            </div>
          ) : levantamientos.length === 0 ? (
            <p className="text-campo text-texto-secundario">
              Todavía no hay levantamientos. Toca “Nuevo levantamiento” para empezar uno.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {levantamientos.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => abrir(l.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-panel border-[1.5px] border-division bg-panel px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                  >
                    <span className="flex flex-col">
                      <span className="text-campo font-bold">{NOMBRE_FORMATO_DEMO}</span>
                      <span className="text-ayuda text-texto-secundario">
                        {fechaHora(l.creadoEn)} · {fotos(contarFotos(l))}
                      </span>
                    </span>
                    <Marquilla tono="borrador">Borrador</Marquilla>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Diagnostico />
      </main>
    </div>
  );
}
