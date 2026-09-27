import { useQuery } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton, RefreshCw } from "@teins/ui";
import { consultas } from "./api";
import { Administracion } from "./pantallas/Administracion";
import { Bandeja } from "./pantallas/Bandeja";
import { Catalogo } from "./pantallas/Catalogo";
import { DetalleCliente } from "./pantallas/Cliente";
import { Clientes } from "./pantallas/Clientes";
import { DetalleCotizacion } from "./pantallas/Cotizacion";
import { Cotizaciones } from "./pantallas/Cotizaciones";
import { Detalle } from "./pantallas/Detalle";
import { InformeDeVisita } from "./pantallas/Informe";
import { Informes } from "./pantallas/Informes";
import { IniciarSesion } from "./pantallas/IniciarSesion";
import { Marco } from "./pantallas/Marco";
import { MiCuenta } from "./pantallas/MiCuenta";
import { Visitas } from "./pantallas/Visitas";

/** Toda pantalla de oficina exige una sesión de oficina; la autorización real la aplica el servidor. */
function Raiz() {
  const sesion = useQuery(consultas.sesion());
  if (sesion.isPending) {
    return (
      <div aria-busy="true" aria-label="Abriendo TEINS Oficina" className="grid min-h-dvh place-items-center bg-fondo">
        <p className="text-subtitulo font-extrabold tracking-wide text-superficie">TEINS</p>
      </div>
    );
  }
  if (sesion.isError) {
    if (sesion.error instanceof ErrorApi && sesion.error.codigo === "no_autenticado") return <IniciarSesion />;
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
  return (
    <Marco nombre={sesion.data.usuario.nombre} administrador={sesion.data.usuario.administrador}>
      <Outlet />
    </Marco>
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

export const router = createRouter({ routeTree: raiz.addChildren([bandeja, detalle, visitas, clientes, detalleDeCliente, catalogo, listaDeInformes, informe, cotizaciones, cotizacion, cuenta, administracion]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
