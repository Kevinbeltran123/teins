import { useLiveQuery } from "dexie-react-hooks";
import { fotosReferenciadas, type VersionFormato } from "@teins/dominio";
import { Boton, EstadoVacio, Trash, useNotificar, useSinRepetir } from "@teins/ui";
import { db, repositorio } from "../datos/instancia";
import { visitasDe } from "../datos/lecturas";
import { DIAS_EN_LA_PAPELERA } from "../datos/modelo";
import { nombreDeFormato } from "../formatos";

const dia = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" });
const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

/** "hoy 4:05 p. m." o "28 de septiembre": cuándo se descartó. */
function cuando(iso: string): string {
  const fecha = new Date(iso);
  return fecha.toDateString() === new Date().toDateString() ? `hoy ${hora.format(fecha)}` : `el ${dia.format(fecha)}`;
}

/**
 * Descartados (ADR-0035): lo que el técnico quitó de Mis visitas, solo en este teléfono, con la fecha en que se borra
 * (Journal y Apple Notes en Mobbin dicen arriba cuánto dura). "Recuperar" lo devuelve tal como estaba. Es una página
 * de "Tu cuenta" (iteración 32): se abre dentro de la misma hoja.
 */
export default function Papelera({ usuarioId, formatos }: { usuarioId: string; formatos: readonly VersionFormato[] }) {
  const descartados = useLiveQuery(() => repositorio.descartados(usuarioId), [usuarioId]);
  const visitas = useLiveQuery(async () => new Map((await visitasDe(db, usuarioId)).map((v) => [v.id, v])), [usuarioId]);
  const notificar = useNotificar();
  const [recuperar, recuperando] = useSinRepetir(async (id: string) => {
    const { suelto } = await repositorio.recuperar(id);
    notificar({ texto: suelto ? "Recuperado como levantamiento suelto: su visita ya tenía otro" : "Levantamiento recuperado: sigue donde lo dejaste" });
  });

  return (
    <>
      <p className="text-ayuda text-texto-secundario">{`Lo que descartas queda aquí ${DIAS_EN_LA_PAPELERA} días, solo en este teléfono. Después se borra con sus fotos.`}</p>
      {descartados === undefined || visitas === undefined ? (
        <div aria-busy="true" aria-label="Cargando los descartados" className="h-24 rounded-panel bg-panel-hundido motion-safe:animate-pulse" />
      ) : descartados.length === 0 ? (
        <EstadoVacio icono={Trash} titulo="Nada descartado">
          Lo que descartes aparece aquí durante {DIAS_EN_LA_PAPELERA} días.
        </EstadoVacio>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {descartados.map((l) => {
            const visita = l.visitaId ? visitas.get(l.visitaId) : undefined;
            const borra = new Date(Date.parse(l.descartadoEn!) + DIAS_EN_LA_PAPELERA * 24 * 60 * 60 * 1000);
            return (
              <li key={l.id} className="flex flex-col gap-1.5 rounded-panel border border-division bg-panel px-4 py-3">
                <strong className="text-cuerpo font-medium">{nombreDeFormato(formatos, l.formato)}</strong>
                <span className="text-ayuda text-texto-secundario">
                  {[visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : l.lugar ? `${l.lugar.cliente} · ${l.lugar.sitio}` : "Levantamiento suelto", fotos(fotosReferenciadas(l.respuestas).length), `descartado ${cuando(l.descartadoEn!)}`].join(" · ")}
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-ayuda font-bold text-alerta-texto">{`Se borra el ${dia.format(borra)}`}</span>
                  <Boton tamano="pequeno" cargando={recuperando} onClick={() => void recuperar(l.id)}>
                    Recuperar
                  </Boton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
