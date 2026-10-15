import type { CodigoErrorValidacion } from "@teins/dominio";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";

/** Textos de oficina en español de Colombia, tratando de usted (el técnico se tutea en campo). */
export const mensajeDeValidacion: Record<CodigoErrorValidacion, string> = {
  campo_obligatorio: "Este dato es obligatorio. Si no se pudo obtener, márquelo y escriba el motivo.",
  medida_invalida: "Escriba solo el número, por ejemplo 12,5",
  unidad_no_permitida: "Elija una de las unidades del formato",
  fotos_insuficientes: "Faltan fotos",
  foto_invalida: "Hay una foto dañada",
  motivo_requerido: "Escriba por qué no se pudo obtener",
  texto_muy_largo: "El texto es demasiado largo",
  tipo_invalido: "Este dato no tiene la forma esperada",
  campo_desconocido: "Este dato no pertenece al formato",
  seccion_desconocida: "Esta sección no pertenece al formato",
  no_obtenido_no_permitido: "Este dato no es obligatorio: bórrelo en lugar de marcarlo",
  no_corregible: "Este dato no se corrige desde oficina",
  repeticiones_insuficientes: "Faltan repeticiones de esta sección",
  repeticiones_excedidas: "Hay más repeticiones de las que permite el formato",
  nombre_de_repeticion_invalido: "Una repetición no tiene nombre",
  boceto_invalido: "El boceto no tiene la forma esperada",
  cantidades_invalidas: "Cada línea necesita descripción, una cantidad mayor que cero y una unidad permitida",
  firma_invalida: "La firma no tiene sus trazos, el nombre de quien firmó, la fecha o la constancia",
  archivo_muy_grande: "El archivo pesa más de lo que se puede recibir.",
};

/** Los datos que envían las pantallas de oficina, como se nombran en ellas (las claves de los esquemas de protocolo). */
const NOMBRE_DEL_DATO: Record<string, string> = {
  nombre: "el nombre",
  correo: "el correo",
  telefono: "el teléfono",
  cargo: "el cargo",
  usuario: "el usuario",
  contrasena: "la contraseña",
  rol: "el rol",
  direccion: "la dirección",
  sitio: "el sitio",
  sitioId: "el sitio",
  clienteId: "el cliente",
  programadaPara: "la fecha",
  tecnicos: "los técnicos",
  motivo: "el motivo",
  texto: "el comentario",
  descripcion: "la descripción",
  codigo: "el código",
  unidad: "la unidad",
  precio: "el precio",
  cantidad: "la cantidad",
  lineas: "las líneas",
  impuestos: "los impuestos",
  validezDias: "la validez",
  formaPago: "la forma de pago",
  notas: "las notas",
  introduccion: "la introducción",
  conclusiones: "las conclusiones",
  planos: "los planos",
  destinos: "los destinatarios",
  destinatarios: "los destinatarios",
};

/**
 * El texto de un error del servidor para la persona. Si el esquema rechazó la entrada, el servidor dice "Revise
 * cuerpo" y lista las rutas en `campos`: se nombran los datos como en la pantalla. Si no, su texto ya está escrito
 * para la persona.
 */
export function textoDelServidor(error: ErrorApi, respaldo: string): string {
  const campos = error.problema.campos;
  if (!campos?.length) return error.message || respaldo;
  const nombres = [...new Set(campos.map((c) => NOMBRE_DEL_DATO[claveDeRuta(c.ruta)]))];
  if (nombres.includes(undefined) || nombres.length === 0) return "Revise los datos: alguno no tiene la forma esperada.";
  return `Revise ${new Intl.ListFormat("es", { type: "conjunction" }).format(nombres as string[])}: ${nombres.length === 1 ? "no tiene" : "no tienen"} la forma esperada.`;
}

/** "cuerpo.contactos.0.correo" → "correo": el dato, sin dónde viajó ni su posición en una lista. */
const claveDeRuta = (ruta: string) => ruta.split(".").filter((s) => !/^\d+$/.test(s)).at(-1) ?? "";

/**
 * El error de un campo del formulario, si el servidor rechazó ese dato (`problema.campos`): para marcarlo junto al
 * campo, además del aviso general. `clave` es la del esquema de protocolo ("correo", "celular").
 */
export function errorDelCampo(error: unknown, clave: string): string | undefined {
  if (!(error instanceof ErrorApi)) return undefined;
  return error.problema.campos?.some((c) => claveDeRuta(c.ruta) === clave) ? "Revise este dato: no tiene la forma esperada." : undefined;
}

/**
 * Al cambiar un campo, su error se va: ya no describe lo que hay. Los de los demás campos se quedan hasta corregirlos.
 * Sin error en esos campos, devuelve el mismo objeto y la pantalla no se vuelve a pintar.
 */
export function sinError<E extends object>(errores: E, ...campos: (keyof E)[]): E {
  if (!campos.some((c) => errores[c] !== undefined)) return errores;
  const resto: Partial<E> = { ...errores };
  for (const c of campos) delete resto[c];
  return resto as E;
}

export const MENSAJE_VERSION_NUEVA ="Hay una versión nueva de TEINS: recargue la página e intente de nuevo.";

/**
 * Una pestaña abierta desde antes de un despliegue pide archivos que ya cambiaron de nombre: el navegador lanza un
 * TypeError al cargar una pieza aparte (el QR, las plantillas). No es un error de la acción: se arregla recargando.
 */
export const esVersionVieja = (error: unknown) =>
  error instanceof TypeError && /dynamically imported module|module script failed|loading dynamically imported/i.test(error.message);

/** Lo que una persona de oficina necesita saber de un error al guardar. */
export function mensajeDeError(error: unknown): string {
  if (esVersionVieja(error)) return MENSAJE_VERSION_NUEVA;
  if (error instanceof ErrorDeRed) return "Sin conexión con el servidor. No se guardó nada; intente de nuevo al recuperar la conexión.";
  if (!(error instanceof ErrorApi)) return "No se pudo guardar. Intente de nuevo.";
  switch (error.codigo) {
    case "conflicto_de_version":
      return "Otra persona guardó cambios en este levantamiento mientras usted lo tenía abierto. Lo suyo no se guardó: recargue para ver la versión actual.";
    case "tomado_por_otro":
      return `${error.problema.revisor?.nombre ?? "Otra persona"} tomó la revisión antes que usted.`;
    case "no_tomado":
      return "Ya no tiene la revisión de este levantamiento: otra persona la tomó.";
    case "estado_invalido":
      // Si el servidor sabe qué pasó («La visita está cancelada…»), lo dice: recargar no lo cambiaría.
      return error.problema.detail ?? "El levantamiento cambió de estado. Recargue para ver cómo quedó.";
    case "respuestas_invalidas":
      return "Hay datos que no cumplen el formato. Revise los campos marcados.";
    case "no_autenticado":
      return "Su sesión venció. Inicie sesión de nuevo.";
    default:
      return textoDelServidor(error, "No se pudo guardar. Intente de nuevo.");
  }
}

/** El error se arregla recargando: la versión que se tenía abierta ya no es la vigente. */
export const pideRecargar = (error: unknown) =>
  error instanceof ErrorApi && ["conflicto_de_version", "tomado_por_otro", "no_tomado", "estado_invalido"].includes(error.codigo);
