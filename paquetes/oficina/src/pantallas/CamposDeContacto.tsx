import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { CELULAR, type Respuesta } from "@teins/protocolo";
import { CampoTexto } from "@teins/ui";
import { aFechaHora } from "../formato";
import { sinError } from "../mensajes";

type Contacto = Respuesta<"obtenerCliente">["contactos"][number];

export interface ErroresDeContacto {
  nombre?: string;
  correo?: string;
  celular?: string;
  autorizacion?: string;
}

/** "310 555 0142" → "+573105550142": los 10 dígitos de un celular colombiano llevan su indicativo. */
export function aCelular(texto: string): string | null {
  const limpio = texto.replace(/[\s().-]/g, "");
  if (limpio === "") return null;
  return limpio.startsWith("+") ? limpio : /^3\d{9}$/.test(limpio) ? `+57${limpio}` : limpio;
}

export const celularLegible = (e164: string) => (e164.startsWith("+57") && e164.length === 13 ? `+57 ${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}` : e164);

/** Al cambiar un dato del contacto, se van los errores que hablan de él. */
const corregido = (setErrores: Dispatch<SetStateAction<ErroresDeContacto>> | undefined, ...cuales: (keyof ErroresDeContacto)[]) => setErrores?.((e) => sinError(e, ...cuales));

/** Lo que se marcó en la casilla de WhatsApp, con el número que estaba escrito al marcarla. */
export interface MarcaDeAutorizacion {
  celular: string | null;
  autorizado: boolean;
}

/**
 * La autorización de WhatsApp es del número (ADR-0028, parte 5): la registrada vale para el celular con que se dio, y lo
 * que se marca aquí, para el número escrito al marcarlo. Con otro número la casilla queda sin marcar y se confirma de
 * nuevo: si no, el servidor registraría a nombre de quien edita una autorización que nadie confirmó. Si vuelve al
 * número autorizado, vuelve la registrada.
 */
export function autorizacionDelCelular(contacto: Pick<Contacto, "celular" | "whatsappAutorizado"> | null, celular: string | null, marca: MarcaDeAutorizacion | null) {
  const vigente = contacto?.whatsappAutorizado && contacto.celular === celular ? contacto.whatsappAutorizado : null;
  return { vigente, autorizado: marca?.celular === celular ? marca.autorizado : vigente !== null };
}

/**
 * Los datos de un contacto (ADR-0028, parte 5): quién es, por dónde le llegan los documentos y cuáles. Los usan
 * "Nuevo contacto" y "Nuevo cliente", que pide el contacto principal desde la iteración 29. `algunCanal` exige
 * correo o celular: sin ninguno, los documentos no le llegan.
 */
