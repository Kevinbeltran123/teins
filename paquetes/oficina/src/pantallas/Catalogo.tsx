import { useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  BarraLista,
  Buscador,
  CampoTexto,
  CeldaTabla,
  Dialogo,
  EncabezadoPagina,
  EsqueletoLista,
  EstadoVacio,
  FilaTabla,
    Info,
  Insignia,
  MenuAcciones,
  Package,
  Pencil,
  PieLista,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  SelectorDeArchivo,
  Tabla,
  Upload,
  useNotificar,
  enfocarPrimerError,
  useLoNuevo,
} from "@teins/ui";
import { cliente, consultas } from "../api";
import { mensajeDeAdministracion } from "../administracion";
import { aFecha, aFechaHora, leerPesos, pesos } from "../formato";
import { consultasDeCatalogo, useAccionDeCatalogo } from "../catalogo";
import { leerCatalogo, type CatalogoLeido } from "../csv";
import { mensajeDeError, sinError } from "../mensajes";

type Item = Respuesta<"listarCatalogo">["items"][number];

/** Con miles de ítems, la lista muestra los primeros y pide afinar la búsqueda. */
const VISIBLES = 100;

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Catálogo de ítems (iteración 11, P28): con él oficina vincula las líneas que anota el técnico. */
export function Catalogo() {
  const consulta = useQuery(consultasDeCatalogo.items());
  // Los ítems de ahora, para «Deshacer»: en sus 10 s pudo cambiar la descripción o la unidad, y volver a activar no la
  // devuelve a la de antes (iteración 42).
  const vigentes = useRef(consulta.data);
  vigentes.current = consulta.data;
  const notificar = useNotificar();
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [cambiandoPrecio, setCambiandoPrecio] = useState<Item | null>(null);
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  // Cambiar precios es de administración (ADR-0029): el resto de oficina los ve.
  const administrador = useQuery(consultas.sesion()).data?.usuario.administrador ?? false;
  const [recientes, setRecientes] = useState<string[]>([]);
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const activar = useAccionDeCatalogo((i: Item) => cliente.llamar("actualizarItemCatalogo", { parametros: { id: i.id }, cuerpo: { descripcion: i.descripcion, unidad: i.unidad, activo: !i.activo } }));
  const [errorFila, setErrorFila] = useState<string | null>(null);

  const todos = consulta.data?.items ?? [];
  // Lo creado (o importado) después de abrir la pantalla va primero y resaltado; lo cambiado se resalta en su lugar.
  const esNuevo = useLoNuevo(consulta.data?.items.map((i) => i.id));
  const ordenados = [...todos.filter((i) => esNuevo(i.id)), ...todos.filter((i) => !esNuevo(i.id))];
  const b = normalizar(busqueda.trim());
  const sinPrecio = todos.filter((i) => i.activo && i.precio === null).length;
  const filtrados = (b === "" ? ordenados : ordenados.filter((i) => normalizar(`${i.codigo} ${i.descripcion}`).includes(b))).filter((i) => !soloSinPrecio || i.precio === null);

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogo"
        descripcion={<span>Los ítems con los que oficina vincula las líneas de cantidad que anota el técnico.</span>}
        acciones={
          <>
            <Boton icono={Upload} onClick={() => setImportando(true)}>
              Importar CSV
            </Boton>
            <Boton variante="principal" icono={Plus} onClick={() => setCreando(true)}>
              Nuevo ítem
            </Boton>
          </>
        }
      />
      {consulta.isPending ? (
        <EsqueletoLista etiqueta="Cargando el catálogo" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <b>No se pudo cargar el catálogo.</b>
          <span className="sec">Puede ser la conexión o el servidor. Lo que ya estaba guardado no se perdió.</span>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : todos.length === 0 ? (
        <EstadoVacio icono={Package} titulo="El catálogo está vacío">
          Importe la lista que ya tienen en Excel con "Importar CSV", o cree el primer ítem con "Nuevo ítem".
        </EstadoVacio>
      ) : (
        <div className="col" style={{ gap: 28 }}>
          <BarraLista buscador={<Buscador etiqueta="Buscar por código o descripción" ejemplo="Buscar por código o descripción" valor={busqueda} onCambio={setBusqueda} />}>
            {sinPrecio > 0 || soloSinPrecio ? (
              <label className="opcion" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={soloSinPrecio} onChange={(e) => setSoloSinPrecio(e.target.checked)} />
                {`Solo sin precio (${sinPrecio})`}
              </label>
            ) : undefined}
          </BarraLista>
          {errorFila && <Aviso tono="error">{errorFila}</Aviso>}
          {filtrados.length === 0 ? (
            <EstadoVacio icono={Search} titulo="Ningún ítem coincide con la búsqueda">
              Revise cómo lo escribió, o busque por una parte del código.
            </EstadoVacio>
          ) : (
            <div>
              <Tabla
                etiqueta="Ítems del catálogo"
                columnas={[{ titulo: "Código" }, { titulo: "Descripción" }, { titulo: "Unidad" }, { titulo: "Precio sin IVA", derecha: true }, { titulo: "Estado" }, { titulo: "Acciones", oculto: true, derecha: true }]}
              >
                {filtrados.slice(0, VISIBLES).map((i, k) => (
                  <FilaTabla key={i.id} clave={i.id} resaltada={esNuevo(i.id) || recientes.includes(i.id)}>
                    <CeldaTabla principal>{i.codigo}</CeldaTabla>
                    <CeldaTabla>
                      <span className={i.activo ? "" : "sec"}>{i.descripcion}</span>
                    </CeldaTabla>
                    <CeldaTabla clase="sec">{i.unidad}</CeldaTabla>
                    <CeldaTabla derecha>
                      {i.precio ? (
                        <>
                          <span className="fuerte">{pesos(i.precio.valor)}</span>
                          <span className="sub">{`desde el ${aFecha(i.precio.desde)}`}</span>
                        </>
                      ) : (
                        <Insignia tono="peligro">Sin precio</Insignia>
                      )}
                    </CeldaTabla>
                    <CeldaTabla>{i.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}</CeldaTabla>
                    <CeldaTabla derecha>
                      <span className="fila-flex" style={{ justifyContent: "flex-end", flexWrap: "nowrap", gap: 4 }}>
                        {administrador && (
                          <Boton variante="fantasma" tamano="pequeno" aria-label={`Cambiar el precio de ${i.codigo}`} onClick={() => setCambiandoPrecio(i)}>
                            Cambiar precio
                          </Boton>
                        )}
                      <MenuAcciones
                        etiqueta={`Más acciones para ${i.codigo}`}
                        opciones={[
                          { texto: "Editar", icono: Pencil, alElegir: () => setEditando(i) },
                          i.activo
                            ? {
                                texto: "Desactivar",
                                // Se revierte con un toque: al instante y con "Deshacer", sin preguntar (DESIGN.md, iteración 24c).
                                alElegir: () => {
                                  setErrorFila(null);
                                  activar.mutate(i, {
                                    onSuccess: () =>
                                      notificar({
                                        texto: `${i.codigo} desactivado`,
                                        accion: {
                                          texto: "Deshacer",
                                          alHacer: () => {
                                            const ahora = vigentes.current?.items.find((x) => x.id === i.id) ?? i;
                                            activar.mutate({ ...ahora, activo: false }, { onSuccess: () => destacar(i.id), onError: (e) => setErrorFila(`No se pudo volver a activar ${i.codigo}. ${mensajeDeError(e)}`) });
                                          },
                                        },
                                      }),
                                    onError: (e) => setErrorFila(`No se pudo desactivar ${i.codigo}. ${mensajeDeError(e)}`),
                                  });
                                },
                              }
                            : {
                                texto: "Activar",
                                alElegir: () => {
                                  setErrorFila(null);
                                  activar.mutate(i, {
                                    onSuccess: () => {
                                      destacar(i.id);
                                      notificar({ texto: `${i.codigo} activado` });
                                    },
                                    onError: (e) => setErrorFila(`No se pudo activar ${i.codigo}. ${mensajeDeError(e)}`),
                                  });
                                },
                              },
                        ]}
                      />
                      </span>
                    </CeldaTabla>
                  </FilaTabla>
                ))}
              </Tabla>
              <PieLista>{filtrados.length > VISIBLES ? `Se muestran ${VISIBLES} de ${filtrados.length}. Afine la búsqueda para ver los demás.` : `${filtrados.length} ${filtrados.length === 1 ? "ítem" : "ítems"}`}</PieLista>
            </div>
          )}
        </div>
      )}

      {creando && (
        <FormularioItem
          alCerrar={() => setCreando(false)}
          alGuardar={(i) => {
            setCreando(false);
            setBusqueda("");
            destacar(i.id);
            notificar({ texto: `${i.codigo} quedó en el catálogo` });
          }}
        />
      )}
      {editando && (
        <FormularioItem
          item={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={(i) => {
            setEditando(null);
            destacar(i.id);
            notificar({ texto: `${i.codigo} actualizado` });
          }}
        />
      )}
      {importando && <ImportarCatalogo administrador={administrador} alCerrar={() => setImportando(false)} alImportar={(texto) => notificar({ texto })} />}
      {cambiandoPrecio && (
        <CambiarPrecio
          item={cambiandoPrecio}
          alCerrar={() => setCambiandoPrecio(null)}
          alGuardar={(i) => {
            setCambiandoPrecio(null);
            destacar(i.id);
            notificar({ texto: `Precio de ${i.codigo}: ${pesos(i.precio?.valor ?? 0)}` });
          }}
        />
      )}
    </>
  );
}

/** Las unidades del catálogo por frecuencia (hasta ocho). */
function unidadesUsadas(items: readonly Item[]): string[] {
  const cuenta = new Map<string, number>();
  for (const i of items) cuenta.set(i.unidad, (cuenta.get(i.unidad) ?? 0) + 1);
  return [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u]) => u);
}

