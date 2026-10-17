import { useEffect, useState } from "react";
import { Aviso, Boton } from "@teins/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db, repositorio } from "../datos/instancia";
import { contarPorSellar } from "../datos/registros";
import { estadoAlmacenamiento, estaInstalada, type EstadoAlmacenamiento } from "../dispositivo/almacenamiento";
import { estadoAvisos, type EstadoAvisos } from "../dispositivo/estadoAvisos";
import { plataforma } from "../dispositivo/instalacion";
import { verificarFotos, type Verificacion } from "../fotos/verificar";
import { megabytes } from "../formato";

/** Evidencia para la prueba de durabilidad del corte 0 (docs/proceso/historia/00-captura-sin-conexion.md). */
const ESTADO_AVISOS: Record<EstadoAvisos, string> = {
  activos: "Activos",
  bloqueados: "Bloqueados",
  sin_activar: "Sin activar",
  no_disponibles: "No disponibles en este navegador",
  requiere_instalar: "Solo con la app instalada",
};

/** El aviso de datos no persistentes queda a la vista en "Tu cuenta": pide hacer algo antes de capturar. */
export function AvisoDeAlmacenamiento() {
  const [estado, setEstado] = useState<EstadoAlmacenamiento>();
  useEffect(() => {
    estadoAlmacenamiento().then(setEstado, () => setEstado(undefined));
  }, []);
  // Sin instalar, el aviso de instalación de Inicio ya lo explica.
  if (!estado || estado.persistente || !estaInstalada()) return null;
  return <Aviso tono="alerta">El teléfono no garantiza conservar los datos. Avísale a soporte antes de capturar.</Aviso>;
}

/** Herramienta de soporte, no información del día: una página de "Tu cuenta" (iteración 32). */
export function Diagnostico({ tecnicoId }: { tecnicoId: string }) {
  const [estado, setEstado] = useState<EstadoAlmacenamiento>();
  // Se lee al abrir la página: los avisos pueden haberse activado desde el inicio.
  const [avisos] = useState(estadoAvisos);
  const [verificacion, setVerificacion] = useState<Verificacion | "verificando" | "error">();
  const porCifrar = useLiveQuery(() => contarPorSellar(db));

  useEffect(() => {
    estadoAlmacenamiento().then(setEstado, () => setEstado(undefined));
  }, [verificacion]);

  async function verificar() {
    setVerificacion("verificando");
    try {
      setVerificacion(await verificarFotos(repositorio, tecnicoId));
    } catch {
      setVerificacion("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
        <dt className="text-texto-secundario">Avisos</dt>
        <dd className="font-bold">{ESTADO_AVISOS[avisos]}</dd>
      </dl>
      {/* Bloqueados, la app ya no puede volver a preguntar: solo la persona los permite desde los ajustes. */}
      {avisos === "bloqueados" && (
        <p className="text-ayuda text-texto-secundario">
          {plataforma() === "iphone"
            ? "Para recibirlos: Ajustes › Notificaciones › TEINS › Permitir notificaciones."
            : "Para recibirlos, permite las notificaciones de TEINS en los ajustes del teléfono."}
        </p>
      )}
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
  );
}
