import { useEffect, useId, useState, type ReactNode } from "react";
import { Aviso } from "./Aviso";
import { Boton } from "./Boton";
import { Dialogo } from "./Dialogo";
import type { LucideIcon } from "./iconos";

type Consecuencia = { icono: LucideIcon; texto: string; detalle?: string };

/** Las consecuencias de una acción, una por línea con su icono: se leen antes de decidir (DESIGN.md). */
export function Consecuencias({ lista }: { lista: readonly Consecuencia[] }) {
  return (
    <ul className="consecuencias m-0 flex list-none flex-col rounded-panel border border-division p-0">
      {lista.map(({ icono: Icono, texto, detalle }) => (
        <li key={texto} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2.5 border-division px-3 py-2.5 text-ayuda leading-snug not-first:border-t">
          <Icono aria-hidden className="mt-0.5 size-4 text-texto-secundario" strokeWidth={1.6} />
          <span>
            {texto}
            {detalle && <small className="block text-[12px] text-texto-secundario">{detalle}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const enOficina = () => typeof document !== "undefined" && document.documentElement.dataset.superficie === "oficina";

interface Props {
  /** Pregunta corta con el verbo y el objeto: "¿Desactivar a Juan Pérez?". Nunca "¿Está seguro?". */
  titulo: string;
  /**
   * Las consecuencias concretas, una por línea con su icono y un detalle opcional: se leen antes de decidir
   * (DESIGN.md, "Confirmaciones sin icono").
   */
  consecuencias?: readonly Consecuencia[];
  /** La consecuencia en una o dos frases, si no va en `consecuencias`, y lo que haga falta para decidir (un motivo). */
  children?: ReactNode;
  /** El mismo verbo del título, en el botón: "Desactivar usuario". Nunca "Aceptar" ni "Sí". */
  confirmar: string;
  /** Texto del botón que no hace nada. "Cancelar", salvo que choque con la acción ("Cancelar visita": entonces "Volver"). */
  descartar?: string;
  /**
   * Qué tan grave es (DESIGN.md, "Qué se confirma y qué se deshace"); obligatorio para que cada confirmación se
   * clasifique. "consecuencia": se confirma con el botón principal. "irreversible": no se deshace, el botón va en
   * rojo. Lo que se deshace fácil no lleva confirmación: se hace al instante y la notificación ofrece "Deshacer".
   */
  nivel: "consecuencia" | "irreversible";
  /** Lo que se confirma. Si falla, el diálogo sigue abierto con el mensaje: el error queda donde se causó. */
  accion: () => Promise<unknown>;
  /** Antes de la acción: el mensaje si falta algo (el motivo, por ejemplo). */
  validar?: () => string | null;
  mensajeDeError: (error: unknown) => string;
  alCerrar: () => void;
  /** Tras confirmar con éxito, con el diálogo ya cerrado. */
  alTerminar?: () => void;
  forma?: "centrado" | "inferior";
}

/**
 * Confirmación de lo que tiene consecuencias (DESIGN.md: qué se confirma y qué se deshace). Mientras trabaja no se
 * puede cerrar. Lo que no se deshace nunca es la acción predeterminada: el foco empieza en "Cancelar". Con
 * consecuencias y sin nada que escribir, el foco empieza en la acción y en oficina se confirma con ↵ (prototipos/base-visual).
 */
export function Confirmacion({ titulo, consecuencias, children, confirmar, descartar = "Cancelar", nivel, accion, validar, mensajeDeError, alCerrar, alTerminar, forma = "centrado" }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peligro = nivel === "irreversible";
  const idConfirmar = useId();
  const conEnter = !peligro && !validar && forma === "centrado";
  const atajos = forma === "centrado" && enOficina();
  // El diálogo (hijo) ya se abrió en su efecto: aquí el botón ya puede recibir el foco.
  useEffect(() => {
    if (conEnter) document.getElementById(idConfirmar)?.focus();
  }, [conEnter, idConfirmar]);

  async function hacer() {
    const falta = validar?.();
    if (falta) return setError(falta);
    setOcupado(true);
    setError(null);
    try {
      await accion();
      alCerrar();
      alTerminar?.();
    } catch (e) {
      setError(mensajeDeError(e));
      setOcupado(false);
    }
  }

  return (
    <Dialogo
      titulo={titulo}
      alCerrar={alCerrar}
      cerrable={!ocupado}
      forma={forma}
      // En el teléfono se abre sin anillo de foco sobre "Cancelar": se ve como si ya estuviera elegido.
      focoEnElDialogo={forma === "inferior"}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={ocupado}>
            {descartar}
            {atajos && (
              <span aria-hidden className="kbd">
                Esc
              </span>
            )}
          </Boton>
          <Boton id={idConfirmar} variante={peligro ? "peligro" : "principal"} cargando={ocupado} onClick={() => void hacer()}>
            {confirmar}
            {atajos && conEnter && (
              <span aria-hidden className="kbd">
                ↵
              </span>
            )}
          </Boton>
        </>
      }
    >
      {consecuencias && consecuencias.length > 0 && <Consecuencias lista={consecuencias} />}
      {children && <div className="flex flex-col gap-3 text-cuerpo">{children}</div>}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Dialogo>
  );
}
