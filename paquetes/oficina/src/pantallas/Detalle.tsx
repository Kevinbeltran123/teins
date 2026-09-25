import { useRef, useState, type RefObject } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { crearMedida, describirValor, esNoObtenido, type DefinicionCampo, type Valor, type ValorMedida, type VersionFormato } from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, CampoFotos, CampoMedida, CampoTexto, CampoTextoLargo, claseBoton, MarcaNoObtenido, Marquilla, ValorLeido } from "@teins/ui";
import { consultas } from "../api";
import { aFechaHora } from "../formato";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../mensajes";
import { useComentar, useCorregir, useMarcarRevisado, useTomar } from "../revision";

type Levantamiento = Respuesta<"obtenerLevantamiento">;
interface Destino {
  seccion: string;
  campo: string;
  etiqueta: string;
}

const ESTADOS = {
  enviado: { texto: "Enviado", tono: "enviado" },
  en_revision: { texto: "En revisión", tono: "revision" },
  revisado: { texto: "Revisado", tono: "revisado" },
} as const;

export function Detalle({ id }: { id: string }) {
  const consulta = useQuery(consultas.levantamiento(id));
  const sesion = useQuery(consultas.sesion());
  const [comentandoSobre, setComentandoSobre] = useState<Destino | null>(null);
  const formularioComentario = useRef<HTMLTextAreaElement | null>(null);
  const volver = (
    <Link to="/" className={`${claseBoton()} self-start`}>
      Volver a la bandeja
    </Link>
  );

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando el levantamiento" className="flex flex-col gap-6">
        <div className="h-[160px] animate-pulse rounded-panel bg-panel" />
        <div className="h-[260px] animate-pulse rounded-panel bg-panel" />
      </div>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        {volver}
        <Aviso tono="error">
          <p>{noExiste ? "Este levantamiento no existe o no pertenece a su organización." : "No se pudo cargar el levantamiento."}</p>
          {!noExiste && (
            <Boton className="mt-3" onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }

  const l = consulta.data;
  // Regla 4: solo quien tomó la revisión corrige, y solo mientras está en revisión.
  const mia = l.estado === "en_revision" && l.revisor?.id === sesion.data?.usuario.id;
  const estado = ESTADOS[l.estado];

  function comentarSobre(destino: Destino) {
    setComentandoSobre(destino);
    requestAnimationFrame(() => formularioComentario.current?.focus());
  }

  return (
    <>
      {volver}
      <section aria-labelledby="titulo-levantamiento" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Marquilla tono={estado.tono}>{estado.texto}</Marquilla>
          <span className="text-ayuda text-texto-secundario">{l.formatoDefinicion.nombre ?? `${l.formato} v${l.versionFormato}`}</span>
        </div>
        <h1 id="titulo-levantamiento" className="text-titulo leading-tight font-extrabold tracking-tight">
          Levantamiento de {l.tecnico.nombre}
        </h1>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <ValorLeido etiqueta="Visita">{l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : "Sin visita (capturado antes de las visitas)"}</ValorLeido>
          <ValorLeido etiqueta="Recibido en oficina">{aFechaHora(l.recibidoEn)}</ValorLeido>
          {/* La hora del teléfono es declarativa (regla 16): la oficial es la del servidor. */}
          <ValorLeido etiqueta="Enviado desde el teléfono">{aFechaHora(l.enviadoEnDispositivo)}</ValorLeido>
          <ValorLeido etiqueta="Fotos">{l.fotos}</ValorLeido>
        </div>
      </section>

      <PanelRevision l={l} mia={mia} recargar={() => void consulta.refetch()} />

      {l.formatoDefinicion.secciones.map((seccion) => (
        <section key={seccion.clave} aria-labelledby={`seccion-${seccion.clave}`} className="flex flex-col gap-5 rounded-panel bg-panel p-6">
          <h2 id={`seccion-${seccion.clave}`} className="text-subtitulo font-extrabold">
            {seccion.titulo}
          </h2>
          <div className="flex flex-col divide-y divide-division">
            {seccion.campos.map((campo) => (
              <FilaCampo
                key={campo.clave}
                l={l}
                seccion={seccion.clave}
                campo={campo}
                mia={mia}
                recargar={() => void consulta.refetch()}
                comentar={() => comentarSobre({ seccion: seccion.clave, campo: campo.clave, etiqueta: campo.etiqueta })}
              />
            ))}
          </div>
        </section>
      ))}

      <Comentarios l={l} destino={comentandoSobre} quitarDestino={() => setComentandoSobre(null)} refCampo={formularioComentario} />
      <Historial id={id} formato={l.formatoDefinicion} />
    </>
  );
}

function PanelRevision({ l, mia, recargar }: { l: Levantamiento; mia: boolean; recargar: () => void }) {
  const tomar = useTomar();
  const marcar = useMarcarRevisado(l.id);
  const [confirmandoReasignar, setConfirmandoReasignar] = useState(false);
  const error = tomar.error ?? marcar.error;
  const invalidos = marcar.error instanceof ErrorApi ? (marcar.error.problema.errores ?? []) : [];
  const etiqueta = (seccion: string, campo?: string) =>
    l.formatoDefinicion.secciones.find((s) => s.clave === seccion)?.campos.find((c) => c.clave === campo)?.etiqueta ?? campo ?? seccion;

  let contenido;
  if (l.estado === "enviado") {
    contenido = (
      <>
        <p className="text-cuerpo">Nadie ha tomado este levantamiento. Tómelo para corregirlo y marcarlo revisado.</p>
        <Boton variante="principal" disabled={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version })}>
          {tomar.isPending ? "Tomando…" : "Tomar para revisar"}
        </Boton>
      </>
    );
  } else if (l.estado === "revisado") {
    contenido = <p className="text-cuerpo">Revisado por {l.revisor?.nombre ?? "[Sin responsable]"}. Ya se puede incluir en un informe.</p>;
  } else if (mia) {
    contenido = (
      <>
        <p className="text-cuerpo">Usted tiene la revisión. Corrija lo que haga falta y márquelo revisado cuando esté listo.</p>
        <Boton variante="principal" disabled={marcar.isPending} onClick={() => marcar.mutate(l.version)}>
          {marcar.isPending ? "Marcando…" : "Marcar revisado"}
        </Boton>
      </>
    );
  } else {
    const nombre = l.revisor?.nombre ?? "otra persona";
    contenido = confirmandoReasignar ? (
      <Aviso tono="alerta">
        <p>¿Quitarle la revisión a {nombre}? Si tiene cambios sin guardar, los perderá. El cambio de responsable queda registrado.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Boton
            disabled={tomar.isPending}
            onClick={() => tomar.mutate({ id: l.id, version: l.version, reasignar: true }, { onSettled: () => setConfirmandoReasignar(false) })}
          >
            Sí, tomar la revisión
          </Boton>
          <Boton onClick={() => setConfirmandoReasignar(false)}>Cancelar</Boton>
        </div>
      </Aviso>
    ) : (
      <>
        <p className="text-cuerpo">La revisión la tiene {nombre}.</p>
        <Boton onClick={() => setConfirmandoReasignar(true)}>Tomar la revisión de {nombre}</Boton>
      </>
    );
  }

  return (
    <section aria-label="Revisión" className="flex flex-col gap-3 rounded-panel bg-panel p-6 md:flex-row md:flex-wrap md:items-center md:justify-between">
      {contenido}
      {error && (
        <div className="w-full">
          <Aviso tono="error">
            <p>{mensajeDeError(error)}</p>
            {invalidos.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {invalidos.map((e) => (
                  <li key={`${e.seccion}.${e.campo ?? ""}`}>
                    {etiqueta(e.seccion, e.campo)}: {mensajeDeValidacion[e.codigo as keyof typeof mensajeDeValidacion] ?? e.codigo}
                  </li>
                ))}
              </ul>
            )}
            {pideRecargar(error) && (
              <Boton className="mt-3" onClick={recargar}>
                Recargar
              </Boton>
            )}
          </Aviso>
        </div>
      )}
    </section>
  );
}

