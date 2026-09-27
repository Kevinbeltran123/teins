import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useBlocker } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  ArrowDown,
  ArrowUp,
  Aviso,
  Boton,
  BotonIcono,
  CampoTexto,
  CampoTextoLargo,
  Casilla,
  Confirmacion,
  Dialogo,
  Download,
  EncabezadoPagina,
  EsqueletoBloques,
  Insignia,
  RefreshCw,
  SelectorDeArchivo,
  Send,
  Trash,
  useNotificar,
} from "@teins/ui";
import { cliente, consultas } from "../api";
import { aFechaHora } from "../formato";
import { mensajeDeAdministracion } from "../administracion";
import { mensajeDeInforme, subirPlano, useGuardarInforme, usePublicarInforme } from "../informes";
import { consultasDeProgramacion } from "../programacion";
import { copiasEnviadas, Destinatarios, enLista, PanelEnvios, receptores } from "./Envios";

type Informe = Respuesta<"obtenerInforme">;
type Envio = Informe["versiones"][number]["envios"][number];
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

const migas = (
  <Link to="/informes" className="hover:text-texto hover:underline focus-visible:outline-3 focus-visible:outline-superficie">
    Informes
  </Link>
);

export function InformeDeVisita({ id }: { id: string }) {
  const consulta = useQuery({
    ...consultas.informe(id),
    // Mientras un PDF se genera o un envío espera, la lista de versiones se vuelve a leer sola (ADR-0013, ADR-0028).
    // Un envío recién aceptado espera la confirmación del proveedor (entrega o rebote): se mira cada 10 s durante 10 minutos.
    refetchInterval: (q) => {
      const versiones = q.state.data?.versiones ?? [];
      if (versiones.some((v) => v.pdf === "generando" || v.envios.some((e) => e.estado === "en_cola"))) return 3_000;
      const hace10Minutos = Date.now() - 10 * 60_000;
      return versiones.some((v) => v.envios.some((e) => e.estado === "enviado" && e.enviadoEn !== null && Date.parse(e.enviadoEn) > hace10Minutos)) ? 10_000 : false;
    },
  });

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Informe" />
        <EsqueletoBloques etiqueta="Cargando el informe" altos={["medio", "alto"]} />
      </>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Informe" />
        <Aviso tono="error">
          <p>{noExiste ? "Este informe no existe o no pertenece a su organización." : "No se pudo cargar el informe."}</p>
          {!noExiste && (
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }
  // Se reinicia con cada versión guardada del servidor (key = versión).
  return <Composicion key={consulta.data.version} informe={consulta.data} recargar={() => void consulta.refetch()} />;
}

function Composicion({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const notificar = useNotificar();
  const [borrador, setBorrador] = useState<Borrador>(() => ({
    introduccion: informe.introduccion,
    conclusiones: informe.conclusiones,
    levantamientos: [...informe.levantamientos],
    planos: informe.planos.map((p) => ({ ...p })),
  }));
  const [subiendo, setSubiendo] = useState(false);
  const [errorPlano, setErrorPlano] = useState<unknown>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[] | null>(null);
  const contactos = useQuery(consultasDeProgramacion.cliente(informe.clienteId));
  const elegidos = destinatarios ?? (contactos.data ? receptores(contactos.data.contactos, "informes") : []);
  const guardar = useGuardarInforme(informe.id);
  const publicar = usePublicarInforme(informe.id);
  const cambiado = JSON.stringify(borrador) !== JSON.stringify({ introduccion: informe.introduccion, conclusiones: informe.conclusiones, levantamientos: informe.levantamientos, planos: informe.planos });
  const siguiente = (informe.versiones[0]?.numero ?? 0) + 1;
  const nombreDe = (lid: string) => {
    const c = informe.candidatos.find((x) => x.id === lid);
    return c ? `${c.formato} de ${c.tecnico}` : "Un levantamiento";
  };
  const error = errorPlano ?? guardar.error;
  const actualizar = (cambio: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambio }));
  // Salir con cambios sin guardar pregunta antes, también al cerrar la pestaña (DESIGN.md).
  const salida = useBlocker({ shouldBlockFn: () => cambiado, enableBeforeUnload: () => cambiado, withResolver: true });
  const vigente = vigenteDe(informe);

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
    // Lo que se publica es lo guardado: si hay cambios, primero se guardan.
    const { version } = cambiado ? await guardar.mutateAsync({ version: informe.version, ...borrador }) : { version: informe.version };
    await publicar.mutateAsync({ version, destinatarios: elegidos });
  }

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={`Informe de ${informe.visita.cliente}`}
        estado={vigente ? <Insignia tono="publicado">{`Versión ${vigente.numero} vigente`}</Insignia> : <Insignia tono="borrador">{informe.versiones.length > 0 ? "Retirado del portal" : "Sin publicar"}</Insignia>}
        descripcion={`${informe.visita.sitio} · ${informe.visita.direccion} · visita del ${dia(informe.visita.programadaPara)} · ${informe.visita.motivo}`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="titulo-incluidos" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-6">
            <div className="flex flex-col gap-1">
              <h2 id="titulo-incluidos" className="text-subtitulo font-extrabold">
                Levantamientos de la visita
              </h2>
              <p className="text-ayuda text-texto-secundario">Solo entran levantamientos revisados, en el orden de esta lista.</p>
            </div>
            {informe.candidatos.length === 0 ? (
              <p className="text-cuerpo text-texto-secundario">Esta visita todavía no tiene levantamientos enviados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-division">
                {informe.candidatos.map((c) => {
                  const indice = borrador.levantamientos.indexOf(c.id);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                      <Casilla
                        marcada={indice >= 0}
                        deshabilitada={c.estado !== "revisado" && indice < 0}
                        onCambio={(m) => actualizar({ levantamientos: m ? [...borrador.levantamientos, c.id] : borrador.levantamientos.filter((x) => x !== c.id) })}
                      >
                        <strong>{c.formato}</strong> de {c.tecnico} · recibido {aFechaHora(c.recibidoEn)} · {ESTADO_LEVANTAMIENTO[c.estado]}
                      </Casilla>
                      {indice >= 0 && borrador.levantamientos.length > 1 && (
                        <div className="flex gap-1">
                          <BotonIcono icono={ArrowUp} tamano="pequeno" etiqueta={`Subir ${c.formato} de ${c.tecnico}`} disabled={indice === 0} onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, indice, -1) })} />
                          <BotonIcono
                            icono={ArrowDown}
                            tamano="pequeno"
                            etiqueta={`Bajar ${c.formato} de ${c.tecnico}`}
                            disabled={indice === borrador.levantamientos.length - 1}
                            onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, indice, 1) })}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-textos" className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-6">
            <h2 id="titulo-textos" className="text-subtitulo font-extrabold">
              Textos de oficina
            </h2>
            <CampoTextoLargo etiqueta="Introducción" valor={borrador.introduccion} onCambio={(v) => actualizar({ introduccion: v })} filas={4} maximo={20_000} />
            <CampoTextoLargo etiqueta="Conclusiones" valor={borrador.conclusiones} onCambio={(v) => actualizar({ conclusiones: v })} filas={4} maximo={20_000} />
          </section>

          <section aria-labelledby="titulo-planos" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-6">
            <div className="flex flex-col gap-1">
              <h2 id="titulo-planos" className="text-subtitulo font-extrabold">
                Planos
              </h2>
              <p className="text-ayuda text-texto-secundario">Los planos que elabora oficina, en PDF. Se anexan al final del informe en este orden.</p>
            </div>
            {borrador.planos.length > 0 && (
              <ul className="flex flex-col divide-y divide-division">
                {borrador.planos.map((p, i) => (
                  <li key={p.huella} className="flex flex-wrap items-end gap-2 py-3">
                    <div className="min-w-60 grow">
                      <CampoTexto
                        etiqueta={`Nombre del plano ${i + 1}`}
                        valorInicial={p.nombre}
                        onCambio={(nombre) => actualizar({ planos: borrador.planos.map((x) => (x.huella === p.huella ? { ...x, nombre } : x)) })}
                      />
                    </div>
                    <div className="flex gap-1 pb-1">
                      <BotonIcono icono={ArrowUp} tamano="pequeno" etiqueta={`Subir el plano ${i + 1}`} disabled={i === 0} onClick={() => actualizar({ planos: mover(borrador.planos, i, -1) })} />
                      <BotonIcono icono={ArrowDown} tamano="pequeno" etiqueta={`Bajar el plano ${i + 1}`} disabled={i === borrador.planos.length - 1} onClick={() => actualizar({ planos: mover(borrador.planos, i, 1) })} />
                      {/* Quitar un plano del borrador no pierde nada: el archivo sigue subido y se vuelve a agregar igual. */}
                      <BotonIcono icono={Trash} tamano="pequeno" etiqueta={`Quitar el plano ${i + 1}`} onClick={() => actualizar({ planos: borrador.planos.filter((x) => x.huella !== p.huella) })} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <SelectorDeArchivo etiqueta={subiendo ? "Subiendo…" : "Agregar planos en PDF"} aceptar="application/pdf" deshabilitado={subiendo} onElegir={(a) => void agregarPlanos(a)} />
          </section>
        </div>

        <aside aria-label="Publicación" className="flex flex-col gap-4 lg:sticky lg:top-8">
          <section aria-labelledby="titulo-publicar" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
            <h2 id="titulo-publicar" className="text-subtitulo font-extrabold">
              Publicación
            </h2>
            <p className={`text-ayuda ${cambiado ? "font-bold text-alerta-texto" : "text-texto-secundario"}`} aria-live="polite">
              {cambiado ? "Hay cambios sin guardar." : "Todo está guardado."}
            </p>
            {error !== null && error !== undefined && (
              <Aviso tono="error">
                <ul className="flex flex-col gap-1">
                  {mensajeDeInforme(error, nombreDe).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                {error instanceof ErrorApi && error.codigo === "conflicto_de_version" && (
                  <Boton className="mt-3" icono={RefreshCw} onClick={recargar}>
                    Recargar
                  </Boton>
                )}
              </Aviso>
            )}
            <div className="flex flex-col gap-2">
              <Boton
                variante="principal"
                icono={Send}
                disabled={subiendo}
                onClick={() => {
                  // Todos los que reciben el informe, marcados por omisión (ADR-0028, parte 3).
                  setDestinatarios(null);
                  setConfirmando(true);
                }}
              >
                Publicar versión {siguiente}
              </Boton>
              <Boton disabled={!cambiado || subiendo} cargando={guardar.isPending} onClick={() => guardar.mutate({ version: informe.version, ...borrador })}>
                {cambiado ? "Guardar borrador" : "Borrador guardado"}
              </Boton>
            </div>
          </section>
          {vigente && (
            <PanelEnvios
              cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }}
              version={vigente}
              contactos={contactos.data?.contactos}
              enviar={(destinos) => cliente.llamar("enviarVersion", { parametros: { id: informe.id, numero: vigente.numero }, cuerpo: { destinos } })}
              recargar={recargar}
            />
          )}
          <Versiones informe={informe} recargar={recargar} />
        </aside>
      </div>

      {confirmando && (
        <Confirmacion
          titulo={`¿Publicar la versión ${siguiente}?`}
          confirmar={elegidos.length > 0 ? `Publicar y enviar a ${elegidos.length}` : `Publicar versión ${siguiente}`}
          peligro
          mensajeDeError={(e) => mensajeDeInforme(e, nombreDe).join(" ")}
          alCerrar={() => setConfirmando(false)}
          alTerminar={() =>
            notificar({ texto: elegidos.length > 0 ? `Versión ${siguiente} publicada. Se envía cuando el PDF esté listo.` : `Versión ${siguiente} publicada. El PDF se está generando.` })
          }
          accion={guardarYPublicar}
        >
          <p>
            El cliente la verá en el portal. Queda congelada: no se podrá modificar. Para corregir algo después se publica una versión nueva, y la anterior se conserva.
          </p>
          {contactos.isPending ? (
            <p className="text-ayuda text-texto-secundario">Cargando los contactos del cliente…</p>
          ) : contactos.isError ? (
            <Aviso tono="error">No se pudieron cargar los contactos: se publicará sin enviar. Podrá enviarla después desde "Envíos".</Aviso>
          ) : (
            <Destinatarios
              contactos={contactos.data.contactos}
              elegidos={elegidos}
              alCambiar={setDestinatarios}
              cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }}
              titulo="Enviar el PDF cuando esté listo"
            />
          )}
          {elegidos.length > 0 && (
            <p className="text-ayuda text-texto-secundario">Lo enviado no se puede recuperar, ni retirando la versión del portal.</p>
          )}
        </Confirmacion>
      )}
      {salida.status === "blocked" && (
        <Dialogo
          titulo="¿Salir sin guardar?"
          alCerrar={salida.reset}
          pie={
            <>
              <Boton onClick={salida.reset}>Seguir editando</Boton>
              <Boton variante="peligro" onClick={salida.proceed}>
                Salir sin guardar
              </Boton>
            </>
          }
        >
          <p className="text-cuerpo">Los cambios del borrador que no guardó se pierden.</p>
        </Dialogo>
      )}
    </>
  );
}

