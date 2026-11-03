/**
 * El número de orden de servicio como se escribe en el informe (ADR-0051): 4 dígitos por ahora. Es la única función que
 * sabe cómo se escribe: cuando TEINS responda si lleva letras, año o la serie de un talonario, cambia aquí.
 */
export const numeroDeOrden = (consecutivo: number) => String(consecutivo).padStart(4, "0");