export function useCamposDeContacto(contacto: Contacto | null, { algunCanal = false, recibeCotizaciones: cotizacionesPorOmision = false } = {}) {
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [correo, setCorreo] = useState(contacto?.correo ?? "");
  const [celular, setCelular] = useState(contacto?.celular ?? "");
  const [recibeCorreo, setRecibeCorreo] = useState(contacto?.recibeCorreo ?? true);
  const [recibeWhatsapp, setRecibeWhatsapp] = useState(contacto?.recibeWhatsapp ?? false);
  const [recibeInformes, setRecibeInformes] = useState(contacto?.recibeInformes ?? true);
  const [recibeCotizaciones, setRecibeCotizaciones] = useState(contacto?.recibeCotizaciones ?? cotizacionesPorOmision);
  const [marca, setMarca] = useState<MarcaDeAutorizacion | null>(null);

  const celularE164 = aCelular(celular);
  // La autorización es del número: si cambia, se vuelve a confirmar (ADR-0028, parte 5).
  const { vigente: autorizacionVigente, autorizado } = autorizacionDelCelular(contacto, celularE164, marca);
  const quien = nombre.trim().split(/\s+/)[0] || "El contacto";

  const datos = () => ({
    nombre: nombre.trim(),
    cargo: cargo.trim(),
    correo: correo.trim() || null,
    celular: celularE164,
    recibeCorreo,
    recibeWhatsapp,
    recibeInformes,
    recibeCotizaciones,
    // Sin el canal, la autorización del mismo número se conserva (quién y cuándo): apagar WhatsApp no la borra, cambiar el
    // celular sí (iteración 42).
    whatsappAutorizado: recibeWhatsapp ? autorizado : autorizacionVigente !== null,
  });

  function validar(): ErroresDeContacto {
    const correoLimpio = correo.trim();
    return {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre del contacto." } : {}),
      ...(algunCanal && correoLimpio === "" && !celularE164 ? { correo: "Escriba el correo, el celular o los dos: por ahí le llegan los documentos." } : {}),
      ...(recibeCorreo && correoLimpio === "" && !(algunCanal && !celularE164) ? { correo: "Para recibir el informe por correo hace falta el correo." } : {}),
      ...(correoLimpio !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio) ? { correo: "Revise el correo: le falta algo, como la @ o el dominio." } : {}),
      ...(recibeWhatsapp && !celularE164 ? { celular: "Para recibir el informe por WhatsApp hace falta el celular." } : {}),
      ...(celularE164 && !CELULAR.test(celularE164) ? { celular: "Escriba los 10 dígitos del celular, o el número con + y el indicativo si es de otro país." } : {}),
      ...(recibeWhatsapp && !autorizado ? { autorizacion: "WhatsApp exige que el contacto haya autorizado los mensajes." } : {}),
    };
  }

  /** `setErrores`: al cambiar un dato, se van los errores que hablan de él. */
  const campos = (errores: ErroresDeContacto, setErrores?: Dispatch<SetStateAction<ErroresDeContacto>>): ReactNode => (
    <>
      <div className="fila-campos">
        <CampoTexto etiqueta="Nombre" nombre="nombre" valorInicial={nombre} onCambio={(t) => (setNombre(t), corregido(setErrores, "nombre"))} error={errores.nombre} autoComplete="off" />
        <CampoTexto etiqueta="Cargo (opcional)" nombre="cargo" valorInicial={cargo} onCambio={setCargo} />
      </div>
      <div className="fila-campos">
        <CampoTexto etiqueta="Correo" nombre="correo" tipo="email" modoEntrada="email" autoComplete="email" valorInicial={correo} onCambio={(t) => (setCorreo(t), corregido(setErrores, "correo"))} error={errores.correo} />
        <CampoTexto
          etiqueta="Celular"
          nombre="celular"
          valorInicial={contacto?.celular ? celularLegible(contacto.celular) : ""}
          // Con `algunCanal`, el error del correo pide el correo o el celular: escribir el celular también lo atiende.
          onCambio={(t) => (setCelular(t), corregido(setErrores, "celular", ...(algunCanal ? (["correo"] as const) : [])))}
          error={errores.celular}
          tipo="tel"
          modoEntrada="tel"
          autoComplete="tel"
        />
      </div>
      <div className="fila-campos">
        <fieldset className="campo">
          <legend className="etq" style={{ marginBottom: 6 }}>
            Recibe
          </legend>
          <div className="opciones">
            <label className="opcion">
              <input type="checkbox" checked={recibeInformes} onChange={(e) => setRecibeInformes(e.target.checked)} />
              Los informes
            </label>
            <label className="opcion">
              <input type="checkbox" checked={recibeCotizaciones} onChange={(e) => setRecibeCotizaciones(e.target.checked)} />
              Las cotizaciones
            </label>
          </div>
        </fieldset>
        <fieldset className="campo">
          <legend className="etq" style={{ marginBottom: 6 }}>
            Por
          </legend>
          <div className="opciones">
            <label className="opcion">
              <input type="checkbox" checked={recibeCorreo} onChange={(e) => (setRecibeCorreo(e.target.checked), corregido(setErrores, "correo"))} />
              Correo
            </label>
            <label className="opcion">
              <input type="checkbox" checked={recibeWhatsapp} onChange={(e) => (setRecibeWhatsapp(e.target.checked), corregido(setErrores, "celular", "autorizacion"))} />
              WhatsApp
            </label>
          </div>
        </fieldset>
      </div>
      {recibeWhatsapp && (
        <label className="casilla" style={{ boxShadow: errores.autorizacion ? "inset 0 0 0 2px var(--peligro)" : undefined }}>
          <input type="checkbox" checked={autorizado} onChange={(e) => (setMarca({ celular: celularE164, autorizado: e.target.checked }), corregido(setErrores, "autorizacion"))} />
          <span>
            <b>{`${quien} autorizó recibir el informe por WhatsApp`}</b>
            <span className="block text-ayuda text-texto-secundario">
              {autorizacionVigente && autorizado ? `Lo confirmó ${autorizacionVigente.por.nombre} el ${aFechaHora(autorizacionVigente.en)}.` : "WhatsApp lo exige. Queda registrado que usted lo confirmó, y cuándo."}
            </span>
            {errores.autorizacion && <span className="msj-error">{errores.autorizacion}</span>}
          </span>
        </label>
      )}
    </>
  );

  return { datos, validar, campos, nombre: nombre.trim() };
}
