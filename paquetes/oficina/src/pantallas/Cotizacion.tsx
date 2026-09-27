import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useBlocker } from "@tanstack/react-router";
import { aDecimalColombiano, calcularTotales, normalizarDecimal, PORCENTAJE, type Impuestos, type LineaDeCotizacion } from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  BotonIcono,
  CampoEnTabla,
  CampoTexto,
  CampoTextoLargo,
  CeldaTabla,
  Confirmacion,
  Dialogo,
  Download,
  EncabezadoPagina,
  EsqueletoBloques,
  FilaTabla,
  GrupoDeOpciones,
  Insignia,
  Plus,
  RefreshCw,
  Send,
  Tabla,
  Trash,
  useNotificar,
} from "@teins/ui";
import { cliente } from "../api";
import { consultasDeCotizaciones, mensajeDeCotizacion, useAccionDeCotizacion } from "../cotizaciones";
import { aFechaHora, leerPesos, pesos } from "../formato";
import { consultasDeProgramacion } from "../programacion";
import { Destinatarios, PanelEnvios, receptores } from "./Envios";

type Cotizacion = Respuesta<"obtenerCotizacion">;

/** Lo que se edita: cantidad y precio como se escriben ("12,5", "4.800"), hasta guardar. */
interface LineaEditable extends Omit<LineaDeCotizacion, "cantidad" | "precio"> {
  cantidad: string;
  precio: string;
}

interface Borrador {
  lineas: LineaEditable[];
  impuestos: Impuestos;
  validez: string;
  formaPago: string;
  notas: string;
}

const migas = (
  <Link to="/cotizaciones" className="hover:text-texto hover:underline focus-visible:outline-3 focus-visible:outline-superficie">
    Cotizaciones
  </Link>
);

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));
const AIU_INICIAL = { tipo: "aiu" as const, administracion: "10", imprevistos: "3", utilidad: "5" };

/** Id de una línea nueva: 8 caracteres, como las de las cantidades. */
const idNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

const comoEditable = (l: LineaDeCotizacion): LineaEditable => ({ ...l, cantidad: aDecimalColombiano(l.cantidad), precio: l.precio === null ? "" : l.precio.toLocaleString("es-CO") });

/** Cantidad canónica mayor que cero, o null. */
function cantidadDe(texto: string): string | null {
  const c = normalizarDecimal(texto);
  return c && !/^0(\.0*)?$/.test(c) ? c : null;
}

/** Del texto que se edita a lo que guarda el servidor; null si algo no se puede guardar todavía. */
function comoLinea(l: LineaEditable): LineaDeCotizacion | null {
  const cantidad = cantidadDe(l.cantidad);
  const precio = leerPesos(l.precio);
  if (!cantidad || precio === undefined || l.descripcion.trim() === "" || l.unidad.trim() === "") return null;
  return { ...l, descripcion: l.descripcion.trim(), unidad: l.unidad.trim(), cantidad, precio };
}

const errorDeLinea = (l: LineaEditable) => ({
  cantidad: cantidadDe(l.cantidad) ? undefined : "Mayor que cero",
  precio: l.precio.trim() === "" ? "Escriba el precio" : leerPesos(l.precio) === undefined ? "Pesos enteros" : undefined,
  descripcion: l.descripcion.trim() === "" ? "Falta" : undefined,
  unidad: l.unidad.trim() === "" ? "Falta" : undefined,
});

const inicial = (c: Cotizacion): Borrador => ({
  lineas: c.lineas.map(comoEditable),
  impuestos: c.impuestos,
  validez: String(c.condiciones.validezDias),
  formaPago: c.condiciones.formaPago,
  notas: c.condiciones.notas,
});

