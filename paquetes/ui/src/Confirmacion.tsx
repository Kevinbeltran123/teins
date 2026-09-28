import { useState, type ReactNode } from "react";
import { Aviso } from "./Aviso";
import { Boton } from "./Boton";
import { Dialogo } from "./Dialogo";
import { CircleCheck, TriangleAlert } from "./iconos";

const enOficina = () => typeof document !== "undefined" && document.documentElement.dataset.superficie === "oficina";

interface Props {
  /** Pregunta corta con el verbo y el objeto: "¿Desactivar a Juan Pérez?". Nunca "¿Está seguro?". */
  titulo: string;
  /** La consecuencia, en una o dos frases, y lo que haga falta para decidir (un motivo, por ejemplo). */
  children: ReactNode;
  /** El mismo verbo del título, en el botón: "Desactivar usuario". Nunca "Aceptar" ni "Sí". */
  confirmar: string;
  /** Texto del botón que no hace nada. "Cancelar", salvo que choque con la acción ("Cancelar visita": entonces "Volver"). */
  descartar?: string;
  /** Lo que no se deshace o le corta el acceso a alguien: el botón va en rojo. */
  peligro?: boolean;
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
 * puede cerrar, y el botón que no hace nada recibe el foco inicial: la acción que no se deshace nunca es la predeterminada.
 */
export function Confirmacion({ titulo, children, confirmar, descartar = "Cancelar", peligro = false, accion, validar, mensajeDeError, alCerrar, alTerminar, forma = "centrado" }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // El icono de la consecuencia es de oficina (prototipos/oficina); campo conserva su confirmación.
      icono={forma === "centrado" && enOficina() ? (peligro ? TriangleAlert : CircleCheck) : undefined}
      tono={peligro ? "peligro" : "exito"}
      // En el teléfono se abre sin anillo de foco sobre "Cancelar": se ve como si ya estuviera elegido.
      focoEnElDialogo={forma === "inferior"}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={ocupado}>
            {descartar}
          </Boton>
          <Boton variante={peligro ? "peligro" : "principal"} cargando={ocupado} onClick={() => void hacer()}>
            {confirmar}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-cuerpo">{children}</div>
      {error && <Aviso tono="error">{error}</Aviso>}
    </Dialogo>
  );
}
