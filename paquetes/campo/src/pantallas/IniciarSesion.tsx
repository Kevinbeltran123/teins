import { useEffect, useId, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { admiteLlaves, ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton, Eye, EyeOff, KeyRound, LoaderCircle, TramaDePuntos } from "@teins/ui";
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
    <main className="flex min-h-dvh flex-col bg-[#070A10]">
      {/* La franja de la marca: la trama quieta de oficina, en horizontal. No cambia de alto al escribir: si se movería, el toque en "Ingresar" caería fuera. */}
      <div aria-hidden className="relative h-[34dvh] min-h-[190px] shrink-0 overflow-hidden px-[22px] pt-[max(58px,calc(env(safe-area-inset-top)+24px))]">
        <TramaDePuntos ancho={390} alto={300} paso={11} radio={4.6} />
        <span className="relative text-[34px] leading-none font-extrabold tracking-[0.14em] text-[#F3F5F9]">TEINS</span>
      </div>
      <div className="relative -mt-[26px] flex grow flex-col gap-4 rounded-t-[28px] border-t border-borde-suave bg-fondo px-[22px] pt-7 pb-[max(1.625rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] leading-tight font-extrabold">Ingresar</h1>
          <p className="text-[15px] text-texto-secundario">Usa tu usuario de TEINS.</p>
        </div>
        {accesoCerrado && <Aviso tono="alerta">Se cerró el acceso de {accesoCerrado.nombre} en este teléfono y se borraron sus datos.</Aviso>}
        {alCancelar && <Aviso tono="alerta">Tu sesión venció. Inicia sesión para enviar lo pendiente; lo capturado sigue en este teléfono.</Aviso>}
        {!enLinea && <Aviso tono="alerta">Sin conexión. Iniciar sesión necesita señal la primera vez.</Aviso>}
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <Campo etiqueta="Usuario" nombre="usuario" autoComplete="username" valor={usuario} onCambio={setUsuario} />
          <Campo etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valor={contrasena} onCambio={setContrasena} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <button
            type="submit"
            aria-busy={estado.tipo === "enviando" || undefined}
            className="flex h-[58px] items-center justify-center gap-2.5 rounded-[14px] bg-[#F3F5F9] text-[17px] font-extrabold text-[#0B0F17] active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {estado.tipo === "enviando" && <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />}
            Ingresar
          </button>
          {conLlave && (
            <>
              <div aria-hidden className="flex items-center gap-3 text-[14px] font-bold text-texto-secundario">
                <span className="h-px grow bg-borde-suave" />o<span className="h-px grow bg-borde-suave" />
              </div>
              <button
                type="button"
                onClick={() => void entrarConLlave()}
                disabled={estado.tipo === "enviando"}
                className="flex h-[58px] items-center justify-center gap-2.5 rounded-[14px] border border-borde-suave text-[17px] font-extrabold active:scale-[0.98] disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-5"
              >
                <KeyRound aria-hidden />
                Ingresar con llave de acceso
              </button>
            </>
          )}
        </form>
        <p className="mt-auto pt-4 text-center text-[14px] text-texto-secundario">¿Olvidaste tu contraseña? Pídele a oficina que la restablezca.</p>
        {alCancelar && (
          <Boton variante="fantasma" onClick={alCancelar}>
            Seguir sin enviar
          </Boton>
        )}
      </div>
    </main>
  );
}

/** Campo con la etiqueta encima; la contraseña empieza oculta y el ojo la muestra (prototipos/campo, "Ingresar"). */
function Campo({ etiqueta, tipo = "text", autoComplete, nombre, valor, onCambio }: { etiqueta: string; tipo?: "text" | "password"; autoComplete: string; nombre: string; valor: string; onCambio: (v: string) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-[15px] font-bold">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          name={nombre}
          type={tipo === "password" && !visible ? "password" : "text"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          className={`h-[58px] w-full rounded-[14px] border border-borde-suave bg-[#0F141E] px-4 text-[17px] text-texto outline-none focus:border-foco focus:shadow-[0_0_0_3px_rgb(255_194_26/0.2)] ${tipo === "password" ? "pr-14" : ""}`}
        />
        {tipo === "password" && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar lo escrito" : "Mostrar lo escrito"}
            aria-pressed={visible}
            className="absolute top-1.5 right-1.5 grid size-[46px] place-items-center rounded-xl text-texto-secundario focus-visible:outline-3 focus-visible:outline-foco [&_svg]:size-5"
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}
