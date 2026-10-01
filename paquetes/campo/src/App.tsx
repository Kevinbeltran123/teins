import { Component, lazy, Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Aviso, conTransicion } from "@teins/ui";
import { olvidarLecturas } from "./datos/lecturaRecordada";
import { debeGuiarInstalacion } from "./dispositivo/instalacion";
import { Inicio } from "./pantallas/Inicio";
import { useUsuario } from "./sesion/usuario";
import { programarSincronizacion } from "./sincronizacion/disparar";

// Solo hace falta la primera vez o cuando la sesión vence: se carga aparte.
const IniciarSesion = lazy(() => import("./pantallas/IniciarSesion").then((m) => ({ default: m.IniciarSesion })));
// Solo en un teléfono sin la app instalada, antes de iniciar sesión (ADR-0023, parte 3).
const InstalarApp = lazy(() => import("./pantallas/InstalarApp"));
// La captura no hace falta para abrir la app: se carga aparte, apenas se abre el inicio, para que abrir una visita no
// pase por una pantalla de carga (iteración 27). El service worker la guarda con todo lo demás, así que abre igual
// sin conexión (ADR-0011).
type PropsCaptura = { id: string; volver: () => void; alMostrar?: () => void };
let moduloCaptura: Promise<ComponentType<PropsCaptura>> | undefined;
const cargarCaptura = () => (moduloCaptura ??= import("./pantallas/Captura").then((m) => m.Captura));
/** Lo más que se espera a que la captura lea el levantamiento antes de mostrarse (si tarda, abre con su esqueleto). */
const ESPERA_CAPTURA_MS = 500;

/**
 * Mientras se lee el teléfono o se carga una pantalla: el nombre de la app y qué pasa, nada más. Evita la
 * pantalla en blanco sin inventar contenido.
 */
function Abriendo() {
  return (
    <main aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-fondo px-4">
      <p className="text-subtitulo font-extrabold text-superficie">TEINS</p>
      <p className="text-ayuda text-texto-secundario">Abriendo…</p>
    </main>
  );
}

class ErrorDeLectura extends Component<{ children: ReactNode }, { fallo: boolean }> {
  override state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  override render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <Aviso tono="error">No se pudo leer la información de este teléfono. No se borró nada. Cierra la app y vuelve a abrirla.</Aviso>
      </main>
    );
  }
}

export function App() {
  const usuario = useUsuario();
  const [abierto, setAbierto] = useState<string>();
  const [Captura, setCaptura] = useState<ComponentType<PropsCaptura>>();
  // El levantamiento que se acaba de cerrar: el inicio lo resalta en su lista (lo enviado baja a "Enviados").
  const [recien, setRecien] = useState<string>();
  const mostrada = useRef<(() => void) | null>(null);
  const [pidiendoSesion, setPidiendoSesion] = useState(false);
  const [guiarInstalacion, setGuiarInstalacion] = useState(debeGuiarInstalacion);
  const {
    needRefresh: [actualizacionDisponible],
    updateServiceWorker,
  } = useRegisterSW({
    // ADR-0015: buscar versión nueva al abrir (lo hace el registro) y al recuperar conexión.
    onRegisteredSW(_url, registro) {
      if (registro) window.addEventListener("online", () => void registro.update());
    },
  });

  const conSesion = Boolean(usuario);
  useEffect(() => (conSesion ? programarSincronizacion() : undefined), [conSesion]);
  useEffect(() => {
    if (conSesion) void cargarCaptura().then((c) => setCaptura(() => c));
    // Sin sesión no queda nada de la persona anterior en memoria.
    else olvidarLecturas();
  }, [conSesion]);

  /**
   * Abrir un levantamiento (iteración 27): la tarjeta de la visita se convierte en la cabecera de la captura. La
   * transición espera a que la captura lea lo suyo, para no mostrar un esqueleto en el medio.
   */
  const abrir = (id: string) =>
    void conTransicion(async () => {
      const componente = await cargarCaptura();
      await new Promise<void>((listo) => {
        mostrada.current = listo;
        setTimeout(listo, ESPERA_CAPTURA_MS);
        setCaptura(() => componente);
        setRecien(undefined);
        setAbierto(id);
      });
      mostrada.current = null;
    }, "fundido");
  const volver = () =>
    void conTransicion(() => {
      setRecien(abierto);
      setAbierto(undefined);
      window.scrollTo(0, 0);
    }, "fundido");
  // Con el permiso ya dado, la suscripción se renueva al abrir: sin preguntar nada (ADR-0023).
  useEffect(() => {
    if (conSesion) void import("./dispositivo/avisos").then((m) => m.renovarSuscripcion()).catch(() => undefined);
  }, [conSesion]);

  let pantalla: ReactNode;
  if (usuario === undefined) pantalla = <Abriendo />;
  // La primera instalación requiere iniciar sesión (ADR-0015, sección 5).
  else if (usuario === null) pantalla = guiarInstalacion ? <InstalarApp alSeguir={() => setGuiarInstalacion(false)} /> : <IniciarSesion />;
  else if (pidiendoSesion) pantalla = <IniciarSesion alCancelar={() => setPidiendoSesion(false)} />;
  else if (abierto && Captura) pantalla = <Captura id={abierto} volver={volver} alMostrar={() => mostrada.current?.()} />;
  else if (abierto) pantalla = <Abriendo />;
  else
    pantalla = (
      // La actualización solo se ofrece aquí, nunca dentro de un levantamiento abierto (ADR-0015).
      <Inicio
        usuario={usuario}
        abrir={abrir}
        recien={recien}
        pedirSesion={() => setPidiendoSesion(true)}
        actualizacion={{ disponible: actualizacionDisponible, aplicar: () => void updateServiceWorker(true) }}
      />
    );

  return (
    <ErrorDeLectura>
      <Suspense fallback={<Abriendo />}>{pantalla}</Suspense>
    </ErrorDeLectura>
  );
}
