import { useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { nombreDeDato, rutaLegible } from "@teins/dominio";
import { ErrorApi } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  Check,
  ChevronRight,
  DestinoAccionesBarra,
  Confirmacion,
  FileText,
  nombreDeTransicion,
  MessageSquare,
  RefreshCw,
  Smartphone,
  useNotificar,
} from "@teins/ui";
import { consultas } from "../../api";
import { cuantoLleva } from "../../formato";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../../mensajes";
import {
  alMarcarRevisado,
  loEscritoAlMarcar,
  useBandeja,
  useMarcarRevisado,
  useTomar,
  type Consecuencia,
  type Historial,
  type Levantamiento,
} from "../../revision";
import { SinEnviar } from "../../sinEnviar";
import { useTeclaSuelta } from "../../atajos";
import { AbrirInforme } from "../AbrirInforme";
import { cuandoCorto, vigentes } from "./contexto";

/**
 * El estado de la revisión va en la barra, junto a su acción (iteración 38), como «Guardado» junto a «Publicar»:
 * «● En revisión · la tomó usted» con «Marcar revisado». En la pantalla quedan «Siguiente», los errores y las
 * confirmaciones.
 */
export function EstadoDeRevision({ l, mia, historial, recargar, mostrarPanel }: { l: Levantamiento; mia: boolean; historial: Historial | undefined; recargar: () => void; mostrarPanel: ReactNode }) {
  const tomar = useTomar();
  const marcar = useMarcarRevisado(l.id);
  const notificar = useNotificar();
  const destino = useContext(DestinoAccionesBarra);
  const sesion = useQuery(consultas.sesion());
  const [confirmando, setConfirmando] = useState<"revisado" | "reasignar" | null>(null);
  const tomada = () => notificar({ texto: "Revisión tomada: ya puede corregir" });
  const error = tomar.error ?? marcar.error;
  const invalidos = marcar.error instanceof ErrorApi ? (marcar.error.problema.errores ?? []) : [];
  const etiqueta = (seccion: string, campo?: string) => (campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo) : rutaLegible(l.formatoDefinicion, l.repeticiones, seccion));
  const nombre = l.revisor?.nombre ?? "otra persona";
  // Lo escrito y sin guardar ni enviar, al abrir la confirmación: sus consecuencias van primero.
  const pendientes = useContext(SinEnviar);
  const [loEscrito, setLoEscrito] = useState<Consecuencia[]>([]);
  const [sePierdeAlgo, setSePierdeAlgo] = useState(false);
  const confirmarRevisado = () => {
    setLoEscrito(loEscritoAlMarcar(l, pendientes?.values() ?? []));
    setSePierdeAlgo(alMarcarRevisado(pendientes?.values() ?? []).sePierden.length > 0);
    setConfirmando("revisado");
  };
  // El error de tomar o marcar revisado habla de la versión en que se intentó: con otra (una corrección guardada), se va.
  useEffect(() => {
    tomar.reset();
    marcar.reset();
  }, [l.version]);
  // Sin responsable: en revisión, pero quien la tenía fue desactivado. La toma quien llegue, sin quitársela a nadie.
  const sinResponsable = l.estado === "en_revision" && !l.revisor;
  // Revisar con el teclado (iteración 37): T toma y R marca revisado, con la confirmación de siempre.
  useTeclaSuelta("t", () => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada }), (l.estado === "enviado" || sinResponsable) && !tomar.isPending);
  useTeclaSuelta("r", confirmarRevisado, mia && l.estado === "en_revision");

  let linea: ReactNode;
  let accion: ReactNode = null;
  if (sinResponsable) {
    const soltada = [...(historial?.eventos ?? [])].reverse().find((e) => e.tipo === "revision_liberada");
    const quienLaTenia = (soltada?.anterior as { revisor?: string } | undefined)?.revisor;
    linea = (
      <>
        <b>En revisión</b> · nadie la tiene{quienLaTenia ? ` desde que se desactivó a ${quienLaTenia}` : ""}
      </>
    );
    accion = (
      <Boton variante="principal" title="Tomar para revisar · T" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada })}>
        Tomar para revisar
      </Boton>
    );
  } else if (l.estado === "enviado") {
    linea = (
      <>
        <b>Esperando revisión</b> · nadie la ha tomado
      </>
    );
    accion = (
      <Boton variante="principal" title="Tomar para revisar · T" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version }, { onSuccess: tomada })}>
        Tomar para revisar
      </Boton>
    );
  } else if (l.estado === "revisado") {
    const revisadoEn = [...(historial?.eventos ?? [])].reverse().find((e) => e.tipo === "levantamiento_revisado")?.hora;
    const quien = l.revisor?.id === sesion.data?.usuario.id ? "usted" : (l.revisor?.nombre ?? "[Sin responsable]");
    linea = (
      <>
        <b>Revisado</b> · por {quien}
        {revisadoEn ? `, ${cuandoCorto(revisadoEn)}` : ""}
      </>
    );
    accion = l.visita ? <AbrirInforme visitaId={l.visita.id} /> : null;
  } else if (mia) {
    linea = (
      <>
        <b>En revisión</b> · la tomó usted
      </>
    );
    accion = (
      <Boton variante="principal" icono={Check} title="Marcar revisado · R" onClick={confirmarRevisado}>
        Marcar revisado
      </Boton>
    );
  } else {
    linea = (
      <>
        <b>En revisión</b> · la tiene {nombre}
      </>
    );
    accion = <Boton onClick={() => setConfirmando("reasignar")}>Tomar la revisión de {nombre}</Boton>;
  }

  const barra = (
    <div className="acciones" role="region" aria-label="Revisión">
      {/* El estado cambia en su lugar al tomar o marcar revisado (iteración 27). */}
      <span className={`estado-rev ${l.estado}`} role="status" style={{ viewTransitionName: nombreDeTransicion("estado", l.id) }}>
        <i aria-hidden />
        <span>{linea}</span>
      </span>
      {mostrarPanel}
      {accion}
    </div>
  );

  return (
    <>
      {destino ? createPortal(barra, destino) : barra}
      {l.estado === "revisado" && <SiguienteEnSerie actual={l.id} />}
      {error && (
        <Aviso tono="error">
          <b>{mensajeDeError(error)}</b>
          {invalidos.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {invalidos.map((e) => (
                <li key={`${e.seccion}.${e.campo ?? ""}`}>
                  {etiqueta(e.seccion, e.campo)}: {mensajeDeValidacion[e.codigo as keyof typeof mensajeDeValidacion] ?? e.codigo}
                </li>
              ))}
            </ul>
          )}
          {pideRecargar(error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      {confirmando === "revisado" && (
        <Confirmacion
          // Con algo que se pierde, «R» y luego ↵ no lo aceptan sin leer: el foco empieza en Cancelar.
          nivel={sePierdeAlgo ? "irreversible" : "consecuencia"}
          titulo={`¿Marcar revisado el levantamiento de ${l.tecnico.nombre}?`}
          confirmar="Marcar revisado"
          consecuencias={[
            ...loEscrito,
            { icono: FileText, texto: l.visita ? "Queda listo para el informe de la visita" : "Queda listo para el informe", detalle: "Ya no se corrige desde la revisión" },
            {
              icono: Smartphone,
              texto: `${l.tecnico.nombre} lo ve como revisado en su teléfono`,
              ...(vigentes(l).length > 0 && { detalle: vigentes(l).length === 1 ? "Con el comentario de oficina" : `Con los ${vigentes(l).length} comentarios de oficina` }),
            },
            // ADR-0040: al marcar revisado, las conversaciones se cierran.
            ...(vigentes(l).length > 0 ? [{ icono: MessageSquare, texto: "Las conversaciones se cierran", detalle: `${l.tecnico.nombre} las sigue viendo en su teléfono, pero ya no responde` }] : []),
          ]}
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={async () => {
            await marcar.mutateAsync(l.version);
            // Revisado: lo que quedaba sin enviar ya no se puede enviar (la confirmación lo dijo).
            pendientes?.clear();
          }}
          alTerminar={() => notificar({ texto: "Marcado revisado" })}
        />
      )}
      {confirmando === "reasignar" && (
        <Confirmacion
          nivel="consecuencia"
          titulo={`¿Quitarle la revisión a ${nombre}?`}
          confirmar="Tomar la revisión"
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={() => tomar.mutateAsync({ id: l.id, version: l.version, reasignar: true })}
          alTerminar={tomada}
        >
          <p>Si tiene cambios sin guardar, los perderá. El cambio de responsable queda registrado.</p>
        </Confirmacion>
      )}
    </>
  );
}

/**
 * Revisar en serie (iteración 27): al marcar revisado, el que más lleva esperando, con cuántos quedan, para seguir
 * sin volver a la lista. Va encima de los datos (iteración 38), como fila y no como botón relleno: la acción principal
 * es abrir el informe.
 */
function SiguienteEnSerie({ actual }: { actual: string }) {
  const esperando = useBandeja("enviado");
  const navegar = useNavigate();
  const primera = esperando.data?.pages[0];
  const siguiente = primera?.elementos.find((e) => e.id !== actual);
  const quedan = primera ? primera.total - (primera.elementos.some((e) => e.id === actual) ? 1 : 0) : 0;
  useTeclaSuelta("s", () => siguiente && void navegar({ to: "/levantamientos/$id", params: { id: siguiente.id } }), Boolean(siguiente));
  if (esperando.isPending) return null;
  if (!siguiente) return <span className="quedan">No queda nada esperando revisión.</span>;
  return (
    <button type="button" className="siguiente-fila" title="Siguiente · S" onClick={() => void navegar({ to: "/levantamientos/$id", params: { id: siguiente.id } })}>
      <span>
        <b>Siguiente: {siguiente.visita?.cliente ?? `Levantamiento de ${siguiente.tecnico.nombre}`}</b>
        <small>
          {siguiente.nombreFormato ?? siguiente.formato} de {siguiente.tecnico.nombre} · lleva {cuantoLleva(siguiente.recibidoEn).texto} · {quedan === 1 ? "queda 1" : `quedan ${quedan}`}
        </small>
      </span>
      <ChevronRight aria-hidden size={16} />
    </button>
  );
}
