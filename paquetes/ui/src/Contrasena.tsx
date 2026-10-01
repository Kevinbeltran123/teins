import { Check } from "./iconos";

/** Los mismos límites que exige el servidor (`ContrasenaNueva` en protocolo, ADR-0033). */
export const LARGO_CONTRASENA = { minimo: 10, maximo: 128 } as const;

export interface ErroresDeContrasena {
  actual?: string;
  nueva?: string;
  repetir?: string;
}

/**
 * Valida al guardar, un mensaje por campo (DESIGN.md). `tu` tutea, como campo; `pideActual` cuando la persona la
 * escribe (cambiarla desde la cuenta), y no cuando la app ya la tiene (la temporal con la que acaba de entrar).
 */
export function validarContrasenaNueva({ actual, nueva, repetir, pideActual, tu }: { actual: string; nueva: string; repetir: string; pideActual: boolean; tu: boolean }): ErroresDeContrasena {
  const errores: ErroresDeContrasena = {};
  if (pideActual && actual === "") errores.actual = tu ? "Escribe tu contraseña actual." : "Escriba su contraseña actual.";
  if (nueva.length < LARGO_CONTRASENA.minimo) errores.nueva = `Le faltan caracteres: son al menos ${LARGO_CONTRASENA.minimo}.`;
  else if (nueva.length > LARGO_CONTRASENA.maximo) errores.nueva = `Sobran caracteres: son máximo ${LARGO_CONTRASENA.maximo}.`;
  else if (nueva === actual) errores.nueva = "Debe ser distinta de la actual.";
  if (!errores.nueva && nueva !== repetir) errores.repetir = "No coincide con la nueva.";
  return errores;
}

/** Los requisitos se marcan mientras se escribe: la persona sabe qué le falta antes de guardar. */
export function RequisitosDeContrasena({ actual, nueva, repetir }: { actual: string; nueva: string; repetir: string }) {
  const requisitos: [boolean, string][] = [
    [nueva.length >= LARGO_CONTRASENA.minimo && nueva.length <= LARGO_CONTRASENA.maximo, `De ${LARGO_CONTRASENA.minimo} a ${LARGO_CONTRASENA.maximo} caracteres`],
    [nueva !== "" && nueva !== actual, "Distinta de la contraseña actual"],
    [nueva !== "" && nueva === repetir, "Las dos coinciden"],
  ];
  return (
    <ul aria-label="Requisitos de la contraseña" className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-texto-secundario">
      {requisitos.map(([cumple, texto]) => (
        <li key={texto} className={`flex items-center gap-2 ${cumple ? "text-texto" : ""}`}>
          <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full ${cumple ? "bg-exito-texto text-fondo" : "shadow-[inset_0_0_0_1.5px_var(--t-borde-suave)]"}`}>
            {cumple && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          {texto}
          <span className="sr-only">{cumple ? " (cumple)" : " (falta)"}</span>
        </li>
      ))}
    </ul>
  );
}
