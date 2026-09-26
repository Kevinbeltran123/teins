import { useRef, useState, type RefObject } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  bloques,
  campoDeRuta,
  crearMedida,
  describirValor,
  esBoceto,
  esCantidades,
  esNoObtenido,
  nombreDeDato,
  normalizarDecimal,
  rutaLegible,
  type DefinicionCampo,
  type LineaCantidad,
  type Valor,
  type ValorMedida,
} from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boceto,
  Boton,
  BotonIcono,
  CampoFotos,
  CampoMedida,
  CampoSeleccion,
  CampoTexto,
  CampoTextoLargo,
  Confirmacion,
  EditorCantidades,
  EncabezadoPagina,
  EsqueletoBloques,
  FileText,
  Insignia,
  MarcaNoObtenido,
  MessageSquare,
  Pencil,
  RefreshCw,
  TablaCantidades,
  ValorLeido,
  X,
  type LineaEditable,
} from "@teins/ui";
import { consultas } from "../api";
import { consultasDeCatalogo, useVincular } from "../catalogo";
import { aFechaHora } from "../formato";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../mensajes";
import { useComentar, useCorregir, useMarcarRevisado, useTomar } from "../revision";
import { useAbrirInformeDeVisita } from "../informes";

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

const migas = (
  <Link to="/" className="hover:text-texto hover:underline focus-visible:outline-3 focus-visible:outline-superficie">
    Levantamientos
  </Link>
);

export function Detalle({ id }: { id: string }) {
  const consulta = useQuery(consultas.levantamiento(id));
  const sesion = useQuery(consultas.sesion());
  const [comentandoSobre, setComentandoSobre] = useState<Destino | null>(null);
  const formularioComentario = useRef<HTMLTextAreaElement | null>(null);

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Levantamiento" />
        <EsqueletoBloques etiqueta="Cargando el levantamiento" altos={["bajo", "alto", "medio"]} />
      </>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Levantamiento" />
        <Aviso tono="error">
          <p>{noExiste ? "Este levantamiento no existe o no pertenece a su organización." : "No se pudo cargar el levantamiento."}</p>
          {!noExiste && (
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
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
    // El comentario se escribe en el panel lateral, que sigue a la vista: el foco va ahí sin mover la página.
    requestAnimationFrame(() => formularioComentario.current?.focus({ preventScroll: true }));
  }

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={`Levantamiento de ${l.tecnico.nombre}`}
        estado={<Insignia tono={estado.tono}>{estado.texto}</Insignia>}
        descripcion={`${l.formatoDefinicion.nombre ?? l.formato} · ${l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : "Sin visita (capturado antes de las visitas)"}`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Cada sección, y cada repetición de las repetibles con su nombre (iteración 9). */}
          {bloques(l.formatoDefinicion, l.repeticiones).map(({ seccion, clave, titulo, repeticion }) => (
            <section key={clave} aria-labelledby={`seccion-${clave}`} className="flex flex-col gap-4 rounded-panel border border-division bg-panel p-6">
              <h2 id={`seccion-${clave}`} className="text-subtitulo font-extrabold">
                {titulo}
              </h2>
              <div className="flex flex-col divide-y divide-division">
                {seccion.campos.map((campo) => (
                  <FilaCampo
                    key={campo.clave}
                    l={l}
                    seccion={clave}
                    campo={campo}
                    mia={mia}
                    recargar={() => void consulta.refetch()}
                    comentar={() => comentarSobre({ seccion: clave, campo: campo.clave, etiqueta: repeticion ? `${repeticion.nombre} · ${campo.etiqueta}` : campo.etiqueta })}
                  />
                ))}
              </div>
            </section>
          ))}
          {l.formatoDefinicion.secciones
            .filter((s) => s.repetible && (l.repeticiones[s.clave]?.length ?? 0) === 0)
            .map((s) => (
              <section key={s.clave} aria-label={s.titulo} className="rounded-panel border border-division bg-panel p-6">
                <h2 className="text-subtitulo font-extrabold">{s.titulo}</h2>
                <p className="mt-2 text-cuerpo text-texto-secundario">El técnico no agregó ninguno.</p>
              </section>
            ))}
          <Historial l={l} />
        </div>
        <aside aria-label="Revisión y comentarios" className="flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
          <PanelRevision l={l} mia={mia} recargar={() => void consulta.refetch()} />
          <section aria-label="Datos del levantamiento" className="rounded-panel border border-division bg-panel p-5">
            <dl className="flex flex-col gap-3">
              <ValorLeido etiqueta="Recibido en oficina">{aFechaHora(l.recibidoEn)}</ValorLeido>
              {/* La hora del teléfono es declarativa (regla 16): la oficial es la del servidor. */}
              <ValorLeido etiqueta="Enviado desde el teléfono">{aFechaHora(l.enviadoEnDispositivo)}</ValorLeido>
            </dl>
          </section>
          <Comentarios l={l} destino={comentandoSobre} quitarDestino={() => setComentandoSobre(null)} refCampo={formularioComentario} />
        </aside>
      </div>
    </>
  );
}

