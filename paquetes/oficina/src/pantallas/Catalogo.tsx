import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  CampoBusqueda,
  CampoTexto,
  Casilla,
  CeldaTabla,
  Confirmacion,
  Dialogo,
  EncabezadoPagina,
  EsqueletoTabla,
  EstadoVacio,
  FilaTabla,
  Insignia,
  MenuAcciones,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SelectorDeArchivo,
  Tabla,
  TriangleAlert,
  Upload,
  useNotificar,
} from "@teins/ui";
import { cliente, consultas } from "../api";
import { mensajeDeAdministracion } from "../administracion";
import { aFecha, aFechaHora, leerPesos, pesos } from "../formato";
import { consultasDeCatalogo, useAccionDeCatalogo } from "../catalogo";
import { leerCatalogo, type CatalogoLeido } from "../csv";
import { mensajeDeError } from "../mensajes";

type Item = Respuesta<"listarCatalogo">["items"][number];

/** Con miles de ítems, la lista muestra los primeros y pide afinar la búsqueda. */
const VISIBLES = 100;

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Catálogo de ítems (iteración 11, P28): con él oficina vincula las líneas que anota el técnico. */
export function Catalogo() {
  const consulta = useQuery(consultasDeCatalogo.items());
  const notificar = useNotificar();
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [desactivando, setDesactivando] = useState<Item | null>(null);
  const [cambiandoPrecio, setCambiandoPrecio] = useState<Item | null>(null);
  const [soloSinPrecio, setSoloSinPrecio] = useState(false);
  // Cambiar precios es de administración (ADR-0029): el resto de oficina los ve.
  const administrador = useQuery(consultas.sesion()).data?.usuario.administrador ?? false;
  const [recientes, setRecientes] = useState<string[]>([]);
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const activar = useAccionDeCatalogo((i: Item) => cliente.llamar("actualizarItemCatalogo", { parametros: { id: i.id }, cuerpo: { descripcion: i.descripcion, unidad: i.unidad, activo: !i.activo } }));
  const [errorFila, setErrorFila] = useState<string | null>(null);

  const todos = consulta.data?.items ?? [];
  const ordenados = [...recientes.map((id) => todos.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)), ...todos.filter((i) => !recientes.includes(i.id))];
  const b = normalizar(busqueda.trim());
  const sinPrecio = todos.filter((i) => i.activo && i.precio === null).length;
  const filtrados = (b === "" ? ordenados : ordenados.filter((i) => normalizar(`${i.codigo} ${i.descripcion}`).includes(b))).filter((i) => !soloSinPrecio || i.precio === null);

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogo"
        descripcion="Los ítems con los que oficina vincula las líneas de cantidad que anota el técnico."
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
        <EsqueletoTabla etiqueta="Cargando el catálogo" columnas={4} />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudo cargar el catálogo.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : todos.length === 0 ? (
        <EstadoVacio icono={Package} titulo="El catálogo está vacío">
          Importe la lista que ya tienen en Excel con "Importar CSV", o cree el primer ítem con "Nuevo ítem".
        </EstadoVacio>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="w-full max-w-md">
              <CampoBusqueda etiqueta="Buscar por código o descripción" ejemplo="Código o descripción" valor={busqueda} onCambio={setBusqueda} />
            </div>
            {(sinPrecio > 0 || soloSinPrecio) && (
              <Casilla marcada={soloSinPrecio} onCambio={setSoloSinPrecio}>
                {`Solo los que no tienen precio (${sinPrecio})`}
              </Casilla>
            )}
          </div>
          {errorFila && <Aviso tono="error">{errorFila}</Aviso>}
          {filtrados.length === 0 ? (
            <EstadoVacio icono={Search} titulo="Ningún ítem coincide con la búsqueda">
              Revise cómo lo escribió, o busque por una parte del código.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                etiqueta="Ítems del catálogo"
                columnas={[{ titulo: "Código" }, { titulo: "Descripción" }, { titulo: "Unidad" }, { titulo: "Precio sin IVA", derecha: true }, { titulo: "Estado" }, { titulo: "Acciones", oculto: true, derecha: true }]}
              >
                {filtrados.slice(0, VISIBLES).map((i) => (
                  <FilaTabla key={i.id} resaltada={recientes.includes(i.id)}>
                    <CeldaTabla principal>{i.codigo}</CeldaTabla>
                    <CeldaTabla>
                      <span className={i.activo ? "" : "text-texto-secundario"}>{i.descripcion}</span>
                    </CeldaTabla>
                    <CeldaTabla>{i.unidad}</CeldaTabla>
                    <CeldaTabla derecha>
                      {i.precio ? (
                        <span className="flex flex-col items-end">
                          <strong className="tabular-nums">{pesos(i.precio.valor)}</strong>
                          <span className="text-ayuda text-texto-secundario">{`desde ${aFecha(i.precio.desde)}`}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-bold text-alerta-texto [&_svg]:size-4">
                          <TriangleAlert aria-hidden="true" />
                          Sin precio
                        </span>
                      )}
                    </CeldaTabla>
                    <CeldaTabla>{i.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}</CeldaTabla>
                    <CeldaTabla derecha>
                      <span className="inline-flex items-center gap-1">
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
                            ? { texto: "Desactivar", peligro: true, alElegir: () => setDesactivando(i) }
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
              {filtrados.length > VISIBLES && <p className="text-ayuda text-texto-secundario">{`Se muestran ${VISIBLES} de ${filtrados.length}. Afine la búsqueda para ver los demás.`}</p>}
            </>
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
      {desactivando && (
        <Confirmacion
          titulo={`¿Desactivar ${desactivando.codigo}?`}
          confirmar="Desactivar ítem"
          mensajeDeError={mensajeDeError}
          alCerrar={() => setDesactivando(null)}
          alTerminar={() => notificar({ texto: `${desactivando.codigo} desactivado` })}
          accion={() => activar.mutateAsync(desactivando)}
        >
          <p>Deja de ofrecerse al vincular líneas nuevas. Las líneas ya vinculadas lo conservan, y se puede volver a activar.</p>
        </Confirmacion>
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

/** Crear (sin `item`) o editar un ítem; el código no cambia porque identifica al ítem en las líneas vinculadas. */
function FormularioItem({ item, alCerrar, alGuardar }: { item?: Item; alCerrar: () => void; alGuardar: (i: Item) => void }) {
  const formulario = useId();
  const [codigo, setCodigo] = useState(item?.codigo ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [unidad, setUnidad] = useState(item?.unidad ?? "");
  const [errores, setErrores] = useState<{ codigo?: string; descripcion?: string; unidad?: string }>({});
  const [error, setError] = useState<string | null>(null);
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
      forma="lateral"
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
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {!item && <CampoTexto etiqueta="Código" valorInicial="" onCambio={setCodigo} error={errores.codigo} />}
        <CampoTexto etiqueta={item ? `Descripción de ${item.codigo}` : "Descripción"} valorInicial={descripcion} onCambio={setDescripcion} error={errores.descripcion} />
        <CampoTexto etiqueta={item ? `Unidad de ${item.codigo}` : "Unidad"} valorInicial={unidad} onCambio={setUnidad} error={errores.unidad} />
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
      forma="lateral"
      titulo={`Precio de ${item.codigo}`}
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
        <CampoTexto etiqueta="Precio unitario sin IVA" nombre="precio" valorInicial={texto} onCambio={setTexto} error={errorCampo} />
        <p className="text-ayuda text-texto-secundario">Rige desde hoy para las cotizaciones nuevas y los borradores. Las versiones ya publicadas conservan su precio.</p>
        {guardar.isError && <Aviso tono="error">{mensajeDeAdministracion(guardar.error)}</Aviso>}
      </form>
      <section aria-labelledby={`${formulario}-historia`} className="mt-6 flex flex-col gap-2">
        <h3 id={`${formulario}-historia`} className="text-cuerpo font-bold">
          Historia del precio
        </h3>
        {historia.isPending ? (
          <p className="text-ayuda text-texto-secundario">Cargando la historia…</p>
        ) : historia.isError ? (
          <p className="text-ayuda text-texto-secundario">No se pudo cargar la historia.</p>
        ) : historia.data.precios.length === 0 ? (
          <p className="text-ayuda text-texto-secundario">Todavía no tiene precio.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-division rounded-panel border border-division">
            {historia.data.precios.map((p) => (
              <li key={`${p.desde}-${p.valor}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex flex-col">
                  <span>{`Desde el ${aFechaHora(p.desde)}`}</span>
                  <span className="text-ayuda text-texto-secundario">{`${p.por?.nombre ?? "[Usuario no disponible]"}${p.origen === "importado" ? " · importado del CSV" : ""}`}</span>
                </span>
                <strong className="tabular-nums">{pesos(p.valor)}</strong>
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
