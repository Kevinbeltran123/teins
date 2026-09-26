import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto } from "@teins/ui";
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
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-6 py-5 text-sobre-superficie">
        <p className="text-ayuda text-sobre-superficie-suave">TEINS Oficina</p>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">{pideCodigo ? "Código de verificación" : "Iniciar sesión"}</h1>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
        {aviso && <Aviso tono="alerta">{aviso}</Aviso>}
        {pideCodigo ? (
          <form key="codigo" onSubmit={verificar} noValidate className="flex flex-col gap-5 rounded-panel bg-panel p-6">
            <p className="text-cuerpo">Abra su app autenticadora y escriba los 6 dígitos de TEINS. Si no tiene el celular, use uno de sus códigos de respaldo.</p>
            <CampoTexto etiqueta="Código" nombre="codigo" autoComplete="one-time-code" modoEntrada="numeric" valorInicial="" onCambio={setCodigo} />
            {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
            <Boton type="submit" variante="principal" disabled={estado.tipo === "enviando"}>
              {estado.tipo === "enviando" ? "Verificando…" : "Verificar código"}
            </Boton>
            <Boton type="button" onClick={volverAEmpezar}>
              Volver a la contraseña
            </Boton>
          </form>
        ) : (
          <form key="contrasena" onSubmit={enviar} noValidate className="flex flex-col gap-5 rounded-panel bg-panel p-6">
            <CampoTexto etiqueta="Usuario" nombre="usuario" autoComplete="username" valorInicial={usuario} onCambio={setUsuario} />
            <CampoTexto etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
            {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
            <Boton type="submit" variante="principal" disabled={estado.tipo === "enviando"}>
              {estado.tipo === "enviando" ? "Iniciando sesión…" : "Iniciar sesión"}
            </Boton>
            {conLlaves && (
              <Boton type="button" onClick={() => void entrarConLlave()} disabled={estado.tipo === "enviando"}>
                Entrar con llave de acceso
              </Boton>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