function PanelRevision({ l, mia, recargar }: { l: Levantamiento; mia: boolean; recargar: () => void }) {
  const tomar = useTomar();
  const marcar = useMarcarRevisado(l.id);
  const [confirmando, setConfirmando] = useState<"revisado" | "reasignar" | null>(null);
  const error = tomar.error ?? marcar.error;
  const invalidos = marcar.error instanceof ErrorApi ? (marcar.error.problema.errores ?? []) : [];
  const etiqueta = (seccion: string, campo?: string) => (campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo) : rutaLegible(l.formatoDefinicion, l.repeticiones, seccion));
  const nombre = l.revisor?.nombre ?? "otra persona";

  let contenido;
  if (l.estado === "enviado") {
    contenido = (
      <>
        <p className="text-cuerpo">Nadie ha tomado este levantamiento. Tómelo para corregirlo y marcarlo revisado.</p>
        <Boton variante="principal" cargando={tomar.isPending} onClick={() => tomar.mutate({ id: l.id, version: l.version })}>
          Tomar para revisar
        </Boton>
      </>
    );
  } else if (l.estado === "revisado") {
    contenido = (
      <>
        <p className="text-cuerpo">
          Revisado por {l.revisor?.nombre ?? "[Sin responsable]"}.{" "}
          {l.visita ? "Ya se puede incluir en el informe de su visita." : "No tiene visita, así que no entra en un informe."}
        </p>
        {l.visita && <AbrirInforme visitaId={l.visita.id} />}
      </>
    );
  } else if (mia) {
    contenido = (
      <>
        <p className="text-cuerpo">Usted tiene la revisión. Corrija lo que haga falta y márquelo revisado cuando esté listo.</p>
        <Boton variante="principal" onClick={() => setConfirmando("revisado")}>
          Marcar revisado
        </Boton>
      </>
    );
  } else {
    contenido = (
      <>
        <p className="text-cuerpo">La revisión la tiene {nombre}.</p>
        <Boton onClick={() => setConfirmando("reasignar")}>Tomar la revisión de {nombre}</Boton>
      </>
    );
  }

  return (
    <section aria-label="Revisión" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5 [&>button]:self-start">
      <h2 className="text-subtitulo font-extrabold">Revisión</h2>
      {contenido}
      {error && (
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
            <Boton className="mt-3" icono={RefreshCw} onClick={recargar}>
              Recargar
            </Boton>
          )}
        </Aviso>
      )}
      {confirmando === "revisado" && (
        <Confirmacion
          titulo="¿Marcar revisado?"
          confirmar="Marcar revisado"
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={() => marcar.mutateAsync(l.version)}
        >
          <p>Ya no se podrá corregir desde oficina, y queda listo para el informe de su visita.</p>
        </Confirmacion>
      )}
      {confirmando === "reasignar" && (
        <Confirmacion
          titulo={`¿Quitarle la revisión a ${nombre}?`}
          confirmar="Tomar la revisión"
          mensajeDeError={mensajeDeError}
          alCerrar={() => setConfirmando(null)}
          accion={() => tomar.mutateAsync({ id: l.id, version: l.version, reasignar: true })}
        >
          <p>Si tiene cambios sin guardar, los perderá. El cambio de responsable queda registrado.</p>
        </Confirmacion>
      )}
    </section>
  );
}

