import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  bloques,
  claveDeRepeticion,
  crearMedida,
  describirValor,
  esBoceto,
  esCantidades,
  esNoObtenido,
  leerClave,
  LIENZO,
  normalizarDecimal,
  LIMITES,
  nombreDeDato,
  rutaLegible,
  validarRespuestas,
  type CodigoErrorValidacion,
  type DefinicionCampo,
  type DefinicionSeccion,
  type ErrorValidacion,
  type Valor,
  type ValorMedida,
  type VersionFormato,
} from "@teins/dominio";
import {
  Aviso,
  Boceto,
  Boton,
  BotonIcono,
  CampoFotos,
  CampoMedida,
  CampoTexto,
  ChevronLeft,
  Confirmacion,
  EditorCantidades,
  EsqueletoBloques,
  EtiquetaCampo,
  Insignia,
  MarcaNoObtenido,
  MensajeError,
  Pencil,
  Plus,
  Send,
  TablaCantidades,
  Trash,
  useNotificar,
  ValorLeido,
  type LineaEditable,
} from "@teins/ui";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { estadoDe, visitaDe } from "../datos/lecturas";
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
const claveDeError = (seccion: string, campo: string) => `${seccion}.${campo}`;
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

      <main className={`mx-auto flex max-w-xl flex-col gap-6 px-4 py-5 ${borrador && formato && !bloqueado ? "pb-36" : ""}`}>
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
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} />
        ) : bloqueado ? (
          <>
            <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>
            <Enviado levantamiento={levantamiento} formato={formato} envio={null} servidor={null} />
          </>
        ) : (
          <Borrador id={id} formato={formato} inicial={inicial} actual={levantamiento} />
        )}
      </main>
    </div>
  );
}

