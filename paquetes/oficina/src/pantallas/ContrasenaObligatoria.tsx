import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Aviso, CampoDeIngreso, claseBotonIngreso, enfocarPrimerError, LoaderCircle, MarcoDeIngreso, RequisitosDeContrasena, validarContrasenaNueva, type ErroresDeContrasena } from "@teins/ui";
import { cliente, consultas, leerContrasenaDeIngreso, olvidarContrasenaDeIngreso } from "../api";
import { errorDeCuenta } from "../cuenta";

const FORMULARIO = "contrasena-obligatoria";

/**
 * Quien entra con una contraseña temporal la cambia antes de cualquier otra cosa (ADR-0033): sin menú ni forma de
 * saltarla; la otra salida es cerrar sesión. El servidor niega todo lo demás mientras tanto, aunque se salte esta
 * pantalla.
 */
export function ContrasenaObligatoria() {
  const consultasCliente = useQueryClient();
  // La temporal con la que acaba de entrar. Si la página se recargó, ya no está y se pide.
  const [recordada] = useState(leerContrasenaDeIngreso);
  useEffect(() => olvidarContrasenaDeIngreso(), []);
  const [temporal, setTemporal] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<ErroresDeContrasena>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [estado, setEstado] = useState<"listo" | "enviando" | "hecho">("listo");
  const [saliendo, setSaliendo] = useState(false);
  const actual = recordada ?? temporal;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarContrasenaNueva({ actual, nueva, repetir, pideActual: recordada === null, tu: false });
    setErrores(encontrados);
    setGeneral(null);
    if (Object.keys(encontrados).length > 0) return enfocarPrimerError(FORMULARIO);
    setEstado("enviando");
    try {
      await cliente.llamar("cambiarContrasena", { cuerpo: { actual, nueva } });
      setEstado("hecho");
    } catch (error) {
      setEstado("listo");
      const { campo, general } = errorDeCuenta(error);
      // Con la temporal recordada, un "actual incorrecta" no tiene campo donde mostrarse: se dice arriba.
      if (campo && (campo.ruta !== "actual" || recordada === null)) {
        setErrores({ [campo.ruta === "actual" ? "actual" : "nueva"]: campo.ruta === "actual" ? "La contraseña temporal no es correcta." : campo.mensaje });
        enfocarPrimerError(FORMULARIO);
      } else setGeneral(general ?? "No se pudo cambiar la contraseña. Cierre sesión y entre de nuevo con la temporal.");
    }
  }

  async function cerrarSesion() {
    setSaliendo(true);
    await cliente.cerrarSesion().catch(() => undefined);
    await consultasCliente.resetQueries();
  }

  if (estado === "hecho") {
    return (
      <MarcoDeIngreso titulo="Contraseña cambiada" debajo="¿Problemas para entrar? Hable con administración.">
        <p className="text-center text-[14px] text-texto-secundario">Ya puede trabajar. La próxima vez entre con su contraseña nueva.</p>
        <button type="button" className={claseBotonIngreso(true)} onClick={() => void consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey })}>
          Ir a Levantamientos
        </button>
      </MarcoDeIngreso>
    );
  }

  const enviando = estado === "enviando";
  return (
    <MarcoDeIngreso titulo="Cree su contraseña" debajo="Las demás pantallas se abren después de cambiarla.">
      <form id={FORMULARIO} className="flex flex-col gap-4" onSubmit={guardar} noValidate>
        <p className="text-center text-[14px] text-texto-secundario">La que le entregaron es temporal. Escoja una que solo usted sepa.</p>
        {general && <Aviso tono="error">{general}</Aviso>}
        {recordada === null && (
          <CampoDeIngreso etiqueta="Contraseña temporal" nombre="actual" tipo="password" autoComplete="current-password" valor={temporal} onCambio={setTemporal} mensajeError={errores.actual} />
        )}
        <CampoDeIngreso etiqueta="Contraseña nueva" nombre="nueva" tipo="password" autoComplete="new-password" valor={nueva} onCambio={setNueva} mensajeError={errores.nueva} />
        <CampoDeIngreso etiqueta="Repita la contraseña nueva" nombre="repetir" tipo="password" autoComplete="new-password" valor={repetir} onCambio={setRepetir} mensajeError={errores.repetir} />
        <RequisitosDeContrasena actual={actual} nueva={nueva} repetir={repetir} />
        <button className={claseBotonIngreso(true)} type="submit" aria-busy={enviando || undefined}>
          {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Guardar y entrar
        </button>
        <button type="button" onClick={() => void cerrarSesion()} disabled={saliendo || enviando} className="self-center rounded px-1 text-[13.5px] text-texto-secundario hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
          Cerrar sesión
        </button>
      </form>
    </MarcoDeIngreso>
  );
}
