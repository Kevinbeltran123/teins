import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  BotonCopiar,
  Building,
  CampoTexto,
  CeldaTabla,
  Check,
  claseBoton,
  Confirmacion,
  Dialogo,
  Download,
  EncabezadoPagina,
  EsqueletoLista,
  BarraLista,
  Buscador,
  coincide,
  Marcado,
  EstadoVacio,
  FilaTabla,
  GrupoDeOpciones,
  Insignia,
  KeyRound,
  MenuAcciones,
  Pestanas,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tabla,
  UserRound,
} from "@teins/ui";
import { cliente, consultas } from "../api";
import { consultasDeAdministracion, mensajeDeAdministracion, qrComoImagen, useAccion } from "../administracion";
import { aFechaHora, haceCuanto } from "../formato";

type Sesion = Respuesta<"obtenerSesion">;
type Usuario = Respuesta<"listarUsuarios">["usuarios"][number];
type ClienteConAcceso = Respuesta<"listarAccesosDeClientes">["clientes"][number];
type Seccion = "usuarios" | "dispositivos" | "accesos";

const SECCIONES: { valor: Seccion; etiqueta: string }[] = [
  { valor: "usuarios", etiqueta: "Usuarios" },
  { valor: "dispositivos", etiqueta: "Teléfonos de campo" },
  { valor: "accesos", etiqueta: "Accesos de clientes" },
];

/** Un pendiente que lleva más de un día sin subir merece una llamada al técnico (ADR-0017). */
const DIA_MS = 24 * 60 * 60 * 1000;

/** Lo recién creado va primero, en el orden en que se creó: así se encuentra sin buscarlo (DESIGN.md). */
function primeroLosNuevos<T extends { id: string }>(lista: readonly T[], nuevos: readonly string[]): T[] {
  const nuevosPrimero = nuevos.map((id) => lista.find((x) => x.id === id)).filter((x): x is T => Boolean(x));
  return [...nuevosPrimero, ...lista.filter((x) => !nuevos.includes(x.id))];
}

export function Administracion({ sesion }: { sesion: Sesion }) {
  const [seccion, setSeccion] = useState<Seccion>("usuarios");
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  // Al verificar, el segundo factor ya queda activo y la sesión releída lo dice: la activación sigue a la vista
  // hasta que la persona diga que guardó los códigos de respaldo, que no se vuelven a mostrar.
  const [activando, setActivando] = useState(!sesion.usuario.segundoFactor);
  if (!sesion.usuario.administrador) {
    return (
      <>
        <EncabezadoPagina titulo="Administración" />
        <Aviso tono="alerta">Esta sección es para las personas que administran. Pídale acceso a quien administra en TEINS.</Aviso>
      </>
    );
  }
  if (!sesion.usuario.segundoFactor || activando) return <ActivarSegundoFactor alTerminar={() => setActivando(false)} />;
  return (
    <>
      <EncabezadoPagina
        titulo="Administración"
        acciones={
          seccion === "usuarios" && (
            <Boton variante="principal" icono={Plus} onClick={() => setCreando(true)}>
              Nuevo usuario
            </Boton>
          )
        }
      />
      <BarraLista buscador={seccion === "usuarios" && <Buscador etiqueta="Buscar usuarios" ejemplo="Buscar por nombre o usuario" valor={busqueda} onCambio={setBusqueda} />}>
        <Pestanas etiqueta="Qué administrar" activa={seccion} onCambio={setSeccion} pestanas={SECCIONES} />
      </BarraLista>
      <div role="tabpanel" aria-label={SECCIONES.find((s) => s.valor === seccion)!.etiqueta}>
        {seccion === "usuarios" && <Usuarios propioId={sesion.usuario.id} creando={creando} setCreando={setCreando} busqueda={busqueda} />}
        {seccion === "dispositivos" && <Dispositivos />}
        {seccion === "accesos" && <Accesos />}
      </div>
    </>
  );
}

function ErrorDeCarga({ texto, reintentar }: { texto: string; reintentar: () => void }) {
  return (
    <Aviso tono="error">
      <b>{texto}</b>
      <div>
        <Boton tamano="pequeno" icono={RefreshCw} onClick={reintentar}>
          Reintentar
        </Boton>
      </div>
    </Aviso>
  );
}

// Segundo factor ----------------------------------------------------------------------------------

