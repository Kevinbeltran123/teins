import { useQuery } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton } from "@teins/ui";
import { consultas } from "./api";
import { Bandeja } from "./pantallas/Bandeja";
import { Detalle } from "./pantallas/Detalle";
import { IniciarSesion } from "./pantallas/IniciarSesion";
import { Marco } from "./pantallas/Marco";

/** Toda pantalla de oficina exige una sesión de oficina; la autorización real la aplica el servidor. */
function Raiz() {
  const sesion = useQuery(consultas.sesion());
  if (sesion.isPending) return <div className="min-h-dvh bg-fondo" aria-busy="true" />;
  if (sesion.isError) {
    if (sesion.error instanceof ErrorApi && sesion.error.codigo === "no_autenticado") return <IniciarSesion />;
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <Aviso tono="error">
          <p>No se pudo conectar con el servidor.</p>
          <Boton className="mt-3" onClick={() => void sesion.refetch()}>
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
    <Marco nombre={sesion.data.usuario.nombre}>
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

export const router = createRouter({ routeTree: raiz.addChildren([bandeja, detalle]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
