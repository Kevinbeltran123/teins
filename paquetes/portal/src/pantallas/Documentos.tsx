import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatearDia } from "@teins/dominio";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, Download, EsqueletoBloques, EstadoVacio, FileText, Logo, LogOut, Pestanas, SelectorDeTema, useTema } from "@teins/ui";
import { cliente, consultas } from "../api";
import { leerDestino, type Destino } from "../destino";
import { olvidarSesion } from "../sesion";

type Sesion = Respuesta<"sesionDelPortal">;
type Tipo = Destino["tipo"];

/** La sesión venció o se quitó el acceso, o cambió lo que ve: se vuelve a leer la sesión, que lo resuelve. */
const releerSesion = (error: unknown) => error instanceof ErrorApi && (error.codigo === "no_autenticado" || error.codigo === "sin_permiso");

const dia = (aaaaMmDd: string) => formatearDia(aaaaMmDd, { dateStyle: "long" });
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(iso));

interface Fila {
  id: string;
  titulo: string;
  lineas: [string, string];
}

/**
 * Lo que el contacto ve (ADR-0053): sus informes y sus cotizaciones, lo mismo que recibe. Punto focal (DESIGN.md): el
 * documento más reciente de la pestaña abierta y su «Descargar»; el que viene del botón de un correo va resaltado.
 */
