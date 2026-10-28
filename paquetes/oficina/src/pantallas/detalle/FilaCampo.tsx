import { useContext, useState } from "react";
import { describirValor, esBoceto, esCantidades, esFirma, esNoObtenido, type DefinicionCampo, type Valor, type ValorMedida } from "@teins/dominio";
import { Boton, MessageSquare, Pencil, TriangleAlert, useNotificar } from "@teins/ui";
import { aFechaCorta } from "../../formato";
import type { Levantamiento } from "../../revision";
import { idDato, respuestasDe, VerConversacion, vigentes } from "./contexto";
import { EditorCorreccion } from "./EditorCorreccion";
import { ComentarAqui } from "./Comentarios";
import { BocetoDeCampo } from "./BocetoDeCampo";
import { FirmaDeCampo } from "./FirmaDeCampo";
import { Fotos } from "./Fotos";
import { LineasDeCantidad } from "./LineasDeCantidad";

export function FilaCampo({
  l,
  seccion,
  campo,
  mia,
  correccion,
  recargar,
  comentando,
  comentar,
  dejarDeComentar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  mia: boolean;
  correccion: { original: unknown; autor: string; motivo: string | undefined } | undefined;
  recargar: () => void;
  comentando: boolean;
  comentar: () => void;
  dejarDeComentar: () => void;
}) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  // Cada corrección guardada hace destellar el dato otra vez (iteración 27).
  const [corregido, setCorregido] = useState(0);
  const notificar = useNotificar();
  const valor = l.respuestas[seccion]?.[campo.clave];
  const hilo = vigentes(l).filter((c) => c.seccion === seccion && c.campo === campo.clave);
  // Cuántos mensajes hay en sus conversaciones: el comentario y sus respuestas (ADR-0040).
  const mensajes = hilo.reduce((n, c) => n + 1 + respuestasDe(l, c.id).length, 0);
  const verConversacion = useContext(VerConversacion);
  const nombreEnFrase = campo.etiqueta.toLowerCase();

  // Marcado revisado, la corrección abierta ya no se puede guardar: se pierde, como dijo la confirmación.
  if (corrigiendo && l.estado !== "revisado") {
    return (
      <div className="dato editando" id={idDato(seccion, campo.clave)}>
        <span className="nombre">{campo.etiqueta}</span>
        <EditorCorreccion
          l={l}
          seccion={seccion}
          campo={campo}
          valor={valor}
          cerrar={() => setCorrigiendo(false)}
          alGuardar={() => {
            setCorrigiendo(false);
            setCorregido((n) => n + 1);
            notificar({ texto: `Corrección guardada: ${campo.etiqueta}` });
          }}
          recargar={recargar}
        />
      </div>
    );
  }

  // Fotos, bocetos y firmas son de campo: oficina no los corrige (la firma, de quien recibió la visita).
  const corregible = mia && campo.tipo !== "foto" && campo.tipo !== "boceto" && campo.tipo !== "firma";

  return (
    <div key={corregido} className={`dato ${corregido > 0 ? "recien" : ""}`} id={idDato(seccion, campo.clave)}>
      <span className="nombre">
        {campo.etiqueta}
        {hilo.length > 0 && (
          <>
            <br />
            <span className="n-com">
              <MessageSquare aria-hidden size={12} />
              {mensajes}
            </span>
          </>
        )}
      </span>
      <div>
        <ValorDelCampo l={l} seccion={seccion} campo={campo} valor={valor} mia={mia} correccion={correccion} recargar={recargar} />
      </div>
      <div className="acc">
        {corregible && (
          <Boton variante="fantasma" tamano="pequeno" icono={Pencil} aria-label={`Corregir ${nombreEnFrase}`} onClick={() => setCorrigiendo(true)}>
            Corregir
          </Boton>
        )}
        <button type="button" className="icono-btn limpio chico" title={`Comentar sobre ${nombreEnFrase}`} aria-label={`Comentar ${nombreEnFrase}`} onClick={comentar}>
          <MessageSquare aria-hidden size={16} />
        </button>
      </div>
      {hilo.length > 0 && (
        <div className="hilo">
          {/* Bajo el dato, el comentario, la última respuesta y el camino a la conversación (ADR-0040). */}
          {hilo.map((c) => {
            const respuestas = respuestasDe(l, c.id);
            const delTecnico = respuestas.filter((r) => r.de === "tecnico").at(-1);
            const nueva = delTecnico && l.conversacion?.sinLeer && (!l.leidoHasta || delTecnico.creadoEn > l.leidoHasta);
            return (
              <button key={c.id} type="button" className="burbuja hilo-res" onClick={() => verConversacion?.(c.id)}>
                <small>
                  {c.autor.nombre} · {aFechaCorta(c.creadoEn)} · para el técnico{c.editadoEn ? " · Editado" : ""}
                </small>
                <span style={{ whiteSpace: "pre-line" }}>{c.texto}</span>
                {delTecnico && (
                  <span className="resp-r">
                    {nueva && <i className="punto" aria-label="Sin leer" />}
                    <b>{delTecnico.autor.nombre}:</b> {delTecnico.texto}
                  </span>
                )}
                <span className="ver-r">
                  {respuestas.length > 0 ? `${respuestas.length === 1 ? "1 respuesta" : `${respuestas.length} respuestas`} · ` : ""}Ver la conversación
                </span>
              </button>
            );
          })}
        </div>
      )}
      {comentando && <ComentarAqui l={l} seccion={seccion} campo={campo.clave} nombre={nombreEnFrase} cerrar={dejarDeComentar} />}
    </div>
  );
}

