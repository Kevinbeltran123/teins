import { useEffect, useState } from "react";
import { Aviso, Bell, Boton, useNotificar } from "@teins/ui";
import { activarAvisos, clavePublicaDeAvisos } from "../dispositivo/avisos";
import { estadoAvisos } from "../dispositivo/estadoAvisos";

/** "Ahora no" es por técnico y por teléfono: una comodidad, no un dato del negocio (como la llave de acceso). */
const claveDescartada = (usuarioId: string) => `teins-avisos-descartados:${usuarioId}`;
function descartada(usuarioId: string): boolean {
  try {
    return localStorage.getItem(claveDescartada(usuarioId)) !== null;
  } catch {
    return false;
  }
}

/**
 * Propone activar los avisos (ADR-0023) una vez, bajo la siguiente visita: secundaria, porque la acción
 * principal de la pantalla es la de la visita. Solo con señal y si el entorno los tiene encendidos; sin la
 * app instalada en iPhone no aparece, porque el aviso de instalación del inicio ya lo dice. Se carga aparte.
 */
export default function TarjetaAvisos({ usuarioId, enLinea }: { usuarioId: string; enLinea: boolean }) {
  const [estado, setEstado] = useState<"oculta" | "ofrecer" | "activando" | "error">("oculta");
  // La clave se trae al mostrar la tarjeta: al tocar, el permiso se pide sin esperar la red (iPhone lo exige).
  const [clave, setClave] = useState<string>();
  const notificar = useNotificar();

  useEffect(() => {
    if (!enLinea || estadoAvisos() !== "sin_activar" || descartada(usuarioId)) return;
    let vigente = true;
    clavePublicaDeAvisos().then(
      (clavePublica) => {
        if (!vigente || !clavePublica) return;
        setClave(clavePublica);
        setEstado("ofrecer");
      },
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [usuarioId, enLinea]);

  async function activar() {
    setEstado("activando");
    try {
      const resultado = await activarAvisos(clave!);
      if (resultado === "activos") notificar({ texto: "Avisos activados en este teléfono." });
      // Bloqueados: el diagnóstico dice cómo permitirlos. Sin decidir (cerró la pregunta): se vuelve a ofrecer.
      setEstado(resultado === "sin_decidir" ? "ofrecer" : "oculta");
    } catch {
      setEstado("error");
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
  return (
    <section aria-labelledby="titulo-avisos" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie [&_svg]:size-5">
          <Bell />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="titulo-avisos" className="text-subtitulo leading-snug font-extrabold">
            Avisos en este teléfono
          </h2>
          <p className="text-cuerpo">Te avisamos cuando oficina te asigna, cambia o cancela una visita, y cuando comenta o revisa un levantamiento.</p>
        </div>
      </div>
      {estado === "error" && <Aviso tono="error">No se pudieron activar. Revisa la señal e intenta de nuevo.</Aviso>}
      <div className="flex gap-2">
        <Boton className="grow" onClick={() => void activar()} cargando={estado === "activando"}>
          Activar avisos
        </Boton>
        <Boton variante="fantasma" onClick={ahoraNo} disabled={estado === "activando"}>
          Ahora no
        </Boton>
      </div>
    </section>
  );
}
