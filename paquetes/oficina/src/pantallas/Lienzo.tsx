import { useCallback, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { MensajeDeEnvio, TextoPropio } from "@teins/documentos";
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
  botones,
}: {
  titulo: string;
  generar: (p: Plantillas) => string;
  ancho?: number;
  alPintar?: ((documento: Document) => void) | undefined;
  ancla?: AnclaDeHoja | null | undefined;
  /** «Ocultar» y «Mostrar» sobre la hoja (ADR-0039). */
  botones?: { encima: string; alTocar: (boton: HTMLElement) => void } | undefined;
}) {
  return <ConPlantillas>{(p) => <HojaEnVivo html={generar(p)} ancho={ancho} titulo={titulo} alPintar={alPintar} ancla={ancla} botones={botones} />}</ConPlantillas>;
}

/**
 * Escribir sobre el correo (ADR-0036): el asunto y el texto que va entre el saludo y el pie. `propio` null es el texto
 * de TEINS; volver a dejarlo igual al de TEINS también lo deja en null.
 */
export interface EdicionDeCorreo {
  propio: TextoPropio | null;
  alCambiar: (propio: TextoPropio | null) => void;
}

/** Lo que escribió la persona dentro del bloque editable: párrafos separados por una línea en blanco. */
const leerTexto = (el: HTMLElement) =>
  el.innerText
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** El correo que recibe un contacto, tal como sale: quién, el asunto, el adjunto y el mensaje. Con `edicion`, se escribe sobre él. */
export function VistaDeCorreo({ mensaje: armar, contacto, edicion }: { mensaje: (p: Plantillas) => MensajeDeEnvio; contacto: Contacto; edicion?: EdicionDeCorreo | undefined }) {
  // El portal del entorno, como lo pone el servidor: solo el correo del informe lo lleva, y sin él no hay botón.
  const portal = useQuery(consultas.sesion()).data?.organizacion.portal ?? undefined;
  return <ConPlantillas>{(p) => <Correo p={p} mensaje={armar(p)} contacto={contacto} portal={portal} edicion={edicion} />}</ConPlantillas>;
}

function Correo({ p, mensaje, contacto, portal, edicion }: { p: Plantillas; mensaje: MensajeDeEnvio; contacto: Contacto; portal: string | undefined; edicion: EdicionDeCorreo | undefined }) {
  const base: TextoPropio = { asunto: p.asuntoBase(mensaje), texto: p.textoBase(mensaje) };
  const actual = edicion?.propio ?? base;
  const vigente = useRef({ edicion, base, actual });
  vigente.current = { edicion, base, actual };
  // Lo que se escribe sobre el correo no vuelve a dibujarlo (el cursor se perdería): el marco se dibuja con el texto que
  // había al abrirlo, o con el que llegó de afuera ("Volver al texto de TEINS", el formulario).
  const [dibujado, setDibujado] = useState({ texto: actual.texto, vez: 0 });
  const escrito = useRef(actual.texto);
  if (actual.texto !== escrito.current) {
    escrito.current = actual.texto;
    setDibujado((d) => ({ texto: actual.texto, vez: d.vez + 1 }));
  }
  const cambiar = (propio: TextoPropio) => {
    const b = vigente.current.base;
    vigente.current.edicion?.alCambiar(propio.asunto === b.asunto && propio.texto === b.texto ? null : propio);
  };
  const marcar = useCallback(
    (doc: Document) => {
      if (!vigente.current.edicion) return;
      const bloque = doc.querySelector<HTMLElement>('[data-editable="texto"]');
      if (!bloque || bloque.dataset.escuchando) return;
      bloque.dataset.escuchando = "1";
      bloque.contentEditable = "plaintext-only";
      if (bloque.contentEditable !== "plaintext-only") bloque.contentEditable = "true";
      bloque.spellcheck = true;
      bloque.setAttribute("aria-label", "Texto del correo: escriba aquí");
      for (const [propiedad, valor] of [["outline", "1px dashed #9AA3B2"], ["outline-offset", "6px"], ["border-radius", "4px"], ["cursor", "text"]]) bloque.style.setProperty(propiedad!, valor!);
      bloque.addEventListener("focus", () => bloque.style.setProperty("outline", "2px solid #2F5FE8"));
      bloque.addEventListener("blur", () => bloque.style.setProperty("outline", "1px dashed #9AA3B2"));
      // Lo escrito se observa como cambio del bloque y no con "input": Safari no le entrega a la pantalla los eventos de
      // un marco sin scripts, y un observador sí le llega.
      new MutationObserver(() => {
        const texto = leerTexto(bloque);
        if (texto === escrito.current) return;
        escrito.current = texto;
        cambiar({ asunto: vigente.current.actual.asunto, texto });
      }).observe(bloque, { characterData: true, childList: true, subtree: true });
    },
    [],
  );
  // El asunto no se ve dentro del cuerpo: el marco usa siempre el de TEINS para no volver a dibujarse al cambiarlo.
  const conTexto = edicion ? { ...mensaje, personal: { asunto: base.asunto, texto: dibujado.texto } } : mensaje;
  // Lo que llegó de afuera se vuelve a dibujar aunque el texto sea el mismo que había al abrir.
  const html = p.htmlDeCorreo(conTexto, { nombre: contacto.nombre, portal: mensaje.documento === "cotizacion" ? undefined : portal, sinAdjunto: false }).replace("</body>", `<!--${dibujado.vez}--></body>`);
  return (
    <>
      <div className="correo-meta">
        <span>Para</span>
        <b>{`${contacto.nombre} <${contacto.correo ?? "[correo]"}>`}</b>
        <span>Asunto</span>
        {edicion ? (
          <input className="asunto-en-linea" aria-label="Asunto del correo" value={actual.asunto} onChange={(e) => cambiar({ asunto: e.target.value, texto: actual.texto })} />
        ) : (
          <b>{p.asunto(mensaje)}</b>
        )}
        <span>Adjunto</span>
        <span className="adjunto">
          <Paperclip aria-hidden size={13} strokeWidth={1.6} />
          {mensaje.nombreArchivo}
        </span>
      </div>
      <div className="correo-m">
        <HojaEnVivo
          html={html}
          ancho={640}
          titulo={`Correo a ${contacto.nombre}`}
          estilosEnLinea
          alPintar={marcar}
        />
      </div>
      {edicion && (
        <p className="nota-correo">
          {edicion.propio ? (
            <>
              Con su texto. <button type="button" className="enlace-acc" onClick={() => edicion.alCambiar(null)}>Volver al texto de TEINS</button>
            </>
          ) : (
            "Escriba sobre el asunto y el texto punteado."
          )}{" "}
          El saludo, el adjunto y el pie los pone TEINS.
        </p>
      )}
    </>
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
export function CorreoDeContactos({
  contactos,
  mensaje,
  cliente: cl,
  documento,
  edicion,
}: {
  contactos: readonly Contacto[];
  mensaje: (p: Plantillas) => MensajeDeEnvio;
  cliente: { id: string; nombre: string };
  documento: string;
  edicion?: EdicionDeCorreo | undefined;
}) {
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
      <VistaDeCorreo key={contacto.id} mensaje={mensaje} contacto={contacto} edicion={edicion} />
    </>
  );
}