function AbrirInforme({ visitaId }: { visitaId: string }) {
  const abrir = useAbrirInformeDeVisita();
  const navegar = useNavigate();
  return (
    <div className="flex flex-col gap-2">
      <Boton
        variante="principal"
        icono={FileText}
        className="self-start"
        cargando={abrir.isPending}
        onClick={() => abrir.mutate(visitaId, { onSuccess: ({ id }) => void navegar({ to: "/informes/$id", params: { id } }) })}
      >
        Abrir el informe de esta visita
      </Boton>
      {abrir.isError && <Aviso tono="error">{mensajeDeError(abrir.error)}</Aviso>}
    </div>
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

  const acciones = !corrigiendo && (
    <div className="flex shrink-0 gap-1">
      {mia && campo.tipo !== "foto" && campo.tipo !== "boceto" && (
        <Boton variante="fantasma" tamano="pequeno" icono={Pencil} aria-label={`Corregir ${campo.etiqueta.toLowerCase()}`} onClick={() => setCorrigiendo(true)}>
          Corregir
        </Boton>
      )}
      <Boton variante="fantasma" tamano="pequeno" icono={MessageSquare} aria-label={`Comentar ${campo.etiqueta.toLowerCase()}`} onClick={comentar}>
        Comentar
      </Boton>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 grow">
      {campo.tipo === "foto" && Array.isArray(valor) ? (
        <Fotos etiqueta={campo.etiqueta} huellas={valor as readonly string[]} />
      ) : campo.tipo === "boceto" && esBoceto(valor) ? (
        <BocetoDeCampo etiqueta={campo.etiqueta} huella={valor.boceto} />
      ) : campo.tipo === "cantidades" && esCantidades(valor) ? (
        <LineasDeCantidad l={l} seccion={seccion} campo={campo} lineas={valor} mia={mia} recargar={recargar} />
      ) : (
        <ValorLeido etiqueta={campo.etiqueta}>
          <span className={valor === undefined || esNoObtenido(valor) ? "text-texto-secundario" : ""}>{describirValor(campo, valor)}</span>
        </ValorLeido>
      )}
        </div>
        {acciones}
      </div>
      {corrigiendo && <EditorCorreccion l={l} seccion={seccion} campo={campo} valor={valor} cerrar={() => setCorrigiendo(false)} recargar={recargar} />}
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
      case "cantidades": {
        const lineas = esCantidades(valor) ? valor : [];
        return (
          <CorregirCantidades
            etiqueta={`Líneas corregidas de ${campo.etiqueta.toLowerCase()}`}
            inicial={lineas}
            unidades={campo.unidades}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={setNuevo}
          />
        );
      }
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-4 rounded-panel border-2 border-borde-activo bg-panel-hundido p-4">
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
            <Boton className="mt-3" icono={RefreshCw} onClick={recargar}>
              Recargar
            </Boton>
          )}
        </Aviso>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton onClick={cerrar} disabled={corregir.isPending}>
          Cancelar
        </Boton>
        <Boton variante="principal" cargando={corregir.isPending} disabled={!valido} onClick={() => void guardar()}>
          Guardar corrección
        </Boton>
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
  const etiqueta = (seccion?: string, campo?: string) => (seccion && campo ? nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo, true) : undefined);

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
    <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-4 rounded-panel border border-division bg-panel p-5">
      <h2 id="titulo-comentarios" className="text-subtitulo font-extrabold">
        Comentarios al técnico
      </h2>
      {l.comentarios.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Sin comentarios. El técnico los ve en su teléfono en la siguiente sincronización.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {l.comentarios.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-control bg-panel-hundido px-3 py-2">
              <p className="text-ayuda text-texto-secundario">
                {c.autor.nombre} · {aFechaHora(c.creadoEn)}
                {c.campo && ` · Sobre ${etiqueta(c.seccion, c.campo) ?? c.campo}`}
              </p>
              <p className="text-cuerpo whitespace-pre-line">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3">
        {destino && (
          <p className="flex items-center justify-between gap-2 rounded-control bg-superficie-suave py-1 pr-1 pl-3 text-ayuda">
            <span>
              Sobre <strong>{destino.etiqueta.toLowerCase()}</strong>
            </span>
            <BotonIcono icono={X} etiqueta="Comentar en general" tamano="pequeno" onClick={quitarDestino} />
          </p>
        )}
        <CampoTextoLargo ref={refCampo} etiqueta="Nuevo comentario" valor={texto} onCambio={setTexto} maximo={2000} />
        {comentar.isError && <Aviso tono="error">{mensajeDeError(comentar.error)}</Aviso>}
        <Boton className="self-start" icono={MessageSquare} cargando={comentar.isPending} disabled={!texto.trim()} onClick={() => void enviar()}>
          Enviar comentario
        </Boton>
      </div>
    </section>
  );
}

