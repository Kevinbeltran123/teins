import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { CELULAR, ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  CampoTexto,
  CeldaTabla,
  Confirmacion,
  Dialogo,
  EncabezadoPagina,
  nombreDeTransicion,
  EsqueletoLista,
  ChevronLeft,
  Mail,
  MapPin,
  Smartphone,
  EstadoVacio,
  FilaTabla,
  Insignia,
  MenuAcciones,
  Plus,
  RefreshCw,
  Tabla,
  TriangleAlert,
  Users,
  useNotificar,
  enfocarPrimerError,
  useLoNuevo,
} from "@teins/ui";
import { cliente } from "../api";
import { aFechaHora } from "../formato";
import { consultasDeProgramacion, mensajeDeProgramacion, useAccionDeProgramacion } from "../programacion";
import { AgregarSitio } from "./Clientes";

type Detalle = Respuesta<"obtenerCliente">;
type Contacto = Detalle["contactos"][number];

const migas = (
  <Link to="/clientes" className="migas">
    <ChevronLeft aria-hidden size={16} />
    Clientes
  </Link>
);

const dia = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(iso));

/**
 * Celular como lo exige WhatsApp (E.164). Oficina escribe el número colombiano de 10 dígitos, con o sin
 * espacios; uno de otro país se escribe con su "+".
 */
export function aCelular(texto: string): string | null {
  const limpio = texto.replace(/[\s().-]/g, "");
  if (limpio === "") return null;
  return limpio.startsWith("+") ? limpio : /^3\d{9}$/.test(limpio) ? `+57${limpio}` : limpio;
}

/** "+57 300 555 0117": legible para dictarlo. */
const celularLegible = (e164: string) => (e164.startsWith("+57") && e164.length === 13 ? `+57 ${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}` : e164);

