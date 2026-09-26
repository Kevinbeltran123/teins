import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  CampoBusqueda,
  CampoTexto,
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
  Upload,
  useNotificar,
} from "@teins/ui";
import { cliente } from "../api";
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
  const [recientes, setRecientes] = useState<string[]>([]);
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const activar = useAccionDeCatalogo((i: Item) => cliente.llamar("actualizarItemCatalogo", { parametros: { id: i.id }, cuerpo: { descripcion: i.descripcion, unidad: i.unidad, activo: !i.activo } }));
  const [errorFila, setErrorFila] = useState<string | null>(null);

  const todos = consulta.data?.items ?? [];
  const ordenados = [...recientes.map((id) => todos.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)), ...todos.filter((i) => !recientes.includes(i.id))];
  const b = normalizar(busqueda.trim());
  const filtrados = b === "" ? ordenados : ordenados.filter((i) => normalizar(`${i.codigo} ${i.descripcion}`).includes(b));

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
          <CampoBusqueda etiqueta="Buscar por código o descripción" ejemplo="Código o descripción" valor={busqueda} onCambio={setBusqueda} />
          {errorFila && <Aviso tono="error">{errorFila}</Aviso>}
          {filtrados.length === 0 ? (
            <EstadoVacio icono={Search} titulo="Ningún ítem coincide con la búsqueda">
              Revise cómo lo escribió, o busque por una parte del código.
            </EstadoVacio>
          ) : (
            <>
              <Tabla etiqueta="Ítems del catálogo" columnas={[{ titulo: "Código" }, { titulo: "Descripción" }, { titulo: "Unidad" }, { titulo: "Estado" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
                {filtrados.slice(0, VISIBLES).map((i) => (
                  <FilaTabla key={i.id} resaltada={recientes.includes(i.id)}>
                    <CeldaTabla principal>{i.codigo}</CeldaTabla>
                    <CeldaTabla>
                      <span className={i.activo ? "" : "text-texto-secundario"}>{i.descripcion}</span>
                    </CeldaTabla>
                    <CeldaTabla>{i.unidad}</CeldaTabla>
                    <CeldaTabla>{i.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}</CeldaTabla>
                    <CeldaTabla derecha>
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
      {importando && <ImportarCatalogo alCerrar={() => setImportando(false)} alImportar={(texto) => notificar({ texto })} />}
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

function ImportarCatalogo({ alCerrar, alImportar }: { alCerrar: () => void; alImportar: (resultado: string) => void }) {
  const [leido, setLeido] = useState<(CatalogoLeido & { archivo: string }) | null>(null);
  const importar = useAccionDeCatalogo((items: CatalogoLeido["items"]) => cliente.llamar("importarCatalogo", { cuerpo: { items } }));

  async function elegir([archivo]: File[]) {
    if (!archivo) return;
    importar.reset();
    setLeido({ ...leerCatalogo(await archivo.text()), archivo: archivo.name });
  }

  async function confirmar() {
    if (!leido) return;
    try {
      const r = await importar.mutateAsync(leido.items);
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
        Un CSV con las columnas Código, Descripción y Unidad (en Excel: Guardar como CSV). Un código que ya existe se actualiza y se vuelve a activar.
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
      {importar.isError && <Aviso tono="error">{mensajeDeError(importar.error)}</Aviso>}
    </Dialogo>
  );
}
