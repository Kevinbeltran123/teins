import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, Casilla, Confirmacion, Insignia, Mail, MessageCircle, RefreshCw, Send, useNotificar } from "@teins/ui";
import { aFechaHora } from "../formato";

type Contacto = Respuesta<"obtenerCliente">["contactos"][number];
type Envio = Respuesta<"obtenerInforme">["versiones"][number]["envios"][number];

/** Quienes reciben ese documento por algún canal: se marcan por omisión al publicar (ADR-0028, ADR-0029). */
export const receptores = (contactos: readonly Contacto[], documento: "informes" | "cotizaciones") =>
  contactos.filter((c) => (documento === "informes" ? c.recibeInformes : c.recibeCotizaciones) && (c.recibeCorreo || c.recibeWhatsapp)).map((c) => c.id);

const canalesDe = (c: Contacto) => [...(c.recibeCorreo ? ["Correo"] : []), ...(c.recibeWhatsapp ? ["WhatsApp"] : [])];

/** "Ana Torres, Jorge Pardo y Marta Gil". */
export function enLista(nombres: readonly string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** "Ana Torres por correo y WhatsApp": a quién salió una copia (enviada o entregada). */
export function copiasEnviadas(envios: readonly Envio[]): string[] {
  const porContacto = new Map<string, Set<string>>();
  for (const e of envios) {
    if (e.estado !== "enviado" && e.estado !== "entregado") continue;
    porContacto.set(e.contacto.nombre, (porContacto.get(e.contacto.nombre) ?? new Set()).add(e.canal === "correo" ? "correo" : "WhatsApp"));
  }
  return [...porContacto].map(([nombre, canales]) => `${nombre} por ${enLista([...canales])}`);
}

/** Elegir a quién se envía: los contactos con un canal; los demás, a la vista pero sin poder marcarse. */
export function Destinatarios({
  contactos,
  elegidos,
  alCambiar,
  cliente: c,
  titulo,
}: {
  contactos: readonly Contacto[];
  elegidos: readonly string[];
  alCambiar: (ids: string[]) => void;
  cliente: { id: string; nombre: string };
  titulo: string;
}) {
  const conCanal = contactos.filter((x) => x.recibeCorreo || x.recibeWhatsapp);
  const enlace = (
    <Link to="/clientes/$id" params={{ id: c.id }} className="font-bold text-superficie underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-superficie">
      {`Agregar contactos a ${c.nombre}`}
    </Link>
  );
  if (conCanal.length === 0) {
    return (
      <Aviso tono="alerta">
        <p>{`Nadie de ${c.nombre} recibe el informe: solo quedará en el portal y habrá que avisarles.`}</p>
        <p className="mt-2">{enlace}</p>
      </Aviso>
    );
  }
  return (
    <fieldset className="flex flex-col">
      <legend className="pb-1 text-cuerpo font-bold">{titulo}</legend>
      <ul className="flex flex-col divide-y divide-division">
        {contactos.map((x) => {
          const canales = canalesDe(x);
          return (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
              <Casilla
                marcada={elegidos.includes(x.id)}
                deshabilitada={canales.length === 0}
                onCambio={(m) => alCambiar(m ? [...elegidos, x.id] : elegidos.filter((id) => id !== x.id))}
              >
                <strong>{x.nombre}</strong>
              </Casilla>
              <span className="flex gap-1.5">
                {canales.length === 0 ? <span className="text-ayuda text-texto-secundario">Sin canal: edítelo en Clientes</span> : canales.map((t) => <Insignia key={t} tono="neutro">{t}</Insignia>)}
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

const ESTADO_ENVIO = {
  en_cola: <Insignia tono="alerta">En cola</Insignia>,
  enviado: <Insignia tono="enviado">Enviado</Insignia>,
  entregado: <Insignia tono="exito">Entregado</Insignia>,
  fallido: <Insignia tono="peligro">No llegó</Insignia>,
} as const;

/** El último intento por contacto y canal: uno que no llegó y se volvió a enviar ya no pide nada. */
function ultimosIntentos(envios: readonly Envio[]): Envio[] {
  const vistos = new Set<string>();
  return envios.filter((e) => {
    const clave = `${e.contacto.id}:${e.canal}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

type Destino = { contactoId: string; canal?: "correo" | "whatsapp" };

interface PropsEnvios {
  /** El cliente del documento: sus contactos y a dónde ir a corregirlos. */
  cliente: { id: string; nombre: string };
  version: { numero: number; pdf: "generando" | "listo" | "fallido"; envios: readonly Envio[] };
  contactos: readonly Contacto[] | undefined;
  enviar: (destinos: Destino[]) => Promise<unknown>;
  recargar: () => void;
}

/**
 * Envíos de una versión (ADR-0028; la cotización, ADR-0029): el estado de cada copia y, junto a lo que no
 * llegó, cómo resolverlo.
 */
export function PanelEnvios({ cliente: c, version, contactos, enviar, recargar }: PropsEnvios) {
  const notificar = useNotificar();
  const [eligiendo, setEligiendo] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const envios = ultimosIntentos(version.envios);
  const sinLlegar = envios.filter((e) => e.estado === "fallido");
  const esperando = envios.some((e) => e.estado === "en_cola");

  async function volverAEnviar(e: Envio) {
    setReenviando(e.id);
    setError(null);
    try {
      await enviar([{ contactoId: e.contacto.id, canal: e.canal }]);
      recargar();
      notificar({ texto: `Envío a ${e.contacto.nombre} en cola` });
    } catch (causa) {
      setError(causa instanceof ErrorApi && causa.codigo === "entrada_invalida" ? `${causa.message}. Revise el contacto en Clientes.` : "No se pudo volver a enviar. Intente de nuevo.");
    } finally {
      setReenviando(null);
    }
  }

  return (
    <section aria-labelledby="titulo-envios" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-envios" className="text-subtitulo font-extrabold">
          {`Envíos de la versión ${version.numero}`}
        </h2>
        {esperando && (
          <p className="text-ayuda text-texto-secundario" aria-live="polite">
            {version.pdf === "fallido" ? "No se generó el PDF: los envíos esperan. Avísele a soporte." : "Salen cuando el PDF esté listo."}
          </p>
        )}
      </div>
      {sinLlegar.length > 0 && (
        <Aviso tono="error">
          <p>
            <strong>{sinLlegar.length === 1 ? "Un envío no llegó." : `${sinLlegar.length} envíos no llegaron.`}</strong>{" "}
            {"Revise el contacto en "}
            <Link to="/clientes/$id" params={{ id: c.id }} className="font-bold underline underline-offset-2">
              Clientes
            </Link>
            {" y vuelva a enviar."}
          </p>
        </Aviso>
      )}
      {envios.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">No se envió a nadie: solo está en el portal.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-division">
          {envios.map((e) => {
            const Icono = e.canal === "correo" ? Mail : MessageCircle;
            return (
              <li key={e.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-texto-secundario">
                    <Icono aria-hidden="true" />
                    <strong className="truncate">{e.contacto.nombre}</strong>
                    <span className="text-ayuda text-texto-secundario">{e.canal === "correo" ? "Correo" : "WhatsApp"}</span>
                  </span>
                  {ESTADO_ENVIO[e.estado]}
                </div>
                {e.estado === "fallido" ? (
                  <>
                    <p className="pl-6 text-ayuda text-texto-secundario">{e.error}</p>
                    <Boton variante="fantasma" tamano="pequeno" icono={RefreshCw} className="ml-4 self-start" cargando={reenviando === e.id} onClick={() => void volverAEnviar(e)}>
                      Volver a enviar
                    </Boton>
                  </>
                ) : e.enviadoEn ? (
                  <p className="pl-6 text-ayuda text-texto-secundario">
                    {aFechaHora(e.enviadoEn)}
                    {e.estado === "enviado" && (e.canal === "whatsapp" ? " · Meta no ha confirmado la entrega" : " · El servidor del cliente no ha confirmado la entrega")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      <Boton variante="fantasma" tamano="pequeno" icono={Send} className="self-start" disabled={!contactos} onClick={() => setEligiendo(true)}>
        {envios.length === 0 ? "Enviar a un contacto" : "Enviar a otro contacto"}
      </Boton>
      {eligiendo && contactos && <EnviarAContactos cliente={c} numero={version.numero} contactos={contactos} enviar={enviar} alCerrar={() => setEligiendo(false)} alEnviar={recargar} />}
    </section>
  );
}

function EnviarAContactos({
  cliente: c,
  numero,
  contactos,
  enviar,
  alCerrar,
  alEnviar,
}: {
  cliente: { id: string; nombre: string };
  numero: number;
  contactos: readonly Contacto[];
  enviar: (destinos: Destino[]) => Promise<unknown>;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const notificar = useNotificar();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const nombres = contactos.filter((c) => elegidos.includes(c.id)).map((c) => c.nombre);
  return (
    <Confirmacion
      titulo={`Enviar la versión ${numero} a otro contacto`}
      confirmar={nombres.length === 1 ? `Enviar a ${nombres[0]}` : nombres.length > 1 ? `Enviar a ${nombres.length}` : "Enviar"}
      validar={() => (elegidos.length === 0 ? "Marque a quién enviarla." : null)}
      mensajeDeError={(e) => (e instanceof ErrorApi && e.codigo === "estado_invalido" ? e.message : e instanceof ErrorApi && e.codigo === "entrada_invalida" ? e.message : "No se pudo enviar. Intente de nuevo.")}
      alCerrar={alCerrar}
      alTerminar={() => notificar({ texto: nombres.length === 1 ? `Envío a ${nombres[0]} en cola` : `${nombres.length} envíos en cola` })}
      accion={async () => {
        await enviar(elegidos.map((contactoId) => ({ contactoId })));
        alEnviar();
      }}
    >
      <p>{`Con el PDF adjunto, por los canales de cada contacto. Solo aparecen los contactos de ${c.nombre}; para uno nuevo, créelo primero en Clientes.`}</p>
      <Destinatarios contactos={contactos} elegidos={elegidos} alCambiar={setElegidos} cliente={c} titulo="A quién" />
    </Confirmacion>
  );
}
