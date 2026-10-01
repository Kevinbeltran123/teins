import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esLlaveCancelada } from "@teins/protocolo";
import {
  Aviso,
  Bell,
  Boton,
  BotonIcono,
  CampoTexto,
  Confirmacion,
  Consecuencias,
  Dialogo,
  EncabezadoPagina,
  enfocarPrimerError,
  GrupoDeOpciones,
  Insignia,
  KeyRound,
  LockKeyhole,
  LogOut,
  OPCIONES_DE_TEMA,
  Plus,
  RefreshCw,
  RequisitosDeContrasena,
  ShieldCheck,
  ShieldOff,
  Trash,
  useNotificar,
  useTema,
  validarContrasenaNueva,
  type ErroresDeContrasena,
} from "@teins/ui";
import { cliente, consultas } from "../api";
import { activarAvisos, desactivarAvisos, estadoAvisos, type EstadoAvisos } from "../avisos";
import { errorDeCuenta } from "../cuenta";
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
      <Acceso nombre={nombre} />
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

      <SelectorDeTema />
      <AvisosDelNavegador />
      <SesionActual />
      </div>

      {quitando && (
        <Confirmacion
          titulo={`¿Quitar ${quitando.nombre}?`}
          confirmar="Quitar llave"
          nivel="consecuencia"
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

/** La sesión en este navegador: cerrar sesión (prototipos/oficina, "Sesión"). */
function SesionActual() {
  const consultasCliente = useQueryClient();
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

/** Claro, oscuro o el del sistema, recordado en este equipo (DESIGN.md, "Tema"). */
function SelectorDeTema() {
  const [tema, setTema] = useTema();
  return (
    <section>
      <GrupoDeOpciones etiqueta="Tema" opciones={OPCIONES_DE_TEMA} valor={tema} onCambio={setTema} />
      <p className="ayuda">Se recuerda en este equipo.</p>
    </section>
  );
}

/**
 * Cómo entra la persona (ADR-0033, prototipos/cuenta): cambiar su contraseña y, si no administra, quitar su segundo
 * factor. Quien administra lo necesita siempre (ADR-0009): se dice, sin botón.
 */
function Acceso({ nombre }: { nombre: string }) {
  const notificar = useNotificar();
  const consultasCliente = useQueryClient();
  const sesion = useQuery(consultas.sesion());
  const [abierta, setAbierta] = useState<"contrasena" | "factor" | null>(null);
  const [cambiada, setCambiada] = useState(false);
  const usuario = sesion.data?.usuario;

  return (
    <section aria-labelledby="titulo-acceso">
      <h2 id="titulo-acceso">Acceso</h2>
      <div className="filas">
        <div className="fila">
          <LockKeyhole aria-hidden size={18} />
          <div className="txt">
            <b>Contraseña</b>
            <small>{cambiada ? "Cambiada hace un momento" : "Si la olvida, administración la restablece"}</small>
          </div>
          <Boton tamano="pequeno" onClick={() => setAbierta("contrasena")}>
            Cambiar contraseña
          </Boton>
        </div>
        <div className="fila">
          <ShieldCheck aria-hidden size={18} />
          <div className="txt">
            <b>Segundo factor</b>
            <small>
              {!usuario?.segundoFactor
                ? "Sin activar"
                : usuario.administrador
                  ? "Activo · obligatorio para administrar, no se puede quitar"
                  : "Activo: el ingreso le pide el código de su app autenticadora"}
            </small>
          </div>
          {usuario?.segundoFactor && !usuario.administrador && (
            <Boton tamano="pequeno" onClick={() => setAbierta("factor")}>
              Quitar segundo factor
            </Boton>
          )}
        </div>
      </div>

      {abierta === "contrasena" && (
        <CambiarContrasena
          nombre={nombre}
          alCerrar={() => setAbierta(null)}
          alCambiar={() => {
            setAbierta(null);
            setCambiada(true);
            notificar({ texto: "Contraseña cambiada · se cerraron las demás sesiones" });
          }}
        />
      )}
      {abierta === "factor" && (
        <QuitarSegundoFactor
          alCerrar={() => setAbierta(null)}
          alQuitar={() => {
            setAbierta(null);
            notificar({ texto: "Segundo factor quitado" });
            void consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
          }}
        />
      )}
    </section>
  );
}

/** Con la actual, en una hoja lateral: una sesión abierta en un computador ajeno no basta para cambiarla. */
function CambiarContrasena({ nombre, alCerrar, alCambiar }: { nombre: string; alCerrar: () => void; alCambiar: () => void }) {
  const formulario = useId();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<ErroresDeContrasena>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarContrasenaNueva({ actual, nueva, repetir, pideActual: true, tu: false });
    setErrores(encontrados);
    setGeneral(null);
    if (Object.keys(encontrados).length > 0) return enfocarPrimerError(formulario);
    setOcupado(true);
    try {
      await cliente.llamar("cambiarContrasena", { cuerpo: { actual, nueva } });
      alCambiar();
    } catch (error) {
      setOcupado(false);
      const { campo, general } = errorDeCuenta(error);
      if (campo) {
        setErrores({ [campo.ruta === "actual" ? "actual" : "nueva"]: campo.mensaje });
        enfocarPrimerError(formulario);
      } else setGeneral(general ?? null);
    }
  }

  return (
    <Dialogo
      forma="lateral"
      titulo="Cambiar contraseña"
      subtitulo={nombre}
      cerrable={!ocupado}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={ocupado}>
            Cambiar contraseña
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={guardar} noValidate className="flex flex-col gap-5">
        <CampoTexto etiqueta="Contraseña actual" nombre="actual" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setActual} error={errores.actual} />
        <CampoTexto etiqueta="Contraseña nueva" nombre="nueva" tipo="password" autoComplete="new-password" valorInicial="" onCambio={setNueva} error={errores.nueva} />
        <CampoTexto etiqueta="Repita la contraseña nueva" nombre="repetir" tipo="password" autoComplete="new-password" valorInicial="" onCambio={setRepetir} error={errores.repetir} />
        <RequisitosDeContrasena actual={actual} nueva={nueva} repetir={repetir} />
        <Consecuencias
          lista={[
            { icono: LogOut, texto: "Se cierran sus sesiones en los demás equipos. Esta sigue abierta." },
            { icono: KeyRound, texto: "Su segundo factor y sus llaves de acceso no cambian." },
          ]}
        />
        {general && <Aviso tono="error">{general}</Aviso>}
      </form>
    </Dialogo>
  );
}

/** Baja la protección de la cuenta: pide la contraseña y un código vigente, y dice qué cambia. */
function QuitarSegundoFactor({ alCerrar, alQuitar }: { alCerrar: () => void; alQuitar: () => void }) {
  const formulario = useId();
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errores, setErrores] = useState<{ contrasena?: string; codigo?: string }>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function quitar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = codigo.replace(/\s/g, "");
    const encontrados = {
      ...(contrasena === "" ? { contrasena: "Escriba su contraseña." } : {}),
      ...(!/^\d{6}$/.test(limpio) ? { codigo: "Escriba los 6 dígitos que muestra su app." } : {}),
    };
    setErrores(encontrados);
    setGeneral(null);
    if (Object.keys(encontrados).length > 0) return enfocarPrimerError(formulario);
    setOcupado(true);
    try {
      await cliente.llamar("quitarSegundoFactor", { cuerpo: { contrasena, codigo: limpio } });
      alQuitar();
    } catch (error) {
      setOcupado(false);
      const { campo, general } = errorDeCuenta(error);
      if (campo) {
        setErrores({ [campo.ruta === "codigo" ? "codigo" : "contrasena"]: campo.mensaje });
        enfocarPrimerError(formulario);
      } else setGeneral(general ?? null);
    }
  }

  return (
    <Dialogo
      titulo="¿Quitar el segundo factor de su cuenta?"
      icono={ShieldOff}
      cerrable={!ocupado}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={ocupado}>
            Quitar segundo factor
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={quitar} noValidate className="flex flex-col gap-5">
        <Consecuencias
          lista={[
            { icono: ShieldCheck, texto: "El ingreso ya no le pedirá el código", detalle: "Con su contraseña basta para entrar" },
            { icono: KeyRound, texto: "Sus códigos de respaldo dejan de servir" },
            { icono: LogOut, texto: "Se cierran sus sesiones en los demás equipos" },
          ]}
        />
        <CampoTexto etiqueta="Su contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} error={errores.contrasena} />
        <CampoTexto etiqueta="Código de su app autenticadora" nombre="codigo" autoComplete="one-time-code" modoEntrada="numeric" valorInicial="" onCambio={setCodigo} error={errores.codigo} />
        {general && <Aviso tono="error">{general}</Aviso>}
      </form>
    </Dialogo>
  );
}
