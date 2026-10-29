import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { v7 as uuidv7 } from "uuid";
import { crearLevantamiento, fotosReferenciadas, sinRespuestasHuerfanas, type VersionFormato } from "@teins/dominio";
import { Activity, Aviso, Boton, BotonSiguiente, Building, CalendarDays, CircleAlert, CircleCheck, Clock, Eye, Pencil, Confirmacion, Dialogo, EsqueletoBloques, EstadoVacio, FilaDeAjuste, FilaDeTema, FranjaSincronizacion, GrupoDeAjustes, Insignia, LockKeyhole, MapPin, Send, Smartphone, nombreDeTransicion, Trash, useMinuto, useNombreEnPantalla, useNotificar, useSinRepetir } from "@teins/ui";
import { resumenDeRecorrido } from "../recorrido";
import { nuevoIdDeRepeticion } from "../datos/dexie";
import { db, repositorio } from "../datos/instancia";
import { useLecturaRecordada } from "../datos/lecturaRecordada";
import { bajadaDe, enColaPorLevantamiento, enviosDe, estadosDe, leidoPorLevantamiento, visitasDe } from "../datos/lecturas";
import type { EstadoDeEnvio, EstadoServidor, LevantamientoLocal, UsuarioLocal, VisitaLocal } from "../datos/modelo";
import { estaInstalada } from "../dispositivo/almacenamiento";
import { plataforma } from "../dispositivo/instalacion";
import { useConexionDelNavegador, useServidorAlcanzable } from "../dispositivo/useConexion";
import { formatoDe, nombreDeFormato, useFormatos, vigentes } from "../formatos";
import { claseDeTono, estadoCorto } from "../mensajes";
import { horaDelChat, sinLeerDe, ultimoDeOficina } from "../conversacion";
import { ponerInsignia } from "../dispositivo/insignia";
import { terminarVisita } from "../datos/terminacion";
import { sincronizarEnSegundoPlano } from "../sincronizacion/disparar";
import { agendaDeVisitas, cuandoSePodraIniciar, enCurso, fechaDeVisita, horaCorta, horaDe, horarioDeVisita, hoyLocal, sePuedeIniciar, terminadaEn } from "../visitas";
import { permisoLocal } from "../sesion/permiso";
import { VERSION_APP } from "../version";
import { AvisoDeAlmacenamiento } from "./AvisoDeAlmacenamiento";

// Secundarias: no entran en el JavaScript inicial (ADR-0011).
const SugerirLlave = lazy(() => import("./SugerirLlave"));
const TarjetaAvisos = lazy(() => import("./TarjetaAvisos"));
const HojaCambiarContrasena = lazy(() => import("./HojaCambiarContrasena"));
// La papelera (ADR-0035): solo al abrirla, dentro de "Tu cuenta".
const Papelera = lazy(() => import("./Papelera"));
const GuiaDeInstalacion = lazy(() => import("./InstalarApp").then((m) => ({ default: m.GuiaDeInstalacion })));
const Diagnostico = lazy(() => import("./Diagnostico").then((m) => ({ default: m.Diagnostico })));

interface Props {
  usuario: UsuarioLocal;
  /** `chat`: abre directo el chat con oficina (iteración 46). */
  abrir: (id: string, chat?: boolean) => void;
  /** El levantamiento que se acaba de cerrar: se resalta en su lista (lo enviado, en "Enviados"). */
  recien?: string | undefined;
  /** Cambia cuando se pide abrir la papelera desde fuera ("Ver en Descartados" al descartar). */
  pedirPapelera?: number | undefined;
  /** Ya se abrió: el pedido no se repite cada vez que se vuelve al inicio (iteración 42). */
  papeleraAbierta?: () => void;
  pedirSesion: () => void;
  actualizacion: { disponible: boolean; aplicar: () => void };
}

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);
const levantamientos = (n: number) => (n === 1 ? "1 levantamiento" : `${n} levantamientos`);

/** Solo las fotos: las líneas de materiales también son una lista y no se cuentan (iteración 42). */
const contarFotos = (l: LevantamientoLocal) => fotosReferenciadas(sinRespuestasHuerfanas(l).respuestas).length;

const cerrarSesion = () => import("../sesion/sesion").then((m) => m.cerrarSesion());

/** Lo que la pantalla necesita para mostrar y crear levantamientos. */
interface Contexto {
  formatos: VersionFormato[];
  envios: Map<string, EstadoDeEnvio>;
  servidor: Map<string, EstadoServidor>;
  /** Por levantamiento: hasta dónde leyó el técnico su chat y cuántas respuestas esperan señal (ADR-0040). */
  chats: { leido: Map<string, string>; enCola: Map<string, number> };
  enLinea: boolean;
  /** Para nombrar un levantamiento por su cliente y sitio en las listas (iteración 32). */
  visitas: ReadonlyMap<string, VisitaLocal>;
  /** Vencido el permiso de trabajo local, no se crea ni se edita nada (ADR-0009, parte 2). */
  bloqueado: boolean;
  abrir: (id: string, chat?: boolean) => void;
  iniciar: (visitaId: string, formato: VersionFormato) => void;
  recien: string | undefined;
}

