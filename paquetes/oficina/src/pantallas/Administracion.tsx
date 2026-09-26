import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto, claseBoton, GrupoDeOpciones, Marquilla, Pestanas } from "@teins/ui";
import { cliente, consultas } from "../api";
import { consultasDeAdministracion, mensajeDeAdministracion, qrComoImagen, useAccion } from "../administracion";
import { aFechaHora, haceCuanto } from "../formato";

type Sesion = Respuesta<"obtenerSesion">;
type Usuario = Respuesta<"listarUsuarios">["usuarios"][number];
type Seccion = "usuarios" | "dispositivos" | "accesos";

/** Un pendiente que lleva más de un día sin subir merece una llamada al técnico (ADR-0017). */
const DIA_MS = 24 * 60 * 60 * 1000;

export function Administracion({ sesion }: { sesion: Sesion }) {
  const [seccion, setSeccion] = useState<Seccion>("usuarios");
  if (!sesion.usuario.administrador) {
    return <Aviso tono="alerta">Esta sección es para las personas que administran. Pídale acceso a quien administra en TEINS.</Aviso>;
  }
  if (!sesion.usuario.segundoFactor) return <ActivarSegundoFactor />;
  return (
    <section aria-labelledby="titulo-administracion" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
      <h1 id="titulo-administracion" className="text-subtitulo font-extrabold">
        Administración
      </h1>
      <Pestanas
        etiqueta="Qué administrar"
        activa={seccion}
        onCambio={setSeccion}
        pestanas={[
          { valor: "usuarios", etiqueta: "Usuarios" },
          { valor: "dispositivos", etiqueta: "Teléfonos de campo" },
          { valor: "accesos", etiqueta: "Accesos de clientes" },
        ]}
      />
      <div role="tabpanel">
        {seccion === "usuarios" && <Usuarios propioId={sesion.usuario.id} />}
        {seccion === "dispositivos" && <Dispositivos />}
        {seccion === "accesos" && <Accesos />}
      </div>
    </section>
  );
}

// Segundo factor ----------------------------------------------------------------------------------

function ActivarSegundoFactor() {
  const consultasCliente = useQueryClient();
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enrolamiento, setEnrolamiento] = useState<{ uri: string; codigosDeRespaldo: string[]; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function empezar(evento: FormEvent) {
    evento.preventDefault();
    if (contrasena === "") return setError("Escriba su contraseña.");
    setOcupado(true);
    setError(null);
    try {
      const r = await cliente.activarSegundoFactor(contrasena);
      setEnrolamiento({ ...r, qr: await qrComoImagen(r.uri) });
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "entrada_invalida" ? "La contraseña no es correcta." : mensajeDeAdministracion(e));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{6}$/.test(codigo.replace(/\s/g, ""))) return setError("Escriba los 6 dígitos que muestra la app.");
    setOcupado(true);
    setError(null);
    try {
      await cliente.verificarSegundoFactor(codigo);
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "no_autenticado" ? "El código no es correcto. Revise que la hora del celular esté al día." : mensajeDeAdministracion(e));
      setOcupado(false);
    }
  }

  const secreto = enrolamiento ? new URL(enrolamiento.uri).searchParams.get("secret") : null;
  return (
    <section aria-labelledby="titulo-segundo-factor" className="flex max-w-2xl flex-col gap-4 rounded-panel bg-panel p-6">
      <h1 id="titulo-segundo-factor" className="text-subtitulo font-extrabold">
        Active el segundo factor para administrar
      </h1>
      <p className="text-cuerpo">
        Administrar usuarios y accesos de clientes exige, además de la contraseña, un código de una app autenticadora en su celular (Google Authenticator, Microsoft Authenticator u otra). Desde que lo
        active, el ingreso a oficina le pedirá ese código.
      </p>
      {!enrolamiento ? (
        <form onSubmit={empezar} noValidate className="flex max-w-md flex-col gap-4">
          <CampoTexto etiqueta="Su contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" variante="principal" disabled={ocupado}>
            {ocupado ? "Preparando…" : "Empezar la activación"}
          </Boton>
        </form>
      ) : (
        <ol className="flex list-decimal flex-col gap-4 pl-6 text-cuerpo">
            <li>
              <p>Escanee este código con la app autenticadora.</p>
              <img src={enrolamiento.qr} alt="Código QR para la app autenticadora" className="mt-2 size-48 rounded-control border border-division bg-panel" />
              {secreto && (
                <p className="mt-2 text-ayuda text-texto-secundario">
                  Si no puede escanearlo, escriba esta clave en la app: <code className="font-bold break-all text-texto">{secreto}</code>
                </p>
              )}
            </li>
            <li>
              <p>Guarde estos códigos de respaldo en un lugar seguro. Cada uno sirve una vez si pierde el celular, y no se vuelven a mostrar.</p>
              <ul aria-label="Códigos de respaldo" className="mt-2 grid max-w-md grid-cols-2 gap-x-6 gap-y-1 font-bold">
                {enrolamiento.codigosDeRespaldo.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <form onSubmit={confirmar} noValidate className="flex max-w-md flex-col gap-4">
                <CampoTexto etiqueta="Código de 6 dígitos que muestra la app" nombre="codigo" autoComplete="one-time-code" modoEntrada="numeric" valorInicial="" onCambio={setCodigo} />
                {error && <Aviso tono="error">{error}</Aviso>}
                <Boton type="submit" variante="principal" disabled={ocupado}>
                  {ocupado ? "Verificando…" : "Confirmar y activar"}
                </Boton>
              </form>
            </li>
          </ol>
      )}
    </section>
  );
}

