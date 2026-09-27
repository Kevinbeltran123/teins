import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  Building,
  CampoBusqueda,
  CampoTexto,
  CeldaTabla,
  Dialogo,
  EncabezadoPagina,
  EsqueletoTabla,
  EstadoVacio,
  FilaTabla,
  Plus,
  RefreshCw,
  Search,
  Tabla,
  TriangleAlert,
  useNotificar,
} from "@teins/ui";
import { cliente } from "../api";
import { consultasDeProgramacion, mensajeDeProgramacion, useAccionDeProgramacion } from "../programacion";

type Cliente = Respuesta<"listarClientes">["clientes"][number];

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function Clientes() {
  const consulta = useQuery(consultasDeProgramacion.clientes());
  const notificar = useNotificar();
  const [creando, setCreando] = useState(false);
  const [agregandoA, setAgregandoA] = useState<Cliente | null>(null);
  // Lo creado o cambiado en esta visita a la pantalla: va primero y resaltado (DESIGN.md, crear y editar).
  const [recientes, setRecientes] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);

  const todos = consulta.data?.clientes ?? [];
  const ordenados = [...recientes.map((id) => todos.find((c) => c.id === id)).filter((c): c is Cliente => Boolean(c)), ...todos.filter((c) => !recientes.includes(c.id))];
  const b = normalizar(busqueda.trim());
  const visibles = b === "" ? ordenados : ordenados.filter((c) => normalizar([c.nombre, ...c.sitios.map((s) => `${s.nombre} ${s.direccion}`)].join(" ")).includes(b));

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        acciones={
          <Boton variante="principal" icono={Plus} onClick={() => setCreando(true)}>
            Nuevo cliente
          </Boton>
        }
      />
      {consulta.isPending ? (
        <EsqueletoTabla etiqueta="Cargando clientes" columnas={3} />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudieron cargar los clientes.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : todos.length === 0 ? (
        <EstadoVacio icono={Building} titulo="Todavía no hay clientes">
          Cree el primero con "Nuevo cliente", con su sede principal. Después podrá programarle visitas.
        </EstadoVacio>
      ) : (
        <div className="flex flex-col gap-4">
          <CampoBusqueda etiqueta="Buscar cliente" ejemplo="Cliente, sitio o dirección" valor={busqueda} onCambio={setBusqueda} />
          {visibles.length === 0 ? (
            <EstadoVacio icono={Search} titulo="Ningún cliente coincide con la búsqueda">
              Revise cómo lo escribió o busque por el nombre de uno de sus sitios.
            </EstadoVacio>
          ) : (
            <Tabla etiqueta="Clientes y sus sitios" columnas={[{ titulo: "Cliente" }, { titulo: "Sitios" }, { titulo: "Reciben el informe" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
              {visibles.map((c) => (
                <FilaTabla key={c.id} resaltada={recientes.includes(c.id)} abrir>
                  <CeldaTabla>
                    <Link
                      to="/clientes/$id"
                      params={{ id: c.id }}
                      className="font-bold text-superficie underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                    >
                      {c.nombre}
                    </Link>
                  </CeldaTabla>
                  <CeldaTabla>
                    <ul aria-label={`Sitios de ${c.nombre}`} className="flex flex-col gap-0.5">
                      {c.sitios.map((s) => (
                        <li key={s.id}>
                          {s.nombre} <span className="text-ayuda text-texto-secundario">· {s.direccion}</span>
                        </li>
                      ))}
                    </ul>
                  </CeldaTabla>
                  <CeldaTabla>
                    {/* "Nadie" avisa antes de publicar: ese informe solo quedaría en el portal (ADR-0028). */}
                    {c.reciben === 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-alerta-texto [&_svg]:size-4">
                        <TriangleAlert aria-hidden="true" />
                        Nadie
                      </span>
                    ) : c.reciben === 1 ? (
                      "1 contacto"
                    ) : (
                      `${c.reciben} contactos`
                    )}
                  </CeldaTabla>
                  <CeldaTabla derecha>
                    <Boton variante="fantasma" tamano="pequeno" icono={Plus} aria-label={`Agregar sitio a ${c.nombre}`} onClick={() => setAgregandoA(c)}>
                      Agregar sitio
                    </Boton>
                  </CeldaTabla>
                </FilaTabla>
              ))}
            </Tabla>
          )}
        </div>
      )}

      {creando && (
        <NuevoCliente
          alCerrar={() => setCreando(false)}
          alCrear={(c) => {
            setCreando(false);
            setBusqueda("");
            destacar(c.id);
            notificar({ texto: `Cliente creado: ${c.nombre}` });
          }}
        />
      )}
      {agregandoA && (
        <AgregarSitio
          c={agregandoA}
          alCerrar={() => setAgregandoA(null)}
          alAgregar={() => {
            setAgregandoA(null);
            destacar(agregandoA.id);
            notificar({ texto: `Sitio agregado a ${agregandoA.nombre}` });
          }}
        />
      )}
    </>
  );
}

function NuevoCliente({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (c: Cliente) => void }) {
  const formulario = useId();
  const [nombre, setNombre] = useState("");
  const [sitio, setSitio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [errores, setErrores] = useState<{ nombre?: string; sitio?: string; direccion?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const crear = useAccionDeProgramacion(() => cliente.llamar("crearCliente", { cuerpo: { nombre: nombre.trim(), sitio: { nombre: sitio.trim(), direccion: direccion.trim() } } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre del cliente." } : {}),
      ...(sitio.trim() === "" ? { sitio: "Escriba el nombre del sitio." } : {}),
      ...(direccion.trim() === "" ? { direccion: "Escriba la dirección del sitio." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      alCrear(await crear.mutateAsync(undefined));
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      forma="lateral"
      titulo="Nuevo cliente"
      cerrable={!crear.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={crear.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={crear.isPending}>
            Crear cliente
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoTexto etiqueta="Nombre del cliente" nombre="cliente" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        <fieldset className="flex flex-col gap-4">
          <legend className="pb-1 text-ayuda text-texto-secundario">La sede principal, donde se programan las visitas. Después puede agregar más sitios.</legend>
          <CampoTexto etiqueta="Nombre del sitio" nombre="sitio" valorInicial="" onCambio={setSitio} error={errores.sitio} />
          <CampoTexto etiqueta="Dirección del sitio" nombre="direccion" valorInicial="" onCambio={setDireccion} error={errores.direccion} />
        </fieldset>
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

export function AgregarSitio({ c, alCerrar, alAgregar }: { c: { id: string; nombre: string }; alCerrar: () => void; alAgregar: () => void }) {
  const formulario = useId();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [errores, setErrores] = useState<{ nombre?: string; direccion?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const agregar = useAccionDeProgramacion(() => cliente.llamar("agregarSitio", { parametros: { id: c.id }, cuerpo: { nombre: nombre.trim(), direccion: direccion.trim() } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre del sitio." } : {}),
      ...(direccion.trim() === "" ? { direccion: "Escriba la dirección." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      await agregar.mutateAsync(undefined);
      alAgregar();
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      titulo="Agregar sitio"
      subtitulo={c.nombre}
      cerrable={!agregar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={agregar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={agregar.isPending}>
            Agregar sitio
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto etiqueta="Nombre del sitio" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        <CampoTexto etiqueta="Dirección" valorInicial="" onCambio={setDireccion} error={errores.direccion} />
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}
