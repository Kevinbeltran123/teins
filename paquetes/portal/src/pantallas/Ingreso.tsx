import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, IDENTIFICADOR_ACCESO } from "@teins/protocolo";
import { Aviso, CampoDeIngreso, claseBotonIngreso, LoaderCircle, MarcoDeIngreso } from "@teins/ui";
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
    <MarcoDeIngreso titulo="Sus informes técnicos" debajo="¿Perdió la clave? Pídale a TEINS un acceso nuevo; el anterior dejará de funcionar.">
      <p className="-mt-3 text-center text-[14px] text-texto-secundario">Con la clave que le entregó TEINS puede ver y descargar los informes de sus visitas.</p>
      {aviso}
      {sesionCerrada && <Aviso tono="alerta">Su sesión se cerró: pasaron 30 minutos sin usarla o TEINS le entregó una clave nueva. Ingrese de nuevo con la clave vigente.</Aviso>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {delQr ? (
          <p className="text-[13px] text-texto-secundario">Código de acceso tomado del QR.</p>
        ) : (
          <CampoDeIngreso etiqueta="Código de acceso" nombre="acceso" autoComplete="username" valor={identificador} onCambio={setIdentificador} />
        )}
        <CampoDeIngreso etiqueta="Clave" nombre="clave" tipo="password" autoComplete="current-password" valor={clave} onCambio={setClave} />
        {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
        <button type="submit" aria-busy={estado.tipo === "enviando" || undefined} className={claseBotonIngreso(true)}>
          {estado.tipo === "enviando" && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Ver mis informes
        </button>
      </form>
    </MarcoDeIngreso>
  );
}
