import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { Aviso, Boton, claseBoton, EncabezadoPagina, FallaAlDibujar, RefreshCw, useModal } from "@teins/ui";
import { consultas, esSesionVencida, olvidarContrasenaDeIngreso } from "./api";
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
      <Marco key={sesion.data.usuario.id} nombre={sesion.data.usuario.nombre} administrador={sesion.data.usuario.administrador}>
        <Outlet />
      </Marco>
      {esSesionVencida(sesion.error) && <SesionVencida />}
    </>
  );
}

const raiz = createRootRoute({ component: Raiz });
const bandeja = createRoute({ getParentRoute: () => raiz, path: "/", component: Bandeja });
const detalle = createRoute({
  getParentRoute: () => raiz,
  path: "levantamientos/$id",
  component: function RutaDetalle() {
    const { id } = detalle.useParams();
    return <Detalle id={id} />;
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
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