export function Inicio({ usuario, abrir, recien, pedirPapelera = 0, papeleraAbierta, pedirSesion, actualizacion }: Props) {
  // «Hoy», «En curso» y «Terminar visita» se recalculan con el paso del tiempo, también sin señal.
  useMinuto();
  // Al volver de una captura, el inicio empieza con lo que ya había leído: sin esqueleto (iteración 27).
  const lista = useLecturaRecordada(`lista:${usuario.id}`, () => repositorio.listar(usuario.id), [usuario.id]);
  const envios = useLecturaRecordada(`envios:${usuario.id}`, async () => new Map((await enviosDe(db, usuario.id)).map((e) => [e.levantamientoId, e])), [usuario.id]);
  const servidor = useLecturaRecordada(`servidor:${usuario.id}`, async () => new Map((await estadosDe(db, usuario.id)).map((e) => [e.id, e])), [usuario.id]);
  const visitas = useLecturaRecordada(`visitas:${usuario.id}`, () => visitasDe(db, usuario.id), [usuario.id]);
  // Sin abrir lo sellado: lo leído no lleva contenido y la cola se cuenta por lo que está a la vista.
  const chats = useLecturaRecordada(
    `chats:${usuario.id}`,
    async () => {
      const [leido, enCola] = await Promise.all([leidoPorLevantamiento(db, usuario.id), enColaPorLevantamiento(db, usuario.id)]);
      return { leido, enCola };
    },
    [usuario.id],
  );
  const bajada = useLecturaRecordada(`bajada:${usuario.id}`, () => bajadaDe(db, usuario.id), [usuario.id]);
  const formatos = useFormatos();
  const deOtros = useLecturaRecordada(`deOtros:${usuario.id}`, () => repositorio.contarDeOtros(usuario.id), [usuario.id]);
  const enLinea = useConexionDelNavegador();
  const alcanzable = useServidorAlcanzable();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  // La página de la cuenta que se ve, y hacia dónde se movió para animarla (iteración 32).
  const [pagina, setPagina] = useState<PaginaDeCuenta | null>(null);
  const [direccion, setDireccion] = useState<"adelante" | "atras" | null>(null);
  const irA = (nueva: PaginaDeCuenta | null) => {
    setDireccion(nueva ? "adelante" : "atras");
    setPagina(nueva);
  };
  const abrirCuenta = (en: PaginaDeCuenta | null = null) => {
    setPagina(en);
    setDireccion(null);
    setCuentaAbierta(true);
  };
  const descartados = useLecturaRecordada(`descartados:${usuario.id}`, async () => (await repositorio.descartados(usuario.id)).length, [usuario.id]);
  useEffect(() => {
    if (pedirPapelera === 0) return;
    abrirCuenta("descartados");
    papeleraAbierta?.();
  }, [pedirPapelera]);

  // Lo descartado (un envío que oficina rechazó, en la papelera) ya no está por enviar.
  const sinDescartar = new Set((lista ?? []).map((l) => l.id));
  const deEnvios = [...(envios?.values() ?? [])].filter((e) => sinDescartar.has(e.levantamientoId));
  const porEnviar = deEnvios.filter((e) => e.estado !== "recibido").length;
  // Un envío con error permanente no sube solo (se muestra en Enviados): no cuenta como «subiendo».
  const porSubir = deEnvios.filter((e) => e.estado !== "recibido" && e.estado !== "error").length;
  const esperanSesion = deEnvios.some((e) => e.estado === "requiere_sesion") || Boolean(bajada?.sesionVencida);
  const esperanActualizacion = deEnvios.some((e) => e.estado === "requiere_actualizar");
  const permisoVencido = permisoLocal(bajada, Date.now()) !== "vigente";
  const sinConexion = !enLinea || (!alcanzable && porSubir > 0);

  // Un doble toque crea uno solo. Creado, no se suelta: entre abrirlo y que la captura reemplace esta pantalla,
  // un segundo toque crearía otro.
  const iniciado = useRef(false);
  const [iniciar] = useSinRepetir(async (visitaId: string, formato: VersionFormato) => {
    if (iniciado.current) return;
    const visita = visitas?.find((v) => v.id === visitaId);
    // Defensa: la pantalla no ofrece el botón antes del día, y si por otro camino llega aquí, no se crea nada.
    if (visita && !sePuedeIniciar(visita, hoyLocal())) return;
    const levantamiento = crearLevantamiento(formato, uuidv7(), new Date(), visitaId, nuevoIdDeRepeticion);
    // Lo nombra aunque la visita salga del teléfono cuando ya esté atendida (iteración 42).
    await repositorio.crear(levantamiento, usuario.id, visita ? { cliente: visita.cliente.nombre, sitio: visita.sitio.nombre } : undefined);
    iniciado.current = true;
    abrir(levantamiento.id);
  });

  const cargando = lista === undefined || envios === undefined || servidor === undefined || visitas === undefined || bajada === undefined || formatos === undefined;
  const contexto: Contexto | undefined = cargando ? undefined : { formatos, envios, servidor, chats: chats ?? { leido: new Map(), enCola: new Map() }, visitas: new Map(visitas.map((v) => [v.id, v])), enLinea: alcanzable, bloqueado: permisoVencido, abrir, iniciar, recien };

  // Visitas con sus levantamientos; una reasignada solo se muestra si el técnico ya empezó algo en ella (regla 17).
  const porVisita = Map.groupBy(lista ?? [], (l) => l.visitaId ?? "");
  const visitasCon = (estado: LevantamientoLocal["estado"]) => new Set((lista ?? []).filter((l) => l.estado === estado && l.visitaId).map((l) => l.visitaId!));
  // Lo atendido no es la siguiente visita (iteración 40): sin nada pendiente, no hay siguiente.
  const { pendientes, atendidasHoy } = agendaDeVisitas(
    (visitas ?? []).filter((v) => !v.fueraDeAlcance || porVisita.has(v.id)),
    hoyLocal(),
    visitasCon("borrador"),
    visitasCon("enviado"),
  );
  const [siguiente, ...otras] = pendientes;
  const idsMostradas = new Set([...pendientes, ...atendidasHoy].map((v) => v.id));
  const sueltos = (lista ?? []).filter((l) => !l.visitaId || !idsMostradas.has(l.visitaId));

  // Lo que no entró va aparte y arriba: es lo único de la lista que pide hacer algo (iteración 32).
  const noEntraron = (lista ?? []).filter((l) => l.estado === "enviado" && envios?.get(l.id)?.estado === "error" && !servidor?.has(l.id));
  // Lo que oficina escribió y el técnico no ha leído sube también (iteración 46): el aviso se puede perder; esto no. Al
  // leerlo vuelve a «Enviados». El más reciente primero.
  const sinLeerEn = (l: LevantamientoLocal) => sinLeerDe(servidor?.get(l.id), chats?.leido.get(l.id) ?? null);
  const porResponder = (lista ?? [])
    .filter((l) => l.estado === "enviado" && !noEntraron.includes(l) && sinLeerEn(l) > 0)
    .sort((a, b) => ultimoDeOficina(servidor?.get(b.id)).localeCompare(ultimoDeOficina(servidor?.get(a.id))));
  const enviados = (lista ?? []).filter((l) => l.estado === "enviado" && !noEntraron.includes(l) && !porResponder.includes(l));
  // El número del ícono (iteración 46): solo con todo leído, para no apagarlo mientras la pantalla aún carga.
  useEffect(() => {
    if (!cargando && chats !== undefined) void ponerInsignia(porResponder.length);
  }, [cargando, chats, porResponder.length]);
  const borradoresSueltos = sueltos.filter((l) => l.estado === "borrador");
  const primerNombre = usuario.nombre.split(" ")[0] ?? usuario.nombre;

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-4 pb-2">
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <p className="text-ayuda font-extrabold text-texto-secundario first-letter:uppercase">{hoyLargo.format(new Date())}</p>
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{`Hola, ${primerNombre}`}</h1>
          </div>
          <button
            type="button"
            onClick={() => abrirCuenta()}
            aria-label="Tu cuenta"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-panel-hundido text-ayuda font-extrabold active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {iniciales(usuario.nombre)}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-1 pb-10">
        <FranjaSincronizacion enLinea={!sinConexion} porSubir={porSubir} />
        <div className="flex flex-col gap-3 empty:hidden">
          {permisoVencido && <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>}
          {esperanSesion && (
            <Aviso tono="alerta">
              <p>Tu sesión venció. Inicia sesión para enviar lo pendiente y recibir tus visitas.</p>
              <Boton className="mt-3 w-full" onClick={pedirSesion}>
                Iniciar sesión
              </Boton>
            </Aviso>
          )}
          {esperanActualizacion && <Aviso tono="alerta">Esta versión de la app ya no puede enviar. Actualízala para enviar lo pendiente; nada se pierde.</Aviso>}
          {/* Una línea, no un bloque: la visita de hoy sigue siendo lo primero (crítica del rediseño, problema 14). */}
          {!estaInstalada() && (
            <div className="flex items-center gap-3 rounded-panel border border-dashed border-borde-suave py-1.5 pr-1.5 pl-4 text-ayuda text-texto-secundario">
              <Smartphone aria-hidden className="size-5 shrink-0" />
              <p className="grow">
                Instala TEINS para no perder datos.
                {/* En iPhone la app instalada no comparte datos con Safari (ADR-0023). */}
                {plataforma() === "iphone" && " Antes, envía lo que tengas en Safari."}
              </p>
              <Boton variante="fantasma" tamano="pequeno" onClick={() => setGuiaAbierta(true)}>
                Cómo instalarla
              </Boton>
            </div>
          )}
          {actualizacion.disponible && (
            <Aviso>
              <p>Hay una versión nueva de la app. Tus levantamientos se conservan.</p>
              <Boton className="mt-3 w-full" onClick={actualizacion.aplicar}>
                Actualizar la app
              </Boton>
            </Aviso>
          )}
        </div>

        {!contexto ? (
          <EsqueletoBloques etiqueta="Cargando visitas" altos={["alto", "bajo"]} />
        ) : (
          <>
            {siguiente && <VisitaFocal visita={siguiente} levantamientos={porVisita.get(siguiente.id) ?? []} contexto={contexto} />}

            {pendientes.length === 0 && (
              <EstadoVacio icono={CalendarDays} titulo={atendidasHoy.length > 0 ? "No tienes visitas pendientes" : "Sin visitas asignadas"}>
                {!bajada?.ultimaEn && !alcanzable ? (
                  "Conéctate para descargar tus visitas y los formatos."
                ) : !bajada?.ultimaEn ? (
                  <span aria-busy="true">Descargando tus visitas…</span>
                ) : (
                  "Cuando oficina te asigne una visita, aparece aquí al tener señal."
                )}
              </EstadoVacio>
            )}

            {(noEntraron.length > 0 || porResponder.length > 0) && (
              <section aria-labelledby="titulo-atencion" className="flex flex-col gap-2.5">
                <h2 id="titulo-atencion" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Necesita atención
                </h2>
                {noEntraron.length > 0 && <Filas levantamientos={noEntraron} contexto={contexto} atencion />}
                {porResponder.length > 0 && <Filas levantamientos={porResponder} contexto={contexto} />}
              </section>
            )}

            {/* Bajo la siguiente visita: la acción principal de la pantalla sigue siendo la de la visita. */}
            <Suspense fallback={null}>
              <TarjetaAvisos usuarioId={usuario.id} enLinea={alcanzable} />
            </Suspense>

            {otras.length > 0 && (
              <section aria-labelledby="titulo-otras" className="flex flex-col gap-2.5">
                <h2 id="titulo-otras" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Después
                </h2>
                {otras.map((v) => (
                  <FilaVisita key={v.id} visita={v} levantamientos={porVisita.get(v.id) ?? []} contexto={contexto} />
                ))}
              </section>
            )}

            {/* Lo atendido hoy, aparte y al final: por si hace falta otro levantamiento en la misma visita. */}
            {atendidasHoy.length > 0 && (
              <section aria-labelledby="titulo-atendidas" className="flex flex-col gap-2.5">
                <h2 id="titulo-atendidas" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Atendidas hoy
                </h2>
                {atendidasHoy.map((v) => (
                  <FilaVisita key={v.id} visita={v} levantamientos={porVisita.get(v.id) ?? []} contexto={contexto} />
                ))}
              </section>
            )}

            {borradoresSueltos.length > 0 && (
              <section aria-labelledby="titulo-sueltos" className="flex flex-col gap-2.5">
                <h2 id="titulo-sueltos" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Sin terminar
                </h2>
                <Filas levantamientos={borradoresSueltos} contexto={contexto} />
              </section>
            )}

            {enviados.length > 0 && (
              <section aria-labelledby="titulo-enviados" className="flex flex-col gap-2.5">
                <h2 id="titulo-enviados" className="pt-2 text-ayuda font-extrabold text-texto-secundario">
                  Enviados
                </h2>
                <Filas levantamientos={enviados} contexto={contexto} />
              </section>
            )}
          </>
        )}

        {deOtros !== undefined && deOtros > 0 && (
          <p className="text-ayuda text-texto-secundario">
            Hay {levantamientos(deOtros)} de otra persona en este teléfono. Se conservan y se envían cuando esa persona inicie sesión.
          </p>
        )}

        <Suspense fallback={null}>
          <SugerirLlave usuarioId={usuario.id} enLinea={alcanzable} />
        </Suspense>
      </main>

      {cuentaAbierta && (
        <Dialogo
          forma="inferior"
          titulo={pagina ? TITULO_DE_PAGINA[pagina] : "Tu cuenta"}
          alCerrar={() => setCuentaAbierta(false)}
          volver={pagina ? { etiqueta: "Cuenta", alVolver: () => irA(null) } : undefined}
          focoEnElDialogo
        >
          {/* Lo que se abre desde la cuenta entra en la misma hoja, como una página (iteración 32). */}
          <div key={pagina ?? "cuenta"} className={`flex flex-col gap-4 ${direccion === "adelante" ? "motion-safe:animate-pagina-adelante" : direccion === "atras" ? "motion-safe:animate-pagina-atras" : ""}`}>
            {pagina === "descartados" && formatos ? (
              <Suspense fallback={<EsqueletoBloques etiqueta="Cargando los descartados" altos={["bajo"]} />}>
                <Papelera usuarioId={usuario.id} formatos={formatos} />
              </Suspense>
            ) : pagina === "contrasena" ? (
              <Suspense fallback={<EsqueletoBloques etiqueta="Cargando" altos={["alto"]} />}>
                <HojaCambiarContrasena alTerminar={() => irA(null)} />
              </Suspense>
            ) : pagina === "diagnostico" ? (
              <Suspense fallback={<EsqueletoBloques etiqueta="Cargando" altos={["alto"]} />}>
                <Diagnostico tecnicoId={usuario.id} />
              </Suspense>
            ) : (
              <>
                {/* Quién está en este teléfono y cómo va lo suyo, sin caja (Luma y Shop en Mobbin). */}
                <div className="flex items-center gap-3.5 px-0.5">
                  <span aria-hidden className="grid size-13 shrink-0 place-items-center rounded-full bg-superficie-pista text-cuerpo font-semibold">
                    {iniciales(usuario.nombre)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <strong className="truncate text-[18px] font-semibold">{usuario.nombre}</strong>
                    <span className="flex items-center gap-2 text-ayuda text-texto-secundario">
                      <span aria-hidden className={`size-2 rounded-full ${sinConexion ? "bg-sync-pendiente" : "bg-sync-ok"}`} />
                      {sinConexion ? "Sin señal · lo capturado queda aquí" : porSubir > 0 ? "Conectado · enviando lo pendiente" : "Conectado · todo enviado"}
                    </span>
                  </span>
                </div>
                <AvisoDeAlmacenamiento />
                <GrupoDeAjustes>
                  <FilaDeTema />
                  {/* Sin señal no se abre: el servidor es quien la cambia (ADR-0033). */}
                  <FilaDeAjuste icono={LockKeyhole} texto="Cambiar contraseña" detalle={alcanzable ? undefined : "Necesita señal"} apagada={!alcanzable} onClick={() => irA("contrasena")} />
                  <FilaDeAjuste icono={Trash} texto="Descartados" valor={descartados || undefined} onClick={() => irA("descartados")} />
                  <FilaDeAjuste icono={Activity} texto="Diagnóstico del teléfono" onClick={() => irA("diagnostico")} />
                </GrupoDeAjustes>
                {/* Sola y al final: lejos de lo que se toca a diario. */}
                <GrupoDeAjustes>
                  <FilaDeAjuste
                    texto="Cerrar sesión"
                    peligro
                    onClick={() => {
                      setCuentaAbierta(false);
                      if (porEnviar > 0) setConfirmandoSalida(true);
                      else void cerrarSesion();
                    }}
                  />
                </GrupoDeAjustes>
                <p className="text-center text-ayuda text-texto-terciario">{`TEINS · versión ${VERSION_APP}`}</p>
              </>
            )}
          </div>
        </Dialogo>
      )}

      {guiaAbierta && (
        <Dialogo forma="inferior" titulo="Instala la app" alCerrar={() => setGuiaAbierta(false)}>
          <Suspense fallback={null}>
            <GuiaDeInstalacion />
          </Suspense>
        </Dialogo>
      )}

      {confirmandoSalida && (
        <Confirmacion
          nivel="consecuencia"
          forma="inferior"
          titulo={`¿Cerrar sesión con ${levantamientos(porEnviar)} por enviar?`}
          confirmar="Cerrar sesión"
          accion={cerrarSesion}
          mensajeDeError={() => "No se pudo cerrar la sesión. Intenta de nuevo."}
          alCerrar={() => setConfirmandoSalida(false)}
        >
          <p>Lo que falta por enviar se queda en este teléfono y se envía cuando vuelvas a iniciar sesión.</p>
        </Confirmacion>
      )}
    </div>
  );
}