type Etapa = "contrasena" | "escanear" | "respaldo";

/** Pasos numerados en una misma pantalla (GitHub, Microsoft): se ve qué viene y en qué va. */
function Paso({ numero, titulo, estado, children }: { numero: number; titulo: string; estado: "hecho" | "actual" | "pendiente"; children?: ReactNode }) {
  return (
    <li className={estado}>
      <span className="n" aria-hidden>
        {estado === "hecho" ? <Check size={18} /> : numero}
      </span>
      <div>
        <h3>
          {titulo}
          {estado === "hecho" && <span className="sr-only"> (hecho)</span>}
        </h3>
        {estado === "actual" && <div className="col">{children}</div>}
      </div>
    </li>
  );
}

/** La clave de la app en bloques de cuatro, para escribirla a mano sin perderse. */
const enBloques = (texto: string) => texto.match(/.{1,4}/g)?.join(" ") ?? texto;

function ActivarSegundoFactor({ alTerminar }: { alTerminar: () => void }) {
  const consultasCliente = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("contrasena");
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
      setEtapa("escanear");
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "entrada_invalida" ? "La contraseña no es correcta." : mensajeDeAdministracion(e));
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{6}$/.test(codigo.replace(/\s/g, ""))) return setError("Escriba los 6 dígitos que muestra la app.");
    setOcupado(true);
    setError(null);
    try {
      await cliente.verificarSegundoFactor(codigo);
      // Activo desde ya; la sesión se vuelve a leer cuando guarde los códigos, para no perderlos de vista.
      setEtapa("respaldo");
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "no_autenticado" ? "El código no es correcto. Revise que la hora del celular esté al día." : mensajeDeAdministracion(e));
    } finally {
      setOcupado(false);
    }
  }

  const secreto = enrolamiento ? new URL(enrolamiento.uri).searchParams.get("secret") : null;
  const codigos = enrolamiento?.codigosDeRespaldo ?? [];
  const estadoDe = (paso: Etapa) => {
    const orden: Etapa[] = ["contrasena", "escanear", "respaldo"];
    return orden.indexOf(paso) < orden.indexOf(etapa) ? "hecho" : paso === etapa ? "actual" : "pendiente";
  };

  return (
    <>
      <EncabezadoPagina titulo="Administración" />
      <section aria-labelledby="titulo-segundo-factor" className="estrecho col" style={{ gap: 18 }}>
        <div className="flex flex-col gap-1">
          <h2 id="titulo-segundo-factor" className="h2">
            Active el segundo factor para administrar
          </h2>
          <p className="text-cuerpo text-texto-secundario">
            Administrar exige, además de la contraseña, un código de una app autenticadora en su celular (Google Authenticator, Microsoft Authenticator u otra). Desde que lo active, el
            ingreso a oficina también se lo pedirá.
          </p>
        </div>
        <ol className="pasos-2fa">
          <Paso numero={1} titulo="Confirme su contraseña" estado={estadoDe("contrasena")}>
            <form onSubmit={empezar} noValidate className="flex max-w-md flex-col gap-4">
              <CampoTexto etiqueta="Su contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setContrasena} />
              {error && <Aviso tono="error">{error}</Aviso>}
              <div>
                <Boton type="submit" variante="principal" cargando={ocupado}>
                  Continuar
                </Boton>
              </div>
            </form>
          </Paso>
          <Paso numero={2} titulo="Escanee el código y escriba el que muestra la app" estado={estadoDe("escanear")}>
            {enrolamiento && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start gap-6">
                  <img src={enrolamiento.qr} alt="Código QR para la app autenticadora" className="qr" />
                  {secreto && (
                    <details className="max-w-sm text-cuerpo">
                      <summary className="min-h-control cursor-pointer font-bold text-superficie">¿No puede escanearlo?</summary>
                      <div className="flex flex-col gap-3 pt-2">
                        <p className="text-texto-secundario">Escriba esta clave en la app, sin los espacios:</p>
                        <code className="clave">{enBloques(secreto)}</code>
                        <div>
                          <BotonCopiar texto={secreto} etiqueta="Copiar la clave de la app" />
                        </div>
                      </div>
                    </details>
                  )}
                </div>
                <form onSubmit={verificar} noValidate className="flex max-w-md flex-col gap-4">
                  <CampoTexto etiqueta="Código de 6 dígitos que muestra la app" nombre="codigo" autoComplete="one-time-code" modoEntrada="numeric" valorInicial="" onCambio={setCodigo} />
                  {error && <Aviso tono="error">{error}</Aviso>}
                  <div>
                    <Boton type="submit" variante="principal" cargando={ocupado}>
                      Verificar y activar
                    </Boton>
                  </div>
                </form>
              </div>
            )}
          </Paso>
          <Paso numero={3} titulo="Guarde los códigos de respaldo" estado={estadoDe("respaldo")}>
            <p className="text-cuerpo text-texto-secundario">Cada uno sirve una vez para entrar si pierde el celular. No se vuelven a mostrar.</p>
            <ul aria-label="Códigos de respaldo" className="codigos" style={{ listStyle: "none", margin: 0 }}>
              {codigos.map((c) => (
                <li key={c}>
                  <code className="text-cuerpo font-bold tracking-wide">{c}</code>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Códigos de respaldo de TEINS\n\n${codigos.join("\n")}\n`)}`}
                download="codigos-de-respaldo-teins.txt"
                className={claseBoton("secundaria", "pequeno")}
              >
                <Download aria-hidden />
                Descargar
              </a>
              <BotonCopiar texto={codigos.join("\n")} etiqueta="Copiar los códigos de respaldo" />
            </div>
            <div>
              <Boton
                variante="principal"
                onClick={() => {
                  alTerminar();
                  void consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
                }}
              >
                Ya los guardé
              </Boton>
            </div>
          </Paso>
        </ol>
      </section>
    </>
  );
}

