import { useCallback, useEffect, useRef, useState } from "react";
import { queryOptions, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatearDia } from "@teins/dominio";
import { ErrorApi, LARGO_MAXIMO_DE_PREGUNTA, type FuenteDelAsistente, type IntercambioDelAsistente, type RespuestaDelAsistente, type TablaDelAsistente } from "@teins/protocolo";
import { useNotificar } from "@teins/ui";
import { cliente } from "./api";
import { errorComun, textoDelServidor } from "./mensajes";
import { esBooleano, usePreferencia } from "./preferencias";

/*
  El asistente de datos de oficina (iteración 53, ADR-0060; prototipos/analisis, versión 5). Las cifras, tablas,
  fuentes y series las arma el servidor con sus consultas; esta pantalla solo las dibuja. El texto del modelo es texto
  plano: nunca se interpreta como HTML ni Markdown.
*/

export const consultasDelAsistente = {
  estado: () => queryOptions({ queryKey: ["asistente", "estado"], queryFn: () => cliente.llamar("estadoDelAsistente"), staleTime: 60_000 }),
  conversaciones: () => queryOptions({ queryKey: ["asistente", "conversaciones"], queryFn: () => cliente.llamar("listarConversacionesDelAsistente") }),
  /** Cada segundo mientras se arma una respuesta (ADR-0014); `esperado`, el intercambio recién encolado. */
  conversacion: (id: string, esperado?: string) =>
    queryOptions({
      queryKey: ["asistente", "conversacion", id],
      queryFn: () => cliente.llamar("obtenerConversacionDelAsistente", { parametros: { id } }),
      refetchInterval: (q) => intervaloDeConsulta(q.state.data, esperado),
    }),
  uso: () => queryOptions({ queryKey: ["asistente", "uso"], queryFn: () => cliente.llamar("usoDelAsistente") }),
};

// Funciones puras ---------------------------------------------------------------------------------

export function intervaloDeConsulta(conversacion: { intercambios: readonly IntercambioDelAsistente[] } | undefined, esperado?: string): 1000 | false {
  if (!conversacion) return false;
  if (conversacion.intercambios.some((i) => i.estado === "en_curso")) return 1000;
  // Recién encolado, puede que la primera lectura todavía no lo traiga.
  if (esperado && !conversacion.intercambios.some((i) => i.id === esperado)) return 1000;
  return false;
}

export function estadoDelBoton({ abierto, respondiendo, sinVer }: { abierto: boolean; respondiendo: boolean; sinVer: boolean }) {
  return { pensando: respondiendo && !abierto, listo: sinVer && !abierto && !respondiendo };
}

/**
 * Qué hacer cuando termina la respuesta que se seguía. Null: sigue en curso. Se notifica si la persona no está viendo
 * esa conversación; el punto queda si el panel está cerrado. Un error no va en una notificación (DESIGN.md): el punto
 * lleva a verlo. Lo detenido lo pidió la persona: no hay nada que avisar.
 */
export function alTerminar(estado: IntercambioDelAsistente["estado"], { abierto, viendo }: { abierto: boolean; viendo: boolean }): { notificar: boolean; sinVer: boolean } | null {
  if (estado === "en_curso") return null;
  if (estado === "detenida" || (abierto && viendo)) return { notificar: false, sinVer: false };
  return { notificar: estado === "lista", sinVer: !abierto };
}

export type Bloque = { tipo: "parrafo"; texto: string } | { tipo: "lista"; items: string[] };

/** Párrafos separados por línea en blanco y viñetas en las líneas que empiezan con «- ». Nada más se interpreta. */
export function partirTexto(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  for (const bloque of texto.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    let parrafo: string[] = [];
    let lista: string[] = [];
    const cerrarParrafo = () => {
      if (parrafo.length) bloques.push({ tipo: "parrafo", texto: parrafo.join("\n") });
      parrafo = [];
    };
    const cerrarLista = () => {
      if (lista.length) bloques.push({ tipo: "lista", items: lista });
      lista = [];
    };
    for (const linea of bloque.split("\n")) {
      const t = linea.trim();
      if (!t) continue;
      if (t.startsWith("- ")) {
        cerrarParrafo();
        lista.push(t.slice(2).trim());
      } else {
        cerrarLista();
        parrafo.push(t);
      }
    }
    cerrarParrafo();
    cerrarLista();
  }
  return bloques;
}