// Credencial que se muestra una sola vez ---------------------------------------------------------

/** Punto focal de la sección: lo que se entrega una sola vez, hasta que quien administra confirma que lo tiene. */
function CredencialUnaVez({ titulo, children, alCerrar }: { titulo: string; children: ReactNode; alCerrar: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-panel bg-superficie p-6 text-sobre-superficie">
      <h2 className="text-subtitulo font-extrabold">{titulo}</h2>
      {children}
      <p className="text-ayuda text-sobre-superficie-suave">No se vuelve a mostrar. Si se pierde, genere una nueva.</p>
      <div>
        <Boton onClick={alCerrar}>Ya la entregué</Boton>
      </div>
    </div>
  );
}

const Dato = ({ etiqueta, valor }: { etiqueta: string; valor: string }) => (
  <p className="text-cuerpo">
    {etiqueta}: <code className="text-subtitulo font-extrabold tracking-wide break-all">{valor}</code>
  </p>
);

function Cargando({ etiqueta }: { etiqueta: string }) {
  return <div aria-busy="true" aria-label={etiqueta} className="h-[200px] animate-pulse rounded-panel bg-fondo" />;
}

function ErrorDeCarga({ texto, reintentar }: { texto: string; reintentar: () => void }) {
  return (
    <Aviso tono="error">
      <p>{texto}</p>
      <Boton className="mt-3" onClick={reintentar}>
        Reintentar
      </Boton>
    </Aviso>
  );
}

const claseEnlaceAccion =
  "min-h-tactil rounded-control px-2 text-ayuda font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie disabled:opacity-60";

// Usuarios ---------------------------------------------------------------------------------------

type Rol = "tecnico" | "oficina";
const ROL: Record<Rol, string> = { tecnico: "Técnico", oficina: "Oficina" };

