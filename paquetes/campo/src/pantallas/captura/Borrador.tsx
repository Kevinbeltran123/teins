import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { pasosDe, type Paso } from "../../recorrido";
import { cifrasDelBorrador, claveDeError, progreso, resumenDePaso } from "../../resumen";
import { useLiveQuery } from "dexie-react-hooks";
import { bloques, claveDeRepeticion, type DefinicionSeccion, type TablaDeMedidas, esFirma, leerClave, fotosReferenciadas, nombreDeDato, rutaLegible, sinRespuestasHuerfanas, type CodigoErrorValidacion, type DefinicionCampo, type ErrorValidacion, type Valor, type VersionFormato } from "@teins/dominio";
import { Aviso, BarraDePaso, Boton, BotonSiguiente, CifrasDeRepaso, EncabezadoDePaso, FilaDeRepaso, FranjaSincronizacion, ListaRecorrido, PasoDelRecorrido, Repaso, conTransicion, type EstadoDePaso, CircleAlert, Confirmacion, Dialogo, ListaFaltantes, type DatoFaltante, Send, Smartphone, TriangleAlert, Trash } from "@teins/ui";
import { db, repositorio } from "../../datos/instancia";
import { cuantosPorSubir, momentosDeArchivos } from "../../datos/lecturasDeCaptura";
import { huellasConSello, sugerenciaDeLlegada } from "../../llegada";
import type { LevantamientoLocal } from "../../datos/modelo";
import { mensajeDeValidacion } from "../../mensajes";
import { useServidorAlcanzable } from "../../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../../sincronizacion/disparar";
import { PasoCroquis } from "./Boceto";
import { Campo } from "./Campo";
import { TablaDeCampos } from "./TablaDeCampos";
import { MiniaturaDeFirma, soloHora } from "./Firma";
import { MiniaturasDeFotos } from "./Fotos";
import { Repeticion, Repeticiones } from "./Repeticiones";
import { anclaDeDato, anclaDeSeccion, CabeceraDeLaVisita, PasoPropio, SugerenciaDeLlegada, VigilarGuardado } from "./contexto";

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

const faltan = (n: number) => (n === 1 ? "Falta 1 dato" : `Faltan ${n} datos`);

const huellasDe = (valor: Valor | undefined): string[] => (Array.isArray(valor) && valor.every((x) => typeof x === "string") ? (valor as string[]) : []);

export function Borrador({
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
  const porSubir = useLiveQuery(() => cuantosPorSubir(db), []);
  // La llegada que se sugiere en un campo de horario sale de la foto de llegada (ADR-0050): solo se sugiere.
  const deLlegada = huellasConSello(formato, actual.respuestas);
  const tomadasEn = useLiveQuery(() => momentosDeArchivos(db, deLlegada), [deLlegada.join()]);
  const llegada = sugerenciaDeLlegada(formato, actual.respuestas, actual.creadoEn, tomadasEn ?? new Map());
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

  /** Desde la hoja de lo que falta en un paso: un dato de una repetición no está en la lista del paso, se abre primero. */
  function completarDesdeLaHoja(e: ErrorValidacion) {
    setFaltantesDelPaso(null);
    if (leerClave(e.seccion).repeticion && e.campo) irAlDato(e);
    else setTimeout(() => irAlError(e), 250);
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

  /**
   * Los campos de un paso o de una repetición. Los que pertenecen a una tabla de medidas de la sección se dibujan juntos,
   * como la tabla, donde está el primero de ellos; los demás se saltan (ADR-0050). El progreso no cambia: sale de la
   * validación, que sigue viendo un campo por celda.
   */
  const campos = (lista: readonly DefinicionCampo[], clave: string, seccion: DefinicionSeccion) => {
    const enLista = new Map(lista.map((c) => [c.clave, c] as const));
    const dibujadas = new Set<TablaDeMedidas>();
    return lista.map((campo) => {
      const tabla = seccion.tablas?.find((t) => t.filas.some((f) => f.campos.includes(campo.clave)));
      if (tabla) {
        if (dibujadas.has(tabla)) return null;
        dibujadas.add(tabla);
        return <TablaDeCampos key={`${clave}.tabla.${campo.clave}`} id={id} seccion={clave} tabla={tabla} campos={enLista} respuestas={actual.respuestas[clave]} alGuardar={(c) => alGuardar(clave, c)} />;
      }
      return (
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
      );
    });
  };
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
            <PasoPropio.Provider value={paso.campos.length === 1}>{campos(paso.campos, paso.seccion.clave, paso.seccion)}</PasoPropio.Provider>
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
        {campos(seccion.campos, claveDeRepeticion(seccion.clave, r.id), seccion)}
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
          <CifrasDeRepaso cifras={cifrasDelBorrador(pasos, actual, fotosDelBorrador)} />
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
                <FilaDeRepaso key={p.id} titulo={p.titulo} detalle={resumenDePaso(p, actual)} falta={n > 0 ? faltan(n) : undefined} vacio={!tocado(p)} onEditar={() => ir({ tipo: "paso", paso: p.id }, "atras")}>
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
      <SugerenciaDeLlegada.Provider value={llegada}>
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
                onClick={() => completarDesdeLaHoja(faltanDelPaso[0]!)}
              >
                Completar ahora
              </Boton>
            </>
          }
        >
          <ul className="flex flex-col gap-2">
            {faltanDelPaso.map((e, i) => {
              const d = datoFaltante(e, () => completarDesdeLaHoja(e));
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
      </SugerenciaDeLlegada.Provider>
    </VigilarGuardado.Provider>
  );
}
