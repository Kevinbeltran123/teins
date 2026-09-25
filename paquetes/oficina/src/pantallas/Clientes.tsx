import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Aviso, Boton, CampoTexto } from "@teins/ui";
import { cliente } from "../api";
import { consultasDeProgramacion, mensajeDeProgramacion, useAccionDeProgramacion } from "../programacion";

export function Clientes() {
  const consulta = useQuery(consultasDeProgramacion.clientes());

  return (
    <section aria-labelledby="titulo-clientes" className="flex flex-col gap-5 rounded-panel bg-panel p-6">
      <h1 id="titulo-clientes" className="text-subtitulo font-extrabold">
        Clientes
      </h1>
      <CrearCliente />
      {consulta.isPending ? (
        <div aria-busy="true" aria-label="Cargando clientes" className="h-[200px] animate-pulse rounded-panel bg-fondo" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudieron cargar los clientes.</p>
          <Boton className="mt-3" onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : consulta.data.clientes.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">Todavía no hay clientes. Cree el primero con su sede principal; después podrá programarle visitas.</p>
      ) : (
        <ul aria-label="Clientes" className="flex flex-col divide-y divide-division">
          {consulta.data.clientes.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3">
              <h2 className="text-cuerpo font-extrabold">{c.nombre}</h2>
              <ul aria-label={`Sitios de ${c.nombre}`} className="flex flex-col gap-1 pl-4">
                {c.sitios.map((s) => (
                  <li key={s.id} className="text-cuerpo">
                    {s.nombre} <span className="text-ayuda text-texto-secundario">· {s.direccion}</span>
                  </li>
                ))}
              </ul>
              <AgregarSitio clienteId={c.id} nombreCliente={c.nombre} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CrearCliente() {
  const [nombre, setNombre] = useState("");
  const [sitio, setSitio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const crear = useAccionDeProgramacion(() => cliente.llamar("crearCliente", { cuerpo: { nombre, sitio: { nombre: sitio, direccion } } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if ([nombre, sitio, direccion].some((v) => v.trim() === "")) return setError("Escriba el nombre del cliente, el de su sitio y la dirección.");
    setError(null);
    try {
      const c = await crear.mutateAsync(undefined);
      setCreado(c.nombre);
      setNombre("");
      setSitio("");
      setDireccion("");
      setIntento((n) => n + 1);
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <form key={intento} onSubmit={enviar} noValidate aria-labelledby="titulo-crear-cliente" className="flex flex-col gap-4 rounded-panel border border-division p-5">
      <h2 id="titulo-crear-cliente" className="text-cuerpo font-extrabold">
        Crear cliente
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <CampoTexto etiqueta="Nombre del cliente" nombre="cliente" valorInicial="" onCambio={setNombre} />
        <CampoTexto etiqueta="Nombre del sitio" nombre="sitio" valorInicial="" onCambio={setSitio} />
        <CampoTexto etiqueta="Dirección del sitio" nombre="direccion" valorInicial="" onCambio={setDireccion} />
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {creado && !error && <Aviso tono="info">{`${creado} quedó creado. Ya le puede programar visitas.`}</Aviso>}
      <div>
        <Boton type="submit" variante="principal" disabled={crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear cliente"}
        </Boton>
      </div>
    </form>
  );
}

function AgregarSitio({ clienteId, nombreCliente }: { clienteId: string; nombreCliente: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const agregar = useAccionDeProgramacion(() => cliente.llamar("agregarSitio", { parametros: { id: clienteId }, cuerpo: { nombre, direccion } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nombre.trim() === "" || direccion.trim() === "") return setError("Escriba el nombre y la dirección del sitio.");
    setError(null);
    try {
      await agregar.mutateAsync(undefined);
      setAbierto(false);
      setNombre("");
      setDireccion("");
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  if (!abierto) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-tactil text-ayuda font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
        >
          {`Agregar sitio a ${nombreCliente}`}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} noValidate className="flex max-w-2xl flex-col gap-3 pl-4">
      <div className="grid gap-3 md:grid-cols-2">
        <CampoTexto etiqueta={`Nombre del sitio nuevo de ${nombreCliente}`} valorInicial="" onCambio={setNombre} />
        <CampoTexto etiqueta="Dirección" valorInicial="" onCambio={setDireccion} />
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="principal" disabled={agregar.isPending}>
          {agregar.isPending ? "Agregando…" : "Agregar sitio"}
        </Boton>
        <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
      </div>
    </form>
  );
}