export function Documentos({ sesion, aviso }: { sesion: Sesion; aviso?: ReactNode }) {
  const consultasCliente = useQueryClient();
  const [tema, setTema] = useTema();
  const [destino] = useState(leerDestino);
  const visibles = (["informes", "cotizaciones"] as const).filter((t) => sesion.ve[t]);
  const [activa, setActiva] = useState<Tipo | undefined>(() => (destino && sesion.ve[destino.tipo] ? destino.tipo : visibles[0]));
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalir, setErrorSalir] = useState(false);

  // Cuántos hay de cada uno, en su pestaña: se leen las dos listas (las mismas consultas que las muestran).
  const cuantos = {
    informes: useQuery({ ...consultas.informes(), enabled: sesion.ve.informes }).data?.informes.length,
    cotizaciones: useQuery({ ...consultas.cotizaciones(), enabled: sesion.ve.cotizaciones }).data?.cotizaciones.length,
  };
  // Si le quitaron lo que tenía abierto, pasa a lo que sí ve.
  const tipo = activa && sesion.ve[activa] ? activa : visibles[0];
  const volverASesion = () => consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });

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
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo alto={30} />
          <div className="flex items-center gap-2">
            {/* En un equipo compartido, ver quién entró evita descargar con la sesión de otra persona. */}
            <span className="hidden text-ayuda text-texto-secundario sm:inline">{sesion.contacto}</span>
            <SelectorDeTema tema={tema} alCambiar={setTema} />
            <Boton variante="fantasma" tamano="pequeno" icono={LogOut} cargando={saliendo} onClick={() => void salir()}>
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-10 sm:pt-8">
        <h1 className="text-titulo leading-tight font-semibold tracking-tight">{sesion.cliente}</h1>
        {aviso}
        {errorSalir && <Aviso tono="error">No se pudo cerrar la sesión y sus documentos siguen abiertos en este equipo. Revise la conexión e intente salir de nuevo.</Aviso>}
        {!tipo ? (
          <EstadoVacio icono={FileText} titulo="Todavía no tiene documentos para ver">
            Pídale a TEINS que le agregue los informes o las cotizaciones.
          </EstadoVacio>
        ) : (
          <>
            {visibles.length > 1 && (
              <Pestanas
                amplio
                etiqueta="Documentos"
                activa={tipo}
                onCambio={setActiva}
                pestanas={visibles.map((t) => ({ valor: t, etiqueta: t === "informes" ? "Informes" : "Cotizaciones", cantidad: cuantos[t] ?? null }))}
              />
            )}
            {tipo === "informes" ? (
              <ListaDeInformes resaltar={destino?.tipo === "informes" ? destino.id : undefined} alPerderAcceso={volverASesion} />
            ) : (
              <ListaDeCotizaciones resaltar={destino?.tipo === "cotizaciones" ? destino.id : undefined} alPerderAcceso={volverASesion} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ListaDeInformes({ resaltar, alPerderAcceso }: { resaltar: string | undefined; alPerderAcceso: () => void }) {
  const consulta = useQuery(consultas.informes());
  const filas = consulta.data?.informes.map(
    (i): Fila => ({ id: i.id, titulo: i.sitio, lineas: [`Visita del ${dia(i.programadaPara)} · ${i.motivo}`, `Versión ${i.numero} · publicada el ${fecha(i.publicadaEn)}`] }),
  );
  return (
    <Lista
      tipo="informes"
      consulta={{ ...consulta, filas }}
      resaltar={resaltar}
      alPerderAcceso={alPerderAcceso}
      descargar={(id) => cliente.llamar("pdfDelPortal", { parametros: { id } })}
      vacio={{ titulo: "Todavía no hay informes publicados.", texto: "Cuando TEINS publique uno, aparece aquí." }}
    />
  );
}

function ListaDeCotizaciones({ resaltar, alPerderAcceso }: { resaltar: string | undefined; alPerderAcceso: () => void }) {
  const consulta = useQuery(consultas.cotizaciones());
  const filas = consulta.data?.cotizaciones.map(
    (c): Fila => ({ id: c.id, titulo: `Cotización ${c.numero}`, lineas: [`${c.sitio} · visita del ${dia(c.programadaPara)}`, `Versión ${c.version} · publicada el ${fecha(c.publicadaEn)}`] }),
  );
  return (
    <Lista
      tipo="cotizaciones"
      consulta={{ ...consulta, filas }}
      resaltar={resaltar}
      alPerderAcceso={alPerderAcceso}
      descargar={(id) => cliente.llamar("pdfDeCotizacionDelPortal", { parametros: { id } })}
      vacio={{ titulo: "Todavía no hay cotizaciones publicadas.", texto: "Cuando TEINS publique una, aparece aquí." }}
    />
  );
}

function Lista({
  tipo,
  consulta,
  resaltar,
  alPerderAcceso,
  descargar,
  vacio,
}: {
  tipo: Tipo;
  consulta: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; filas: Fila[] | undefined };
  resaltar: string | undefined;
  alPerderAcceso: () => void;
  descargar: (id: string) => Promise<{ url: string }>;
  vacio: { titulo: string; texto: string };
}) {
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);
  useEffect(() => {
    if (releerSesion(consulta.error)) alPerderAcceso();
  }, [consulta.error]);

  async function bajar(id: string) {
    setDescargando(id);
    setErrorDescarga(false);
    try {
      const { url } = await descargar(id);
      // El servidor firma la descarga como adjunto: el navegador guarda el PDF y el portal sigue a la vista.
      window.location.assign(url);
    } catch (error) {
      if (releerSesion(error)) alPerderAcceso();
      else setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  if (consulta.isPending) return <EsqueletoBloques etiqueta={`Cargando sus ${tipo}`} altos={["medio", "medio"]} />;
  if (consulta.isError || !consulta.filas) {
    return (
      <Aviso tono="error">
        <p>No se pudieron cargar sus {tipo}.</p>
        <Boton className="mt-3" onClick={() => void consulta.refetch()}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }
  if (consulta.filas.length === 0) {
    return (
      <EstadoVacio icono={FileText} titulo={vacio.titulo}>
        {vacio.texto}
      </EstadoVacio>
    );
  }
  // Una sola acción principal: el documento que vino a buscar desde el correo, o el más reciente.
  const principal = consulta.filas.some((f) => f.id === resaltar) ? resaltar : consulta.filas[0]!.id;
  return (
    <>
      <ul aria-label={tipo === "informes" ? "Informes" : "Cotizaciones"} className="flex flex-col divide-y divide-division overflow-hidden rounded-panel border border-division bg-panel">
        {consulta.filas.map((f) => (
          <li key={f.id} aria-current={f.id === resaltar || undefined} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${f.id === resaltar ? "bg-resaltado" : ""}`}>
            <span className="hidden size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie sm:flex [&_svg]:size-5">
              <FileText aria-hidden />
            </span>
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <h2 className="text-cuerpo font-bold">{f.titulo}</h2>
              {/* La versión deja saber si lo que tiene impreso es lo último que publicó TEINS. */}
              <p className="text-ayuda text-texto-secundario">{f.lineas[0]}</p>
              <p className="text-ayuda text-texto-secundario">{f.lineas[1]}</p>
            </div>
            <Boton
              variante={f.id === principal ? "principal" : "secundaria"}
              icono={Download}
              className="w-full sm:w-auto"
              aria-label={tipo === "informes" ? `Descargar el informe de ${f.titulo}` : `Descargar la ${f.titulo.toLowerCase()}`}
              cargando={descargando === f.id}
              onClick={() => void bajar(f.id)}
            >
              Descargar
            </Boton>
          </li>
        ))}
      </ul>
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo; si sigue fallando, avísele a TEINS.</Aviso>}
    </>
  );
}
