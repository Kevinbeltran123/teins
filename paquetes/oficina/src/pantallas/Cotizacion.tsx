import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { aDecimalColombiano, calcularTotales, normalizarDecimal, PORCENTAJE, type Impuestos, type LineaDeCotizacion } from "@teins/dominio";
import { ErrorApi, rutaVistaPreviaCotizacion, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  BotonIcono,
  CeldaTabla,
  ChevronLeft,
  Confirmacion,
  Download,
  EncabezadoPagina,
  EsqueletoLista,
  FilaTabla,
  Insignia,
  Plus,
  RefreshCw,
  Send,
  Tabla,
  Trash,
  useNotificar,
} from "@teins/ui";
import { cliente, esSesionVencida } from "../api";
import { useBorrador } from "../borrador";
import { useSalidaProtegida } from "../salida";
import { consultasDeCotizaciones, mensajeDeCotizacion, useAccionDeCotizacion } from "../cotizaciones";
import { aFechaCorta, leerPesos, pesos } from "../formato";
import { consultasDeProgramacion } from "../programacion";
import { Destinatarios, enLista, PanelEnvios, receptores } from "./Envios";

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
  <Link to="/cotizaciones" className="migas">
    <ChevronLeft aria-hidden size={16} />
    Cotizaciones
  </Link>
);

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`)).replace(",", "");
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
        <EsqueletoLista etiqueta="Cargando la cotización" />
      </>
    );
  }
  // Solo si nunca cargó: un error al releer (sin red, sesión vencida) deja el borrador donde está.
  if (consulta.data === undefined) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cotización" />
        <Aviso tono="error">
          <b>{noExiste ? "Esta cotización no existe o no pertenece a su organización." : "No se pudo cargar la cotización."}</b>
          {!noExiste && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
                Reintentar
              </Boton>
            </div>
          )}
        </Aviso>
      </>
    );
  }
  return <Composicion c={consulta.data} recargar={() => void consulta.refetch()} />;
}

function Composicion({ c, recargar }: { c: Cotizacion; recargar: () => void }) {
  const notificar = useNotificar();
  const { borrador, setBorrador, cambiado, version, guardado, descartar } = useBorrador(c.version, () => inicial(c));
  const [confirmando, setConfirmando] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[] | null>(null);
  const contactos = useQuery(consultasDeProgramacion.cliente(c.clienteId));
  const salida = useSalidaProtegida(cambiado, { que: `la cotización ${c.numero}`, guardar: guardarBorrador });

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
  // La sesión vencida se resuelve ingresando de nuevo encima (rutas.tsx): su error no queda a la vista después.
  const error = [guardar.error, publicar.error].find((e) => e && !esSesionVencida(e)) ?? null;
  const siguiente = (c.versiones[0]?.numero ?? 0) + 1;
  const vigente = c.versiones[0];

  async function guardarBorrador() {
    const enviado = borrador;
    const r = await guardar.mutateAsync(version);
    guardado(r.version, enviado);
    return r.version;
  }

  async function guardarYPublicar() {
    // Lo que se publica es lo guardado: si hay cambios, primero se guardan.
    const guardada = cambiado ? await guardarBorrador() : version;
    await publicar.mutateAsync({ version: guardada, destinatarios: elegidos });
  }

  // La confirmación muestra lo que se va a publicar, que es lo guardado: si hay cambios, primero se guardan.
  async function abrirPublicar() {
    if (cambiado) {
      try {
        await guardarBorrador();
      } catch {
        return;
      }
    }
    setDestinatarios(null);
    setConfirmando(true);
  }

  function recargarDescartando() {
    guardar.reset();
    publicar.reset();
    descartar();
    recargar();
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

  const primeraSinPrecio = borrador.lineas.find((l) => l.precio.trim() === "");
  const reciben = contactos.data ? contactos.data.contactos.filter((x) => receptores(contactos.data.contactos, "cotizaciones").includes(x.id)).map((x) => x.nombre) : [];
  const irALinea = (id: string) => {
    const fila = document.getElementById(`linea-${id}`);
    fila?.scrollIntoView({ behavior: "smooth", block: "center" });
    fila?.querySelector<HTMLInputElement>("[data-precio]")?.focus({ preventScroll: true });
  };

  const estado = !guardable ? (
    <span className="guardado mal" aria-live="polite">
      <i />
      Revise los campos marcados.
    </span>
  ) : primeraSinPrecio ? (
    <span className="guardado mal" aria-live="polite">
      <i />
      <button type="button" className="enlace-falta" onClick={() => irALinea(primeraSinPrecio.id)}>
        {sinPrecio === 1 ? "Falta el precio de 1 línea" : `Falta el precio de ${sinPrecio} líneas`}
      </button>
    </span>
  ) : borrador.lineas.length === 0 ? (
    <span className="guardado mal" aria-live="polite">
      <i />
      Agregue al menos una línea.
    </span>
  ) : (
    <span className={`guardado ${cambiado ? "cambios" : ""}`} aria-live="polite">
      <i />
      {cambiado ? "Cambios sin guardar" : "Todo guardado"}
    </span>
  );

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={`Cotización ${c.numero}`}
        estado={vigente ? <Insignia tono="publicado">{`Versión ${vigente.numero} vigente`}</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
        descripcion={
          <>
            <span>
              {c.visita.cliente} · {c.visita.sitio}
            </span>
            <span>Visita del {dia(c.visita.programadaPara)}</span>
            {contactos.data && (
              <span>
                Recibe el PDF: <b>{reciben.length > 0 ? enLista(reciben) : "nadie"}</b>
              </span>
            )}
          </>
        }
        acciones={
          <>
            {estado}
            {cambiado && (
              <Boton disabled={!guardable} cargando={guardar.isPending} onClick={() => void guardarBorrador().catch(() => undefined)}>
                Guardar borrador
              </Boton>
            )}
            <Boton
              variante="principal"
              icono={Send}
              disabled={!guardable || sinPrecio > 0 || borrador.lineas.length === 0}
              cargando={guardar.isPending}
              onClick={() => void abrirPublicar()}
            >
              {`Publicar versión ${siguiente}`}
            </Boton>
          </>
        }
      />
      {error && (
        <Aviso tono="error">
          <b>{mensajeDeCotizacion(error)}</b>
          {error instanceof ErrorApi && error.codigo === "conflicto_de_version" && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargarDescartando}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      <div className="con-carril">
        <div className="principal">
          <div className="doc">
            <section aria-labelledby="titulo-lineas">
              <div className="cab-sec">
                <h2 id="titulo-lineas">Líneas</h2>
              </div>
              <p className="ayuda">De las cantidades revisadas, sumadas por ítem del catálogo. El precio sale de la lista de precios; se puede cambiar solo para esta cotización.</p>
              {borrador.lineas.length === 0 ? (
                <p className="sec">Sin líneas. Agregue al menos una para publicar.</p>
              ) : (
                <Tabla
                  etiqueta={`Líneas de la cotización ${c.numero}`}
                  clase="lineas-doc"
                  columnas={[{ titulo: "Descripción" }, { titulo: "Cantidad" }, { titulo: "Unidad" }, { titulo: "Precio unitario" }, { titulo: "Total", derecha: true }, { titulo: "Quitar", oculto: true }]}
                >
                  {borrador.lineas.map((l, k) => {
                    const e = errorDeLinea(l);
                    const nombre = l.descripcion.trim() || "la línea nueva";
                    const precio = leerPesos(l.precio);
                    const total = totalPorId.get(l.id);
                    const falta = l.precio.trim() === "";
                    const difiere = l.precioCatalogo !== null && precio !== undefined && precio !== null && precio !== l.precioCatalogo;
                    return (
                      <FilaTabla key={l.id} id={`linea-${l.id}`} indice={k} clase={falta ? "sin-precio" : ""}>
                        <CeldaTabla>
                          {l.origen === "oficina" ? (
                            <>
                              <input
                                className={`control chico desc-input ${e.descripcion ? "error" : ""}`}
                                aria-label={`Descripción de ${nombre}`}
                                placeholder="Qué se cobra"
                                style={{ minWidth: 180, width: "100%" }}
                                value={l.descripcion}
                                onChange={(ev) => cambiarLinea(l.id, { descripcion: ev.target.value })}
                              />
                              <span className="origen">Agregada en oficina</span>
                            </>
                          ) : (
                            <>
                              <span className="fuerte">{l.descripcion}</span>
                              <span className={`origen ${difiere ? "difiere" : ""}`}>
                                {l.codigo ? `${l.codigo} · ` : ""}
                                {difiere ? `Catálogo: ${pesos(l.precioCatalogo!)}` : l.itemId ? "Del catálogo" : "Sin vincular"}
                              </span>
                            </>
                          )}
                        </CeldaTabla>
                        <CeldaTabla>
                          <input
                            className={`control chico num ${e.cantidad ? "error" : ""}`}
                            aria-label={`Cantidad de ${nombre}`}
                            inputMode="decimal"
                            style={{ width: 74 }}
                            value={l.cantidad}
                            onChange={(ev) => cambiarLinea(l.id, { cantidad: ev.target.value })}
                          />
                          {e.cantidad && <span className="msj-error">{e.cantidad}</span>}
                        </CeldaTabla>
                        <CeldaTabla>
                          {l.origen === "oficina" ? (
                            <input className={`control chico ${e.unidad ? "error" : ""}`} aria-label={`Unidad de ${nombre}`} style={{ width: 58 }} value={l.unidad} onChange={(ev) => cambiarLinea(l.id, { unidad: ev.target.value })} />
                          ) : (
                            <span className="sec">{l.unidad}</span>
                          )}
                        </CeldaTabla>
                        <CeldaTabla>
                          <input
                            data-precio
                            className={`control chico num ${e.precio ? "error" : ""}`}
                            aria-label={`Precio de ${nombre}`}
                            aria-invalid={e.precio ? true : undefined}
                            inputMode="numeric"
                            placeholder="Falta"
                            style={{ width: 118 }}
                            value={l.precio}
                            onChange={(ev) => cambiarLinea(l.id, { precio: ev.target.value })}
                          />
                          {e.precio && !falta && <span className="msj-error">{e.precio}</span>}
                        </CeldaTabla>
                        <CeldaTabla derecha clase="total-linea">
                          {falta ? <span className="msj-error" style={{ justifyContent: "flex-end" }}>Sin precio</span> : total === null || total === undefined ? null : pesos(total)}
                        </CeldaTabla>
                        <CeldaTabla>
                          <BotonIcono icono={Trash} tamano="pequeno" etiqueta={`Quitar ${nombre}`} onClick={() => quitar(l)} />
                        </CeldaTabla>
                      </FilaTabla>
                    );
                  })}
                </Tabla>
              )}
              <button
                type="button"
                className="agregar-fila"
                onClick={() => actualizar({ lineas: [...borrador.lineas, { id: idNuevo(), itemId: null, codigo: null, descripcion: "", cantidad: "1", unidad: "gl", precio: "", precioCatalogo: null, origen: "oficina" }] })}
              >
                <Plus aria-hidden size={18} />
                Agregar línea
              </button>
              <div className="pie-doc">
                <fieldset className="impuesto" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="etq" style={{ marginBottom: 4 }}>
                    Impuestos
                  </legend>
                  <label className="imp-op">
                    <input type="radio" name={`impuestos-${c.id}`} checked={borrador.impuestos.tipo === "iva"} onChange={() => actualizar({ impuestos: { tipo: "iva" } })} />
                    <span style={{ color: "var(--texto)" }}>
                      <b>IVA 19 %</b> sobre el subtotal
                    </span>
                  </label>
                  <label className="imp-op">
                    <input type="radio" name={`impuestos-${c.id}`} checked={borrador.impuestos.tipo === "aiu"} onChange={() => actualizar({ impuestos: AIU_INICIAL })} />
                    <span style={{ color: "var(--texto)" }}>
                      <b>AIU</b>, con IVA sobre la utilidad
                    </span>
                  </label>
                  {borrador.impuestos.tipo === "aiu" && (
                    <div className="aiu" style={{ margin: "0 0 10px 32px", maxWidth: 340 }}>
                      {(["administracion", "imprevistos", "utilidad"] as const).map((campo) => {
                        const valor = borrador.impuestos.tipo === "aiu" ? borrador.impuestos[campo] : "";
                        const texto = { administracion: "Administración", imprevistos: "Imprevistos", utilidad: "Utilidad" }[campo];
                        const malo = !(PORCENTAJE.test(valor) && Number(valor) <= 100);
                        return (
                          <div key={campo} className="campo">
                            <label htmlFor={`aiu-${campo}`}>{`${texto} %`}</label>
                            <input
                              id={`aiu-${campo}`}
                              className={`control chico num ${malo ? "error" : ""}`}
                              aria-label={`Porcentaje de ${texto.toLowerCase()}`}
                              inputMode="decimal"
                              value={valor.replace(".", ",")}
                              onChange={(ev) => borrador.impuestos.tipo === "aiu" && actualizar({ impuestos: { ...borrador.impuestos, [campo]: ev.target.value.trim().replace(",", ".") } })}
                            />
                            {malo && <span className="msj-error">De 0 a 100</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="ayuda" style={{ maxWidth: "48ch", marginTop: 8 }}>
                    El contador de TEINS decide cuál aplica. La DIAN no admite AIU en instalación ni mantenimiento de redes eléctricas.
                  </p>
                </fieldset>
                <section className="suma" aria-label="Totales">
                  <div className="f">
                    <span>Subtotal</span>
                    <b>{pesos(totales.subtotal)}</b>
                  </div>
                  {sinPrecio > 0 && (
                    <div className="f nota">
                      <span>{`Sin contar ${sinPrecio === 1 ? "la línea" : `las ${sinPrecio} líneas`} sin precio`}</span>
                    </div>
                  )}
                  {borrador.impuestos.tipo === "iva" ? (
                    <div className="f">
                      <span>IVA 19 %</span>
                      <span>{pesos(totales.iva)}</span>
                    </div>
                  ) : (
                    porcentajesValidos &&
                    totales.aiu && (
                      <>
                        <div className="f">
                          <span>{`Administración ${borrador.impuestos.administracion.replace(".", ",")} %`}</span>
                          <span>{pesos(totales.aiu.administracion)}</span>
                        </div>
                        <div className="f">
                          <span>{`Imprevistos ${borrador.impuestos.imprevistos.replace(".", ",")} %`}</span>
                          <span>{pesos(totales.aiu.imprevistos)}</span>
                        </div>
                        <div className="f">
                          <span>{`Utilidad ${borrador.impuestos.utilidad.replace(".", ",")} %`}</span>
                          <span>{pesos(totales.aiu.utilidad)}</span>
                        </div>
                        <div className="f">
                          <span>IVA 19 % sobre la utilidad</span>
                          <span>{pesos(totales.aiu.ivaUtilidad)}</span>
                        </div>
                      </>
                    )
                  )}
                  {porcentajesValidos && (
                    <div className="gran">
                      <span className="fuerte">Total</span>
                      <b key={totales.total} className="cifra-cambia">
                        {pesos(totales.total)}
                      </b>
                    </div>
                  )}
                </section>
              </div>
            </section>
            <section aria-labelledby="titulo-condiciones">
              <h2 id="titulo-condiciones">Condiciones</h2>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, marginTop: 10 }}>
                <div className="campo">
                  <label htmlFor={`validez-${c.id}`}>Validez (días)</label>
                  <input id={`validez-${c.id}`} className={`control ${validezValida ? "" : "error"}`} inputMode="numeric" value={borrador.validez} onChange={(ev) => actualizar({ validez: ev.target.value })} />
                  {!validezValida && <span className="msj-error">De 1 a 365 días</span>}
                </div>
                <div className="campo">
                  <label htmlFor={`pago-${c.id}`}>Forma de pago</label>
                  <input id={`pago-${c.id}`} className="control" value={borrador.formaPago} onChange={(ev) => actualizar({ formaPago: ev.target.value })} />
                </div>
              </div>
              <div className="campo" style={{ marginTop: 12 }}>
                <label htmlFor={`notas-${c.id}`}>Notas para el cliente</label>
                <textarea id={`notas-${c.id}`} className="control" maxLength={2000} value={borrador.notas} onChange={(ev) => actualizar({ notas: ev.target.value })} />
              </div>
            </section>
          </div>
        </div>
        <aside className="carril" aria-label="Versiones publicadas">
          <Versiones
            c={c}
            envios={
              vigente && (
                <PanelEnvios
                  cliente={{ id: c.clienteId, nombre: c.visita.cliente }}
                  version={vigente}
                  contactos={contactos.data?.contactos}
                  enviar={(destinos, llave) => cliente.llamar("enviarCotizacion", { parametros: { id: c.id, numero: vigente.numero }, cuerpo: { destinos, llave } })}
                  recargar={recargar}
                />
              )
            }
          />
        </aside>
      </div>

      {confirmando && (
        <Confirmacion
          titulo={`¿Publicar la versión ${siguiente} de ${c.numero}?`}
          confirmar={elegidos.length > 0 ? `Publicar y enviar a ${elegidos.length}` : `Publicar versión ${siguiente}`}
          nivel="irreversible"
          mensajeDeError={mensajeDeCotizacion}
          alCerrar={() => setConfirmando(false)}
          alTerminar={() => notificar({ texto: elegidos.length > 0 ? `Versión ${siguiente} publicada. Se envía cuando el PDF esté listo.` : `Versión ${siguiente} publicada. El PDF se está generando.` })}
          accion={guardarYPublicar}
        >
          <p>
            El total queda en <b style={{ color: "var(--texto)" }}>{pesos(totales.total)}</b>. Queda congelada con sus precios e impuestos: cambiar la lista de precios después no la afecta. Para corregir algo se publica una versión nueva, y la anterior se conserva.
          </p>
          {/* La plantilla del PDF con lo guardado (iteración 24). Aproximada: el PDF pagina y pone el pie. */}
          <figure className="vista-previa">
            <iframe src={rutaVistaPreviaCotizacion(c.id)} sandbox="" title={`Vista previa de la versión ${siguiente}`} />
            <figcaption className="ayuda">Vista previa aproximada: en el PDF pueden cambiar los saltos de página.</figcaption>
          </figure>
          {contactos.isPending ? (
            <p className="ayuda">Cargando los contactos del cliente…</p>
          ) : contactos.isError ? (
            <Aviso tono="error">No se pudieron cargar los contactos: se publicará sin enviar. Podrá enviarla después desde "Envíos".</Aviso>
          ) : (
            <Destinatarios contactos={contactos.data.contactos} elegidos={elegidos} alCambiar={setDestinatarios} cliente={{ id: c.clienteId, nombre: c.visita.cliente }} titulo="Enviar el PDF cuando esté listo" />
          )}
          {elegidos.length > 0 && <p className="ayuda">Solo están marcados quienes reciben cotizaciones. Lo enviado no se puede recuperar.</p>}
        </Confirmacion>
      )}
      {salida}
    </>
  );
}

function Versiones({ c, envios }: { c: Cotizacion; envios: ReactNode }) {
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
    <section className="grupo-c" aria-labelledby="titulo-versiones">
      <h2 id="titulo-versiones">Versiones publicadas</h2>
      {c.versiones.length === 0 ? (
        <p className="ayuda">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <div>
          {c.versiones.map((v, i) => (
            <div key={v.numero} className="ver">
              <div className="ver-cab">
                <b>{`Versión ${v.numero}`}</b>
                {i === 0 && <Insignia tono="publicado">Vigente</Insignia>}
                {v.pdf === "listo" ? (
                  <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label={`Descargar PDF de la versión ${v.numero}`} cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                    PDF
                  </Boton>
                ) : v.pdf === "generando" ? (
                  <span className="sec" style={{ fontSize: 13 }} aria-live="polite">
                    Generando el PDF…
                  </span>
                ) : (
                  <span className="msj-error">No se generó el PDF. Avísele a soporte.</span>
                )}
              </div>
              <span className="meta">{`Publicada ${aFechaCorta(v.publicadaEn)} por ${v.publicadaPor.nombre} · ${pesos(v.total)}${v.envios.length > 0 ? ` · ${v.envios.length === 1 ? "1 envío" : `${v.envios.length} envíos`}` : ""}`}</span>
              {i === 0 && envios}
            </div>
          ))}
        </div>
      )}
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
    </section>
  );
}