function Versiones({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);
  const [retirando, setRetirando] = useState<number | null>(null);
  useEffect(() => setErrorDescarga(false), [informe.versiones.length]);
  const administrador = useQuery(consultas.sesion()).data?.usuario.administrador ?? false;
  const vigente = vigenteDe(informe)?.numero;

  async function descargar(numero: number) {
    setDescargando(numero);
    setErrorDescarga(false);
    try {
      const { url } = await cliente.llamar("pdfDeVersion", { parametros: { id: informe.id, numero } });
      // El enlace firmado descarga el archivo (Content-Disposition: attachment): la pantalla no cambia.
      window.location.assign(url);
    } catch {
      setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <section aria-labelledby="titulo-versiones" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
      <h2 id="titulo-versiones" className="text-subtitulo font-extrabold">
        Versiones publicadas
      </h2>
      {informe.versiones.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-division">
          {informe.versiones.map((v) => (
            <li key={v.numero} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-cuerpo font-bold">
                  Versión {v.numero}
                  {v.numero === vigente && <Insignia tono="exito">Vigente</Insignia>}
                  {v.retirada && <Insignia tono="neutro">Retirada</Insignia>}
                </p>
                {v.pdf === "listo" ? (
                  <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label={`Descargar PDF de la versión ${v.numero}`} cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                    PDF
                  </Boton>
                ) : v.pdf === "generando" ? (
                  <span className="text-ayuda font-bold text-sync-pendiente" aria-live="polite">
                    Generando el PDF…
                  </span>
                ) : (
                  <span className="text-ayuda font-bold text-error">No se generó el PDF. Avísele a soporte.</span>
                )}
              </div>
              <p className="text-ayuda text-texto-secundario">{`Publicada el ${aFechaHora(v.publicadaEn)} por ${v.publicadaPor.nombre}${v.envios.length > 0 ? ` · ${v.envios.length === 1 ? "1 envío" : `${v.envios.length} envíos`}` : ""}`}</p>
              {v.retirada && <p className="text-ayuda text-texto-secundario">{`Retirada el ${aFechaHora(v.retirada.en)} por ${v.retirada.por.nombre}: ${v.retirada.motivo}`}</p>}
              {administrador && !v.retirada && (
                <Boton variante="fantasma" tamano="pequeno" className="self-start" aria-label={`Retirar la versión ${v.numero} del portal`} onClick={() => setRetirando(v.numero)}>
                  Retirar del portal
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
      {retirando !== null && (
        <RetirarVersion
          informeId={informe.id}
          numero={retirando}
          envios={informe.versiones.find((v) => v.numero === retirando)?.envios ?? []}
          alCerrar={() => setRetirando(null)}
          alRetirar={recargar}
        />
      )}
    </section>
  );
}

/** Solo quien administra: el cliente deja de ver la versión; se conserva y queda registrado. */
function RetirarVersion({ informeId, numero, envios, alCerrar, alRetirar }: { informeId: string; numero: number; envios: Envio[]; alCerrar: () => void; alRetirar: () => void }) {
  const consultasCliente = useQueryClient();
  const notificar = useNotificar();
  const [motivo, setMotivo] = useState("");
  return (
    <Confirmacion
      titulo={`¿Retirar la versión ${numero} del portal?`}
      confirmar={`Retirar la versión ${numero}`}
      peligro
      validar={() => (motivo.trim() === "" ? "Escriba por qué se retira: queda en el registro." : null)}
      mensajeDeError={mensajeDeAdministracion}
      alCerrar={alCerrar}
      alTerminar={() => {
        alRetirar();
        notificar({ texto: `Versión ${numero} retirada del portal` });
      }}
      accion={async () => {
        await cliente.llamar("retirarVersion", { parametros: { id: informeId, numero }, cuerpo: { motivo: motivo.trim() } });
        await consultasCliente.invalidateQueries({ queryKey: ["informes"] });
      }}
    >
      <p>El cliente deja de verla: si hay una versión anterior sin retirar, verá esa. No se puede deshacer; para volver a entregar, publique una versión nueva.</p>
      {/* Lo enviado no se recupera (ADR-0028): se dice a quién le llegó, para avisarle. */}
      {copiasEnviadas(envios).length > 0 && (
        <Aviso tono="alerta">
          {`Ya se le envió a ${enLista(copiasEnviadas(envios))}. Esas copias no se pueden recuperar: ${copiasEnviadas(envios).length === 1 ? "avísele" : "avíseles"} que la versión ${numero} ya no vale.`}
        </Aviso>
      )}
      <CampoTextoLargo etiqueta={`Motivo del retiro de la versión ${numero}`} valor={motivo} onCambio={setMotivo} maximo={500} />
    </Confirmacion>
  );
}
