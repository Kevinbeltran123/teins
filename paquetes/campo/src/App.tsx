import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Aviso } from "@teins/ui";
import { Inicio } from "./pantallas/Inicio";
import { useUsuario } from "./sesion/usuario";
import { programarSincronizacion } from "./sincronizacion/disparar";

// Solo hace falta la primera vez o cuando la sesión vence: se carga aparte.
const IniciarSesion = lazy(() => import("./pantallas/IniciarSesion").then((m) => ({ default: m.IniciarSesion })));
// La captura no hace falta para abrir la app: se carga al abrir un levantamiento. El service worker la guarda
// con todo lo demás, así que abre igual sin conexión (ADR-0011).
const Captura = lazy(() => import("./pantallas/Captura").then((m) => ({ default: m.Captura })));

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
  const [pidiendoSesion, setPidiendoSesion] = useState(false);
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

  let pantalla: ReactNode;
  if (usuario === undefined) pantalla = <Abriendo />;
  // La primera instalación requiere iniciar sesión (ADR-0015, sección 5).
  else if (usuario === null) pantalla = <IniciarSesion />;
  else if (pidiendoSesion) pantalla = <IniciarSesion alCancelar={() => setPidiendoSesion(false)} />;
  else if (abierto) pantalla = <Captura id={abierto} volver={() => setAbierto(undefined)} />;
  else
    pantalla = (
      // La actualización solo se ofrece aquí, nunca dentro de un levantamiento abierto (ADR-0015).
      <Inicio
        usuario={usuario}
        abrir={setAbierto}
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
