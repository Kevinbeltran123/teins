import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { describirValor, esNoObtenido } from "@teins/dominio";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton, CampoFotos, claseBoton, Marquilla, ValorLeido } from "@teins/ui";
import { consultas } from "../api";
import { aFechaHora } from "../formato";

export function Detalle({ id }: { id: string }) {
  const consulta = useQuery(consultas.levantamiento(id));
  const volver = (
    <Link to="/" className={`${claseBoton()} self-start`}>
      Volver a la bandeja
    </Link>
  );

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando el levantamiento" className="flex flex-col gap-6">
        <div className="h-[160px] animate-pulse rounded-panel bg-panel" />
        <div className="h-[260px] animate-pulse rounded-panel bg-panel" />
      </div>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        {volver}
        <Aviso tono="error">
          <p>{noExiste ? "Este levantamiento no existe o no pertenece a su organización." : "No se pudo cargar el levantamiento."}</p>
          {!noExiste && (
            <Boton className="mt-3" onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }

  const l = consulta.data;
  return (
    <>
      {volver}
      <section aria-labelledby="titulo-levantamiento" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Marquilla tono="enviado">Enviado</Marquilla>
          <span className="text-ayuda text-texto-secundario">
            {l.formato} v{l.versionFormato}
          </span>
        </div>
        <h1 id="titulo-levantamiento" className="text-titulo leading-tight font-extrabold tracking-tight">
          Levantamiento de {l.tecnico.nombre}
        </h1>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <ValorLeido etiqueta="Recibido en oficina">{aFechaHora(l.recibidoEn)}</ValorLeido>
          {/* La hora del teléfono es declarativa (regla 16): la oficial es la del servidor. */}
          <ValorLeido etiqueta="Enviado desde el teléfono">{aFechaHora(l.enviadoEnDispositivo)}</ValorLeido>
          <ValorLeido etiqueta="Creado en el teléfono">{aFechaHora(l.creadoEnDispositivo)}</ValorLeido>
          <ValorLeido etiqueta="Fotos">{l.fotos}</ValorLeido>
        </div>
      </section>

      {l.formatoDefinicion.secciones.map((seccion) => (
        <section key={seccion.clave} aria-labelledby={`seccion-${seccion.clave}`} className="flex flex-col gap-5 rounded-panel bg-panel p-6">
          <h2 id={`seccion-${seccion.clave}`} className="text-subtitulo font-extrabold">
            {seccion.titulo}
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {seccion.campos.map((campo) => {
              const valor = l.respuestas[seccion.clave]?.[campo.clave];
              return campo.tipo === "foto" && Array.isArray(valor) ? (
                <div key={campo.clave} className="md:col-span-2">
                  <Fotos etiqueta={campo.etiqueta} huellas={valor as readonly string[]} />
                </div>
              ) : (
                <ValorLeido key={campo.clave} etiqueta={campo.etiqueta}>
                  <span className={valor === undefined || esNoObtenido(valor) ? "text-texto-secundario" : ""}>{describirValor(campo, valor)}</span>
                </ValorLeido>
              );
            })}
          </div>
        </section>
      ))}
    </>
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
        <Boton className="mt-3" onClick={() => urls.forEach((u) => void u.refetch())}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }
  const fotos = urls.map((u, i) => ({ id: huellas[i]!, url: u.data!.url }));
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