// Lo que se entrega una sola vez ------------------------------------------------------------------

/**
 * Diálogo que entrega una credencial una sola vez (DESIGN.md): no se cierra con Esc ni con un clic fuera; la única
 * salida es confirmar que ya se entregó.
 */
function EntregaUnaVez({ titulo, subtitulo, icono, amplio, children, alCerrar }: { titulo: string; subtitulo: string; icono: typeof KeyRound; amplio?: boolean; children: ReactNode; alCerrar: () => void }) {
  return (
    <Dialogo
      titulo={titulo}
      subtitulo={subtitulo}
      icono={icono}
      amplio={amplio ?? false}
      cerrable={false}
      alCerrar={alCerrar}
      pie={
        <Boton variante="principal" onClick={alCerrar}>
          Ya la entregué
        </Boton>
      }
    >
      <Aviso tono="alerta">Solo se muestra esta vez. Si se pierde, genere una nueva.</Aviso>
      {children}
    </Dialogo>
  );
}

// Usuarios ---------------------------------------------------------------------------------------

type Rol = "tecnico" | "oficina";
const ROL: Record<Rol, string> = { tecnico: "Técnico", oficina: "Oficina" };

type Pendiente = { accion: "restablecer" | "administracion" | "desactivar"; u: Usuario };

