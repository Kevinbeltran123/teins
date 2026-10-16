import { createContext, Fragment, lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { pasosDe, type Paso } from "../recorrido";
import { useLiveQuery } from "dexie-react-hooks";
import {
  aDecimalColombiano,
  archivosReferenciados,
  bloques,
  claveDeRepeticion,
  crearMedida,
  describirValor,
  esBoceto,
  esCantidades,
  esFirma,
  esNoObtenido,
  hojasDe,
  leerClave,
  llenarDeclaracion,
  LIENZO,
  normalizarDecimal,
  LIMITES,
  fotosReferenciadas,
  nombreDeDato,
  rutaLegible,
  sinRespuestasHuerfanas,
  validarRespuestas,
  type CodigoErrorValidacion,
  type DefinicionCampo,
  type DefinicionSeccion,
  type DocumentoBoceto,
  type ErrorValidacion,
  type Valor,
  type ValorCantidades,
  type ValorFirma,
  type ValorMedida,
  type VersionFormato,
} from "@teins/dominio";
import {
  Aviso,
  BarraDePaso,
  Building,
  WifiOff,
  Boton,
  BotonAgregar,
  BotonRedondo,
  BotonSiguiente,
  Check,
  CifrasDeRepaso,
  RefreshCw,
  EncabezadoDePaso,
  FilaDeRepaso,
  FranjaSincronizacion,
  ListaRecorrido,
  PasoDelRecorrido,
  Repaso,
  FilaDeRepeticion,
  ListaDeRepeticiones,
  MenuAcciones,
  conTransicion,
  nombreDeTransicion,
  sinMovimiento,
  useLoNuevo,
  type EstadoDePaso,
  BotonIcono,
  CampoFotos,
  CampoMedida,
  CampoTexto,
  ChevronLeft,
  ChevronDown,
  CircleAlert,
  Confirmacion,
  Dialogo,
  ListaFaltantes,
  ProcesoDeEnvio,
  type EstadoDeProceso,
  type DatoFaltante,
  EditorMateriales,
  EsqueletoBloques,
  EtiquetaCampo,
  Firma,
  HojasDeBoceto,
  Insignia,
  MarcaNoObtenido,
  MensajeError,
  Pencil,
  Plus,
  Send,
  Smartphone,
  TriangleAlert,
  TablaCantidades,
  Trash,
  useNotificar,
  useSinRepetir,
  ValorLeido,
  type LineaEditable,
} from "@teins/ui";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { estadoDe, visitaDe, visitasDe } from "../datos/lecturas";
import { useUsuario } from "../sesion/usuario";
import { usosPorItem } from "../catalogo";
// El catálogo para elegir materiales (ADR-0025): va con la captura, que ya se carga aparte del arranque.
import HojaCatalogo from "./HojaCatalogo";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal } from "../datos/modelo";
import { VisitaConOtroBorrador, type ArchivoNuevo } from "../datos/repositorio";
import { procesarFoto } from "../fotos/procesar";
import { fechaHora, horaExacta } from "../formato";
import { formatoDe, nombreDeFormato, useFormatos } from "../formatos";
import { claseDeTono, estadoDeEnvio, estadoSegunServidor, mensajeDeValidacion, porQueNoEntro, QUE_HACER_CON_EL_RECHAZO } from "../mensajes";
import { useBotonAtras } from "../dispositivo/atras";
import { useServidorAlcanzable } from "../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../sincronizacion/disparar";
import { agendaDeVisitas, hoyLocal } from "../visitas";
import { armarChat, horaDelChat, sinLeer } from "../conversacion";
import { leidoHasta, pendientesDe } from "../datos/conversacion";
import { Chat } from "./Chat";

/** Id del dato en «Ver lo que enviaste», para ir a él desde el chat. */
const idDeDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`.replace(/[^a-zA-Z0-9_-]/g, "");

// El editor de bocetos pesa (perfect-freehand y la lógica del lienzo): se carga solo al dibujar (ADR-0011).
const EditorBoceto = lazy(() => import("./EditorBoceto"));
// La constancia que firma el cliente (ADR-0024): se carga al pedir la firma.
const HojaDeFirma = lazy(() => import("./HojaDeFirma"));
const claveDeError = (seccion: string, campo: string) => `${seccion}.${campo}`;
/** El campo ocupa su propio paso del recorrido: la firma pone ahí su acción (prototipo aprobado). */
const PasoPropio = createContext(false);

/**
 * Cada escritura en el teléfono pasa por aquí: si una falla (almacenamiento lleno, por ejemplo), la captura lo dice
 * hasta que la siguiente funcione. Sin esto, el técnico seguiría escribiendo en algo que no se guarda.
 */
const VigilarGuardado = createContext<(escritura: Promise<unknown>) => void>(() => undefined);
/** Ancla de un dato en la pantalla: el resumen de errores lleva hasta él. */
const anclaDeDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`;
const anclaDeSeccion = (seccion: string) => `seccion-${seccion}`;
/**
 * Nombre de transición de la cabecera de la captura (iteración 27): el mismo que la tarjeta de su visita en el inicio,
 * para que la tarjeta se convierta en la cabecera. Entre pasos se queda; solo se desliza el cuerpo.
 */
const CabeceraDeLaVisita = createContext<string | undefined>(undefined);

