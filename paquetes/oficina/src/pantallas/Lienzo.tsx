import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { MensajeDeEnvio } from "@teins/documentos";
import type { Respuesta } from "@teins/protocolo";
import { Boton, CircleAlert, FileText, HojaEnVivo, Mail, Paperclip, RefreshCw, WifiOff, type AnclaDeHoja } from "@teins/ui";
import { consultas } from "../api";
import { useConexion } from "../conexion";
import { usePlantillas, type Plantillas } from "../documentos";

/*
  El lienzo de la vista en vivo (ADR-0031, prototipos/vista-en-vivo): a la derecha del editor, la hoja que recibe el
  cliente o el correo que le llega, sobre un fondo hundido, con la advertencia de que es aproximada.
*/

type Contacto = Respuesta<"obtenerCliente">["contactos"][number];

export const NOTA_APROXIMADA = "Vista previa: el PDF puede partir las páginas distinto";

export function Lienzo({ cabecera, nota = NOTA_APROXIMADA, sinConexion = "", clase = "", children }: { cabecera: ReactNode; nota?: string; sinConexion?: string; clase?: string; children: ReactNode }) {
  const enLinea = useConexion();
  return (
    <section className={`lienzo ${clase}`} aria-label="Vista previa">
      <div className="lienzo-cab">
        {cabecera}
        <span className="nota-l">{nota}</span>
      </div>
      {!enLinea && (
        <p className="franja-lienzo" role="status">
          <WifiOff aria-hidden size={14} />
          {`Sin conexión: la vista sigue al día porque se dibuja en este equipo. ${sinConexion}Guardar espera a la conexión.`}
        </p>
      )}
      {children}
    </section>
  );
}

export type QueSeVe = "documento" | "correo";

/** Qué se ve en el lienzo: el documento o el correo que lo acompaña. */
export function PestanasDeVista({ documento, vista, alCambiar }: { documento: string; vista: QueSeVe; alCambiar: (v: QueSeVe) => void }) {
  const boton = (valor: QueSeVe, texto: string, Icono: typeof FileText) => (
    <button type="button" role="tab" aria-selected={vista === valor} onClick={() => alCambiar(valor)}>
      <Icono aria-hidden size={14} strokeWidth={1.6} />
      {texto}
    </button>
  );
  return (
    <div className="pestanas" role="tablist" aria-label="Qué se ve">
      {boton("documento", documento, FileText)}
      {boton("correo", "Correo", Mail)}
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="esqueleto-hoja" role="status" aria-label="Preparando la vista previa">
      {[70, 40, 0, 100, 100, 92, 100, 60, 0, 100, 100, 84].map((ancho, i) => (
        <i key={i} className={ancho ? "" : "hueco"} style={{ width: `${ancho || 100}%` }} />
      ))}
    </div>
  );
}

function SinVista({ reintentar }: { reintentar: () => void }) {
  return (
    <div className="lienzo-vacio" role="alert">
      <CircleAlert aria-hidden size={18} />
      <b>No se pudo mostrar la vista previa</b>
      <p>Su trabajo no se afecta: puede seguir escribiendo, guardar y publicar. El PDF se genera igual al publicar.</p>
      <Boton tamano="pequeno" icono={RefreshCw} onClick={reintentar}>
        Volver a intentar
      </Boton>
    </div>
  );
}

/** Con las plantillas cargadas, lo que dibuja; si fallan al cargar o al dibujar, lo dice sin tocar el trabajo. */
function ConPlantillas({ children }: { children: (p: Plantillas) => ReactNode }) {
  const { plantillas, fallo, reintentar } = usePlantillas();
  if (fallo) return <SinVista reintentar={reintentar} />;
  if (!plantillas) return <Esqueleto />;
  try {
    return children(plantillas);
  } catch {
    return <SinVista reintentar={reintentar} />;
  }
}

/** La hoja de un documento (informe o cotización), con la plantilla del PDF. */
export function VistaDeDocumento({
  titulo,
  generar,
  ancho = 816,
  alPintar,
  ancla,
}: {
  titulo: string;
  generar: (p: Plantillas) => string;
  ancho?: number;
  alPintar?: ((documento: Document) => void) | undefined;
  ancla?: AnclaDeHoja | null | undefined;
}) {
  return <ConPlantillas>{(p) => <HojaEnVivo html={generar(p)} ancho={ancho} titulo={titulo} alPintar={alPintar} ancla={ancla} />}</ConPlantillas>;
}

