import { useState, type FormEvent, type ReactNode } from "react";
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

export function Ingreso({ sesionCerrada = false, aviso }: { sesionCerrada?: boolean; aviso?: ReactNode }) {
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
    <div className="flex min-h-dvh flex-col items-center bg-fondo px-4 py-10">
      <main className="flex w-full max-w-md flex-col gap-4">
        {/* La marca, más pequeña que el título: el logo en vector sigue pendiente (DESIGN.md, logo). */}
        <p className="text-subtitulo font-extrabold tracking-wide text-superficie">TEINS</p>
        {aviso}
        {sesionCerrada && (
          <Aviso tono="alerta">Su sesión se cerró: pasaron 30 minutos sin usarla o TEINS le entregó una clave nueva. Ingrese de nuevo con la clave vigente.</Aviso>
        )}
        <form onSubmit={enviar} noValidate aria-labelledby="titulo-ingreso" className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-6">
          <div className="flex flex-col gap-1.5">
            <h1 id="titulo-ingreso" className="text-titulo leading-tight font-extrabold tracking-tight">
              Sus informes técnicos
            </h1>
            <p className="text-cuerpo text-texto-secundario">Con la clave que le entregó TEINS puede ver y descargar los informes de sus visitas.</p>
          </div>
          {delQr ? (
            <p className="text-ayuda text-texto-secundario">Código de acceso tomado del QR.</p>
          ) : (
            <CampoTexto etiqueta="Código de acceso" nombre="acceso" autoComplete="username" valorInicial="" onCambio={setIdentificador} />
          )}
          <CampoTexto etiqueta="Clave" nombre="clave" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setClave} />
          {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
          <Boton type="submit" variante="principal" className="w-full" cargando={estado.tipo === "enviando"}>
            Ver mis informes
          </Boton>
        </form>
        <p className="text-ayuda text-texto-secundario">¿Perdió la clave? Pídale a TEINS un acceso nuevo; el anterior dejará de funcionar.</p>
      </main>
    </div>
  );
}
