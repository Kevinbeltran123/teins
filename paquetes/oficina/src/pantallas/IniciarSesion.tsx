import { useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed, esLlaveCancelada } from "@teins/protocolo";
import { CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, PanelDeMarca, TriangleAlert } from "@teins/ui";
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

/** Campo con la etiqueta encima; la contraseña empieza oculta y el ojo la muestra (prototipos/oficina). */
function Campo({ etiqueta, tipo = "text", autoComplete, nombre, valor, onCambio, error }: { etiqueta: string; tipo?: "text" | "password"; autoComplete: string; nombre: string; valor: string; onCambio: (v: string) => void; error?: boolean }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const entrada = (
    <input
      id={id}
      name={nombre}
      type={tipo === "password" && !visible ? "password" : "text"}
      autoComplete={autoComplete}
      autoCapitalize="none"
      spellCheck={false}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      aria-invalid={error || undefined}
      className={error ? "error" : undefined}
    />
  );
  return (
    <div className="campo-e">
      <label htmlFor={id}>{etiqueta}</label>
      {tipo === "password" ? (
        <div className="con-ojo">
          {entrada}
          <button type="button" className="ojo-e" aria-label={visible ? "Ocultar lo escrito" : "Mostrar lo escrito"} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
            {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
          </button>
        </div>
      ) : (
        entrada
      )}
    </div>
  );
}

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

function AvisoEntrada({ tono, children }: { tono: "peligro" | "alerta"; children: string }) {
  const Icono = tono === "peligro" ? CircleAlert : TriangleAlert;
  return (
    <div className={`aviso ${tono}`} role={tono === "peligro" ? "alert" : "status"}>
      <Icono aria-hidden size={20} />
      <span>{children}</span>
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
    <div className="app sin-marco">
      <div className="entrada dividida">
        <PanelDeMarca />
        <div className="lado-form">
          <span />
          <div className="centro">
            <main className="entrada-caja">
              {pideCodigo ? (
                <form key="codigo" className="form-entrada" onSubmit={verificar} noValidate>
                  <div className="cab-entrada">
                    <h1>Código de verificación</h1>
                    <p>Escriba los 6 dígitos que muestra su app autenticadora. Si no tiene el celular, use uno de sus códigos de respaldo.</p>
                  </div>
                  {error && <AvisoEntrada tono="peligro">{error}</AvisoEntrada>}
                  <Digitos valor={codigo} onCambio={setCodigo} error={Boolean(error)} />
                  <button className="btn-e principal" type="submit" aria-busy={enviando || undefined}>
                    {enviando && <LoaderCircle aria-hidden size={18} className="motion-safe:animate-spin" />}
                    Verificar
                  </button>
                  <button className="mostrar centrado" type="button" onClick={volverAEmpezar}>
                    Volver a la contraseña
                  </button>
                </form>
              ) : (
                <form key="contrasena" className="form-entrada" onSubmit={enviar} noValidate>
                  <div className="cab-entrada">
                    <h1>Ingresar</h1>
                    <p>Use su usuario de TEINS.</p>
                  </div>
                  {aviso && <AvisoEntrada tono="alerta">{aviso}</AvisoEntrada>}
                  {error && <AvisoEntrada tono="peligro">{error}</AvisoEntrada>}
                  <Campo etiqueta="Usuario" nombre="usuario" autoComplete="username" valor={usuario} onCambio={setUsuario} />
                  <Campo etiqueta="Contraseña" nombre="contrasena" tipo="password" autoComplete="current-password" valor={contrasena} onCambio={setContrasena} error={error === "Escriba su usuario y su contraseña." && contrasena === ""} />
                  <button className="btn-e principal" type="submit" aria-busy={enviando || undefined}>
                    {enviando && <LoaderCircle aria-hidden size={18} className="motion-safe:animate-spin" />}
                    Ingresar
                  </button>
                  {conLlaves && (
                    <>
                      <div className="separador">o</div>
                      <button className="btn-e" type="button" onClick={() => void entrarConLlave()} disabled={enviando}>
                        <KeyRound aria-hidden size={18} />
                        Ingresar con llave de acceso
                      </button>
                    </>
                  )}
                </form>
              )}
            </main>
          </div>
          <p className="pie-entrada">¿Olvidó su contraseña? Pídale a administración que la restablezca.</p>
        </div>
      </div>
    </div>
  );
}
