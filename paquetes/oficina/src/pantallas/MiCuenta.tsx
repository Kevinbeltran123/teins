import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Boton } from "@teins/ui";
import { cliente } from "../api";
import { aFechaHora } from "../formato";
import { mensajeDeError } from "../mensajes";

const consultaDeLlaves = { queryKey: ["llaves"], queryFn: () => cliente.llaves() };

/**
 * Mi cuenta (iteración 13): las llaves de acceso de la persona. Con una, entra con Face ID, huella, Windows
 * Hello o el celular en lugar de la contraseña (ADR-0009). Quien la pierde la quita aquí; si perdió el
 * dispositivo con la sesión cerrada, quien administra restablece su acceso y eso quita todas.
 */
export function MiCuenta({ nombre }: { nombre: string }) {
  const consultas = useQueryClient();
  const llaves = useQuery(consultaDeLlaves);
  const [quitando, setQuitando] = useState<string | null>(null);
  const refrescar = () => consultas.invalidateQueries({ queryKey: consultaDeLlaves.queryKey });
  const crear = useMutation({ mutationFn: () => cliente.crearLlave(), onSettled: refrescar });
  const quitar = useMutation({ mutationFn: (id: string) => cliente.quitarLlave(id), onSuccess: () => setQuitando(null), onSettled: refrescar });

  return (
    <section aria-labelledby="titulo-cuenta" className="flex flex-col gap-5 rounded-panel bg-panel p-6">
      <div>
        <h1 id="titulo-cuenta" className="text-subtitulo font-extrabold">
          Mi cuenta
        </h1>
        <p className="text-cuerpo text-texto-secundario">{nombre}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-cuerpo font-extrabold">Llaves de acceso</h2>
        <p className="max-w-2xl text-cuerpo">
          Con una llave de acceso entra sin escribir la contraseña: con la huella, el rostro o el PIN de este computador, o con su celular. Nadie puede usarla desde otro sitio web.
        </p>
        {llaves.isPending ? (
          <div aria-busy="true" aria-label="Cargando sus llaves de acceso" className="h-[80px] animate-pulse rounded-panel bg-fondo" />
        ) : llaves.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar sus llaves de acceso.</p>
            <Boton className="mt-3" onClick={() => void llaves.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : llaves.data.length === 0 ? (
          <p className="text-cuerpo text-texto-secundario">Todavía no tiene llaves de acceso.</p>
        ) : (
          <ul aria-label="Sus llaves de acceso" className="flex flex-col divide-y divide-division">
            {llaves.data.map((l, i) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-cuerpo font-bold">{l.nombre ?? `Llave de acceso ${i + 1}`}</p>
                  <p className="text-ayuda text-texto-secundario">
                    {`Creada el ${aFechaHora(l.creadaEn)}`}
                    {l.sincronizada && " · Se sincroniza entre sus dispositivos"}
                  </p>
                </div>
                {quitando === l.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ayuda">¿Quitarla? Ya no servirá para entrar.</span>
                    <Boton disabled={quitar.isPending} onClick={() => quitar.mutate(l.id)}>
                      {quitar.isPending ? "Quitando…" : "Sí, quitarla"}
                    </Boton>
                    <Boton onClick={() => setQuitando(null)}>Cancelar</Boton>
                  </div>
                ) : (
                  <Boton onClick={() => setQuitando(l.id)}>{`Quitar la llave ${i + 1}`}</Boton>
                )}
              </li>
            ))}
          </ul>
        )}
        {quitar.isError && <Aviso tono="error">{mensajeDeError(quitar.error)}</Aviso>}
        {crear.isError && !esLlaveCancelada(crear.error) && <Aviso tono="error">No se pudo crear la llave de acceso. Intente de nuevo.</Aviso>}
        {crear.isSuccess && <Aviso tono="info">Llave creada. La próxima vez use "Entrar con llave de acceso".</Aviso>}
        <div>
          <Boton variante="principal" disabled={crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear llave de acceso"}
          </Boton>
        </div>
      </div>
    </section>
  );
}
