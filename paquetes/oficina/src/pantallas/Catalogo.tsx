import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Respuesta } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto, Marquilla, SelectorDeArchivo } from "@teins/ui";
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
  const [busqueda, setBusqueda] = useState("");

  const filtrados = (consulta.data?.items ?? []).filter((i) => {
    const b = normalizar(busqueda.trim());
    return b === "" || normalizar(`${i.codigo} ${i.descripcion}`).includes(b);
  });

  return (
    <section aria-labelledby="titulo-catalogo" className="flex flex-col gap-5 rounded-panel bg-panel p-6">
      <h1 id="titulo-catalogo" className="text-subtitulo font-extrabold">
        Catálogo
      </h1>
      <p className="text-cuerpo text-texto-secundario">
        Los ítems con los que se vinculan las líneas de cantidad que anota el técnico. Un ítem no se borra: se desactiva, y las líneas ya vinculadas lo conservan.
      </p>
      <ImportarCatalogo />
      <CrearItem />
      {consulta.isPending ? (
        <div aria-busy="true" aria-label="Cargando el catálogo" className="h-[240px] animate-pulse rounded-panel bg-fondo" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudo cargar el catálogo.</p>
          <Boton className="mt-3" onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : consulta.data.items.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">El catálogo está vacío. Importe la lista que ya tienen o cree el primer ítem.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="max-w-md">
            <CampoTexto etiqueta="Buscar por código o descripción" valorInicial="" onCambio={setBusqueda} />
          </div>
          {filtrados.length === 0 ? (
            <p className="text-cuerpo text-texto-secundario">Ningún ítem coincide con la búsqueda.</p>
          ) : (
            <>
              <ul aria-label="Ítems del catálogo" className="flex flex-col divide-y divide-division">
                {filtrados.slice(0, VISIBLES).map((i) => (
                  <FilaItem key={i.id} item={i} />
                ))}
              </ul>
              {filtrados.length > VISIBLES && <p className="text-ayuda text-texto-secundario">{`Se muestran ${VISIBLES} de ${filtrados.length}. Afine la búsqueda para ver los demás.`}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ImportarCatalogo() {
  const [leido, setLeido] = useState<(CatalogoLeido & { archivo: string }) | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const importar = useAccionDeCatalogo((items: CatalogoLeido["items"]) => cliente.llamar("importarCatalogo", { cuerpo: { items } }));

  async function elegir([archivo]: File[]) {
    if (!archivo) return;
    setResultado(null);
    importar.reset();
    setLeido({ ...leerCatalogo(await archivo.text()), archivo: archivo.name });
  }

  async function confirmar() {
    if (!leido) return;
    try {
      const r = await importar.mutateAsync(leido.items);
      setResultado(`Importado: ${r.creados} ${r.creados === 1 ? "ítem nuevo" : "ítems nuevos"} y ${r.actualizados} ${r.actualizados === 1 ? "actualizado" : "actualizados"}.`);
      setLeido(null);
    } catch {
      // El error queda a la vista.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-division p-5">
      <h2 className="text-cuerpo font-extrabold">Importar desde un archivo</h2>
      <p className="text-ayuda text-texto-secundario">
        Un CSV con las columnas Código, Descripción y Unidad (Excel: Guardar como CSV). Un código que ya existe se actualiza y se vuelve a activar.
      </p>
      <SelectorDeArchivo etiqueta="Elegir archivo CSV" aceptar=".csv,text/csv" onElegir={(archivos) => void elegir(archivos)} deshabilitado={importar.isPending} />
      {leido && (
        <Aviso tono={leido.items.length === 0 ? "error" : leido.errores.length > 0 ? "alerta" : "info"}>
          <p>{leido.items.length === 0 ? `${leido.archivo} no tiene ítems para importar.` : `${leido.archivo}: ${leido.items.length} ${leido.items.length === 1 ? "ítem listo" : "ítems listos"} para importar.`}</p>
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
          <div className="mt-3 flex flex-wrap gap-2">
            {leido.items.length > 0 && (
              <Boton variante="principal" disabled={importar.isPending} onClick={() => void confirmar()}>
                {importar.isPending ? "Importando…" : `Importar ${leido.items.length} ${leido.items.length === 1 ? "ítem" : "ítems"}`}
              </Boton>
            )}
            <Boton onClick={() => setLeido(null)}>Descartar</Boton>
          </div>
        </Aviso>
      )}
      {importar.isError && <Aviso tono="error">{mensajeDeError(importar.error)}</Aviso>}
      {resultado && <Aviso tono="info">{resultado}</Aviso>}
    </div>
  );
}

function CrearItem() {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const crear = useAccionDeCatalogo(() => cliente.llamar("crearItemCatalogo", { cuerpo: { codigo, descripcion, unidad } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if ([codigo, descripcion, unidad].some((v) => v.trim() === "")) return setError("Escriba el código, la descripción y la unidad.");
    setError(null);
    try {
      const i = await crear.mutateAsync(undefined);
      setCreado(i.codigo);
      setCodigo("");
      setDescripcion("");
      setUnidad("");
      setIntento((n) => n + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <form key={intento} onSubmit={enviar} noValidate aria-labelledby="titulo-crear-item" className="flex flex-col gap-4 rounded-panel border border-division p-5">
      <h2 id="titulo-crear-item" className="text-cuerpo font-extrabold">
        Crear ítem
      </h2>
      <div className="grid gap-4 md:grid-cols-[1fr_2fr_1fr]">
        <CampoTexto etiqueta="Código" valorInicial="" onCambio={setCodigo} />
        <CampoTexto etiqueta="Descripción" valorInicial="" onCambio={setDescripcion} />
        <CampoTexto etiqueta="Unidad" valorInicial="" onCambio={setUnidad} />
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {creado && !error && <Aviso tono="info">{`${creado} quedó en el catálogo.`}</Aviso>}
      <div>
        <Boton type="submit" variante="principal" disabled={crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear ítem"}
        </Boton>
      </div>
    </form>
  );
}

function FilaItem({ item }: { item: Item }) {
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [unidad, setUnidad] = useState(item.unidad);
  const [error, setError] = useState<string | null>(null);
  const actualizar = useAccionDeCatalogo((cambio: { descripcion: string; unidad: string; activo: boolean }) =>
    cliente.llamar("actualizarItemCatalogo", { parametros: { id: item.id }, cuerpo: cambio }),
  );

  async function guardar(cambio: { descripcion: string; unidad: string; activo: boolean }) {
    if (cambio.descripcion.trim() === "" || cambio.unidad.trim() === "") return setError("Escriba la descripción y la unidad.");
    setError(null);
    try {
      await actualizar.mutateAsync(cambio);
      setEditando(false);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-cuerpo font-extrabold tabular-nums">{item.codigo}</span>
          <span className={`text-cuerpo ${item.activo ? "" : "text-texto-secundario"}`}>{item.descripcion}</span>
          <span className="text-ayuda text-texto-secundario">{item.unidad}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!item.activo && <Marquilla tono="borrador">Inactivo</Marquilla>}
          {!editando && <Boton onClick={() => setEditando(true)}>{`Editar ${item.codigo}`}</Boton>}
          <Boton disabled={actualizar.isPending} onClick={() => void guardar({ descripcion: item.descripcion, unidad: item.unidad, activo: !item.activo })}>
            {item.activo ? `Desactivar ${item.codigo}` : `Activar ${item.codigo}`}
          </Boton>
        </div>
      </div>
      {editando && (
        <div className="flex max-w-3xl flex-col gap-3 rounded-panel border border-division p-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <CampoTexto etiqueta={`Descripción de ${item.codigo}`} valorInicial={item.descripcion} onCambio={setDescripcion} />
            <CampoTexto etiqueta={`Unidad de ${item.codigo}`} valorInicial={item.unidad} onCambio={setUnidad} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="principal" disabled={actualizar.isPending} onClick={() => void guardar({ descripcion, unidad, activo: item.activo })}>
              {actualizar.isPending ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton onClick={() => setEditando(false)}>Cancelar</Boton>
          </div>
        </div>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </li>
  );
}
