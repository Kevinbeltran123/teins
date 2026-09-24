import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto } from "@teins/ui";
import { cliente, consultas } from "../api";

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeRed) return "No hay conexión con el servidor. Revise su conexión e intente de nuevo.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "Usuario o contraseña incorrectos.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return "Demasiados intentos. Espere un minuto e intente de nuevo.";
  return "No se pudo iniciar sesión. Intente de nuevo.";
}

export function IniciarSesion({ aviso }: { aviso?: string }) {
  const consultasCliente = useQueryClient();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [estado, setEstado] = useState<{ tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string }>({ tipo: "listo" });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (usuario.trim() === "" || contrasena === "") {
      setEstado({ tipo: "error", mensaje: "Escriba su usuario y su contraseña." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await cliente.iniciarSesion(usuario, contrasena);
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-6 py-5 text-sobre-superficie">
        <p className="text-ayuda text-sobre-superficie-suave">TEINS Oficina</p>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Iniciar sesión</h1>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
        {aviso && <Aviso tono="alerta">{aviso}</Aviso>}
        <form onSubmit={enviar} noValidate className="flex flex-col gap-5 rounded-panel bg-panel p-6">
          <CampoTexto etiqueta="Usuario" nombre="usuario" autoComplete="username" valorInicial="" onCambio={setUsuario} />
          <CampoTexto etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <Boton type="submit" variante="principal" disabled={estado.tipo === "enviando"}>
            {estado.tipo === "enviando" ? "Iniciando sesión…" : "Iniciar sesión"}
          </Boton>
        </form>
      </main>
    </div>
  );
}
