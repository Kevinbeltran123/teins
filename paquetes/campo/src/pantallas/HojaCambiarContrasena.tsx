import { useId, useState, type FormEvent } from "react";
import { Aviso, Boton, CampoTexto, Dialogo, enfocarPrimerError, RequisitosDeContrasena, useNotificar, validarContrasenaNueva, type ErroresDeContrasena } from "@teins/ui";
import { errorDeCuenta } from "../sesion/cuenta";
import { cliente } from "../sincronizacion/instancia";

/**
 * Cambiar la propia contraseña desde "Tu cuenta" (ADR-0033): con la actual, porque un teléfono prestado con la sesión
 * abierta no basta. Necesita señal: el servidor es quien la cambia. Lo capturado no se toca.
 */
export default function HojaCambiarContrasena({ alCerrar }: { alCerrar: () => void }) {
  const formulario = useId();
  const notificar = useNotificar();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<ErroresDeContrasena>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarContrasenaNueva({ actual, nueva, repetir, pideActual: true, tu: true });
    setErrores(encontrados);
    setGeneral(null);
    if (Object.keys(encontrados).length > 0) return enfocarPrimerError(formulario);
    setOcupado(true);
    try {
      await cliente.llamar("cambiarContrasena", { cuerpo: { actual, nueva } });
      alCerrar();
      notificar({ texto: "Contraseña cambiada · se cerraron tus otras sesiones" });
    } catch (error) {
      setOcupado(false);
      const { campo, mensaje } = errorDeCuenta(error);
      if (campo) {
        setErrores({ [campo]: mensaje });
        enfocarPrimerError(formulario);
      } else setGeneral(mensaje);
    }
  }

  return (
    <Dialogo
      forma="inferior"
      titulo="Cambiar contraseña"
      cerrable={!ocupado}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={ocupado}>
            Cambiar
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <CampoTexto etiqueta="Contraseña actual" nombre="actual" tipo="password" autoComplete="current-password" valorInicial="" onCambio={setActual} error={errores.actual} />
        <CampoTexto etiqueta="Contraseña nueva" nombre="nueva" tipo="password" autoComplete="new-password" valorInicial="" onCambio={setNueva} error={errores.nueva} />
        <CampoTexto etiqueta="Repite la contraseña nueva" nombre="repetir" tipo="password" autoComplete="new-password" valorInicial="" onCambio={setRepetir} error={errores.repetir} />
        <RequisitosDeContrasena actual={actual} nueva={nueva} repetir={repetir} />
        <p className="text-ayuda text-texto-secundario">Se cierran tus sesiones en otros teléfonos. Lo que tienes sin enviar sigue aquí.</p>
        {general && <Aviso tono="error">{general}</Aviso>}
      </form>
    </Dialogo>
  );
}