export function DetalleCotizacion({ id }: { id: string }) {
  const consulta = useQuery({
    ...consultasDeCotizaciones.detalle(id),
    // Mientras un PDF se genera o un envío espera su confirmación, se vuelve a leer sola (ADR-0013, ADR-0028).
    refetchInterval: (q) => {
      const versiones = q.state.data?.versiones ?? [];
      if (versiones.some((v) => v.pdf === "generando" || v.envios.some((e) => e.estado === "en_cola"))) return 3_000;
      const hace10Minutos = Date.now() - 10 * 60_000;
      return versiones.some((v) => v.envios.some((e) => e.estado === "enviado" && e.enviadoEn !== null && Date.parse(e.enviadoEn) > hace10Minutos)) ? 10_000 : false;
    },
  });

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cotización" />
        <EsqueletoBloques etiqueta="Cargando la cotización" altos={["alto", "medio"]} />
      </>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cotización" />
        <Aviso tono="error">
          <p>{noExiste ? "Esta cotización no existe o no pertenece a su organización." : "No se pudo cargar la cotización."}</p>
          {!noExiste && (
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }
  // Se reinicia con cada versión guardada del servidor (key = versión).
  return <Composicion key={consulta.data.version} c={consulta.data} recargar={() => void consulta.refetch()} />;
}

function Composicion({ c, recargar }: { c: Cotizacion; recargar: () => void }) {
  const notificar = useNotificar();
  const [borrador, setBorrador] = useState<Borrador>(() => inicial(c));
  const [confirmando, setConfirmando] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[] | null>(null);
  const contactos = useQuery(consultasDeProgramacion.cliente(c.clienteId));
  const cambiado = JSON.stringify(borrador) !== JSON.stringify(inicial(c));
  const salida = useBlocker({ shouldBlockFn: () => cambiado, enableBeforeUnload: () => cambiado, withResolver: true });

  const actualizar = (cambio: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambio }));
  const cambiarLinea = (id: string, cambio: Partial<LineaEditable>) => actualizar({ lineas: borrador.lineas.map((l) => (l.id === id ? { ...l, ...cambio } : l)) });

  const lineas = borrador.lineas.map(comoLinea);
  const validas = lineas.filter((l): l is LineaDeCotizacion => l !== null);
  const totales = calcularTotales(validas, borrador.impuestos);
  const totalPorId = new Map(validas.map((l, i) => [l.id, totales.lineas[i]]));
  const sinPrecio = borrador.lineas.filter((l) => l.precio.trim() === "").length;
  const conError = borrador.lineas.filter((l) => {
    const e = errorDeLinea(l);
    return e.cantidad || e.descripcion || e.unidad || (e.precio && e.precio !== "Escriba el precio");
  }).length;
  const validez = Number(borrador.validez);
  const validezValida = Number.isInteger(validez) && validez >= 1 && validez <= 365;
  const porcentajesValidos = borrador.impuestos.tipo === "iva" || [borrador.impuestos.administracion, borrador.impuestos.imprevistos, borrador.impuestos.utilidad].every((p) => PORCENTAJE.test(p) && Number(p) <= 100);
  const guardable = conError === 0 && validezValida && porcentajesValidos;

  const cuerpo = () => ({
    lineas: lineas.filter((l): l is LineaDeCotizacion => l !== null),
    impuestos: borrador.impuestos,
    condiciones: { validezDias: validez, formaPago: borrador.formaPago.trim(), notas: borrador.notas.trim() },
  });
  const guardar = useAccionDeCotizacion((version: number) => cliente.llamar("guardarCotizacion", { parametros: { id: c.id }, cuerpo: { version, ...cuerpo() } }));
  const publicar = useAccionDeCotizacion(({ version, destinatarios }: { version: number; destinatarios: string[] }) =>
    cliente.llamar("publicarCotizacion", { parametros: { id: c.id }, cuerpo: { version, destinatarios } }),
  );
  const elegidos = destinatarios ?? (contactos.data ? receptores(contactos.data.contactos, "cotizaciones") : []);
  const error = guardar.error ?? publicar.error;
  const siguiente = (c.versiones[0]?.numero ?? 0) + 1;
  const vigente = c.versiones[0];

  async function guardarYPublicar() {
    // Lo que se publica es lo guardado: si hay cambios, primero se guardan.
    const { version } = cambiado ? await guardar.mutateAsync(c.version) : { version: c.version };
    await publicar.mutateAsync({ version, destinatarios: elegidos });
  }

  function quitar(linea: LineaEditable) {
    const posicion = borrador.lineas.findIndex((l) => l.id === linea.id);
    actualizar({ lineas: borrador.lineas.filter((l) => l.id !== linea.id) });
    // Se deshace fácil (DESIGN.md): al instante, con "Deshacer".
    notificar({
      texto: `Línea quitada: ${linea.descripcion || "sin descripción"}`,
      accion: { texto: "Deshacer", alHacer: () => setBorrador((b) => ({ ...b, lineas: [...b.lineas.slice(0, posicion), linea, ...b.lineas.slice(posicion)] })) },
    });
  }

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={`Cotización ${c.numero}`}
        estado={vigente ? <Insignia tono="publicado">{`Versión ${vigente.numero} vigente`}</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
        descripcion={`${c.visita.cliente} · ${c.visita.sitio} · ${c.visita.direccion} · visita del ${dia(c.visita.programadaPara)}`}
      />
      {/* Las líneas necesitan el ancho: el panel va al lado solo en monitores anchos; si no, debajo y en dos columnas. */}
      <div className="grid items-start gap-6 min-[1600px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="titulo-lineas" className="flex flex-col gap-4 rounded-panel border border-division bg-panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="titulo-lineas" className="text-subtitulo font-extrabold">
                  Líneas
                </h2>
                <p className="text-ayuda text-texto-secundario">De las cantidades revisadas, sumadas por ítem del catálogo. El precio sale de la lista de precios; se puede cambiar solo para esta cotización.</p>
              </div>
              <Boton
                variante="fantasma"
                tamano="pequeno"
                icono={Plus}
                onClick={() => actualizar({ lineas: [...borrador.lineas, { id: idNuevo(), itemId: null, codigo: null, descripcion: "", cantidad: "1", unidad: "gl", precio: "", precioCatalogo: null, origen: "oficina" }] })}
              >
                Agregar línea
              </Boton>
            </div>
            {borrador.lineas.length === 0 ? (
              <p className="text-cuerpo text-texto-secundario">Sin líneas. Agregue al menos una para publicar.</p>
            ) : (
              <Tabla
                etiqueta={`Líneas de la cotización ${c.numero}`}
                columnas={[
                  { titulo: "Código" },
                  { titulo: "Descripción" },
                  { titulo: "Cantidad", derecha: true },
                  { titulo: "Unidad" },
                  { titulo: "Precio unitario", derecha: true },
                  { titulo: "Total", derecha: true },
                  { titulo: "Quitar", oculto: true },
                ]}
              >
                {borrador.lineas.map((l) => {
                  const e = errorDeLinea(l);
                  const nombre = l.descripcion.trim() || "la línea nueva";
                  const precio = leerPesos(l.precio);
                  const total = totalPorId.get(l.id);
                  return (
                    <FilaTabla key={l.id}>
                      <CeldaTabla>{l.codigo ? <strong className="whitespace-nowrap">{l.codigo}</strong> : null}</CeldaTabla>
                      <CeldaTabla>
                        {l.origen === "oficina" ? (
                          <CampoEnTabla etiqueta={`Descripción de ${nombre}`} valor={l.descripcion} onCambio={(v) => cambiarLinea(l.id, { descripcion: v })} error={e.descripcion} ancho="w-full" />
                        ) : (
                          <span className="flex flex-col">
                            <span>{l.descripcion}</span>
                            {l.precioCatalogo !== null && precio !== undefined && precio !== null && precio !== l.precioCatalogo ? (
                              <span className="text-ayuda font-bold text-alerta-texto">{`Catálogo: ${pesos(l.precioCatalogo)}`}</span>
                            ) : (
                              <span className="text-ayuda text-texto-secundario">{l.itemId ? "Del catálogo" : "Sin vincular"}</span>
                            )}
                          </span>
                        )}
                        {l.origen === "oficina" && <span className="text-ayuda text-texto-secundario">Agregada en oficina</span>}
                      </CeldaTabla>
                      <CeldaTabla derecha>
                        <CampoEnTabla etiqueta={`Cantidad de ${nombre}`} valor={l.cantidad} onCambio={(v) => cambiarLinea(l.id, { cantidad: v })} error={e.cantidad} numerico modoEntrada="decimal" ancho="w-20" />
                      </CeldaTabla>
                      <CeldaTabla>
                        {l.origen === "oficina" ? <CampoEnTabla etiqueta={`Unidad de ${nombre}`} valor={l.unidad} onCambio={(v) => cambiarLinea(l.id, { unidad: v })} error={e.unidad} ancho="w-16" /> : l.unidad}
                      </CeldaTabla>
                      <CeldaTabla derecha>
                        <CampoEnTabla etiqueta={`Precio de ${nombre}`} valor={l.precio} onCambio={(v) => cambiarLinea(l.id, { precio: v })} error={e.precio} numerico modoEntrada="numeric" ancho="w-28" />
                      </CeldaTabla>
                      <CeldaTabla derecha>{total === null || total === undefined ? null : <strong className="tabular-nums">{pesos(total)}</strong>}</CeldaTabla>
                      <CeldaTabla>
                        <BotonIcono icono={Trash} tamano="pequeno" etiqueta={`Quitar ${nombre}`} onClick={() => quitar(l)} />
                      </CeldaTabla>
                    </FilaTabla>
                  );
                })}
              </Tabla>
            )}
          </section>

          <section aria-labelledby="titulo-condiciones" className="flex flex-col gap-4 rounded-panel border border-division bg-panel p-6">
            <h2 id="titulo-condiciones" className="text-subtitulo font-extrabold">
              Condiciones
            </h2>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <CampoTexto etiqueta="Validez (días)" valorInicial={borrador.validez} onCambio={(v) => actualizar({ validez: v })} modoEntrada="numeric" error={validezValida ? undefined : "De 1 a 365 días"} />
              <CampoTexto etiqueta="Forma de pago" valorInicial={borrador.formaPago} onCambio={(v) => actualizar({ formaPago: v })} />
            </div>
            <CampoTextoLargo etiqueta="Notas para el cliente" valor={borrador.notas} onCambio={(v) => actualizar({ notas: v })} filas={3} maximo={2000} />
          </section>
        </div>

        <aside aria-label="Totales y publicación" className="grid items-start gap-4 lg:grid-cols-2 min-[1600px]:sticky min-[1600px]:top-8 min-[1600px]:grid-cols-1">
          <section aria-labelledby="titulo-totales" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
            <h2 id="titulo-totales" className="text-subtitulo font-extrabold">
              Totales
            </h2>
            <GrupoDeOpciones
              etiqueta="Impuestos"
              valor={borrador.impuestos.tipo}
              onCambio={(tipo) => actualizar({ impuestos: tipo === "iva" ? { tipo: "iva" } : AIU_INICIAL })}
              opciones={[
                { valor: "iva", texto: "IVA 19 % sobre el subtotal" },
                { valor: "aiu", texto: "AIU, con IVA sobre la utilidad" },
              ]}
            />
            {borrador.impuestos.tipo === "aiu" && (
              <div className="flex flex-col gap-2 pl-8">
                {(["administracion", "imprevistos", "utilidad"] as const).map((campo) => {
                  const valor = borrador.impuestos.tipo === "aiu" ? borrador.impuestos[campo] : "";
                  const texto = { administracion: "Administración", imprevistos: "Imprevistos", utilidad: "Utilidad" }[campo];
                  return (
                    <div key={campo} className="flex items-center justify-between gap-2">
                      <span>{texto}</span>
                      <span className="flex items-center gap-1.5">
                        <CampoEnTabla
                          etiqueta={`Porcentaje de ${texto.toLowerCase()}`}
                          valor={valor.replace(".", ",")}
                          onCambio={(v) => borrador.impuestos.tipo === "aiu" && actualizar({ impuestos: { ...borrador.impuestos, [campo]: v.trim().replace(",", ".") } })}
                          error={PORCENTAJE.test(valor) && Number(valor) <= 100 ? undefined : "De 0 a 100"}
                          numerico
                          modoEntrada="decimal"
                          ancho="w-16"
                        />
                        %
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-ayuda text-texto-secundario">El contador de TEINS decide cuál aplica. La DIAN no admite AIU en instalación ni mantenimiento de redes eléctricas.</p>
            <dl className="flex flex-col gap-1.5 border-t border-division pt-3">
              <Total nombre="Subtotal" valor={totales.subtotal} nota={sinPrecio > 0 ? `Sin contar ${sinPrecio === 1 ? "la línea" : `las ${sinPrecio} líneas`} sin precio` : undefined} />
              {borrador.impuestos.tipo === "iva" ? (
                <Total nombre="IVA 19 %" valor={totales.iva} />
              ) : (
                porcentajesValidos &&
                totales.aiu && (
                  <>
                    <Total nombre={`Administración ${borrador.impuestos.administracion.replace(".", ",")} %`} valor={totales.aiu.administracion} />
                    <Total nombre={`Imprevistos ${borrador.impuestos.imprevistos.replace(".", ",")} %`} valor={totales.aiu.imprevistos} />
                    <Total nombre={`Utilidad ${borrador.impuestos.utilidad.replace(".", ",")} %`} valor={totales.aiu.utilidad} />
                    <Total nombre="IVA 19 % sobre la utilidad" valor={totales.aiu.ivaUtilidad} />
                  </>
                )
              )}
              {porcentajesValidos && <Total nombre="Total" valor={totales.total} fuerte />}
            </dl>
          </section>

          <section aria-labelledby="titulo-publicacion" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
            <h2 id="titulo-publicacion" className="text-subtitulo font-extrabold">
              Publicación
            </h2>
            <p className={`text-ayuda ${sinPrecio > 0 || !guardable ? "font-bold text-alerta-texto" : cambiado ? "font-bold text-alerta-texto" : "text-texto-secundario"}`} aria-live="polite">
              {!guardable
                ? "Revise los campos marcados."
                : sinPrecio > 0
                  ? `Faltan precios en ${sinPrecio === 1 ? "una línea" : `${sinPrecio} líneas`}.`
                  : borrador.lineas.length === 0
                    ? "Agregue al menos una línea."
                    : cambiado
                      ? "Hay cambios sin guardar."
                      : "Todo está guardado."}
            </p>
            {error && (
              <Aviso tono="error">
                <p>{mensajeDeCotizacion(error)}</p>
                {error instanceof ErrorApi && error.codigo === "conflicto_de_version" && (
                  <Boton className="mt-3" icono={RefreshCw} onClick={recargar}>
                    Recargar
                  </Boton>
                )}
              </Aviso>
            )}
            <div className="flex flex-col gap-2">
              <Boton
                variante="principal"
                icono={Send}
                disabled={!guardable || sinPrecio > 0 || borrador.lineas.length === 0}
                onClick={() => {
                  setDestinatarios(null);
                  setConfirmando(true);
                }}
              >
                {`Publicar versión ${siguiente}`}
              </Boton>
              <Boton disabled={!cambiado || !guardable} cargando={guardar.isPending} onClick={() => guardar.mutate(c.version)}>
                {cambiado ? "Guardar borrador" : "Borrador guardado"}
              </Boton>
            </div>
          </section>

          {vigente && (
            <PanelEnvios
              cliente={{ id: c.clienteId, nombre: c.visita.cliente }}
              version={vigente}
              contactos={contactos.data?.contactos}
              enviar={(destinos) => cliente.llamar("enviarCotizacion", { parametros: { id: c.id, numero: vigente.numero }, cuerpo: { destinos } })}
              recargar={recargar}
            />
          )}
          <Versiones c={c} />
        </aside>
      </div>

      {confirmando && (
        <Confirmacion
          titulo={`¿Publicar la versión ${siguiente} de ${c.numero}?`}
          confirmar={elegidos.length > 0 ? `Publicar y enviar a ${elegidos.length}` : `Publicar versión ${siguiente}`}
          peligro
          mensajeDeError={mensajeDeCotizacion}
          alCerrar={() => setConfirmando(false)}
          alTerminar={() => notificar({ texto: elegidos.length > 0 ? `Versión ${siguiente} publicada. Se envía cuando el PDF esté listo.` : `Versión ${siguiente} publicada. El PDF se está generando.` })}
          accion={guardarYPublicar}
        >
          <p>Queda congelada con sus precios e impuestos: cambiar la lista de precios después no la afecta. Para corregir algo se publica una versión nueva, y la anterior se conserva.</p>
          {contactos.isPending ? (
            <p className="text-ayuda text-texto-secundario">Cargando los contactos del cliente…</p>
          ) : contactos.isError ? (
            <Aviso tono="error">No se pudieron cargar los contactos: se publicará sin enviar. Podrá enviarla después desde "Envíos".</Aviso>
          ) : (
            <Destinatarios contactos={contactos.data.contactos} elegidos={elegidos} alCambiar={setDestinatarios} cliente={{ id: c.clienteId, nombre: c.visita.cliente }} titulo="Enviar el PDF cuando esté listo" />
          )}
          {elegidos.length > 0 && <p className="text-ayuda text-texto-secundario">Solo están marcados quienes reciben cotizaciones. Lo enviado no se puede recuperar.</p>}
        </Confirmacion>
      )}
      {salida.status === "blocked" && (
        <Dialogo
          titulo="¿Salir sin guardar?"
          alCerrar={salida.reset}
          pie={
            <>
              <Boton onClick={salida.reset}>Seguir editando</Boton>
              <Boton variante="peligro" onClick={salida.proceed}>
                Salir sin guardar
              </Boton>
            </>
          }
        >
          <p className="text-cuerpo">Los cambios del borrador que no guardó se pierden.</p>
        </Dialogo>
      )}
    </>
  );
}

function Total({ nombre, valor, fuerte = false, nota }: { nombre: string; valor: number; fuerte?: boolean; nota?: string | undefined }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "border-t border-division pt-2 text-subtitulo font-extrabold" : ""}`}>
      <dt className="flex flex-col">
        <span>{nombre}</span>
        {nota && <span className="text-ayuda font-normal text-texto-secundario">{nota}</span>}
      </dt>
      <dd className="font-bold whitespace-nowrap tabular-nums">{pesos(valor)}</dd>
    </div>
  );
}

function Versiones({ c }: { c: Cotizacion }) {
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);

  async function descargar(numero: number) {
    setDescargando(numero);
    setErrorDescarga(false);
    try {
      const { url } = await cliente.llamar("pdfDeCotizacion", { parametros: { id: c.id, numero } });
      // El enlace firmado descarga el archivo: la pantalla no cambia.
      window.location.assign(url);
    } catch {
      setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <section aria-labelledby="titulo-versiones" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
      <h2 id="titulo-versiones" className="text-subtitulo font-extrabold">
        Versiones publicadas
      </h2>
      {c.versiones.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-division">
          {c.versiones.map((v, i) => (
            <li key={v.numero} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-cuerpo font-bold">
                  {`Versión ${v.numero}`}
                  {i === 0 && <Insignia tono="exito">Vigente</Insignia>}
                </p>
                {v.pdf === "listo" ? (
                  <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label={`Descargar PDF de la versión ${v.numero}`} cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                    PDF
                  </Boton>
                ) : v.pdf === "generando" ? (
                  <span className="text-ayuda font-bold text-sync-pendiente" aria-live="polite">
                    Generando el PDF…
                  </span>
                ) : (
                  <span className="text-ayuda font-bold text-error">No se generó el PDF. Avísele a soporte.</span>
                )}
              </div>
              <p className="text-ayuda text-texto-secundario">
                {`Publicada el ${aFechaHora(v.publicadaEn)} por ${v.publicadaPor.nombre} · ${pesos(v.total)}${v.envios.length > 0 ? ` · ${v.envios.length === 1 ? "1 envío" : `${v.envios.length} envíos`}` : ""}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
    </section>
  );
}
