import { useQuery } from "@tanstack/react-query";
import { CampoSeleccion, CampoTexto } from "@teins/ui";
import { consultasDeProgramacion } from "../programacion";

/** Lo que dice el selector cuando no hay solicitante elegido: por qué no hay a quién elegir, o que es opcional. */
export function textoSinSolicitante(e: { hayCliente: boolean; cargando: boolean; error: boolean; contactos: number }): string {
  if (!e.hayCliente) return "Primero el cliente";
  if (e.error) return "No se pudieron cargar los contactos";
  if (e.contactos === 0 && !e.cargando) return "El cliente no tiene contactos";
  return "Sin solicitante";
}

/**
 * Quien pidió la visita y la referencia del cliente (ADR-0051). Los dos son opcionales: el técnico pregunta por el
 * solicitante al llegar y el informe lleva los dos en su encabezado; lo que falta sale como marcador. El solicitante es un
 * contacto del mismo cliente.
 */
export function DatosDelPedido({
  clienteId,
  solicitanteId,
  referencia,
  alCambiar,
}: {
  clienteId: string;
  solicitanteId: string;
  referencia: string;
  alCambiar: (cambio: { solicitanteId?: string; referencia?: string }) => void;
}) {
  const detalle = useQuery({ ...consultasDeProgramacion.cliente(clienteId), enabled: clienteId !== "" });
  const contactos = detalle.data?.contactos ?? [];
  return (
    <div className="fila-campos">
      <CampoSeleccion
        etiqueta="Solicitante"
        vacio={textoSinSolicitante({ hayCliente: clienteId !== "", cargando: detalle.isPending, error: detalle.isError, contactos: contactos.length })}
        valor={solicitanteId}
        onCambio={(id) => alCambiar({ solicitanteId: id })}
        deshabilitado={clienteId === "" || (contactos.length === 0 && solicitanteId === "")}
        opciones={contactos.map((c) => ({ valor: c.id, texto: c.cargo ? `${c.nombre} · ${c.cargo}` : c.nombre }))}
      />
      <CampoTexto etiqueta="Referencia del cliente" ejemplo="Opcional: el número de su ticket" valorInicial={referencia} onCambio={(t) => alCambiar({ referencia: t })} />
    </div>
  );
}
