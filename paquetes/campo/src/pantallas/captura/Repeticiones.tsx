import { useContext, useState, type ReactNode } from "react";
import { enFrase } from "../../recorrido";
import { claveDeRepeticion, LIMITES, type CodigoErrorValidacion, type DefinicionSeccion, type Valor, type VersionFormato } from "@teins/dominio";
import { Aviso, BarraDePaso, Boton, BotonAgregar, BotonSiguiente, Check, EncabezadoDePaso, FilaDeRepeticion, ListaDeRepeticiones, MenuAcciones, useLoNuevo, CampoTexto, Pencil, Plus, Trash, useNotificar, useSinRepetir } from "@teins/ui";
import { repositorio } from "../../datos/instancia";
import type { LevantamientoLocal } from "../../datos/modelo";
import { mensajeDeValidacion } from "../../mensajes";
import { datosDeResumen } from "../../resumen";
import { useUrlsDeFotos } from "./Fotos";
import { anclaDeSeccion, CabeceraDeLaVisita, VigilarGuardado } from "./contexto";

/**
 * Sección repetible (iteración 9) como lista de tarjetas: cada repetición resumida con su estado; tocarla la
 * abre. Agregar también es parte del borrador: se guarda en el teléfono al instante y abre la nueva.
 */
export function Repeticiones({
  id,
  formato,
  seccion,
  actual,
  faltanEn,
  error,
  alGuardar,
  abrir,
}: {
  id: string;
  formato: VersionFormato;
  seccion: DefinicionSeccion;
  actual: LevantamientoLocal;
  faltanEn: ReadonlyMap<string, number>;
  error: CodigoErrorValidacion | undefined;
  alGuardar: (seccion: string, campo: string) => void;
  abrir: (repeticion: string) => void;
}) {
  const lista = actual.repeticiones?.[seccion.clave] ?? [];
  // Solo la tarjeta recién agregada entra animada: las demás no se animan otra vez al volver (iteración 27).
  const esNueva = useLoNuevo(lista.map((r) => r.id));
  const etiqueta = seccion.repetible!.etiqueta;
  const maximo = seccion.repetible!.max ?? LIMITES.repeticiones;

  const vigilar = useContext(VigilarGuardado);
  // Un doble toque agrega una sola.
  const [agregar] = useSinRepetir(async () => {
    const escritura = repositorio.agregarRepeticion(id, formato, seccion.clave, new Date());
    vigilar(escritura);
    try {
      await escritura;
    } catch {
      return;
    }
    alGuardar(seccion.clave, "");
    const nueva = (await repositorio.obtener(id))?.repeticiones?.[seccion.clave]?.at(-1);
    if (nueva) abrir(nueva.id);
  });

  return (
    <section id={anclaDeSeccion(seccion.clave)} aria-label={seccion.titulo} className="flex flex-col gap-3">
      {error && <Aviso tono="error">{mensajeDeValidacion[error]}</Aviso>}
      {lista.length === 0 && <p className="text-cuerpo text-texto-secundario">{`Agrega uno por cada ${enFrase(etiqueta)} que revises. Si no aplica, sigue.`}</p>}
      {lista.length > 0 && (
        <>
          <p className="-mt-5 text-ayuda text-texto-secundario">{`${lista.filter((r) => (faltanEn.get(claveDeRepeticion(seccion.clave, r.id)) ?? 0) === 0).length} de ${lista.length} completos`}</p>
          <ListaDeRepeticiones etiqueta={seccion.titulo}>
            {lista.map((r) => {
              const clave = claveDeRepeticion(seccion.clave, r.id);
              return <FilaDeTablero key={r.id} seccion={seccion} nombre={r.nombre} respuestas={actual.respuestas[clave]} faltan={faltanEn.get(clave) ?? 0} nueva={esNueva(r.id)} onClick={() => abrir(r.id)} />;
            })}
          </ListaDeRepeticiones>
        </>
      )}
      <BotonAgregar icono={Plus} disabled={lista.length >= maximo} onClick={() => void agregar()}>
        {`Agregar ${enFrase(etiqueta)}`}
      </BotonAgregar>
      {lista.length >= maximo && <p className="text-ayuda text-texto-secundario">{`Este formato permite hasta ${maximo}.`}</p>}
    </section>
  );
}

/**
 * Una fila de la lista de repeticiones (iteración 32): su primera foto, lo que la identifica en una línea y cuánto
 * lleva de lo obligatorio.
 */
