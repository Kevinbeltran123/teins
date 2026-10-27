import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { MensajeDeEnvio, TextoPropio } from "@teins/documentos";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, Dialogo, Insignia, Mail, MessageCircle, RefreshCw, Send, useNotificar } from "@teins/ui";
import { usePlantillas, type Plantillas } from "../documentos";
import { aFechaCorta, enLista } from "../formato";
import { textoDelServidor } from "../mensajes";
import { Lienzo, VistaDeCorreo, VistaDeWhatsapp, type EdicionDeCorreo } from "./Lienzo";

type Contacto = Respuesta<"obtenerCliente">["contactos"][number];
type Envio = Respuesta<"obtenerInforme">["versiones"][number]["envios"][number];

/**
 * Quienes reciben ese documento por algún canal: se marcan por omisión al publicar (ADR-0028, ADR-0029). De un cliente
 * archivado, nadie: no recibe envíos (ADR-0035), y con destinatarios el servidor no publicaría.
 */
export const receptores = (cliente: Pick<Respuesta<"obtenerCliente">, "archivado" | "contactos">, documento: "informes" | "cotizaciones") =>
  cliente.archivado ? [] : cliente.contactos.filter((c) => (documento === "informes" ? c.recibeInformes : c.recibeCotizaciones) && (c.recibeCorreo || c.recibeWhatsapp)).map((c) => c.id);

/** En vez de elegir a quién enviar: el cliente está archivado, se publica sin enviar y se dice cómo enviarla después. */
export function ClienteArchivado({ cliente: c }: { cliente: { id: string; nombre: string } }) {
  return (
    <Aviso tono="alerta">
      <span>{`${c.nombre} está archivado: sus contactos no reciben envíos y se publica sin enviar. Para enviarla, recupere el cliente y use «Enviar a un contacto» en la versión publicada.`}</span>
      <Link to="/clientes/$id" params={{ id: c.id }} className="migas">
        {`Ir a ${c.nombre}`}
      </Link>
    </Aviso>
  );
}

const canalesDe = (c: Contacto) => [...(c.recibeCorreo ? ["Correo"] : []), ...(c.recibeWhatsapp ? ["WhatsApp"] : [])];

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
        <span>{`Nadie de ${c.nombre} tiene correo ni WhatsApp para recibirlo: agregue uno en Clientes.`}</span>
        {enlace}
      </Aviso>
    );
  }
  return (
    <fieldset className="col" style={{ gap: 8 }}>
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
                  <span className="sec text-ayuda">
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
  cancelado: <Insignia tono="neutro">Cancelado</Insignia>,
} as const;

/**
 * Por qué un envío cancelado no sale: quién lo canceló o, si se retiró su versión, el motivo y quién la retiró
 * (ADR-0047). Es una decisión de oficina, no un fallo de entrega.
 */
export function detalleDelCancelado(e: Pick<Envio, "canal" | "error" | "cancelado">): string {
  const quien = e.cancelado ? ` por ${e.cancelado.por.nombre} ${aFechaCorta(e.cancelado.en)}` : "";
  return `${e.canal === "correo" ? "Correo" : "WhatsApp"} · ${e.error ?? "cancelado"}${quien}: no sale`;
}

/**
 * Cancelar un envío en cola (ADR-0034): no pide confirmar, porque mientras siga en cola "Deshacer" lo devuelve. Si ya
 * salió, el servidor lo dice y queda a la vista: lo enviado no se recupera. Lo usan la lista de envíos y el avance de
 * publicar.
 */
