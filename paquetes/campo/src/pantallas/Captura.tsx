import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { pasosDe, type Paso } from "../recorrido";
import { useLiveQuery } from "dexie-react-hooks";
import {
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
  nombreDeDato,
  rutaLegible,
  validarRespuestas,
  type CodigoErrorValidacion,
  type DefinicionCampo,
  type DefinicionSeccion,
  type DocumentoBoceto,
  type ErrorValidacion,
  type Valor,
  type ValorFirma,
  type ValorMedida,
  type VersionFormato,
} from "@teins/dominio";
import {
  Aviso,
  BarraDePaso,
  Boton,
  BotonAgregar,
  BotonRedondo,
  BotonSiguiente,
  Check,
  ChuloDeExito,
  EncabezadoDePaso,
  FilaDeRepaso,
  FranjaSincronizacion,
  ListaRecorrido,
  PasoDelRecorrido,
  Repaso,
  TarjetaResumen,
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
  TablaCantidades,
  Trash,
  useNotificar,
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
import type { ArchivoNuevo } from "../datos/repositorio";
import { procesarFoto } from "../fotos/procesar";
import { fechaHora, horaExacta } from "../formato";
import { formatoDe, nombreDeFormato, useFormatos } from "../formatos";
import { claseDeTono, estadoDeEnvio, estadoSegunServidor, mensajeDeValidacion } from "../mensajes";
import { useServidorAlcanzable } from "../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../sincronizacion/disparar";

// El editor de bocetos pesa (perfect-freehand y la lógica del lienzo): se carga solo al dibujar (ADR-0011).
const EditorBoceto = lazy(() => import("./EditorBoceto"));
// La constancia que firma el cliente (ADR-0024): se carga al pedir la firma.
const HojaDeFirma = lazy(() => import("./HojaDeFirma"));
const claveDeError = (seccion: string, campo: string) => `${seccion}.${campo}`;
/** El campo ocupa su propio paso del recorrido: la firma pone ahí su acción (prototipo aprobado). */
const PasoPropio = createContext(false);
/** Ancla de un dato en la pantalla: el resumen de errores lleva hasta él. */
const anclaDeDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`;
const anclaDeSeccion = (seccion: string) => `seccion-${seccion}`;

export function Captura({ id, volver }: { id: string; volver: () => void }) {
  // `null` distingue "no existe" de `undefined` (cargando).
  const levantamiento = useLiveQuery(async () => (await repositorio.obtener(id)) ?? null, [id]);
  const envio = useLiveQuery(async () => (await db.envios.get(id)) ?? null, [id]);
  const servidor = useLiveQuery(() => estadoDe(db, id), [id]);
  const formatos = useFormatos();
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? visitaDe(db, l.tecnicoId, l.visitaId) : null;
  }, [id]);
  // Vencido el permiso de trabajo local, el borrador se ve pero no se edita (ADR-0009, parte 2).
  const bloqueado = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    const bajada = l?.tecnicoId ? await db.bajadas.get(l.tecnicoId) : undefined;
    return bajada ? Date.parse(bajada.permisoLocalHasta) < Date.now() : false;
  }, [id]);
  // Los campos leen los valores una sola vez; después solo escriben (ver CampoTexto).
  const [inicial, setInicial] = useState<LevantamientoLocal>();
  useEffect(() => {
    if (levantamiento && !inicial) setInicial(levantamiento);
  }, [levantamiento, inicial]);

  const formato = levantamiento && formatos ? formatoDe(formatos, levantamiento) : undefined;
  const borrador = levantamiento?.estado === "borrador";

  // Enviado: la pantalla de éxito del prototipo, con lo enviado debajo.
  if (levantamiento && formato && levantamiento.estado === "enviado" && envio !== undefined) {
    return (
      <div className="min-h-dvh bg-fondo">
        <div className="mx-auto flex max-w-xl items-center px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-1">
          <BotonRedondo icono={ChevronLeft} etiqueta="Volver a mis visitas" onClick={volver} />
        </div>
        <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-10">
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} />
        </main>
      </div>
    );
  }

  // Un borrador que se puede editar ocupa toda la pantalla con su recorrido (DESIGN.md, campo).
  if (levantamiento && inicial && formato && borrador && bloqueado === false && envio !== undefined) {
    return (
      <div className="min-h-dvh bg-fondo">
        <Borrador
          id={id}
          formato={formato}
          inicial={inicial}
          actual={levantamiento}
          nombre={formatos ? nombreDeFormato(formatos, levantamiento.formato) : "Levantamiento"}
          contexto={visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "Levantamiento suelto"}
          volver={volver}
        />
      </div>
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
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} volver={volver} />
        ) : bloqueado ? (
          <>
            <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>
            <Enviado levantamiento={levantamiento} formato={formato} envio={null} servidor={null} volver={volver} />
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
  const errores = validarRespuestas(formato, l.respuestas, l.repeticiones);
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
 * movimiento es CSS (regla 10). Sin soporte, o con movimiento reducido, el cambio es inmediato.
 */
function navegar(direccion: "adelante" | "atras", cambiar: () => void) {
  const aplicar = () => {
    flushSync(cambiar);
    window.scrollTo(0, 0);
  };
  document.documentElement.dataset.direccion = direccion;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(aplicar);
  else aplicar();
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

function Borrador({
  id,
  formato,
  inicial,
  actual,
  nombre,
  contexto,
  volver,
}: {
  id: string;
  formato: VersionFormato;
  inicial: LevantamientoLocal;
  actual: LevantamientoLocal;
  nombre: string;
  contexto: string;
  volver: () => void;
}) {
  const pasos = pasosDe(formato);
  const enLinea = useServidorAlcanzable();
  const porSubir = useLiveQuery(() => db.envios.filter((e) => e.estado !== "recibido").count(), []);
  const [errores, setErrores] = useState<readonly ErrorValidacion[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [faltantesDelPaso, setFaltantesDelPaso] = useState<{ pasoId: string; lista: readonly ErrorValidacion[] } | null>(null);
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
  const porClave: ReadonlyMap<string, CodigoErrorValidacion> = new Map((errores ?? []).map((e) => [claveDeError(e.seccion, e.campo ?? ""), e.codigo]));
  const { errores: pendientes, obligatorios, completos } = progreso(formato, actual);
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

  const ir = (destino: Vista, direccion: "adelante" | "atras" = "adelante") => navegar(direccion, () => setVista(destino));
  const recorrido = () => ir({ tipo: "recorrido" }, "atras");
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
      setErrores((previos) => [...(previos ?? []).filter((e) => !lista.some((l) => claveDeError(l.seccion, l.campo ?? "") === claveDeError(e.seccion, e.campo ?? ""))), ...lista]);
      setFaltantesDelPaso({ pasoId, lista });
      return;
    }
    setFaltantesDelPaso(null);
    setVisitados((v) => new Set(v).add(pasoId));
    ir(despuesDe(pasoId));
  };
  const datoFaltante = (e: ErrorValidacion, alIr: () => void): DatoFaltante => {
    const ruta = (e.campo ? nombreDeDato(formato, repeticiones, e.seccion, e.campo) : rutaLegible(formato, repeticiones, e.seccion)).split(" · ");
    return { clave: `${claveDeError(e.seccion, e.campo ?? "")}:${e.codigo}`, titulo: ruta.at(-1)!, donde: ruta.slice(0, -1).join(" · ") || undefined, ir: alIr };
  };

  // Al corregir, el error de ese campo se va: la validación completa se repite al enviar.
  const alGuardar = (seccion: string, campo: string) => {
    if (porClave.has(claveDeError(seccion, campo))) setErrores((lista) => (lista ?? []).filter((e) => claveDeError(e.seccion, e.campo ?? "") !== claveDeError(seccion, campo)));
  };

  /** Del resumen de errores al dato: abre su paso (o su repetición) y lo enfoca. */
  function irAlDato(e: ErrorValidacion) {
    const { seccion, repeticion } = leerClave(e.seccion);
    const paso = pasoDeError(e);
    ir(repeticion && e.campo ? { tipo: "repeticion", seccion, repeticion } : { tipo: "paso", paso: paso?.id ?? pasos[0]!.id });
    setTimeout(() => irAlError(e), 350);
  }

  function mostrarErrores(lista: readonly ErrorValidacion[]) {
    setErrores(lista);
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
    const resultado = await repositorio.enviar(id, formato, new Date());
    if (resultado.ok) {
      sincronizarEnSegundoPlano();
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
        key={campo.clave}
        id={id}
        seccion={clave}
        campo={campo}
        inicial={inicial.respuestas[clave]?.[campo.clave]}
        actual={actual.respuestas[clave]?.[campo.clave]}
        error={porClave.get(claveDeError(clave, campo.clave))}
        alGuardar={() => alGuardar(clave, campo.clave)}
      />
    ));
  const total = pasos.length + 1;
  const contador = `${hechos}/${pasos.length}`;

  let pantalla: ReactNode;
  if (vista.tipo === "recorrido") {
    pantalla = (
      <>
        <EncabezadoDePaso contexto={contexto} avance={avance} volver={volver} etiquetaVolver="Volver a mis visitas" />
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
        <EncabezadoDePaso contexto={`Paso ${i + 1} de ${total} · ${paso.seccion.titulo}`} avance={avance} volver={recorrido} etiquetaVolver="Ver el recorrido" contador={contador} alContador={recorrido} />
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
    const r = repeticiones[seccion.clave]?.find((x) => x.id === vista.repeticion);
    const alPaso = () => ir({ tipo: "paso", paso: seccion.clave }, "atras");
    pantalla = r ? (
      <Repeticion id={id} seccion={seccion} repeticion={r} avance={avance} error={porClave.get(claveDeError(seccion.clave, ""))} volver={alPaso}>
        {campos(seccion.campos, claveDeRepeticion(seccion.clave, r.id))}
      </Repeticion>
    ) : (
      // Se quitó (o no existe): de vuelta a la lista de su sección.
      <>
        <EncabezadoDePaso contexto={seccion.titulo} avance={avance} volver={alPaso} etiquetaVolver={`Volver a ${seccion.titulo.toLowerCase()}`} />
        <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-3">
          <Boton onClick={alPaso}>{`Volver a ${seccion.titulo.toLowerCase()}`}</Boton>
        </main>
      </>
    );
  } else {
    pantalla = (
      <>
        <EncabezadoDePaso contexto={`Paso ${total} de ${total} · Revisar`} avance={avance} volver={recorrido} etiquetaVolver="Ver el recorrido" contador={contador} alContador={recorrido} />
        <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-3 pb-40">
          <h1 className="text-titulo leading-tight font-extrabold tracking-tight">Antes de enviar</h1>
          {errores && errores.length > 0 && (
            <div ref={resumen} tabIndex={-1} className="focus:outline-none">
              <ListaFaltantes
                sacudir={sacudir}
                titulo={errores.length === 1 ? "Falta 1 dato por completar" : `Faltan ${errores.length} datos por completar`}
                datos={errores.map((e) => datoFaltante(e, () => irAlDato(e)))}
              />
            </div>
          )}
          <Aviso tono="alerta">Después de enviar ya no podrás editarlo. Si algo cambia, oficina lo corrige y queda registrado.</Aviso>
          <Repaso etiqueta="Lo que se envía">
            {pasos.map((p) => (
              <FilaDeRepaso key={p.id} titulo={p.titulo} detalle={detalleDe(p)} falta={faltanDe(p) > 0} onEditar={() => ir({ tipo: "paso", paso: p.id }, "atras")} />
            ))}
          </Repaso>
          <p className="text-ayuda text-texto-secundario">{enLinea ? "Sale ahora a oficina." : "Sin señal: queda listo en el teléfono y sale solo cuando vuelva la señal."}</p>
        </main>
        <BarraDePaso>
          <BotonSiguiente icono={Send} onClick={intentarEnviar}>
            Enviar a oficina
          </BotonSiguiente>
        </BarraDePaso>
      </>
    );
  }

  const pasoConFaltantes = faltantesDelPaso ? pasos.find((p) => p.id === faltantesDelPaso.pasoId) : undefined;
  return (
    <>
      {pantalla}
      {faltantesDelPaso && pasoConFaltantes && (
        <Dialogo
          forma="inferior"
          icono={CircleAlert}
          titulo={faltantesDelPaso.lista.length === 1 ? `Falta 1 dato en ${pasoConFaltantes.titulo.toLowerCase()}` : `Faltan ${faltantesDelPaso.lista.length} datos en ${pasoConFaltantes.titulo.toLowerCase()}`}
          subtitulo="Son obligatorios para enviar. Puedes completarlos ahora o volver después."
          alCerrar={() => setFaltantesDelPaso(null)}
          pie={
            <>
              <Boton onClick={() => avanzarDesde(faltantesDelPaso.pasoId, true)}>Seguir y completar después</Boton>
              <Boton
                variante="principal"
                onClick={() => {
                  const primero = faltantesDelPaso.lista[0]!;
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
            {faltantesDelPaso.lista.map((e, i) => {
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
      {confirmando && (
        <Confirmacion
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
    </>
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
  const etiqueta = seccion.repetible!.etiqueta;
  const maximo = seccion.repetible!.max ?? LIMITES.repeticiones;

  async function agregar() {
    await repositorio.agregarRepeticion(id, formato, seccion.clave, new Date());
    alGuardar(seccion.clave, "");
    const nueva = (await repositorio.obtener(id))?.repeticiones?.[seccion.clave]?.at(-1);
    if (nueva) abrir(nueva.id);
  }

  return (
    <section aria-label={seccion.titulo} className="flex flex-col gap-3">
      {error && <Aviso tono="error">{mensajeDeValidacion[error]}</Aviso>}
      {lista.length === 0 && <p className="text-cuerpo text-texto-secundario">{`Agrega uno por cada ${etiqueta.toLowerCase()} que revises. Si no aplica, sigue.`}</p>}
      {lista.map((r) => {
        const clave = claveDeRepeticion(seccion.clave, r.id);
        const n = faltanEn.get(clave) ?? 0;
        return <TarjetaResumen key={r.id} titulo={r.nombre} etiqueta={r.nombre} estado={n > 0 ? faltan(n) : "Completo"} completo={n === 0} datos={datosDeResumen(seccion, actual.respuestas[clave])} onClick={() => abrir(r.id)} />;
      })}
      <BotonAgregar icono={Plus} disabled={lista.length >= maximo} onClick={() => void agregar()}>
        {`Agregar ${etiqueta.toLowerCase()}`}
      </BotonAgregar>
      {lista.length >= maximo && <p className="text-ayuda text-texto-secundario">{`Este formato permite hasta ${maximo}.`}</p>}
    </section>
  );
}

/** Una repetición abierta: su nombre, sus datos y "Quitar" al final, lejos de "Listo". */
function Repeticion({
  id,
  seccion,
  repeticion,
  avance,
  error,
  volver,
  children,
}: {
  id: string;
  seccion: DefinicionSeccion;
  repeticion: { id: string; nombre: string };
  avance: number;
  error: CodigoErrorValidacion | undefined;
  volver: () => void;
  children: ReactNode;
}) {
  const [quitando, setQuitando] = useState(false);
  const etiqueta = seccion.repetible!.etiqueta;
  return (
    <>
      <EncabezadoDePaso contexto={`${seccion.titulo} · ${repeticion.nombre}`} avance={avance} volver={volver} etiquetaVolver={`Volver a ${seccion.titulo.toLowerCase()}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-3 pb-40">
        <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{repeticion.nombre}</h1>
        <article aria-label={repeticion.nombre} className="flex flex-col gap-8">
          {children}
          <CampoTexto
            etiqueta={`Nombre (${etiqueta.toLowerCase()})`}
            valorInicial={repeticion.nombre}
            error={error === "nombre_de_repeticion_invalido" ? mensajeDeValidacion.nombre_de_repeticion_invalido : undefined}
            onCambio={(texto) => {
              // Un nombre vacío no se guarda: se conserva el anterior.
              if (texto.trim()) void repositorio.renombrarRepeticion(id, seccion.clave, repeticion.id, texto.trim(), new Date());
            }}
          />
          <div>
            <Boton variante="fantasma" icono={Trash} aria-label={`Quitar ${repeticion.nombre}`} onClick={() => setQuitando(true)}>
              {`Quitar ${etiqueta.toLowerCase()}`}
            </Boton>
          </div>
        </article>
      </main>
      <BarraDePaso>
        <BotonSiguiente icono={Check} onClick={volver}>{`Listo este ${etiqueta.toLowerCase()}`}</BotonSiguiente>
      </BarraDePaso>
      {quitando && (
        <Confirmacion
          forma="inferior"
          peligro
          titulo={`¿Quitar ${repeticion.nombre}?`}
          confirmar={`Quitar ${etiqueta.toLowerCase()}`}
          accion={() => repositorio.quitarRepeticion(id, seccion.clave, repeticion.id, new Date())}
          mensajeDeError={() => "No se pudo quitar. Intenta de nuevo."}
          alCerrar={() => setQuitando(false)}
          alTerminar={volver}
        >
          <p>Se borra lo que llenaste en {repeticion.nombre}. Las fotos que tomaste en él también dejan de ir en el levantamiento.</p>
        </Confirmacion>
      )}
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

function ContenidoDeCampo({ id, seccion, campo, inicial, actual, error, alGuardar }: PropsCampo) {
  const guardar = (valor: Valor | undefined) => {
    alGuardar();
    return repositorio.guardarRespuesta(id, seccion, campo.clave, valor, new Date());
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
            onCambio={(texto) => void guardar(texto === "" ? undefined : texto)}
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
                void guardar(undefined);
                return true;
              }
              const valor = crearMedida(texto, unidad, campo.unidades);
              if (valor) void guardar(valor);
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
            inicial={noObtenido ? undefined : inicial}
            error={noObtenido ? undefined : errorDelCampo}
            guardar={(valor) => void guardar(valor)}
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
      {control}
      <MarcaNoObtenido
        dato={campo.etiqueta}
        marcado={noObtenido}
        motivoInicial={esNoObtenido(inicial) ? inicial.motivo : ""}
        error={errorDeMotivo}
        // Marcar reemplaza el dato; desmarcar lo deja vacío para capturarlo (regla 3).
        onCambio={(marcado, motivo) => void guardar(marcado ? { noObtenido: true, motivo } : undefined)}
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
          total={lineas.length}
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
  if (documento === undefined) return <div aria-busy="true" aria-label="Abriendo el editor" className="fixed inset-0 z-50 bg-fondo" />;
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Abriendo el editor" className="fixed inset-0 z-50 bg-fondo" />}>
      <EditorBoceto
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
      <Boton icono={Pencil} onClick={() => setEditando(0)}>
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
const cuandoFirmo = (iso: string) => (new Date(iso).toDateString() === new Date().toDateString() ? `hoy a las ${soloHora.format(new Date(iso))}` : `el ${fechaHora(iso)}`);

function FirmaTomada({ valor, documento }: { valor: ValorFirma; documento: DocumentoBoceto | null | undefined }) {
  // La firma es un boceto de una sola hoja (ADR-0024).
  const trazos = documento ? hojasDe(documento)[0] : undefined;
  return (
    <>
      {trazos && (
        <div className="rounded-control border border-division bg-panel p-2">
          <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={`Firma de ${valor.nombre}`} className="max-h-32" />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-cuerpo font-bold">
          {valor.nombre}
          {valor.cargo ? ` · ${valor.cargo}` : ""}
        </span>
        <span className="text-ayuda text-texto-secundario">Firmó {cuandoFirmo(valor.firmadoEn)}</span>
      </div>
    </>
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
        <FirmaTomada valor={firma} documento={documento} />
      ) : propio ? (
        <>
          <p className="text-cuerpo leading-relaxed text-texto-secundario">Vas a entregar el teléfono a quien te recibió. Firma una constancia de que estuviste en el sitio hoy.</p>
          <div className="flex flex-col gap-0.5 rounded-panel bg-panel px-4.5 py-4">
            <strong className="text-cuerpo">Constancia de visita</strong>
            <span className="text-ayuda text-texto-secundario">{`${visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "Este sitio"} · ${diaCorto.format(new Date())}`}</span>
          </div>
        </>
      ) : (
        <p className="text-ayuda text-texto-secundario">Entrégale el teléfono a quien recibió la visita: firma una constancia de que estuviste en el sitio.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      {firma ? (
        <Boton variante="fantasma" className="self-start" onClick={() => setConfirmando(true)}>
          Volver a firmar
        </Boton>
      ) : propio ? (
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
    try {
      for (const original of originales) {
        const archivo = await procesarFoto(original, new Date());
        await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
        alGuardar();
      }
      // Las fotos suben por adelantado cuando hay señal (ADR-0003).
      sincronizarEnSegundoPlano();
    } catch (error) {
      // El técnico ve un mensaje simple; soporte necesita la causa (ADR-0017).
      console.error("No se pudo guardar la foto", error);
      setFallo("No se pudo guardar la foto. Tómala de nuevo.");
    } finally {
      setProcesando(false);
    }
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
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  envio: EstadoDeEnvio | null;
  servidor: EstadoServidor | null;
  volver: () => void;
}) {
  const enLinea = useServidorAlcanzable();
  // El avance real: cuántos de sus archivos (fotos, bocetos, firma) ya subieron, y si oficina lo recibió.
  const huellas = archivosReferenciados(levantamiento.respuestas);
  const totalArchivos = huellas.length;
  const subidos = useLiveQuery(async () => (await db.archivos.bulkGet(huellas)).filter((a) => a && a.subida === "subida").length, [huellas.join(",")]);
  const recibido = Boolean(servidor) || envio?.estado === "recibido";
  const proceso: EstadoDeProceso = recibido ? "listo" : envio?.estado === "error" ? "error" : !enLinea || envio?.ultimoError?.codigo === "sin_conexion" ? "esperando" : "enviando";
  // La siguiente visita, si hay otra: el botón lleva a ella.
  const siguienteVisita = useLiveQuery(async () => {
    if (!levantamiento.tecnicoId) return null;
    const hoy = new Date().toLocaleDateString("en-CA");
    const otras = (await visitasDe(db, levantamiento.tecnicoId)).filter((v) => v.id !== levantamiento.visitaId && !v.fueraDeAlcance && v.programadaPara >= hoy);
    return otras.sort((a, b) => a.programadaPara.localeCompare(b.programadaPara))[0] ?? null;
  }, [levantamiento.tecnicoId, levantamiento.visitaId]);
  // Lo que dijo el servidor en la bajada manda sobre el estado de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, enLinea) : null;
  const comentarios = servidor?.comentarios ?? [];
  // En una repetición, el comentario dice en cuál (iteración 9).
  const sobre = (c: { seccion?: string | undefined; campo?: string | undefined }) =>
    c.seccion && c.campo ? nombreDeDato(formato, levantamiento.repeticiones ?? {}, c.seccion, c.campo, true) : undefined;
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
                    ? (estado?.texto ?? "Intenta de nuevo.")
                    : "Puedes salir de esta pantalla: el envío sigue solo."
            }
            etapas={[
              { texto: "Guardado en el teléfono", estado: "hecho" },
              {
                texto: totalArchivos > 0 ? `Fotos y dibujos · ${recibido ? totalArchivos : (subidos ?? 0)} de ${totalArchivos}` : "Datos del levantamiento",
                estado: recibido || (totalArchivos > 0 && subidos === totalArchivos) ? "hecho" : proceso === "error" ? "error" : proceso === "enviando" ? "en_curso" : "espera",
              },
              { texto: recibido ? "Recibido en oficina" : "Llega a oficina", estado: recibido ? "hecho" : proceso === "enviando" && (totalArchivos === 0 || subidos === totalArchivos) ? "en_curso" : "espera" },
            ]}
          />
          {!recibido && estado && <p className="-mt-2 text-center text-ayuda text-texto-secundario">{estado.texto}</p>}
          {envio?.estado === "error" && (
            <Boton
              onClick={async () => {
                await repositorio.reintentarEnvio(levantamiento.id);
                sincronizarEnSegundoPlano();
              }}
            >
              Reintentar envío
            </Boton>
          )}
          <BotonSiguiente onClick={volver}>
            {siguienteVisita ? (
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span>Siguiente visita</span>
                <span className="max-w-full truncate text-ayuda font-bold opacity-75">{`${siguienteVisita.cliente.nombre} · ${siguienteVisita.sitio.nombre}`}</span>
              </span>
            ) : (
              "Ir a mis visitas"
            )}
          </BotonSiguiente>
        </>
      ) : (
        estado && (
          <div className="flex flex-col gap-3 rounded-panel bg-panel p-4">
            <p className={`text-cuerpo font-bold ${claseDeTono[estado.tono]}`} aria-live="polite">
              {estado.texto}
            </p>
          </div>
        )
      )}
      {comentarios.length > 0 && (
        <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
          <h2 id="titulo-comentarios" className="text-subtitulo font-extrabold">
            Comentarios de oficina
          </h2>
          <ul className="flex flex-col divide-y divide-division">
            {comentarios.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                <p className="text-ayuda text-texto-secundario">
                  {c.autor} · {fechaHora(c.creadoEn)}
                  {sobre(c) && ` · Sobre ${sobre(c)}`}
                </p>
                <p className="text-cuerpo whitespace-pre-line">{c.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <details open={levantamiento.estado !== "enviado" || undefined} className="group flex flex-col rounded-panel bg-panel [&[open]>summary]:mb-1">
        <summary className="flex min-h-tactil cursor-pointer items-center justify-between gap-3 rounded-panel px-4 text-cuerpo font-bold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
          Ver lo que enviaste
          <ChevronDown aria-hidden className="size-5 shrink-0 text-texto-secundario transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 px-2 pb-2 motion-safe:animate-aparecer">
      {bloques(formato, levantamiento.repeticiones ?? {}).map(({ seccion, clave, titulo }, _i, todos) =>
        agrupar(seccion.campos).map((grupo, g) => (
          <div key={`${clave}.${grupo[0]!.clave}`} className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-4">
            {g === 0 && todos.length > 1 && <h2 className="text-subtitulo font-extrabold">{titulo}</h2>}
            {grupo.map((campo) => {
              const valor = levantamiento.respuestas[clave]?.[campo.clave];
              return campo.tipo === "foto" && !esNoObtenido(valor) ? (
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
              );
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
