import { useRef, useState } from "react";

/**
 * El borrador de un documento con versión (informe, cotización): lo escrito solo se pierde si la persona lo
 * descarta. Se guarda contra la versión en que se basa lo escrito, no contra la última que se leyó: si otra
 * persona guardó en medio, el servidor responde conflicto en vez de pisar lo suyo. Sin cambios propios, sigue
 * al servidor (lo que guardó otra pestaña, la versión que sube al publicar).
 */
export function useBorrador<B>(version: number, delServidor: () => B) {
  const [base, setBase] = useState(() => ({ version, contenido: delServidor() }));
  const [borrador, setBorrador] = useState(base.contenido);
  // Lo vigente sin esperar a pintar: el guardado automático puede encadenar dos guardados antes de que se pinte el
  // primero, y el segundo debe ir sobre la versión que dejó el primero (si no, chocaría consigo mismo).
  const vigente = useRef({ version: base.version, guardado: JSON.stringify(base.contenido), borrador });
  vigente.current.borrador = borrador;
  const cambiado = JSON.stringify(borrador) !== JSON.stringify(base.contenido);
  // Solo hacia adelante: justo después de guardar, la lectura anterior todavía puede traer la versión vieja.
  if (!cambiado && version > base.version) {
    const contenido = delServidor();
    vigente.current = { version, guardado: JSON.stringify(contenido), borrador: contenido };
    setBase({ version, contenido });
    setBorrador(contenido);
  }
  return {
    borrador,
    setBorrador,
    cambiado,
    /** La versión sobre la que se escribió: la que se manda al guardar o publicar. */
    version: base.version,
    /** Lo guardado pasa a ser la base; lo escrito mientras tanto sigue como cambio. */
    guardado: (nueva: number, contenido: B) => {
      vigente.current = { ...vigente.current, version: nueva, guardado: JSON.stringify(contenido) };
      setBase({ version: nueva, contenido });
    },
    /** Vuelve a lo guardado; si el servidor ya tiene otra versión, la toma. */
    descartar: () => setBorrador(base.contenido),
    /** Lo escrito y la versión en que se basa, al momento (sin esperar a pintar). */
    actual: () => ({ version: vigente.current.version, borrador: vigente.current.borrador }),
    hayCambios: () => JSON.stringify(vigente.current.borrador) !== vigente.current.guardado,
    /** Escribir sobre otra versión (la que guardó otra persona): lo escrito sigue como cambio. */
    rebasar: (nueva: number) => {
      vigente.current = { ...vigente.current, version: nueva, guardado: "" };
      setBase((b) => ({ version: nueva, contenido: b.contenido }));
    },
  };
}

export type Borrador<B> = ReturnType<typeof useBorrador<B>>;