export function Captura({
  id,
  volver,
  alMostrar,
  alDescartar,
  conversacion = false,
  pedirSesion,
}: {
  id: string;
  volver: () => void;
  /** Abrir de una vez el chat con oficina: lo pidió un aviso (ADR-0040). */
  conversacion?: boolean;
  /** Con la captura bloqueada y la sesión vencida, conectarse no basta: se inicia sesión desde aquí (iteración 42). */
  pedirSesion?: () => void;
  /** Ya se ve lo del levantamiento (no el esqueleto): la tarjeta del inicio puede convertirse en la cabecera. */
  alMostrar?: () => void;
  /** Se descartó el borrador (ADR-0035): quien abrió la captura vuelve al inicio y lo dice. */
  alDescartar?: () => void;
}) {
  // `null` distingue "no existe" de `undefined` (cargando).
  const levantamiento = useLiveQuery(async () => (await repositorio.obtener(id)) ?? null, [id]);
  const envio = useLiveQuery(async () => (await db.envios.get(id)) ?? null, [id]);
  const servidor = useLiveQuery(() => estadoDe(db, id), [id]);
  const formatos = useFormatos();
  const [chatAbierto, setChatAbierto] = useState(conversacion);
  const estadoChat = { abierto: chatAbierto, abrir: setChatAbierto };
  // El botón atrás del teléfono hace lo que la flecha de la pantalla (iteración 24c): el borrador dice cuál es.
  const atrasDelBorrador = useRef<(() => void) | null>(null);
  useBotonAtras(() => (atrasDelBorrador.current ?? volver)());
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? visitaDe(db, l.tecnicoId, l.visitaId) : null;
  }, [id]);
  // Vencido el permiso de trabajo local, el borrador se ve pero no se edita (ADR-0009, parte 2).
  const permiso = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    const bajada = l?.tecnicoId ? await db.bajadas.get(l.tecnicoId) : undefined;
    if (!bajada || Date.parse(bajada.permisoLocalHasta) >= Date.now()) return "vigente";
    return bajada.sesionVencida ? "vencido_sin_sesion" : "vencido";
  }, [id]);
  const bloqueado = permiso === undefined ? undefined : permiso !== "vigente";
  // Los campos leen los valores una sola vez; después solo escriben (ver CampoTexto).
  const [inicial, setInicial] = useState<LevantamientoLocal>();
  useEffect(() => {
    if (levantamiento && !inicial) setInicial(levantamiento);
  }, [levantamiento, inicial]);

  const formato = levantamiento && formatos ? formatoDe(formatos, levantamiento) : undefined;
  // Al enviar, el borrador se queda a la vista mientras baja la hoja de confirmar; después la pantalla avanza a
  // "Enviado" en una transición, desde arriba (iteración 27).
  const [retenido, setRetenido] = useState(false);
  const borrador = levantamiento?.estado === "borrador" || (retenido && levantamiento?.estado === "enviado");
  const pantallaEnviado = Boolean(levantamiento && formato && levantamiento.estado === "enviado" && !retenido && envio !== undefined);
  const cargando = levantamiento === undefined || envio === undefined || formatos === undefined || bloqueado === undefined || visita === undefined || (levantamiento !== null && !inicial);
  const mostrado = pantallaEnviado || !cargando;
  useLayoutEffect(() => {
    if (mostrado) alMostrar?.();
  }, [mostrado]);
  const cabecera = levantamiento?.visitaId ? nombreDeTransicion("visita", levantamiento.visitaId) : nombreDeTransicion("lev", id);
  const soltar = () =>
    setTimeout(
      () =>
        void conTransicion(() => {
          setRetenido(false);
          window.scrollTo(0, 0);
        }, "adelante"),
      // Lo que tarda en bajar la hoja de confirmar.
      sinMovimiento() ? 0 : 220,
    );

  // Enviado: la pantalla de éxito del prototipo, con lo enviado debajo.
  if (pantallaEnviado && levantamiento && formato && envio !== undefined) {
    return (
      <div className="min-h-dvh bg-fondo">
        <div className="mx-auto flex max-w-xl items-center px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-1">
          <BotonRedondo icono={ChevronLeft} etiqueta="Volver a mis visitas" onClick={volver} />
        </div>
        <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-10">
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
        </main>
      </div>
    );
  }

  // Un borrador que se puede editar ocupa toda la pantalla con su recorrido (DESIGN.md, campo).
  if (levantamiento && inicial && formato && borrador && bloqueado === false && envio !== undefined) {
    return (
      <CabeceraDeLaVisita.Provider value={cabecera}>
        <div className="min-h-dvh bg-fondo">
          <Borrador
            id={id}
          formato={formato}
          inicial={inicial}
          actual={levantamiento}
          nombre={formatos ? nombreDeFormato(formatos, levantamiento.formato) : "Levantamiento"}
          contexto={visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : levantamiento.lugar ? `${levantamiento.lugar.cliente} · ${levantamiento.lugar.sitio}` : "Levantamiento suelto"}
            volver={volver}
            atras={atrasDelBorrador}
            retener={() => setRetenido(true)}
            soltar={soltar}
            alDescartar={alDescartar ?? volver}
          />
        </div>
      </CabeceraDeLaVisita.Provider>
    );
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-division bg-panel">
        <div className="mx-auto flex max-w-xl items-start gap-1 py-3 pr-4 pl-1">
          <BotonIcono icono={ChevronLeft} etiqueta="Volver a mis visitas" tamano="pequeno" onClick={volver} />
          <div className="flex min-w-0 grow flex-col gap-1 pt-0.5">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{levantamiento && formatos ? nombreDeFormato(formatos, levantamiento.formato) : "Levantamiento"}</h1>
            {visita && (
              <p className="text-ayuda text-texto-secundario">
                {visita.cliente.nombre} · {visita.sitio.nombre}
              </p>
            )}
            {levantamiento && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Insignia tono={borrador ? "borrador" : "enviado"}>{borrador ? "Borrador" : "Enviado"}</Insignia>
                {/* Cada dato se guarda al escribirlo: la hora confirma que nada se pierde si la app se cierra. */}
                {borrador && (
                  <p className="text-ayuda text-texto-secundario" aria-live="polite">
                    Guardado en este teléfono a las {horaExacta(levantamiento.actualizadoEn)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-5">
        {levantamiento === undefined || envio === undefined || formatos === undefined || bloqueado === undefined || (levantamiento && !inicial) ? (
          <EsqueletoBloques etiqueta="Cargando levantamiento" altos={["alto", "medio"]} />
        ) : levantamiento === null || !inicial ? (
          <>
            <Aviso tono="error">Este levantamiento no está en este teléfono.</Aviso>
            <Boton onClick={volver}>Volver a mis visitas</Boton>
          </>
        ) : !formato ? (
          <Aviso tono="error">Falta en este teléfono el formato de este levantamiento. Conéctate para descargarlo; el levantamiento se conserva.</Aviso>
        ) : levantamiento.estado === "enviado" ? (
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
        ) : bloqueado ? (
          <>
            {permiso === "vencido_sin_sesion" && pedirSesion ? (
              <Aviso tono="alerta">
                <p>Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: inicia sesión para seguir.</p>
                <Boton className="mt-3 w-full" onClick={pedirSesion}>
                  Iniciar sesión
                </Boton>
              </Aviso>
            ) : (
              <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>
            )}
            <Enviado levantamiento={levantamiento} formato={formato} envio={null} servidor={null} volver={volver} estadoChat={estadoChat} alDescartar={alDescartar ?? volver} />
          </>
        ) : (
          <EsqueletoBloques etiqueta="Cargando levantamiento" altos={["alto", "medio"]} />
        )}
      </main>
    </div>
  );
}

/** Panel por grupo (DESIGN.md): campos de datos seguidos juntos; cada campo de fotos, bocetos o cantidades aparte. */
function agrupar(campos: readonly DefinicionCampo[]): DefinicionCampo[][] {
  const grupos: DefinicionCampo[][] = [];
  const solo = (c: DefinicionCampo) => c.tipo === "foto" || c.tipo === "boceto" || c.tipo === "cantidades" || c.tipo === "firma";
  for (const campo of campos) {
    const ultimo = grupos.at(-1);
    if (!solo(campo) && ultimo && !solo(ultimo[0]!)) ultimo.push(campo);
    else grupos.push([campo]);
  }
  return grupos;
}

/**
 * Cuánto falta para poder enviar, con la misma validación del envío (dominio): no hay una regla aparte que
 * pueda decir "listo" cuando el envío diría que no.
 */
function progreso(formato: VersionFormato, l: LevantamientoLocal) {
  // Las respuestas de un tablero quitado no se pueden completar ni salen al enviar (iteración 42).
  const limpio = sinRespuestasHuerfanas(l);
  const errores = validarRespuestas(formato, limpio.respuestas, limpio.repeticiones);
  const conError = new Set(errores.map((e) => claveDeError(e.seccion, e.campo ?? "")));
  let obligatorios = 0;
  let completos = 0;
  for (const b of bloques(formato, l.repeticiones ?? {})) {
    for (const c of b.seccion.campos) {
      if (!c.obligatorio) continue;
      obligatorios++;
      if (!conError.has(claveDeError(b.clave, c.clave))) completos++;
    }
  }
  return { errores, obligatorios, completos };
}

/** Lleva al dato del error y le da el foco; si es de una sección (faltan repeticiones), a la sección. */
function irAlError(e: ErrorValidacion) {
  const destino = document.getElementById(e.campo ? anclaDeDato(e.seccion, e.campo) : anclaDeSeccion(leerClave(e.seccion).seccion));
  if (!destino) return;
  destino.scrollIntoView({ block: "center" });
  destino.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea, button:not(:disabled)")?.focus({ preventScroll: true });
}

class FaltanDatos extends Error {}

/** Dónde está el técnico dentro del borrador (DESIGN.md, campo: la visita como recorrido). */
type Vista = { tipo: "recorrido" } | { tipo: "paso"; paso: string } | { tipo: "repeticion"; seccion: string; repeticion: string } | { tipo: "revisar" };

/**
 * Cambiar de pantalla dentro del borrador: la transición la dibuja el navegador (View Transitions) y el
 * movimiento es CSS (regla 10). Solo se desliza el cuerpo; la cabecera y la barra se quedan (iteración 27). Sin
 * soporte, o con movimiento reducido, el cambio es inmediato.
 */
function navegar(direccion: "adelante" | "atras", cambiar: () => void) {
  void conTransicion(() => {
    cambiar();
    window.scrollTo(0, 0);
  }, direccion);
}

/** Los datos que resumen una repetición en su tarjeta: los tres primeros que tienen valor y se leen en una línea. */
function datosDeResumen(seccion: DefinicionSeccion, respuestas: Record<string, Valor> | undefined) {
  const legibles = seccion.campos.filter((c) => c.tipo === "texto" || c.tipo === "medida");
  return legibles
    .filter((c) => respuestas?.[c.clave] !== undefined && !esNoObtenido(respuestas[c.clave]))
    .slice(0, 3)
    // Etiqueta corta en la tarjeta ("Corriente nominal" → "Corriente"); una cuenta sin unidad ("12 und" → "12").
    .map((c) => ({ etiqueta: c.etiqueta.split(" ")[0]!, valor: describirValor(c, respuestas?.[c.clave]).replace(/ und$/, "") }));
}

const faltan = (n: number) => (n === 1 ? "Falta 1 dato" : `Faltan ${n} datos`);

const huellasDe = (valor: Valor | undefined): string[] => (Array.isArray(valor) && valor.every((x) => typeof x === "string") ? (valor as string[]) : []);

/** "Cable UTP × 120 m · Breaker × 4 · 2 más". */
function lineasEnTexto(lineas: ValorCantidades): string {
  if (lineas.length === 0) return "Sin materiales";
  const primeras = lineas.slice(0, 2).map((l) => `${l.descripcion} × ${aDecimalColombiano(l.cantidad)}${l.unidad === "und" ? "" : ` ${l.unidad}`}`);
  return [...primeras, ...(lineas.length > 2 ? [`${lineas.length - 2} más`] : [])].join(" · ");
}

/** Las primeras fotos de un paso, en el repaso; si hay más, cuántas. */
function MiniaturasDeFotos({ huellas }: { huellas: readonly string[] }) {
  const fotos = useUrlsDeFotos(huellas.slice(0, 4));
  return (
    <span className="mt-2 flex gap-1">
      {fotos.map((f) => (
        <img key={f.id} src={f.url} alt="" className="size-10 rounded-[6px] object-cover" />
      ))}
      {huellas.length > 4 && <span className="grid size-10 place-items-center rounded-[6px] bg-panel-hundido text-ayuda font-medium text-texto-secundario">{`+${huellas.length - 4}`}</span>}
    </span>
  );
}

/** La firma en pequeño, en el repaso. */
function MiniaturaDeFirma({ firma }: { firma: ValorFirma }) {
  const documento = useLiveQuery(() => repositorio.obtenerBoceto(firma.firma), [firma.firma]);
  const trazos = documento ? hojasDe(documento)[0] : undefined;
  return (
    <span data-tema="claro" className="mt-2 flex h-10 w-30 items-center rounded-[6px] bg-panel-hundido px-1.5">
      {trazos && <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={`Firma de ${firma.nombre}`} className="max-h-9 w-full" />}
    </span>
  );
}

function Borrador({
  id,
  formato,
  inicial,
  actual,
  nombre,
  contexto,
  volver,
  atras,
  retener,
  soltar,
  alDescartar,
}: {
  id: string;
  formato: VersionFormato;
  inicial: LevantamientoLocal;
  actual: LevantamientoLocal;
  nombre: string;
  contexto: string;
  volver: () => void;
  atras: RefObject<(() => void) | null>;
  /** Mantener el borrador a la vista mientras se envía y baja la hoja de confirmar. */
  retener: () => void;
  /** Ya bajó la hoja: avanzar a "Enviado". */
  soltar: () => void;
  alDescartar: () => void;
}) {
  const pasos = pasosDe(formato);
  const cabecera = useContext(CabeceraDeLaVisita);
  const enLinea = useServidorAlcanzable();
  const porSubir = useLiveQuery(() => db.envios.filter((e) => e.estado !== "recibido").count(), []);
  // Qué datos ya se le señalaron al técnico (al tocar «Siguiente» o «Enviar»): lo que se muestra sale siempre de la
  // validación de ahora, así un tablero quitado o una foto devuelta con «Deshacer» dejan de pedirse (iteración 42).
  const [senalados, setSenalados] = useState<ReadonlySet<string> | null>(null);
  // Lo que rechazó el envío y la validación no ve (un croquis que pesa demasiado): se va al volver a guardar ese dato.
  const [delEnvio, setDelEnvio] = useState<readonly ErrorValidacion[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  // El paso cuya hoja de «Falta…» está abierta; lo que lista sale de la validación de ahora, como el resto (iteración 42).
  const [faltantesDelPaso, setFaltantesDelPaso] = useState<{ pasoId: string } | null>(null);
  // Cada intento de enviar con datos pendientes sacude la lista de lo que falta.
  const [sacudir, setSacudir] = useState(0);
  // Los pasos por los que ya pasó el técnico en esta sesión: pasar un paso sin nada obligatorio lo da por hecho.
  const [visitados, setVisitados] = useState<ReadonlySet<string>>(new Set());
  // Un levantamiento recién empezado abre en su primer paso; uno con datos, en el recorrido.
  const [vista, setVista] = useState<Vista>(() =>
    Object.values(inicial.respuestas).every((r) => Object.keys(r ?? {}).length === 0) && Object.values(inicial.repeticiones ?? {}).every((l) => l.length === 0)
      ? { tipo: "paso", paso: pasos[0]!.id }
      : { tipo: "recorrido" },
  );
  const resumen = useRef<HTMLDivElement>(null);
  const [noGuardo, setNoGuardo] = useState(false);
  const vigilar = (escritura: Promise<unknown>) =>
    void escritura.then(
      () => setNoGuardo(false),
      (error: unknown) => {
        // El técnico ve qué hacer; soporte necesita la causa (ADR-0017).
        console.error("No se pudo guardar en el teléfono", error);
        setNoGuardo(true);
      },
    );
  const { errores: validacion, obligatorios, completos } = progreso(formato, actual);
  const bloquesVigentes = new Set(bloques(formato, actual.repeticiones ?? {}).map((b) => b.clave));
  const pendientes = [...validacion, ...delEnvio.filter((e) => bloquesVigentes.has(e.seccion))];
  const errores = senalados ? pendientes.filter((e) => senalados.has(claveDeError(e.seccion, e.campo ?? ""))) : null;
  const porClave: ReadonlyMap<string, CodigoErrorValidacion> = new Map((errores ?? []).map((e) => [claveDeError(e.seccion, e.campo ?? ""), e.codigo]));
  const avance = obligatorios > 0 ? completos / obligatorios : pendientes.length === 0 ? 1 : 0;
  const repeticiones = actual.repeticiones ?? {};

  // Lo que falta, por paso y por repetición: el recorrido y las tarjetas lo dicen antes de enviar.
  const faltanEnRepeticion = new Map<string, number>();
  const faltanEnPaso = new Map<string, number>();
  const pasoDeError = (e: ErrorValidacion) => {
    const { seccion } = leerClave(e.seccion);
    return pasos.find((p) => p.seccion.clave === seccion && (p.seccion.repetible || !e.campo || p.campos.some((c) => c.clave === e.campo))) ?? pasos.find((p) => p.seccion.clave === seccion);
  };
  for (const e of pendientes) {
    const paso = pasoDeError(e);
    if (paso) faltanEnPaso.set(paso.id, (faltanEnPaso.get(paso.id) ?? 0) + 1);
    if (leerClave(e.seccion).repeticion) faltanEnRepeticion.set(e.seccion, (faltanEnRepeticion.get(e.seccion) ?? 0) + 1);
  }
  const faltanDe = (p: Paso) => faltanEnPaso.get(p.id) ?? 0;
  const tocado = (p: Paso) =>
    p.seccion.repetible ? (repeticiones[p.seccion.clave]?.length ?? 0) > 0 : p.campos.some((c) => actual.respuestas[p.seccion.clave]?.[c.clave] !== undefined);
  const hecho = (p: Paso) => faltanDe(p) === 0 && (tocado(p) || visitados.has(p.id));
  const actualEnRecorrido = pasos.find((p) => !hecho(p));
  const hechos = pasos.filter(hecho).length;

  function estadoDe(p: Paso): EstadoDePaso {
    if (p === actualEnRecorrido) return errores && faltanDe(p) > 0 ? "falta" : "actual";
    if (hecho(p)) return "hecho";
    return errores && faltanDe(p) > 0 ? "falta" : "pendiente";
  }

  function detalleDe(p: Paso) {
    const n = faltanDe(p);
    if (p.seccion.repetible) {
      const cuantas = repeticiones[p.seccion.clave]?.length ?? 0;
      const etiqueta = p.seccion.repetible.etiqueta.toLowerCase();
      const lista = cuantas === 0 ? `Ningún ${etiqueta} todavía` : cuantas === 1 ? `1 ${etiqueta}` : `${cuantas} · ${p.seccion.titulo}`;
      return n > 0 ? `${lista} · ${faltan(n).toLowerCase()}` : lista;
    }
    if (n > 0) return faltan(n);
    if (tocado(p)) return "Completo";
    return visitados.has(p.id) ? "Sin datos" : p.titulo === p.seccion.titulo ? "Sin datos todavía" : p.seccion.titulo;
  }

  /** Lo que lleva un paso, en una línea, para el repaso antes de enviar (iteración 32). */
  function resumenDe(p: Paso): string {
    if (p.seccion.repetible) {
      const lista = repeticiones[p.seccion.clave] ?? [];
      return lista.length === 0 ? `Ningún ${p.seccion.repetible.etiqueta.toLowerCase()}` : `${lista.length} · ${lista.map((r) => r.nombre).join(", ")}`;
    }
    const partes = p.campos.flatMap((c) => {
      const v = actual.respuestas[p.seccion.clave]?.[c.clave];
      if (v === undefined) return [];
      if (c.tipo === "cantidades" && esCantidades(v)) return [lineasEnTexto(v)];
      if (esFirma(v)) return [`${v.nombre}${v.cargo ? ` · ${v.cargo}` : ""}`];
      if (esBoceto(v)) return ["Dibujado"];
      return [describirValor(c, v)];
    });
    return partes.length > 0 ? partes.slice(0, 3).join(" · ") : "Sin datos";
  }

  /** Fotos, repeticiones y materiales: lo que se envía en números, solo lo que el formato tiene. */
  function cifrasDelBorrador() {
    const cifras = [{ valor: fotosDelBorrador, texto: fotosDelBorrador === 1 ? "foto" : "fotos" }];
    for (const p of pasos)
      if (p.seccion.repetible) cifras.push({ valor: repeticiones[p.seccion.clave]?.length ?? 0, texto: p.seccion.titulo.toLowerCase() });
    const lineas = pasos.flatMap((p) => p.campos.filter((c) => c.tipo === "cantidades").map((c) => actual.respuestas[p.seccion.clave]?.[c.clave]));
    if (lineas.length > 0) {
      const total = lineas.reduce<number>((suma, v) => suma + (esCantidades(v) ? v.length : 0), 0);
      cifras.push({ valor: total, texto: total === 1 ? "material" : "materiales" });
    }
    return cifras.slice(0, 3);
  }

  const ir = (destino: Vista, direccion: "adelante" | "atras" = "adelante") => navegar(direccion, () => setVista(destino));
  const recorrido = () => ir({ tipo: "recorrido" }, "atras");
  // Lo mismo que la flecha de cada vista: del paso o de Revisar al recorrido, de un tablero a su paso, del recorrido a mis visitas.
  atras.current = vista.tipo === "recorrido" ? volver : vista.tipo === "repeticion" ? () => ir({ tipo: "paso", paso: vista.seccion }, "atras") : recorrido;
  useEffect(() => () => void (atras.current = null), [atras]);
  const despuesDe = (pasoId: string): Vista => {
    const siguiente = pasos[pasos.findIndex((p) => p.id === pasoId) + 1];
    return siguiente ? { tipo: "paso", paso: siguiente.id } : { tipo: "revisar" };
  };
  /**
   * "Siguiente" con datos obligatorios vacíos no pasa en silencio: se marcan en rojo en el paso y sube una hoja
   * que dice cuáles son, con "Completar ahora" o seguir y volver después (Cleo, BitePal en Mobbin).
   */
  const avanzarDesde = (pasoId: string, aunQueFalte = false) => {
    const lista = pendientes.filter((e) => pasoDeError(e)?.id === pasoId);
    if (lista.length > 0 && !aunQueFalte) {
      setSenalados((previos) => new Set([...(previos ?? []), ...lista.map((e) => claveDeError(e.seccion, e.campo ?? ""))]));
      setFaltantesDelPaso({ pasoId });
      return;
    }
    setFaltantesDelPaso(null);
    setVisitados((v) => new Set(v).add(pasoId));
    ir(despuesDe(pasoId));
  };
  const datoFaltante = (e: ErrorValidacion, alIr: () => void): DatoFaltante => {
    const ruta = (e.campo ? nombreDeDato(formato, repeticiones, e.seccion, e.campo) : rutaLegible(formato, repeticiones, e.seccion)).split(" · ");
    // No falta: pesa demasiado. El dato dice por qué, porque el croquis abre su editor sin espacio para el aviso.
    const donde = e.codigo === "archivo_muy_grande" ? mensajeDeValidacion.archivo_muy_grande : ruta.slice(0, -1).join(" · ") || undefined;
    return { clave: `${claveDeError(e.seccion, e.campo ?? "")}:${e.codigo}`, titulo: ruta.at(-1)!, donde, ir: alIr };
  };

  // Al corregir, el error de ese campo se va: la validación completa se repite al enviar.
  const alGuardar = (seccion: string, campo: string) => {
    const clave = claveDeError(seccion, campo);
    if (senalados?.has(clave)) {
      setSenalados((previos) => {
        const siguen = new Set(previos);
        siguen.delete(clave);
        return siguen;
      });
    }
    if (delEnvio.some((e) => claveDeError(e.seccion, e.campo ?? "") === clave)) setDelEnvio((lista) => lista.filter((e) => claveDeError(e.seccion, e.campo ?? "") !== clave));
  };

  /** Del resumen de errores al dato: abre su paso (o su repetición) y lo enfoca. */
  function irAlDato(e: ErrorValidacion) {
    const { seccion, repeticion } = leerClave(e.seccion);
    const paso = pasoDeError(e);
    ir(repeticion && e.campo ? { tipo: "repeticion", seccion, repeticion } : { tipo: "paso", paso: paso?.id ?? pasos[0]!.id });
    setTimeout(() => irAlError(e), 350);
  }

  function mostrarErrores(lista: readonly ErrorValidacion[]) {
    setSenalados(new Set(lista.map((e) => claveDeError(e.seccion, e.campo ?? ""))));
    const deLaValidacion = new Set(validacion.map((e) => `${claveDeError(e.seccion, e.campo ?? "")}:${e.codigo}`));
    setDelEnvio(lista.filter((e) => !deLaValidacion.has(`${claveDeError(e.seccion, e.campo ?? "")}:${e.codigo}`)));
    setSacudir((n) => n + 1);
    if (vista.tipo !== "revisar") ir({ tipo: "revisar" });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      resumen.current?.focus({ preventScroll: true });
    });
  }

  function intentarEnviar() {
    if (pendientes.length > 0) mostrarErrores(pendientes);
    else setConfirmando(true);
  }

  async function enviar() {
    retener();
    const resultado = await repositorio.enviar(id, formato, new Date());
    if (resultado.ok) {
      sincronizarEnSegundoPlano();
      soltar();
      return;
    }
    if (resultado.motivo === "respuestas_invalidas") {
      mostrarErrores(resultado.errores);
      throw new FaltanDatos();
    }
    throw new Error(resultado.motivo);
  }

  const campos = (lista: readonly DefinicionCampo[], clave: string) =>
    lista.map((campo) => (
      <Campo
        // Con la sección: dos pasos seguidos con un campo de la misma clave no comparten lo escrito (iteración 42).
        key={`${clave}.${campo.clave}`}
        id={id}
        seccion={clave}
        campo={campo}
        // Cada paso y cada tablero montan sus campos al abrirse: parten de lo guardado, no de lo que había al abrir el
        // borrador. Si no, volver a un paso lo mostraba vacío y agregar un material borraba los demás (iteración 42).
        inicial={actual.respuestas[clave]?.[campo.clave]}
        actual={actual.respuestas[clave]?.[campo.clave]}
        error={porClave.get(claveDeError(clave, campo.clave))}
        alGuardar={() => alGuardar(clave, campo.clave)}
      />
    ));
  const total = pasos.length + 1;
  const fotosDelBorrador = fotosReferenciadas(sinRespuestasHuerfanas(actual).respuestas).length;
  const contador = `${hechos}/${pasos.length}`;

  let pantalla: ReactNode;
  if (vista.tipo === "recorrido") {
    pantalla = (
      <>
        <EncabezadoDePaso transicion={cabecera} contexto={contexto} avance={avance} volver={volver} etiquetaVolver="Volver a mis visitas" />
        <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-3 pb-40">
          {/* Cada dato se guarda al escribirlo: la hora confirma que nada se pierde si la app se cierra. */}
          <FranjaSincronizacion enLinea={enLinea} porSubir={porSubir ?? 0} guardado={`Guardado en este teléfono a las ${soloHora.format(new Date(actual.actualizadoEn))}`} />
          <div className="flex flex-col gap-1">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">El recorrido</h1>
            <p className="text-ayuda text-texto-secundario">{nombre}</p>
          </div>
          <nav aria-label="Recorrido de la visita">
            <ListaRecorrido>
              {pasos.map((p, i) => (
                <PasoDelRecorrido key={p.id} numero={i + 1} titulo={p.titulo} detalle={detalleDe(p)} estado={estadoDe(p)} onClick={() => ir({ tipo: "paso", paso: p.id })} />
              ))}
              <PasoDelRecorrido
                numero={total}
                titulo="Revisar y enviar"
                detalle={pendientes.length === 0 ? "Listo para enviar" : "Último vistazo antes de oficina"}
                estado={actualEnRecorrido ? "pendiente" : "actual"}
                ultimo
                onClick={() => ir({ tipo: "revisar" })}
              />
            </ListaRecorrido>
          </nav>
          {/* Al final y discreto: no se toca por error (ADR-0035). Con un toque, la hoja dice qué pasa con las fotos. */}
          <button
            type="button"
            onClick={() => setDescartando(true)}
            className="inline-flex min-h-tactil items-center gap-2 self-center rounded-control px-3 text-cuerpo font-medium text-error focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-4"
          >
            <Trash aria-hidden />
            Descartar levantamiento
          </button>
        </main>
        <BarraDePaso>
          <BotonSiguiente onClick={() => ir(actualEnRecorrido ? { tipo: "paso", paso: actualEnRecorrido.id } : { tipo: "revisar" })}>
            {actualEnRecorrido ? `Seguir con ${actualEnRecorrido.titulo.toLowerCase()}` : "Revisar y enviar"}
          </BotonSiguiente>
        </BarraDePaso>
      </>
    );
  } else if (vista.tipo === "paso") {
    const i = Math.max(0, pasos.findIndex((p) => p.id === vista.paso));
    const paso = pasos[i]!;
    const siguiente = despuesDe(paso.id);
    const titulo = siguiente.tipo === "paso" ? pasos.find((p) => p.id === siguiente.paso)!.titulo : "";
    const croquis = paso.campos.length === 1 && paso.campos[0]!.tipo === "boceto" ? paso.campos[0]! : undefined;
    pantalla = croquis ? (
      // El croquis es el paso entero: el editor a pantalla completa, con "Listo" para seguir (prototipo aprobado).
      <PasoCroquis
        id={id}
        seccion={paso.seccion.clave}
        campo={croquis}
        actual={actual.respuestas[paso.seccion.clave]?.[croquis.clave]}
        alGuardar={() => alGuardar(paso.seccion.clave, croquis.clave)}
        volver={recorrido}
        listo={() => avanzarDesde(paso.id)}
      />
    ) : (
      <>
        <EncabezadoDePaso transicion={cabecera} contexto={`Paso ${i + 1} de ${total} · ${paso.seccion.titulo}`} avance={avance} volver={recorrido} etiquetaVolver="Ver el recorrido" contador={contador} alContador={recorrido} />
        <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-3 pb-40">
          <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{paso.titulo}</h1>
          {paso.seccion.repetible ? (
            <Repeticiones
              id={id}
              formato={formato}
              seccion={paso.seccion}
              actual={actual}
              faltanEn={faltanEnRepeticion}
              error={porClave.get(claveDeError(paso.seccion.clave, ""))}
              alGuardar={alGuardar}
              abrir={(r) => ir({ tipo: "repeticion", seccion: paso.seccion.clave, repeticion: r })}
            />
          ) : (
            <PasoPropio.Provider value={paso.campos.length === 1}>{campos(paso.campos, paso.seccion.clave)}</PasoPropio.Provider>
          )}
        </main>
        {/* Sin firma, la acción del paso es entregar el teléfono (la pone la firma). */}
        {!(paso.campos.length === 1 && paso.campos[0]!.tipo === "firma" && !esFirma(actual.respuestas[paso.seccion.clave]?.[paso.campos[0]!.clave])) && (
          <BarraDePaso>
            <BotonSiguiente onClick={() => avanzarDesde(paso.id)}>{siguiente.tipo === "paso" ? `Siguiente: ${titulo.toLowerCase()}` : "Revisar y enviar"}</BotonSiguiente>
          </BarraDePaso>
        )}
      </>
    );
  } else if (vista.tipo === "repeticion") {
    const seccion = formato.secciones.find((s) => s.clave === vista.seccion)!;
    const lista = repeticiones[seccion.clave] ?? [];
    const r = lista.find((x) => x.id === vista.repeticion);
    const alPaso = () => ir({ tipo: "paso", paso: seccion.clave }, "atras");
    pantalla = r ? (
      <Repeticion
        key={r.id}
        id={id}
        seccion={seccion}
        repeticion={r}
        posicion={{ indice: lista.indexOf(r), total: lista.length }}
        siguiente={lista[lista.indexOf(r) + 1]}
        avance={avance}
        error={porClave.get(claveDeError(seccion.clave, ""))}
        volver={alPaso}
        abrirSiguiente={() => ir({ tipo: "repeticion", seccion: seccion.clave, repeticion: lista[lista.indexOf(r) + 1]!.id })}
      >
        {campos(seccion.campos, claveDeRepeticion(seccion.clave, r.id))}
      </Repeticion>
    ) : (
      // Se quitó (o no existe): de vuelta a la lista de su sección.
      <>
        <EncabezadoDePaso transicion={cabecera} contexto={seccion.titulo} avance={avance} volver={alPaso} etiquetaVolver={`Volver a ${seccion.titulo.toLowerCase()}`} />
        <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-3">
          <Boton onClick={alPaso}>{`Volver a ${seccion.titulo.toLowerCase()}`}</Boton>
        </main>
      </>
    );
  } else {
    pantalla = (
      <>
        <EncabezadoDePaso transicion={cabecera} contexto={`Paso ${total} de ${total} · Revisar`} avance={avance} volver={recorrido} etiquetaVolver="Ver el recorrido" contador={contador} alContador={recorrido} />
        <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-3 pb-40">
          <div className="flex flex-col gap-1">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">Revisa y envía</h1>
            <p className="text-cuerpo font-medium">{contexto}</p>
            <p className="text-ayuda text-texto-secundario">{nombre}</p>
          </div>
          <CifrasDeRepaso cifras={cifrasDelBorrador()} />
          {errores && errores.length > 0 && (
            <div ref={resumen} tabIndex={-1} className="focus:outline-none">
              <ListaFaltantes
                sacudir={sacudir}
                titulo={errores.length === 1 ? "Falta 1 dato por completar" : `Faltan ${errores.length} datos por completar`}
                datos={errores.map((e) => datoFaltante(e, () => irAlDato(e)))}
              />
            </div>
          )}
          <Repaso etiqueta="Lo que se envía">
            {pasos.map((p) => {
              const n = faltanDe(p);
              const fotosDelPaso = p.seccion.repetible ? [] : p.campos.filter((c) => c.tipo === "foto").flatMap((c) => huellasDe(actual.respuestas[p.seccion.clave]?.[c.clave]));
              const firma = p.seccion.repetible ? undefined : p.campos.map((c) => actual.respuestas[p.seccion.clave]?.[c.clave]).find(esFirma);
              return (
                <FilaDeRepaso key={p.id} titulo={p.titulo} detalle={resumenDe(p)} falta={n > 0 ? faltan(n) : undefined} vacio={!tocado(p)} onEditar={() => ir({ tipo: "paso", paso: p.id }, "atras")}>
                  {fotosDelPaso.length > 0 && <MiniaturasDeFotos huellas={fotosDelPaso} />}
                  {firma && <MiniaturaDeFirma firma={firma} />}
                </FilaDeRepaso>
              );
            })}
          </Repaso>
        </main>
        <BarraDePaso>
          <div className="flex w-full flex-col gap-2">
            <BotonSiguiente icono={Send} onClick={intentarEnviar}>
              Enviar a oficina
            </BotonSiguiente>
            {/* La consecuencia, junto a la acción que la causa (iteración 32). */}
            <p className="text-center text-ayuda text-texto-secundario">{`Después solo oficina puede corregirlo · ${enLinea ? "sale ahora" : "sin señal, sale al volver la señal"}`}</p>
          </div>
        </BarraDePaso>
      </>
    );
  }

  const pasoConFaltantes = faltantesDelPaso ? pasos.find((p) => p.id === faltantesDelPaso.pasoId) : undefined;
  const faltanDelPaso = pasoConFaltantes ? pendientes.filter((e) => pasoDeError(e)?.id === pasoConFaltantes.id) : [];
  // Completado con la hoja abierta (un «Deshacer» la alcanza): ya no hay nada que decir y la hoja se va.
  useEffect(() => {
    if (faltantesDelPaso && faltanDelPaso.length === 0) setFaltantesDelPaso(null);
  }, [faltantesDelPaso, faltanDelPaso.length]);
  return (
    <VigilarGuardado.Provider value={vigilar}>
      {pantalla}
      {/* Fijo arriba: el técnico puede estar lejos del principio de la página cuando falla. */}
      {noGuardo && (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto max-w-xl shadow-menu">
          <Aviso tono="error">
            <b>No se pudo guardar en este teléfono.</b> Lo último que escribiste puede no estar guardado. Revisa que el teléfono tenga espacio libre y vuelve a escribirlo.
          </Aviso>
        </div>
      )}
      {faltantesDelPaso && pasoConFaltantes && faltanDelPaso.length > 0 && (
        <Dialogo
          forma="inferior"
          icono={CircleAlert}
          titulo={faltanDelPaso.length === 1 ? `Falta 1 dato en ${pasoConFaltantes.titulo.toLowerCase()}` : `Faltan ${faltanDelPaso.length} datos en ${pasoConFaltantes.titulo.toLowerCase()}`}
          subtitulo="Son obligatorios para enviar. Puedes completarlos ahora o volver después."
          alCerrar={() => setFaltantesDelPaso(null)}
          pie={
            <>
              <Boton onClick={() => avanzarDesde(faltantesDelPaso.pasoId, true)}>Seguir y completar después</Boton>
              <Boton
                variante="principal"
                onClick={() => {
                  const primero = faltanDelPaso[0]!;
                  setFaltantesDelPaso(null);
                  setTimeout(() => irAlError(primero), 250);
                }}
              >
                Completar ahora
              </Boton>
            </>
          }
        >
          <ul className="flex flex-col gap-2">
            {faltanDelPaso.map((e, i) => {
              const d = datoFaltante(e, () => {
                setFaltantesDelPaso(null);
                setTimeout(() => irAlError(e), 250);
              });
              return (
                <li key={d.clave} className="motion-safe:animate-subir" style={{ animationDelay: `${i * 70}ms` }}>
                  <button type="button" onClick={d.ir} className="flex w-full items-center gap-3 rounded-control bg-peligro-fondo px-3.5 py-3 text-left active:scale-[0.98]">
                    <CircleAlert aria-hidden className="size-5 shrink-0 text-error" />
                    <span className="flex min-w-0 grow flex-col">
                      <strong className="text-cuerpo">{d.titulo}</strong>
                      {d.donde && <span className="text-ayuda text-texto-secundario">{d.donde}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialogo>
      )}
      {descartando && (
        <Confirmacion
          nivel="irreversible"
          forma="inferior"
          titulo="¿Descartar este levantamiento?"
          confirmar="Descartar"
          descartar="Volver"
          accion={() => repositorio.descartar(id, new Date())}
          mensajeDeError={() => "No se pudo descartar. Intenta de nuevo."}
          alCerrar={() => setDescartando(false)}
          alTerminar={alDescartar}
          consecuencias={[
            { icono: Smartphone, texto: "Sale de Mis visitas", ...(actual.visitaId ? { detalle: "La visita queda sin levantamiento: se puede iniciar otro" } : {}) },
            { icono: Trash, texto: "Queda 30 días en Descartados, en tu cuenta", detalle: "De ahí lo recuperas con todo lo que tenía" },
            {
              icono: TriangleAlert,
              texto: `Después se borra del teléfono${fotosDelBorrador > 0 ? ` con ${fotosDelBorrador === 1 ? "su foto" : `sus ${fotosDelBorrador} fotos`}` : ""}`,
              detalle: "Oficina nunca lo recibió: no queda otra copia",
            },
          ]}
        />
      )}
      {confirmando && (
        <Confirmacion
          nivel="consecuencia"
          forma="inferior"
          titulo="¿Enviar a oficina?"
          confirmar="Enviar levantamiento"
          accion={enviar}
          mensajeDeError={(e) => (e instanceof FaltanDatos ? "Faltan datos por completar. Cierra y revisa la lista de arriba." : "No se pudo enviar. Intenta de nuevo.")}
          alCerrar={() => setConfirmando(false)}
        >
          <p>Después de enviar ya no podrás editar este levantamiento. Oficina lo revisará.</p>
        </Confirmacion>
      )}
    </VigilarGuardado.Provider>
  );
}

/**
 * Sección repetible (iteración 9) como lista de tarjetas: cada repetición resumida con su estado; tocarla la
 * abre. Agregar también es parte del borrador: se guarda en el teléfono al instante y abre la nueva.
 */
function Repeticiones({
  id,
  formato,
  seccion,
  actual,
  faltanEn,
  error,
  alGuardar,
  abrir,
}: {
  id: string;
  formato: VersionFormato;
  seccion: DefinicionSeccion;
  actual: LevantamientoLocal;
  faltanEn: ReadonlyMap<string, number>;
  error: CodigoErrorValidacion | undefined;
  alGuardar: (seccion: string, campo: string) => void;
  abrir: (repeticion: string) => void;
}) {
  const lista = actual.repeticiones?.[seccion.clave] ?? [];
  // Solo la tarjeta recién agregada entra animada: las demás no se animan otra vez al volver (iteración 27).
  const esNueva = useLoNuevo(lista.map((r) => r.id));
  const etiqueta = seccion.repetible!.etiqueta;
  const maximo = seccion.repetible!.max ?? LIMITES.repeticiones;

  const vigilar = useContext(VigilarGuardado);
  // Un doble toque agrega una sola.
  const [agregar] = useSinRepetir(async () => {
    const escritura = repositorio.agregarRepeticion(id, formato, seccion.clave, new Date());
    vigilar(escritura);
    try {
      await escritura;
    } catch {
      return;
    }
    alGuardar(seccion.clave, "");
    const nueva = (await repositorio.obtener(id))?.repeticiones?.[seccion.clave]?.at(-1);
    if (nueva) abrir(nueva.id);
  });

  return (
    <section aria-label={seccion.titulo} className="flex flex-col gap-3">
      {error && <Aviso tono="error">{mensajeDeValidacion[error]}</Aviso>}
      {lista.length === 0 && <p className="text-cuerpo text-texto-secundario">{`Agrega uno por cada ${etiqueta.toLowerCase()} que revises. Si no aplica, sigue.`}</p>}
      {lista.length > 0 && (
        <>
          <p className="-mt-5 text-ayuda text-texto-secundario">{`${lista.filter((r) => (faltanEn.get(claveDeRepeticion(seccion.clave, r.id)) ?? 0) === 0).length} de ${lista.length} completos`}</p>
          <ListaDeRepeticiones etiqueta={seccion.titulo}>
            {lista.map((r) => {
              const clave = claveDeRepeticion(seccion.clave, r.id);
              return <FilaDeTablero key={r.id} seccion={seccion} nombre={r.nombre} respuestas={actual.respuestas[clave]} faltan={faltanEn.get(clave) ?? 0} nueva={esNueva(r.id)} onClick={() => abrir(r.id)} />;
            })}
          </ListaDeRepeticiones>
        </>
      )}
      <BotonAgregar icono={Plus} disabled={lista.length >= maximo} onClick={() => void agregar()}>
        {`Agregar ${etiqueta.toLowerCase()}`}
      </BotonAgregar>
      {lista.length >= maximo && <p className="text-ayuda text-texto-secundario">{`Este formato permite hasta ${maximo}.`}</p>}
    </section>
  );
}

/**
 * Una fila de la lista de repeticiones (iteración 32): su primera foto, lo que la identifica en una línea y cuánto
 * lleva de lo obligatorio.
 */
function FilaDeTablero({ seccion, nombre, respuestas, faltan: n, nueva, onClick }: { seccion: DefinicionSeccion; nombre: string; respuestas: Record<string, Valor> | undefined; faltan: number; nueva: boolean; onClick: () => void }) {
  const huellas = seccion.campos.filter((c) => c.tipo === "foto").flatMap((c) => (Array.isArray(respuestas?.[c.clave]) ? (respuestas![c.clave] as string[]) : []));
  const [primera] = useUrlsDeFotos(huellas.slice(0, 1));
  const obligatorios = seccion.campos.filter((c) => c.obligatorio).length;
  const detalle = [...datosDeResumen(seccion, respuestas).slice(0, 2).map((d) => d.valor), huellas.length === 0 ? "Sin fotos" : fotosEnTexto(huellas.length)].join(" · ");
  return <FilaDeRepeticion titulo={nombre} detalle={detalle} foto={primera?.url} faltan={n} avance={obligatorios === 0 ? 1 : (obligatorios - n) / obligatorios} nueva={nueva} onClick={onClick} />;
}

const fotosEnTexto = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

/**
 * Una repetición abierta (iteración 32): su nombre es el título; cambiarlo y quitarla van en el menú de arriba, lejos
 * del pulgar. Abajo, la siguiente sin volver a la lista; en la última, de vuelta a la lista.
 */
function Repeticion({
  id,
  seccion,
  repeticion,
  posicion,
  siguiente,
  avance,
  error,
  volver,
  abrirSiguiente,
  children,
}: {
  id: string;
  seccion: DefinicionSeccion;
  repeticion: { id: string; nombre: string };
  /** Cuál es (desde 0) y cuántas hay. */
  posicion: { indice: number; total: number };
  siguiente: { id: string; nombre: string } | undefined;
  avance: number;
  error: CodigoErrorValidacion | undefined;
  volver: () => void;
  abrirSiguiente: () => void;
  children: ReactNode;
}) {
  const vigilar = useContext(VigilarGuardado);
  const notificar = useNotificar();
  const cabecera = useContext(CabeceraDeLaVisita);
  const etiqueta = seccion.repetible!.etiqueta;
  const errorDeNombre = error === "nombre_de_repeticion_invalido";
  const [renombrando, setRenombrando] = useState(errorDeNombre);

  /**
   * Quitar es al instante y se deshace desde la notificación (DESIGN.md, iteración 24c): está en el teléfono, así que
   * "Deshacer" lo devuelve a su lugar con lo escrito. Las fotos siguen guardadas mientras tanto.
   */
  async function quitar() {
    const escritura = repositorio.quitarRepeticion(id, seccion.clave, repeticion.id, new Date());
    vigilar(escritura);
    const quitada = await escritura.catch(() => undefined);
    volver();
    if (!quitada) return;
    notificar({
      texto: `${repeticion.nombre} quitado`,
      accion: {
        texto: "Deshacer",
        alHacer: () => vigilar(repositorio.restaurarRepeticion(id, seccion.clave, quitada.repeticion, quitada.posicion, quitada.respuestas, new Date())),
      },
    });
  }
  return (
    <>
      <EncabezadoDePaso transicion={cabecera} contexto={`${seccion.titulo} · ${posicion.indice + 1} de ${posicion.total}`} avance={avance} volver={volver} etiquetaVolver={`Volver a ${seccion.titulo.toLowerCase()}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-3 pb-40">
        {renombrando ? (
          <CampoTexto
            etiqueta={`Nombre del ${etiqueta.toLowerCase()}`}
            valorInicial={repeticion.nombre}
            error={errorDeNombre ? mensajeDeValidacion.nombre_de_repeticion_invalido : undefined}
            onCambio={(texto) => {
              // Un nombre vacío no se guarda: se conserva el anterior.
              if (texto.trim()) vigilar(repositorio.renombrarRepeticion(id, seccion.clave, repeticion.id, texto.trim(), new Date()));
            }}
          />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{repeticion.nombre}</h1>
            <MenuAcciones
              etiqueta={`Opciones de ${repeticion.nombre}`}
              opciones={[
                { texto: "Cambiar nombre", icono: Pencil, alElegir: () => setRenombrando(true) },
                { texto: `Quitar ${etiqueta.toLowerCase()}`, icono: Trash, peligro: true, alElegir: () => void quitar() },
              ]}
            />
          </div>
        )}
        <article aria-label={repeticion.nombre} className="flex flex-col gap-8">
          {children}
        </article>
      </main>
      <BarraDePaso>
        {renombrando ? (
          <BotonSiguiente icono={Check} onClick={() => setRenombrando(false)}>
            Listo
          </BotonSiguiente>
        ) : siguiente ? (
          <div className="flex w-full flex-col gap-1">
            <BotonSiguiente onClick={abrirSiguiente}>{`Siguiente: ${siguiente.nombre}`}</BotonSiguiente>
            <Boton variante="fantasma" className="w-full" onClick={volver}>
              Volver a la lista
            </Boton>
          </div>
        ) : (
          <BotonSiguiente icono={Check} onClick={volver}>
            {posicion.total === 1 ? `Listo, ver ${seccion.titulo.toLowerCase()}` : `Listo, ver los ${posicion.total}`}
          </BotonSiguiente>
        )}
      </BarraDePaso>
    </>
  );
}

interface PropsCampo {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  inicial: Valor | undefined;
  actual: Valor | undefined;
  error: CodigoErrorValidacion | undefined;
  alGuardar: () => void;
}

function Campo(props: PropsCampo) {
  // El ancla deja que el resumen de errores lleve hasta este dato.
  return (
    <div id={anclaDeDato(props.seccion, props.campo.clave)} className="scroll-mt-24">
      <ContenidoDeCampo {...props} />
    </div>
  );
}

function ContenidoDeCampo({ id, seccion, campo, inicial: alAbrir, actual, error, alGuardar }: PropsCampo) {
  const notificar = useNotificar();
  const vigilar = useContext(VigilarGuardado);
  const guardar = (valor: Valor | undefined) => {
    alGuardar();
    vigilar(repositorio.guardarRespuesta(id, seccion, campo.clave, valor, new Date()));
  };
  // Los controles escriben sobre lo que muestran; cuando la marca (o su "Deshacer") reemplaza el dato, se vuelven
  // a montar con lo guardado, para que nunca muestren un valor que ya no está.
  const [desde, setDesde] = useState({ vez: 0, valor: alAbrir });
  const inicial = desde.valor;
  const reemplazar = (valor: Valor | undefined) => {
    guardar(valor);
    setDesde((d) => ({ vez: d.vez + 1, valor }));
  };
  const noObtenido = esNoObtenido(actual);
  const mensaje = error ? mensajeDeValidacion[error] : undefined;
  const errorDeMotivo = error === "motivo_requerido" ? mensaje : undefined;
  const errorDelCampo = error === "motivo_requerido" ? undefined : mensaje;

  const control = (() => {
    switch (campo.tipo) {
      case "texto":
        return (
          <CampoTexto
            etiqueta={campo.etiqueta}
            obligatorio={campo.obligatorio}
            error={noObtenido ? undefined : errorDelCampo}
            deshabilitado={noObtenido}
            valorInicial={typeof inicial === "string" ? inicial : ""}
            largo={campo.largo}
            valoresComunes={campo.valoresComunes}
            onCambio={(texto) => guardar(texto === "" ? undefined : texto)}
          />
        );
      case "medida": {
        const medida = inicial && !esNoObtenido(inicial) && typeof inicial === "object" && "valor" in inicial ? (inicial as ValorMedida) : undefined;
        return (
          <CampoMedida
            etiqueta={campo.etiqueta}
            obligatorio={campo.obligatorio}
            error={noObtenido ? undefined : errorDelCampo}
            deshabilitado={noObtenido}
            unidades={campo.unidades}
            valoresComunes={campo.valoresComunes}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                guardar(undefined);
                return true;
              }
              const valor = crearMedida(texto, unidad, campo.unidades);
              if (valor) guardar(valor);
              return valor !== null;
            }}
          />
        );
      }
      case "foto":
        return <Fotos id={id} seccion={seccion} campo={campo} ids={noObtenido ? [] : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
      case "cantidades":
        return (
          <CampoCantidades
            campo={campo}
            unidades={campo.unidades}
            // De `desde`, no de lo guardado: al deshacer «No se pudo obtener», lo guardado todavía trae la marca en ese
            // instante y el editor se montaría vacío; el siguiente cambio borraría lo devuelto (iteración 42).
            inicial={inicial}
            error={noObtenido ? undefined : errorDelCampo}
            guardar={(valor) => guardar(valor)}
          />
        );
      case "boceto":
        return <CampoBoceto id={id} seccion={seccion} campo={campo} actual={noObtenido ? undefined : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
      case "firma":
        return <CampoFirma id={id} seccion={seccion} campo={campo} actual={noObtenido ? undefined : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
    }
  })();

  if (!campo.obligatorio) return control;
  return (
    <div className="flex flex-col gap-2">
      <Fragment key={desde.vez}>{control}</Fragment>
      <MarcaNoObtenido
        dato={campo.etiqueta}
        marcado={noObtenido}
        motivoInicial={esNoObtenido(alAbrir) ? alAbrir.motivo : ""}
        error={errorDeMotivo}
        // Marcar reemplaza el dato, y lo capturado vuelve con "Deshacer"; desmarcar lo deja vacío para capturarlo (regla 3).
        onMarcar={(marcado, motivo) => {
          if (!marcado) return reemplazar(undefined);
          const anterior = noObtenido || (Array.isArray(actual) && actual.length === 0) ? undefined : actual;
          reemplazar({ noObtenido: true, motivo });
          if (anterior !== undefined) notificar({ texto: `Marcado como no obtenido: ${campo.etiqueta}`, accion: { texto: "Deshacer", alHacer: () => reemplazar(anterior) } });
        }}
        onMotivo={(motivo) => guardar({ noObtenido: true, motivo })}
      />
    </div>
  );
}

/**
 * Cantidades (F9): texto libre, sin catálogo (regla 6). La cantidad se guarda como decimal canónico
 * cuando se puede leer ("12,5" → "12.5"); si no, tal cual, y la validación al enviar la marca.
 */
function CampoCantidades({ campo, unidades, inicial, error, guardar }: { campo: DefinicionCampo; unidades: readonly string[]; inicial: Valor | undefined; error: string | undefined; guardar: (valor: Valor | undefined) => void }) {
  // El catálogo de la organización, bajado al teléfono (iteración 17, ADR-0025).
  const catalogo = useLiveQuery(() => db.catalogo.toArray(), []);
  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    esCantidades(inicial)
      ? inicial.map((l) => ({ id: l.id, descripcion: l.descripcion, cantidad: l.cantidad.replace(".", ","), unidad: l.unidad, observacion: l.observacion ?? "", ...(l.item ? { catalogo: { id: l.item, codigo: "" } } : {}) }))
      : [],
  );
  const [buscando, setBuscando] = useState(false);
  const usuario = useUsuario();
  // Se cuentan al abrir la búsqueda: solo ordenan la lista (los que más usa este técnico en este teléfono).
  const usos = useLiveQuery(async () => (buscando && usuario ? usosPorItem(await repositorio.listar(usuario.id)) : undefined), [buscando, usuario?.id]);
  const codigos = new Map((catalogo ?? []).map((i) => [i.id, i.codigo]));
  // El código se muestra cuando el catálogo termina de leerse.
  const visibles = lineas.map((l) => (l.catalogo && !l.catalogo.codigo ? { ...l, catalogo: { id: l.catalogo.id, codigo: codigos.get(l.catalogo.id) ?? "" } } : l));
  // Sin nada que elegir para este campo, el botón no lleva a ninguna parte: no se ofrece.
  const hayQueElegir = (catalogo ?? []).some((i) => i.activo && unidades.includes(i.unidad));

  function cambiar(nuevas: LineaEditable[]) {
    setLineas(nuevas);
    guardar(
      nuevas.length === 0
        ? undefined
        : nuevas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: normalizarDecimal(l.cantidad) ?? l.cantidad,
            unidad: l.unidad,
            ...(l.observacion.trim() ? { observacion: l.observacion.trim() } : {}),
            ...(l.catalogo ? { item: l.catalogo.id } : {}),
          })),
    );
  }
  const agregar = (linea: Omit<LineaEditable, "id">) => cambiar([...lineas, { id: nuevoIdDeRepeticion(), ...linea }]);
  const indiceDe = (itemId: string) => lineas.findIndex((l) => l.catalogo?.id === itemId);
  return (
    <>
      <EditorMateriales
        etiqueta={campo.etiqueta}
        lineas={visibles}
        unidades={unidades}
        onCambio={cambiar}
        nuevoId={nuevoIdDeRepeticion}
        obligatorio={campo.obligatorio}
        error={error}
        buscar={hayQueElegir ? () => setBuscando(true) : undefined}
      />
      {buscando && catalogo && usos && (
        <HojaCatalogo
          items={catalogo}
          unidades={unidades}
          usos={usos}
          cantidadDe={(item) => {
            const i = indiceDe(item.id);
            return i >= 0 ? lineas[i]!.cantidad : undefined;
          }}
          elegir={(item) => agregar({ descripcion: item.descripcion, cantidad: "1", unidad: item.unidad, observacion: "", catalogo: { id: item.id, codigo: item.codigo } })}
          sumar={(item, delta) => {
            const i = indiceDe(item.id);
            if (i < 0) return;
            const siguiente = Math.max(0, (Number(lineas[i]!.cantidad.replace(",", ".")) || 0) + delta);
            cambiar(siguiente === 0 ? lineas.filter((_, j) => j !== i) : lineas.map((l, j) => (j === i ? { ...l, cantidad: String(siguiente).replace(".", ",") } : l)));
          }}
          libre={(descripcion) => {
            agregar({ descripcion, cantidad: "1", unidad: unidades[0] ?? "", observacion: "" });
            setBuscando(false);
          }}
          cerrar={() => setBuscando(false)}
        />
      )}
    </>
  );
}

/** El paso del croquis: el editor abierto, como en el prototipo; "Listo" sigue y volver lleva al recorrido. */
function PasoCroquis({
  id,
  seccion,
  campo,
  actual,
  alGuardar,
  volver,
  listo,
}: {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  actual: Valor | undefined;
  alGuardar: () => void;
  volver: () => void;
  listo: () => void;
}) {
  const documento = useBoceto(actual);
  const simbolos = useLiveQuery(() => db.simbolos.toArray(), []);
  // La capa sube una sola vez, mientras se lee el documento y se carga el editor; el editor aparece encima sin subir
  // otra vez (iteración 32: antes se veía un fondo vacío y después el editor subiendo).
  return (
    <div aria-busy={documento === undefined} aria-label={documento === undefined ? "Abriendo el editor" : undefined} data-tema="claro" className="fixed inset-0 z-50 bg-fondo motion-safe:animate-hoja-sube">
      {documento !== undefined && (
        <Suspense fallback={null}>
          <EditorBoceto
            entrar={false}
            etiqueta={campo.etiqueta}
            inicial={documento}
            simbolos={simbolos}
            guardar={async (d) => {
              await repositorio.guardarBoceto(id, seccion, campo.clave, d, new Date());
              alGuardar();
            }}
            cerrar={volver}
            listo={listo}
          />
        </Suspense>
      )}
    </div>
  );
}

/** Boceto (ADR-0019): miniatura y editor a pantalla completa. El documento vive en el archivo local. */
function useBoceto(valor: Valor | undefined) {
  const huella = esBoceto(valor) ? valor.boceto : undefined;
  return useLiveQuery(async () => (huella ? repositorio.obtenerBoceto(huella) : null), [huella]);
}

function CampoBoceto({ id, seccion, campo, actual, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; actual: Valor | undefined; error: string | undefined; alGuardar: () => void }) {
  const documento = useBoceto(actual);
  // La hoja con la que abre el editor: tocar una de las miniaturas abre esa (ADR-0026).
  const [editando, setEditando] = useState<number | null>(null);
  const hojas = documento ? hojasDe(documento) : [];
  const hayDibujo = hojas.some((h) => h.elementos.length > 0);
  // La biblioteca de símbolos (ADR-0027), solo mientras se dibuja.
  const simbolos = useLiveQuery(() => (editando === null ? [] : db.simbolos.toArray()), [editando === null]);
  return (
    <div className="flex flex-col gap-2">
      <EtiquetaCampo obligatorio={campo.obligatorio}>{campo.etiqueta}</EtiquetaCampo>
      {hayDibujo ? (
        <HojasDeBoceto hojas={hojas} cuadricula={LIENZO.cuadricula} etiqueta={`Boceto de ${campo.etiqueta.toLowerCase()}`} alAbrir={setEditando} />
      ) : (
        <p className="text-ayuda text-texto-secundario">Todavía no hay boceto.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      {/* Mientras se lee lo guardado no se abre: el editor partiría de una hoja vacía y la reemplazaría (iteración 42). */}
      <Boton icono={Pencil} disabled={documento === undefined} onClick={() => setEditando(0)}>
        {hayDibujo ? "Editar boceto" : "Dibujar boceto"}
      </Boton>
      {editando !== null && (
        <Suspense fallback={<div aria-busy="true" aria-label="Abriendo el editor" className="fixed inset-0 z-50 bg-fondo" />}>
          <EditorBoceto
            etiqueta={campo.etiqueta}
            inicial={documento ?? null}
            hojaInicial={editando}
            simbolos={simbolos}
            guardar={async (d) => {
              await repositorio.guardarBoceto(id, seccion, campo.clave, d, new Date());
              alGuardar();
            }}
            cerrar={() => setEditando(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

const diaLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const soloHora = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });
const diaCorto = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
/** "hoy a las 3:40 p. m." o la fecha completa si no fue hoy. */
const cuandoFirmo = (iso: string) => (new Date(iso).toDateString() === new Date().toDateString() ? `hoy ${soloHora.format(new Date(iso))}` : fechaHora(iso));

/**
 * La constancia firmada (iteración 32): la firma grande sobre su línea, quién firmó y la declaración tal como sale en
 * el informe, con "Repetir" arriba (Liven y Docusign en Mobbin). Clara en los dos temas, como el papel.
 */
function FirmaTomada({ valor, documento, cliente, repetir }: { valor: ValorFirma; documento: DocumentoBoceto | null | undefined; cliente?: string | undefined; repetir?: (() => void) | undefined }) {
  // La firma es un boceto de una sola hoja (ADR-0024).
  const trazos = documento ? hojasDe(documento)[0] : undefined;
  return (
    <section aria-label="Constancia firmada" data-tema="claro" className="overflow-hidden rounded-capa border border-division bg-panel text-texto">
      <div className="flex items-center justify-between gap-2 pt-3 pr-2 pl-4">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-exito-fondo px-3 text-ayuda font-medium text-exito-texto [&_svg]:size-4">
          <Check aria-hidden />
          {`Firmada ${cuandoFirmo(valor.firmadoEn)}`}
        </span>
        {repetir ? (
          <Boton variante="fantasma" icono={RefreshCw} onClick={repetir}>
            Repetir
          </Boton>
        ) : (
          <span className="h-control-sm" />
        )}
      </div>
      <div className="mx-4 mt-1 flex h-48 items-center justify-center border-b-[1.5px] border-borde-control">
        {trazos && <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={`Firma de ${valor.nombre}`} className="max-h-44 w-full" />}
      </div>
      <div className="flex flex-col gap-0.5 px-4 pt-2.5 pb-3.5">
        <strong className="text-[17px] font-semibold">{valor.nombre}</strong>
        {(valor.cargo || cliente) && <span className="text-ayuda text-texto-secundario">{[valor.cargo, cliente].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className="border-t border-division px-4 py-3 text-ayuda leading-relaxed text-texto-secundario">{valor.declaracion}</p>
    </section>
  );
}

/**
 * Firma de quien recibe la visita (ADR-0024). El técnico entrega el teléfono: la constancia se llena con su
 * nombre, el sitio de la visita y el día, y queda guardada tal como se leyó.
 */
function CampoFirma({ id, seccion, campo, actual, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; actual: Valor | undefined; error: string | undefined; alGuardar: () => void }) {
  const [firmando, setFirmando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const usuario = useUsuario();
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? visitaDe(db, l.tecnicoId, l.visitaId) : null;
  }, [id]);
  const firma = esFirma(actual) ? actual : undefined;
  const documento = useLiveQuery(async () => (firma ? repositorio.obtenerBoceto(firma.firma) : null), [firma?.firma]);
  const declaracion = llenarDeclaracion(campo.tipo === "firma" ? campo.declaracion : undefined, {
    tecnico: usuario?.nombre ?? "el técnico",
    sitio: visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "este sitio",
    fecha: diaLargo.format(new Date()),
  });

  const propio = useContext(PasoPropio);
  return (
    <div className="flex flex-col gap-3">
      {!propio && <EtiquetaCampo obligatorio={campo.obligatorio}>{campo.etiqueta}</EtiquetaCampo>}
      {firma ? (
        <FirmaTomada valor={firma} documento={documento} cliente={visita?.cliente.nombre} repetir={() => setConfirmando(true)} />
      ) : propio ? (
        <>
          <p className="text-cuerpo leading-relaxed text-texto-secundario">Vas a entregar el teléfono a quien te recibió. Firma una constancia de que estuviste en el sitio hoy.</p>
          <div className="flex flex-col gap-0.5 rounded-panel border border-division bg-panel px-4.5 py-4">
            <strong className="text-cuerpo">Constancia de visita</strong>
            <span className="text-ayuda text-texto-secundario">{`${visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "Este sitio"} · ${diaCorto.format(new Date())}`}</span>
          </div>
        </>
      ) : (
        <p className="text-ayuda text-texto-secundario">Entrégale el teléfono a quien recibió la visita: firma una constancia de que estuviste en el sitio.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      {firma ? null : propio ? (
        <BarraDePaso>
          <BotonSiguiente icono={Smartphone} onClick={() => setFirmando(true)}>
            Entregar el teléfono
          </BotonSiguiente>
        </BarraDePaso>
      ) : (
        <Boton icono={Pencil} onClick={() => setFirmando(true)}>
          Entregar el teléfono
        </Boton>
      )}
      {confirmando && firma && (
        <Confirmacion
          nivel="consecuencia"
          forma="inferior"
          titulo="¿Volver a firmar?"
          confirmar="Volver a firmar"
          accion={async () => setFirmando(true)}
          mensajeDeError={() => "No se pudo abrir la firma. Intenta de nuevo."}
          alCerrar={() => setConfirmando(false)}
        >
          <p>La firma de {firma.nombre} se reemplaza por la nueva.</p>
        </Confirmacion>
      )}
      {firmando && (
        <Suspense fallback={<div aria-busy="true" aria-label="Abriendo la constancia" className="fixed inset-0 z-50 bg-panel" />}>
          <HojaDeFirma
            declaracion={declaracion}
            recibe={{ tecnico: usuario?.nombre ?? "el técnico", cliente: visita?.cliente.nombre }}
            guardar={async (d, datos) => {
              await repositorio.guardarFirma(id, seccion, campo.clave, d, { ...datos, declaracion }, new Date());
              alGuardar();
            }}
            cerrar={() => setFirmando(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function FirmaLeida({ etiqueta, valor }: { etiqueta: string; valor: ValorFirma }) {
  const documento = useLiveQuery(() => repositorio.obtenerBoceto(valor.firma), [valor.firma]);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      <FirmaTomada valor={valor} documento={documento} />
    </div>
  );
}

function BocetoLeido({ etiqueta, valor }: { etiqueta: string; valor: Valor | undefined }) {
  const documento = useBoceto(valor);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      {documento ? (
        <HojasDeBoceto hojas={hojasDe(documento)} cuadricula={LIENZO.cuadricula} etiqueta={`Boceto de ${etiqueta.toLowerCase()}`} />
      ) : (
        <p className="text-ayuda text-texto-secundario">{describirValor({ clave: "", etiqueta, tipo: "boceto" }, valor)}</p>
      )}
    </div>
  );
}

function useUrlsDeFotos(ids: readonly string[]) {
  const archivos = useLiveQuery(() => repositorio.obtenerArchivos(ids), [ids.join()]);
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  useEffect(() => {
    const nuevas = (archivos ?? []).map((a) => ({ id: a.id, url: URL.createObjectURL(new Blob([a.datos], { type: a.tipo })) }));
    setFotos(nuevas);
    return () => nuevas.forEach((f) => URL.revokeObjectURL(f.url));
  }, [archivos]);
  return fotos;
}

function Fotos({ id, seccion, campo, ids, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; ids: unknown; error: string | undefined; alGuardar: () => void }) {
  const huellas = Array.isArray(ids) ? (ids as string[]) : [];
  const fotos = useUrlsDeFotos(huellas);
  const notificar = useNotificar();
  const [procesando, setProcesando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function agregar(originales: File[]) {
    setProcesando(true);
    setFallo(null);
    // Una que falla no detiene las demás del lote, y el aviso dice cuántas faltan (iteración 42).
    let fallidas = 0;
    for (const original of originales) {
      try {
        const archivo = await procesarFoto(original, new Date());
        await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
        alGuardar();
      } catch (error) {
        // El técnico ve un mensaje simple; soporte necesita la causa (ADR-0017).
        console.error("No se pudo guardar la foto", error);
        fallidas++;
      }
    }
    // Las fotos suben por adelantado cuando hay señal (ADR-0003).
    if (fallidas < originales.length) sincronizarEnSegundoPlano();
    if (fallidas === 1 && originales.length === 1) setFallo("No se pudo guardar la foto. Tómala de nuevo.");
    else if (fallidas > 0) setFallo(`No se ${fallidas === 1 ? "pudo guardar 1 foto" : `pudieron guardar ${fallidas} fotos`} de ${originales.length}. Tómalas de nuevo.`);
    setProcesando(false);
  }

  /** Quitar es inmediato y se deshace desde la notificación (DESIGN.md: qué se confirma y qué se deshace). */
  async function quitar(huella: string) {
    setFallo(null);
    try {
      const [archivo] = await repositorio.obtenerArchivos([huella]);
      const posicion = huellas.indexOf(huella);
      await repositorio.quitarFoto(id, seccion, campo.clave, huella, new Date());
      if (!archivo) return;
      const { subida: _subida, ultimoErrorDeSubida: _error, ...deVuelta } = archivo;
      notificar({ texto: "Foto eliminada", accion: { texto: "Deshacer", alHacer: () => void restaurar(deVuelta, posicion) } });
    } catch (error) {
      console.error("No se pudo quitar la foto", error);
      setFallo("No se pudo quitar la foto. Intenta de nuevo.");
    }
  }

  async function restaurar(archivo: ArchivoNuevo, posicion: number) {
    try {
      await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
      // Agregar la pone al final: vuelve al lugar que tenía.
      const actuales = (await repositorio.obtener(id))?.respuestas[seccion]?.[campo.clave];
      if (Array.isArray(actuales)) {
        const orden = (actuales as string[]).filter((h) => h !== archivo.id);
        orden.splice(Math.min(posicion, orden.length), 0, archivo.id);
        await repositorio.guardarRespuesta(id, seccion, campo.clave, orden, new Date());
      }
      sincronizarEnSegundoPlano();
    } catch (error) {
      // Por ejemplo, si el levantamiento ya se envió: la foto ya no puede volver.
      console.error("No se pudo deshacer", error);
      setFallo("No se pudo recuperar la foto.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CampoFotos etiqueta={campo.etiqueta} obligatorio={campo.obligatorio} error={error} fotos={fotos} procesando={procesando} onAgregar={agregar} onQuitar={(h) => void quitar(h)} puestos={campo.tipo === "foto" ? campo.puestos : undefined} />
      {fallo && <Aviso tono="error">{fallo}</Aviso>}
    </div>
  );
}

function Enviado({
  levantamiento,
  formato,
  envio,
  servidor,
  volver,
  estadoChat,
  alDescartar,
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  envio: EstadoDeEnvio | null;
  servidor: EstadoServidor | null;
  volver: () => void;
  /** El chat con oficina (ADR-0040): lo guarda Captura, porque esta vista se vuelve a montar al cambiar el estado. */
  estadoChat: { abierto: boolean; abrir: (abierto: boolean) => void };
  /** Descartó un envío que oficina rechazó para siempre: quien abrió la captura vuelve al inicio y lo dice. */
  alDescartar: () => void;
}) {
  const [descartando, setDescartando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const enLinea = useServidorAlcanzable();
  const { abierto: chatAbierto, abrir: setChatAbierto } = estadoChat;
  const loEnviado = useRef<HTMLDetailsElement>(null);
  const tecnicoId = levantamiento.tecnicoId;
  const pendientes = useLiveQuery(async () => (tecnicoId ? pendientesDe(db, tecnicoId, levantamiento.id) : []), [tecnicoId, levantamiento.id]);
  const leido = useLiveQuery(async () => (tecnicoId ? leidoHasta(db, tecnicoId, levantamiento.id) : null), [tecnicoId, levantamiento.id]);
  const sitio = useLiveQuery(async () => {
    const v = levantamiento.visitaId && tecnicoId ? await visitaDe(db, tecnicoId, levantamiento.visitaId) : null;
    // La visita atendida sale del teléfono al día siguiente (ADR-0041): el levantamiento guarda dónde fue (iteración 42).
    return v ? `${v.cliente.nombre} · ${v.sitio.nombre}` : levantamiento.lugar ? `${levantamiento.lugar.cliente} · ${levantamiento.lugar.sitio}` : "";
  }, [levantamiento.visitaId, tecnicoId, levantamiento.lugar?.cliente, levantamiento.lugar?.sitio]);
  const [reintentar, reintentando] = useSinRepetir(async () => {
    await repositorio.reintentarEnvio(levantamiento.id);
    sincronizarEnSegundoPlano();
  });
  // El avance real: cuántos de sus archivos (fotos, bocetos, firma) ya subieron, y si oficina lo recibió.
  const huellas = archivosReferenciados(levantamiento.respuestas);
  const totalArchivos = huellas.length;
  const subidos = useLiveQuery(async () => (await db.archivos.bulkGet(huellas)).filter((a) => a && a.subida === "subida").length, [huellas.join(",")]);
  const recibido = Boolean(servidor) || envio?.estado === "recibido";
  const proceso: EstadoDeProceso = recibido ? "listo" : envio?.estado === "error" ? "error" : !enLinea || envio?.ultimoError?.codigo === "sin_conexion" ? "esperando" : "enviando";
  // La siguiente visita, si hay otra: el botón lleva a ella.
  const siguienteVisita = useLiveQuery(async () => {
    if (!levantamiento.tecnicoId) return null;
    // La misma agenda del inicio (iteración 40): lo atendido o terminado no es la siguiente; las atrasadas sí lo son.
    const propios = await repositorio.listar(levantamiento.tecnicoId);
    const con = (estado: LevantamientoLocal["estado"]) => new Set(propios.filter((l) => l.estado === estado && l.visitaId).map((l) => l.visitaId!));
    const visitas = (await visitasDe(db, levantamiento.tecnicoId)).filter((v) => v.id !== levantamiento.visitaId && !v.fueraDeAlcance);
    return agendaDeVisitas(visitas, hoyLocal(), con("borrador"), con("enviado")).pendientes[0] ?? null;
  }, [levantamiento.tecnicoId, levantamiento.visitaId]);
  // Lo que dijo el servidor en la bajada manda sobre el estado de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, enLinea) : null;
  const comentarios = servidor?.comentarios ?? [];
  const chat = armarChat(comentarios, pendientes ?? []);
  const ultimo = chat.at(-1);
  const nuevos = leido === undefined ? 0 : sinLeer(chat, leido);
  const enCola = chat.filter((m) => m.estado === "cola").length;
  // «Ver lo que enviaste» abierto en el dato del que habla la conversación.
  function verDato(seccion: string, campo: string) {
    setChatAbierto(false);
    if (loEnviado.current) loEnviado.current.open = true;
    requestAnimationFrame(() => document.getElementById(idDeDato(seccion, campo))?.scrollIntoView({ block: "center", behavior: sinMovimiento() ? "auto" : "smooth" }));
  }
  if (chatAbierto && tecnicoId) return <Chat levantamiento={levantamiento} formato={formato} servidor={servidor} sitio={sitio ?? ""} volver={() => setChatAbierto(false)} verDato={verDato} />;
  return (
    <>
      {levantamiento.estado === "enviado" ? (
        <>
          <ProcesoDeEnvio
            estado={proceso}
            avance={recibido ? 1 : totalArchivos > 0 && subidos !== undefined ? (subidos / (totalArchivos + 1)) : null}
            titulo={{ listo: "En oficina", enviando: "Enviando a oficina…", esperando: "Esperando señal", error: "No se pudo enviar" }[proceso]}
            detalle={
              proceso === "listo"
                ? "Oficina ya puede revisar este levantamiento."
                : proceso === "esperando"
                  ? "Se envía solo cuando vuelva la señal. Puedes seguir con otra visita."
                  : proceso === "error"
                    ? porQueNoEntro(envio?.ultimoError?.codigo)
                    : "Puedes salir de esta pantalla: el envío sigue solo."
            }
            etapas={[
              { clave: "guardado", texto: "Guardado en el teléfono", estado: "hecho" },
              {
                clave: "archivos",
                texto: totalArchivos > 0 ? `Fotos y dibujos · ${recibido ? totalArchivos : (subidos ?? 0)} de ${totalArchivos}` : "Datos del levantamiento",
                estado: recibido || (totalArchivos > 0 && subidos === totalArchivos) ? "hecho" : proceso === "error" ? "error" : proceso === "enviando" ? "en_curso" : "espera",
              },
              { clave: "recibido", texto: recibido ? "Recibido en oficina" : "Llega a oficina", estado: recibido ? "hecho" : proceso === "enviando" && (totalArchivos === 0 || subidos === totalArchivos) ? "en_curso" : "espera" },
            ]}
          />
          {envio?.estado === "error" && !recibido ? (
            <>
              <p className="-mt-2 text-center text-ayuda text-texto-secundario">{QUE_HACER_CON_EL_RECHAZO}</p>
              <Boton cargando={reintentando} onClick={() => void reintentar()}>
                Reintentar envío
              </Boton>
              {/* Oficina nunca lo recibió: si hay algo que corregir, vuelve a ser borrador (ADR-0045). */}
              <Boton variante="fantasma" icono={Pencil} onClick={() => setCorrigiendo(true)}>
                Volver a borrador para corregir
              </Boton>
              {corrigiendo && (
                <Confirmacion
                  nivel="consecuencia"
                  forma="inferior"
                  titulo="¿Volver a borrador?"
                  confirmar="Volver a borrador"
                  accion={() => repositorio.volverABorrador(levantamiento.id)}
                  mensajeDeError={(e) =>
                    e instanceof VisitaConOtroBorrador ? "Esta visita ya tiene otro levantamiento sin enviar. Envíalo o descártalo y vuelve a intentarlo." : "No se pudo volver a borrador. Intenta de nuevo."
                  }
                  alCerrar={() => setCorrigiendo(false)}
                  consecuencias={[
                    { icono: Pencil, texto: "Lo vuelves a editar en este teléfono", detalle: "Oficina nunca lo recibió: no hay otra copia que cambie" },
                    { icono: Send, texto: "Cuando lo envíes, sale otra vez a oficina" },
                  ]}
                />
              )}
              {/* Si oficina no lo va a aceptar nunca (otro ya lo envió, el formato se retiró), aquí sale del inicio. */}
              <Boton variante="fantasma" icono={Trash} onClick={() => setDescartando(true)}>
                Descartar levantamiento
              </Boton>
              {descartando && (
                <Confirmacion
                  nivel="irreversible"
                  forma="inferior"
                  titulo="¿Descartar este levantamiento?"
                  confirmar="Descartar"
                  descartar="Volver"
                  accion={() => repositorio.descartar(levantamiento.id, new Date())}
                  mensajeDeError={() => "No se pudo descartar. Intenta de nuevo."}
                  alCerrar={() => setDescartando(false)}
                  alTerminar={alDescartar}
                  consecuencias={[
                    { icono: Smartphone, texto: "Deja de esperar a oficina y sale de Mis visitas" },
                    { icono: Trash, texto: "Queda 30 días en Descartados, en tu cuenta", detalle: "De ahí lo recuperas con todo lo que tenía" },
                    { icono: TriangleAlert, texto: "Después se borra del teléfono con sus fotos", detalle: "Oficina nunca lo recibió: no queda otra copia" },
                  ]}
                />
              )}
            </>
          ) : (
            !recibido && estado && <p className="-mt-2 text-center text-ayuda text-texto-secundario">{estado.texto}</p>
          )}
          <BotonSiguiente onClick={volver}>
            {siguienteVisita ? (
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span>Ver la siguiente visita</span>
                <span className="max-w-full truncate text-ayuda font-bold opacity-75">{`${siguienteVisita.cliente.nombre} · ${siguienteVisita.sitio.nombre}`}</span>
              </span>
            ) : (
              "Ir a mis visitas"
            )}
          </BotonSiguiente>
        </>
      ) : (
        estado && (
          <div className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
            <p className={`text-cuerpo font-bold ${claseDeTono[estado.tono]}`} aria-live="polite">
              {estado.texto}
            </p>
          </div>
        )
      )}
      {comentarios.length > 0 && ultimo && (
        <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-2">
          {/* Sin señal y con respuestas en cola: quedan en el teléfono y salen solas (ADR-0040). */}
          {!enLinea && enCola > 0 && (
            <div className="flex gap-2.5 rounded-panel bg-alerta-fondo px-3.5 py-3 text-[14.5px] leading-snug" role="status">
              <WifiOff aria-hidden className="mt-0.5 size-[18px] flex-none text-alerta-texto" />
              <span>
                <b className="block font-semibold">Sin señal</b>
                {enCola === 1 ? "Tu mensaje está guardado en el teléfono y se envía solo" : "Tus mensajes están guardados en el teléfono y se envían solos"} cuando vuelva.
              </span>
            </div>
          )}
          <h2 id="titulo-comentarios" className="px-1 text-ayuda font-bold text-texto-secundario">
            Comentarios de oficina
          </h2>
          <button
            type="button"
            onClick={() => setChatAbierto(true)}
            className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-px rounded-panel border border-division bg-panel px-3.5 py-3 text-left focus-visible:outline-3 focus-visible:outline-foco"
          >
            <span className="row-span-2 grid size-11 place-items-center rounded-full bg-acento/12 text-acento">
              <Building aria-hidden className="size-[21px]" />
            </span>
            <b className="text-[16px] font-semibold">Oficina</b>
            <span className={`justify-self-end text-[13px] ${nuevos > 0 ? "font-semibold text-acento" : "text-texto-secundario"}`}>{horaDelChat(ultimo.en)}</span>
            <span className="min-w-0 truncate text-[14.5px] text-texto-secundario">
              {ultimo.de === "tecnico" ? "Tú: " : ""}
              {ultimo.texto}
            </span>
            {nuevos > 0 ? (
              <span className="inline-grid h-[22px] min-w-[22px] place-items-center justify-self-end rounded-full bg-acento px-[7px] text-[12.5px] font-semibold text-sobre-acento" aria-label={nuevos === 1 ? "1 sin leer" : `${nuevos} sin leer`}>
                {nuevos}
              </span>
            ) : (
              <span />
            )}
          </button>
        </section>
      )}
      <details ref={loEnviado} open={levantamiento.estado !== "enviado" || undefined} className="group flex flex-col rounded-panel border border-division bg-panel [&[open]>summary]:mb-1">
        <summary className="flex min-h-tactil cursor-pointer items-center justify-between gap-3 rounded-panel px-4 text-cuerpo font-bold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
          {levantamiento.estado === "enviado" ? "Ver lo que enviaste" : "Ver lo capturado"}
          <ChevronDown aria-hidden className="size-5 shrink-0 text-texto-secundario transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 px-2 pb-2 motion-safe:animate-aparecer">
      {bloques(formato, levantamiento.repeticiones ?? {}).map(({ seccion, clave, titulo }, _i, todos) =>
        agrupar(seccion.campos).map((grupo, g) => (
          <div key={`${clave}.${grupo[0]!.clave}`} className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-4">
            {g === 0 && todos.length > 1 && <h2 className="text-subtitulo font-extrabold">{titulo}</h2>}
            {grupo.map((campo) => {
              const valor = levantamiento.respuestas[clave]?.[campo.clave];
              // Cada dato con su id: el chat lleva al dato del que habla (ADR-0040).
              return <div key={campo.clave} id={idDeDato(clave, campo.clave)} className="scroll-mt-4">{campo.tipo === "foto" && !esNoObtenido(valor) ? (
                <FotosLeidas key={campo.clave} etiqueta={campo.etiqueta} ids={Array.isArray(valor) ? (valor as string[]) : []} />
              ) : campo.tipo === "cantidades" && esCantidades(valor) ? (
                <TablaCantidades key={campo.clave} etiqueta={campo.etiqueta} lineas={valor} />
              ) : campo.tipo === "boceto" && !esNoObtenido(valor) ? (
                <BocetoLeido key={campo.clave} etiqueta={campo.etiqueta} valor={valor} />
              ) : campo.tipo === "firma" && esFirma(valor) ? (
                <FirmaLeida key={campo.clave} etiqueta={campo.etiqueta} valor={valor} />
              ) : (
                <ValorLeido key={campo.clave} etiqueta={campo.etiqueta}>
                  {describirValor(campo, valor)}
                </ValorLeido>
              )}</div>;
            })}
          </div>
        )),
      )}
        </div>
      </details>
    </>
  );
}

function FotosLeidas({ etiqueta, ids }: { etiqueta: string; ids: readonly string[] }) {
  const fotos = useUrlsDeFotos(ids);
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
