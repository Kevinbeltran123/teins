import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, IDENTIFICADOR_ACCESO } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto } from "@teins/ui";
import { cliente, consultas } from "../api";

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeRed) return "No hay conexión con el portal. Revise su conexión e intente de nuevo.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") {
    const minutos = Math.max(1, Math.ceil((error.problema.reintentarEnSegundos ?? 60) / 60));
    return `Demasiados intentos. Por seguridad, espere ${minutos === 1 ? "un minuto" : `${minutos} minutos`} antes de volver a intentar.`;
  }
  if (error instanceof ErrorApi && (error.codigo === "no_autenticado" || error.codigo === "entrada_invalida")) return "El código de acceso o la clave no son correctos.";
  return "No se pudo ingresar. Intente de nuevo.";
}

/** El QR trae el código de acceso en la dirección (?acceso=…); nunca la clave (ADR-0009, parte 4). */
const accesoDelQr = () => {
  const valor = new URLSearchParams(window.location.search).get("acceso")?.trim().toLowerCase() ?? "";
  return IDENTIFICADOR_ACCESO.test(valor) ? valor : "";
};

export function Ingreso() {
  const consultasCliente = useQueryClient();
  const [delQr] = useState(accesoDelQr);
  const [identificador, setIdentificador] = useState(delQr);
  const [clave, setClave] = useState("");
  const [estado, setEstado] = useState<{ tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string }>({ tipo: "listo" });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (identificador.trim() === "" || clave.trim() === "") {
      setEstado({ tipo: "error", mensaje: delQr ? "Escriba la clave que le entregó TEINS." : "Escriba el código de acceso y la clave que le entregó TEINS." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await cliente.llamar("ingresarAlPortal", { cuerpo: { identificador: identificador.trim(), clave } });
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-5 py-6 text-sobre-superficie">
        <p className="text-ayuda text-sobre-superficie-suave">TEINS · [LOGO]</p>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Sus informes técnicos</h1>
        <p className="mt-2 text-cuerpo text-sobre-superficie-suave">Ingrese con la clave que le entregó TEINS para ver y descargar sus informes.</p>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-5 rounded-panel bg-panel p-5">
          {delQr ? (
            <p className="text-ayuda text-texto-secundario">Código de acceso tomado del QR.</p>
          ) : (
            <CampoTexto etiqueta="Código de acceso" nombre="acceso" autoComplete="username" valorInicial="" onCambio={setIdentificador} />
          )}
          <CampoTexto etiqueta="Clave" nombre="clave" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setClave} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <Boton type="submit" variante="principal" disabled={estado.tipo === "enviando"}>
            {estado.tipo === "enviando" ? "Ingresando…" : "Ver mis informes"}
          </Boton>
        </form>
        <p className="text-ayuda text-texto-secundario">¿Perdió la clave? Pídale a TEINS un acceso nuevo; el anterior dejará de funcionar.</p>
      </main>
    </div>
  );
}