const enUnaLinea = (texto: string) => texto.replace(/\s*[\t\r\n]+\s*/g, " ");

/** Para pegar en Excel o en una cotización: los encabezados y una fila por línea, separadas por tabuladores. */
export function tablaComoTsv(tabla: TablaDelAsistente): string {
  const celda = (c: TablaDelAsistente["filas"][number][number]) => `${enUnaLinea(c.texto)}${c.detalle ? ` (${enUnaLinea(c.detalle)})` : ""}${c.marca === "sin_vincular" ? " (sin vincular)" : ""}`;
  return [tabla.columnas.map((c) => enUnaLinea(c.titulo)).join("\t"), ...tabla.filas.map((f) => f.map(celda).join("\t"))].join("\n");
}

const diaCorto = (aaaaMmDd: string) => formatearDia(aaaaMmDd, { day: "numeric", month: "short" });
export const ordenDeFuente = (f: FuenteDelAsistente) => (f.orden ? `Orden ${f.orden}` : "Sin número");

/** «Copiar la respuesta»: lo mismo que se ve, en texto plano. */
export function respuestaComoTexto(r: RespuestaDelAsistente): string {
  const partes: string[] = [];
  if (r.destacado) partes.push(`${r.destacado.cifras.map((c) => (c.unidad ? `${c.valor} ${c.unidad}` : c.valor)).join(" · ")} ${r.destacado.descripcion}`);
  if (r.serie) partes.push([r.serie.titulo, ...r.serie.puntos.map((p) => `${p.etiqueta}\t${p.valor}`)].join("\n"));
  if (r.texto.trim()) partes.push(r.texto.trim());
  for (const t of r.tablas) partes.push(`${t.titulo}\n${tablaComoTsv(t)}`);
  if (r.fuentes) partes.push([r.fuentes.titulo, ...r.fuentes.visitas.map((f) => [ordenDeFuente(f), diaCorto(f.fecha), f.ciudad, f.cliente, f.sitio].filter(Boolean).join(" · "))].join("\n"));
  return partes.join("\n\n");
}

/** A dónde lleva una fuente: su levantamiento o, sin él, la visita en la pestaña donde está. */
export function destinoDeFuente(f: FuenteDelAsistente, hoy: string): { a: "levantamiento"; id: string } | { a: "visita"; vista: "proximas" | "anteriores"; id: string } {
  if (f.levantamientoId) return { a: "levantamiento", id: f.levantamientoId };
  return { a: "visita", vista: f.fecha >= hoy ? "proximas" : "anteriores", id: f.visitaId };
}

/** Tres tramos con un paso redondo (1, 2 o 5 por una potencia de 10) que alcanza el valor más alto. */
export function escalaDeSerie(valores: readonly number[]): { maximo: number; guias: number[] } {
  const crudo = Math.max(0, ...valores) / 3;
  let paso = 1;
  if (crudo > 0) {
    const potencia = 10 ** Math.floor(Math.log10(crudo));
    paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= crudo) ?? 10 * potencia;
  }
  const guias = [0, 1, 2, 3].map((i) => Number((paso * i).toPrecision(12)));
  return { maximo: guias[3]!, guias };
}

