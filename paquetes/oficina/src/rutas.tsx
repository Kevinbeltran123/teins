import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { Aviso, Boton, claseBoton, conTransicion, EncabezadoPagina, FallaAlDibujar, RefreshCw, useModal, useNotificar, type Direccion } from "@teins/ui";
import { clienteDeConsultas, consultas, esSesionVencida, olvidarContrasenaDeIngreso } from "./api";
import { Administracion } from "./pantallas/Administracion";
import { Bandeja } from "./pantallas/Bandeja";
import { Catalogo } from "./pantallas/Catalogo";
import { DetalleCliente } from "./pantallas/Cliente";
import { Clientes } from "./pantallas/Clientes";
import { ContrasenaObligatoria } from "./pantallas/ContrasenaObligatoria";
import { DetalleCotizacion } from "./pantallas/Cotizacion";
import { Cotizaciones } from "./pantallas/Cotizaciones";
import { Detalle } from "./pantallas/Detalle";
import { InformeDeVisita } from "./pantallas/Informe";
import { Informes } from "./pantallas/Informes";
import { IniciarSesion } from "./pantallas/IniciarSesion";
import { Marco } from "./pantallas/Marco";
import { MiCuenta } from "./pantallas/MiCuenta";
import { Visitas } from "./pantallas/Visitas";
import { PersonaDeOficina } from "./preferencias";
import { consultasDeProgramacion } from "./programacion";

/**
 * La sesión venció con una pantalla abierta: se ingresa de nuevo encima de ella, sin desmontarla, y lo que la
 * persona escribía sigue ahí. No se puede cerrar: detrás, sin sesión, nada funciona.
 */
function SesionVencida() {
  const modal = useModal(false, () => undefined);
  return (
    <dialog {...modal} className="sesion-vencida" aria-label="Su sesión venció">
      <IniciarSesion aviso="Su sesión venció. Ingrese de nuevo: lo que estaba haciendo sigue aquí." />
    </dialog>
  );
}

/** Toda pantalla de oficina exige una sesión de oficina; la autorización real la aplica el servidor. */
function Raiz() {
  const sesion = useQuery(consultas.sesion());
  // La contraseña con la que entró solo se guarda para cambiar una temporal: con otra, se olvida al leer la sesión.
  const conPermanente = sesion.data?.usuario.debeCambiarContrasena === false;
  useEffect(() => {
    if (conPermanente) olvidarContrasenaDeIngreso();
  }, [conPermanente]);
  // Al ingresar de nuevo encima de la pantalla, se dice que lo que estaba haciendo sigue ahí (iteración 27).
  const vencida = esSesionVencida(sesion.error);
  const estabaVencida = useRef(false);
  const notificar = useNotificar();
  useEffect(() => {
    if (estabaVencida.current && !vencida && sesion.data) notificar({ texto: "Sesión recuperada: lo que estaba haciendo sigue aquí" });
    estabaVencida.current = vencida;
  }, [vencida, sesion.data, notificar]);
  if (sesion.isPending) {
    return (
      <div aria-busy="true" aria-label="Abriendo TEINS" className="grid min-h-dvh place-items-center bg-fondo">
        <p className="text-subtitulo font-extrabold tracking-wide text-superficie">TEINS</p>
      </div>
    );
  }
  // Con una sesión ya leída, un error al releerla no desmonta la pantalla (se perdería lo escrito): sin
  // conexión, el marco lo avisa; con la sesión vencida, se ingresa de nuevo encima.
  if (sesion.data === undefined) {
    if (esSesionVencida(sesion.error)) return <IniciarSesion />;
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Aviso tono="error">
          <p>No se pudo conectar con el servidor.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void sesion.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      </main>
    );
  }
  if (sesion.data.usuario.rol !== "oficina") {
    return <IniciarSesion aviso="Este usuario es de técnico: la bandeja es solo para oficina. Inicie sesión con un usuario de oficina." />;
  }
  if (sesion.data.usuario.debeCambiarContrasena) return <ContrasenaObligatoria />;
  return (
    <>
      {/* Si ingresa otra persona, todo empieza de nuevo: lo escrito por la anterior no queda a la vista. */}
      <PersonaDeOficina.Provider value={sesion.data.usuario.id}>
        <Marco key={sesion.data.usuario.id} nombre={sesion.data.usuario.nombre} administrador={sesion.data.usuario.administrador}>
          <Outlet />
        </Marco>
      </PersonaDeOficina.Provider>
      {esSesionVencida(sesion.error) && <SesionVencida />}
    </>
  );
}

/**
 * Lo que el detalle necesita para su título, si llega pronto: así, al abrirlo, el título de la fila se convierte en
 * el del detalle (iteración 27). Si tarda, el detalle abre con su esqueleto; si falla, el detalle dice el error.
 */
const antesDeAbrir = (lectura: Promise<unknown>) =>
  Promise.race([lectura.catch(() => undefined), new Promise((listo) => setTimeout(listo, 400))]).then(() => undefined);

const raiz = createRootRoute({ component: Raiz });
const bandeja = createRoute({ getParentRoute: () => raiz, path: "/", component: Bandeja });
const detalle = createRoute({
  getParentRoute: () => raiz,
  path: "levantamientos/$id",
  // `hilo`: un aviso de respuesta abre la conversación (ADR-0040).
  validateSearch: (s: Record<string, unknown>): { hilo?: string } => (typeof s.hilo === "string" ? { hilo: s.hilo } : {}),
  loader: ({ params }) => antesDeAbrir(clienteDeConsultas.ensureQueryData(consultas.levantamiento(params.id))),
  component: function RutaDetalle() {
    const { id } = detalle.useParams();
    const { hilo } = detalle.useSearch();
    // Otro levantamiento (el siguiente de la serie) empieza limpio: sin pestañas ni correcciones del anterior.
    return <Detalle key={id} id={id} hilo={hilo} />;
  },
});

