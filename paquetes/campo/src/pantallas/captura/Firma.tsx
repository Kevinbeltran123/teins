import { lazy, Suspense, useContext, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { esFirma, hojasDe, llenarDeclaracion, type DefinicionCampo, type DocumentoBoceto, type Valor, type ValorFirma } from "@teins/dominio";
import { BarraDePaso, Boton, BotonSiguiente, Check, RefreshCw, Confirmacion, EtiquetaCampo, Firma, MensajeError, Pencil, Smartphone } from "@teins/ui";
import { db, repositorio } from "../../datos/instancia";
import { visitaDe } from "../../datos/lecturas";
import { useUsuario } from "../../sesion/usuario";
import { fechaHora } from "../../formato";
import { PasoPropio } from "./contexto";

// La constancia que firma el cliente (ADR-0024): se carga al pedir la firma.
const HojaDeFirma = lazy(() => import("../HojaDeFirma"));

/** La firma en pequeño, en el repaso. */
export function MiniaturaDeFirma({ firma }: { firma: ValorFirma }) {
  const documento = useLiveQuery(() => repositorio.obtenerBoceto(firma.firma), [firma.firma]);
  const trazos = documento ? hojasDe(documento)[0] : undefined;
  return (
    <span data-tema="claro" className="mt-2 flex h-10 w-30 items-center rounded-[6px] bg-panel-hundido px-1.5">
      {trazos && <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={`Firma de ${firma.nombre}`} className="max-h-9 w-full" />}
    </span>
  );
}

const diaLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const soloHora = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });
const diaCorto = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
/** "hoy a las 3:40 p. m." o la fecha completa si no fue hoy. */
const cuandoFirmo = (iso: string) => (new Date(iso).toDateString() === new Date().toDateString() ? `hoy ${soloHora.format(new Date(iso))}` : fechaHora(iso));

/**
 * La constancia firmada (iteración 32): la firma grande sobre su línea, quién firmó y la declaración tal como sale en
 * el informe, con "Repetir" arriba (Liven y Docusign en Mobbin). Clara en los dos temas, como el papel.
 */
