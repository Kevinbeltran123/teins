import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  crearMedida,
  describirValor,
  esNoObtenido,
  type CodigoErrorValidacion,
  type DefinicionCampo,
  type Valor,
  type ValorMedida,
  type VersionFormato,
} from "@teins/dominio";
import { Aviso, Boton, CampoFotos, CampoMedida, CampoTexto, MarcaNoObtenido, Marquilla, ValorLeido } from "@teins/ui";
import { db, repositorio } from "../datos/instancia";
import type { EnvioLocal, EstadoServidor, LevantamientoLocal } from "../datos/modelo";
import { procesarFoto } from "../fotos/procesar";
import { fechaHora, horaExacta } from "../formato";
import { formatoDe, nombreDeFormato, useFormatos } from "../formatos";
import { claseDeTono, estadoDeEnvio, estadoSegunServidor, mensajeDeValidacion } from "../mensajes";
import { useServidorAlcanzable } from "../dispositivo/useConexion";
import { sincronizarEnSegundoPlano } from "../sincronizacion/disparar";

type Errores = ReadonlyMap<string, CodigoErrorValidacion>;
const claveDeError = (seccion: string, campo: string) => `${seccion}.${campo}`;

export function Captura({ id, volver }: { id: string; volver: () => void }) {
  // `null` distingue "no existe" de `undefined` (cargando).
  const levantamiento = useLiveQuery(async () => (await repositorio.obtener(id)) ?? null, [id]);
  const envio = useLiveQuery(async () => (await db.envios.get(id)) ?? null, [id]);
  const servidor = useLiveQuery(async () => (await db.estadosServidor.get(id)) ?? null, [id]);
  const formatos = useFormatos();
  const visita = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    return l?.visitaId && l.tecnicoId ? ((await db.visitas.get([l.tecnicoId, l.visitaId])) ?? null) : null;
  }, [id]);
  // Vencido el permiso de trabajo local, el borrador se ve pero no se edita (ADR-0009, parte 2).
  const bloqueado = useLiveQuery(async () => {
    const l = await repositorio.obtener(id);
    const bajada = l?.tecnicoId ? await db.bajadas.get(l.tecnicoId) : undefined;
    return bajada ? Date.parse(bajada.permisoLocalHasta) < Date.now() : false;
  }, [id]);
  // Los campos leen los valores una sola vez; después solo escriben (ver CampoTexto).
  const [inicial, setInicial] = useState<LevantamientoLocal>();
  useEffect(() => {
    if (levantamiento && !inicial) setInicial(levantamiento);
  }, [levantamiento, inicial]);

  const formato = levantamiento && formatos ? formatoDe(formatos, levantamiento) : undefined;
  const seccion = formato?.secciones[0];

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-4 pt-2 pb-5 text-sobre-superficie">
        <button
          type="button"
          onClick={volver}
          className="-ml-2 min-h-tactil rounded-control px-2 text-cuerpo font-bold text-sobre-superficie-suave focus-visible:outline-3 focus-visible:outline-acento"
        >
          Volver a mis visitas
        </button>
        <div className="mt-2 flex items-center gap-3">
          <Marquilla tono="sobre-superficie">{levantamiento?.estado === "enviado" ? "Enviado" : "Borrador"}</Marquilla>
          <span className="text-ayuda text-sobre-superficie-suave">
            {levantamiento && formatos ? nombreDeFormato(formatos, levantamiento.formato) : ""}
            {visita ? ` · ${visita.cliente.nombre}` : ""}
          </span>
        </div>
        <h1 className="mt-2 text-titulo leading-tight font-extrabold tracking-tight">{seccion?.titulo ?? "Levantamiento"}</h1>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        {levantamiento === undefined || envio === undefined || formatos === undefined || bloqueado === undefined || (levantamiento && !inicial) ? (
          <div aria-busy="true" aria-label="Cargando levantamiento" className="flex flex-col gap-6">
            <div className="h-[180px] animate-pulse rounded-panel bg-panel" />
            <div className="h-[140px] animate-pulse rounded-panel bg-panel" />
          </div>
        ) : levantamiento === null || !inicial ? (
          <>
            <Aviso tono="error">Este levantamiento no está en este teléfono.</Aviso>
            <Boton onClick={volver}>Volver a mis visitas</Boton>
          </>
        ) : !formato ? (
          <Aviso tono="error">Falta en este teléfono el formato de este levantamiento. Conéctate para descargarlo; el levantamiento se conserva.</Aviso>
        ) : levantamiento.estado === "enviado" ? (
          <Enviado levantamiento={levantamiento} formato={formato} envio={envio} servidor={servidor ?? null} />
        ) : bloqueado ? (
          <>
            <Aviso tono="alerta">Pasó demasiado tiempo sin conexión y la captura quedó bloqueada por seguridad. Nada se borró: conéctate para seguir.</Aviso>
            <Enviado levantamiento={levantamiento} formato={formato} envio={null} servidor={null} />
          </>
        ) : (
          <Borrador id={id} formato={formato} inicial={inicial} actual={levantamiento} />
        )}
      </main>
    </div>
  );
}

