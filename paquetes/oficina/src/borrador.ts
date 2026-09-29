import { useState } from "react";

/**
 * El borrador de un documento con versión (informe, cotización): lo escrito solo se pierde si la persona lo
 * descarta. Se guarda contra la versión en que se basa lo escrito, no contra la última que se leyó: si otra
 * persona guardó en medio, el servidor responde conflicto en vez de pisar lo suyo. Sin cambios propios, sigue
 * al servidor (lo que guardó otra pestaña, la versión que sube al publicar).
 */
export function useBorrador<B>(version: number, delServidor: () => B) {
  const [base, setBase] = useState(() => ({ version, contenido: delServidor() }));
  const [borrador, setBorrador] = useState(base.contenido);
  const cambiado = JSON.stringify(borrador) !== JSON.stringify(base.contenido);
  // Solo hacia adelante: justo después de guardar, la lectura anterior todavía puede traer la versión vieja.
  if (!cambiado && version > base.version) {
    const contenido = delServidor();
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
    guardado: (nueva: number, contenido: B) => setBase({ version: nueva, contenido }),
    /** Vuelve a lo guardado; si el servidor ya tiene otra versión, la toma. */
    descartar: () => setBorrador(base.contenido),
  };
}
