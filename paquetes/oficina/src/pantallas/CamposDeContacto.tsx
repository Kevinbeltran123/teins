import { useState, type ReactNode } from "react";
import { CELULAR, type Respuesta } from "@teins/protocolo";
import { CampoTexto } from "@teins/ui";
import { aFechaHora } from "../formato";

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
  const [autorizado, setAutorizado] = useState(contacto?.whatsappAutorizado !== null && contacto?.whatsappAutorizado !== undefined);

  const celularE164 = aCelular(celular);
  // La autorización es del número: si cambia, se vuelve a confirmar (ADR-0028, parte 5).
  const autorizacionVigente = contacto?.whatsappAutorizado && contacto.celular === celularE164 ? contacto.whatsappAutorizado : null;
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
    whatsappAutorizado: recibeWhatsapp && autorizado,
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

  const campos = (errores: ErroresDeContacto): ReactNode => (
    <>
      <div className="fila-campos">
        <CampoTexto etiqueta="Nombre" nombre="nombre" valorInicial={nombre} onCambio={setNombre} error={errores.nombre} autoComplete="off" />
        <CampoTexto etiqueta="Cargo (opcional)" nombre="cargo" valorInicial={cargo} onCambio={setCargo} />
      </div>
      <div className="fila-campos">
        <CampoTexto etiqueta="Correo" nombre="correo" tipo="email" modoEntrada="email" autoComplete="email" valorInicial={correo} onCambio={setCorreo} error={errores.correo} />
        <CampoTexto etiqueta="Celular" nombre="celular" valorInicial={contacto?.celular ? celularLegible(contacto.celular) : ""} onCambio={setCelular} error={errores.celular} tipo="tel" modoEntrada="tel" autoComplete="tel" />
      </div>
      <div className="fila-campos">
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
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
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etq" style={{ marginBottom: 6 }}>
            Por
          </legend>
          <div className="opciones">
            <label className="opcion">
              <input type="checkbox" checked={recibeCorreo} onChange={(e) => setRecibeCorreo(e.target.checked)} />
              Correo
            </label>
            <label className="opcion">
              <input type="checkbox" checked={recibeWhatsapp} onChange={(e) => setRecibeWhatsapp(e.target.checked)} />
              WhatsApp
            </label>
          </div>
        </fieldset>
      </div>
      {recibeWhatsapp && (
        <label className="casilla" style={{ boxShadow: errores.autorizacion ? "inset 0 0 0 2px var(--peligro)" : undefined }}>
          <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} />
          <span>
            <b>{`${quien} autorizó recibir el informe por WhatsApp`}</b>
            <span style={{ display: "block", color: "var(--sec)", fontSize: 13 }}>
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