/** El valor, como lo lee una persona. Una medida se ve grande con su unidad; lo corregido, con el valor anterior tachado. */
function ValorDelCampo({
  l,
  seccion,
  campo,
  valor,
  mia,
  correccion,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  valor: Valor | undefined;
  mia: boolean;
  correccion: { original: unknown; autor: string; motivo: string | undefined } | undefined;
  recargar: () => void;
}) {
  if (campo.tipo === "foto" && Array.isArray(valor)) return <Fotos etiqueta={campo.etiqueta} huellas={valor as readonly string[]} puestos={campo.puestos} />;
  if (campo.tipo === "boceto" && esBoceto(valor)) return <BocetoDeCampo etiqueta={campo.etiqueta} huella={valor.boceto} />;
  if (campo.tipo === "firma" && esFirma(valor)) return <FirmaDeCampo valor={valor} tecnico={l.tecnico.nombre} />;
  if (campo.tipo === "cantidades" && esCantidades(valor)) return <LineasDeCantidad l={l} seccion={seccion} campo={campo} lineas={valor} mia={mia} recargar={recargar} />;
  if (esNoObtenido(valor)) {
    return (
      <span className="no-obtenido">
        <TriangleAlert aria-hidden size={18} />
        No obtenido{valor.motivo ? <span> · {valor.motivo}</span> : null}
      </span>
    );
  }

  const antes = correccion ? <span className="antes">{describirValor(campo, correccion.original as Valor | undefined)}</span> : null;
  const marca = correccion && (
    <span className="corregido">
      <Pencil aria-hidden size={13} />
      Corregido por {correccion.autor}
      {correccion.motivo ? ` · ${correccion.motivo}` : ""}
    </span>
  );
  if (valor === undefined || valor === null) {
    return (
      <>
        <div className="sec">
          {antes}
          {describirValor(campo, valor)}
        </div>
        {marca}
      </>
    );
  }
  if (campo.tipo === "medida" && typeof valor === "object" && "valor" in valor) {
    const m = valor as ValorMedida;
    return (
      <>
        <div className="valor-medida">
          {antes}
          <span>
            {m.valor.replace(".", ",")} <small>{m.unidad}</small>
          </span>
        </div>
        {marca}
      </>
    );
  }
  return (
    <>
      <div className="fuerte" style={{ whiteSpace: "pre-line" }}>
        {antes}
        <span>{describirValor(campo, valor)}</span>
      </div>
      {marca}
    </>
  );
}