/** Panel por grupo (DESIGN.md, Placa): campos de datos seguidos juntos; cada campo de fotos aparte. */
function agrupar(campos: readonly DefinicionCampo[]): DefinicionCampo[][] {
  const grupos: DefinicionCampo[][] = [];
  for (const campo of campos) {
    const ultimo = grupos.at(-1);
    if (campo.tipo !== "foto" && ultimo && ultimo[0]!.tipo !== "foto") ultimo.push(campo);
    else grupos.push([campo]);
  }
  return grupos;
}

function Borrador({ id, formato, inicial, actual }: { id: string; formato: VersionFormato; inicial: LevantamientoLocal; actual: LevantamientoLocal }) {
  const [errores, setErrores] = useState<Errores | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const resumen = useRef<HTMLDivElement>(null);

  async function enviar() {
    setEnviando(true);
    try {
      const resultado = await repositorio.enviar(id, formato, new Date());
      if (resultado.ok) {
        sincronizarEnSegundoPlano();
        return;
      }
      if (resultado.motivo === "respuestas_invalidas") {
        setErrores(new Map(resultado.errores.map((e) => [claveDeError(e.seccion, e.campo ?? ""), e.codigo])));
        setConfirmando(false);
        requestAnimationFrame(() => resumen.current?.focus());
      }
    } finally {
      setEnviando(false);
    }
  }

  // Al corregir, el error de ese campo se va: la validación completa se repite al enviar.
  const alGuardar = (seccion: string, campo: string) => {
    if (errores?.has(claveDeError(seccion, campo))) {
      const siguiente = new Map(errores);
      siguiente.delete(claveDeError(seccion, campo));
      setErrores(siguiente);
    }
  };

  return (
    <>
      {errores && errores.size > 0 && (
        <div ref={resumen} tabIndex={-1} className="focus:outline-none">
          <Aviso tono="error">
            {errores.size === 1 ? "Falta 1 dato por completar." : `Faltan ${errores.size} datos por completar.`} Revisa los campos marcados.
          </Aviso>
        </div>
      )}
      {formato.secciones.map((seccion) =>
        agrupar(seccion.campos).map((grupo) => (
          <div key={`${seccion.clave}.${grupo[0]!.clave}`} className="flex flex-col gap-6 rounded-panel bg-panel p-4">
            {grupo.map((campo) => (
              <Campo
                key={campo.clave}
                id={id}
                seccion={seccion.clave}
                campo={campo}
                inicial={inicial.respuestas[seccion.clave]?.[campo.clave]}
                actual={actual.respuestas[seccion.clave]?.[campo.clave]}
                error={errores?.get(claveDeError(seccion.clave, campo.clave))}
                alGuardar={() => alGuardar(seccion.clave, campo.clave)}
              />
            ))}
          </div>
        )),
      )}
      <p className="text-ayuda text-texto-secundario" aria-live="polite">
        Guardado en este teléfono a las {horaExacta(actual.actualizadoEn)}
      </p>
      {confirmando ? (
        <Aviso>
          <p>Después de enviar ya no podrás editar este levantamiento. Oficina lo revisará.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Boton variante="principal" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Confirmar envío"}
            </Boton>
            <Boton onClick={() => setConfirmando(false)}>Seguir editando</Boton>
          </div>
        </Aviso>
      ) : (
        <Boton variante="principal" onClick={() => setConfirmando(true)}>
          Enviar a oficina
        </Boton>
      )}
    </>
  );
}