function Usuarios({ propioId }: { propioId: string }) {
  const consulta = useQuery(consultasDeAdministracion.usuarios());
  const [credencial, setCredencial] = useState<{ nombre: string; usuario: string; contrasena: string; nuevo: boolean } | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restablecer = useAccion((u: Usuario) => cliente.llamar("restablecerContrasenaAdministrada", { parametros: { id: u.id } }));
  const desactivar = useAccion((u: Usuario) => cliente.llamar("desactivarUsuarioAdministrado", { parametros: { id: u.id } }));
  const marcar = useAccion((e: { u: Usuario; administrador: boolean }) => cliente.llamar("marcarAdministrador", { parametros: { id: e.u.id }, cuerpo: { administrador: e.administrador } }));

  async function hacer(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeAdministracion(e));
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {credencial && (
        <CredencialUnaVez titulo={credencial.nuevo ? `Usuario creado: ${credencial.nombre}` : `Contraseña nueva de ${credencial.nombre}`} alCerrar={() => setCredencial(null)}>
          <Dato etiqueta="Usuario" valor={credencial.usuario} />
          <Dato etiqueta="Contraseña temporal" valor={credencial.contrasena} />
          <p className="text-cuerpo">Entréguela en persona o por un medio distinto al del usuario.</p>
          {!credencial.nuevo && <p className="text-cuerpo">Sus sesiones se cerraron y sus llaves de acceso se quitaron: si perdió un teléfono o un computador, ya no sirven para entrar.</p>}
        </CredencialUnaVez>
      )}
      <CrearUsuario alCrear={(c) => setCredencial({ ...c, nuevo: true })} />
      {error && <Aviso tono="error">{error}</Aviso>}
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando usuarios" />
      ) : consulta.isError ? (
        <ErrorDeCarga texto="No se pudieron cargar los usuarios." reintentar={() => void consulta.refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-cuerpo">
            <caption className="sr-only">Usuarios de la organización</caption>
            <thead className="text-ayuda text-texto-secundario">
              <tr className="border-b border-division">
                <th scope="col" className="py-2 pr-4 font-normal">Nombre</th>
                <th scope="col" className="py-2 pr-4 font-normal">Usuario</th>
                <th scope="col" className="py-2 pr-4 font-normal">Rol</th>
                <th scope="col" className="py-2 pr-4 font-normal">Estado</th>
                <th scope="col" className="py-2 font-normal">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {consulta.data.usuarios.map((u) => {
                const propio = u.id === propioId;
                const activo = !u.desactivadoEn;
                return (
                  <tr key={u.id} className="border-b border-division align-top last:border-0">
                    <td className="py-2 pr-4 font-bold">{u.nombre}{propio && " (usted)"}</td>
                    <td className="py-2 pr-4">{u.usuario}</td>
                    <td className="py-2 pr-4">
                      {ROL[u.rol]}
                      {u.administrador && <span className="block text-ayuda text-texto-secundario">Administra{u.segundoFactor ? "" : " (sin segundo factor)"}</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {activo ? <Marquilla tono="revisado">Activo</Marquilla> : <Marquilla tono="borrador">{`Desactivado el ${aFechaHora(u.desactivadoEn!)}`}</Marquilla>}
                    </td>
                    <td className="py-1">
                      {activo && confirmando === u.id ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-ayuda">
                            {u.rol === "tecnico"
                              ? `${u.nombre} no podrá entrar y sus teléfonos borrarán sus datos al conectarse. Lo que ya envió se conserva.`
                              : `${u.nombre} no podrá entrar. Lo que ya hizo se conserva.`}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Boton variante="principal" disabled={desactivar.isPending} onClick={() => void hacer(() => desactivar.mutateAsync(u)).then(() => setConfirmando(null))}>
                              {`Sí, desactivar a ${u.nombre}`}
                            </Boton>
                            <Boton onClick={() => setConfirmando(null)}>Cancelar</Boton>
                          </div>
                        </div>
                      ) : (
                        activo && (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={claseEnlaceAccion}
                              disabled={restablecer.isPending}
                              onClick={() =>
                                void hacer(async () => {
                                  const { contrasena } = await restablecer.mutateAsync(u);
                                  setCredencial({ nombre: u.nombre, usuario: u.usuario, contrasena, nuevo: false });
                                })
                              }
                            >
                              {`Restablecer contraseña de ${u.nombre}`}
                            </button>
                            {u.rol === "oficina" && !(propio && u.administrador) && (
                              <button type="button" className={claseEnlaceAccion} disabled={marcar.isPending} onClick={() => void hacer(() => marcar.mutateAsync({ u, administrador: !u.administrador }))}>
                                {u.administrador ? `Quitar administración a ${u.nombre}` : `Dar administración a ${u.nombre}`}
                              </button>
                            )}
                            {!propio && (
                              <button type="button" className={claseEnlaceAccion} onClick={() => setConfirmando(u.id)}>
                                {`Desactivar a ${u.nombre}`}
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CrearUsuario({ alCrear }: { alCrear: (c: { nombre: string; usuario: string; contrasena: string }) => void }) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [rol, setRol] = useState<Rol>("tecnico");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const crear = useAccion(() => cliente.llamar("crearUsuarioAdministrado", { cuerpo: { nombre, usuario, rol } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nombre.trim() === "" || usuario.trim() === "") return setError("Escriba el nombre y el usuario.");
    setError(null);
    try {
      const r = await crear.mutateAsync(undefined);
      alCrear({ nombre: r.usuario.nombre, usuario: r.usuario.usuario, contrasena: r.contrasena });
      // Formulario limpio para el siguiente.
      setNombre("");
      setUsuario("");
      setIntento((n) => n + 1);
    } catch (e) {
      setError(mensajeDeAdministracion(e));
    }
  }

  return (
    <form key={intento} onSubmit={enviar} noValidate aria-labelledby="titulo-crear-usuario" className="flex flex-col gap-4 rounded-panel border border-division p-5">
      <h2 id="titulo-crear-usuario" className="text-cuerpo font-extrabold">
        Crear usuario
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto etiqueta="Nombre completo" nombre="nombre" valorInicial="" onCambio={setNombre} />
        <CampoTexto etiqueta="Usuario para iniciar sesión" nombre="nuevo-usuario" valorInicial="" onCambio={setUsuario} />
      </div>
      <GrupoDeOpciones etiqueta="Rol" valor={rol} onCambio={setRol} opciones={[{ valor: "tecnico", texto: "Técnico (campo)" }, { valor: "oficina", texto: "Oficina" }]} />
      {error && <Aviso tono="error">{error}</Aviso>}
      <div>
        <Boton type="submit" variante="principal" disabled={crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear usuario"}
        </Boton>
      </div>
    </form>
  );
}

// Teléfonos de campo -----------------------------------------------------------------------------

const megas = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

function Dispositivos() {
  const consulta = useQuery({ ...consultasDeAdministracion.dispositivos(), refetchInterval: 60_000 });
  if (consulta.isPending) return <Cargando etiqueta="Cargando teléfonos" />;
  if (consulta.isError) return <ErrorDeCarga texto="No se pudieron cargar los teléfonos." reintentar={() => void consulta.refetch()} />;
  const lista = consulta.data.dispositivos;
  if (lista.length === 0) return <p className="pt-4 text-cuerpo text-texto-secundario">Ningún teléfono se ha conectado todavía. Aparecen aquí desde la primera sincronización de un técnico.</p>;
  const ahora = Date.now();
  return (
    <div className="overflow-x-auto pt-4">
      <table className="w-full text-left text-cuerpo">
        <caption className="sr-only">Teléfonos de campo y su estado</caption>
        <thead className="text-ayuda text-texto-secundario">
          <tr className="border-b border-division">
            <th scope="col" className="py-2 pr-4 font-normal">Técnico</th>
            <th scope="col" className="py-2 pr-4 font-normal">Último contacto</th>
            <th scope="col" className="py-2 pr-4 font-normal">Sin enviar</th>
            <th scope="col" className="py-2 pr-4 font-normal">Almacenamiento</th>
            <th scope="col" className="py-2 font-normal">Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((d) => {
            const s = d.salud;
            const atrasado = s?.pendienteMasAntiguo ? ahora - new Date(s.pendienteMasAntiguo).getTime() > DIA_MS : false;
            return (
              <tr key={`${d.id}:${d.usuario.id}`} className="border-b border-division align-top last:border-0">
                <td className="py-2 pr-4 font-bold">{d.usuario.nombre}</td>
                <td className="py-2 pr-4">
                  {haceCuanto(d.ultimoContacto)}
                  <span className="block text-ayuda text-texto-secundario">{`App versión ${s?.versionApp ?? "[N]"}`}</span>
                </td>
                <td className="py-2 pr-4">
                  {s ? (s.pendientes === 0 ? "Nada" : `${s.pendientes}`) : "[N]"}
                  {atrasado && <span className="block text-ayuda font-bold text-error">{`El más antiguo espera desde ${aFechaHora(s!.pendienteMasAntiguo!)}. Llame al técnico.`}</span>}
                  {s?.ultimoError && <span className="block text-ayuda text-texto-secundario">{`Último error: ${s.ultimoError}`}</span>}
                </td>
                <td className="py-2 pr-4">
                  {s?.persistente === false ? <span className="font-bold text-error">No persistente: el sistema puede borrar los datos</span> : s?.persistente ? "Persistente" : "Sin dato"}
                  {s?.bytesUsados != null && s.bytesDisponibles != null && <span className="block text-ayuda text-texto-secundario">{`${megas(s.bytesUsados)} de ${megas(s.bytesDisponibles)}`}</span>}
                </td>
                <td className="py-2">
                  {d.borradoConfirmadoEn ? (
                    <Marquilla tono="borrador">{`Datos borrados el ${aFechaHora(d.borradoConfirmadoEn)}`}</Marquilla>
                  ) : d.ordenDeBorradoEn ? (
                    <Marquilla tono="revision">Borrado pendiente: se hará al conectarse</Marquilla>
                  ) : (
                    <Marquilla tono="revisado">En uso</Marquilla>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Accesos de clientes ----------------------------------------------------------------------------

type ClienteConAcceso = Respuesta<"listarAccesosDeClientes">["clientes"][number];

function Accesos() {
  const consulta = useQuery(consultasDeAdministracion.accesos());
  const [credencial, setCredencial] = useState<{ cliente: string; identificador: string; clave: string; url: string; qr: string } | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generar = useAccion((e: { c: ClienteConAcceso; regenerar: boolean }) => cliente.llamar("crearAccesoDeCliente", { parametros: { clienteId: e.c.id }, cuerpo: { regenerar: e.regenerar } }));

  async function hacer(c: ClienteConAcceso, regenerar: boolean) {
    setError(null);
    try {
      const r = await generar.mutateAsync({ c, regenerar });
      setCredencial({ cliente: c.nombre, ...r, qr: await qrComoImagen(r.url) });
      setConfirmando(null);
    } catch (e) {
      setError(mensajeDeAdministracion(e));
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {credencial && (
        <CredencialUnaVez titulo={`Acceso de ${credencial.cliente} al portal`} alCerrar={() => setCredencial(null)}>
          <div className="flex flex-wrap items-start gap-6">
            <img src={credencial.qr} alt={`Código QR del acceso de ${credencial.cliente}`} className="size-44 rounded-control bg-panel" />
            <div className="flex flex-col gap-2">
              <Dato etiqueta="Clave" valor={credencial.clave} />
              <p className="text-ayuda text-sobre-superficie-suave">{`Código de acceso (va en el QR): ${credencial.identificador}`}</p>
              <p className="text-cuerpo">Entregue el QR y la clave por medios distintos: por ejemplo, el QR impreso en el informe y la clave por teléfono.</p>
              <div>
                <a href={credencial.qr} download={`acceso-${credencial.cliente}.svg`} className={claseBoton()}>
                  Descargar el QR
                </a>
              </div>
            </div>
          </div>
        </CredencialUnaVez>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando clientes" />
      ) : consulta.isError ? (
        <ErrorDeCarga texto="No se pudieron cargar los clientes." reintentar={() => void consulta.refetch()} />
      ) : consulta.data.clientes.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">Todavía no hay clientes. Por ahora se crean por comando; su pantalla llega con la gestión de visitas y clientes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-cuerpo">
            <caption className="sr-only">Clientes y su acceso al portal</caption>
            <thead className="text-ayuda text-texto-secundario">
              <tr className="border-b border-division">
                <th scope="col" className="py-2 pr-4 font-normal">Cliente</th>
                <th scope="col" className="py-2 pr-4 font-normal">Acceso al portal</th>
                <th scope="col" className="py-2 font-normal">Acción</th>
              </tr>
            </thead>
            <tbody>
              {consulta.data.clientes.map((c) => (
                <tr key={c.id} className="border-b border-division align-top last:border-0">
                  <td className="py-2 pr-4 font-bold">{c.nombre}</td>
                  <td className="py-2 pr-4">
                    {c.acceso ? (c.acceso.regeneradoEn ? `Regenerado el ${aFechaHora(c.acceso.regeneradoEn)}` : `Creado el ${aFechaHora(c.acceso.creadoEn)}`) : "Sin acceso"}
                  </td>
                  <td className="py-1">
                    {!c.acceso ? (
                      <Boton disabled={generar.isPending} onClick={() => void hacer(c, false)}>
                        {`Crear acceso de ${c.nombre}`}
                      </Boton>
                    ) : confirmando === c.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-ayuda">El QR y la clave actuales dejan de servir y se cierran las sesiones abiertas del cliente.</p>
                        <div className="flex flex-wrap gap-2">
                          <Boton variante="principal" disabled={generar.isPending} onClick={() => void hacer(c, true)}>
                            {`Sí, regenerar el acceso de ${c.nombre}`}
                          </Boton>
                          <Boton onClick={() => setConfirmando(null)}>Cancelar</Boton>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={claseEnlaceAccion} onClick={() => setConfirmando(c.id)}>
                        {`Regenerar el acceso de ${c.nombre}`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
