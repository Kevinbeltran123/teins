import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CELULAR, ErrorApi, type Respuesta } from "@teins/protocolo";
import {
  Aviso,
  Boton,
  CampoTexto,
  Casilla,
  CeldaTabla,
  Confirmacion,
  Dialogo,
  EncabezadoPagina,
  EsqueletoBloques,
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
} from "@teins/ui";
import { cliente } from "../api";
import { aFechaHora } from "../formato";
import { consultasDeProgramacion, mensajeDeProgramacion, useAccionDeProgramacion } from "../programacion";
import { AgregarSitio } from "./Clientes";

type Detalle = Respuesta<"obtenerCliente">;
type Contacto = Detalle["contactos"][number];

const migas = (
  <Link to="/clientes" className="hover:text-texto hover:underline focus-visible:outline-3 focus-visible:outline-superficie">
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

  if (consulta.isPending) {
    return (
      <>
        <EncabezadoPagina migas={migas} titulo="Cliente" />
        <EsqueletoBloques etiqueta="Cargando el cliente" altos={["medio", "bajo"]} />
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
  const contactos = [...recientes.map((r) => detalle.contactos.find((c) => c.id === r)).filter((c): c is Contacto => Boolean(c)), ...detalle.contactos.filter((c) => !recientes.includes(c.id))];
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
        acciones={
          <Boton variante="principal" icono={Plus} onClick={() => setEditando("nuevo")}>
            Nuevo contacto
          </Boton>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="titulo-contactos" className="flex min-w-0 flex-col gap-4 rounded-panel border border-division bg-panel p-6">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-contactos" className="text-subtitulo font-extrabold">
              Contactos
            </h2>
            <p className="text-ayuda text-texto-secundario">Cada contacto recibe lo que tiene marcado, informes o cotizaciones, con el PDF adjunto, por sus canales.</p>
          </div>
          {detalle.contactos.length === 0 ? (
            <EstadoVacio icono={Users} titulo="Nadie de este cliente recibe los informes">
              Con "Nuevo contacto" registra a quien los recibe por correo o WhatsApp. Mientras tanto, cada informe solo queda en el portal.
            </EstadoVacio>
          ) : (
            <Tabla
              etiqueta={`Contactos de ${detalle.nombre}`}
              columnas={[{ titulo: "Contacto" }, { titulo: "Correo" }, { titulo: "Celular" }, { titulo: "Recibe" }, { titulo: "Acciones", oculto: true, derecha: true }]}
            >
              {contactos.map((c) => (
                <FilaTabla key={c.id} resaltada={recientes.includes(c.id)}>
                  <CeldaTabla>
                    <span className="flex flex-col">
                      <strong className="whitespace-nowrap">{c.nombre}</strong>
                      {c.cargo && <span className="text-ayuda text-texto-secundario">{c.cargo}</span>}
                    </span>
                  </CeldaTabla>
                  <CeldaTabla>
                    <span className="flex flex-col gap-1">
                      <span className="whitespace-nowrap">{c.correo ?? <span className="text-texto-secundario">Sin correo</span>}</span>
                      {c.correoRebotado && (
                        <span className="flex items-center gap-1.5 text-ayuda font-bold text-error [&_svg]:size-4">
                          <TriangleAlert aria-hidden="true" />
                          {`El correo rebotó el ${dia(c.correoRebotado.en)}: revíselo`}
                        </span>
                      )}
                    </span>
                  </CeldaTabla>
                  <CeldaTabla>{c.celular ? <span className="whitespace-nowrap">{celularLegible(c.celular)}</span> : <span className="text-texto-secundario">Sin celular</span>}</CeldaTabla>
                  <CeldaTabla>
                    {(c.recibeCorreo || c.recibeWhatsapp) && (c.recibeInformes || c.recibeCotizaciones) ? (
                      <span className="flex flex-col gap-1">
                        <span>{[c.recibeInformes && "Informes", c.recibeCotizaciones && "Cotizaciones"].filter(Boolean).join(" y ")}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {c.recibeCorreo && <Insignia tono="neutro">Correo</Insignia>}
                          {c.recibeWhatsapp && <Insignia tono="neutro">WhatsApp</Insignia>}
                        </span>
                      </span>
                    ) : (
                      <span className="text-texto-secundario">Nada</span>
                    )}
                  </CeldaTabla>
                  <CeldaTabla derecha>
                    <span className="inline-flex items-center gap-1">
                      <Boton variante="fantasma" tamano="pequeno" aria-label={`Editar a ${c.nombre}`} onClick={() => setEditando(c)}>
                        Editar
                      </Boton>
                      <MenuAcciones etiqueta={`Más acciones de ${c.nombre}`} opciones={[{ texto: "Quitar contacto", peligro: true, alElegir: () => setQuitando(c) }]} />
                    </span>
                  </CeldaTabla>
                </FilaTabla>
              ))}
            </Tabla>
          )}
        </section>

        <section aria-labelledby="titulo-sitios" className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-sitios" className="text-subtitulo font-extrabold">
              Sitios
            </h2>
            <Boton variante="fantasma" tamano="pequeno" icono={Plus} aria-label={`Agregar sitio a ${detalle.nombre}`} onClick={() => setAgregandoSitio(true)}>
              Agregar sitio
            </Boton>
          </div>
          <ul className="flex flex-col gap-2">
            {detalle.sitios.map((s) => (
              <li key={s.id} className="flex flex-col">
                <strong>{s.nombre}</strong>
                <span className="text-ayuda text-texto-secundario">{s.direccion}</span>
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
        <CampoTexto etiqueta="Correo" nombre="correo" valorInicial={correo} onCambio={setCorreo} error={errores.correo} />
        <CampoTexto etiqueta="Celular" nombre="celular" valorInicial={contacto?.celular ? celularLegible(contacto.celular) : ""} onCambio={setCelular} error={errores.celular} modoEntrada="text" />
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-cuerpo font-bold">Recibe</legend>
          <Casilla marcada={recibeInformes} onCambio={setRecibeInformes}>
            Los informes
          </Casilla>
          <Casilla marcada={recibeCotizaciones} onCambio={setRecibeCotizaciones}>
            Las cotizaciones
          </Casilla>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-cuerpo font-bold">Por</legend>
          <Casilla marcada={recibeCorreo} onCambio={setRecibeCorreo}>
            Correo
          </Casilla>
          <Casilla marcada={recibeWhatsapp} onCambio={setRecibeWhatsapp}>
            WhatsApp
          </Casilla>
          {recibeWhatsapp && (
            <div className={`ml-8 flex flex-col gap-1 rounded-control border-[1.5px] px-4 py-2 ${errores.autorizacion ? "border-error" : "border-borde-control"}`}>
              <Casilla marcada={autorizado} onCambio={setAutorizado}>
                {`${quien} autorizó recibir el informe por WhatsApp`}
              </Casilla>
              <p className="pb-2 text-ayuda text-texto-secundario">
                {autorizacionVigente && autorizado
                  ? `Lo confirmó ${autorizacionVigente.por.nombre} el ${aFechaHora(autorizacionVigente.en)}.`
                  : "WhatsApp lo exige. Queda registrado que usted lo confirmó, y cuándo."}
              </p>
              {errores.autorizacion && <p className="pb-2 text-ayuda font-bold text-error">{errores.autorizacion}</p>}
            </div>
          )}
        </fieldset>
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}