/** Id de una línea nueva: 8 caracteres en base 36, como los que genera campo. */
const nuevoIdDeLinea = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");

/**
 * Las líneas de cantidad corregidas: la cantidad se escribe como la lee una persona ("12,5") y se guarda
 * como decimal canónico; si no se puede leer, va tal cual y el servidor la marca.
 */
function CorregirCantidades({
  etiqueta,
  inicial,
  unidades,
  deshabilitado,
  error,
  onCambio,
}: {
  etiqueta: string;
  inicial: readonly LineaCantidad[];
  unidades: readonly string[];
  deshabilitado: boolean;
  error: string | undefined;
  onCambio: (valor: Valor | undefined) => void;
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>(() => inicial.map((l) => ({ ...l, cantidad: l.cantidad.replace(".", ","), observacion: l.observacion ?? "" })));
  if (deshabilitado) return null;
  function cambiar(nuevas: LineaEditable[]) {
    setLineas(nuevas);
    onCambio(
      nuevas.length === 0
        ? undefined
        : nuevas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: normalizarDecimal(l.cantidad) ?? l.cantidad,
            unidad: l.unidad,
            ...(l.observacion.trim() ? { observacion: l.observacion.trim() } : {}),
          })),
    );
  }
  return <EditorCantidades etiqueta={etiqueta} lineas={lineas} unidades={unidades} onCambio={cambiar} nuevoId={nuevoIdDeLinea} error={error} />;
}

/**
 * Tabla de cantidades con su vínculo al catálogo (iteración 11). Quien tiene la revisión elige el ítem
 * de cada línea; el técnico escribió texto libre y no lo elige (regla 6).
 */
