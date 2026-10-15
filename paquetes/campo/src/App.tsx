import { Component, lazy, Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Aviso, conTransicion, useNotificar } from "@teins/ui";
import { repositorio } from "./datos/instancia";
import { olvidarLecturas } from "./datos/lecturaRecordada";
import { debeGuiarInstalacion } from "./dispositivo/instalacion";
import { Inicio } from "./pantallas/Inicio";
import { useUsuario } from "./sesion/usuario";
import { programarSincronizacion, sincronizarEnSegundoPlano } from "./sincronizacion/disparar";
import { conversacionPedida, escucharAvisos } from "./dispositivo/conversacion";

// Solo hace falta la primera vez o cuando la sesión vence: se carga aparte.
const IniciarSesion = lazy(() => import("./pantallas/IniciarSesion").then((m) => ({ default: m.IniciarSesion })));
// Solo en un teléfono sin la app instalada, antes de iniciar sesión (ADR-0023, parte 3).
const InstalarApp = lazy(() => import("./pantallas/InstalarApp"));
// La captura no hace falta para abrir la app: se carga aparte, apenas se abre el inicio, para que abrir una visita no
// pase por una pantalla de carga (iteración 27). El service worker la guarda con todo lo demás, así que abre igual
// sin conexión (ADR-0011).
type PropsCaptura = { id: string; volver: () => void; alMostrar?: () => void; alDescartar?: () => void; conversacion?: boolean };
let moduloCaptura: Promise<ComponentType<PropsCaptura>> | undefined;
// Si la carga falla (sin red y sin la versión en caché), se olvida: el siguiente toque la intenta de nuevo (iteración 42).
const cargarCaptura = () =>
  (moduloCaptura ??= import("./pantallas/Captura")
    .then((m) => m.Captura)
    .catch((error: unknown) => {
      moduloCaptura = undefined;
      throw error;
    }));
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
  // Abierto desde un aviso de oficina: con el chat a la vista (ADR-0040).
  const [conChat, setConChat] = useState(false);
  const [Captura, setCaptura] = useState<ComponentType<PropsCaptura>>();
  // El levantamiento que se acaba de cerrar: el inicio lo resalta en su lista (lo enviado baja a "Enviados").
  const [recien, setRecien] = useState<string>();
  const mostrada = useRef<(() => void) | null>(null);
  // "Ver en Descartados" pide al inicio abrir la papelera (ADR-0035).
  const [pedirPapelera, setPedirPapelera] = useState(0);
  const notificar = useNotificar();
  const [pidiendoSesion, setPidiendoSesion] = useState(false);
  // Tocar una visita no abrió nada (la captura no se pudo cargar): se dice en el inicio en vez de no hacer nada.
  const [noAbrio, setNoAbrio] = useState(false);
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
    if (conSesion) {
      void cargarCaptura().then((c) => setCaptura(() => c), () => undefined);
      // Lo que lleva más de 30 días en la papelera se borra del teléfono con sus fotos (ADR-0035). Después, los archivos
      // que nada usa (fotos de un tablero quitado): al abrir, ningún «Deshacer» los puede devolver (iteración 42).
      void repositorio
        .vaciarPapelera(new Date())
        .then(() => repositorio.limpiarArchivosSinUso())
        .catch(() => undefined);
    }
    // Sin sesión no queda nada de la persona anterior en memoria.
    else olvidarLecturas();
  }, [conSesion]);

  /**
   * Abrir un levantamiento (iteración 27): la tarjeta de la visita se convierte en la cabecera de la captura. La
   * transición espera a que la captura lea lo suyo, para no mostrar un esqueleto en el medio.
   */
  const abrir = (id: string, chat = false) =>
    void conTransicion(async () => {
      let componente: ComponentType<PropsCaptura>;
      try {
        componente = await cargarCaptura();
      } catch (error) {
        console.error("No se pudo cargar la captura", error);
        setNoAbrio(true);
        return;
      }
      setNoAbrio(false);
      await new Promise<void>((listo) => {
        mostrada.current = listo;
        setTimeout(listo, ESPERA_CAPTURA_MS);
        setCaptura(() => componente);
        setRecien(undefined);
        setConChat(chat);
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
  // Un aviso de oficina abre su chat (ADR-0040): al abrir la app desde él, o con la app ya abierta.
  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;
  useEffect(() => {
    if (!conSesion) return;
    const pedida = conversacionPedida(location.href);
    if (pedida) {
      history.replaceState(history.state, "", "/");
      abrirRef.current(pedida, true);
    }
    return escucharAvisos({
      abrir: (direccion) => {
        const id = conversacionPedida(direccion);
        if (id) abrirRef.current(id, true);
      },
      consultar: () => sincronizarEnSegundoPlano({ bajar: true }),
    });
  }, [conSesion]);
  // Con el permiso ya dado, la suscripción se renueva al abrir: sin preguntar nada (ADR-0023).
  useEffect(() => {
    if (conSesion) void import("./dispositivo/avisos").then((m) => m.renovarSuscripcion()).catch(() => undefined);
  }, [conSesion]);

  let pantalla: ReactNode;
  if (usuario === undefined) pantalla = <Abriendo />;
  // La primera instalación requiere iniciar sesión (ADR-0015, sección 5).
  else if (usuario === null) pantalla = guiarInstalacion ? <InstalarApp alSeguir={() => setGuiarInstalacion(false)} /> : <IniciarSesion />;
  else if (pidiendoSesion) pantalla = <IniciarSesion alCancelar={() => setPidiendoSesion(false)} />;
  else if (abierto && Captura)
    pantalla = (
      <Captura
        key={`${abierto}:${conChat}`}
        id={abierto}
        conversacion={conChat}
        volver={volver}
        alMostrar={() => mostrada.current?.()}
        alDescartar={() => {
          void conTransicion(() => {
            setAbierto(undefined);
            window.scrollTo(0, 0);
          }, "fundido");
          notificar({ texto: "Levantamiento descartado", accion: { texto: "Ver en Descartados", alHacer: () => setPedirPapelera((n) => n + 1) } });
        }}
      />
    );
  else if (abierto) pantalla = <Abriendo />;
  else
    pantalla = (
      // La actualización solo se ofrece aquí, nunca dentro de un levantamiento abierto (ADR-0015).
      <Inicio
        usuario={usuario}
        abrir={abrir}
        recien={recien}
        pedirPapelera={pedirPapelera}
        papeleraAbierta={() => setPedirPapelera(0)}
        pedirSesion={() => setPidiendoSesion(true)}
        actualizacion={{ disponible: actualizacionDisponible, aplicar: () => void updateServiceWorker(true) }}
      />
    );

  return (
    <ErrorDeLectura>
      <Suspense fallback={<Abriendo />}>{pantalla}</Suspense>
      {/* Fijo arriba: quien tocó la visita puede estar lejos del principio de la lista. */}
      {noAbrio && !abierto && (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto max-w-xl shadow-menu">
          <Aviso tono="error">No se pudo abrir el levantamiento. Conéctate un momento y vuelve a tocarlo; no se borró nada.</Aviso>
        </div>
      )}
    </ErrorDeLectura>
  );
}
