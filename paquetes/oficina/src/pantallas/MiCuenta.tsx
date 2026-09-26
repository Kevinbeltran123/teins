import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Bell, Boton, BotonIcono, Confirmacion, EncabezadoPagina, Insignia, KeyRound, Plus, RefreshCw, Trash, useNotificar } from "@teins/ui";
import { cliente } from "../api";
import { activarAvisos, desactivarAvisos, estadoAvisos, type EstadoAvisos } from "../avisos";
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
  const notificar = useNotificar();
  const llaves = useQuery(consultaDeLlaves);
  const [quitando, setQuitando] = useState<{ id: string; nombre: string } | null>(null);
  const refrescar = () => consultas.invalidateQueries({ queryKey: consultaDeLlaves.queryKey });
  const crear = useMutation({ mutationFn: () => cliente.crearLlave(), onSettled: refrescar });
  const quitar = useMutation({ mutationFn: (id: string) => cliente.quitarLlave(id), onSettled: refrescar });
  const cuantas = llaves.data?.length ?? 0;

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion={nombre} />
      <section aria-labelledby="titulo-llaves" className="flex max-w-3xl flex-col gap-4 rounded-panel border border-division bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-xl flex-col gap-1">
            <h2 id="titulo-llaves" className="text-subtitulo font-extrabold">
              Llaves de acceso
            </h2>
            <p className="text-cuerpo text-texto-secundario">
              Con una llave de acceso entra sin escribir la contraseña: con la huella, el rostro o el PIN de este computador, o con su celular. Nadie puede usarla desde otro sitio web.
            </p>
          </div>
          <Boton variante="principal" icono={Plus} cargando={crear.isPending} onClick={() => crear.mutate(undefined, { onSuccess: () => notificar({ texto: 'Llave creada. La próxima vez use "Entrar con llave de acceso".' }) })}>
            Crear llave de acceso
          </Boton>
        </div>
        {crear.isError && !esLlaveCancelada(crear.error) && <Aviso tono="error">No se pudo crear la llave de acceso. Intente de nuevo.</Aviso>}
        {llaves.isPending ? (
          <div aria-busy="true" aria-label="Cargando sus llaves de acceso" className="h-20 rounded-panel bg-fondo motion-safe:animate-pulse" />
        ) : llaves.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar sus llaves de acceso.</p>
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void llaves.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : cuantas === 0 ? (
          <p className="text-cuerpo text-texto-secundario">Todavía no tiene llaves de acceso.</p>
        ) : (
          <ul aria-label="Sus llaves de acceso" className="flex flex-col divide-y divide-division rounded-panel border border-division">
            {llaves.data.map((l, i) => {
              const nombreLlave = l.nombre ?? `Llave de acceso ${i + 1}`;
              return (
                <li key={l.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie [&_svg]:size-5">
                    <KeyRound aria-hidden />
                  </span>
                  <div className="min-w-0 grow">
                    <p className="text-cuerpo font-bold">{nombreLlave}</p>
                    <p className="text-ayuda text-texto-secundario">
                      {`Creada el ${aFechaHora(l.creadaEn)}`}
                      {l.sincronizada && " · Se sincroniza entre sus dispositivos"}
                    </p>
                  </div>
                  <BotonIcono icono={Trash} etiqueta={`Quitar la llave ${i + 1}`} onClick={() => setQuitando({ id: l.id, nombre: nombreLlave })} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AvisosDelNavegador />

      {quitando && (
        <Confirmacion
          titulo={`¿Quitar ${quitando.nombre}?`}
          confirmar="Quitar llave"
          peligro
          mensajeDeError={mensajeDeError}
          alCerrar={() => setQuitando(null)}
          alTerminar={() => notificar({ texto: "Llave de acceso quitada" })}
          accion={() => quitar.mutateAsync(quitando.id)}
        >
          <p>Ya no servirá para entrar.{cuantas === 1 && " Es la única que tiene: después entrará con su usuario y contraseña."}</p>
        </Confirmacion>
      )}
    </>
  );
}

/**
 * Avisos push en este navegador (ADR-0023): quien revisa sabe de un levantamiento nuevo con la pestaña
 * cerrada. No aparece si el entorno los tiene apagados o si el navegador no los admite.
 */
function AvisosDelNavegador() {
  const notificar = useNotificar();
  const configuracion = useQuery({ queryKey: ["avisos", "configuracion"], queryFn: () => cliente.llamar("configuracionAvisos"), staleTime: Infinity });
  const [estado, setEstado] = useState<EstadoAvisos>();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => void estadoAvisos().then(setEstado), []);

  const clave = configuracion.data?.clavePublica;
  if (!clave || !estado || estado === "no_disponibles") return null;

  // El permiso se pide directo en el clic: algunos navegadores solo preguntan si viene de un gesto.
  async function cambiar(activar: boolean) {
    setTrabajando(true);
    setError(false);
    try {
      const nuevo = activar ? await activarAvisos(clave!) : (await desactivarAvisos(), "sin_activar" as const);
      setEstado(nuevo);
      if (nuevo === "activos") notificar({ texto: "Avisos activados en este navegador" });
      else if (!activar) notificar({ texto: "Avisos desactivados en este navegador" });
    } catch {
      setError(true);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-avisos" className="flex max-w-3xl flex-col gap-4 rounded-panel border border-division bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 id="titulo-avisos" className="flex items-center gap-2.5 text-subtitulo font-extrabold">
            Avisos en este navegador
            {estado === "activos" && <Insignia tono="exito">Activos</Insignia>}
          </h2>
          <p className="text-cuerpo text-texto-secundario">Le avisamos cuando un técnico envía un levantamiento, aunque la pestaña de TEINS esté cerrada.</p>
        </div>
        {estado === "activos" ? (
          <Boton variante="fantasma" cargando={trabajando} onClick={() => void cambiar(false)}>
            Desactivar
          </Boton>
        ) : estado === "sin_activar" ? (
          <Boton icono={Bell} cargando={trabajando} onClick={() => void cambiar(true)}>
            Activar avisos
          </Boton>
        ) : null}
      </div>
      {/* Bloqueados, la página ya no puede volver a preguntar: solo la persona los permite. */}
      {estado === "bloqueados" && <Aviso tono="alerta">Los bloqueó en este navegador. Para recibirlos, permita las notificaciones de este sitio desde el candado junto a la dirección.</Aviso>}
      {error && <Aviso tono="error">No se pudieron cambiar los avisos. Intente de nuevo.</Aviso>}
    </section>
  );
}