function LineasDeCantidad({
  l,
  seccion,
  campo,
  lineas,
  mia,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  lineas: readonly LineaCantidad[];
  mia: boolean;
  recargar: () => void;
}) {
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: mia });
  const vincular = useVincular(l.id);
  const vinculoDe = (linea: string) => l.vinculos.find((v) => v.seccion === seccion && v.campo === campo.clave && v.linea === linea)?.item;

  function celda(linea: string) {
    const actual = vinculoDe(linea);
    if (!mia) {
      return actual ? `${actual.codigo} · ${actual.descripcion}` : <span className="text-texto-secundario">Sin vincular</span>;
    }
    if (catalogo.isPending) return <span className="text-texto-secundario">Cargando el catálogo…</span>;
    if (catalogo.isError) return <span className="text-error">No se pudo cargar el catálogo</span>;
    const activos = catalogo.data.items.filter((i) => i.activo || i.id === actual?.id);
    if (activos.length === 0) return <span className="text-texto-secundario">El catálogo está vacío</span>;
    const numero = lineas.findIndex((x) => x.id === linea) + 1;
    return (
      <CampoSeleccion
        etiqueta={`Ítem del catálogo para la línea ${numero}`}
        etiquetaOculta
        vacio="Sin vincular"
        valor={actual?.id ?? ""}
        deshabilitado={vincular.isPending}
        onCambio={(itemId) => vincular.mutate({ version: l.version, seccion, campo: campo.clave, linea, itemId: itemId || null })}
        opciones={activos.map((i) => ({ valor: i.id, texto: `${i.codigo} · ${i.descripcion} (${i.unidad})` }))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TablaCantidades etiqueta={campo.etiqueta} lineas={lineas} extra={{ titulo: "Catálogo", celda }} />
      {vincular.isError && (
        <Aviso tono="error">
          <p>{mensajeDeError(vincular.error)}</p>
          {pideRecargar(vincular.error) && (
            <Boton className="mt-3" icono={RefreshCw} onClick={recargar}>
              Recargar
            </Boton>
          )}
        </Aviso>
      )}
    </div>
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
  linea_vinculada: "Vinculó al catálogo",
};

/** Historial legible por campo (ADR-0008), con la verificación de la cadena. */
function Historial({ l }: { l: Levantamiento }) {
  const { id, formatoDefinicion: formato, repeticiones } = l;
  const historial = useQuery(consultas.historial(id));
  const vinculadas = historial.data?.eventos.some((e) => e.tipo === "linea_vinculada") ?? false;
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: vinculadas });
  const codigoDe = (itemId: string | null | undefined) => (itemId ? (catalogo.data?.items.find((i) => i.id === itemId)?.codigo ?? "un ítem") : "sin vincular");
  const descripcionDeLinea = (seccion: string | undefined, clave: string | undefined, linea: string | undefined) => {
    const valor = seccion && clave ? l.respuestas[seccion]?.[clave] : undefined;
    return (esCantidades(valor) ? valor.find((x) => x.id === linea)?.descripcion : undefined) ?? "una línea quitada";
  };
  const campo = (seccion?: string, clave?: string) => (seccion && clave ? campoDeRuta(formato, repeticiones, seccion, clave) : undefined);
  const nombreDe = (seccion: string | undefined, definicion: DefinicionCampo) =>
    seccion ? nombreDeDato(formato, repeticiones, seccion, definicion.clave, true) : definicion.etiqueta.toLowerCase();

  return (
    <section aria-labelledby="titulo-historial" className="flex flex-col gap-4 rounded-panel border border-division bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-historial" className="text-subtitulo font-extrabold">
          Historial de cambios
        </h2>
        {historial.data && (
          <Insignia tono={historial.data.integra ? "exito" : "peligro"}>{historial.data.integra ? "Historial íntegro" : "El historial fue alterado fuera del sistema"}</Insignia>
        )}
      </div>
      {historial.isPending ? (
        <div aria-busy="true" aria-label="Cargando el historial" className="h-28 rounded-panel bg-fondo motion-safe:animate-pulse" />
      ) : historial.isError ? (
        <Aviso tono="error">
          <p>No se pudo cargar el historial.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void historial.refetch()}>
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
              detalle = `${nombreDe(e.seccion, definicion)}: ${describirValor(definicion, e.anterior as Valor | undefined)} → ${describirValor(definicion, e.nuevo as Valor | undefined)}`;
            } else if (e.tipo === "revision_reasignada" && revisorAnterior) {
              detalle = `que tenía ${revisorAnterior}`;
            } else if (e.tipo === "linea_vinculada") {
              const antes = e.anterior as { linea?: string; item?: string | null } | undefined;
              const despues = e.nuevo as { linea?: string; item?: string | null } | undefined;
              detalle = `“${descripcionDeLinea(e.seccion, e.campo, despues?.linea)}”: ${codigoDe(antes?.item)} → ${codigoDe(despues?.item)}`;
            } else if (e.tipo === "comentario_agregado") {
              detalle = `${definicion ? `sobre ${nombreDe(e.seccion, definicion)}: ` : ""}“${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
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

/** Boceto (ADR-0019): el servidor entrega el documento ya verificado y se dibuja con los tokens. */
function BocetoDeCampo({ etiqueta, huella }: { etiqueta: string; huella: string }) {
  const boceto = useQuery(consultas.boceto(huella));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      {boceto.isPending ? (
        <div aria-busy="true" aria-label="Cargando el boceto" className="aspect-[4/3] max-w-xl rounded-control bg-fondo motion-safe:animate-pulse" />
      ) : boceto.isError ? (
        <Aviso tono="error">
          <p>No se pudo cargar el boceto.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void boceto.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : (
        <div className="max-w-xl">
          <Boceto ancho={boceto.data.ancho} alto={boceto.data.alto} cuadricula={boceto.data.cuadricula} elementos={boceto.data.elementos} etiqueta={`Boceto de ${etiqueta.toLowerCase()}`} className="rounded-control border border-division" />
        </div>
      )}
    </div>
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
        <Boton className="mt-3" icono={RefreshCw} onClick={() => urls.forEach((u) => void u.refetch())}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }
  const fotos = urls.map((u, i) => ({ id: huellas[i]!, url: u.data!.url }));
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