function Usuarios({ propioId, creando, setCreando, busqueda }: { propioId: string; creando: boolean; setCreando: (v: boolean) => void; busqueda: string }) {
  const consulta = useQuery(consultasDeAdministracion.usuarios());
  const [nuevos, setNuevos] = useState<string[]>([]);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [credencial, setCredencial] = useState<{ nombre: string; usuario: string; contrasena: string; nuevo: boolean } | null>(null);

  const restablecer = useAccion((u: Usuario) => cliente.llamar("restablecerContrasenaAdministrada", { parametros: { id: u.id } }));
  const desactivar = useAccion((u: Usuario) => cliente.llamar("desactivarUsuarioAdministrado", { parametros: { id: u.id } }));
  const marcar = useAccion((e: { u: Usuario; administrador: boolean }) => cliente.llamar("marcarAdministrador", { parametros: { id: e.u.id }, cuerpo: { administrador: e.administrador } }));

  return (
    <div>
      {consulta.isPending ? (
        <EsqueletoLista etiqueta="Cargando usuarios" />
      ) : consulta.isError ? (
        <ErrorDeCarga texto="No se pudieron cargar los usuarios." reintentar={() => void consulta.refetch()} />
      ) : (
        <Tabla etiqueta="Usuarios de la organización" columnas={[{ titulo: "Nombre" }, { titulo: "Rol" }, { titulo: "Estado" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
          {primeroLosNuevos(consulta.data.usuarios, nuevos).filter((u) => coincide(busqueda, u.nombre, u.usuario)).map((u, k) => {
            const propio = u.id === propioId;
            const activo = !u.desactivadoEn;
            return (
              <FilaTabla key={u.id} resaltada={nuevos.includes(u.id)} indice={k}>
                <CeldaTabla>
                  <span className="fila-flex" style={{ flexWrap: "nowrap" }}>
                    <span className="avatar" aria-hidden>
                      {u.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}
                    </span>
                    <span>
                      <span className="fuerte">
                        <Marcado texto={u.nombre} busqueda={busqueda} />
                        {propio && <span className="sec" style={{ fontWeight: 400 }}> (usted)</span>}
                      </span>
                      <span className="sub">
                        <Marcado texto={u.usuario} busqueda={busqueda} />
                      </span>
                    </span>
                  </span>
                </CeldaTabla>
                <CeldaTabla>
                  {ROL[u.rol]}
                  {u.administrador && (
                    <span className="sub">
                      Administra{u.segundoFactor ? "" : <strong style={{ color: "var(--alerta)" }}> · sin segundo factor</strong>}
                    </span>
                  )}
                </CeldaTabla>
                <CeldaTabla>
                  {activo ? (
                    <Insignia tono="exito">Activo</Insignia>
                  ) : (
                    <>
                      <Insignia tono="neutro">Desactivado</Insignia>
                      <span className="sub">{`desde ${aFechaHora(u.desactivadoEn!)}`}</span>
                    </>
                  )}
                </CeldaTabla>
                <CeldaTabla derecha>
                  {activo && (
                    <MenuAcciones
                      etiqueta={`Más acciones para ${u.nombre}`}
                      opciones={[
                        { texto: "Restablecer contraseña", icono: KeyRound, alElegir: () => setPendiente({ accion: "restablecer", u }) },
                        u.rol === "oficina" &&
                          !(propio && u.administrador) && { texto: u.administrador ? "Quitar administración" : "Dar administración", icono: ShieldCheck, alElegir: () => setPendiente({ accion: "administracion", u }) },
                        !propio && { texto: "Desactivar usuario", peligro: true, alElegir: () => setPendiente({ accion: "desactivar", u }) },
                      ]}
                    />
                  )}
                </CeldaTabla>
              </FilaTabla>
            );
          })}
        </Tabla>
      )}

      {creando && (
        <NuevoUsuario
          alCerrar={() => setCreando(false)}
          alCrear={(r) => {
            setCreando(false);
            setNuevos((n) => [r.id, ...n]);
            setCredencial({ nombre: r.nombre, usuario: r.usuario, contrasena: r.contrasena, nuevo: true });
          }}
        />
      )}

      {pendiente?.accion === "restablecer" && (
        <Confirmacion
          nivel="consecuencia"
          titulo={`¿Restablecer la contraseña de ${pendiente.u.nombre}?`}
          confirmar="Restablecer contraseña"
          mensajeDeError={mensajeDeAdministracion}
          alCerrar={() => setPendiente(null)}
          accion={async () => {
            const { contrasena } = await restablecer.mutateAsync(pendiente.u);
            setCredencial({ nombre: pendiente.u.nombre, usuario: pendiente.u.usuario, contrasena, nuevo: false });
          }}
        >
          <p>Se genera una contraseña temporal para entregarle. Sus sesiones se cierran y sus llaves de acceso se quitan: si perdió un teléfono o un computador, ya no sirven para entrar.</p>
        </Confirmacion>
      )}
      {pendiente?.accion === "administracion" && (
        <Confirmacion
          nivel="consecuencia"
          titulo={pendiente.u.administrador ? `¿Quitarle la administración a ${pendiente.u.nombre}?` : `¿Dar administración a ${pendiente.u.nombre}?`}
          confirmar={pendiente.u.administrador ? "Quitar administración" : "Dar administración"}
          mensajeDeError={mensajeDeAdministracion}
          alCerrar={() => setPendiente(null)}
          accion={() => marcar.mutateAsync({ u: pendiente.u, administrador: !pendiente.u.administrador })}
        >
          <p>
            {pendiente.u.administrador
              ? "Deja de ver Administración: no podrá crear usuarios, restablecer contraseñas ni crear accesos de clientes."
              : "Podrá crear y desactivar usuarios, restablecer contraseñas y crear accesos de clientes. Para usarla, deberá activar el segundo factor."}
          </p>
        </Confirmacion>
      )}
      {pendiente?.accion === "desactivar" && (
        <Confirmacion
          titulo={`¿Desactivar a ${pendiente.u.nombre}?`}
          confirmar="Desactivar usuario"
          nivel="irreversible"
          mensajeDeError={mensajeDeAdministracion}
          alCerrar={() => setPendiente(null)}
          accion={() => desactivar.mutateAsync(pendiente.u)}
        >
          <p>
            {pendiente.u.rol === "tecnico"
              ? "No podrá entrar, y sus teléfonos borrarán sus datos al conectarse. Lo que ya envió se conserva."
              : "No podrá entrar. Lo que ya hizo se conserva."}
          </p>
        </Confirmacion>
      )}

      {credencial && (
        <EntregaUnaVez titulo={credencial.nuevo ? "Usuario creado" : "Contraseña restablecida"} subtitulo={credencial.nombre} icono={UserRound} alCerrar={() => setCredencial(null)}>
          <dl className="flex flex-col gap-1">
            <dt className="text-ayuda text-texto-secundario">Usuario</dt>
            <dd className="pb-3">
              <code className="text-subtitulo font-bold">{credencial.usuario}</code>
            </dd>
            <dt className="text-ayuda text-texto-secundario">Contraseña temporal</dt>
            <dd className="flex flex-wrap items-center gap-3">
              <code className="text-titulo font-extrabold tracking-wide break-all">{credencial.contrasena}</code>
              <BotonCopiar texto={credencial.contrasena} etiqueta="Copiar la contraseña temporal" />
            </dd>
          </dl>
          <p className="text-cuerpo text-texto-secundario">Entréguela en persona o por un medio distinto al del usuario.</p>
        </EntregaUnaVez>
      )}
    </div>
  );
}

const USUARIO_VALIDO = /^[a-z0-9.-]{3,30}$/;

function NuevoUsuario({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (r: { id: string; nombre: string; usuario: string; contrasena: string }) => void }) {
  const formulario = useId();
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [rol, setRol] = useState<Rol>("tecnico");
  const [errores, setErrores] = useState<{ nombre?: string; usuario?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const crear = useAccion(() => cliente.llamar("crearUsuarioAdministrado", { cuerpo: { nombre: nombre.trim(), usuario: usuario.trim(), rol } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre completo." } : {}),
      ...(!USUARIO_VALIDO.test(usuario.trim()) ? { usuario: "De 3 a 30 letras minúsculas, números, punto o guion, sin espacios." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      const r = await crear.mutateAsync(undefined);
      alCrear({ id: r.usuario.id, nombre: r.usuario.nombre, usuario: r.usuario.usuario, contrasena: r.contrasena });
    } catch (e) {
      setError(mensajeDeAdministracion(e));
    }
  }

  return (
    <Dialogo
      forma="lateral"
      titulo="Nuevo usuario"
      cerrable={!crear.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={crear.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={crear.isPending}>
            Crear usuario
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoTexto etiqueta="Nombre completo" nombre="nombre" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        <CampoTexto etiqueta="Usuario para iniciar sesión" nombre="nuevo-usuario" valorInicial="" onCambio={setUsuario} error={errores.usuario} />
        <GrupoDeOpciones etiqueta="Rol" valor={rol} onCambio={setRol} opciones={[{ valor: "tecnico", texto: "Técnico (campo)" }, { valor: "oficina", texto: "Oficina" }]} />
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

// Teléfonos de campo -----------------------------------------------------------------------------

const megas = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

function Dispositivos() {
  const consulta = useQuery({ ...consultasDeAdministracion.dispositivos(), refetchInterval: 60_000 });
  if (consulta.isPending) return <EsqueletoLista etiqueta="Cargando teléfonos" />;
  if (consulta.isError) return <ErrorDeCarga texto="No se pudieron cargar los teléfonos." reintentar={() => void consulta.refetch()} />;
  const lista = consulta.data.dispositivos;
  if (lista.length === 0) {
    return (
      <EstadoVacio icono={Smartphone} titulo="Ningún teléfono se ha conectado todavía">
        Aparecen aquí desde la primera sincronización de un técnico.
      </EstadoVacio>
    );
  }
  const ahora = Date.now();
  return (
    <Tabla etiqueta="Teléfonos de campo y su estado" columnas={[{ titulo: "Técnico" }, { titulo: "Último contacto" }, { titulo: "Sin enviar" }, { titulo: "Almacenamiento" }, { titulo: "Estado" }]}>
      {lista.map((d) => {
        const s = d.salud;
        const atrasado = s?.pendienteMasAntiguo ? ahora - new Date(s.pendienteMasAntiguo).getTime() > DIA_MS : false;
        return (
          <FilaTabla key={`${d.id}:${d.usuario.id}`}>
            <CeldaTabla principal>{d.usuario.nombre}</CeldaTabla>
            <CeldaTabla>
              {haceCuanto(d.ultimoContacto)}
              <span className="sub">{`App versión ${s?.versionApp ?? "[N]"}`}</span>
            </CeldaTabla>
            <CeldaTabla>
              {s ? (s.pendientes === 0 ? "Nada" : `${s.pendientes}`) : "[N]"}
              {atrasado && <span className="sub" style={{ color: "var(--alerta)", fontWeight: 700 }}>{`El más antiguo espera desde ${aFechaHora(s!.pendienteMasAntiguo!)}. Llame al técnico.`}</span>}
              {s?.ultimoError && <span className="sub">{`Último error: ${s.ultimoError}`}</span>}
            </CeldaTabla>
            <CeldaTabla>
              {s?.persistente === false ? <span style={{ color: "var(--alerta)", fontWeight: 700 }}>No persistente: el sistema puede borrar los datos</span> : s?.persistente ? "Persistente" : "Sin dato"}
              {s?.bytesUsados != null && s.bytesDisponibles != null && <span className="sub">{`${megas(s.bytesUsados)} de ${megas(s.bytesDisponibles)}`}</span>}
            </CeldaTabla>
            <CeldaTabla>
              {d.borradoConfirmadoEn ? (
                <>
                  <Insignia tono="neutro">Datos borrados</Insignia>
                  <span className="sub">{aFechaHora(d.borradoConfirmadoEn)}</span>
                </>
              ) : d.ordenDeBorradoEn ? (
                <>
                  <Insignia tono="alerta">Borrado pendiente</Insignia>
                  <span className="sub">Se hará al conectarse</span>
                </>
              ) : (
                <Insignia tono="exito">En uso</Insignia>
              )}
            </CeldaTabla>
          </FilaTabla>
        );
      })}
    </Tabla>
  );
}

// Accesos de clientes ----------------------------------------------------------------------------

type Entrega = { cliente: string; identificador: string; clave: string; url: string; qr: string; regenerado: boolean };

function Accesos() {
  const consulta = useQuery(consultasDeAdministracion.accesos());
  const [credencial, setCredencial] = useState<Entrega | null>(null);
  const [regenerando, setRegenerando] = useState<ClienteConAcceso | null>(null);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generar = useAccion((e: { c: ClienteConAcceso; regenerar: boolean }) => cliente.llamar("crearAccesoDeCliente", { parametros: { clienteId: e.c.id }, cuerpo: { regenerar: e.regenerar } }));

  async function entregar(c: ClienteConAcceso, regenerar: boolean) {
    const r = await generar.mutateAsync({ c, regenerar });
    setCredencial({ cliente: c.nombre, ...r, qr: await qrComoImagen(r.url), regenerado: regenerar });
    setRecientes((n) => [c.id, ...n]);
  }

  async function crear(c: ClienteConAcceso) {
    setError(null);
    try {
      await entregar(c, false);
    } catch (e) {
      setError(`No se pudo crear el acceso de ${c.nombre}. ${mensajeDeAdministracion(e)}`);
    }
  }

  if (consulta.isPending) return <EsqueletoLista etiqueta="Cargando clientes" />;
  if (consulta.isError) return <ErrorDeCarga texto="No se pudieron cargar los clientes." reintentar={() => void consulta.refetch()} />;
  if (consulta.data.clientes.length === 0) {
    return (
      <EstadoVacio
        icono={Building}
        titulo="Todavía no hay clientes"
        accion={
          <Link to="/clientes" className={claseBoton("secundaria", "pequeno")}>
            Ir a Clientes
          </Link>
        }
      >
        Cada cliente se crea en Clientes; después aquí se le crea su acceso al portal.
      </EstadoVacio>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Aviso tono="error">{error}</Aviso>}
      <Tabla etiqueta="Clientes y su acceso al portal" columnas={[{ titulo: "Cliente" }, { titulo: "Acceso al portal" }, { titulo: "Último cambio" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
        {consulta.data.clientes.map((c) => (
          <FilaTabla key={c.id} resaltada={recientes.includes(c.id)}>
            <CeldaTabla principal>{c.nombre}</CeldaTabla>
            <CeldaTabla>{c.acceso ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Sin acceso</Insignia>}</CeldaTabla>
            <CeldaTabla>
              {c.acceso ? (
                c.acceso.regeneradoEn ? `Regenerado el ${aFechaHora(c.acceso.regeneradoEn)}` : `Creado el ${aFechaHora(c.acceso.creadoEn)}`
              ) : (
                <span className="text-texto-secundario">Nunca</span>
              )}
            </CeldaTabla>
            <CeldaTabla derecha>
              {c.acceso ? (
                <MenuAcciones etiqueta={`Más acciones para ${c.nombre}`} opciones={[{ texto: "Regenerar acceso", icono: RefreshCw, peligro: true, alElegir: () => setRegenerando(c) }]} />
              ) : (
                <Boton
                  tamano="pequeno"
                  icono={Plus}
                  aria-label={`Crear acceso de ${c.nombre}`}
                  cargando={generar.isPending && generar.variables?.c.id === c.id}
                  disabled={generar.isPending && generar.variables?.c.id !== c.id}
                  onClick={() => void crear(c)}
                >
                  Crear acceso
                </Boton>
              )}
            </CeldaTabla>
          </FilaTabla>
        ))}
      </Tabla>

      {regenerando && (
        <Confirmacion
          titulo={`¿Regenerar el acceso de ${regenerando.nombre}?`}
          confirmar="Regenerar acceso"
          nivel="irreversible"
          mensajeDeError={mensajeDeAdministracion}
          alCerrar={() => setRegenerando(null)}
          accion={() => entregar(regenerando, true)}
        >
          <p>El QR y la clave actuales dejan de servir y se cierran las sesiones abiertas del cliente. Tendrá que entregarle los nuevos.</p>
        </Confirmacion>
      )}

      {credencial && (
        <EntregaUnaVez
          titulo={credencial.regenerado ? "Acceso al portal regenerado" : "Acceso al portal creado"}
          subtitulo={credencial.cliente}
          icono={QrCode}
          amplio
          alCerrar={() => setCredencial(null)}
        >
          <div className="grid gap-6 md:grid-cols-[232px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-3 rounded-panel border border-division p-4">
              <img src={credencial.qr} alt={`Código QR del acceso de ${credencial.cliente}`} className="qr" />
              <p className="flex flex-col items-center text-center">
                <span className="text-ayuda text-texto-secundario">Código de acceso (va en el QR)</span>
                <code className="text-cuerpo font-bold tracking-wide break-all">{credencial.identificador}</code>
              </p>
              <a href={credencial.qr} download={`acceso-${credencial.cliente}.svg`} className={claseBoton("secundaria", "pequeno")}>
                <Download aria-hidden />
                Descargar el QR
              </a>
            </div>
            <ol className="flex flex-col gap-5">
              <li className="flex flex-col gap-1">
                <span className="text-cuerpo font-bold">1. Entregue el QR</span>
                <span className="text-cuerpo text-texto-secundario">Impreso junto al informe o por correo al cliente.</span>
              </li>
              <li className="flex flex-col gap-2">
                <span className="text-cuerpo font-bold">2. Dicte la clave por teléfono</span>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-borde-suave bg-panel-hundido py-2 pr-2 pl-4">
                  <code aria-label="Clave" className="text-titulo font-extrabold tracking-wider">
                    {credencial.clave}
                  </code>
                  <BotonCopiar texto={credencial.clave} etiqueta="Copiar la clave" />
                </div>
                <span className="text-cuerpo text-texto-secundario">Por un medio distinto al del QR: así nadie tiene las dos partes.</span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="text-cuerpo font-bold">3. El cliente entra al portal</span>
                <span className="text-cuerpo text-texto-secundario">Escanea el QR, escribe la clave y ve sus informes publicados.</span>
              </li>
            </ol>
          </div>
        </EntregaUnaVez>
      )}
    </div>
  );
}