function FilaDeTablero({ seccion, nombre, respuestas, faltan: n, nueva, onClick }: { seccion: DefinicionSeccion; nombre: string; respuestas: Record<string, Valor> | undefined; faltan: number; nueva: boolean; onClick: () => void }) {
  const huellas = seccion.campos.filter((c) => c.tipo === "foto").flatMap((c) => (Array.isArray(respuestas?.[c.clave]) ? (respuestas![c.clave] as string[]) : []));
  const [primera] = useUrlsDeFotos(huellas.slice(0, 1));
  const obligatorios = seccion.campos.filter((c) => c.obligatorio).length;
  const detalle = [...datosDeResumen(seccion, respuestas).slice(0, 2).map((d) => d.valor), huellas.length === 0 ? "Sin fotos" : fotosEnTexto(huellas.length)].join(" · ");
  return <FilaDeRepeticion titulo={nombre} detalle={detalle} foto={primera?.url} faltan={n} avance={obligatorios === 0 ? 1 : (obligatorios - n) / obligatorios} nueva={nueva} onClick={onClick} />;
}

const fotosEnTexto = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

/**
 * Una repetición abierta (iteración 32): su nombre es el título; cambiarlo y quitarla van en el menú de arriba, lejos
 * del pulgar. Abajo, la siguiente sin volver a la lista; en la última, de vuelta a la lista.
 */
export function Repeticion({
  id,
  seccion,
  repeticion,
  posicion,
  siguiente,
  avance,
  error,
  volver,
  abrirSiguiente,
  children,
}: {
  id: string;
  seccion: DefinicionSeccion;
  repeticion: { id: string; nombre: string };
  /** Cuál es (desde 0) y cuántas hay. */
  posicion: { indice: number; total: number };
  siguiente: { id: string; nombre: string } | undefined;
  avance: number;
  error: CodigoErrorValidacion | undefined;
  volver: () => void;
  abrirSiguiente: () => void;
  children: ReactNode;
}) {
  const vigilar = useContext(VigilarGuardado);
  const notificar = useNotificar();
  const cabecera = useContext(CabeceraDeLaVisita);
  const etiqueta = seccion.repetible!.etiqueta;
  const errorDeNombre = error === "nombre_de_repeticion_invalido";
  const [renombrando, setRenombrando] = useState(errorDeNombre);

  /**
   * Quitar es al instante y se deshace desde la notificación (DESIGN.md, iteración 24c): está en el teléfono, así que
   * "Deshacer" lo devuelve a su lugar con lo escrito. Las fotos siguen guardadas mientras tanto.
   */
  async function quitar() {
    const escritura = repositorio.quitarRepeticion(id, seccion.clave, repeticion.id, new Date());
    vigilar(escritura);
    const quitada = await escritura.catch(() => undefined);
    volver();
    if (!quitada) return;
    notificar({
      texto: `${repeticion.nombre} quitado`,
      accion: {
        texto: "Deshacer",
        alHacer: () => vigilar(repositorio.restaurarRepeticion(id, seccion.clave, quitada.repeticion, quitada.posicion, quitada.respuestas, new Date())),
      },
    });
  }
  return (
    <>
      <EncabezadoDePaso transicion={cabecera} contexto={`${seccion.titulo} · ${posicion.indice + 1} de ${posicion.total}`} avance={avance} volver={volver} etiquetaVolver={`Volver a ${enFrase(seccion.titulo)}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-3 pb-40">
        {renombrando ? (
          <CampoTexto
            etiqueta={`Nombre del ${enFrase(etiqueta)}`}
            valorInicial={repeticion.nombre}
            error={errorDeNombre ? mensajeDeValidacion.nombre_de_repeticion_invalido : undefined}
            onCambio={(texto) => {
              // Un nombre vacío no se guarda: se conserva el anterior.
              if (texto.trim()) vigilar(repositorio.renombrarRepeticion(id, seccion.clave, repeticion.id, texto.trim(), new Date()));
            }}
          />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-titulo leading-tight font-extrabold tracking-tight">{repeticion.nombre}</h1>
            <MenuAcciones
              etiqueta={`Opciones de ${repeticion.nombre}`}
              opciones={[
                { texto: "Cambiar nombre", icono: Pencil, alElegir: () => setRenombrando(true) },
                { texto: `Quitar ${enFrase(etiqueta)}`, icono: Trash, peligro: true, alElegir: () => void quitar() },
              ]}
            />
          </div>
        )}
        <article aria-label={repeticion.nombre} className="flex flex-col gap-8">
          {children}
        </article>
      </main>
      <BarraDePaso>
        {renombrando ? (
          <BotonSiguiente icono={Check} onClick={() => setRenombrando(false)}>
            Listo
          </BotonSiguiente>
        ) : siguiente ? (
          <div className="flex w-full flex-col gap-1">
            <BotonSiguiente onClick={abrirSiguiente}>{`Siguiente: ${siguiente.nombre}`}</BotonSiguiente>
            <Boton variante="fantasma" className="w-full" onClick={volver}>
              Volver a la lista
            </Boton>
          </div>
        ) : (
          <BotonSiguiente icono={Check} onClick={volver}>
            {posicion.total === 1 ? `Listo, ver ${enFrase(seccion.titulo)}` : `Listo, ver los ${posicion.total}`}
          </BotonSiguiente>
        )}
      </BarraDePaso>
    </>
  );
}
