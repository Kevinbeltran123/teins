import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Boton, Building, CalendarDays, ClipboardCheck, DestinoAccionesBarra, DestinoBarraSuperior, esAtajo, etiquetaAtajo, FileText, Logo, LogOut, Package, PanelLeftClose, PanelLeftOpen, Receipt, RefreshCw, ShieldCheck, WifiOff, type LucideIcon } from "@teins/ui";
import { cliente } from "../api";
import { desactivarAvisos, renovarSuscripcion } from "../avisos";
import { useConexion } from "../conexion";
import { esBooleano, usePreferencia } from "../preferencias";
import { iniciales } from "../formato";
import { useBandeja } from "../revision";
import { useVersionNueva } from "../version";

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
];
/** Lo que se entrega al cliente, agrupado como en el prototipo (prototipos/base-visual). */
const DOCUMENTOS: Seccion[] = [
  { a: "/informes", texto: "Informes", icono: FileText },
  { a: "/cotizaciones", texto: "Cotizaciones", icono: Receipt },
];

/**
 * Marco de oficina (DESIGN.md, Precisión; prototipos/base-visual): menú lateral de 208 px con el logo, las secciones
 * y la cuenta abajo; a la derecha, una barra superior de 48 px con la ubicación y el contenido. Bajo 1100 px el
 * menú queda en iconos; más ancho, la persona lo pliega a iconos con «Plegar el menú» o ⌘B / Ctrl + B, y se recuerda
 * en el equipo (prototipos/usabilidad-oficina).
 */
export function Marco({ nombre, administrador, children }: { nombre: string; administrador: boolean; children: ReactNode }) {
  const consultasCliente = useQueryClient();
  const enLinea = useConexion();
  const versionNueva = useVersionNueva();
  const [barra, setBarra] = useState<HTMLElement | null>(null);
  const [accionesBarra, setAccionesBarra] = useState<HTMLElement | null>(null);
  // Lo que espera revisión es el trabajo pendiente de oficina: por eso su cuenta va en el menú.
  const esperando = useBandeja("enviado").data?.pages[0]?.total ?? 0;
  // En Levantamientos la cifra ya está en el encabezado: repetirla en el menú no agrega nada.
  const enLevantamientos = useRouterState({ select: (e) => e.location.pathname === "/" });
  const [plegado, setPlegado] = usePreferencia("menu-plegado", false, esBooleano);
  const atajo = etiquetaAtajo("B");

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!esAtajo(e, "B")) return;
      e.preventDefault();
      setPlegado(!plegado);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [plegado, setPlegado]);

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
      <Icono aria-hidden size={16} strokeWidth={1.6} />
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
    <div className={`app ${plegado ? "plegado" : ""}`}>
      <aside className="menu">
        <div className="marca">
          <Logo alto={30} />
        </div>
        <nav aria-label="Secciones">
          {SECCIONES.map(enlace)}
          <div className="grupo">Documentos</div>
          {DOCUMENTOS.map(enlace)}
          {administrador && (
            <>
              <hr />
              {enlace({ a: "/administracion", texto: "Administración", icono: ShieldCheck })}
            </>
          )}
        </nav>
        <div className="pie">
          <button type="button" className="plegar" aria-expanded={!plegado} title={`${plegado ? "Desplegar" : "Plegar"} el menú (${atajo})`} onClick={() => setPlegado(!plegado)}>
            {plegado ? <PanelLeftOpen aria-hidden size={16} strokeWidth={1.6} /> : <PanelLeftClose aria-hidden size={16} strokeWidth={1.6} />}
            <span className="txt">Plegar el menú</span>
            <span className="kbd txt" aria-hidden>
              {atajo}
            </span>
            <span className="sr-only">{plegado ? "Desplegar el menú" : ""}</span>
          </button>
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
              <LogOut aria-hidden size={16} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </aside>
      <div className="contenido">
        <div className="barra-sup">
          <nav ref={setBarra} aria-label="Ubicación" />
          <div ref={setAccionesBarra} className="barra-acciones" />
        </div>
        <main className="contenido-interior">
          {!enLinea && (
            <div className="sin-conexion" role="status">
              <WifiOff aria-hidden size={20} />
              Sin conexión. Lo que ve puede no estar al día; se actualiza al recuperar la conexión.
            </div>
          )}
          {versionNueva && (
            <div className="sin-conexion" role="status">
              <RefreshCw aria-hidden size={20} />
              Hay una versión nueva de TEINS. Recargue para seguir: lo que ya guardó no se pierde.
              <Boton tamano="pequeno" onClick={() => window.location.reload()}>
                Recargar
              </Boton>
            </div>
          )}
          <DestinoBarraSuperior.Provider value={barra}>
            <DestinoAccionesBarra.Provider value={accionesBarra}>{children}</DestinoAccionesBarra.Provider>
          </DestinoBarraSuperior.Provider>
        </main>
      </div>
    </div>
  );
}