interface PropsCampo {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  inicial: Valor | undefined;
  actual: Valor | undefined;
  error: CodigoErrorValidacion | undefined;
  alGuardar: () => void;
}

function Campo({ id, seccion, campo, inicial, actual, error, alGuardar }: PropsCampo) {
  const guardar = (valor: Valor | undefined) => {
    alGuardar();
    return repositorio.guardarRespuesta(id, seccion, campo.clave, valor, new Date());
  };
  const noObtenido = esNoObtenido(actual);
  const mensaje = error ? mensajeDeValidacion[error] : undefined;
  const errorDeMotivo = error === "motivo_requerido" ? mensaje : undefined;
  const errorDelCampo = error === "motivo_requerido" ? undefined : mensaje;

  const control = (() => {
    switch (campo.tipo) {
      case "texto":
        return (
          <CampoTexto
            etiqueta={campo.etiqueta}
            obligatorio={campo.obligatorio}
            error={noObtenido ? undefined : errorDelCampo}
            deshabilitado={noObtenido}
            valorInicial={typeof inicial === "string" ? inicial : ""}
            onCambio={(texto) => void guardar(texto === "" ? undefined : texto)}
          />
        );
      case "medida": {
        const medida = inicial && !esNoObtenido(inicial) && typeof inicial === "object" && "valor" in inicial ? (inicial as ValorMedida) : undefined;
        return (
          <CampoMedida
            etiqueta={campo.etiqueta}
            obligatorio={campo.obligatorio}
            error={noObtenido ? undefined : errorDelCampo}
            deshabilitado={noObtenido}
            unidades={campo.unidades}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                void guardar(undefined);
                return true;
              }
              const valor = crearMedida(texto, unidad, campo.unidades);
              if (valor) void guardar(valor);
              return valor !== null;
            }}
          />
        );
      }
      case "foto":
        return <Fotos id={id} seccion={seccion} campo={campo} ids={noObtenido ? [] : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
    }
  })();

  if (!campo.obligatorio) return control;
  return (
    <div className="flex flex-col gap-2">
      {control}
      <MarcaNoObtenido
        dato={campo.etiqueta}
        marcado={noObtenido}
        motivoInicial={esNoObtenido(inicial) ? inicial.motivo : ""}
        error={errorDeMotivo}
        // Marcar reemplaza el dato; desmarcar lo deja vacío para capturarlo (regla 3).
        onCambio={(marcado, motivo) => void guardar(marcado ? { noObtenido: true, motivo } : undefined)}
      />
    </div>
  );
}

function useUrlsDeFotos(ids: readonly string[]) {
  const archivos = useLiveQuery(() => repositorio.obtenerArchivos(ids), [ids.join()]);
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  useEffect(() => {
    const nuevas = (archivos ?? []).map((a) => ({ id: a.id, url: URL.createObjectURL(new Blob([a.datos], { type: a.tipo })) }));
    setFotos(nuevas);
    return () => nuevas.forEach((f) => URL.revokeObjectURL(f.url));
  }, [archivos]);
  return fotos;
}

