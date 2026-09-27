import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Aviso, BotonIcono, Building, CalendarDays, ClipboardCheck, FileText, LogOut, Package, Receipt, ShieldCheck, type LucideIcon } from "@teins/ui";
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

const claseEnlace =
  "flex min-h-control items-center gap-3 rounded-control px-3 text-cuerpo font-semibold text-texto-secundario hover:bg-encima hover:text-texto focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie data-[status=active]:bg-superficie-suave data-[status=active]:font-extrabold data-[status=active]:text-superficie [&_svg]:size-5 [&_svg]:shrink-0";

/** Iniciales para el distintivo de la cuenta: quien comparte computador ve de un vistazo quién está dentro. */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/**
 * Marco de oficina (DESIGN.md, dirección Consola): menú lateral con las secciones y el contenido a la derecha.
 * El menú se reduce a iconos en pantallas angostas; cada enlace conserva su nombre accesible.
 */
export function Marco({ nombre, administrador, children }: { nombre: string; administrador: boolean; children: ReactNode }) {
  const consultasCliente = useQueryClient();
  const enLinea = useConexion();
  // Lo que espera revisión es el trabajo pendiente de oficina: por eso su cuenta va en el menú.
  const esperando = useBandeja("enviado").data?.pages[0]?.total ?? 0;
  // En Levantamientos la cifra ya es el punto focal: repetirla en el menú no agrega nada.
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

  return (
    <div className="flex min-h-dvh bg-fondo">
      <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-division bg-panel px-2 py-5 lg:w-62 lg:px-3">
        <div className="flex flex-col px-1 pb-6 lg:px-3">
          <span className="text-subtitulo leading-none font-extrabold tracking-wide text-superficie">TEINS</span>
          <span className="hidden pt-1 text-ayuda text-texto-secundario lg:block">Oficina</span>
        </div>
        <nav aria-label="Secciones" className="flex flex-col gap-0.5">
          {SECCIONES.map(({ a, texto, icono: Icono }) => (
            <Link key={a} to={a} activeOptions={{ exact: a === "/" }} className={claseEnlace} title={texto}>
              <Icono aria-hidden />
              <span className="sr-only grow lg:not-sr-only">{texto}</span>
              {a === "/" && esperando > 0 && !enLevantamientos && (
                <span className="hidden min-w-6 rounded-control bg-superficie px-1.5 text-center text-ayuda font-extrabold text-sobre-superficie lg:inline">
                  <span className="sr-only">, esperando revisión: </span>
                  {esperando}
                </span>
              )}
            </Link>
          ))}
          {administrador && (
            <>
              <div className="mx-3 my-2 h-px bg-division" />
              <Link to="/administracion" className={claseEnlace} title="Administración">
                <ShieldCheck aria-hidden />
                <span className="sr-only lg:not-sr-only">Administración</span>
              </Link>
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-1 border-t border-division pt-3 lg:flex-row lg:gap-2">
          <Link
            to="/cuenta"
            aria-label={`Mi cuenta: ${nombre}`}
            className="flex min-h-control min-w-0 grow items-center gap-2.5 rounded-control px-1 hover:bg-encima focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie data-[status=active]:bg-superficie-suave lg:px-2"
          >
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie-suave text-ayuda font-extrabold text-superficie">
              {iniciales(nombre)}
            </span>
            <span className="hidden min-w-0 flex-col lg:flex">
              <span className="truncate text-cuerpo font-bold">{nombre}</span>
              <span className="text-ayuda text-texto-secundario">{administrador ? "Administra" : "Oficina"}</span>
            </span>
          </Link>
          <BotonIcono icono={LogOut} etiqueta="Cerrar sesión" tamano="pequeno" onClick={() => void cerrarSesion()} />
        </div>
      </aside>
      <main className="min-w-0 grow px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          {!enLinea && <Aviso tono="alerta">Sin conexión. Lo que ve puede no estar al día; se actualiza al recuperar la conexión.</Aviso>}
          {children}
        </div>
      </main>
    </div>
  );
}