function FilaCampo({
  l,
  seccion,
  campo,
  mia,
  recargar,
  comentar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  mia: boolean;
  recargar: () => void;
  comentar: () => void;
}) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const valor = l.respuestas[seccion]?.[campo.clave];

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      {campo.tipo === "foto" && Array.isArray(valor) ? (
        <Fotos etiqueta={campo.etiqueta} huellas={valor as readonly string[]} />
      ) : (
        <ValorLeido etiqueta={campo.etiqueta}>
          <span className={valor === undefined || esNoObtenido(valor) ? "text-texto-secundario" : ""}>{describirValor(campo, valor)}</span>
        </ValorLeido>
      )}
      {corrigiendo ? (
        <EditorCorreccion l={l} seccion={seccion} campo={campo} valor={valor} cerrar={() => setCorrigiendo(false)} recargar={recargar} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {mia && campo.tipo !== "foto" && <Boton onClick={() => setCorrigiendo(true)}>Corregir {campo.etiqueta.toLowerCase()}</Boton>}
          <Boton onClick={comentar}>Comentar {campo.etiqueta.toLowerCase()}</Boton>
        </div>
      )}
    </div>
  );
}

/** Corrección de un campo, con las mismas reglas del envío (QA-8: queda con valor anterior y nuevo). */
function EditorCorreccion({
  l,
  seccion,
  campo,
  valor,
  cerrar,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  valor: Valor | undefined;
  cerrar: () => void;
  recargar: () => void;
}) {
  const corregir = useCorregir(l.id);
  const noObtenidoAntes = esNoObtenido(valor);
  const [nuevo, setNuevo] = useState<Valor | undefined>(valor);
  const [valido, setValido] = useState(true);
  const [motivo, setMotivo] = useState("");
  const errorDelCampo =
    corregir.error instanceof ErrorApi ? corregir.error.problema.errores?.find((e) => e.seccion === seccion && e.campo === campo.clave) : undefined;
  const mensajeCampo = errorDelCampo ? mensajeDeValidacion[errorDelCampo.codigo as keyof typeof mensajeDeValidacion] : undefined;
  const marcado = esNoObtenido(nuevo);

  async function guardar() {
    try {
      await corregir.mutateAsync({
        version: l.version,
        correcciones: [{ seccion, campo: campo.clave, valor: nuevo ?? null }],
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      cerrar();
    } catch {
      // El error queda a la vista en el formulario.
    }
  }

  const control = (() => {
    switch (campo.tipo) {
      case "texto":
        return (
          <CampoTexto
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            valorInicial={typeof valor === "string" ? valor : ""}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto) => setNuevo(texto === "" ? undefined : texto)}
          />
        );
      case "medida": {
        const medida = valor && !noObtenidoAntes && typeof valor === "object" && "valor" in valor ? (valor as ValorMedida) : undefined;
        return (
          <CampoMedida
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            unidades={campo.unidades}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                setNuevo(undefined);
                setValido(true);
                return true;
              }
              const m = crearMedida(texto, unidad, campo.unidades);
              if (m) setNuevo(m);
              setValido(m !== null);
              return m !== null;
            }}
          />
        );
      }
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-4 rounded-panel border-2 border-borde-activo p-4">
      {control}
      {campo.obligatorio && (
        <MarcaNoObtenido
          dato={campo.etiqueta}
          marcado={marcado}
          motivoInicial={noObtenidoAntes ? valor.motivo : ""}
          error={marcado ? mensajeCampo : undefined}
          onCambio={(m, motivoNoObtenido) => setNuevo(m ? { noObtenido: true, motivo: motivoNoObtenido } : undefined)}
        />
      )}
      <CampoTextoLargo etiqueta="Motivo de la corrección" ayuda="Opcional. Queda en el historial junto al cambio." valor={motivo} onCambio={setMotivo} filas={2} maximo={500} />
      {corregir.isError && !errorDelCampo && (
        <Aviso tono="error">
          <p>{mensajeDeError(corregir.error)}</p>
          {pideRecargar(corregir.error) && (
            <Boton className="mt-3" onClick={recargar}>
              Recargar
            </Boton>
          )}
        </Aviso>
      )}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => void guardar()} disabled={corregir.isPending || !valido}>
          {corregir.isPending ? "Guardando…" : "Guardar corrección"}
        </Boton>
        <Boton onClick={cerrar}>Cancelar</Boton>
      </div>
    </div>
  );
}