/** El correo que recibe un contacto, tal como sale: quién, el asunto, el adjunto y el mensaje. */
export function VistaDeCorreo({ mensaje: armar, contacto }: { mensaje: (p: Plantillas) => MensajeDeEnvio; contacto: Contacto }) {
  // El portal del entorno, como lo pone el servidor: solo el correo del informe lo lleva, y sin él no hay botón.
  const portal = useQuery(consultas.sesion()).data?.organizacion.portal ?? undefined;
  return (
    <ConPlantillas>
      {(p) => {
        const mensaje = armar(p);
        return (
        <>
          <div className="correo-meta">
            <span>Para</span>
            <b>{`${contacto.nombre} <${contacto.correo ?? "[correo]"}>`}</b>
            <span>Asunto</span>
            <b>{p.asunto(mensaje)}</b>
            <span>Adjunto</span>
            <span className="adjunto">
              <Paperclip aria-hidden size={13} strokeWidth={1.6} />
              {mensaje.nombreArchivo}
            </span>
          </div>
          <div className="correo-m">
            <HojaEnVivo html={p.htmlDeCorreo(mensaje, { nombre: contacto.nombre, portal: mensaje.documento === "cotizacion" ? undefined : portal, sinAdjunto: false })} ancho={640} titulo={`Correo a ${contacto.nombre}`} estilosEnLinea />
          </div>
        </>
        );
      }}
    </ConPlantillas>
  );
}

/** El WhatsApp: la plantilla registrada en Meta, con sus variables puestas y resaltadas. */
export function VistaDeWhatsapp({ mensaje: armar, contacto }: { mensaje: (p: Plantillas) => MensajeDeEnvio; contacto: Contacto }) {
  return (
    <ConPlantillas>
      {(p) => {
        const mensaje = armar(p);
        const { texto, boton } = p.plantillaDeWhatsapp(mensaje);
        const variables = p.variablesDeWhatsapp(mensaje, contacto.nombre);
        // "Hola, {{1}}. …": los pares son texto fijo; los impares, el número de la variable.
        const partes = texto.split(/\{\{(\d)\}\}/);
        return (
          <>
            <div className="correo-meta">
              <span>Para</span>
              <b>{`${contacto.nombre} · ${contacto.celular ?? "[celular]"}`}</b>
              <span>Plantilla</span>
              <span>{mensaje.documento === "cotizacion" ? "Cotización publicada" : "Informe publicado"}</span>
            </div>
            <div className="chat">
              <div className="burbuja">
                <div className="adj">
                  <span className="chip-pdf">PDF</span>
                  <span>{mensaje.nombreArchivo}</span>
                </div>
                <p>{partes.map((parte, i) => (i % 2 === 0 ? parte : <b key={i}>{variables[Number(parte) - 1]}</b>))}</p>
                {boton && <span className="boton-w">{boton}</span>}
              </div>
              <p className="ayuda">Lo resaltado son las variables; el resto del texto lo fija la plantilla registrada en Meta.</p>
            </div>
          </>
        );
      }}
    </ConPlantillas>
  );
}

/** El correo que recibe cada contacto que lo recibe por correo; con varios, se elige a quién mirar. */
export function CorreoDeContactos({ contactos, mensaje, cliente: cl, documento }: { contactos: readonly Contacto[]; mensaje: (p: Plantillas) => MensajeDeEnvio; cliente: { id: string; nombre: string }; documento: string }) {
  const porCorreo = contactos.filter((x) => x.recibeCorreo && x.correo);
  const [elegido, setElegido] = useState<string | null>(null);
  const contacto = porCorreo.find((x) => x.id === elegido) ?? porCorreo[0];
  if (!contacto) {
    return (
      <div className="lienzo-vacio">
        <b>{`Nadie recibe ${documento} por correo`}</b>
        <p>{`Al publicar, márquelo en la confirmación o agregue el contacto en ${cl.nombre}.`}</p>
        <Link to="/clientes/$id" params={{ id: cl.id }} className="migas">
          {`Contactos de ${cl.nombre}`}
        </Link>
      </div>
    );
  }
  return (
    <>
      {porCorreo.length > 1 && (
        <div className="pestanas" role="tablist" aria-label="A quién">
          {porCorreo.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === contacto.id} onClick={() => setElegido(x.id)}>
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      <VistaDeCorreo mensaje={mensaje} contacto={contacto} />
    </>
  );
}
