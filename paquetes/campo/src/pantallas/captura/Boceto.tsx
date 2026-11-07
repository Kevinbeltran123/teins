import { lazy, Suspense, useState } from "react";
import { enFrase } from "../../recorrido";
import { useLiveQuery } from "dexie-react-hooks";
import { describirValor, esBoceto, hojasDe, LIENZO, type DefinicionCampo, type Valor } from "@teins/dominio";
import { Boton, EtiquetaCampo, HojasDeBoceto, MensajeError, Pencil } from "@teins/ui";
import { db, repositorio } from "../../datos/instancia";
import { simbolosGuardados } from "../../datos/lecturasDeCaptura";

// El editor de bocetos pesa (perfect-freehand y la lógica del lienzo): se carga solo al dibujar (ADR-0011).
const EditorBoceto = lazy(() => import("../EditorBoceto"));

/** El paso del croquis: el editor abierto, como en el prototipo; "Listo" sigue y volver lleva al recorrido. */
export function PasoCroquis({
  id,
  seccion,
  campo,
  actual,
  alGuardar,
  volver,
  listo,
}: {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  actual: Valor | undefined;
  alGuardar: () => void;
  volver: () => void;
  listo: () => void;
}) {
  const documento = useBoceto(actual);
  const simbolos = useLiveQuery(() => simbolosGuardados(db), []);
  // La capa sube una sola vez, mientras se lee el documento y se carga el editor; el editor aparece encima sin subir
  // otra vez (iteración 32: antes se veía un fondo vacío y después el editor subiendo).
  return (
    <div aria-busy={documento === undefined} aria-label={documento === undefined ? "Abriendo el editor" : undefined} data-tema="claro" className="fixed inset-0 z-50 bg-fondo motion-safe:animate-hoja-sube">
      {documento !== undefined && (
        <Suspense fallback={null}>
          <EditorBoceto
            entrar={false}
            etiqueta={campo.etiqueta}
            inicial={documento}
            simbolos={simbolos}
            guardar={async (d) => {
              await repositorio.guardarBoceto(id, seccion, campo.clave, d, new Date());
              alGuardar();
            }}
            cerrar={volver}
            listo={listo}
          />
        </Suspense>
      )}
    </div>
  );
}

/** Boceto (ADR-0019): miniatura y editor a pantalla completa. El documento vive en el archivo local. */
function useBoceto(valor: Valor | undefined) {
  const huella = esBoceto(valor) ? valor.boceto : undefined;
  return useLiveQuery(async () => (huella ? repositorio.obtenerBoceto(huella) : null), [huella]);
}

export function CampoBoceto({ id, seccion, campo, actual, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; actual: Valor | undefined; error: string | undefined; alGuardar: () => void }) {
  const documento = useBoceto(actual);
  // La hoja con la que abre el editor: tocar una de las miniaturas abre esa (ADR-0026).
  const [editando, setEditando] = useState<number | null>(null);
  const hojas = documento ? hojasDe(documento) : [];
  const hayDibujo = hojas.some((h) => h.elementos.length > 0);
  // La biblioteca de símbolos (ADR-0027), solo mientras se dibuja.
  const simbolos = useLiveQuery(() => (editando === null ? [] : simbolosGuardados(db)), [editando === null]);
  return (
    <div className="flex flex-col gap-2">
      <EtiquetaCampo obligatorio={campo.obligatorio}>{campo.etiqueta}</EtiquetaCampo>
      {hayDibujo ? (
        <HojasDeBoceto hojas={hojas} cuadricula={LIENZO.cuadricula} etiqueta={`Boceto de ${enFrase(campo.etiqueta)}`} alAbrir={setEditando} />
      ) : (
        <p className="text-ayuda text-texto-secundario">Todavía no hay boceto.</p>
      )}
      {error && <MensajeError id={`error-${seccion}-${campo.clave}`}>{error}</MensajeError>}
      {/* Mientras se lee lo guardado no se abre: el editor partiría de una hoja vacía y la reemplazaría (iteración 42). */}
      <Boton icono={Pencil} disabled={documento === undefined} onClick={() => setEditando(0)}>
        {hayDibujo ? "Editar boceto" : "Dibujar boceto"}
      </Boton>
      {editando !== null && (
        <Suspense fallback={<div aria-busy="true" aria-label="Abriendo el editor" className="fixed inset-0 z-50 bg-fondo" />}>
          <EditorBoceto
            etiqueta={campo.etiqueta}
            inicial={documento ?? null}
            hojaInicial={editando}
            simbolos={simbolos}
            guardar={async (d) => {
              await repositorio.guardarBoceto(id, seccion, campo.clave, d, new Date());
              alGuardar();
            }}
            cerrar={() => setEditando(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

export function BocetoLeido({ etiqueta, valor }: { etiqueta: string; valor: Valor | undefined }) {
  const documento = useBoceto(valor);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      {documento ? (
        <HojasDeBoceto hojas={hojasDe(documento)} cuadricula={LIENZO.cuadricula} etiqueta={`Boceto de ${enFrase(etiqueta)}`} />
      ) : (
        <p className="text-ayuda text-texto-secundario">{describirValor({ clave: "", etiqueta, tipo: "boceto" }, valor)}</p>
      )}
    </div>
  );
}
