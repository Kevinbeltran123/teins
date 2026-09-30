import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esLlaveCancelada } from "@teins/protocolo";
import { Aviso, Bell, Boton, BotonIcono, Confirmacion, EncabezadoPagina, Insignia, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, Trash, useNotificar } from "@teins/ui";
import { cliente, consultas } from "../api";
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
      <EncabezadoPagina titulo="Mi cuenta" descripcion={<span>{nombre}</span>} />
      <div className="doc estrecho">
      <section aria-labelledby="titulo-llaves">
        <div className="cab-sec">
            <h2 id="titulo-llaves">Llaves de acceso</h2>
          <Boton tamano="pequeno" icono={Plus} cargando={crear.isPending} onClick={() => crear.mutate(undefined, { onSuccess: () => notificar({ texto: 'Llave creada. La próxima vez use "Entrar con llave de acceso".' }) })}>
            Crear llave de acceso
          </Boton>
        </div>
        <p className="ayuda">Con una llave de acceso entra sin escribir la contraseña: con la huella, el rostro o el PIN de este computador, o con su celular. Nadie puede usarla desde otro sitio web.</p>
        {crear.isError && !esLlaveCancelada(crear.error) && <Aviso tono="error">No se pudo crear la llave de acceso. Intente de nuevo.</Aviso>}
        {llaves.isPending ? (
          <div aria-busy="true" aria-label="Cargando sus llaves de acceso" className="esq" style={{ height: 56 }} />
        ) : llaves.isError ? (
          <Aviso tono="error">
            <b>No se pudieron cargar sus llaves de acceso.</b>
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void llaves.refetch()}>
                Reintentar
              </Boton>
            </div>
          </Aviso>
        ) : cuantas === 0 ? (
          <p className="sec">Todavía no tiene llaves de acceso.</p>
        ) : (
          <ul aria-label="Sus llaves de acceso" className="filas" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {llaves.data.map((l, i) => {
              const nombreLlave = l.nombre ?? `Llave de acceso ${i + 1}`;
              return (
                <li key={l.id} className="fila">
                  <KeyRound aria-hidden size={18} />
                  <div className="txt">
                    <b>{nombreLlave}</b>
                    <small>
                      {`Creada el ${aFechaHora(l.creadaEn)}`}
                      {l.sincronizada && " · Se sincroniza entre sus dispositivos"}
                    </small>
                  </div>
                  <BotonIcono tamano="pequeno" icono={Trash} etiqueta={`Quitar la llave ${i + 1}`} onClick={() => setQuitando({ id: l.id, nombre: nombreLlave })} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AvisosDelNavegador />
      <SesionActual />
      </div>

      {quitando && (
        <Confirmacion
          titulo={`¿Quitar ${quitando.nombre}?`}
          confirmar="Quitar llave"
          nivel="irreversible"
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
    <section aria-labelledby="titulo-avisos">
      <div className="cab-sec">
        <h2 id="titulo-avisos">Avisos en este navegador</h2>
        {estado === "activos" && <Insignia tono="exito">Activos</Insignia>}
      </div>
      <div className="filas">
        <div className="fila">
          <Bell aria-hidden size={18} />
          <div className="txt">
            <b>Levantamientos enviados</b>
            <small>Le avisamos cuando un técnico envía un levantamiento, aunque la pestaña de TEINS esté cerrada.</small>
          </div>
        {estado === "activos" ? (
          <Boton variante="fantasma" tamano="pequeno" cargando={trabajando} onClick={() => void cambiar(false)}>
            Desactivar
          </Boton>
        ) : estado === "sin_activar" ? (
          <Boton variante="principal" tamano="pequeno" cargando={trabajando} onClick={() => void cambiar(true)}>
            Activar avisos
          </Boton>
        ) : null}
        </div>
      </div>
      {/* Bloqueados, la página ya no puede volver a preguntar: solo la persona los permite. */}
      {estado === "bloqueados" && <Aviso tono="alerta">Los bloqueó en este navegador. Para recibirlos, permita las notificaciones de este sitio desde el candado junto a la dirección.</Aviso>}
      {error && <Aviso tono="error">No se pudieron cambiar los avisos. Intente de nuevo.</Aviso>}
    </section>
  );
}

/** La sesión en este navegador: el segundo factor y cerrar sesión (prototipos/oficina, "Sesión"). */
function SesionActual() {
  const consultasCliente = useQueryClient();
  const sesion = useQuery(consultas.sesion());
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    // Con la sesión todavía abierta: este navegador deja de recibir los avisos de la persona.
    await desactivarAvisos().catch(() => undefined);
    await cliente.cerrarSesion().catch(() => undefined);
    await consultasCliente.resetQueries();
  }

  return (
    <section aria-labelledby="titulo-sesion">
      <h2 id="titulo-sesion">Sesión</h2>
      <div className="filas">
        <div className="fila">
          <ShieldCheck aria-hidden size={18} />
          <div className="txt">
            <b>Segundo factor</b>
            <small>{sesion.data?.usuario.segundoFactor ? "Activo: el ingreso le pide el código de su app autenticadora" : "Sin activar"}</small>
          </div>
        </div>
        <div className="fila">
          <LogOut aria-hidden size={18} />
          <div className="txt">
            <b>Cerrar sesión</b>
            <small>En este navegador</small>
          </div>
          <Boton tamano="pequeno" cargando={saliendo} onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Boton>
        </div>
      </div>
    </section>
  );
}
