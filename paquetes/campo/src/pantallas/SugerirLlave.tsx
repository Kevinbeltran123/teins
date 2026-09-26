import { useEffect, useState } from "react";
import { admiteLlaves, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton } from "@teins/ui";
import { cliente } from "../sincronizacion/instancia";

/** "Ahora no" es por técnico y por teléfono: una comodidad, no un dato del negocio. */
const claveDescartada = (usuarioId: string) => `teins-llave-descartada:${usuarioId}`;
function descartada(usuarioId: string): boolean {
  try {
    return localStorage.getItem(claveDescartada(usuarioId)) !== null;
  } catch {
    return false;
  }
}

/**
 * Propone crear una llave de acceso (ADR-0009: recomendada para técnicos; iteración 13). Solo con señal,
 * si el teléfono tiene Face ID, huella o PIN y el técnico todavía no tiene una. Se carga aparte.
 */
export default function SugerirLlave({ usuarioId, enLinea }: { usuarioId: string; enLinea: boolean }) {
  const [estado, setEstado] = useState<"oculta" | "ofrecer" | "creando" | "creada" | "error">("oculta");

  useEffect(() => {
    if (!enLinea || descartada(usuarioId)) return;
    let vigente = true;
    void (async () => {
      const ofrecer = (await admiteLlaves()) && (await cliente.llaves().catch(() => [1])).length === 0;
      if (vigente && ofrecer) setEstado("ofrecer");
    })();
    return () => {
      vigente = false;
    };
  }, [usuarioId, enLinea]);

  async function crear() {
    setEstado("creando");
    try {
      await cliente.crearLlave();
      setEstado("creada");
    } catch (error) {
      setEstado(esLlaveCancelada(error) ? "ofrecer" : "error");
    }
  }

  function ahoraNo() {
    try {
      localStorage.setItem(claveDescartada(usuarioId), new Date().toISOString());
    } catch {
      // Sin almacenamiento, se vuelve a ofrecer la próxima vez: no pasa nada.
    }
    setEstado("oculta");
  }

  if (estado === "oculta") return null;
  if (estado === "creada") return <Aviso tono="info">Listo. La próxima vez entra con "Entrar con llave de acceso": Face ID, huella o el PIN del teléfono.</Aviso>;
  return (
    <section aria-labelledby="titulo-llave" className="flex flex-col gap-3 rounded-panel bg-panel p-4">
      <h2 id="titulo-llave" className="text-subtitulo font-extrabold">
        Entra sin escribir la contraseña
      </h2>
      <p className="text-cuerpo">Crea una llave de acceso en este teléfono y entra con Face ID, huella o el PIN. Es más rápido y más seguro que una contraseña.</p>
      {estado === "error" && <Aviso tono="error">No se pudo crear la llave. Revisa la señal e intenta de nuevo.</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton variante="principal" onClick={() => void crear()} disabled={estado === "creando"}>
          {estado === "creando" ? "Creando…" : "Crear llave de acceso"}
        </Boton>
        <Boton onClick={ahoraNo}>Ahora no</Boton>
      </div>
    </section>
  );
}