export function useCancelarEnvio(
  corregirEnvio: ((envioId: string, accion: "cancelar" | "reanudar") => Promise<unknown>) | undefined,
  recargar: () => void,
  setError: (texto: string | null) => void,
) {
  const notificar = useNotificar();
  return async (e: Pick<Envio, "id" | "contacto">) => {
    if (!corregirEnvio) return;
    setError(null);
    try {
      await corregirEnvio(e.id, "cancelar");
      recargar();
      // Una sola vez: reanudar dos veces fallaría la segunda («no estaba cancelado») y diría que no se pudo deshacer.
      let deshecho = false;
      notificar({
        texto: `Envío a ${e.contacto.nombre} cancelado`,
        accion: {
          texto: "Deshacer",
          alHacer: () => {
            if (deshecho) return;
            deshecho = true;
            void corregirEnvio(e.id, "reanudar")
              .then(recargar)
              .catch(() => setError(`No se pudo deshacer: el envío a ${e.contacto.nombre} sigue cancelado.`));
          },
        },
      });
    } catch (causa) {
      recargar();
      setError(causa instanceof ErrorApi && causa.codigo === "estado_invalido" ? `El envío a ${e.contacto.nombre} ya salió: lo enviado no se recupera.` : "No se pudo cancelar el envío. Intente de nuevo.");
    }
  };
}

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
  /**
   * `llave`: la decisión de enviar (regla 4). El mismo pedido repetido con su llave sale una sola vez. `mensaje`: el
   * asunto y el texto que escribió oficina para el correo (ADR-0036); sin él, sale el de TEINS.
   */
  enviar: (destinos: Destino[], llave: string, mensaje?: TextoPropio) => Promise<unknown>;
  recargar: () => void;
  /** Acciones de la versión que van junto a "Enviar a otro contacto" (retirar del portal). */
  acciones?: ReactNode;
  /** Cancelar un envío que espera en cola, o deshacerlo (ADR-0034). Sin esto, no se ofrece. */
  corregirEnvio?: ((envioId: string, accion: "cancelar" | "reanudar") => Promise<unknown>) | undefined;
}

/**
 * Envíos de una versión (ADR-0028; la cotización, ADR-0029), dentro de su versión en el carril (prototipos/oficina):
 * el estado de cada copia y, junto a lo que no llegó, cómo resolverlo.
 */
