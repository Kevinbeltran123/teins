import { useEffect, useState } from "react";
import { Aviso, Boton, Confirmacion, Smartphone, Trash, useNotificar } from "@teins/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db, repositorio } from "../datos/instancia";
import { contarPorSellar } from "../datos/registros";
import { estadoAlmacenamiento, pocoEspacio, type EstadoAlmacenamiento } from "../dispositivo/almacenamiento";
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

/** Herramienta de soporte, no información del día: una página de "Tu cuenta" (iteración 32). */
export function Diagnostico({ tecnicoId }: { tecnicoId: string }) {
  const [estado, setEstado] = useState<EstadoAlmacenamiento>();
  // Se lee al abrir la página: los avisos pueden haberse activado desde el inicio.
  const [avisos] = useState(estadoAvisos);
  const [verificacion, setVerificacion] = useState<Verificacion | "verificando" | "error">();
  const porCifrar = useLiveQuery(() => contarPorSellar(db));
  const descartados = useLiveQuery(async () => (await repositorio.descartados(tecnicoId)).length, [tecnicoId]);
  const [vaciando, setVaciando] = useState(false);
  const notificar = useNotificar();

  // Vaciar Descartados libera espacio: se vuelve a medir.
  useEffect(() => {
    estadoAlmacenamiento().then(setEstado, () => setEstado(undefined));
  }, [verificacion, descartados]);

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
      {/* ADR-0035: lo descartado ocupa espacio 30 días; con poco espacio se vacía antes, solo si el técnico lo confirma. */}
      {estado && pocoEspacio(estado) && (
        <Aviso tono="alerta">
          {descartados ? (
            <>
              <p>Queda poco espacio en este teléfono. Lo que descartaste lo sigue ocupando.</p>
              <Boton className="mt-3 w-full" onClick={() => setVaciando(true)}>
                Vaciar Descartados
              </Boton>
            </>
          ) : (
            "Queda poco espacio en este teléfono. Libera espacio para seguir tomando fotos."
          )}
        </Aviso>
      )}
      {vaciando && (
        <Confirmacion
          nivel="irreversible"
          forma="inferior"
          titulo="¿Vaciar Descartados?"
          confirmar="Vaciar Descartados"
          accion={() => repositorio.vaciarPapeleraDe(tecnicoId)}
          mensajeDeError={() => "No se pudo vaciar. Intenta de nuevo."}
          alCerrar={() => setVaciando(false)}
          alTerminar={() => notificar({ texto: "Descartados vaciados" })}
          consecuencias={[
            { icono: Trash, texto: descartados === 1 ? "Se borra 1 levantamiento con sus fotos" : `Se borran ${descartados} levantamientos con sus fotos` },
            { icono: Smartphone, texto: "No se pueden recuperar: solo estaban en este teléfono" },
          ]}
        />
      )}
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
