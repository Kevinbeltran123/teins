import { Fragment, useContext, useState } from "react";
import { crearMedida, esNoObtenido, type CodigoErrorValidacion, type DefinicionCampo, type Valor, type ValorMedida } from "@teins/dominio";
import { CampoMedida, CampoTexto, MarcaNoObtenido, useNotificar } from "@teins/ui";
import { repositorio } from "../../datos/instancia";
import { mensajeDeValidacion } from "../../mensajes";
import { CampoBoceto } from "./Boceto";
import { CampoCantidades } from "./CampoCantidades";
import { CampoFirma } from "./Firma";
import { Fotos } from "./Fotos";
import { anclaDeDato, VigilarGuardado } from "./contexto";

interface PropsCampo {
  id: string;
  seccion: string;
  campo: DefinicionCampo;
  inicial: Valor | undefined;
  actual: Valor | undefined;
  error: CodigoErrorValidacion | undefined;
  alGuardar: () => void;
}

export function Campo(props: PropsCampo) {
  // El ancla deja que el resumen de errores lleve hasta este dato.
  return (
    <div id={anclaDeDato(props.seccion, props.campo.clave)} className="scroll-mt-24">
      <ContenidoDeCampo {...props} />
    </div>
  );
}

function ContenidoDeCampo({ id, seccion, campo, inicial: alAbrir, actual, error, alGuardar }: PropsCampo) {
  const notificar = useNotificar();
  const vigilar = useContext(VigilarGuardado);
  const guardar = (valor: Valor | undefined) => {
    alGuardar();
    vigilar(repositorio.guardarRespuesta(id, seccion, campo.clave, valor, new Date()));
  };
  // Los controles escriben sobre lo que muestran; cuando la marca (o su "Deshacer") reemplaza el dato, se vuelven
  // a montar con lo guardado, para que nunca muestren un valor que ya no está.
  const [desde, setDesde] = useState({ vez: 0, valor: alAbrir });
  const inicial = desde.valor;
  const reemplazar = (valor: Valor | undefined) => {
    guardar(valor);
    setDesde((d) => ({ vez: d.vez + 1, valor }));
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
            largo={campo.largo}
            valoresComunes={campo.valoresComunes}
            onCambio={(texto) => guardar(texto === "" ? undefined : texto)}
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
            valoresComunes={campo.valoresComunes}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                guardar(undefined);
                return true;
              }
              const valor = crearMedida(texto, unidad, campo.unidades);
              if (valor) guardar(valor);
              return valor !== null;
            }}
          />
        );
      }
      case "foto":
        return <Fotos id={id} seccion={seccion} campo={campo} ids={noObtenido ? [] : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
      case "cantidades":
        return (
          <CampoCantidades
            campo={campo}
            unidades={campo.unidades}
            // De `desde`, no de lo guardado: al deshacer «No se pudo obtener», lo guardado todavía trae la marca en ese
            // instante y el editor se montaría vacío; el siguiente cambio borraría lo devuelto (iteración 42).
            inicial={inicial}
            error={noObtenido ? undefined : errorDelCampo}
            guardar={(valor) => guardar(valor)}
          />
        );
      case "boceto":
        return <CampoBoceto id={id} seccion={seccion} campo={campo} actual={noObtenido ? undefined : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
      case "firma":
        return <CampoFirma id={id} seccion={seccion} campo={campo} actual={noObtenido ? undefined : actual} error={noObtenido ? undefined : errorDelCampo} alGuardar={alGuardar} />;
      default:
        return campo satisfies never;
    }
  })();

  if (!campo.obligatorio) return control;
  return (
    <div className="flex flex-col gap-2">
      <Fragment key={desde.vez}>{control}</Fragment>
      <MarcaNoObtenido
        dato={campo.etiqueta}
        marcado={noObtenido}
        motivoInicial={esNoObtenido(alAbrir) ? alAbrir.motivo : ""}
        error={errorDeMotivo}
        // Marcar reemplaza el dato, y lo capturado vuelve con "Deshacer"; desmarcar lo deja vacío para capturarlo (regla 3).
        onMarcar={(marcado, motivo) => {
          if (!marcado) return reemplazar(undefined);
          const anterior = noObtenido || (Array.isArray(actual) && actual.length === 0) ? undefined : actual;
          reemplazar({ noObtenido: true, motivo });
          if (anterior !== undefined) notificar({ texto: `Marcado como no obtenido: ${campo.etiqueta}`, accion: { texto: "Deshacer", alHacer: () => reemplazar(anterior) } });
        }}
        onMotivo={(motivo) => guardar({ noObtenido: true, motivo })}
      />
    </div>
  );
}
