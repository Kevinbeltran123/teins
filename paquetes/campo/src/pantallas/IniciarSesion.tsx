import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { admiteLlaves, ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton, BotonSiguiente, CampoFlotante, KeyRound, ScanFace, UserRound } from "@teins/ui";
import { db } from "../datos/instancia";
import { useConexionDelNavegador } from "../dispositivo/useConexion";
import { iniciarSesion, iniciarSesionConLlave, RolNoPermitido } from "../sesion/sesion";

function mensajeDeError(error: unknown, conLlave = false): string {
  if (error instanceof ErrorDeRed) return "Necesitas conexión para iniciar sesión.";
  if (error instanceof RolNoPermitido) return "Este usuario es de oficina. En campo se ingresa con un usuario de técnico.";
  // Una llave quitada, de un usuario desactivado o sin Face ID ni PIN: se entra con la contraseña.
  if (conLlave && error instanceof ErrorApi && error.codigo !== "demasiadas_solicitudes") return "Esa llave de acceso no sirve. Entra con tu usuario y contraseña.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "Usuario o contraseña incorrectos.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return "Demasiados intentos. Espera un minuto e intenta de nuevo.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

/** `alCancelar` existe cuando la sesión venció: se puede volver a capturar sin iniciar sesión. */
export function IniciarSesion({ alCancelar }: { alCancelar?: () => void }) {
  const enLinea = useConexionDelNavegador();
  // Tras una revocación (QA-5): quien vuelva a abrir la app sabe por qué no hay nada.
  const accesoCerrado = useLiveQuery(async () => {
    const ajuste = await db.ajustes.get("acceso_cerrado");
    return ajuste?.clave === "acceso_cerrado" ? ajuste.valor : null;
  });
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [estado, setEstado] = useState<{ tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string }>({ tipo: "listo" });
  const [conLlave, setConLlave] = useState(false);
  useEffect(() => void admiteLlaves().then(setConLlave), []);

  async function entrarConLlave() {
    setEstado({ tipo: "enviando" });
    try {
      await iniciarSesionConLlave();
      alCancelar?.();
    } catch (error) {
      // Cerrar el diálogo del teléfono no es un error.
      setEstado(esLlaveCancelada(error) ? { tipo: "listo" } : { tipo: "error", mensaje: mensajeDeError(error, true) });
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (usuario.trim() === "" || contrasena === "") {
      setEstado({ tipo: "error", mensaje: "Escribe tu usuario y tu contraseña." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await iniciarSesion(usuario, contrasena);
      alCancelar?.();
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-fondo px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md grow flex-col gap-6">
        {/* Rocket Money y Remote (Mobbin): la marca centrada arriba, el saludo y los campos con la acción justo debajo. */}
        <div className="flex flex-col items-center gap-5 pt-[8vh] text-center motion-safe:animate-subir">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="h-9 w-2 rounded-full bg-acento" />
            <span className="text-[34px] leading-none font-extrabold tracking-[0.08em]">TEINS</span>
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">Hola de nuevo</h1>
            <p className="text-cuerpo text-texto-secundario">Inicia sesión para ver tus visitas.</p>
          </div>
        </div>
        {accesoCerrado && <Aviso tono="alerta">Se cerró el acceso de {accesoCerrado.nombre} en este teléfono y se borraron sus datos.</Aviso>}
        {alCancelar && <Aviso tono="alerta">Tu sesión venció. Inicia sesión para enviar lo pendiente; lo capturado sigue en este teléfono.</Aviso>}
        {!enLinea && <Aviso tono="alerta">Sin conexión. Iniciar sesión necesita señal la primera vez.</Aviso>}
        <form onSubmit={enviar} noValidate className="flex flex-col gap-3 motion-safe:animate-subir">
          <CampoFlotante etiqueta="Usuario" nombre="usuario" autoComplete="username" icono={UserRound} onCambio={setUsuario} />
          <CampoFlotante etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" icono={KeyRound} onCambio={setContrasena} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <div className="flex pt-2">
            <BotonSiguiente type="submit" cargando={estado.tipo === "enviando"}>
              Iniciar sesión
            </BotonSiguiente>
          </div>
          {conLlave && (
            <>
              {/* Oportun (Mobbin): la entrada sin contraseña como alternativa clara, separada. */}
              <div aria-hidden className="flex items-center gap-3 py-1 text-ayuda font-bold text-texto-secundario">
                <span className="h-px grow bg-division" />o<span className="h-px grow bg-division" />
              </div>
              <button
                type="button"
                onClick={() => void entrarConLlave()}
                disabled={estado.tipo === "enviando"}
                className="flex min-h-15 items-center justify-center gap-2.5 rounded-control bg-panel text-cuerpo font-extrabold active:scale-[0.98] disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-6"
              >
                <ScanFace aria-hidden />
                Entrar con llave de acceso
              </button>
            </>
          )}
        </form>
        <p className="mt-auto text-center text-ayuda text-texto-secundario">¿Olvidaste tu contraseña? Oficina te da una nueva.</p>
        {alCancelar && (
          <Boton variante="fantasma" onClick={alCancelar}>
            Seguir sin enviar
          </Boton>
        )}
      </div>
    </main>
  );
}