type PaginaDeCuenta = "contrasena" | "descartados" | "diagnostico";
const TITULO_DE_PAGINA: Record<PaginaDeCuenta, string> = { contrasena: "Contraseña", descartados: "Descartados", diagnostico: "Diagnóstico" };

const hoyLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/**
 * Punto focal (DESIGN.md; prototipos/base-visual, campo): la visita de ahora en una tarjeta de borde fino, con
 * cuándo es en azul, el avance del levantamiento por pasos y la única acción principal.
 */
function VisitaFocal({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  const borrador = levantamientos.find((l) => l.estado === "borrador");
  const formato = borrador ? formatoDe(contexto.formatos, borrador) : undefined;
  const resumen = borrador && formato ? resumenDeRecorrido(formato, borrador) : undefined;
  const abierta = enCurso(visita);
  const terminada = terminadaEn(visita);
  return (
    // Al abrirla, esta tarjeta se convierte en la cabecera de la captura (iteración 27).
    <section aria-label="Siguiente visita" className="flex flex-col gap-3 rounded-2xl border border-division bg-panel p-4" style={{ viewTransitionName: nombreDeTransicion("visita", visita.id) }}>
      <div className="flex justify-between gap-3 text-[12px] font-medium text-texto-secundario">
        <span aria-hidden>Siguiente visita</span>
        {terminada ? (
          <span className="flex items-center gap-1 text-sync-ok">
            <CircleCheck aria-hidden className="size-3.5" />
            {`Terminada ${horaDe(terminada)}`}
          </span>
        ) : (
          <span className="text-superficie first-letter:uppercase">{abierta ? `En curso · desde ${horaCorta(visita.horaInicio!)}` : cuandoEs(visita)}</span>
        )}
      </div>
      <h2 className="text-subtitulo leading-tight font-semibold tracking-[-0.01em]">{visita.cliente.nombre}</h2>
      <p className="-mt-1 flex flex-col gap-0.5 text-[13px] text-texto-secundario">
        <span className="flex items-start gap-1.5">
          <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {visita.sitio.nombre} · {visita.sitio.direccion}
        </span>
        <span>{visita.motivo}</span>
        {abierta && (
          <span className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5 shrink-0" />
            Sin hora de fin
          </span>
        )}
      </p>
      {resumen && (
        <div className="flex flex-col gap-2">
          <div aria-hidden className="flex gap-1">
            {resumen.pasos.map((p, i) => (
              <i key={p.id} className={`h-[3px] flex-1 rounded-full ${resumen.hechos[i] ? "bg-sync-ok" : p === resumen.siguiente ? "bg-superficie" : "bg-superficie-pista"}`} />
            ))}
          </div>
          <span className="text-ayuda text-texto-secundario">
            {`${resumen.hechos.filter(Boolean).length} de ${resumen.pasos.length} pasos`}
            {resumen.siguiente ? ` · sigue ${resumen.siguiente.titulo.toLowerCase()}` : " · listo para revisar y enviar"}
          </span>
        </div>
      )}
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="principal" />
      {/* Bajo la acción principal: terminar libera al técnico, no reemplaza capturar (ADR-0037). */}
      {abierta && !contexto.bloqueado && <TerminarVisita visita={visita} contexto={contexto} />}
    </section>
  );
}

/** «Terminar visita» (ADR-0037), en la tarjeta principal y en cada fila: una visita en curso se termina esté donde esté. */
function TerminarVisita({ visita, contexto }: { visita: VisitaLocal; contexto: Contexto }) {
  const [terminando, setTerminando] = useState(false);
  const notificar = useNotificar();
  return (
    <>
      {visita.terminacionRechazada && <Aviso tono="error">No se pudo terminar esta visita: oficina no la aceptó. Avísale a oficina.</Aviso>}
      <Boton variante="secundaria" className="w-full" onClick={() => setTerminando(true)}>
        Terminar visita
      </Boton>
      {terminando && (
        <Confirmacion
          nivel="consecuencia"
          forma="inferior"
          titulo={`¿Terminar la visita a ${visita.cliente.nombre}?`}
          confirmar="Terminar visita"
          accion={async () => {
            await terminarVisita(db, visita.tecnicoId, visita.id, new Date());
            sincronizarEnSegundoPlano();
          }}
          mensajeDeError={() => "No se pudo terminar la visita. Intenta de nuevo."}
          alCerrar={() => setTerminando(false)}
          // Se ve terminada al instante; sin señal, sale cuando vuelva (ADR-0037).
          alTerminar={() => notificar({ texto: contexto.enLinea ? "Visita terminada: oficina ya te ve libre" : "Visita terminada: oficina lo sabrá cuando tengas señal" })}
          consecuencias={[
            { icono: Building, texto: `Oficina ve que terminaste a las ${horaDe(new Date().toISOString())}` },
            { icono: CalendarDays, texto: "Quedas libre para otras visitas desde ya" },
            { icono: Send, texto: "Si te falta enviar algo, lo sigues pudiendo enviar" },
          ]}
        />
      )}
    </>
  );
}

/** "Hoy · 9:00 a. m. a 11:00 a. m.", "Mañana · Desde 2:00 p. m." o solo el día si es de todo el día. */
function cuandoEs(visita: VisitaLocal): string {
  const horario = horarioDeVisita(visita);
  const dia = fechaDeVisita(visita.programadaPara, hoyLocal());
  return horario ? `${dia} · ${horario.charAt(0).toLowerCase()}${horario.slice(1)}` : dia;
}

/** La línea de la hora en una fila: terminada, en curso o el horario; nada si es de todo el día. */
function horaDeFila(visita: VisitaLocal): string | null {
  const terminada = terminadaEn(visita);
  if (terminada) return `Terminada ${horaDe(terminada)}`;
  if (enCurso(visita)) return `En curso · desde ${horaCorta(visita.horaInicio!)}`;
  return horarioDeVisita(visita);
}

/** Otra visita (DoorDash): el día a la izquierda, el cliente y el sitio; tocarla ofrece empezar o seguir. */
function FilaVisita({ visita, levantamientos, contexto }: { visita: VisitaLocal; levantamientos: LevantamientoLocal[]; contexto: Contexto }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <article className="flex flex-col gap-3 border-t border-division py-3" style={{ viewTransitionName: nombreDeTransicion("visita", visita.id) }}>
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="flex min-h-11 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
        <span className="w-16 shrink-0 text-[12px] leading-tight text-texto-secundario first-letter:uppercase">{fechaDeVisita(visita.programadaPara, hoyLocal())}</span>
        <span className="flex min-w-0 flex-col">
          <strong className="text-[14px] leading-snug font-medium">{`${visita.cliente.nombre} · ${visita.sitio.nombre}`}</strong>
          <span className="text-[13px] text-texto-secundario">{[horaDeFila(visita), visita.motivo].filter(Boolean).join(" · ")}</span>
        </span>
      </button>
      {visita.fueraDeAlcance && <AvisoDeSalida visita={visita} />}
      {abierta && !visita.fueraDeAlcance && <Acciones visita={visita} levantamientos={levantamientos} contexto={contexto} variante="secundaria" />}
      {/* En curso aunque no sea la principal (un borrador viejo puede ocupar ese lugar): se termina aquí también. */}
      {enCurso(visita) && !contexto.bloqueado && <TerminarVisita visita={visita} contexto={contexto} />}
    </article>
  );
}

