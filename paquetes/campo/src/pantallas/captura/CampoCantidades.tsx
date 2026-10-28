import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { esCantidades, normalizarDecimal, type DefinicionCampo, type Valor } from "@teins/dominio";
import { EditorMateriales, type LineaEditable } from "@teins/ui";
import { nuevoIdDeRepeticion } from "../../datos/dexie";
import { db, repositorio } from "../../datos/instancia";
import { itemsDelCatalogo } from "../../datos/lecturasDeCaptura";
import { useUsuario } from "../../sesion/usuario";
import { usosPorItem } from "../../catalogo";
// El catálogo para elegir materiales (ADR-0025): va con la captura, que ya se carga aparte del arranque.
import HojaCatalogo from "../HojaCatalogo";

/**
 * Cantidades (F9): texto libre, sin catálogo (regla 6). La cantidad se guarda como decimal canónico
 * cuando se puede leer ("12,5" → "12.5"); si no, tal cual, y la validación al enviar la marca.
 */
export function CampoCantidades({ campo, unidades, inicial, error, guardar }: { campo: DefinicionCampo; unidades: readonly string[]; inicial: Valor | undefined; error: string | undefined; guardar: (valor: Valor | undefined) => void }) {
  // El catálogo de la organización, bajado al teléfono (iteración 17, ADR-0025).
  const catalogo = useLiveQuery(() => itemsDelCatalogo(db), []);
  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    esCantidades(inicial)
      ? inicial.map((l) => ({ id: l.id, descripcion: l.descripcion, cantidad: l.cantidad.replace(".", ","), unidad: l.unidad, observacion: l.observacion ?? "", ...(l.item ? { catalogo: { id: l.item, codigo: "" } } : {}) }))
      : [],
  );
  const [buscando, setBuscando] = useState(false);
  const usuario = useUsuario();
  // Se cuentan al abrir la búsqueda: solo ordenan la lista (los que más usa este técnico en este teléfono).
  const usos = useLiveQuery(async () => (buscando && usuario ? usosPorItem(await repositorio.listar(usuario.id)) : undefined), [buscando, usuario?.id]);
  const codigos = new Map((catalogo ?? []).map((i) => [i.id, i.codigo]));
  // El código se muestra cuando el catálogo termina de leerse.
  const visibles = lineas.map((l) => (l.catalogo && !l.catalogo.codigo ? { ...l, catalogo: { id: l.catalogo.id, codigo: codigos.get(l.catalogo.id) ?? "" } } : l));
  // Sin nada que elegir para este campo, el botón no lleva a ninguna parte: no se ofrece.
  const hayQueElegir = (catalogo ?? []).some((i) => i.activo && unidades.includes(i.unidad));

  function cambiar(nuevas: LineaEditable[]) {
    setLineas(nuevas);
    guardar(
      nuevas.length === 0
        ? undefined
        : nuevas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: normalizarDecimal(l.cantidad) ?? l.cantidad,
            unidad: l.unidad,
            ...(l.observacion.trim() ? { observacion: l.observacion.trim() } : {}),
            ...(l.catalogo ? { item: l.catalogo.id } : {}),
          })),
    );
  }
  const agregar = (linea: Omit<LineaEditable, "id">) => cambiar([...lineas, { id: nuevoIdDeRepeticion(), ...linea }]);
  const indiceDe = (itemId: string) => lineas.findIndex((l) => l.catalogo?.id === itemId);
  return (
    <>
      <EditorMateriales
        etiqueta={campo.etiqueta}
        lineas={visibles}
        unidades={unidades}
        onCambio={cambiar}
        nuevoId={nuevoIdDeRepeticion}
        obligatorio={campo.obligatorio}
        error={error}
        buscar={hayQueElegir ? () => setBuscando(true) : undefined}
      />
      {buscando && catalogo && usos && (
        <HojaCatalogo
          items={catalogo}
          unidades={unidades}
          usos={usos}
          cantidadDe={(item) => {
            const i = indiceDe(item.id);
            return i >= 0 ? lineas[i]!.cantidad : undefined;
          }}
          elegir={(item) => agregar({ descripcion: item.descripcion, cantidad: "1", unidad: item.unidad, observacion: "", catalogo: { id: item.id, codigo: item.codigo } })}
          sumar={(item, delta) => {
            const i = indiceDe(item.id);
            if (i < 0) return;
            const siguiente = Math.max(0, (Number(lineas[i]!.cantidad.replace(",", ".")) || 0) + delta);
            cambiar(siguiente === 0 ? lineas.filter((_, j) => j !== i) : lineas.map((l, j) => (j === i ? { ...l, cantidad: String(siguiente).replace(".", ",") } : l)));
          }}
          libre={(descripcion) => {
            agregar({ descripcion, cantidad: "1", unidad: unidades[0] ?? "", observacion: "" });
            setBuscando(false);
          }}
          cerrar={() => setBuscando(false)}
        />
      )}
    </>
  );
}