function Comentarios({
  l,
  destino,
  quitarDestino,
  refCampo,
}: {
  l: Levantamiento;
  destino: Destino | null;
  quitarDestino: () => void;
  /** Recibe el foco cuando se elige comentar un dato. */
  refCampo: RefObject<HTMLTextAreaElement | null>;
}) {
  const comentar = useComentar(l.id);
  const [texto, setTexto] = useState("");
  const etiqueta = (seccion?: string, campo?: string) =>
    l.formatoDefinicion.secciones.find((s) => s.clave === seccion)?.campos.find((c) => c.clave === campo)?.etiqueta;

  async function enviar() {
    if (!texto.trim()) return;
    try {
      await comentar.mutateAsync({ texto: texto.trim(), ...(destino ? { seccion: destino.seccion, campo: destino.campo } : {}) });
      setTexto("");
      quitarDestino();
    } catch {
      // El error queda a la vista.
    }
  }

  return (
    <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
      <h2 id="titulo-comentarios" className="text-subtitulo font-extrabold">
        Comentarios al técnico
      </h2>
      {l.comentarios.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">Sin comentarios. El técnico los ve en su teléfono en la siguiente sincronización.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {l.comentarios.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 border-l-[3px] border-division pl-3">
              <p className="text-ayuda text-texto-secundario">
                {c.autor.nombre} · {aFechaHora(c.creadoEn)}
                {c.campo && ` · Sobre ${etiqueta(c.seccion, c.campo)?.toLowerCase() ?? c.campo}`}
              </p>
              <p className="text-cuerpo whitespace-pre-line">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3">
        {destino && (
          <p className="text-ayuda">
            Sobre <strong>{destino.etiqueta.toLowerCase()}</strong>.{" "}
            <button type="button" onClick={quitarDestino} className="font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-superficie">
              Comentar en general
            </button>
          </p>
        )}
        <CampoTextoLargo ref={refCampo} etiqueta="Nuevo comentario" valor={texto} onCambio={setTexto} maximo={2000} />
        {comentar.isError && <Aviso tono="error">{mensajeDeError(comentar.error)}</Aviso>}
        <Boton className="self-start" onClick={() => void enviar()} disabled={comentar.isPending || !texto.trim()}>
          {comentar.isPending ? "Enviando…" : "Enviar comentario"}
        </Boton>
      </div>
    </section>
  );
}

const QUE_PASO: Record<string, string> = {
  levantamiento_creado: "Creó el levantamiento en el teléfono",
  levantamiento_enviado: "Envió el levantamiento",
  revision_tomada: "Tomó la revisión",
  revision_reasignada: "Tomó la revisión",
  campo_corregido: "Corrigió",
  levantamiento_revisado: "Marcó el levantamiento revisado",
  comentario_agregado: "Comentó",
};

/** Historial legible por campo (ADR-0008), con la verificación de la cadena. */
function Historial({ id, formato }: { id: string; formato: VersionFormato }) {
  const historial = useQuery(consultas.historial(id));
  const campo = (seccion?: string, clave?: string) => formato.secciones.find((s) => s.clave === seccion)?.campos.find((c) => c.clave === clave);

  return (
    <section aria-labelledby="titulo-historial" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-historial" className="text-subtitulo font-extrabold">
          Historial de cambios
        </h2>
        {historial.data && (
          <span className={`text-ayuda font-bold ${historial.data.integra ? "text-sync-ok" : "text-error"}`}>
            {historial.data.integra ? "Historial íntegro" : "El historial fue alterado fuera del sistema"}
          </span>
        )}
      </div>
      {historial.isPending ? (
        <div aria-busy="true" aria-label="Cargando el historial" className="h-[120px] animate-pulse rounded-panel bg-fondo" />
      ) : historial.isError ? (
        <Aviso tono="error">
          <p>No se pudo cargar el historial.</p>
          <Boton className="mt-3" onClick={() => void historial.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : (
        <ol className="flex flex-col gap-3">
          {historial.data.eventos.map((e) => {
            const definicion = campo(e.seccion, e.campo);
            const revisorAnterior = (e.anterior as { revisor?: string } | undefined)?.revisor;
            let detalle = "";
            if (e.tipo === "campo_corregido" && definicion) {
              detalle = `${definicion.etiqueta.toLowerCase()}: ${describirValor(definicion, e.anterior as Valor | undefined)} → ${describirValor(definicion, e.nuevo as Valor | undefined)}`;
            } else if (e.tipo === "revision_reasignada" && revisorAnterior) {
              detalle = `que tenía ${revisorAnterior}`;
            } else if (e.tipo === "comentario_agregado") {
              detalle = `${definicion ? `sobre ${definicion.etiqueta.toLowerCase()}: ` : ""}“${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
            }
            return (
              <li key={e.secuencia} className="flex flex-col gap-0.5">
                <p className="text-cuerpo">
                  <strong>{e.autor.nombre}</strong> {QUE_PASO[e.tipo]?.toLowerCase() ?? e.tipo} {detalle}
                </p>
                <p className="text-ayuda text-texto-secundario">
                  {aFechaHora(e.hora)}
                  {e.motivo && ` · Motivo: ${e.motivo}`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Fotos({ etiqueta, huellas }: { etiqueta: string; huellas: readonly string[] }) {
  const urls = useQueries({ queries: huellas.map((h) => consultas.urlDeArchivo(h)) });
  if (urls.some((u) => u.isPending)) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="text-cuerpo font-bold">{etiqueta}</span>
        <p className="text-ayuda text-texto-secundario">Cargando fotos…</p>
      </div>
    );
  }
  if (urls.some((u) => u.isError)) {
    return (
      <Aviso tono="error">
        <p>No se pudieron cargar las fotos de {etiqueta.toLowerCase()}.</p>
        <Boton className="mt-3" onClick={() => urls.forEach((u) => void u.refetch())}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }
  const fotos = urls.map((u, i) => ({ id: huellas[i]!, url: u.data!.url }));
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
