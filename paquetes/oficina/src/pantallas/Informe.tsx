import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  ArrowDown,
  ArrowUp,
  Aviso,
  Boton,
  BotonIcono,
  CampoTextoLargo,
  ChevronLeft,
  Confirmacion,
  Download,
  EncabezadoPagina,
  EsqueletoLista,
  Insignia,
  RefreshCw,
  SelectorDeArchivo,
  Send,
  Trash,
  useNotificar,
} from "@teins/ui";
import { cliente, consultas, esSesionVencida } from "../api";
import { useBorrador } from "../borrador";
import { useSalidaProtegida } from "../salida";
import { aFechaCorta } from "../formato";
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

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`)).replace(",", "");

function mover<T>(lista: T[], i: number, paso: -1 | 1): T[] {
  const j = i + paso;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

const migas = (
  <Link to="/informes" className="migas">
    <ChevronLeft aria-hidden size={16} />
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
        <EsqueletoLista etiqueta="Cargando el informe" />
      </>
    );
  }
  // Solo si nunca cargó: un error al releer (sin red, sesión vencida) deja el borrador donde está.
  if (consulta.data === undefined) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Informe" />
        <Aviso tono="error">
          <b>{noExiste ? "Este informe no existe o no pertenece a su organización." : "No se pudo cargar el informe."}</b>
          {!noExiste && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
                Reintentar
              </Boton>
            </div>
          )}
        </Aviso>
      </>
    );
  }
  return <Composicion informe={consulta.data} recargar={() => void consulta.refetch()} />;
}

function Composicion({ informe, recargar }: { informe: Informe; recargar: () => void }) {
  const notificar = useNotificar();
  const { borrador, setBorrador, cambiado, version, guardado, descartar } = useBorrador<Borrador>(informe.version, () => ({
    introduccion: informe.introduccion,
    conclusiones: informe.conclusiones,
    levantamientos: [...informe.levantamientos],
    planos: informe.planos.map((p) => ({ huella: p.huella, nombre: p.nombre })),
  }));
  const [subiendo, setSubiendo] = useState(false);
  const [errorPlano, setErrorPlano] = useState<unknown>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[] | null>(null);
  const contactos = useQuery(consultasDeProgramacion.cliente(informe.clienteId));
  const elegidos = destinatarios ?? (contactos.data ? receptores(contactos.data.contactos, "informes") : []);
  const guardar = useGuardarInforme(informe.id);
  const publicar = usePublicarInforme(informe.id);
  const siguiente = (informe.versiones[0]?.numero ?? 0) + 1;
  const nombreDe = (lid: string) => {
    const c = informe.candidatos.find((x) => x.id === lid);
    return c ? `${c.formato} de ${c.tecnico}` : "Un levantamiento";
  };
  // La sesión vencida se resuelve ingresando de nuevo encima (rutas.tsx): su error no queda a la vista después.
  const error = errorPlano ?? (esSesionVencida(guardar.error) ? null : guardar.error);
  const actualizar = (cambio: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...cambio }));
  const salida = useSalidaProtegida(cambiado, { que: "el informe", guardar: guardarBorrador });
  const vigente = vigenteDe(informe);
  const reciben = contactos.data ? contactos.data.contactos.filter((c) => receptores(contactos.data.contactos, "informes").includes(c.id)).map((c) => c.nombre) : [];

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

  async function guardarBorrador() {
    const enviado = borrador;
    const r = await guardar.mutateAsync({ version, ...enviado });
    guardado(r.version, enviado);
    return r.version;
  }

  async function guardarYPublicar() {
    // Lo que se publica es lo guardado: si hay cambios, primero se guardan.
    const guardada = cambiado ? await guardarBorrador() : version;
    await publicar.mutateAsync({ version: guardada, destinatarios: elegidos });
  }

  function recargarDescartando() {
    guardar.reset();
    descartar();
    recargar();
  }

  const incluidos = borrador.levantamientos.map((lid) => informe.candidatos.find((c) => c.id === lid)).filter((c): c is Informe["candidatos"][number] => Boolean(c));
  const fuera = informe.candidatos.filter((c) => !borrador.levantamientos.includes(c.id));

  function capitulo(c: Informe["candidatos"][number], pos: number) {
    const dentro = pos >= 0;
    const revisado = c.estado === "revisado";
    return (
      <label key={c.id} className={`capitulo ${dentro ? "" : "fuera"}`}>
        <input
          type="checkbox"
          checked={dentro}
          disabled={!revisado && !dentro}
          onChange={(e) => actualizar({ levantamientos: e.target.checked ? [...borrador.levantamientos, c.id] : borrador.levantamientos.filter((x) => x !== c.id) })}
        />
        <span className="n">{dentro ? `2.${pos + 1}` : ""}</span>
        <span className="txt">
          <b>{c.formato}</b> de {c.tecnico}
          <small>
            recibido {aFechaCorta(c.recibidoEn)} · {ESTADO_LEVANTAMIENTO[c.estado]}
          </small>
        </span>
        {dentro ? (
          borrador.levantamientos.length > 1 && (
            <>
              <BotonIcono icono={ArrowUp} tamano="pequeno" etiqueta={`Subir ${c.formato} de ${c.tecnico}`} disabled={pos === 0} onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, pos, -1) })} />
              <BotonIcono icono={ArrowDown} tamano="pequeno" etiqueta={`Bajar ${c.formato} de ${c.tecnico}`} disabled={pos === borrador.levantamientos.length - 1} onClick={() => actualizar({ levantamientos: mover(borrador.levantamientos, pos, 1) })} />
            </>
          )
        ) : revisado ? null : (
          <Insignia tono={c.estado === "en_revision" ? "revision" : "enviado"}>{c.estado === "en_revision" ? "En revisión" : "Enviado"}</Insignia>
        )}
      </label>
    );
  }

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={`Informe de ${informe.visita.cliente}`}
        estado={vigente ? <Insignia tono="publicado">{`Versión ${vigente.numero} vigente`}</Insignia> : <Insignia tono={informe.versiones.length > 0 ? "anulado" : "borrador"}>{informe.versiones.length > 0 ? "Retirado del portal" : "Sin publicar"}</Insignia>}
        descripcion={
          <>
            <span>{informe.visita.sitio}</span>
            <span>Visita del {dia(informe.visita.programadaPara)}</span>
            <span>{informe.visita.motivo}</span>
            {contactos.data && (
              <span>
                Recibe el PDF: <b>{reciben.length > 0 ? enLista(reciben) : "nadie"}</b>
              </span>
            )}
          </>
        }
        acciones={
          <>
            <span className={`guardado ${cambiado ? "cambios" : ""}`} aria-live="polite">
              <i />
              {cambiado ? "Cambios sin guardar" : "Todo guardado"}
            </span>
            {cambiado && (
              <Boton cargando={guardar.isPending} disabled={subiendo} onClick={() => void guardarBorrador().catch(() => undefined)}>
                Guardar borrador
              </Boton>
            )}
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
          </>
        }
      />
      {error !== null && error !== undefined && (
        <Aviso tono="error">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {mensajeDeInforme(error, nombreDe).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {error instanceof ErrorApi && error.codigo === "conflicto_de_version" && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargarDescartando}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      <div className="con-carril">
        <div className="principal">
          {/* En el orden del PDF: introducción, un capítulo por levantamiento, conclusiones y planos anexos. */}
          <div className="doc">
            <section aria-labelledby="titulo-intro">
              <h2 id="titulo-intro">
                <span className="n">1</span>Introducción
              </h2>
              <textarea className="texto-doc" aria-labelledby="titulo-intro" maxLength={20_000} value={borrador.introduccion} onChange={(e) => actualizar({ introduccion: e.target.value })} placeholder="Qué se visitó y para qué" />
            </section>
            <section aria-labelledby="titulo-incluidos">
              <h2 id="titulo-incluidos">
                <span className="n">2</span>Levantamientos
              </h2>
              <p className="ayuda">Cada uno es un capítulo del PDF, en este orden. Solo entran los revisados.</p>
              {informe.candidatos.length === 0 ? (
                <p className="sec">Esta visita todavía no tiene levantamientos enviados.</p>
              ) : (
                <>
                  <div>{incluidos.map((c, k) => capitulo(c, k))}</div>
                  {fuera.length > 0 && (
                    <>
                      <h3>No entran</h3>
                      <div>{fuera.map((c) => capitulo(c, -1))}</div>
                    </>
                  )}
                </>
              )}
            </section>
            <section aria-labelledby="titulo-concl">
              <h2 id="titulo-concl">
                <span className="n">3</span>Conclusiones
              </h2>
              <textarea className="texto-doc" aria-labelledby="titulo-concl" maxLength={20_000} value={borrador.conclusiones} onChange={(e) => actualizar({ conclusiones: e.target.value })} placeholder="Qué se recomienda" />
            </section>
            <section aria-labelledby="titulo-planos">
              <h2 id="titulo-planos">
                <span className="n">4</span>Planos anexos
              </h2>
              <p className="ayuda">Los planos que elabora oficina, en PDF. Van al final del informe, en este orden.</p>
              {borrador.planos.map((p, i) => (
                <div key={p.huella} className="plano-fila">
                  <span className="pdf" aria-hidden>
                    PDF
                  </span>
                  <label className="sr-only" htmlFor={`plano-${p.huella}`}>
                    {`Nombre del plano ${i + 1}`}
                  </label>
                  <input
                    id={`plano-${p.huella}`}
                    className="control chico"
                    style={{ flex: 1, background: "transparent" }}
                    value={p.nombre}
                    onChange={(e) => actualizar({ planos: borrador.planos.map((x) => (x.huella === p.huella ? { ...x, nombre: e.target.value } : x)) })}
                  />
                  <BotonIcono icono={ArrowUp} tamano="pequeno" etiqueta={`Subir el plano ${i + 1}`} disabled={i === 0} onClick={() => actualizar({ planos: mover(borrador.planos, i, -1) })} />
                  <BotonIcono icono={ArrowDown} tamano="pequeno" etiqueta={`Bajar el plano ${i + 1}`} disabled={i === borrador.planos.length - 1} onClick={() => actualizar({ planos: mover(borrador.planos, i, 1) })} />
                  {/* Quitar un plano del borrador no pierde nada: el archivo sigue subido y se vuelve a agregar igual. */}
                  <BotonIcono icono={Trash} tamano="pequeno" etiqueta={`Quitar el plano ${i + 1}`} onClick={() => actualizar({ planos: borrador.planos.filter((x) => x.huella !== p.huella) })} />
                </div>
              ))}
              <SelectorDeArchivo fila etiqueta={subiendo ? "Subiendo…" : "Agregar planos en PDF"} aceptar="application/pdf" deshabilitado={subiendo} onElegir={(a) => void agregarPlanos(a)} />
            </section>
          </div>
        </div>
        <aside className="carril" aria-label="Versiones publicadas">
          <Versiones
            informe={informe}
            recargar={recargar}
            envios={
              vigente && (
                <PanelEnvios
                  cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }}
                  version={vigente}
                  contactos={contactos.data?.contactos}
                  enviar={(destinos, llave) => cliente.llamar("enviarVersion", { parametros: { id: informe.id, numero: vigente.numero }, cuerpo: { destinos, llave } })}
                  recargar={recargar}
                />
              )
            }
          />
          <div className="grupo-c">
            <p className="ayuda">Una versión publicada queda congelada. Para corregir algo se publica otra y la anterior se conserva.</p>
          </div>
        </aside>
      </div>

      {confirmando && (
        <Confirmacion
          titulo={`¿Publicar la versión ${siguiente}?`}
          confirmar={elegidos.length > 0 ? `Publicar y enviar a ${elegidos.length}` : `Publicar versión ${siguiente}`}
          nivel="irreversible"
          mensajeDeError={(e) => mensajeDeInforme(e, nombreDe).join(" ")}
          alCerrar={() => setConfirmando(false)}
          alTerminar={() =>
            notificar({ texto: elegidos.length > 0 ? `Versión ${siguiente} publicada. Se envía cuando el PDF esté listo.` : `Versión ${siguiente} publicada. El PDF se está generando.` })
          }
          accion={guardarYPublicar}
        >
          <p>El cliente la verá en el portal. Queda congelada: no se podrá modificar. Para corregir algo después se publica una versión nueva, y la anterior se conserva.</p>
          {contactos.isPending ? (
            <p className="ayuda">Cargando los contactos del cliente…</p>
          ) : contactos.isError ? (
            <Aviso tono="error">No se pudieron cargar los contactos: se publicará sin enviar. Podrá enviarla después desde "Envíos".</Aviso>
          ) : (
            <Destinatarios contactos={contactos.data.contactos} elegidos={elegidos} alCambiar={setDestinatarios} cliente={{ id: informe.clienteId, nombre: informe.visita.cliente }} titulo="Enviar el PDF cuando esté listo" />
          )}
          {elegidos.length > 0 && <p className="ayuda">Lo enviado no se puede recuperar, ni retirando la versión del portal.</p>}
        </Confirmacion>
      )}
      {salida}
    </>
  );
}

function Versiones({ informe, recargar, envios }: { informe: Informe; recargar: () => void; envios: ReactNode }) {
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
    <section className="grupo-c" aria-labelledby="titulo-versiones">
      <h2 id="titulo-versiones">Versiones publicadas</h2>
      {informe.versiones.length === 0 ? (
        <p className="ayuda">Todavía no se ha publicado ninguna versión.</p>
      ) : (
        <div>
          {informe.versiones.map((v) => (
            <div key={v.numero} className="ver">
              <div className="ver-cab">
                <b>Versión {v.numero}</b>
                {v.numero === vigente && <Insignia tono="publicado">Vigente</Insignia>}
                {v.retirada && <Insignia tono="anulado">Retirada</Insignia>}
                {v.pdf === "listo" ? (
                  <Boton variante="fantasma" tamano="pequeno" icono={Download} aria-label={`Descargar PDF de la versión ${v.numero}`} cargando={descargando === v.numero} onClick={() => void descargar(v.numero)}>
                    PDF
                  </Boton>
                ) : v.pdf === "generando" ? (
                  <span className="sec" style={{ fontSize: 13 }} aria-live="polite">
                    Generando el PDF…
                  </span>
                ) : (
                  <span className="msj-error">No se generó el PDF. Avísele a soporte.</span>
                )}
              </div>
              <span className="meta">{`Publicada ${aFechaCorta(v.publicadaEn)} por ${v.publicadaPor.nombre}${v.envios.length > 0 ? ` · ${v.envios.length === 1 ? "1 envío" : `${v.envios.length} envíos`}` : ""}`}</span>
              {v.retirada && <span className="meta">{`Retirada ${aFechaCorta(v.retirada.en)} por ${v.retirada.por.nombre}: ${v.retirada.motivo}`}</span>}
              {v.numero === vigente
                ? envios && (
                    <PanelConRetiro envios={envios} retirar={administrador && !v.retirada ? () => setRetirando(v.numero) : undefined} numero={v.numero} />
                  )
                : administrador &&
                  !v.retirada && (
                    <div>
                      <Boton variante="fantasma" tamano="pequeno" className="texto-peligro" aria-label={`Retirar la versión ${v.numero} del portal`} onClick={() => setRetirando(v.numero)}>
                        Retirar del portal
                      </Boton>
                    </div>
                  )}
            </div>
          ))}
        </div>
      )}
      {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo.</Aviso>}
      {retirando !== null && (
        <RetirarVersion informeId={informe.id} numero={retirando} envios={informe.versiones.find((v) => v.numero === retirando)?.envios ?? []} alCerrar={() => setRetirando(null)} alRetirar={recargar} />
      )}
    </section>
  );
}

/** Los envíos de la vigente, con "Retirar del portal" junto a "Enviar a otro contacto" (solo quien administra). */
function PanelConRetiro({ envios, retirar, numero }: { envios: ReactNode; retirar: (() => void) | undefined; numero: number }) {
  if (!retirar || !isValidElement<{ acciones?: ReactNode }>(envios)) return <>{envios}</>;
  return cloneElement(envios, {
    acciones: (
      <Boton variante="fantasma" tamano="pequeno" className="texto-peligro" aria-label={`Retirar la versión ${numero} del portal`} onClick={retirar}>
        Retirar del portal
      </Boton>
    ),
  });
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
      nivel="irreversible"
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
