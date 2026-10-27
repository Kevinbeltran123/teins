import { useQuery } from "@tanstack/react-query";
import { hojasDe } from "@teins/dominio";
import { ErrorDeCarga, HojasDeBoceto } from "@teins/ui";
import { consultas } from "../api";

/** Boceto (ADR-0019): el servidor entrega el documento ya verificado y se dibuja en papel claro, hoja por hoja (ADR-0026). */
export function BocetoDeCampo({ etiqueta, huella }: { etiqueta: string; huella: string }) {
  const boceto = useQuery(consultas.boceto(huella));
  if (boceto.isPending) return <div aria-busy="true" aria-label="Cargando el boceto" className="esq" style={{ height: 200, marginTop: 10 }} />;
  if (boceto.isError) return <ErrorDeCarga texto="No se pudo cargar el boceto." reintentar={() => void boceto.refetch()} />;
  return (
    <div className="hojas-papel">
      <HojasDeBoceto hojas={hojasDe(boceto.data)} cuadricula={boceto.data.cuadricula} etiqueta={`Boceto de ${etiqueta.toLowerCase()}`} />
    </div>
  );
}