function Fotos({ id, seccion, campo, ids, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; ids: unknown; error: string | undefined; alGuardar: () => void }) {
  const fotos = useUrlsDeFotos(Array.isArray(ids) ? (ids as string[]) : []);
  const [procesando, setProcesando] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function agregar(originales: File[]) {
    setProcesando(true);
    setFallo(false);
    try {
      for (const original of originales) {
        const archivo = await procesarFoto(original, new Date());
        await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
        alGuardar();
      }
      // Las fotos suben por adelantado cuando hay señal (ADR-0003).
      sincronizarEnSegundoPlano();
    } catch (error) {
      // El técnico ve un mensaje simple; soporte necesita la causa (ADR-0017).
      console.error("No se pudo guardar la foto", error);
      setFallo(true);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CampoFotos etiqueta={campo.etiqueta} obligatorio={campo.obligatorio} error={error} fotos={fotos} procesando={procesando} onAgregar={agregar} />
      {fallo && <Aviso tono="error">No se pudo guardar la foto. Tómala de nuevo.</Aviso>}
    </div>
  );
}

function Enviado({
  levantamiento,
  formato,
  envio,
  servidor,
}: {
  levantamiento: LevantamientoLocal;
  formato: VersionFormato;
  envio: EnvioLocal | null;
  servidor: EstadoServidor | null;
}) {
  const enLinea = useServidorAlcanzable();
  // Lo que dijo el servidor en la bajada manda sobre el estado de envío del teléfono.
  const estado = servidor ? estadoSegunServidor(servidor) : envio ? estadoDeEnvio(envio, enLinea) : null;
  const comentarios = servidor?.comentarios ?? [];
  const sobre = (c: { seccion?: string | undefined; campo?: string | undefined }) =>
    formato.secciones.find((s) => s.clave === c.seccion)?.campos.find((f) => f.clave === c.campo)?.etiqueta;
  return (
    <>
      {estado && (
        <div className="flex flex-col gap-3 rounded-panel bg-panel p-4">
          <p className={`text-cuerpo font-bold ${claseDeTono[estado.tono]}`} aria-live="polite">
            {estado.texto}
          </p>
          {envio?.estado === "error" && (
            <Boton
              onClick={async () => {
                await repositorio.reintentarEnvio(levantamiento.id);
                sincronizarEnSegundoPlano();
              }}
            >
              Reintentar envío
            </Boton>
          )}
        </div>
      )}
      {comentarios.length > 0 && (
        <section aria-labelledby="titulo-comentarios" className="flex flex-col gap-3 rounded-panel bg-panel p-4">
          <h2 id="titulo-comentarios" className="text-subtitulo font-extrabold">
            Comentarios de oficina
          </h2>
          <ul className="flex flex-col gap-3">
            {comentarios.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 border-l-[3px] border-division pl-3">
                <p className="text-ayuda text-texto-secundario">
                  {c.autor} · {fechaHora(c.creadoEn)}
                  {sobre(c) && ` · Sobre ${sobre(c)!.toLowerCase()}`}
                </p>
                <p className="text-cuerpo whitespace-pre-line">{c.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {formato.secciones.map((seccion) =>
        agrupar(seccion.campos).map((grupo) => (
          <div key={`${seccion.clave}.${grupo[0]!.clave}`} className="flex flex-col gap-5 rounded-panel bg-panel p-4">
            {grupo.map((campo) => {
              const valor = levantamiento.respuestas[seccion.clave]?.[campo.clave];
              return campo.tipo === "foto" && !esNoObtenido(valor) ? (
                <FotosLeidas key={campo.clave} etiqueta={campo.etiqueta} ids={Array.isArray(valor) ? (valor as string[]) : []} />
              ) : (
                <ValorLeido key={campo.clave} etiqueta={campo.etiqueta}>
                  {describirValor(campo, valor)}
                </ValorLeido>
              );
            })}
          </div>
        )),
      )}
    </>
  );
}

function FotosLeidas({ etiqueta, ids }: { etiqueta: string; ids: readonly string[] }) {
  const fotos = useUrlsDeFotos(ids);
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
