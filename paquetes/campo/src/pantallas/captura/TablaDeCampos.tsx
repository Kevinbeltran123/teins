import { useContext } from "react";
import { crearMedida, type DefinicionCampo, type TablaDeMedidas as Tabla, type Valor, type ValorMedida } from "@teins/dominio";
import { TablaDeMedidas } from "@teins/ui";
import { repositorio } from "../../datos/instancia";
import { anclaDeDato, VigilarGuardado } from "./contexto";

type Medida = Extract<DefinicionCampo, { tipo: "medida" }>;

/**
 * Una tabla de medidas de la sección (ADR-0050): cada casilla es un campo `medida` que se guarda solo, con la misma
 * validación que `CampoMedida`. Solo lleva las filas cuyos campos están en este paso.
 */
export function TablaDeCampos({ id, seccion, tabla, campos, respuestas, alGuardar }: { id: string; seccion: string; tabla: Tabla; campos: ReadonlyMap<string, DefinicionCampo>; respuestas: Readonly<Record<string, Valor>> | undefined; alGuardar: (campo: string) => void }) {
  const vigilar = useContext(VigilarGuardado);
  const filas = tabla.filas.flatMap((fila) => {
    const medidas = fila.campos.flatMap((clave) => {
      const campo = campos.get(clave);
      return campo?.tipo === "medida" ? [campo as Medida] : [];
    });
    if (medidas.length === 0) return [];
    const unidad = medidas[0]!.unidades[0] ?? "";
    return [
      {
        etiqueta: fila.etiqueta,
        unidad,
        celdas: medidas.map((m) => {
          const valor = respuestas?.[m.clave];
          const medida = valor && typeof valor === "object" && !Array.isArray(valor) && "valor" in valor ? (valor as ValorMedida) : undefined;
          return { clave: m.clave, valorInicial: medida?.valor.replace(".", ",") ?? "" };
        }),
      },
    ];
  });
  if (filas.length === 0) return null;
  const primero = filas[0]!.celdas[0]!.clave;
  return (
    <div id={anclaDeDato(seccion, primero)} className="scroll-mt-24">
      <TablaDeMedidas
        titulo={tabla.titulo}
        columnas={tabla.columnas}
        filas={filas}
        onCambio={(clave, texto) => {
          const campo = campos.get(clave) as Medida | undefined;
          if (!campo) return false;
          if (texto.trim() === "") {
            alGuardar(clave);
            vigilar(repositorio.guardarRespuesta(id, seccion, clave, undefined, new Date()));
            return true;
          }
          const valor = crearMedida(texto, campo.unidades[0] ?? "", campo.unidades);
          if (!valor) return false;
          alGuardar(clave);
          vigilar(repositorio.guardarRespuesta(id, seccion, clave, valor, new Date()));
          return true;
        }}
      />
    </div>
  );
}
