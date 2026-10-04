import { useEffect, useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  Building,
  CampoTexto,
  CeldaTabla,
  Dialogo,
  EncabezadoPagina,
  EsqueletoLista,
  BarraLista,
  Buscador,
  Insignia,
  Marcado,
  Pestanas,
  nombreDeTransicion,
  SinResultados,
  EstadoVacio,
  FilaTabla,
  Plus,
  RefreshCw,
  Tabla,
  useLoNuevo,
  useNotificar,
  enfocarPrimerError,
} from "@teins/ui";
import { cliente } from "../api";
import { aFechaCorta } from "../formato";
import { consultasDeProgramacion, mensajeDeCliente, mensajeDeProgramacion, useAccionDeProgramacion } from "../programacion";
import { unoDe, useBusquedaRecordada, usePreferencia } from "../preferencias";
import { useCamposDeContacto, type ErroresDeContacto } from "./CamposDeContacto";

type Cliente = Respuesta<"listarClientes">["clientes"][number];

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function Clientes() {
  // Activos o archivados (ADR-0035); "Ver en Archivados" al archivar uno llega con esa pestaña.
  const pedida = useLocation({ select: (l) => l.state.vista });
  const [vista, setVista] = usePreferencia<"activos" | "archivados">("clientes-pestana", "activos", unoDe("activos", "archivados"));
  // "Ver en Archivados" desde el aviso llega con la pantalla ya abierta: la pestaña pedida manda.
  useEffect(() => {
    if (pedida) setVista(pedida);
  }, [pedida, setVista]);
  const consulta = useQuery(consultasDeProgramacion.clientes(vista));
  const otra = useQuery(consultasDeProgramacion.clientes(vista === "activos" ? "archivados" : "activos"));
  const cantidad = (v: "activos" | "archivados") => (v === vista ? consulta.data : otra.data)?.clientes.length;
  const recuperar = useAccionDeProgramacion((c: Cliente) => cliente.llamar("recuperarCliente", { parametros: { id: c.id } }));
  const [errorRecuperar, setErrorRecuperar] = useState<string | null>(null);
  const notificar = useNotificar();
  const [creando, setCreando] = useState(false);
  const [agregandoA, setAgregandoA] = useState<Cliente | null>(null);
  // Lo creado o cambiado en esta visita a la pantalla: va primero y resaltado (DESIGN.md, crear y editar).
  const [recientes, setRecientes] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useBusquedaRecordada("clientes");
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const navegar = useNavigate();

  const todos = consulta.data?.clientes ?? [];
  // Lo que llega después de abrir la pantalla (lo recién creado) entra primero y resaltado, en la misma transición;
  // lo cambiado (un sitio agregado) se resalta en su lugar.
  const esNuevo = useLoNuevo(consulta.data?.clientes.map((c) => c.id));
  const ordenados = [...todos.filter((c) => esNuevo(c.id)), ...todos.filter((c) => !esNuevo(c.id))];
  const b = normalizar(busqueda.trim());
  const visibles = b === "" ? ordenados : ordenados.filter((c) => normalizar([c.nombre, ...c.sitios.map((s) => `${s.nombre} ${s.direccion}`)].join(" ")).includes(b));

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={
          consulta.data && (
            <>
              <span>
                <b>{cantidad("activos") ?? "…"}</b> {cantidad("activos") === 1 ? "cliente" : "clientes"}
              </span>
              {vista === "activos" && todos.some((c) => c.reciben === 0) && (
                <span>
                  <b>{todos.filter((c) => c.reciben === 0).length}</b> sin nadie que reciba el informe
                </span>
              )}
            </>
          )
        }
        acciones={
          <Boton variante="principal" icono={Plus} onClick={() => setCreando(true)}>
            Nuevo cliente
          </Boton>
        }
      />
      {consulta.isPending ? (
        <EsqueletoLista etiqueta="Cargando clientes" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <b>No se pudieron cargar los clientes.</b>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : todos.length === 0 && vista === "activos" && !cantidad("archivados") ? (
        <EstadoVacio icono={Building} titulo="Todavía no hay clientes">
          Cree el primero con "Nuevo cliente", con su sede principal. Después podrá programarle visitas.
        </EstadoVacio>
      ) : (
        <>
          <BarraLista buscador={<Buscador etiqueta="Buscar cliente" ejemplo="Cliente, sitio o dirección" valor={busqueda} onCambio={setBusqueda} />}>
            <Pestanas
              etiqueta="Qué clientes ver"
              activa={vista}
              onCambio={setVista}
              pestanas={[
                { valor: "activos", etiqueta: "Activos", cantidad: cantidad("activos") },
                { valor: "archivados", etiqueta: "Archivados", cantidad: cantidad("archivados") },
              ]}
            />
          </BarraLista>
          {errorRecuperar && <Aviso tono="error">{errorRecuperar}</Aviso>}
          {todos.length === 0 ? (
            <EstadoVacio icono={Building} titulo={vista === "archivados" ? "Nada archivado" : "No hay clientes activos"}>
              {vista === "archivados" ? "Un cliente archivado aparece aquí y se recupera con un toque." : "Los clientes archivados están en su pestaña."}
            </EstadoVacio>
          ) : visibles.length === 0 ? (
            <SinResultados texto={busqueda.trim()} onQuitar={() => setBusqueda("")} />
          ) : (
            <Tabla etiqueta="Clientes y sus sitios" columnas={[{ titulo: "Cliente" }, { titulo: "Sitios" }, { titulo: vista === "archivados" ? "Archivado" : "Reciben el informe" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
              {visibles.map((c) => (
                <FilaTabla key={c.id} resaltada={esNuevo(c.id) || recientes.includes(c.id)} abrir clave={c.id}>
                  <CeldaTabla>
                    <Link to="/clientes/$id" params={{ id: c.id }} className="enlace" data-transicion={nombreDeTransicion("nombre", c.id)}>
                      <Marcado texto={c.nombre} busqueda={busqueda} />
                    </Link>
                  </CeldaTabla>
                  <CeldaTabla>
                    <ul aria-label={`Sitios de ${c.nombre}`} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {c.sitios.map((s) => (
                        <li key={s.id}>
                          <span className="fuerte">
                            <Marcado texto={s.nombre} busqueda={busqueda} />
                          </span>{" "}
                          <span className="sec">
                            · <Marcado texto={s.direccion} busqueda={busqueda} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CeldaTabla>
                  <CeldaTabla>
                    {/* "Nadie" avisa antes de publicar: ese informe solo quedaría en el portal (ADR-0028). */}
                    {c.archivado ? (
                      <span className="sec">{`${aFechaCorta(c.archivado.en)} por ${c.archivado.por.nombre}`}</span>
                    ) : c.reciben === 0 ? (
                      <Insignia tono="alerta">Nadie</Insignia>
                    ) : c.reciben === 1 ? (
                      "1 contacto"
                    ) : (
                      `${c.reciben} contactos`
                    )}
                  </CeldaTabla>
                  <CeldaTabla derecha>
                    {c.archivado ? (
                      <Boton
                        tamano="pequeno"
                        aria-label={`Recuperar ${c.nombre}`}
                        cargando={recuperar.isPending && recuperar.variables?.id === c.id}
                        onClick={() => {
                          setErrorRecuperar(null);
                          recuperar.mutate(c, {
                            onSuccess: () => notificar({ texto: `${c.nombre} recuperado`, accion: { texto: "Ver en Activos", alHacer: () => setVista("activos") } }),
                            onError: (e) => setErrorRecuperar(mensajeDeCliente(e)),
                          });
                        }}
                      >
                        Recuperar
                      </Boton>
                    ) : (
                      <Boton variante="fantasma" tamano="pequeno" icono={Plus} aria-label={`Agregar sitio a ${c.nombre}`} onClick={() => setAgregandoA(c)}>
                        Agregar sitio
                      </Boton>
                    )}
                  </CeldaTabla>
                </FilaTabla>
              ))}
            </Tabla>
          )}
        </>
      )}

      {creando && (
        <NuevoCliente
          alCerrar={() => setCreando(false)}
          alCrear={(c) => {
            setCreando(false);
            setBusqueda("");
            destacar(c.id);
            // Ya llega con su contacto principal (iteración 29): el siguiente paso es ver el cliente o programarle.
            notificar({
              texto: `Cliente creado: ${c.nombre}`,
              accion: { texto: "Ver el cliente", alHacer: () => void navegar({ to: "/clientes/$id", params: { id: c.id } }) },
            });
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
  const [erroresContacto, setErroresContacto] = useState<ErroresDeContacto>({});
  const [error, setError] = useState<string | null>(null);
  // El contacto principal va con el cliente (iteración 29): sin él, los documentos no le llegan a nadie.
  const contacto = useCamposDeContacto(null, { algunCanal: true, recibeCotizaciones: true });
  const crear = useAccionDeProgramacion(() =>
    cliente.llamar("crearCliente", { cuerpo: { nombre: nombre.trim(), sitio: { nombre: sitio.trim(), direccion: direccion.trim() }, contacto: contacto.datos() } }),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre del cliente." } : {}),
      ...(sitio.trim() === "" ? { sitio: "Escriba el nombre del sitio." } : {}),
      ...(direccion.trim() === "" ? { direccion: "Escriba la dirección del sitio." } : {}),
    };
    const faltanContacto = contacto.validar();
    setErrores(faltan);
    setErroresContacto(faltanContacto);
    const hayErrores = Object.keys(faltan).length > 0 || Object.keys(faltanContacto).length > 0;
    if (hayErrores) enfocarPrimerError(formulario);
    if (hayErrores) return;
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
      amplio
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
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <fieldset className="bloque-form">
          <legend>Cliente</legend>
          <CampoTexto etiqueta="Nombre del cliente" nombre="cliente" ejemplo="Como sale en el informe" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        </fieldset>
        <fieldset className="bloque-form">
          <legend>Primer sitio</legend>
          <div className="fila-campos">
            <CampoTexto etiqueta="Nombre del sitio" nombre="sitio" ejemplo="Por ejemplo: Torre A" valorInicial="" onCambio={setSitio} error={errores.sitio} />
            <CampoTexto etiqueta="Dirección del sitio" nombre="direccion" valorInicial="" onCambio={setDireccion} error={errores.direccion} />
          </div>
        </fieldset>
        <fieldset className="bloque-form">
          <legend>Contacto principal</legend>
          <p className="ayuda">A quien le llegan los documentos. Puede agregar más contactos después.</p>
          {contacto.campos(erroresContacto)}
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
    if (Object.keys(faltan).length > 0) enfocarPrimerError(formulario);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      await agregar.mutateAsync(undefined);
      alAgregar();
    } catch (e) {
      setError(mensajeDeCliente(e));
    }
  }

  return (
    <Dialogo
      forma="formulario"
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
