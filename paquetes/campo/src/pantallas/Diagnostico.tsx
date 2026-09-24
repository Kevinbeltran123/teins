import { useEffect, useState } from "react";
import { Aviso, Boton } from "@teins/ui";
import { repositorio } from "../datos/instancia";
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

  return (
    <section aria-labelledby="titulo-diagnostico" className="flex flex-col gap-3 rounded-panel bg-panel p-4">
      <h2 id="titulo-diagnostico" className="text-subtitulo font-extrabold">
        Diagnóstico del almacenamiento
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-cuerpo">
        <dt className="text-texto-secundario">Persistente</dt>
        <dd className="font-bold">{estado === undefined ? "…" : estado.persistente ? "Sí" : "No"}</dd>
        <dt className="text-texto-secundario">Espacio usado</dt>
        <dd className="font-bold">
          {estado?.usoBytes === undefined
            ? "No disponible"
            : `${megabytes(estado.usoBytes)}${estado.cuotaBytes ? ` de ${megabytes(estado.cuotaBytes)}` : ""}`}
        </dd>
      </dl>
      {/* Sin instalar, el aviso de instalación de Inicio ya lo explica. */}
      {estado && !estado.persistente && estaInstalada() && (
        <Aviso tono="alerta">El teléfono no garantiza conservar los datos. Avísale a soporte antes de capturar.</Aviso>
      )}
      <Boton onClick={verificar} disabled={verificacion === "verificando"}>
        {verificacion === "verificando" ? "Verificando…" : "Verificar fotos"}
      </Boton>
      {verificacion === "error" && <Aviso tono="error">No se pudieron leer las fotos guardadas. Intenta de nuevo.</Aviso>}
      {typeof verificacion === "object" && (
        <Aviso tono={verificacion.integras === verificacion.guardadas && verificacion.faltantes === 0 ? "info" : "error"}>
          Fotos guardadas: {verificacion.guardadas}. Íntegras: {verificacion.integras}. Perdidas: {verificacion.faltantes}.
        </Aviso>
      )}
    </section>
  );
}
