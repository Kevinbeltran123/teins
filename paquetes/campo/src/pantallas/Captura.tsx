import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { crearMedida, type DefinicionCampo, type Levantamiento, type ValorMedida } from "@teins/dominio";
import { Aviso, Boton, CampoFotos, CampoMedida, CampoTexto, Marquilla } from "@teins/ui";
import { repositorio } from "../datos/instancia";
import { procesarFoto } from "../fotos/procesar";
import { horaExacta } from "../formato";
import { formatoDemo, NOMBRE_FORMATO_DEMO } from "../formato-demo";

export function Captura({ id, volver }: { id: string; volver: () => void }) {
  // `null` distingue "no existe" de `undefined` (cargando).
  const levantamiento = useLiveQuery(async () => (await repositorio.obtener(id)) ?? null, [id]);
  // Los campos leen los valores una sola vez; después solo escriben (ver CampoTexto).
  const [inicial, setInicial] = useState<Levantamiento>();
  useEffect(() => {
    if (levantamiento && !inicial) setInicial(levantamiento);
  }, [levantamiento, inicial]);

  const seccion = formatoDemo.secciones[0]!;

  return (
    <div className="min-h-dvh bg-fondo-campo">
      <header className="bg-superficie px-4 pt-4 pb-5 text-sobre-superficie">
        <button
          type="button"
          onClick={volver}
          className="-ml-2 min-h-tactil-campo rounded-control px-2 text-campo font-bold text-sobre-superficie-suave focus-visible:outline-3 focus-visible:outline-acento"
        >
          Volver a levantamientos
        </button>
        <div className="mt-2 flex items-center gap-3">
          <Marquilla tono="borrador">Borrador</Marquilla>
          <span className="text-ayuda text-sobre-superficie-suave">{NOMBRE_FORMATO_DEMO}</span>
        </div>
        <h1 className="mt-2 font-display text-titulo leading-none font-bold">{seccion.titulo}</h1>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        {levantamiento === undefined || (levantamiento && !inicial) ? (
          <div aria-busy="true" aria-label="Cargando levantamiento" className="flex flex-col gap-6">
            <div className="h-[88px] animate-pulse rounded-panel bg-division" />
            <div className="h-[88px] animate-pulse rounded-panel bg-division" />
          </div>
        ) : levantamiento === null || !inicial ? (
          <>
            <Aviso tono="error">Este levantamiento no está en este teléfono.</Aviso>
            <Boton onClick={volver}>Volver a levantamientos</Boton>
          </>
        ) : (
          <>
            {seccion.campos.map((campo) => (
              <Campo key={campo.clave} id={id} seccion={seccion.clave} campo={campo} inicial={inicial} actual={levantamiento} />
            ))}
            <p className="text-ayuda text-texto-secundario" aria-live="polite">
              Guardado en este teléfono a las {horaExacta(levantamiento.actualizadoEn)}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

interface PropsCampo {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  inicial: Levantamiento;
  actual: Levantamiento;
}

function Campo({ id, seccion, campo, inicial, actual }: PropsCampo) {
  const valorInicial = inicial.respuestas[seccion]?.[campo.clave];
  const guardar = (valor: Parameters<typeof repositorio.guardarRespuesta>[3]) =>
    repositorio.guardarRespuesta(id, seccion, campo.clave, valor, new Date());

  switch (campo.tipo) {
    case "texto":
      return (
        <CampoTexto
          etiqueta={campo.etiqueta}
          valorInicial={typeof valorInicial === "string" ? valorInicial : ""}
          onCambio={(texto) => void guardar(texto === "" ? undefined : texto)}
        />
      );
    case "medida": {
      const medida = valorInicial as ValorMedida | undefined;
      return (
        <CampoMedida
          etiqueta={campo.etiqueta}
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
      return <Fotos id={id} seccion={seccion} campo={campo} ids={actual.respuestas[seccion]?.[campo.clave]} />;
  }
}

function Fotos({ id, seccion, campo, ids }: { id: string; seccion: string; campo: DefinicionCampo; ids: unknown }) {
  const lista = Array.isArray(ids) ? (ids as string[]) : [];
  const archivos = useLiveQuery(() => repositorio.obtenerArchivos(lista), [lista.join()]);
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const nuevas = (archivos ?? []).map((a) => ({ id: a.id, url: URL.createObjectURL(new Blob([a.datos], { type: a.tipo })) }));
    setFotos(nuevas);
    return () => nuevas.forEach((f) => URL.revokeObjectURL(f.url));
  }, [archivos]);

  async function agregar(originales: File[]) {
    setProcesando(true);
    setError(false);
    try {
      for (const original of originales) {
        const archivo = await procesarFoto(original, new Date());
        await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
      }
    } catch {
      setError(true);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CampoFotos etiqueta={campo.etiqueta} fotos={fotos} procesando={procesando} onAgregar={agregar} />
      {error && <Aviso tono="error">No se pudo guardar la foto. Tómala de nuevo.</Aviso>}
    </div>
  );
}
