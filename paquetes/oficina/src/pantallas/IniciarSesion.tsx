import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto, KeyRound } from "@teins/ui";
import { cliente, consultas } from "../api";

/** En el computador también sirve la llave del celular (con un código QR): basta con que el navegador sepa de llaves. */
const conLlaves = typeof window !== "undefined" && "PublicKeyCredential" in window;

function mensajeDeError(error: unknown, conLlave = false): string {
  if (error instanceof ErrorDeRed) return "No hay conexión con el servidor. Revise su conexión e intente de nuevo.";
  if (conLlave && error instanceof ErrorApi && error.codigo !== "demasiadas_solicitudes") return "Esa llave de acceso no sirve. Inicie sesión con su usuario y contraseña.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "Usuario o contraseña incorrectos.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return "Demasiados intentos. Espere un minuto e intente de nuevo.";
  return "No se pudo iniciar sesión. Intente de nuevo.";
}

function mensajeDeCodigo(error: unknown): { mensaje: string; volver: boolean } {
  if (error instanceof ErrorDeRed) return { mensaje: "No hay conexión con el servidor. Revise su conexión e intente de nuevo.", volver: false };
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return { mensaje: "El código no es correcto o ya venció. Revise que la hora del celular esté al día.", volver: false };
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return { mensaje: "Demasiados códigos equivocados. Espere 15 minutos e inicie sesión de nuevo.", volver: true };
  // El desafío se invalida tras cinco códigos equivocados: hay que empezar otra vez con la contraseña.
  return { mensaje: "Demasiados intentos con este ingreso. Inicie sesión de nuevo.", volver: true };
}

type Estado = { tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string };

export function IniciarSesion({ aviso }: { aviso?: string }) {
  const consultasCliente = useQueryClient();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pideCodigo, setPideCodigo] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (usuario.trim() === "" || contrasena === "") {
      setEstado({ tipo: "error", mensaje: "Escriba su usuario y su contraseña." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      const { pideCodigo } = await cliente.iniciarSesion(usuario, contrasena);
      if (pideCodigo) {
        setPideCodigo(true);
        setEstado({ tipo: "listo" });
        return;
      }
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  async function verificar(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.trim() === "") {
      setEstado({ tipo: "error", mensaje: "Escriba el código de su app autenticadora." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await cliente.verificarSegundoFactor(codigo);
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      const { mensaje, volver } = mensajeDeCodigo(error);
      if (volver) {
        setPideCodigo(false);
        setContrasena("");
      }
      setEstado({ tipo: "error", mensaje });
    }
  }

  async function entrarConLlave() {
    setEstado({ tipo: "enviando" });
    try {
      await cliente.iniciarSesionConLlave();
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado(esLlaveCancelada(error) ? { tipo: "listo" } : { tipo: "error", mensaje: mensajeDeError(error, true) });
    }
  }

  function volverAEmpezar() {
    setPideCodigo(false);
    setContrasena("");
    setCodigo("");
    setEstado({ tipo: "listo" });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-4 py-12">
      <p className="flex flex-col items-center">
        <span className="text-titulo leading-none font-extrabold tracking-wide text-superficie">TEINS</span>
        <span className="text-ayuda text-texto-secundario">Oficina</span>
      </p>
      <main className="flex w-full max-w-md flex-col gap-4">
        {aviso && <Aviso tono="alerta">{aviso}</Aviso>}
        {pideCodigo ? (
          <form key="codigo" onSubmit={verificar} noValidate className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-6">
            <h1 className="text-subtitulo font-extrabold">Código de verificación</h1>
            <p className="text-cuerpo text-texto-secundario">Abra su app autenticadora y escriba los 6 dígitos de TEINS. Si no tiene el celular, use uno de sus códigos de respaldo.</p>
            <CampoTexto etiqueta="Código" nombre="codigo" autoComplete="one-time-code" modoEntrada="numeric" valorInicial="" onCambio={setCodigo} />
            {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
            <Boton type="submit" variante="principal" cargando={estado.tipo === "enviando"}>
              Verificar código
            </Boton>
            <Boton type="button" variante="fantasma" onClick={volverAEmpezar}>
              Volver a la contraseña
            </Boton>
          </form>
        ) : (
          <form key="contrasena" onSubmit={enviar} noValidate className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-6">
            <h1 className="text-subtitulo font-extrabold">Iniciar sesión</h1>
            <CampoTexto etiqueta="Usuario" nombre="usuario" autoComplete="username" valorInicial={usuario} onCambio={setUsuario} />
            <CampoTexto etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
            {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
            <Boton type="submit" variante="principal" cargando={estado.tipo === "enviando"}>
              Iniciar sesión
            </Boton>
            {conLlaves && (
              <Boton type="button" icono={KeyRound} onClick={() => void entrarConLlave()} disabled={estado.tipo === "enviando"}>
                Entrar con llave de acceso
              </Boton>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
