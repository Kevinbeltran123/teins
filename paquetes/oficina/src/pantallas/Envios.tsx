import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, Confirmacion, Insignia, Mail, MessageCircle, RefreshCw, Send, useNotificar } from "@teins/ui";
import { aFechaCorta } from "../formato";

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
    <Link to="/clientes/$id" params={{ id: c.id }} className="migas">
      {`Agregar contactos a ${c.nombre}`}
    </Link>
  );
  if (conCanal.length === 0) {
    return (
      <Aviso tono="alerta">
        <span>{`Nadie de ${c.nombre} recibe el informe: solo quedará en el portal y habrá que avisarles.`}</span>
        {enlace}
      </Aviso>
    );
  }
  return (
    <fieldset className="col" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
      <legend className="etq" style={{ marginBottom: 8 }}>
        {titulo}
      </legend>
      {contactos.map((x) => {
        const canales = canalesDe(x);
        return (
          <label key={x.id} className={`casilla ${canales.length === 0 ? "apagada" : ""}`}>
            <input
              type="checkbox"
              checked={elegidos.includes(x.id)}
              disabled={canales.length === 0}
              onChange={(e) => alCambiar(e.target.checked ? [...elegidos, x.id] : elegidos.filter((id) => id !== x.id))}
            />
            <span>
              <b>{x.nombre}</b>{" "}
              <span className="fila-flex" style={{ display: "inline-flex", gap: 4 }}>
                {canales.length === 0 ? (
                  <span className="sec" style={{ fontSize: 13 }}>
                    Sin canal: edítelo en Clientes
                  </span>
                ) : (
                  canales.map((t) => (
                    <span key={t} className="ins canal">
                      {t}
                    </span>
                  ))
                )}
              </span>
            </span>
          </label>
        );
      })}
      {enlace}
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
  /** Acciones de la versión que van junto a "Enviar a otro contacto" (retirar del portal). */
  acciones?: ReactNode;
}

/**
 * Envíos de una versión (ADR-0028; la cotización, ADR-0029), dentro de su versión en el carril (prototipos/oficina):
 * el estado de cada copia y, junto a lo que no llegó, cómo resolverlo.
 */
export function PanelEnvios({ cliente: c, version, contactos, enviar, recargar, acciones }: PropsEnvios) {
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
    <section aria-label={`Envíos de la versión ${version.numero}`} className="col" style={{ gap: 6 }}>
      {esperando && (
        <span className="meta" aria-live="polite">
          {version.pdf === "fallido" ? "No se generó el PDF: los envíos esperan. Avísele a soporte." : "Salen cuando el PDF esté listo."}
        </span>
      )}
      {sinLlegar.length > 0 && (
        <Aviso tono="error">
          <span>
            <b>{sinLlegar.length === 1 ? "Un envío no llegó." : `${sinLlegar.length} envíos no llegaron.`}</b> Revise el contacto en{" "}
            <Link to="/clientes/$id" params={{ id: c.id }} className="ir-dato">
              Clientes
            </Link>{" "}
            y vuelva a enviar.
          </span>
        </Aviso>
      )}
      {envios.length === 0 ? (
        <span className="meta">No se envió a nadie: solo está en el portal.</span>
      ) : (
        <ul className="envios-v" style={{ listStyle: "none", margin: "6px 0 0" }}>
          {envios.map((e) => {
            const Icono = e.canal === "correo" ? Mail : MessageCircle;
            return (
              <li key={e.id} className="env">
                <Icono aria-hidden size={15} />
                <span>
                  {e.contacto.nombre} <span className="sr-only">por {e.canal === "correo" ? "Correo" : "WhatsApp"}</span>
                </span>
                {ESTADO_ENVIO[e.estado]}
                {e.estado === "fallido" ? (
                  <span className="det mal">
                    {e.error}
                    <Boton tamano="pequeno" icono={RefreshCw} cargando={reenviando === e.id} onClick={() => void volverAEnviar(e)}>
                      Volver a enviar
                    </Boton>
                  </span>
                ) : e.enviadoEn ? (
                  <span className="det">
                    {e.canal === "correo" ? "Correo" : "WhatsApp"} · {aFechaCorta(e.enviadoEn)}
                    {e.estado === "enviado" && (e.canal === "whatsapp" ? " · Meta no ha confirmado la entrega" : " · El servidor del cliente no ha confirmado la entrega")}
                  </span>
                ) : (
                  <span className="det">{e.canal === "correo" ? "Correo" : "WhatsApp"}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="fila-flex" style={{ gap: 4 }}>
        <Boton variante="fantasma" tamano="pequeno" icono={Send} disabled={!contactos} onClick={() => setEligiendo(true)}>
          {envios.length === 0 ? "Enviar a un contacto" : "Enviar a otro contacto"}
        </Boton>
        {acciones}
      </div>
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
