import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { admiteLlaves, ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  CampoDeIngreso,
  claseBotonIngreso,
  enfocarPrimerError,
  KeyRound,
  LoaderCircle,
  MarcoDeIngreso,
  RequisitosDeContrasena,
  SeparadorIngreso,
  validarContrasenaNueva,
  type ErroresDeContrasena,
} from "@teins/ui";
import { db } from "../datos/instancia";
import { useConexionDelNavegador } from "../dispositivo/useConexion";
import { errorDeCuenta } from "../sesion/cuenta";
import { cambiarContrasenaTemporal, completarCierrePendiente, ContrasenaTemporal, entrarConLaNueva, iniciarSesion, iniciarSesionConLlave, RolNoPermitido, salirSinCambiar } from "../sesion/sesion";

function mensajeDeError(error: unknown, conLlave = false): string {
  if (error instanceof ErrorDeRed) return "Necesitas conexión para iniciar sesión.";
  if (error instanceof RolNoPermitido) return "Este usuario es de oficina. En campo se ingresa con un usuario de técnico.";
  // Una llave quitada, de un usuario desactivado o sin Face ID ni PIN: se entra con la contraseña.
  if (conLlave && error instanceof ErrorApi && error.codigo !== "demasiadas_solicitudes") return "Esa llave de acceso no sirve. Entra con tu usuario y contraseña.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "Usuario o contraseña incorrectos.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return "Demasiados intentos. Espera un minuto e intenta de nuevo.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

/** `alCancelar` existe cuando la sesión venció: se puede volver a capturar sin iniciar sesión. */
export function IniciarSesion({ alCancelar }: { alCancelar?: () => void }) {
  const enLinea = useConexionDelNavegador();
  // Tras una revocación (QA-5): quien vuelva a abrir la app sabe por qué no hay nada.
  const accesoCerrado = useLiveQuery(async () => {
    const ajuste = await db.ajustes.get("acceso_cerrado");
    return ajuste?.clave === "acceso_cerrado" ? ajuste.valor : null;
  });
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [estado, setEstado] = useState<{ tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string }>({ tipo: "listo" });
  const [conLlave, setConLlave] = useState(false);
  // La temporal con la que acaba de entrar: se manda como la actual al crear la propia (ADR-0033).
  const [temporal, setTemporal] = useState<string | null>(null);
  useEffect(() => void admiteLlaves().then(setConLlave), []);
  // Una sesión cerrada sin señal se cierra también en el servidor en cuanto vuelve.
  useEffect(() => {
    if (enLinea) void completarCierrePendiente();
  }, [enLinea]);

  async function entrarConLlave() {
    setEstado({ tipo: "enviando" });
    try {
      await iniciarSesionConLlave();
      alCancelar?.();
    } catch (error) {
      // Cerrar el diálogo del teléfono no es un error.
      setEstado(esLlaveCancelada(error) ? { tipo: "listo" } : { tipo: "error", mensaje: mensajeDeError(error, true) });
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (usuario.trim() === "" || contrasena === "") {
      setEstado({ tipo: "error", mensaje: "Escribe tu usuario y tu contraseña." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await iniciarSesion(usuario, contrasena);
      alCancelar?.();
    } catch (error) {
      if (error instanceof ContrasenaTemporal) {
        setTemporal(contrasena);
        setEstado({ tipo: "listo" });
      } else setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  if (temporal !== null) {
    return (
      <CrearContrasena
        temporal={temporal}
        alEntrar={() => alCancelar?.()}
        alSalir={() => {
          setTemporal(null);
          setContrasena("");
        }}
      />
    );
  }

  return (
    <MarcoDeIngreso titulo="Ingresar" debajo="¿Problemas para entrar? Habla con oficina.">
      {accesoCerrado && <Aviso tono="alerta">Se cerró el acceso de {accesoCerrado.nombre} en este teléfono y se borraron sus datos.</Aviso>}
      {alCancelar && <Aviso tono="alerta">Tu sesión venció. Inicia sesión para enviar lo pendiente; lo capturado sigue en este teléfono.</Aviso>}
      {!enLinea && <Aviso tono="alerta">Sin conexión. Iniciar sesión necesita señal la primera vez.</Aviso>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoDeIngreso etiqueta="Usuario" nombre="usuario" autoComplete="username" valor={usuario} onCambio={setUsuario} />
        <CampoDeIngreso
          etiqueta="Contraseña"
          nombre="contrasena"
          tipo="password"
          autoComplete="current-password"
          valor={contrasena}
          onCambio={setContrasena}
          olvido={{ pregunta: "¿La olvidaste?", respuesta: "Pídele a oficina que la restablezca." }}
        />
        {estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>}
        <button type="submit" aria-busy={estado.tipo === "enviando" || undefined} className={claseBotonIngreso(true)}>
          {estado.tipo === "enviando" && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Ingresar
        </button>
      </form>
      {conLlave && (
        <>
          <SeparadorIngreso />
          <button type="button" onClick={() => void entrarConLlave()} disabled={estado.tipo === "enviando"} className={claseBotonIngreso(false)}>
            <KeyRound aria-hidden />
            Ingresar con llave de acceso
          </button>
        </>
      )}
      {alCancelar && (
        <Boton variante="fantasma" onClick={alCancelar}>
          Seguir sin enviar
        </Boton>
      )}
    </MarcoDeIngreso>
  );
}

const FORMULARIO = "crear-contrasena";

/**
 * La que le entregaron es temporal: la cambia antes de cualquier otra cosa (ADR-0033). Necesita señal, como el
 * ingreso. El teléfono no guarda el usuario hasta que la cambie: si cierra la app, vuelve a entrar con la temporal.
 */
function CrearContrasena({ temporal, alEntrar, alSalir }: { temporal: string; alEntrar: () => void; alSalir: () => void }) {
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<ErroresDeContrasena>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<"listo" | "enviando" | "cambiada" | "entrando">("listo");

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarContrasenaNueva({ actual: temporal, nueva, repetir, pideActual: false, tu: true });
    setErrores(encontrados);
    setGeneral(null);
    if (Object.keys(encontrados).length > 0) return enfocarPrimerError(FORMULARIO);
    setEstado("enviando");
    try {
      await cambiarContrasenaTemporal(temporal, nueva);
      setEstado("cambiada");
    } catch (error) {
      setEstado("listo");
      const { campo, mensaje } = errorDeCuenta(error);
      if (campo === "nueva") {
        setErrores({ nueva: mensaje });
        enfocarPrimerError(FORMULARIO);
      } else setGeneral(campo === "actual" ? "La contraseña temporal ya no sirve. Vuelve a ingresar." : mensaje);
    }
  }

  async function entrar() {
    setEstado("entrando");
    try {
      await entrarConLaNueva();
      alEntrar();
    } catch (error) {
      setEstado("cambiada");
      setGeneral(error instanceof ErrorDeRed ? "Necesitas señal para descargar tus visitas. Intenta de nuevo." : "No se pudo abrir tu cuenta. Intenta de nuevo.");
    }
  }

  if (estado === "cambiada" || estado === "entrando") {
    return (
      <MarcoDeIngreso titulo="Listo" debajo="¿Problemas para entrar? Habla con oficina.">
        <p className="text-center text-[14px] text-texto-secundario">Ya puedes trabajar. La próxima vez entra con tu contraseña nueva.</p>
        {general && <Aviso tono="error">{general}</Aviso>}
        <button type="button" className={claseBotonIngreso(true)} aria-busy={estado === "entrando" || undefined} onClick={() => void entrar()}>
          {estado === "entrando" && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Ir a mis visitas
        </button>
      </MarcoDeIngreso>
    );
  }

  const enviando = estado === "enviando";
  return (
    <MarcoDeIngreso titulo="Crea tu contraseña" debajo="¿Problemas para entrar? Habla con oficina.">
      <form id={FORMULARIO} onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <p className="text-center text-[14px] text-texto-secundario">La que te entregaron es temporal. Escoge una que solo tú sepas.</p>
        {general && <Aviso tono="error">{general}</Aviso>}
        <CampoDeIngreso etiqueta="Contraseña nueva" nombre="nueva" tipo="password" autoComplete="new-password" valor={nueva} onCambio={setNueva} mensajeError={errores.nueva} />
        <CampoDeIngreso etiqueta="Repite la contraseña nueva" nombre="repetir" tipo="password" autoComplete="new-password" valor={repetir} onCambio={setRepetir} mensajeError={errores.repetir} />
        <RequisitosDeContrasena actual={temporal} nueva={nueva} repetir={repetir} />
        <button type="submit" aria-busy={enviando || undefined} className={claseBotonIngreso(true)}>
          {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Guardar y entrar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void salirSinCambiar().then(alSalir)}
          className="min-h-tactil self-center rounded px-2 text-[14px] text-texto-secundario focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Cerrar sesión
        </button>
      </form>
    </MarcoDeIngreso>
  );
}
