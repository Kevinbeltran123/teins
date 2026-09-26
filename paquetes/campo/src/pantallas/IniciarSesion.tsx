import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { admiteLlaves, ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto } from "@teins/ui";
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
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-4 pt-5 pb-5 text-sobre-superficie">
        <p className="text-ayuda text-sobre-superficie-suave">TEINS Campo</p>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Iniciar sesión</h1>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        {accesoCerrado && <Aviso tono="alerta">Se cerró el acceso de {accesoCerrado.nombre} en este teléfono y se borraron sus datos.</Aviso>}
        {alCancelar && <Aviso tono="alerta">Tu sesión venció. Inicia sesión para enviar lo pendiente; lo capturado sigue en este teléfono.</Aviso>}
        {!enLinea && <Aviso>Sin conexión. Iniciar sesión necesita señal la primera vez.</Aviso>}
        <form onSubmit={enviar} noValidate className="flex flex-col gap-5 rounded-panel bg-panel p-4">
          <CampoTexto etiqueta="Usuario" nombre="usuario" autoComplete="username" valorInicial="" onCambio={setUsuario} />
          <CampoTexto etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <Boton type="submit" variante="principal" disabled={estado.tipo === "enviando"}>
            {estado.tipo === "enviando" ? "Iniciando sesión…" : "Iniciar sesión"}
          </Boton>
        </form>
        {conLlave && (
          <Boton onClick={() => void entrarConLlave()} disabled={estado.tipo === "enviando"}>
            Entrar con llave de acceso
          </Boton>
        )}
        {alCancelar && <Boton onClick={alCancelar}>Seguir sin enviar</Boton>}
      </main>
    </div>
  );
}