export function PanelEnvios({ cliente: c, version, contactos, mensaje, enviar, recargar, acciones, corregirEnvio }: PropsEnvios) {
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
  const yaLaTiene = (contactoId: string, canal: Envio["canal"]) =>
    version.envios.some((e) => e.contacto.id === contactoId && e.canal === canal && (e.estado === "en_cola" || e.estado === "enviado" || e.estado === "entregado"));

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

  const cancelar = useCancelarEnvio(corregirEnvio, recargar, setError);

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
              <li key={e.id} className={`env ${e.estado === "cancelado" ? "cancelado" : ""}`}>
                <Icono aria-hidden size={15} />
                <span>
                  {e.contacto.nombre} <span className="sr-only">por {e.canal === "correo" ? "Correo" : "WhatsApp"}</span>
                </span>
                <span className="fila-flex" style={{ gap: 6, flexWrap: "nowrap" }}>
                  {ESTADO_ENVIO[e.estado]}
                  {e.estado === "en_cola" && corregirEnvio && (
                    <button type="button" className="accion-envio" onClick={() => void cancelar(e)} aria-label={`Cancelar el envío a ${e.contacto.nombre} por ${e.canal === "correo" ? "correo" : "WhatsApp"}`}>
                      Cancelar
                    </button>
                  )}
                </span>
                {e.estado === "cancelado" ? (
                  <span className="det">{detalleDelCancelado(e)}</span>
                ) : e.estado === "fallido" ? (
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
                    {e.personalizado && " · con su texto"}
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
      {eligiendo && contactos && (
        <EnviarAContactos
          cliente={c}
          numero={version.numero}
          // A otro contacto: el canal por el que ya la tiene (o la tiene en camino) no se vuelve a ofrecer (iteración 29); el otro sí.
          contactos={contactos
            .map((x) => ({ ...x, recibeCorreo: x.recibeCorreo && !yaLaTiene(x.id, "correo"), recibeWhatsapp: x.recibeWhatsapp && !yaLaTiene(x.id, "whatsapp") }))
            .filter((x) => !version.envios.some((e) => e.contacto.id === x.id) || x.recibeCorreo || x.recibeWhatsapp)}
          mensaje={mensaje}
          enviar={enviar}
          alCerrar={() => setEligiendo(false)}
          alEnviar={recargar}
        />
      )}
    </section>
  );
}

type DestinoVisto = { contacto: Contacto; canal: "correo" | "whatsapp" };

const LLAVE_VER_COMO_LLEGA = "teins-ver-como-llega";
/** "Ver cómo llega" se recuerda en este equipo (iteración 29); sin almacenamiento, empieza apagado. */
function useVerComoLlega(): [boolean, (v: boolean) => void] {
  const [ver, setVer] = useState(() => {
    try {
      return localStorage.getItem(LLAVE_VER_COMO_LLEGA) === "1";
    } catch {
      return false;
    }
  });
  return [
    ver,
    (v) => {
      setVer(v);
      try {
        localStorage.setItem(LLAVE_VER_COMO_LLEGA, v ? "1" : "0");
      } catch {
        // Sin almacenamiento, vale solo mientras el diálogo esté abierto.
      }
    },
  ];
}

/**
 * Enviar una versión a otros contactos (iteración 29, prototipos/ajustes-oficina): un diálogo centrado con los
 * contactos que todavía no la recibieron. Lo que recibe cada uno se ve a voluntad ("Ver cómo llega"), al lado. El
 * diálogo ya es el paso deliberado: dice antes del botón que lo enviado no se recupera (DESIGN.md).
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
  enviar: (destinos: Destino[], llave: string, mensaje?: TextoPropio) => Promise<unknown>;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const notificar = useNotificar();
  // El texto del correo: null es el de TEINS. Es el mismo en el formulario y en "Ver cómo llega" (ADR-0036).
  const [propio, setPropio] = useState<TextoPropio | null>(null);
  const edicion: EdicionDeCorreo = { propio, alCambiar: setPropio };
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [viendo, setViendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verComoLlega, setVerComoLlega] = useVerComoLlega();
  // Reintentar a los mismos es el mismo pedido; cambiar a quién es otra decisión.
  const llave = useMemo(() => crypto.randomUUID(), [elegidos.join()]);
  const nombres = contactos.filter((x) => elegidos.includes(x.id)).map((x) => x.nombre);
  const destinos: DestinoVisto[] = contactos
    .filter((x) => elegidos.includes(x.id))
    .flatMap((x) => [...(x.recibeCorreo && x.correo ? [{ contacto: x, canal: "correo" as const }] : []), ...(x.recibeWhatsapp && x.celular ? [{ contacto: x, canal: "whatsapp" as const }] : [])]);
  const clave = (d: DestinoVisto) => `${d.contacto.id}:${d.canal}`;
  const actual = destinos.find((d) => clave(d) === viendo) ?? destinos[0];
  const conCanal = contactos.filter((x) => x.recibeCorreo || x.recibeWhatsapp);

  async function enviarYa() {
    if (elegidos.length === 0) return setError("Marque a quién enviarla.");
    setOcupado(true);
    setError(null);
    try {
      await enviar(
        destinos.map((d) => ({ contactoId: d.contacto.id, canal: d.canal })),
        llave,
        propio ?? undefined,
      );
      alEnviar();
      alCerrar();
      notificar({ texto: nombres.length === 1 ? `Envío a ${nombres[0]} en cola` : `${nombres.length} envíos en cola` });
    } catch (e) {
      setError(e instanceof ErrorApi && e.codigo === "estado_invalido" ? e.message : e instanceof ErrorApi && e.codigo === "entrada_invalida" ? textoDelServidor(e, "Revise los datos.") : "No se pudo enviar. Intente de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  const aQuien =
    contactos.length === 0 ? (
      <div className="vacio-o">
        <b>Todos los contactos ya la recibieron</b>
        <span>{`Agregue un contacto a ${c.nombre} para enviarle esta versión.`}</span>
        <Link to="/clientes/$id" params={{ id: c.id }} className="migas">
          {`Contactos de ${c.nombre}`}
        </Link>
      </div>
    ) : (
      <Destinatarios contactos={contactos} elegidos={elegidos} alCambiar={setElegidos} cliente={c} titulo="A quién" />
    );

  const vista = (
    <Lienzo
      nota="Así le llega"
      cabecera={
        destinos.length > 1 && (
          <div className="pestanas" role="tablist" aria-label="Lo que recibe">
            {destinos.map((d) => {
              const Icono = d.canal === "correo" ? Mail : MessageCircle;
              return (
                <button key={clave(d)} type="button" role="tab" aria-selected={actual !== undefined && clave(d) === clave(actual)} onClick={() => setViendo(clave(d))}>
                  <Icono aria-hidden size={14} strokeWidth={1.6} />
                  {`${d.contacto.nombre.split(" ")[0]} · ${d.canal === "correo" ? "Correo" : "WhatsApp"}`}
                </button>
              );
            })}
          </div>
        )
      }
    >
      {actual ? (
        actual.canal === "correo" ? (
          <VistaDeCorreo key={clave(actual)} mensaje={mensaje} contacto={actual.contacto} edicion={edicion} />
        ) : (
          <VistaDeWhatsapp mensaje={mensaje} contacto={actual.contacto} />
        )
      ) : (
        <div className="lienzo-vacio">
          <b>Elija a quién enviar</b>
          <p>Aquí aparece lo que recibe, con el adjunto.</p>
        </div>
      )}
    </Lienzo>
  );

  return (
    <Dialogo
      forma="formulario"
      ancho={verComoLlega ? "previa" : "ancho"}
      titulo={`Enviar la versión ${numero} a otro contacto`}
      subtitulo={c.nombre}
      cerrable={!ocupado}
      alCerrar={alCerrar}
      cabeceraExtra={
        <button type="button" role="switch" aria-checked={verComoLlega} className="interruptor" onClick={() => setVerComoLlega(!verComoLlega)}>
          <i aria-hidden />
          Ver cómo llega
        </button>
      }
      pie={
        <>
          <span className="nota-capa mr-auto">Lo enviado no se puede recuperar.</span>
          <Boton disabled={ocupado} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="principal" icono={Send} cargando={ocupado} disabled={conCanal.length === 0} onClick={() => void enviarYa()}>
            {nombres.length === 1 ? `Enviar a ${nombres[0]!.split(" ")[0]}` : nombres.length > 1 ? `Enviar a ${nombres.length}` : "Enviar"}
          </Boton>
        </>
      }
    >
      {verComoLlega ? (
        <div className="dos-col">
          <div className="col-f">
            {aQuien}
            {destinos.some((d) => d.canal === "whatsapp") && <p className="nota-capa">Por WhatsApp va la plantilla aprobada por Meta: ese mensaje no se edita.</p>}
          </div>
          {vista}
        </div>
      ) : (
        <>
          {aQuien}
          {destinos.some((d) => d.canal === "correo") && <MensajeEnFormulario mensaje={mensaje} edicion={edicion} nombre={destinos.filter((d) => d.canal === "correo").length > 1 ? "[nombre de cada uno]" : destinos.find((d) => d.canal === "correo")!.contacto.nombre} whatsapp={destinos.some((d) => d.canal === "whatsapp")} />}
        </>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Dialogo>
  );
}

/**
 * El asunto y el texto del correo en el formulario, cuando "Ver cómo llega" está apagado (ADR-0036). El saludo, el
 * adjunto y el pie los pone la plantilla.
 */
function MensajeEnFormulario({ mensaje: armar, edicion, nombre, whatsapp }: { mensaje: (p: Plantillas) => MensajeDeEnvio; edicion: EdicionDeCorreo; nombre: string; whatsapp: boolean }) {
  const { plantillas } = usePlantillas();
  if (!plantillas) return null;
  const m = armar(plantillas);
  const base: TextoPropio = { asunto: plantillas.asuntoBase(m), texto: plantillas.textoBase(m) };
  const actual = edicion.propio ?? base;
  const cambiar = (p: TextoPropio) => edicion.alCambiar(p.asunto === base.asunto && p.texto === base.texto ? null : p);
  return (
    <div className="campo">
      <span className="etq fila-flex" style={{ justifyContent: "space-between" }}>
        <span>Mensaje{edicion.propio && <span className="sec"> · con su texto</span>}</span>
        {edicion.propio && (
          <button type="button" className="enlace-acc" onClick={() => edicion.alCambiar(null)}>
            Volver al texto de TEINS
          </button>
        )}
      </span>
      <div className="mensaje-c">
        <label className="asunto">
          <span>Asunto</span>
          <input value={actual.asunto} onChange={(e) => cambiar({ ...actual, asunto: e.target.value })} />
        </label>
        <div className="saludo" aria-hidden>{`Hola, ${nombre.split(" ")[0]}:`}</div>
        <textarea aria-label="Texto del correo" value={actual.texto} rows={Math.max(4, actual.texto.split("\n").length + 1)} onChange={(e) => cambiar({ ...actual, texto: e.target.value })} />
        <div className="fijo">El saludo lleva el nombre de cada uno. Se agregan solos: el PDF adjunto y el pie de TEINS.</div>
      </div>
      {whatsapp && <p className="nota-capa">Por WhatsApp va la plantilla aprobada por Meta: ese mensaje no se edita.</p>}
    </div>
  );
}
