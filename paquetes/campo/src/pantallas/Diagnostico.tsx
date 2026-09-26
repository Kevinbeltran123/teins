import { useEffect, useState } from "react";
import { Aviso, Boton, ChevronRight } from "@teins/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db, repositorio } from "../datos/instancia";
import { contarPorSellar } from "../datos/registros";
import { estadoAlmacenamiento, estaInstalada, type EstadoAlmacenamiento } from "../dispositivo/almacenamiento";
import { huella } from "../fotos/procesar";
import { megabytes } from "../formato";

interface Verificacion {
  guardadas: number;
  integras: number;
  /** Fotos que un levantamiento menciona pero que no están en la base: pérdida real. */
  faltantes: number;
}

async function verificarFotos(): Promise<Verificacion> {
  const referenciadas = new Set(
    (await repositorio.todos()).flatMap((l) =>
      Object.values(l.respuestas).flatMap((s) => Object.values(s).flatMap((v) => (Array.isArray(v) ? v : []))),
    ),
  );
  const archivos = await repositorio.todosLosArchivos();
  let integras = 0;
  for (const a of archivos) if ((await huella(a.datos)) === a.id) integras++;
  const guardados = new Set(archivos.map((a) => a.id));
  const faltantes = [...referenciadas].filter((id) => !guardados.has(id)).length;
  return { guardadas: archivos.length, integras, faltantes };
}

/** Evidencia para la prueba de durabilidad del corte 0 (docs/proceso/plan-de-entrega.md). */
export function Diagnostico() {
  const [estado, setEstado] = useState<EstadoAlmacenamiento>();
  const [verificacion, setVerificacion] = useState<Verificacion | "verificando" | "error">();
  const porCifrar = useLiveQuery(() => contarPorSellar(db));

  useEffect(() => {
    estadoAlmacenamiento().then(setEstado, () => setEstado(undefined));
  }, [verificacion]);

  async function verificar() {
    setVerificacion("verificando");
    try {
      setVerificacion(await verificarFotos());
    } catch {
      setVerificacion("error");
    }
  }

  // Herramienta de soporte, no información del día: plegada al final de la pantalla. El aviso de datos no
  // persistentes sí queda a la vista: pide hacer algo antes de capturar.
  return (
    <>
      {/* Sin instalar, el aviso de instalación de Inicio ya lo explica. */}
      {estado && !estado.persistente && estaInstalada() && <Aviso tono="alerta">El teléfono no garantiza conservar los datos. Avísale a soporte antes de capturar.</Aviso>}
      <details className="group rounded-panel border border-division bg-panel">
        <summary className="flex min-h-tactil cursor-pointer items-center justify-between gap-3 rounded-panel px-4 text-cuerpo font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie [&::-webkit-details-marker]:hidden">
          Diagnóstico del almacenamiento
          <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-secundario transition-transform group-open:rotate-90" />
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-cuerpo">
            <dt className="text-texto-secundario">Persistente</dt>
            <dd className="font-bold">{estado === undefined ? "…" : estado.persistente ? "Sí" : "No"}</dd>
            {/* ADR-0022: lo de antes de la iteración 12 se cifra en segundo plano; lo nuevo nace cifrado. */}
            <dt className="text-texto-secundario">Datos cifrados</dt>
            <dd className="font-bold">{porCifrar === undefined ? "…" : porCifrar === 0 ? "Todos" : `Faltan ${porCifrar}`}</dd>
            <dt className="text-texto-secundario">Espacio usado</dt>
            <dd className="font-bold">
              {estado?.usoBytes === undefined
                ? "No disponible"
                : `${megabytes(estado.usoBytes)}${estado.cuotaBytes ? ` de ${megabytes(estado.cuotaBytes)}` : ""}`}
            </dd>
          </dl>
          <Boton onClick={() => void verificar()} cargando={verificacion === "verificando"}>
            Verificar fotos
          </Boton>
          {verificacion === "error" && <Aviso tono="error">No se pudieron leer las fotos guardadas. Intenta de nuevo.</Aviso>}
          {typeof verificacion === "object" && (
            <Aviso tono={verificacion.integras === verificacion.guardadas && verificacion.faltantes === 0 ? "exito" : "error"}>
              Fotos guardadas: {verificacion.guardadas}. Íntegras: {verificacion.integras}. Perdidas: {verificacion.faltantes}.
            </Aviso>
          )}
        </div>
      </details>
    </>
  );
}