/** Por qué la visita ya no es del técnico; solo se muestra si tiene algo empezado (regla 17). */
function AvisoDeSalida({ visita }: { visita: VisitaLocal }) {
  return (
    <p className="text-ayuda text-texto-secundario">
      {visita.motivoSalida === "cancelada" ? "Oficina canceló esta visita." : "Esta visita se asignó a otra persona."} Puedes terminar y enviar lo que ya empezaste.
    </p>
  );
}

/** Continuar el borrador de la visita, o iniciar uno con la versión vigente de cada formato. */
function Acciones({
  visita,
  levantamientos,
  contexto,
  variante,
}: {
  visita: VisitaLocal;
  levantamientos: LevantamientoLocal[];
  contexto: Contexto;
  variante: "principal" | "secundaria";
}) {
  const borrador = levantamientos.find((l) => l.estado === "borrador");
  const disponibles = vigentes(contexto.formatos);

  if (borrador) {
    return variante === "principal" ? (
      <BotonSiguiente onClick={() => contexto.abrir(borrador.id)}>Continuar levantamiento</BotonSiguiente>
    ) : (
      <Boton variante={variante} className="w-full" onClick={() => contexto.abrir(borrador.id)}>
        Continuar levantamiento
      </Boton>
    );
  }
  // Una visita que ya no es del técnico no admite levantamientos nuevos.
  if (visita.fueraDeAlcance) return null;
  // Una visita de otro día no se inicia (iteración 46): en lugar del botón, cuándo. La tarjeta cambia sola al llegar el día.
  if (!sePuedeIniciar(visita, hoyLocal())) return <p className="text-ayuda text-texto-secundario">{cuandoSePodraIniciar(visita.programadaPara, hoyLocal())}</p>;
  if (contexto.bloqueado) {
    return (
      <Boton variante={variante} className="w-full" disabled>
        Captura bloqueada: conéctate
      </Boton>
    );
  }
  if (disponibles.length === 0) {
    return <p className="text-ayuda text-texto-secundario">Faltan los formatos en este teléfono. Conéctate un momento para descargarlos.</p>;
  }
  if (disponibles.length === 1) {
    return variante === "principal" ? (
      <BotonSiguiente onClick={() => contexto.iniciar(visita.id, disponibles[0]!)}>Iniciar levantamiento</BotonSiguiente>
    ) : (
      <Boton variante={variante} className="w-full" onClick={() => contexto.iniciar(visita.id, disponibles[0]!)}>
        Iniciar levantamiento
      </Boton>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ayuda font-bold">Iniciar levantamiento</p>
      {disponibles.map((f, i) => (
        <Boton key={f.formato} variante={i === 0 ? variante : "secundaria"} className="w-full" onClick={() => contexto.iniciar(visita.id, f)}>
          {nombreDeFormato(contexto.formatos, f.formato)}
        </Boton>
      ))}
    </div>
  );
}

function Filas({ levantamientos, contexto, atencion = false }: { levantamientos: LevantamientoLocal[]; contexto: Contexto; atencion?: boolean }) {
  return (
    <ul className={`overflow-hidden rounded-panel border bg-panel [&>li+li]:border-t [&>li+li]:border-division ${atencion ? "border-error/40" : "border-division"}`}>
      {levantamientos.map((l) => (
        <li key={l.id}>
          <Fila levantamiento={l} contexto={contexto} />
        </li>
      ))}
    </ul>
  );
}

const ICONO_DE_TONO = { ok: CircleCheck, pendiente: Clock, error: CircleAlert, revision: Eye } as const;
const CLASE_DE_TONO = { ...claseDeTono, revision: "text-estado-revision-texto" } as const;

/**
 * Un levantamiento en dos líneas (iteración 32): arriba de quién es y cuándo; abajo el estado en dos o tres palabras
 * con su icono, y el formato. El estado nunca empuja el título: la explicación larga está en el detalle.
 */
function Fila({ levantamiento: l, contexto }: { levantamiento: LevantamientoLocal; contexto: Contexto }) {
  const envio = contexto.envios.get(l.id);
  const servidor = contexto.servidor.get(l.id);
  const estado = l.estado === "borrador" ? { texto: "Borrador", tono: "pendiente" as const } : estadoCorto(envio, servidor, contexto.enLinea);
  // El chat con oficina (ADR-0040): lo nuevo de oficina, o lo que el técnico respondió y espera señal.
  const nuevos = sinLeerDe(servidor, contexto.chats.leido.get(l.id) ?? null);
  const enCola = contexto.chats.enCola.get(l.id) ?? 0;
  const visita = l.visitaId ? contexto.visitas.get(l.visitaId) : undefined;
  // La visita atendida sale del teléfono al día siguiente (ADR-0041): lo enviado sigue diciendo dónde fue (iteración 42).
  const lugar = visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : l.lugar ? `${l.lugar.cliente} · ${l.lugar.sitio}` : undefined;
  const formato = nombreDeFormato(contexto.formatos, l.formato);
  const Icono = estado ? (l.estado === "borrador" ? Pencil : ICONO_DE_TONO[estado.tono]) : undefined;
  const enPantalla = useNombreEnPantalla<HTMLButtonElement>(nombreDeTransicion("lev", l.id));
  return (
    <button
      type="button"
      // Lo sin leer abre directo el chat (iteración 46); lo demás, el levantamiento.
      onClick={() => contexto.abrir(l.id, nuevos > 0)}
      // La lista de enviados crece: la fila lleva su nombre de transición solo mientras se ve.
      ref={enPantalla}
      className={`grid min-h-tactil w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left transition-colors hover:bg-panel-hundido focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco ${contexto.recien === l.id ? "animate-resaltar" : ""}`}
    >
      <strong className="truncate text-cuerpo font-semibold">{lugar ?? formato}</strong>
      <span className="inline-flex items-center gap-1.5 text-ayuda text-texto-secundario">
        {nuevos > 0 && <i className="size-2 rounded-full bg-acento" aria-label="Sin leer" />}
        {diaCorto(l.creadoEn)}
      </span>
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 text-ayuda text-texto-secundario">
        {estado && Icono && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 font-medium ${CLASE_DE_TONO[estado.tono]} [&_svg]:size-4`}>
            <Icono aria-hidden />
            {estado.texto}
          </span>
        )}
        <span className="truncate">· {lugar ? formato : fotos(contarFotos(l))}</span>
      </span>
      {nuevos > 0 ? (
        <span className="col-span-2 text-cuerpo font-semibold text-acento">Oficina te escribió</span>
      ) : (
        enCola > 0 && (
          <span className="col-span-2 inline-flex items-center gap-1.5 text-cuerpo font-medium text-alerta-texto">
            <Clock aria-hidden className="size-4" />
            {enCola === 1 ? "1 respuesta por enviar" : `${enCola} respuestas por enviar`}
          </span>
        )
      )}
    </button>
  );
}

const diaCorto = (iso: string) => {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (fecha.toDateString() === hoy.toDateString()) return horaDelChat(iso);
  if (fecha.toDateString() === ayer.toDateString()) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(fecha);
};