const listaDeInformes = createRoute({ getParentRoute: () => raiz, path: "informes", component: Informes });
const informe = createRoute({
  getParentRoute: () => raiz,
  path: "informes/$id",
  component: function RutaInforme() {
    const { id } = informe.useParams();
    return <InformeDeVisita id={id} />;
  },
});

const visitas = createRoute({ getParentRoute: () => raiz, path: "visitas", component: Visitas });
const clientes = createRoute({ getParentRoute: () => raiz, path: "clientes", component: Clientes });
const detalleDeCliente = createRoute({
  getParentRoute: () => raiz,
  path: "clientes/$id",
  loader: ({ params }) => antesDeAbrir(clienteDeConsultas.ensureQueryData(consultasDeProgramacion.cliente(params.id))),
  component: function RutaCliente() {
    const { id } = detalleDeCliente.useParams();
    return <DetalleCliente id={id} />;
  },
});
const catalogo = createRoute({ getParentRoute: () => raiz, path: "catalogo", component: Catalogo });
const cotizaciones = createRoute({ getParentRoute: () => raiz, path: "cotizaciones", component: Cotizaciones });
const cotizacion = createRoute({
  getParentRoute: () => raiz,
  path: "cotizaciones/$id",
  component: function RutaCotizacion() {
    const { id } = cotizacion.useParams();
    return <DetalleCotizacion id={id} />;
  },
});

const cuenta = createRoute({
  getParentRoute: () => raiz,
  path: "cuenta",
  component: function RutaCuenta() {
    const sesion = useQuery(consultas.sesion());
    return sesion.data ? <MiCuenta nombre={sesion.data.usuario.nombre} /> : null;
  },
});

const administracion = createRoute({
  getParentRoute: () => raiz,
  path: "administracion",
  component: function RutaAdministracion() {
    const sesion = useQuery(consultas.sesion());
    return sesion.data ? <Administracion sesion={sesion.data} /> : null;
  },
});

/** Una ruta que no existe (un enlace viejo o mal copiado), dentro del marco: el menú sigue ahí. */
function NoExiste() {
  return (
    <>
      <EncabezadoPagina titulo="Esta página no existe" />
      <p className="sec">El enlace está mal escrito o la página ya no existe.</p>
      <div>
        <Link to="/" className={claseBoton("secundaria")}>
          Ir a Levantamientos
        </Link>
      </div>
    </>
  );
}

export const router = createRouter({
  routeTree: raiz.addChildren([bandeja, detalle, visitas, clientes, detalleDeCliente, catalogo, listaDeInformes, informe, cotizaciones, cotizacion, cuenta, administracion]),
  // Una pantalla que falla al dibujarse lo dice en español, dentro del marco (sin esto, el enrutador lo dice en inglés).
  defaultErrorComponent: () => <FallaAlDibujar texto="Algo falló al mostrar esta pantalla." />,
  defaultOnCatch: (error) => console.error("Falla al dibujar la pantalla", error),
  defaultNotFoundComponent: NoExiste,
  // Al pasar el cursor por un enlace ya se lee lo que el detalle necesita, para que abra con su título (iteración 27).
  defaultPreload: "intent",
});

/** La sección del menú a la que pertenece una ruta: la bandeja y el detalle de un levantamiento son la misma. */
const seccionDe = (ruta: string) => {
  const [primera = "", id] = ruta.split("/").filter(Boolean);
  return { seccion: primera === "" || primera === "levantamientos" ? "levantamientos" : primera, id };
};

/**
 * Navegar es una View Transition (iteración 27), por `conTransicion`: el menú y la barra no se mueven; lo que tiene
 * nombre, sí. Cambiar de sección desvanece el contenido; pasar de un detalle a otro de la misma (el siguiente
 * levantamiento) lo desliza; de la lista al detalle no lleva dirección: el título de la fila se convierte en el del
 * detalle. Solo cuando cambia la ruta: volver a la misma (otra vez el enlace del menú) no anima nada, y así la
 * pantalla no queda esperando una confirmación de pintado que el enrutador no da cuando no cambia nada.
 */
let navegacion: { animar: boolean; direccion?: Direccion } = { animar: false };
router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation, pathChanged }) => {
  if (!fromLocation || !pathChanged) {
    navegacion = { animar: false };
    return;
  }
  const de = seccionDe(fromLocation.pathname);
  const a = seccionDe(toLocation.pathname);
  navegacion = { animar: true, direccion: de.seccion !== a.seccion ? "seccion" : de.id && a.id && de.id !== a.id ? "adelante" : "fundido" };
});
router.startViewTransition = (actualizar) => (navegacion.animar ? conTransicion(actualizar, navegacion.direccion) : actualizar());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  /** El siguiente paso que ofreció una notificación ("Agregar contactos"): la pantalla de destino lo resalta. */
  interface HistoryState {
    siguiente?: "contactos";
    /** La pestaña con que abre Clientes ("Ver en Archivados" al archivar uno). */
    vista?: "activos" | "archivados";
    /** Lo que se pidió desde la búsqueda (⌘K / Ctrl + K): la pantalla abre ese formulario (iteración 37). */
    abrir?: "programar" | "nuevo" | "nueva";
  }
}