/** Panel por grupo (DESIGN.md): campos de datos seguidos juntos; cada campo de fotos, bocetos o cantidades aparte. */
function agrupar(campos: readonly DefinicionCampo[]): DefinicionCampo[][] {
  const grupos: DefinicionCampo[][] = [];
  const solo = (c: DefinicionCampo) => c.tipo === "foto" || c.tipo === "boceto" || c.tipo === "cantidades";
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

function Borrador({ id, formato, inicial, actual }: { id: string; formato: VersionFormato; inicial: LevantamientoLocal; actual: LevantamientoLocal }) {
  const [errores, setErrores] = useState<readonly ErrorValidacion[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const resumen = useRef<HTMLDivElement>(null);
  const porClave: ReadonlyMap<string, CodigoErrorValidacion> = new Map((errores ?? []).map((e) => [claveDeError(e.seccion, e.campo ?? ""), e.codigo]));
  const { errores: pendientes, obligatorios, completos } = progreso(formato, actual);

  function mostrarErrores(lista: readonly ErrorValidacion[]) {
    setErrores(lista);
    requestAnimationFrame(() => {
      resumen.current?.scrollIntoView({ block: "start" });
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

  // Al corregir, el error de ese campo se va: la validación completa se repite al enviar.
  const alGuardar = (seccion: string, campo: string) => {
    if (porClave.has(claveDeError(seccion, campo))) setErrores((lista) => (lista ?? []).filter((e) => claveDeError(e.seccion, e.campo ?? "") !== claveDeError(seccion, campo)));
  };

  const erroresPorSeccion = new Map<string, number>();
  for (const e of errores ?? []) {
    const seccion = leerClave(e.seccion).seccion;
    erroresPorSeccion.set(seccion, (erroresPorSeccion.get(seccion) ?? 0) + 1);
  }

  return (
    <>
      {errores && errores.length > 0 && (
        <div ref={resumen} tabIndex={-1} className="scroll-mt-4 focus:outline-none">
          <Aviso tono="error">
            <p className="font-bold">{errores.length === 1 ? "Falta 1 dato por completar." : `Faltan ${errores.length} datos por completar.`}</p>
            <ul className="mt-1 flex flex-col" aria-label="Datos por completar">
              {errores.map((e) => (
                <li key={`${claveDeError(e.seccion, e.campo ?? "")}:${e.codigo}`}>
                  <button
                    type="button"
                    onClick={() => irAlError(e)}
                    className="min-h-control-sm py-2 text-left font-bold text-superficie underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-superficie"
                  >
                    {e.campo ? nombreDeDato(formato, actual.repeticiones ?? {}, e.seccion, e.campo) : rutaLegible(formato, actual.repeticiones ?? {}, e.seccion)}
                  </button>
                </li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}

      {/* Con varias secciones: saltar a cada una y ver dónde falta algo después de intentar enviar. */}
      {formato.secciones.length > 1 && (
        <nav aria-label="Secciones" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {formato.secciones.map((s) => {
            const n = erroresPorSeccion.get(s.clave) ?? 0;
            return (
              <a
                key={s.clave}
                href={`#${anclaDeSeccion(s.clave)}`}
                className="inline-flex min-h-control-sm shrink-0 items-center gap-1.5 rounded-control border border-borde-suave bg-panel px-3 text-ayuda font-bold text-texto no-underline hover:bg-panel-hundido focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
              >
                {s.titulo}
                {n > 0 && <span className="text-error">{n === 1 ? "· falta 1" : `· faltan ${n}`}</span>}
              </a>
            );
          })}
        </nav>
      )}

      {formato.secciones.map((seccion) =>
        seccion.repetible ? (
          <SeccionRepetible key={seccion.clave} id={id} formato={formato} seccion={seccion} inicial={inicial} actual={actual} errores={porClave} alGuardar={alGuardar} />
        ) : (
          <section key={seccion.clave} id={anclaDeSeccion(seccion.clave)} aria-labelledby={`titulo-${seccion.clave}`} className="flex scroll-mt-4 flex-col gap-3">
            <h2 id={`titulo-${seccion.clave}`} className="text-subtitulo font-extrabold">
              {seccion.titulo}
            </h2>
            {agrupar(seccion.campos).map((grupo) => (
              <div key={`${seccion.clave}.${grupo[0]!.clave}`} className="flex flex-col gap-6 rounded-panel border border-division bg-panel p-4">
                {grupo.map((campo) => (
                  <Campo
                    key={campo.clave}
                    id={id}
                    seccion={seccion.clave}
                    campo={campo}
                    inicial={inicial.respuestas[seccion.clave]?.[campo.clave]}
                    actual={actual.respuestas[seccion.clave]?.[campo.clave]}
                    error={porClave.get(claveDeError(seccion.clave, campo.clave))}
                    alGuardar={() => alGuardar(seccion.clave, campo.clave)}
                  />
                ))}
              </div>
            ))}
          </section>
        ),
      )}

      {/* La acción de la pantalla, abajo y al alcance del pulgar; lo que falta, a su lado (DESIGN.md). */}
      <div data-barra-inferior className="fixed inset-x-0 bottom-0 z-20 border-t border-division bg-panel">
        <div className="mx-auto flex max-w-xl items-center gap-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex min-w-28 flex-col gap-1">
            <span className="text-cuerpo leading-tight font-bold">{pendientes.length === 0 ? "Listo para enviar" : `Faltan ${pendientes.length}`}</span>
            {obligatorios > 0 && (
              <>
                <progress
                  value={completos}
                  max={obligatorios}
                  aria-label="Datos obligatorios completos"
                  className="h-1.5 w-full appearance-none overflow-hidden rounded-control [&::-moz-progress-bar]:bg-superficie [&::-webkit-progress-bar]:bg-division [&::-webkit-progress-value]:bg-superficie"
                />
                <span className="text-ayuda leading-tight text-texto-secundario">{`${completos} de ${obligatorios} obligatorios`}</span>
              </>
            )}
          </div>
          <Boton variante="principal" icono={Send} className="grow" onClick={intentarEnviar}>
            Enviar a oficina
          </Boton>
        </div>
      </div>

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
 * Sección repetible (iteración 9): cada repetición con su nombre y los mismos campos. Agregar y quitar
 * también son parte del borrador: se guardan en el teléfono al instante, como cualquier dato.
 */
function SeccionRepetible({
  id,
  formato,
  seccion,
  inicial,
  actual,
  errores,
  alGuardar,
}: {
  id: string;
  formato: VersionFormato;
  seccion: DefinicionSeccion;
  inicial: LevantamientoLocal;
  actual: LevantamientoLocal;
  errores: ReadonlyMap<string, CodigoErrorValidacion>;
  alGuardar: (seccion: string, campo: string) => void;
}) {
  const [quitando, setQuitando] = useState<{ id: string; nombre: string } | null>(null);
  const lista = actual.repeticiones?.[seccion.clave] ?? [];
  const etiqueta = seccion.repetible!.etiqueta;
  const maximo = seccion.repetible!.max ?? LIMITES.repeticiones;
  const errorDeSeccion = errores.get(claveDeError(seccion.clave, ""));
  const tituloId = `titulo-${seccion.clave}`;

  async function agregar() {
    await repositorio.agregarRepeticion(id, formato, seccion.clave, new Date());
    alGuardar(seccion.clave, "");
  }

  return (
    <section id={anclaDeSeccion(seccion.clave)} aria-labelledby={tituloId} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={tituloId} className="text-subtitulo font-extrabold">
        {seccion.titulo}
      </h2>
      {errorDeSeccion && <Aviso tono="error">{mensajeDeValidacion[errorDeSeccion]}</Aviso>}
      {lista.length === 0 && <p className="text-ayuda text-texto-secundario">Todavía no hay ninguno. Si aplica, agrégalo con el botón.</p>}
      {lista.map((r) => {
        const clave = claveDeRepeticion(seccion.clave, r.id);
        return (
          <article key={r.id} aria-label={r.nombre} className="flex flex-col gap-6 rounded-panel border border-division bg-panel p-4">
            <CampoTexto
              etiqueta={`Nombre (${etiqueta.toLowerCase()})`}
              valorInicial={r.nombre}
              error={errorDeSeccion === "nombre_de_repeticion_invalido" ? mensajeDeValidacion.nombre_de_repeticion_invalido : undefined}
              onCambio={(texto) => {
                // Un nombre vacío no se guarda: se conserva el anterior.
                if (texto.trim()) void repositorio.renombrarRepeticion(id, seccion.clave, r.id, texto.trim(), new Date());
              }}
            />
            {seccion.campos.map((campo) => (
              <Campo
                key={campo.clave}
                id={id}
                seccion={clave}
                campo={campo}
                inicial={inicial.respuestas[clave]?.[campo.clave]}
                actual={actual.respuestas[clave]?.[campo.clave]}
                error={errores.get(claveDeError(clave, campo.clave))}
                alGuardar={() => alGuardar(clave, campo.clave)}
              />
            ))}
            <div>
              <Boton variante="fantasma" tamano="pequeno" icono={Trash} aria-label={`Quitar ${r.nombre}`} onClick={() => setQuitando(r)}>
                Quitar
              </Boton>
            </div>
          </article>
        );
      })}
      <Boton icono={Plus} disabled={lista.length >= maximo} onClick={() => void agregar()}>
        {`Agregar ${etiqueta.toLowerCase()}`}
      </Boton>
      {lista.length >= maximo && <p className="text-ayuda text-texto-secundario">{`Este formato permite hasta ${maximo}.`}</p>}
      {quitando && (
        <Confirmacion
          forma="inferior"
          peligro
          titulo={`¿Quitar ${quitando.nombre}?`}
          confirmar={`Quitar ${etiqueta.toLowerCase()}`}
          accion={() => repositorio.quitarRepeticion(id, seccion.clave, quitando.id, new Date())}
          mensajeDeError={() => "No se pudo quitar. Intenta de nuevo."}
          alCerrar={() => setQuitando(null)}
          alTerminar={() => alGuardar(seccion.clave, "")}
        >
          <p>Se borra lo que llenaste en {quitando.nombre}. Las fotos que tomaste en él también dejan de ir en el levantamiento.</p>
        </Confirmacion>
      )}
    </section>
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
  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    esCantidades(inicial) ? inicial.map((l) => ({ id: l.id, descripcion: l.descripcion, cantidad: l.cantidad.replace(".", ","), unidad: l.unidad, observacion: l.observacion ?? "" })) : [],
  );
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
          })),
    );
  }
  return <EditorCantidades etiqueta={campo.etiqueta} lineas={lineas} unidades={unidades} onCambio={cambiar} nuevoId={nuevoIdDeRepeticion} obligatorio={campo.obligatorio} error={error} />;
}

/** Boceto (ADR-0019): miniatura y editor a pantalla completa. El documento vive en el archivo local. */
function useBoceto(valor: Valor | undefined) {
  const huella = esBoceto(valor) ? valor.boceto : undefined;
  return useLiveQuery(async () => (huella ? repositorio.obtenerBoceto(huella) : null), [huella]);
}

function CampoBoceto({ id, seccion, campo, actual, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; actual: Valor | undefined; error: string | undefined; alGuardar: () => void }) {
  const documento = useBoceto(actual);
  const [editando, setEditando] = useState(false);
  const hayDibujo = Boolean(documento && documento.elementos.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <EtiquetaCampo obligatorio={campo.obligatorio}>{campo.etiqueta}</EtiquetaCampo>
      {hayDibujo ? (
        <Boceto ancho={LIENZO.ancho} alto={LIENZO.alto} cuadricula={LIENZO.cuadricula} elementos={documento!.elementos} etiqueta={`Boceto de ${campo.etiqueta.toLowerCase()}`} className="rounded-control border border-division" />
      ) : (
        <p className="text-ayuda text-texto-secundario">Todavía no hay boceto.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      <Boton icono={Pencil} onClick={() => setEditando(true)}>
        {hayDibujo ? "Editar boceto" : "Dibujar boceto"}
      </Boton>
      {editando && (
        <Suspense fallback={<div aria-busy="true" aria-label="Abriendo el editor" className="fixed inset-0 z-50 bg-fondo" />}>
          <EditorBoceto
            etiqueta={campo.etiqueta}
            inicial={documento ?? null}
            guardar={async (d) => {
              await repositorio.guardarBoceto(id, seccion, campo.clave, d, new Date());
              alGuardar();
            }}
            cerrar={() => setEditando(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function BocetoLeido({ etiqueta, valor }: { etiqueta: string; valor: Valor | undefined }) {
  const documento = useBoceto(valor);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      {documento ? (
        <Boceto ancho={LIENZO.ancho} alto={LIENZO.alto} cuadricula={LIENZO.cuadricula} elementos={documento.elementos} etiqueta={`Boceto de ${etiqueta.toLowerCase()}`} className="rounded-control border border-division" />
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
      <CampoFotos etiqueta={campo.etiqueta} obligatorio={campo.obligatorio} error={error} fotos={fotos} procesando={procesando} onAgregar={agregar} onQuitar={(h) => void quitar(h)} />
      {fallo && <Aviso tono="error">{fallo}</Aviso>}
    </div>
  );
}

function Enviado({
  levantamiento,
  formato,
  envio,
  servidor,
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  envio: EstadoDeEnvio | null;
  servidor: EstadoServidor | null;
}) {
  const enLinea = useServidorAlcanzable();
  // Lo que dijo el servidor en la bajada manda sobre el estado de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, enLinea) : null;
  const comentarios = servidor?.comentarios ?? [];
  // En una repetición, el comentario dice en cuál (iteración 9).
  const sobre = (c: { seccion?: string | undefined; campo?: string | undefined }) =>
    c.seccion && c.campo ? nombreDeDato(formato, levantamiento.repeticiones ?? {}, c.seccion, c.campo, true) : undefined;
  return (
    <>
      {estado && (
        <div className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
          <p className={`text-cuerpo font-bold ${claseDeTono[estado.tono]}`} aria-live="polite">
            {estado.texto}
          </p>
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
        </div>
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
              ) : (
                <ValorLeido key={campo.clave} etiqueta={campo.etiqueta}>
                  {describirValor(campo, valor)}
                </ValorLeido>
              );
            })}
          </div>
        )),
      )}
    </>
  );
}

function FotosLeidas({ etiqueta, ids }: { etiqueta: string; ids: readonly string[] }) {
  const fotos = useUrlsDeFotos(ids);
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
