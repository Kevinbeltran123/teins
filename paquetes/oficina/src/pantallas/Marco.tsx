import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building, CalendarDays, ClipboardCheck, FileText, LogOut, Package, Receipt, ShieldCheck, WifiOff, type LucideIcon } from "@teins/ui";
import { cliente } from "../api";
import { desactivarAvisos, renovarSuscripcion } from "../avisos";
import { useConexion } from "../conexion";
import { useBandeja } from "../revision";

interface Seccion {
  a: string;
  texto: string;
  icono: LucideIcon;
}

const SECCIONES: Seccion[] = [
  { a: "/", texto: "Levantamientos", icono: ClipboardCheck },
  { a: "/visitas", texto: "Visitas", icono: CalendarDays },
  { a: "/clientes", texto: "Clientes", icono: Building },
  { a: "/catalogo", texto: "Catálogo", icono: Package },
  { a: "/informes", texto: "Informes", icono: FileText },
  { a: "/cotizaciones", texto: "Cotizaciones", icono: Receipt },
];

/** Iniciales para el distintivo de la cuenta: quien comparte computador ve de un vistazo quién está dentro. */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/**
 * Marco de oficina (DESIGN.md, identidad Recorrido; prototipos/oficina): menú lateral con las secciones, la
 * activa con su marca amarilla, y el contenido a la derecha. Bajo 1100 px el menú queda en iconos.
 */
export function Marco({ nombre, administrador, children }: { nombre: string; administrador: boolean; children: ReactNode }) {
  const consultasCliente = useQueryClient();
  const enLinea = useConexion();
  // Lo que espera revisión es el trabajo pendiente de oficina: por eso su cuenta va en el menú.
  const esperando = useBandeja("enviado").data?.pages[0]?.total ?? 0;
  // En Levantamientos la cifra ya está en el encabezado: repetirla en el menú no agrega nada.
  const enLevantamientos = useRouterState({ select: (e) => e.location.pathname === "/" });

  // Si ya estaban activos, la suscripción se renueva al abrir (ADR-0023): el navegador puede rotarla.
  useEffect(() => void renovarSuscripcion().catch(() => undefined), []);

  async function cerrarSesion() {
    // Con la sesión todavía abierta: este navegador deja de recibir los avisos de la persona.
    await desactivarAvisos().catch(() => undefined);
    await cliente.cerrarSesion().catch(() => undefined);
    // Reinicia todo: la sesión se vuelve a consultar (401) y nada del usuario anterior queda en memoria.
    await consultasCliente.resetQueries();
  }

  const enlace = ({ a, texto, icono: Icono }: Seccion) => (
    <Link key={a} to={a} activeOptions={{ exact: a === "/" }} activeProps={{ "aria-current": "page" }} title={texto}>
      <Icono aria-hidden size={20} />
      <span className="txt">{texto}</span>
      {a === "/" && esperando > 0 && !enLevantamientos && (
        <span className="cuenta-num">
          <span className="sr-only">, esperando revisión: </span>
          {esperando}
        </span>
      )}
    </Link>
  );

  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">
          <b>TEINS</b>
        </div>
        <nav aria-label="Secciones">
          {SECCIONES.map(enlace)}
          {administrador && (
            <>
              <hr />
              {enlace({ a: "/administracion", texto: "Administración", icono: ShieldCheck })}
            </>
          )}
        </nav>
        <div className="pie">
          <div className="usuario">
            <Link to="/cuenta" aria-label={`Mi cuenta: ${nombre}`} activeProps={{ "aria-current": "page" }} className="usuario" style={{ padding: 0, flex: 1, minWidth: 0 }}>
              <span className="avatar" aria-hidden>
                {iniciales(nombre)}
              </span>
              <span className="quien">
                <b>{nombre}</b>
                <small>{administrador ? "Administra" : "Oficina"}</small>
              </span>
            </Link>
            <button type="button" className="icono-btn limpio chico salir" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
              <LogOut aria-hidden size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main className="contenido">
        <div className="contenido-interior">
          {!enLinea && (
            <div className="sin-conexion" role="status">
              <WifiOff aria-hidden size={20} />
              Sin conexión. Lo que ve puede no estar al día; se actualiza al recuperar la conexión.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
