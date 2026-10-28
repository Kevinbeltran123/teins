import { useNavigate } from "@tanstack/react-router";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { Aviso, Boton, FileText } from "@teins/ui";
import { useAbrirInformeDeVisita } from "../informes";
import { mensajeDeError } from "../mensajes";

const porQueNoAbrio = (e: unknown) => (e instanceof ErrorApi ? mensajeDeError(e) : e instanceof ErrorDeRed ? "Revise la conexión e intente de nuevo." : "Intente de nuevo.");

/**
 * Abre (o crea) el informe de una visita y lleva a él. Si no abre (sin conexión, la visita se canceló), se dice: en la
 * revisión, en su aviso; en una fila de la lista de visitas, la lista lo muestra arriba (`alFallar`).
 */
export function AbrirInforme({ visitaId, cliente, alFallar }: { visitaId: string; cliente?: string; alFallar?: (texto: string | null) => void }) {
  const abrir = useAbrirInformeDeVisita();
  const navegar = useNavigate();
  const enFila = alFallar !== undefined;
  const fallo = (e: unknown) => `No se pudo abrir el informe${cliente ? ` de ${cliente}` : ""}. ${porQueNoAbrio(e)}`;
  return (
    <>
      <Boton
        variante={enFila ? "fantasma" : "principal"}
        {...(enFila && { tamano: "pequeno", "aria-label": `Abrir el informe${cliente ? ` de ${cliente}` : ""}` })}
        icono={FileText}
        cargando={abrir.isPending}
        onClick={() => {
          alFallar?.(null);
          abrir.mutate(visitaId, { onSuccess: ({ id }) => void navegar({ to: "/informes/$id", params: { id } }), onError: (e) => alFallar?.(fallo(e)) });
        }}
      >
        Abrir el informe
      </Boton>
      {!enFila && abrir.isError && <Aviso tono="error">{fallo(abrir.error)}</Aviso>}
    </>
  );
}