export function DetalleCliente({ id }: { id: string }) {
  const consulta = useQuery(consultasDeProgramacion.cliente(id));
  const notificar = useNotificar();
  const [editando, setEditando] = useState<Contacto | "nuevo" | null>(null);
  const [quitando, setQuitando] = useState<Contacto | null>(null);
  const [agregandoSitio, setAgregandoSitio] = useState(false);
  // Lo creado o cambiado en esta visita a la pantalla: va primero y resaltado (DESIGN.md, crear y editar).
  const [recientes, setRecientes] = useState<string[]>([]);
  // Se llegó desde "Agregar contactos" al crear el cliente: "Nuevo contacto" queda con el foco (iteración 27).
  const esNuevo = useLoNuevo(consulta.data?.contactos.map((c) => c.id));
  const pedirContactos = useLocation({ select: (l) => l.state.siguiente === "contactos" });

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cliente" />
        <EsqueletoLista etiqueta="Cargando el cliente" />
      </>
    );
  }
  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.codigo === "no_encontrado";
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cliente" />
        <Aviso tono="error">
          <p>{noExiste ? "Este cliente no existe o no pertenece a su organización." : "No se pudo cargar el cliente."}</p>
          {!noExiste && (
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          )}
        </Aviso>
      </>
    );
  }

  const detalle = consulta.data;
  // Lo creado entra primero y resaltado en la misma transición; lo cambiado se resalta en su lugar (iteración 27).
  const contactos = [...detalle.contactos.filter((c) => esNuevo(c.id)), ...detalle.contactos.filter((c) => !esNuevo(c.id))];
  const guardado = (actualizado: Detalle, nombre: string, nuevo: boolean) => {
    const anteriores = new Set(detalle.contactos.map((c) => c.id));
    const id = nuevo ? actualizado.contactos.find((c) => !anteriores.has(c.id))?.id : editando !== "nuevo" ? editando?.id : undefined;
    setEditando(null);
    if (id) setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
    notificar({ texto: nuevo ? `Contacto creado: ${nombre}` : `Contacto guardado: ${nombre}` });
  };

  return (
    <>
      <EncabezadoPagina
        migas={migas}
        titulo={detalle.nombre}
        transicion={nombreDeTransicion("nombre", detalle.id)}
        descripcion={
          <>
            <span>
              <b>{detalle.sitios.length}</b> {detalle.sitios.length === 1 ? "sitio" : "sitios"}
            </span>
            <span>
              <b>{detalle.contactos.length}</b> {detalle.contactos.length === 1 ? "contacto" : "contactos"}
            </span>
          </>
        }
        acciones={
          <Boton
            variante="principal"
            icono={Plus}
            onClick={() => setEditando("nuevo")}
            autoFocus={pedirContactos && detalle.contactos.length === 0}
            className={pedirContactos && detalle.contactos.length === 0 ? "foco-anillo" : ""}
          >
            Nuevo contacto
          </Boton>
        }
      />
      <div className="doc">
        <section aria-labelledby="titulo-contactos">
          <div className="cab-sec">
            <h2 id="titulo-contactos">Contactos</h2>
          </div>
          <p className="ayuda">Cada contacto recibe lo que tiene marcado, informes o cotizaciones, con el PDF adjunto, por sus canales.</p>
          {detalle.contactos.length === 0 ? (
            <EstadoVacio icono={Users} titulo="Nadie de este cliente recibe los informes">
              Con "Nuevo contacto" registra a quien los recibe por correo o WhatsApp. Mientras tanto, cada informe solo queda en el portal.
            </EstadoVacio>
          ) : (
            <Tabla etiqueta={`Contactos de ${detalle.nombre}`} columnas={[{ titulo: "Contacto" }, { titulo: "Cómo le llega" }, { titulo: "Recibe" }, { titulo: "Acciones", oculto: true, derecha: true }]}>
              {contactos.map((c) => (
                <FilaTabla key={c.id} resaltada={esNuevo(c.id) || recientes.includes(c.id)} clave={c.id}>
                  <CeldaTabla>
                    <span className="fuerte">{c.nombre}</span>
                    {c.cargo && <span className="sub">{c.cargo}</span>}
                  </CeldaTabla>
                  <CeldaTabla>
                    <div className="contacto-medio">
                      <span className={c.correo ? "" : "sec"}>
                        <Mail aria-hidden size={15} />
                        {c.correo ?? "Sin correo"}
                      </span>
                      {c.correoRebotado && (
                        <span style={{ color: "var(--alerta)", fontWeight: 700, fontSize: 13 }}>
                          <TriangleAlert aria-hidden size={14} />
                          {`El correo rebotó el ${dia(c.correoRebotado.en)}: revíselo`}
                        </span>
                      )}
                      <span className={c.celular ? "" : "sec"}>
                        <Smartphone aria-hidden size={15} />
                        {c.celular ? celularLegible(c.celular) : "Sin celular"}
                      </span>
                    </div>
                  </CeldaTabla>
                  <CeldaTabla>
                    {(c.recibeCorreo || c.recibeWhatsapp) && (c.recibeInformes || c.recibeCotizaciones) ? (
                      <>
                        <span className="fuerte">{c.recibeInformes && c.recibeCotizaciones ? "Informes y cotizaciones" : c.recibeInformes ? "Informes" : "Cotizaciones"}</span>
                        <span className="sub">por {[c.recibeCorreo && "correo", c.recibeWhatsapp && "WhatsApp"].filter(Boolean).join(" y ")}</span>
                      </>
                    ) : (
                      <span className="sec">Nada</span>
                    )}
                  </CeldaTabla>
                  <CeldaTabla derecha>
                    <div className="fila-flex" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <Boton variante="fantasma" tamano="pequeno" aria-label={`Editar a ${c.nombre}`} onClick={() => setEditando(c)}>
                        Editar
                      </Boton>
                      <MenuAcciones etiqueta={`Más acciones de ${c.nombre}`} opciones={[{ texto: "Quitar contacto", peligro: true, alElegir: () => setQuitando(c) }]} />
                    </div>
                  </CeldaTabla>
                </FilaTabla>
              ))}
            </Tabla>
          )}
        </section>

        <section aria-labelledby="titulo-sitios">
          <div className="cab-sec">
            <h2 id="titulo-sitios">Sitios</h2>
            <Boton variante="fantasma" tamano="pequeno" icono={Plus} aria-label={`Agregar sitio a ${detalle.nombre}`} onClick={() => setAgregandoSitio(true)}>
              Agregar sitio
            </Boton>
          </div>
          <ul className="filas estrecho" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {detalle.sitios.map((s) => (
              <li key={s.id} className="fila">
                <MapPin aria-hidden size={18} />
                <div className="txt">
                  <b>{s.nombre}</b>
                  <small>{s.direccion}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editando && (
        <FormularioContacto
          clienteId={detalle.id}
          clienteNombre={detalle.nombre}
          contacto={editando === "nuevo" ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={(actualizado, nombre) => guardado(actualizado, nombre, editando === "nuevo")}
        />
      )}
      {quitando && (
        <Confirmacion
          nivel="consecuencia"
          titulo={`¿Quitar a ${quitando.nombre}?`}
          confirmar="Quitar contacto"
          mensajeDeError={mensajeDeProgramacion}
          alCerrar={() => setQuitando(null)}
          alTerminar={() => notificar({ texto: `Contacto quitado: ${quitando.nombre}` })}
          accion={async () => {
            await cliente.llamar("quitarContacto", { parametros: { id: detalle.id, contactoId: quitando.id } });
            await consulta.refetch();
          }}
        >
          <p>Deja de recibir los informes y se borran su correo y su celular. Los envíos que ya recibió siguen en el historial de cada informe.</p>
        </Confirmacion>
      )}
      {agregandoSitio && (
        <AgregarSitio
          c={detalle}
          alCerrar={() => setAgregandoSitio(false)}
          alAgregar={() => {
            setAgregandoSitio(false);
            notificar({ texto: `Sitio agregado a ${detalle.nombre}` });
          }}
        />
      )}
    </>
  );
}

interface Errores {
  nombre?: string;
  correo?: string;
  celular?: string;
  autorizacion?: string;
}

/** Crear o editar un contacto, en la hoja lateral (DESIGN.md, crear y editar). */
function FormularioContacto({
  clienteId,
  clienteNombre,
  contacto,
  alCerrar,
  alGuardar,
}: {
  clienteId: string;
  clienteNombre: string;
  contacto: Contacto | null;
  alCerrar: () => void;
  alGuardar: (detalle: Detalle, nombre: string) => void;
}) {
  const formulario = useId();
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [correo, setCorreo] = useState(contacto?.correo ?? "");
  const [celular, setCelular] = useState(contacto?.celular ?? "");
  const [recibeCorreo, setRecibeCorreo] = useState(contacto?.recibeCorreo ?? true);
  const [recibeWhatsapp, setRecibeWhatsapp] = useState(contacto?.recibeWhatsapp ?? false);
  const [recibeInformes, setRecibeInformes] = useState(contacto?.recibeInformes ?? true);
  const [recibeCotizaciones, setRecibeCotizaciones] = useState(contacto?.recibeCotizaciones ?? false);
  const [autorizado, setAutorizado] = useState(contacto?.whatsappAutorizado !== null && contacto?.whatsappAutorizado !== undefined);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);

  const celularE164 = aCelular(celular);
  // La autorización es del número: si cambia, se vuelve a confirmar (ADR-0028, parte 5).
  const autorizacionVigente = contacto?.whatsappAutorizado && contacto.celular === celularE164 ? contacto.whatsappAutorizado : null;
  const quien = nombre.trim().split(/\s+/)[0] || "El contacto";

  const datos = () => ({
    nombre: nombre.trim(),
    cargo: cargo.trim(),
    correo: correo.trim() || null,
    celular: celularE164,
    recibeCorreo,
    recibeWhatsapp,
    recibeInformes,
    recibeCotizaciones,
    whatsappAutorizado: recibeWhatsapp && autorizado,
  });
  const guardar = useAccionDeProgramacion(() =>
    contacto
      ? cliente.llamar("editarContacto", { parametros: { id: clienteId, contactoId: contacto.id }, cuerpo: datos() })
      : cliente.llamar("crearContacto", { parametros: { id: clienteId }, cuerpo: datos() }),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const correoLimpio = correo.trim();
    const faltan: Errores = {
      ...(nombre.trim() === "" ? { nombre: "Escriba el nombre del contacto." } : {}),
      ...(recibeCorreo && correoLimpio === "" ? { correo: "Para recibir el informe por correo hace falta el correo." } : {}),
      ...(correoLimpio !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio) ? { correo: "Revise el correo: le falta algo, como la @ o el dominio." } : {}),
      ...(recibeWhatsapp && !celularE164 ? { celular: "Para recibir el informe por WhatsApp hace falta el celular." } : {}),
      ...(celularE164 && !CELULAR.test(celularE164) ? { celular: "Escriba los 10 dígitos del celular, o el número con + y el indicativo si es de otro país." } : {}),
      ...(recibeWhatsapp && !autorizado ? { autorizacion: "WhatsApp exige que el contacto haya autorizado los mensajes." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) enfocarPrimerError(formulario);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      alGuardar(await guardar.mutateAsync(undefined), nombre.trim());
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      forma="lateral"
      titulo={contacto ? `Editar a ${contacto.nombre}` : "Nuevo contacto"}
      subtitulo={clienteNombre}
      cerrable={!guardar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={guardar.isPending}>
            {contacto ? "Guardar contacto" : "Crear contacto"}
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoTexto etiqueta="Nombre" nombre="nombre" valorInicial={nombre} onCambio={setNombre} error={errores.nombre} autoComplete="off" />
        <CampoTexto etiqueta="Cargo (opcional)" nombre="cargo" valorInicial={cargo} onCambio={setCargo} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CampoTexto etiqueta="Correo" nombre="correo" tipo="email" modoEntrada="email" autoComplete="email" valorInicial={correo} onCambio={setCorreo} error={errores.correo} />
          <CampoTexto etiqueta="Celular" nombre="celular" valorInicial={contacto?.celular ? celularLegible(contacto.celular) : ""} onCambio={setCelular} error={errores.celular} tipo="tel" modoEntrada="tel" autoComplete="tel" />
        </div>
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etq" style={{ marginBottom: 6 }}>Recibe</legend>
          <div className="opciones">
            <label className="opcion">
              <input type="checkbox" checked={recibeInformes} onChange={(e) => setRecibeInformes(e.target.checked)} />
              Los informes
            </label>
            <label className="opcion">
              <input type="checkbox" checked={recibeCotizaciones} onChange={(e) => setRecibeCotizaciones(e.target.checked)} />
              Las cotizaciones
            </label>
          </div>
        </fieldset>
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etq" style={{ marginBottom: 6 }}>Por</legend>
          <div className="opciones">
            <label className="opcion">
              <input type="checkbox" checked={recibeCorreo} onChange={(e) => setRecibeCorreo(e.target.checked)} />
              Correo
            </label>
            <label className="opcion">
              <input type="checkbox" checked={recibeWhatsapp} onChange={(e) => setRecibeWhatsapp(e.target.checked)} />
              WhatsApp
            </label>
          </div>
        </fieldset>
        {recibeWhatsapp && (
          <label className="casilla" style={{ boxShadow: errores.autorizacion ? "inset 0 0 0 2px var(--peligro)" : undefined }}>
            <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} />
            <span>
              <b>{`${quien} autorizó recibir el informe por WhatsApp`}</b>
              <span style={{ display: "block", color: "var(--sec)", fontSize: 13 }}>
                {autorizacionVigente && autorizado
                  ? `Lo confirmó ${autorizacionVigente.por.nombre} el ${aFechaHora(autorizacionVigente.en)}.`
                  : "WhatsApp lo exige. Queda registrado que usted lo confirmó, y cuándo."}
              </span>
              {errores.autorizacion && <span className="msj-error">{errores.autorizacion}</span>}
            </span>
          </label>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}