export const nombreDePila = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? "";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesDe = (aaaaMm: string) => Number(aaaaMm.slice(5, 7)) - 1;
/** «2026-11» → «Noviembre de 2026». */
export function textoDelMes(aaaaMm: string): string {
  const mes = MESES[mesDe(aaaaMm)] ?? "";
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${aaaaMm.slice(0, 4)}`;
}
/** Cuándo vuelve a haber gasto: «1 de diciembre». Acepta «AAAA-MM» o «AAAA-MM-DD». */
export const primeroDelMesSiguiente = (aaaaMm: string) => `1 de ${MESES[(mesDe(aaaaMm) + 1) % 12]}`;

const formatoDolares = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Dos decimales para mostrar; el valor exacto sigue siendo el decimal del servidor. */
export const dolares = (decimal: string) => formatoDolares.format(Number(decimal));

export function porcentajeDelTope(gastoUsd: string, topeUsd: string): number {
  const tope = Number(topeUsd);
  if (!(tope > 0)) return 100;
  return Math.min(100, Math.round((Number(gastoUsd) / tope) * 100));
}

const TOPE_MAXIMO = 1000;
/** Lo escrito en el diálogo del tope, como lo pide el contrato («12.5»), o por qué no sirve. */
export function validarTope(texto: string): { topeUsd: string } | { error: string } {
  const t = texto.trim();
  const partes = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!partes) return { error: "Escriba el tope en dólares, por ejemplo 5,00." };
  const valor = `${Number(partes[1])}${partes[2] ? `.${partes[2]}` : ""}`;
  if (Number(valor) > TOPE_MAXIMO) return { error: "El tope va de 0 a 1.000 dólares." };
  return { topeUsd: valor };
}

/** Lo que no dejó preguntar, en el panel (nunca en una notificación). */
export function mensajeAlPreguntar(problema: unknown, nombre: string, hoy: string): string {
  const error = errorComun(problema, "No se envió la pregunta", "No se pudo enviar la pregunta. Intente de nuevo.");
  if (typeof error === "string") return error;
  switch (error.codigo) {
    case "tope_agotado":
      return `Se usó el tope de ${nombre} de este mes. Se puede volver a preguntar el ${primeroDelMesSiguiente(hoy)}.`;
    case "no_disponible":
      return `${nombre} no está disponible en este momento. Intente de nuevo más tarde.`;
    case "estado_invalido":
      return "Espere a que termine la respuesta en curso de esta conversación, o deténgala.";
    case "no_encontrado":
      return "Esa conversación ya no existe y la pregunta no se envió. Empiece una conversación nueva.";
    case "entrada_invalida":
      return `Escriba una pregunta de 1 a ${LARGO_MAXIMO_DE_PREGUNTA.toLocaleString("es-CO")} caracteres.`;
    case "demasiadas_solicitudes":
      return "Hizo muchas preguntas seguidas. Espere un momento e intente de nuevo.";
    default:
      return textoDelServidor(error, "No se pudo enviar la pregunta. Intente de nuevo.");
  }
}

/** La misma pregunta, reintentada en la misma conversación, lleva la misma llave (regla 4): si llegó, no se encola otra. */
export function llaveDePregunta(previa: { texto: string; conversacionId: string | null; llave: string } | null, texto: string, conversacionId: string | null, nueva: () => string): string {
  return previa && previa.texto === texto && previa.conversacionId === conversacionId ? previa.llave : nueva();
}

/** Si la persona ya empezó a escribir otra cosa mientras se enviaba, no se le borra. */
export const borradorTrasPreguntar = (borrador: string, enviado: string) => (borrador.trim() === enviado ? "" : borrador);

/** Al aceptarse la pregunta, el panel la muestra si la persona sigue donde preguntó; desde Buscar, siempre. */
export function debeMostrarLaRespuesta(ahora: { vista: VistaDelAsistente; conversacionId: string | null }, envio: { enConversacion: string | null; desdeBuscar: boolean }): boolean {
  if (envio.desdeBuscar) return true;
  if (envio.enConversacion === null) return ahora.vista === "inicio" && ahora.conversacionId === null;
  return ahora.vista === "conversacion" && ahora.conversacionId === envio.enConversacion;
}

/**
 * El aviso del tope agotado sobra cuando el estado ya dice que se puede preguntar (un tope mayor, otro mes). Solo un
 * estado leído después del intento: el que está en caché todavía no sabe que se agotó.
 */
export function olvidarErrorDeTope(error: unknown, { topeAgotado, estadoEn, intentoEn }: { topeAgotado: boolean | undefined; estadoEn: number; intentoEn: number }): boolean {
  return error instanceof ErrorApi && error.codigo === "tope_agotado" && topeAgotado === false && estadoEn > intentoEn;
}

/** Al ir a otra parte se olvida solo lo que falló: reiniciar un envío en curso permitiría otro en paralelo. */
export const erroresQueOlvidar = (pregunta: { isError: boolean }, detener: { isError: boolean }) => ({ pregunta: pregunta.isError, detener: detener.isError });

/**
 * Una respuesta en curso se deja de seguir solo si la conversación ya no existe, o por un error posterior a encolarla
 * cuando ya no hay consulta en curso (agotó sus reintentos). Un error viejo de esa misma consulta no cuenta.
 */
export function dejarDeSeguir({ error, errorEn, encoladoEn, consultando }: { error: unknown; errorEn: number; encoladoEn: number; consultando: boolean }): boolean {
  if (error instanceof ErrorApi && error.codigo === "no_encontrado") return true;
  return Boolean(error) && errorEn > encoladoEn && !consultando;
}

const LARGO_EN_NOTIFICACION = 80;
export function textoDeNotificacion(nombre: string, pregunta: string): string {
  const t = pregunta.trim().replace(/\s+/g, " ");
  return `${nombre} respondió: ${t.length > LARGO_EN_NOTIFICACION ? `${t.slice(0, LARGO_EN_NOTIFICACION - 1)}…` : t}`;
}

/** Lo que dice el lector de pantalla cuando termina una respuesta. */
export function anuncioDelFinal(estado: IntercambioDelAsistente["estado"], nombre: string): string {
  return { en_curso: "", lista: `${nombre} respondió`, error: "No se pudo terminar la respuesta", detenida: "Detuvo la respuesta" }[estado];
}

/** Enter pregunta; Mayús + Enter, o Enter mientras se compone un acento, escribe. */
export function accionDeTecla(e: { key: string; shiftKey: boolean; isComposing: boolean }, { bloqueada, enCurso }: { bloqueada: boolean; enCurso: boolean }): "preguntar" | "nada" | "escribir" {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return "escribir";
  return bloqueada || enCurso ? "nada" : "preguntar";
}

// El estado del asistente en oficina ---------------------------------------------------------------

export type VistaDelAsistente = "inicio" | "conversacion" | "historial";
/** La respuesta en curso que se sigue también con el panel cerrado, para saber cuándo termina. */
export interface Seguida {
  conversacionId: string;
  intercambioId: string;
  /** Cuándo la aceptó el servidor: un error de la consulta anterior a esto no cuenta. */
  encoladoEn: number;
}

/** Lo leído de una respuesta seguida: su intercambio, si ya llegó, y el último error de la consulta. */
export interface LecturaSeguida {
  intercambio: Pick<IntercambioDelAsistente, "estado" | "pregunta"> | undefined;
  error: unknown;
  errorEn: number;
  consultando: boolean;
}

/**
 * Cada respuesta encolada en esta sesión se sigue por su cuenta (el servidor deja dos en curso por persona): las que
 * siguen en curso o sin leer, y las que terminaron con su propia decisión (`alTerminar`). Una que ya no existe sale sin aviso.
 */
export function revisarSeguidas(
  seguidas: readonly Seguida[],
  lecturas: readonly LecturaSeguida[],
  donde: { abierto: boolean; vista: VistaDelAsistente; conversacionId: string | null },
): { siguen: Seguida[]; terminadas: { conversacionId: string; pregunta: string; notificar: boolean; sinVer: boolean }[] } {
  const siguen: Seguida[] = [];
  const terminadas: { conversacionId: string; pregunta: string; notificar: boolean; sinVer: boolean }[] = [];
  seguidas.forEach((s, k) => {
    const l = lecturas[k];
    if (l && dejarDeSeguir({ error: l.error, errorEn: l.errorEn, encoladoEn: s.encoladoEn, consultando: l.consultando })) return;
    const decision = l?.intercambio ? alTerminar(l.intercambio.estado, { abierto: donde.abierto, viendo: donde.vista === "conversacion" && donde.conversacionId === s.conversacionId }) : null;
    if (!decision || !l?.intercambio) return void siguen.push(s);
    terminadas.push({ conversacionId: s.conversacionId, pregunta: l.intercambio.pregunta, ...decision });
  });
  return { siguen, terminadas };
}

export const ID_BOTON_ASISTENTE = "boton-asistente";
export const ID_PANEL_ASISTENTE = "panel-asistente";

/**
 * Lo que comparten el botón, el panel y Buscar (⌘K): si el panel está abierto (se recuerda por persona), qué vista y qué
 * conversación muestra, lo escrito en la caja, la pregunta en curso y si hay una respuesta sin ver. Vive en el marco,
 * así que sigue ahí al cerrar el panel.
 */
export function useAsistente() {
  const consultasCliente = useQueryClient();
  const notificar = useNotificar();
  const estado = useQuery(consultasDelAsistente.estado());
  const disponible = estado.data?.disponible === true;
  const nombre = estado.data?.nombre ?? "";
  const [abiertoGuardado, setAbiertoGuardado] = usePreferencia("asistente-abierto", false, esBooleano);
  const abierto = disponible && abiertoGuardado;
  const [vista, setVista] = useState<VistaDelAsistente>("inicio");
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [seguidas, setSeguidas] = useState<Seguida[]>([]);
  const [sinVer, setSinVer] = useState(false);
  // Cada vez que la persona lo abre, el foco va a la caja; al cargar la página abierto, no se lo quita a nada.
  const [aperturas, setAperturas] = useState(0);
  // La misma pregunta, reintentada tras un error, lleva la misma llave (regla 4).
  const pendiente = useRef<{ texto: string; conversacionId: string | null; llave: string } | null>(null);
  // Dónde está la persona cuando llega la respuesta del servidor, que puede tardar.
  const donde = useRef({ vista, conversacionId });
  donde.current = { vista, conversacionId };

  const pregunta = useMutation({
    mutationFn: (e: { texto: string; conversacionId: string | null; llave: string; desdeLaCaja: boolean; desdeBuscar: boolean }) =>
      cliente.llamar("preguntarAlAsistente", { cuerpo: { llave: e.llave, conversacionId: e.conversacionId, texto: e.texto } }),
    onSuccess: (r, e) => {
      pendiente.current = null;
      if (e.desdeLaCaja) setBorrador((b) => borradorTrasPreguntar(b, e.texto));
      if (debeMostrarLaRespuesta(donde.current, { enConversacion: e.conversacionId, desdeBuscar: e.desdeBuscar })) {
        setConversacionId(r.conversacionId);
        setVista("conversacion");
      }
      setSeguidas((l) => [...l.filter((x) => x.intercambioId !== r.intercambioId), { conversacionId: r.conversacionId, intercambioId: r.intercambioId, encoladoEn: Date.now() }]);
      void consultasCliente.invalidateQueries({ queryKey: ["asistente", "conversacion", r.conversacionId] });
      void consultasCliente.invalidateQueries({ queryKey: ["asistente", "conversaciones"] });
    },
    onError: (error) => {
      // El tope o la disponibilidad cambiaron: el estado lo vuelve a decir (caja deshabilitada, aviso del tope).
      if (error instanceof ErrorApi && (error.codigo === "tope_agotado" || error.codigo === "no_disponible")) void consultasCliente.invalidateQueries({ queryKey: ["asistente", "estado"] });
    },
  });
  const detener = useMutation({
    mutationFn: (intercambioId: string) => cliente.llamar("detenerRespuestaDelAsistente", { parametros: { id: intercambioId } }),
    onSettled: () => void consultasCliente.invalidateQueries({ queryKey: ["asistente", "conversacion"] }),
  });
  const { reset: olvidarPregunta, isError: preguntaFallo, submittedAt: intentoEn } = pregunta;
  const { reset: olvidarDetener, isError: detenerFallo } = detener;
  // Un error describe lo que se intentó donde se intentó: al ir a otra parte, ya no aplica.
  const olvidarErrores = useCallback(() => {
    const olvidar = erroresQueOlvidar({ isError: preguntaFallo }, { isError: detenerFallo });
    if (olvidar.pregunta) olvidarPregunta();
    if (olvidar.detener) olvidarDetener();
  }, [preguntaFallo, detenerFallo, olvidarPregunta, olvidarDetener]);
  const topeAgotado = estado.data?.topeAgotado;
  const estadoEn = estado.dataUpdatedAt;
  useEffect(() => {
    if (olvidarErrorDeTope(pregunta.error, { topeAgotado, estadoEn, intentoEn })) olvidarPregunta();
  }, [pregunta.error, topeAgotado, estadoEn, intentoEn, olvidarPregunta]);

  const abrir = useCallback(() => {
    setAbiertoGuardado(true);
    setSinVer(false);
    setAperturas((n) => n + 1);
  }, [setAbiertoGuardado]);
  const cerrar = useCallback(() => {
    setAbiertoGuardado(false);
    document.getElementById(ID_BOTON_ASISTENTE)?.focus();
  }, [setAbiertoGuardado]);
  const verConversacion = useCallback(
    (id: string) => {
      olvidarErrores();
      setConversacionId(id);
      setVista("conversacion");
      abrir();
    },
    [abrir, olvidarErrores],
  );

  const preguntar = useCallback(
    (texto: string, enConversacion: string | null, origen: "caja" | "panel" | "buscar") => {
      const limpio = texto.trim();
      if (!limpio || pregunta.isPending) return;
      const llave = llaveDePregunta(pendiente.current, limpio, enConversacion, () => crypto.randomUUID());
      pendiente.current = { texto: limpio, conversacionId: enConversacion, llave };
      olvidarErrores();
      if (!abierto) abrir();
      pregunta.mutate({ texto: limpio, conversacionId: enConversacion, llave, desdeLaCaja: origen === "caja", desdeBuscar: origen === "buscar" });
    },
    [pregunta, abierto, abrir, olvidarErrores],
  );

  // Con el panel cerrado (o en otra conversación) se siguen las respuestas en curso para saber cuándo terminan.
  const lecturas = useQueries({ queries: seguidas.map((x) => consultasDelAsistente.conversacion(x.conversacionId, x.intercambioId)) });
  const revision = revisarSeguidas(
    seguidas,
    lecturas.map((q, k) => ({ intercambio: q.data?.intercambios.find((i) => i.id === seguidas[k]!.intercambioId), error: q.error, errorEn: q.errorUpdatedAt, consultando: q.fetchStatus === "fetching" })),
    { abierto, vista, conversacionId },
  );
  const salen = seguidas.filter((x) => !revision.siguen.includes(x)).map((x) => x.intercambioId).join(",");
  const vigente = useRef(revision);
  vigente.current = revision;
  useEffect(() => {
    if (!salen) return;
    const ids = new Set(salen.split(","));
    setSeguidas((l) => l.filter((x) => !ids.has(x.intercambioId)));
    const { terminadas } = vigente.current;
    for (const t of terminadas) {
      if (t.sinVer) setSinVer(true);
      if (t.notificar) notificar({ texto: textoDeNotificacion(nombre, t.pregunta), accion: { texto: "Ver", alHacer: () => verConversacion(t.conversacionId) } });
    }
    if (terminadas.length === 0) return;
    void consultasCliente.invalidateQueries({ queryKey: ["asistente", "conversaciones"] });
    // El gasto cambió: el tope puede haberse agotado.
    void consultasCliente.invalidateQueries({ queryKey: ["asistente", "estado"] });
  }, [salen, nombre, notificar, verConversacion, consultasCliente]);

  const boton = estadoDelBoton({ abierto, respondiendo: revision.siguen.length > 0, sinVer });

  return {
    estado,
    disponible,
    nombre,
    abierto,
    ...boton,
    aperturas,
    vista,
    conversacionId,
    borrador,
    setBorrador,
    abrir,
    cerrar,
    alternar: () => (abierto ? cerrar() : abrir()),
    verConversacion,
    irAlHistorial: () => {
      olvidarErrores();
      setVista("historial");
    },
    volver: () => setVista(conversacionId ? "conversacion" : "inicio"),
    nueva: () => {
      olvidarErrores();
      setVista("inicio");
      setConversacionId(null);
    },
    /** La conversación vista ya no existe (se eliminó): el panel vuelve al inicio. */
    olvidarConversacion: (id: string) => {
      if (conversacionId !== id) return;
      setConversacionId(null);
      if (vista === "conversacion") setVista("inicio");
    },
    preguntar,
    preguntando: pregunta.isPending,
    errorAlPreguntar: pregunta.error,
    detener: (intercambioId: string) => detener.mutate(intercambioId),
    deteniendo: detener.isPending,
    errorAlDetener: detener.isError,
  };
}

export type ControlDelAsistente = ReturnType<typeof useAsistente>;
