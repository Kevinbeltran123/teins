import { useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { Aviso, CampoDeIngreso, claseBotonIngreso, KeyRound, LoaderCircle, MarcoDeIngreso, SeparadorIngreso } from "@teins/ui";
import { cliente, consultas } from "../api";

/** En el computador también sirve la llave del celular (con un código QR): basta con que el navegador sepa de llaves. */
const conLlaves = typeof window !== "undefined" && "PublicKeyCredential" in window;

function mensajeDeError(error: unknown, conLlave = false): string {
  if (error instanceof ErrorDeRed) return "No hay conexión con el servidor. Revise su conexión e intente de nuevo.";
  if (conLlave && error instanceof ErrorApi && error.codigo !== "demasiadas_solicitudes") return "Esa llave de acceso no sirve. Inicie sesión con su usuario y contraseña.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "Usuario o contraseña incorrectos.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return "Demasiados intentos. Espere un minuto e intente de nuevo.";
  return "No se pudo iniciar sesión. Intente de nuevo.";
}

function mensajeDeCodigo(error: unknown): { mensaje: string; volver: boolean } {
  if (error instanceof ErrorDeRed) return { mensaje: "No hay conexión con el servidor. Revise su conexión e intente de nuevo.", volver: false };
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return { mensaje: "El código no es correcto o ya venció. Revise que la hora del celular esté al día.", volver: false };
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") return { mensaje: "Demasiados códigos equivocados. Espere 15 minutos e inicie sesión de nuevo.", volver: true };
  // El desafío se invalida tras cinco códigos equivocados: hay que empezar otra vez con la contraseña.
  return { mensaje: "Demasiados intentos con este ingreso. Inicie sesión de nuevo.", volver: true };
}

type Estado = { tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string };

/**
 * Seis casillas grandes, como en campo. Es un solo campo ("Código") encima de las casillas: se puede pegar el
 * código entero, el celular lo sugiere (one-time-code) y el lector de pantalla oye un campo, no seis.
 */
function Digitos({ valor, onCambio, error }: { valor: string; onCambio: (v: string) => void; error: boolean }) {
  const id = useId();
  const [enfocado, setEnfocado] = useState(false);
  return (
    <div className={`digitos ${error ? "error" : ""}`} style={{ position: "relative" }}>
      <label htmlFor={id} className="sr-only">
        Código
      </label>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} aria-hidden className={`digito ${enfocado && i === Math.min(valor.length, 5) ? "actual" : ""}`}>
          {valor[i] ?? ""}
        </span>
      ))}
      <input
        id={id}
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        value={valor}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        onChange={(e) => onCambio(e.target.value.replace(/\s/g, ""))}
        className="digitos-campo"
      />
    </div>
  );
}

export function IniciarSesion({ aviso }: { aviso?: string }) {
  const consultasCliente = useQueryClient();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pideCodigo, setPideCodigo] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (usuario.trim() === "" || contrasena === "") {
      setEstado({ tipo: "error", mensaje: "Escriba su usuario y su contraseña." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      const { pideCodigo } = await cliente.iniciarSesion(usuario, contrasena);
      if (pideCodigo) {
        setPideCodigo(true);
        setEstado({ tipo: "listo" });
        return;
      }
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  async function verificar(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.trim() === "") {
      setEstado({ tipo: "error", mensaje: "Escriba el código de su app autenticadora." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await cliente.verificarSegundoFactor(codigo);
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      const { mensaje, volver } = mensajeDeCodigo(error);
      if (volver) {
        setPideCodigo(false);
        setContrasena("");
      }
      setEstado({ tipo: "error", mensaje });
    }
  }

  async function entrarConLlave() {
    setEstado({ tipo: "enviando" });
    try {
      await cliente.iniciarSesionConLlave();
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado(esLlaveCancelada(error) ? { tipo: "listo" } : { tipo: "error", mensaje: mensajeDeError(error, true) });
    }
  }

  function volverAEmpezar() {
    setPideCodigo(false);
    setContrasena("");
    setCodigo("");
    setEstado({ tipo: "listo" });
  }

  const enviando = estado.tipo === "enviando";
  const error = estado.tipo === "error" ? estado.mensaje : null;

  return (
    <MarcoDeIngreso titulo={pideCodigo ? "Código de verificación" : "Ingresar"} debajo="¿Problemas para entrar? Hable con administración.">
      {pideCodigo ? (
        <form key="codigo" className="flex flex-col gap-4" onSubmit={verificar} noValidate>
          <p className="text-center text-[14px] text-texto-secundario">Escriba los 6 dígitos que muestra su app autenticadora. Si no tiene el celular, use uno de sus códigos de respaldo.</p>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Digitos valor={codigo} onCambio={setCodigo} error={Boolean(error)} />
          <button className={claseBotonIngreso(true)} type="submit" aria-busy={enviando || undefined}>
            {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
            Verificar
          </button>
          <button className={claseBotonIngreso(false)} type="button" onClick={volverAEmpezar}>
            Volver a la contraseña
          </button>
        </form>
      ) : (
        <>
          <form key="contrasena" className="flex flex-col gap-4" onSubmit={enviar} noValidate>
            {aviso && <Aviso tono="alerta">{aviso}</Aviso>}
            {error && <Aviso tono="error">{error}</Aviso>}
            <CampoDeIngreso etiqueta="Usuario" nombre="usuario" autoComplete="username" valor={usuario} onCambio={setUsuario} />
            <CampoDeIngreso
              etiqueta="Contraseña"
              nombre="contrasena"
              tipo="password"
              autoComplete="current-password"
              valor={contrasena}
              onCambio={setContrasena}
              error={error === "Escriba su usuario y su contraseña." && contrasena === ""}
              olvido={{ pregunta: "¿La olvidó?", respuesta: "Pídale a administración que la restablezca." }}
            />
            <button className={claseBotonIngreso(true)} type="submit" aria-busy={enviando || undefined}>
              {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
              Ingresar
            </button>
          </form>
          {conLlaves && (
            <>
              <SeparadorIngreso />
              <button className={claseBotonIngreso(false)} type="button" onClick={() => void entrarConLlave()} disabled={enviando}>
                <KeyRound aria-hidden />
                Ingresar con llave de acceso
              </button>
            </>
          )}
        </>
      )}
    </MarcoDeIngreso>
  );
}
