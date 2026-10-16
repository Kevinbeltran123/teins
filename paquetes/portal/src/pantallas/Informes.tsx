import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton, Download, EsqueletoBloques, EstadoVacio, FileText, Logo, LogOut } from "@teins/ui";
import { cliente, consultas } from "../api";
import { olvidarSesion } from "../sesion";

const sesionVencida = (error: unknown) => error instanceof ErrorApi && error.codigo === "no_autenticado";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(iso));

export function Informes({ cliente: nombre, aviso }: { cliente: string; aviso?: ReactNode }) {
  const informes = useQuery(consultas.informes());
  const consultasCliente = useQueryClient();
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalir, setErrorSalir] = useState(false);
  // La sesión se cerró mientras la pantalla estaba abierta: se vuelve a pedir la clave, con el aviso.
  const volverAlIngreso = () => consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
  useEffect(() => {
    if (sesionVencida(informes.error)) void volverAlIngreso();
  }, [informes.error]);

  async function descargar(id: string) {
    setDescargando(id);
    setErrorDescarga(false);
    try {
      const { url } = await cliente.llamar("pdfDelPortal", { parametros: { id } });
      // El servidor firma la descarga como adjunto: el navegador guarda el PDF y el portal sigue a la vista.
      window.location.assign(url);
    } catch (error) {
      if (sesionVencida(error)) void volverAlIngreso();
      else setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  async function salir() {
    setSaliendo(true);
    setErrorSalir(false);
    try {
      await cliente.llamar("salirDelPortal");
    } catch {
      // La cookie la cierra solo el servidor: sin su respuesta, la sesión sigue abierta en este equipo.
      setErrorSalir(true);
      setSaliendo(false);
      return;
    }
    // Salir es decisión de la persona: no se le avisa después que su sesión se cerró.
    olvidarSesion();
    await consultasCliente.resetQueries();
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-division bg-panel">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-4 px-4">
          <Logo alto={30} />
          {/* En un equipo compartido, salir evita que otra persona vea los informes. */}
          <Boton variante="fantasma" tamano="pequeno" icono={LogOut} cargando={saliendo} onClick={() => void salir()}>
            Salir
          </Boton>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <h1 className="text-titulo leading-tight font-extrabold tracking-tight">Informes de {nombre}</h1>
        {aviso}
        {errorSalir && <Aviso tono="error">No se pudo cerrar la sesión y sus informes siguen abiertos en este equipo. Revise la conexión e intente salir de nuevo.</Aviso>}
        {informes.isPending ? (
          <EsqueletoBloques etiqueta="Cargando sus informes" altos={["medio", "medio"]} />
        ) : informes.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar sus informes.</p>
            <Boton className="mt-3" onClick={() => void informes.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : informes.data.informes.length === 0 ? (
          <EstadoVacio icono={FileText} titulo="Todavía no hay informes publicados.">
            Cuando TEINS publique uno, aparece aquí.
          </EstadoVacio>
        ) : (
          <ul aria-label="Informes" className="flex flex-col divide-y divide-division rounded-panel border border-division bg-panel">
            {informes.data.informes.map((i, n) => (
              <li key={i.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className="hidden size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie sm:flex [&_svg]:size-5">
                  <FileText aria-hidden />
                </span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <h2 className="text-cuerpo font-bold">{i.sitio}</h2>
                  <p className="text-ayuda text-texto-secundario">
                    Visita del {dia(i.programadaPara)} · {i.motivo}
                  </p>
                  {/* La versión deja saber si lo que tiene impreso es lo último que publicó TEINS. */}
                  <p className="text-ayuda text-texto-secundario">
                    Versión {i.numero} · publicada el {fecha(i.publicadaEn)}
                  </p>
                </div>
                {/* Una sola acción principal: el informe más reciente, el que se viene a buscar. */}
                <Boton
                  variante={n === 0 ? "principal" : "secundaria"}
                  icono={Download}
                  className="w-full sm:w-auto"
                  aria-label={`Descargar el informe de ${i.sitio}`}
                  cargando={descargando === i.id}
                  onClick={() => void descargar(i.id)}
                >
                  Descargar
                </Boton>
              </li>
            ))}
          </ul>
        )}
        {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo; si sigue fallando, avísele a TEINS.</Aviso>}
      </main>
    </div>
  );
}
