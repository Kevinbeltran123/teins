import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Aviso } from "@teins/ui";
import { cliente } from "../api";
import { useConexion } from "../conexion";

/** Encabezado y contenedor comunes (DESIGN.md, estructura Placa). */
export function Marco({ nombre, administrador, children }: { nombre: string; administrador: boolean; children: ReactNode }) {
  const consultasCliente = useQueryClient();
  const enLinea = useConexion();

  async function cerrarSesion() {
    await cliente.cerrarSesion().catch(() => undefined);
    // Reinicia todo: la sesión se vuelve a consultar (401) y nada del usuario anterior queda en memoria.
    await consultasCliente.resetQueries();
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 flex items-center justify-between gap-4 rounded-panel bg-superficie px-6 py-3 text-sobre-superficie">
        <div className="flex items-center gap-6">
          <p className="text-cuerpo font-extrabold">TEINS Oficina</p>
          <nav aria-label="Secciones" className="flex gap-1">
            {[
              { a: "/", texto: "Levantamientos" },
              { a: "/informes", texto: "Informes" },
              ...(administrador ? [{ a: "/administracion", texto: "Administración" }] : []),
            ].map((e) => (
              <Link
                key={e.a}
                to={e.a}
                activeOptions={{ exact: e.a === "/" }}
                className="inline-flex min-h-tactil items-center rounded-control px-3 text-ayuda font-bold text-sobre-superficie-suave data-[status=active]:bg-superficie-elevada data-[status=active]:text-sobre-superficie focus-visible:outline-3 focus-visible:outline-acento"
              >
                {e.texto}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-ayuda text-sobre-superficie-suave">{nombre}</span>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="min-h-tactil rounded-control px-2 text-ayuda font-bold text-sobre-superficie-suave underline focus-visible:outline-3 focus-visible:outline-acento"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {!enLinea && <Aviso tono="alerta">Sin conexión. Lo que ve puede no estar al día; se actualiza al recuperar la conexión.</Aviso>}
        {children}
      </main>
    </div>
  );
}
