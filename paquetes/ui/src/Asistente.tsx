/*
  El asistente de oficina (iteración 53, prototipos/analisis, versión 5). Todo el movimiento está en oficina.css (regla 10):
  aquí solo se eligen las clases.
*/

/** El destello de cuatro puntas: la forma como máscara sobre el degradado de la marca. */
export function Destello({ latiendo, className }: { latiendo?: boolean; className?: string }) {
  const clases = ["destello", latiendo && "latiendo", className].filter(Boolean).join(" ");
  return <span aria-hidden="true" className={clases} />;
}

/** Chico: avatar de cada respuesta. Grande: el saludo del panel vacío. */
export function OrbeAsistente({ tamano, pensando }: { tamano: "chico" | "grande"; pensando?: boolean }) {
  const clases = ["orbe-ia", tamano === "grande" && "grande", pensando && "pensando"].filter(Boolean).join(" ");
  return (
    <span aria-hidden="true" className={clases}>
      <Destello />
    </span>
  );
}

type PropsBoton = {
  nombre: string;
  abierto: boolean;
  /** Respondiendo con el panel cerrado: el borde gira sin pausa y el destello late. */
  pensando: boolean;
  /** Hay una respuesta que la persona no ha visto: el punto, como los avisos sin leer. */
  listo: boolean;
  onClick: () => void;
  id?: string;
  controla?: string;
};

export function BotonAsistente({ nombre, abierto, pensando, listo, onClick, id, controla }: PropsBoton) {
  const etiqueta = pensando ? `${nombre}: respondiendo` : listo ? `${nombre}: hay una respuesta lista` : nombre;
  return (
    <button
      type="button"
      id={id}
      className={pensando ? "ia pensando" : "ia"}
      aria-label={etiqueta}
      title="Preguntar sobre sus datos"
      // Abre y cierra un panel que no es modal: el patrón es el de mostrar y ocultar (aria-expanded), no el de un interruptor.
      aria-expanded={abierto}
      aria-controls={controla}
      onClick={onClick}
    >
      <Destello />
      <span aria-hidden="true">{nombre}</span>
      {listo && !pensando && <span className="punto" aria-hidden="true" />}
    </button>
  );
}
