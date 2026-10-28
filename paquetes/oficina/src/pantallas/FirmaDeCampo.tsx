import { useQuery } from "@tanstack/react-query";
import { hojasDe, type DocumentoBoceto, type ValorFirma } from "@teins/dominio";
import { ErrorDeCarga, Firma } from "@teins/ui";
import { consultas } from "../api";
import { aFechaCorta } from "../formato";

/** La firma es un boceto de una sola hoja (ADR-0024). */
function FirmaDibujada({ documento, etiqueta }: { documento: DocumentoBoceto; etiqueta: string }) {
  const trazos = hojasDe(documento)[0]!;
  return <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={etiqueta} className="max-h-28" />;
}

/** Firma de quien recibe la visita (ADR-0024): la firma en papel, quién y cuándo, y la constancia que leyó. */
export function FirmaDeCampo({ valor, tecnico }: { valor: ValorFirma; tecnico: string }) {
  const trazos = useQuery(consultas.boceto(valor.firma));
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      {trazos.isPending ? (
        <div aria-busy="true" aria-label="Cargando la firma" className="esq" style={{ height: 112 }} />
      ) : trazos.isError ? (
        <ErrorDeCarga texto="No se pudo cargar la firma." reintentar={() => void trazos.refetch()} />
      ) : (
        <div className="papel" data-tema="claro">
          <FirmaDibujada documento={trazos.data} etiqueta={`Firma de ${valor.nombre}`} />
        </div>
      )}
      <span className="sec text-ayuda">
        <b style={{ color: "var(--texto)" }}>{`${valor.nombre}${valor.cargo ? ` · ${valor.cargo}` : ""}`}</b>
        <br />
        Firmó {aFechaCorta(valor.firmadoEn)}, en el teléfono de {tecnico}.
      </span>
      <span className="sec text-ayuda">
        “{valor.declaracion}”
      </span>
    </div>
  );
}