function FirmaTomada({ valor, documento, cliente, repetir }: { valor: ValorFirma; documento: DocumentoBoceto | null | undefined; cliente?: string | undefined; repetir?: (() => void) | undefined }) {
  // La firma es un boceto de una sola hoja (ADR-0024).
  const trazos = documento ? hojasDe(documento)[0] : undefined;
  return (
    <section aria-label="Constancia firmada" data-tema="claro" className="overflow-hidden rounded-capa border border-division bg-panel text-texto">
      <div className="flex items-center justify-between gap-2 pt-3 pr-2 pl-4">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-exito-fondo px-3 text-ayuda font-medium text-exito-texto [&_svg]:size-4">
          <Check aria-hidden />
          {`Firmada ${cuandoFirmo(valor.firmadoEn)}`}
        </span>
        {repetir ? (
          <Boton variante="fantasma" icono={RefreshCw} onClick={repetir}>
            Repetir
          </Boton>
        ) : (
          <span className="h-control-sm" />
        )}
      </div>
      <div className="mx-4 mt-1 flex h-48 items-center justify-center border-b-[1.5px] border-borde-control">
        {trazos && <Firma ancho={trazos.ancho} alto={trazos.alto} elementos={trazos.elementos} etiqueta={`Firma de ${valor.nombre}`} className="max-h-44 w-full" />}
      </div>
      <div className="flex flex-col gap-0.5 px-4 pt-2.5 pb-3.5">
        <strong className="text-[17px] font-semibold">{valor.nombre}</strong>
        {(valor.cargo || cliente) && <span className="text-ayuda text-texto-secundario">{[valor.cargo, cliente].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className="border-t border-division px-4 py-3 text-ayuda leading-relaxed text-texto-secundario">{valor.declaracion}</p>
    </section>
  );
}

/**
 * Firma de quien recibe la visita (ADR-0024). El técnico entrega el teléfono: la constancia se llena con su
 * nombre, el sitio de la visita y el día, y queda guardada tal como se leyó.
 */
export function CampoFirma({ id, seccion, campo, actual, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; actual: Valor | undefined; error: string | undefined; alGuardar: () => void }) {
  const [firmando, setFirmando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const usuario = useUsuario();
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? visitaDe(db, l.tecnicoId, l.visitaId) : null;
  }, [id]);
  const firma = esFirma(actual) ? actual : undefined;
  const documento = useLiveQuery(async () => (firma ? repositorio.obtenerBoceto(firma.firma) : null), [firma?.firma]);
  const declaracion = llenarDeclaracion(campo.tipo === "firma" ? campo.declaracion : undefined, {
    tecnico: usuario?.nombre ?? "el técnico",
    sitio: visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "este sitio",
    fecha: diaLargo.format(new Date()),
  });

  const propio = useContext(PasoPropio);
  return (
    <div className="flex flex-col gap-3">
      {!propio && <EtiquetaCampo obligatorio={campo.obligatorio}>{campo.etiqueta}</EtiquetaCampo>}
      {firma ? (
        <FirmaTomada valor={firma} documento={documento} cliente={visita?.cliente.nombre} repetir={() => setConfirmando(true)} />
      ) : propio ? (
        <>
          <p className="text-cuerpo leading-relaxed text-texto-secundario">Vas a entregar el teléfono a quien te recibió. Firma una constancia de que estuviste en el sitio hoy.</p>
          <div className="flex flex-col gap-0.5 rounded-panel border border-division bg-panel px-4.5 py-4">
            <strong className="text-cuerpo">Constancia de visita</strong>
            <span className="text-ayuda text-texto-secundario">{`${visita ? `${visita.cliente.nombre} · ${visita.sitio.nombre}` : "Este sitio"} · ${diaCorto.format(new Date())}`}</span>
          </div>
        </>
      ) : (
        <p className="text-ayuda text-texto-secundario">Entrégale el teléfono a quien recibió la visita: firma una constancia de que estuviste en el sitio.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      {firma ? null : propio ? (
        <BarraDePaso>
          <BotonSiguiente icono={Smartphone} onClick={() => setFirmando(true)}>
            Entregar el teléfono
          </BotonSiguiente>
        </BarraDePaso>
      ) : (
        <Boton icono={Pencil} onClick={() => setFirmando(true)}>
          Entregar el teléfono
        </Boton>
      )}
      {confirmando && firma && (
        <Confirmacion
          nivel="consecuencia"
          forma="inferior"
          titulo="¿Volver a firmar?"
          confirmar="Volver a firmar"
          accion={async () => setFirmando(true)}
          mensajeDeError={() => "No se pudo abrir la firma. Intenta de nuevo."}
          alCerrar={() => setConfirmando(false)}
        >
          <p>La firma de {firma.nombre} se reemplaza por la nueva.</p>
        </Confirmacion>
      )}
      {firmando && (
        <Suspense fallback={<div aria-busy="true" aria-label="Abriendo la constancia" className="fixed inset-0 z-50 bg-panel" />}>
          <HojaDeFirma
            declaracion={declaracion}
            recibe={{ tecnico: usuario?.nombre ?? "el técnico", cliente: visita?.cliente.nombre }}
            guardar={async (d, datos) => {
              await repositorio.guardarFirma(id, seccion, campo.clave, d, { ...datos, declaracion }, new Date());
              alGuardar();
            }}
            cerrar={() => setFirmando(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export function FirmaLeida({ etiqueta, valor }: { etiqueta: string; valor: ValorFirma }) {
  const documento = useLiveQuery(() => repositorio.obtenerBoceto(valor.firma), [valor.firma]);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      <FirmaTomada valor={valor} documento={documento} />
    </div>
  );
}
