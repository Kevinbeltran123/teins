import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import { Aviso, Boton, CampoTexto, CampoTextoLargo, Casilla, claseBoton, Marquilla, SelectorDeArchivo } from "@teins/ui";
import { cliente, consultas } from "../api";
import { aFechaHora } from "../formato";
import { mensajeDeAdministracion } from "../administracion";
import { mensajeDeInforme, subirPlano, useGuardarInforme, usePublicarInforme } from "../informes";

type Informe = Respuesta<"obtenerInforme">;
interface Borrador {
  introduccion: string;
  conclusiones: string;
  levantamientos: string[];
  planos: { huella: string; nombre: string }[];
}

const ESTADO_LEVANTAMIENTO = { enviado: "Enviado: falta revisarlo", en_revision: "En revisión", revisado: "Revisado" } as const;
/** La que ve el cliente: la más reciente sin retirar (regla 10). */
const vigenteDe = (informe: Informe) => informe.versiones.find((v) => v.retirada === null);

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

function mover<T>(lista: T[], i: number, paso: -1 | 1): T[] {
  const j = i + paso;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

export function InformeDeVisita({ id }: { id: string }) {
  const consulta = useQuery({
    ...consultas.informe(id),
    // Mientras un PDF se genera, la lista de versiones se vuelve a leer sola (ADR-0013: aviso al terminar).
    refetchInterval: (q) => (q.state.data?.versiones.some((v) => v.pdf === "generando") ? 3_000 : false),
  });
  const volver = (
    <Link to="/informes" className={`${claseBoton()} self-start`}>
      Volver a informes
    </Link>
  );

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando el informe" className="flex flex-col gap-6">
        <div className="h-[140px] animate-pulse rounded-panel bg-panel" />
        <div className="h-[320px] animate-pulse rounded-panel bg-panel" />
      </div>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        {volver}
        <Aviso tono="error">
          <p>{noExiste ? "Este informe no existe o no pertenece a su organización." : "No se pudo cargar el informe."}</p>
          {!noExiste && (
            <Boton className="mt-3" onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }
  return (
    <>
      {volver}
      <Composicion key={consulta.data.version} informe={consulta.data} recargar={() => void consulta.refetch()} />
      <Versiones informe={consulta.data} recargar={() => void consulta.refetch()} />
    </>
  );
}

/** Composición del borrador. Se reinicia con cada versión guardada del servidor (key = versión). */
function Composicion({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const [borrador, setBorrador] = useState<Borrador>(() => ({
    introduccion: informe.introduccion,
    conclusiones: informe.conclusiones,
    levantamientos: [...informe.levantamientos],
    planos: informe.planos.map((p) => ({ ...p })),
  }));
  const [subiendo, setSubiendo] = useState(false);
  const [errorPlano, setErrorPlano] = useState<unknown>(null);
  const [confirmando, setConfirmando] = useState(false);
  const guardar = useGuardarInforme(informe.id);
  const publicar = usePublicarInforme(informe.id);
  const cambiado = JSON.stringify(borrador) !== JSON.stringify({ introduccion: informe.introduccion, conclusiones: informe.conclusiones, levantamientos: informe.levantamientos, planos: informe.planos });
  const siguiente = (informe.versiones[0]?.numero ?? 0) + 1;
  const nombreDe = (lid: string) => {
    const c = informe.candidatos.find((x) => x.id === lid);
    return c ? `${c.formato} de ${c.tecnico}` : "Un levantamiento";
  };
  const error = errorPlano ?? guardar.error ?? publicar.error;
  const actualizar = (cambio: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambio }));

  async function agregarPlanos(archivos: File[]) {
    setSubiendo(true);
    setErrorPlano(null);
    try {
      for (const archivo of archivos) {
        const plano = await subirPlano(archivo);
        setBorrador((b) => (b.planos.some((p) => p.huella === plano.huella) ? b : { ...b, planos: [...b.planos, plano] }));
      }
    } catch (e) {
      setErrorPlano(e);
    } finally {
      setSubiendo(false);
    }
  }

  async function guardarYPublicar() {
    try {
      // Lo que se publica es lo guardado: si hay cambios, primero se guardan.
      const { version } = cambiado ? await guardar.mutateAsync({ version: informe.version, ...borrador }) : { version: informe.version };
      await publicar.mutateAsync(version);
      setConfirmando(false);
    } catch {
      // El error queda a la vista.
    }
  }

  return (
    <>
      <section aria-labelledby="titulo-informe" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          {vigenteDe(informe) ? (
            <Marquilla tono="superficie">{`Versión ${vigenteDe(informe)!.numero} vigente`}</Marquilla>
          ) : (
            <Marquilla tono="borrador">{informe.versiones.length > 0 ? "Retirado del portal" : "Sin publicar"}</Marquilla>
          )}
          <span className="text-ayuda text-texto-secundario">{informe.visita.motivo}</span>
        </div>
        <h1 id="titulo-informe" className="text-titulo leading-tight font-extrabold tracking-tight">
          Informe de {informe.visita.cliente}
        </h1>
        <p className="text-cuerpo text-texto-secundario">
          {informe.visita.sitio} · {informe.visita.direccion} · visita del {dia(informe.visita.programadaPara)}
        </p>
      </section>

      <section aria-labelledby="titulo-incluidos" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
        <h2 id="titulo-incluidos" className="text-subtitulo font-extrabold">
          Levantamientos de la visita
        </h2>
        <p className="text-ayuda text-texto-secundario">Solo entran levantamientos revisados. Aparecen en el informe en este orden.</p>
        {informe.candidatos.length === 0 ? (
          <p className="text-cuerpo text-texto-secundario">Esta visita todavía no tiene levantamientos enviados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-division">
            {informe.candidatos.map((c) => {
              const indice = borrador.levantamientos.indexOf(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Casilla
                    marcada={indice >= 0}
                    deshabilitada={c.estado !== "revisado" && indice < 0}
                    onCambio={(m) => actualizar({ levantamientos: m ? [...borrador.levantamientos, c.id] : borrador.levantamientos.filter((x) => x !== c.id) })}
                  >
                    <strong>{c.formato}</strong> de {c.tecnico} · recibido {aFechaHora(c.recibidoEn)} · {ESTADO_LEVANTAMIENTO[c.estado]}
                  </Casilla>
                  {indice >= 0 && borrador.levantamientos.length > 1 && (
                    <div className="flex gap-2">
                      <Boton aria-label={`Subir ${c.formato} de ${c.tecnico}`} disabled={indice === 0} onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, indice, -1) })}>
                        Subir
                      </Boton>
                      <Boton
                        aria-label={`Bajar ${c.formato} de ${c.tecnico}`}
                        disabled={indice === borrador.levantamientos.length - 1}
                        onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, indice, 1) })}
                      >
                        Bajar
                      </Boton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-textos" className="flex flex-col gap-5 rounded-panel bg-panel p-6">
        <h2 id="titulo-textos" className="text-subtitulo font-extrabold">
          Textos de oficina
        </h2>
        <CampoTextoLargo etiqueta="Introducción" valor={borrador.introduccion} onCambio={(v) => actualizar({ introduccion: v })} filas={4} maximo={20_000} />
        <CampoTextoLargo etiqueta="Conclusiones" valor={borrador.conclusiones} onCambio={(v) => actualizar({ conclusiones: v })} filas={4} maximo={20_000} />
      </section>

      <section aria-labelledby="titulo-planos" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
        <h2 id="titulo-planos" className="text-subtitulo font-extrabold">
          Planos
        </h2>
        <p className="text-ayuda text-texto-secundario">Los planos que elabora oficina, en PDF. Se anexan al final del informe en este orden.</p>
        {borrador.planos.length > 0 && (
          <ul className="flex flex-col divide-y divide-division">
            {borrador.planos.map((p, i) => (
              <li key={p.huella} className="flex flex-wrap items-end gap-2 py-2">
                <div className="min-w-60 flex-1">
                  <CampoTexto
                    etiqueta={`Nombre del plano ${i + 1}`}
                    valorInicial={p.nombre}
                    onCambio={(nombre) => actualizar({ planos: borrador.planos.map((x) => (x.huella === p.huella ? { ...x, nombre } : x)) })}
                  />
                </div>
                <Boton disabled={i === 0} onClick={() => actualizar({ planos: mover(borrador.planos, i, -1) })}>
                  Subir
                </Boton>
                <Boton disabled={i === borrador.planos.length - 1} onClick={() => actualizar({ planos: mover(borrador.planos, i, 1) })}>
                  Bajar
                </Boton>
                <Boton onClick={() => actualizar({ planos: borrador.planos.filter((x) => x.huella !== p.huella) })}>Quitar</Boton>
              </li>
            ))}
          </ul>
        )}
        <SelectorDeArchivo etiqueta={subiendo ? "Subiendo…" : "Agregar planos en PDF"} aceptar="application/pdf" deshabilitado={subiendo} onElegir={(a) => void agregarPlanos(a)} />
      </section>

      <section aria-label="Guardar y publicar" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
        {error !== null && error !== undefined && (
          <Aviso tono="error">
            <ul className="flex flex-col gap-1">
              {mensajeDeInforme(error, nombreDe).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {error instanceof ErrorApi && error.codigo === "conflicto_de_version" && (
              <Boton className="mt-3" onClick={recargar}>
                Recargar
              </Boton>
            )}
          </Aviso>
        )}
        {confirmando ? (
          <Aviso tono="alerta">
            <p>
              Al publicar, la versión {siguiente} queda congelada: no se podrá modificar. Para corregir algo después se publica una versión nueva, y la anterior se conserva.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Boton variante="principal" disabled={guardar.isPending || publicar.isPending} onClick={() => void guardarYPublicar()}>
                {publicar.isPending ? "Publicando…" : `Sí, publicar la versión ${siguiente}`}
              </Boton>
              <Boton onClick={() => setConfirmando(false)}>Cancelar</Boton>
            </div>
          </Aviso>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Boton variante="principal" disabled={subiendo} onClick={() => setConfirmando(true)}>
              Publicar versión {siguiente}
            </Boton>
            <Boton disabled={!cambiado || guardar.isPending || subiendo} onClick={() => guardar.mutate({ version: informe.version, ...borrador })}>
              {guardar.isPending ? "Guardando…" : cambiado ? "Guardar borrador" : "Borrador guardado"}
            </Boton>
          </div>
        )}
      </section>
    </>
  );
}

function Versiones({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);
  useEffect(() => setErrorDescarga(false), [informe.versiones.length]);
  const administrador = useQuery(consultas.sesion()).data?.usuario.administrador ?? false;
  const vigente = vigenteDe(informe)?.numero;

  async function descargar(numero: number) {
    setDescargando(numero);
    setErrorDescarga(false);
    try {
      const { url } = await cliente.llamar("pdfDeVersion", { parametros: { id: informe.id, numero } });
      window.location.assign(url);
    } catch {
      setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <section aria-labelledby="titulo-versiones" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
      <h2 id="titulo-versiones" className="text-subtitulo font-extrabold">
        Versiones publicadas
      </h2>
      {informe.versiones.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-division">
          {informe.versiones.map((v, i) => (
            <li key={v.numero} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="text-cuerpo">
                <p>
                  <strong>Versión {v.numero}</strong>
                  {v.numero === vigente && " (vigente)"} · publicada el {aFechaHora(v.publicadaEn)} por {v.publicadaPor.nombre}
                </p>
                {v.retirada && (
                  <p className="text-ayuda text-texto-secundario">{`Retirada del portal el ${aFechaHora(v.retirada.en)} por ${v.retirada.por.nombre}: ${v.retirada.motivo}`}</p>
                )}
                {administrador && !v.retirada && <RetirarVersion informeId={informe.id} numero={v.numero} alRetirar={recargar} />}
              </div>
              {v.pdf === "listo" ? (
                <Boton disabled={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                  {descargando === v.numero ? "Preparando…" : `Descargar PDF de la versión ${v.numero}`}
                </Boton>
              ) : v.pdf === "generando" ? (
                <span className="text-ayuda font-bold text-sync-pendiente" aria-live="polite">
                  Generando el PDF…
                </span>
              ) : (
                <span className="text-ayuda font-bold text-error">No se pudo generar el PDF. Avísele a soporte.</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
    </section>
  );
}

/** Solo quien administra: el cliente deja de ver la versión; se conserva y queda registrado. */
function RetirarVersion({ informeId, numero, alRetirar }: { informeId: string; numero: number; alRetirar: () => void }) {
  const consultasCliente = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function retirar() {
    if (motivo.trim() === "") return setError("Escriba por qué se retira: queda en el registro.");
    setOcupado(true);
    setError(null);
    try {
      await cliente.llamar("retirarVersion", { parametros: { id: informeId, numero }, cuerpo: { motivo } });
      await consultasCliente.invalidateQueries({ queryKey: ["informes"] });
      alRetirar();
    } catch (e) {
      setError(mensajeDeAdministracion(e));
      setOcupado(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-tactil text-ayuda font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
      >
        {`Retirar la versión ${numero} del portal`}
      </button>
    );
  }
  return (
    <div className="mt-2 flex max-w-xl flex-col gap-3">
      <p className="text-ayuda">El cliente deja de verla: si hay una versión anterior sin retirar, verá esa. No se puede deshacer; para volver a entregar, publique una versión nueva.</p>
      <CampoTextoLargo etiqueta={`Motivo del retiro de la versión ${numero}`} valor={motivo} onCambio={setMotivo} maximo={500} />
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton variante="principal" disabled={ocupado} onClick={() => void retirar()}>
          {ocupado ? "Retirando…" : `Sí, retirar la versión ${numero}`}
        </Boton>
        <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
      </div>
    </div>
  );
}