/** Crear (sin `item`) o editar un ítem; el código no cambia porque identifica al ítem en las líneas vinculadas. */
function FormularioItem({ item, alCerrar, alGuardar }: { item?: Item; alCerrar: () => void; alGuardar: (i: Item) => void }) {
  const formulario = useId();
  const [codigo, setCodigo] = useState(item?.codigo ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [unidad, setUnidad] = useState(item?.unidad ?? "");
  const [errores, setErrores] = useState<{ codigo?: string; descripcion?: string; unidad?: string }>({});
  const [error, setError] = useState<string | null>(null);
  // Las unidades que ya usa el catálogo, de la más usada a la menos, como atajo: la unidad se sigue escribiendo libre.
  const usadas = useQuery({ ...consultasDeCatalogo.items(), select: (d) => unidadesUsadas(d.items) }).data ?? [];
  const guardar = useAccionDeCatalogo(() =>
    item
      ? cliente.llamar("actualizarItemCatalogo", { parametros: { id: item.id }, cuerpo: { descripcion: descripcion.trim(), unidad: unidad.trim(), activo: item.activo } })
      : cliente.llamar("crearItemCatalogo", { cuerpo: { codigo: codigo.trim(), descripcion: descripcion.trim(), unidad: unidad.trim() } }),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(!item && codigo.trim() === "" ? { codigo: "Escriba el código." } : {}),
      ...(descripcion.trim() === "" ? { descripcion: "Escriba la descripción." } : {}),
      ...(unidad.trim() === "" ? { unidad: "Escriba la unidad." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) enfocarPrimerError(formulario);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      alGuardar(await guardar.mutateAsync(undefined));
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Dialogo
      forma="formulario"
      titulo={item ? `Editar ${item.codigo}` : "Nuevo ítem"}
      cerrable={!guardar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={guardar.isPending}>
            {item ? "Guardar" : "Crear ítem"}
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto etiqueta="Descripción" ejemplo="Como sale en la cotización" valorInicial={descripcion} onCambio={(t) => (setDescripcion(t), setErrores((e) => sinError(e, "descripcion")))} error={errores.descripcion} />
        <div className="fila-campos">
          {item ? (
            <CampoTexto etiqueta="Código" valorInicial={item.codigo} onCambio={() => undefined} deshabilitado />
          ) : (
            <CampoTexto etiqueta="Código" ejemplo="Por ejemplo: UTP-6A" valorInicial="" onCambio={(t) => (setCodigo(t), setErrores((e) => sinError(e, "codigo")))} error={errores.codigo} />
          )}
          <CampoTexto etiqueta="Unidad" valorInicial={unidad} onCambio={(t) => (setUnidad(t), setErrores((e) => sinError(e, "unidad")))} error={errores.unidad} sugerencias={usadas} />
        </div>
        {item && (
          <p className="nota-capa">
            <Info aria-hidden />
            Las cotizaciones publicadas conservan la descripción con que salieron.
          </p>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

/**
 * Nuevo precio vigente desde hoy, en la hoja lateral, con la historia debajo: el anterior nunca se pisa
 * (ADR-0029). Solo administración.
 */
function CambiarPrecio({ item, alCerrar, alGuardar }: { item: Item; alCerrar: () => void; alGuardar: (i: Item) => void }) {
  const formulario = useId();
  const [texto, setTexto] = useState(item.precio ? item.precio.valor.toLocaleString("es-CO") : "");
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const historia = useQuery({ queryKey: ["catalogo", item.id, "precios"], queryFn: () => cliente.llamar("historialDePrecio", { parametros: { id: item.id } }) });
  const guardar = useAccionDeCatalogo((precio: number) => cliente.llamar("cambiarPrecio", { parametros: { id: item.id }, cuerpo: { precio } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const precio = leerPesos(texto);
    if (precio === null || precio === undefined) return setErrorCampo("Escriba el precio en pesos enteros, como 4.800.");
    setErrorCampo(undefined);
    try {
      alGuardar(await guardar.mutateAsync(precio));
    } catch {
      // El error queda a la vista, en la hoja.
    }
  }

  return (
    <Dialogo
      forma="formulario"
      titulo={`Cambiar precio de ${item.codigo}`}
      subtitulo={`${item.descripcion} · ${item.unidad}`}
      cerrable={!guardar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={guardar.isPending}>
            Guardar precio
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoTexto etiqueta="Precio unitario sin IVA" nombre="precio" valorInicial={texto} onCambio={(t) => (setTexto(t), setErrorCampo(undefined))} error={errorCampo} />
        <p className="nota-capa">
          <Info aria-hidden />
          Rige desde hoy para las cotizaciones nuevas y los borradores; lo publicado no cambia.
        </p>
        {guardar.isError && <Aviso tono="error">{mensajeDeAdministracion(guardar.error)}</Aviso>}
      </form>
      <section aria-labelledby={`${formulario}-historia`} className="col" style={{ gap: 8 }}>
        <span id={`${formulario}-historia`} className="etq">
          Historia del precio
        </span>
        {historia.isPending ? (
          <p className="ayuda">Cargando la historia…</p>
        ) : historia.isError ? (
          <p className="ayuda">No se pudo cargar la historia.</p>
        ) : historia.data.precios.length === 0 ? (
          <p className="ayuda">Todavía no tiene precio.</p>
        ) : (
          <ul className="historial">
            {historia.data.precios.map((p) => (
              <li key={`${p.desde}-${p.valor}`}>
                <span className="ico">{p.origen === "importado" ? <Upload aria-hidden size={15} /> : <UserRound aria-hidden size={15} />}</span>
                <div className="que">
                  <b>{pesos(p.valor)}</b> {`desde el ${aFechaHora(p.desde)}`}
                  <div className="cuando">{`${p.por?.nombre ?? "[Usuario no disponible]"}${p.origen === "importado" ? " · importado del CSV" : ""}`}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Dialogo>
  );
}

function ImportarCatalogo({ administrador, alCerrar, alImportar }: { administrador: boolean; alCerrar: () => void; alImportar: (resultado: string) => void }) {
  const [leido, setLeido] = useState<(CatalogoLeido & { archivo: string }) | null>(null);
  const importar = useAccionDeCatalogo((items: CatalogoLeido["items"]) => cliente.llamar("importarCatalogo", { cuerpo: { items } }));

  async function elegir([archivo]: File[]) {
    if (!archivo) return;
    importar.reset();
    setLeido({ ...leerCatalogo(await archivo.text()), archivo: archivo.name });
  }

  // Los precios los importa administración (ADR-0029); para el resto, el archivo entra sin ellos.
  const conPrecios = leido?.items.some((i) => i.precio !== undefined) ?? false;
  const aImportar = leido ? (administrador ? leido.items : leido.items.map(({ precio: _precio, ...i }) => i)) : [];

  async function confirmar() {
    if (!leido) return;
    try {
      const r = await importar.mutateAsync(aImportar);
      alCerrar();
      alImportar(`Importado: ${r.creados} ${r.creados === 1 ? "ítem nuevo" : "ítems nuevos"} y ${r.actualizados} ${r.actualizados === 1 ? "actualizado" : "actualizados"}`);
    } catch {
      // El error queda a la vista, en el diálogo.
    }
  }

  const cuantos = leido?.items.length ?? 0;
  return (
    <Dialogo
      forma="lateral"
      titulo="Importar desde un archivo"
      cerrable={!importar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={importar.isPending}>
            Cancelar
          </Boton>
          {cuantos > 0 && (
            <Boton variante="principal" cargando={importar.isPending} onClick={() => void confirmar()}>
              {`Importar ${cuantos} ${cuantos === 1 ? "ítem" : "ítems"}`}
            </Boton>
          )}
        </>
      }
    >
      <p className="text-cuerpo text-texto-secundario">
        Un CSV con las columnas Código, Descripción y Unidad, y Precio si quiere cargar la lista de precios (en Excel: Guardar como CSV). Un código que ya existe se actualiza y se vuelve a activar.
      </p>
      <SelectorDeArchivo etiqueta={leido ? "Elegir otro archivo" : "Elegir archivo CSV"} aceptar=".csv,text/csv" onElegir={(archivos) => void elegir(archivos)} deshabilitado={importar.isPending} />
      {leido && (
        <Aviso tono={cuantos === 0 ? "error" : leido.errores.length > 0 ? "alerta" : "info"}>
          <p>{cuantos === 0 ? `${leido.archivo} no tiene ítems para importar.` : `${leido.archivo}: ${cuantos} ${cuantos === 1 ? "ítem listo" : "ítems listos"} para importar.`}</p>
          {leido.errores.length > 0 && (
            <>
              <p className="mt-2">{`Estas filas no se importan (${leido.errores.length}):`}</p>
              <ul className="mt-1 list-disc pl-5">
                {leido.errores.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {leido.errores.length > 10 && <p className="mt-1">{`Y ${leido.errores.length - 10} más.`}</p>}
            </>
          )}
        </Aviso>
      )}
      {conPrecios && !administrador && <Aviso tono="alerta">Este archivo trae precios: se importan los ítems sin ellos. Los precios los carga administración.</Aviso>}
      {importar.isError && <Aviso tono="error">{mensajeDeError(importar.error)}</Aviso>}
    </Dialogo>
  );
}
