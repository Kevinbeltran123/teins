import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { MensajeDeEnvio } from "@teins/documentos";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, Dialogo, Insignia, Mail, MessageCircle, RefreshCw, Send, useNotificar } from "@teins/ui";
import type { Plantillas } from "../documentos";
import { aFechaCorta } from "../formato";
import { textoDelServidor } from "../mensajes";
import { Lienzo, VistaDeCorreo, VistaDeWhatsapp } from "./Lienzo";

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
  /** Lo que dice el correo o el WhatsApp de esta versión, para ver lo que recibe cada contacto antes de enviar. */
  mensaje: (p: Plantillas) => MensajeDeEnvio;
  /** `llave`: la decisión de enviar (regla 4). El mismo pedido repetido con su llave sale una sola vez. */
  enviar: (destinos: Destino[], llave: string) => Promise<unknown>;
  recargar: () => void;
  /** Acciones de la versión que van junto a "Enviar a otro contacto" (retirar del portal). */
  acciones?: ReactNode;
}

/**
 * Envíos de una versión (ADR-0028; la cotización, ADR-0029), dentro de su versión en el carril (prototipos/oficina):
 * el estado de cada copia y, junto a lo que no llegó, cómo resolverlo.
 */
export function PanelEnvios({ cliente: c, version, contactos, mensaje, enviar, recargar, acciones }: PropsEnvios) {
  const notificar = useNotificar();
  const [eligiendo, setEligiendo] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Una llave por envío que se vuelve a enviar: reintentar después de un error no manda dos copias.
  const llaves = useRef(new Map<string, string>());
  const envios = ultimosIntentos(version.envios);
  const sinLlegar = envios.filter((e) => e.estado === "fallido");
  const esperando = envios.some((e) => e.estado === "en_cola");
  // Sin PDF no hay qué enviar: la versión lo dice arriba y el servidor no lo acepta. Se publica una nueva.
  const sePuedeEnviar = version.pdf !== "fallido";

  async function volverAEnviar(e: Envio) {
    setReenviando(e.id);
    setError(null);
    try {
      const llave = llaves.current.get(e.id) ?? crypto.randomUUID();
      llaves.current.set(e.id, llave);
      await enviar([{ contactoId: e.contacto.id, canal: e.canal }], llave);
      recargar();
      notificar({ texto: `Envío a ${e.contacto.nombre} en cola` });
    } catch (causa) {
      setError(causa instanceof ErrorApi && causa.codigo === "entrada_invalida" ? `${textoDelServidor(causa, "Un dato no sirve")}. Revise el contacto en Clientes.` : "No se pudo volver a enviar. Intente de nuevo.");
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
      {sinLlegar.length > 0 && sePuedeEnviar && (
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
        sePuedeEnviar && <span className="meta">No se envió a nadie: solo está en el portal.</span>
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
                    {sePuedeEnviar && (
                      <Boton tamano="pequeno" icono={RefreshCw} cargando={reenviando === e.id} onClick={() => void volverAEnviar(e)}>
                        Volver a enviar
                      </Boton>
                    )}
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
        {sePuedeEnviar && (
          <Boton variante="fantasma" tamano="pequeno" icono={Send} disabled={!contactos} onClick={() => setEligiendo(true)}>
            {envios.length === 0 ? "Enviar a un contacto" : "Enviar a otro contacto"}
          </Boton>
        )}
        {acciones}
      </div>
      {eligiendo && contactos && <EnviarAContactos cliente={c} numero={version.numero} contactos={contactos} mensaje={mensaje} enviar={enviar} alCerrar={() => setEligiendo(false)} alEnviar={recargar} />}
    </section>
  );
}

type DestinoVisto = { contacto: Contacto; canal: "correo" | "whatsapp" };

/**
 * Enviar una versión a otros contactos, en una hoja lateral ancha (iteración 26): a quién y, debajo, lo que recibe
 * cada uno por cada canal, tal como sale. La hoja ya es el paso deliberado: dice antes del botón que lo enviado no
 * se recupera (DESIGN.md), sin un segundo diálogo.
 */
function EnviarAContactos({
  cliente: c,
  numero,
  contactos,
  mensaje,
  enviar,
  alCerrar,
  alEnviar,
}: {
  cliente: { id: string; nombre: string };
  numero: number;
  contactos: readonly Contacto[];
  mensaje: (p: Plantillas) => MensajeDeEnvio;
  enviar: (destinos: Destino[], llave: string) => Promise<unknown>;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const notificar = useNotificar();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [viendo, setViendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reintentar a los mismos es el mismo pedido; cambiar a quién es otra decisión.
  const llave = useMemo(() => crypto.randomUUID(), [elegidos.join()]);
  const nombres = contactos.filter((x) => elegidos.includes(x.id)).map((x) => x.nombre);
  const destinos: DestinoVisto[] = contactos
    .filter((x) => elegidos.includes(x.id))
    .flatMap((x) => [...(x.recibeCorreo && x.correo ? [{ contacto: x, canal: "correo" as const }] : []), ...(x.recibeWhatsapp && x.celular ? [{ contacto: x, canal: "whatsapp" as const }] : [])]);
  const clave = (d: DestinoVisto) => `${d.contacto.id}:${d.canal}`;
  const actual = destinos.find((d) => clave(d) === viendo) ?? destinos[0];

  async function enviarYa() {
    if (elegidos.length === 0) return setError("Marque a quién enviarla.");
    setOcupado(true);
    setError(null);
    try {
      await enviar(elegidos.map((contactoId) => ({ contactoId })), llave);
      alEnviar();
      alCerrar();
      notificar({ texto: nombres.length === 1 ? `Envío a ${nombres[0]} en cola` : `${nombres.length} envíos en cola` });
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "estado_invalido" ? e.message : e instanceof ErrorApi && e.codigo === "entrada_invalida" ? textoDelServidor(e, "Revise los datos.") : "No se pudo enviar. Intente de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialogo
      forma="lateral"
      amplio
      titulo={`Enviar la versión ${numero} a otro contacto`}
      subtitulo={c.nombre}
      cerrable={!ocupado}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton disabled={ocupado} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="principal" icono={Send} cargando={ocupado} onClick={() => void enviarYa()}>
            {nombres.length === 1 ? `Enviar a ${nombres[0]}` : nombres.length > 1 ? `Enviar a ${nombres.length}` : "Enviar"}
          </Boton>
        </>
      }
    >
      <Destinatarios contactos={contactos} elegidos={elegidos} alCambiar={setElegidos} cliente={c} titulo="A quién" />
      <Lienzo
        nota="Lo que recibe, tal como sale"
        cabecera={
          destinos.length > 0 && (
            <div className="pestanas" role="tablist" aria-label="Lo que recibe">
              {destinos.map((d) => {
                const Icono = d.canal === "correo" ? Mail : MessageCircle;
                return (
                  <button key={clave(d)} type="button" role="tab" aria-selected={actual !== undefined && clave(d) === clave(actual)} onClick={() => setViendo(clave(d))}>
                    <Icono aria-hidden size={14} strokeWidth={1.6} />
                    {`${d.contacto.nombre} · ${d.canal === "correo" ? "Correo" : "WhatsApp"}`}
                  </button>
                );
              })}
            </div>
          )
        }
      >
        {actual ? (
          actual.canal === "correo" ? (
            <VistaDeCorreo key={clave(actual)} mensaje={mensaje} contacto={actual.contacto} />
          ) : (
            <VistaDeWhatsapp mensaje={mensaje} contacto={actual.contacto} />
          )
        ) : (
          <div className="lienzo-vacio">
            <b>Elija a quién enviar</b>
            <p>Aquí aparece lo que recibe cada uno, con el adjunto.</p>
          </div>
        )}
      </Lienzo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <p className="ayuda">{`Va con el PDF adjunto, por los canales de cada contacto. Lo enviado no se puede recuperar: retirar la versión no borra el correo ni el WhatsApp.`}</p>
    </Dialogo>
  );
}
