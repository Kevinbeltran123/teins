import { Dialogo, etiquetaEnter, plataforma } from "@teins/ui";

/*
  La lista de atajos (iteración 37, prototipos/usabilidad-oficina): se abre con «?» o desde el menú. En Mac con ⌘ y en
  Windows con Ctrl; las letras solas son iguales en los dos.
*/

const Teclas = ({ teclas }: { teclas: string[] }) => (
  <span className="teclas-a">
    {teclas.map((t) => (
      <kbd key={t} className="tecla-a">
        {t}
      </kbd>
    ))}
  </span>
);

function Fila({ que, teclas }: { que: string; teclas: string[] }) {
  return (
    <div className="fila-a">
      <span>{que}</span>
      <Teclas teclas={teclas} />
    </div>
  );
}

export function HojaDeAtajos({ alCerrar }: { alCerrar: () => void }) {
  const mod = plataforma() === "mac" ? "⌘" : "Ctrl";
  return (
    <Dialogo forma="formulario" ancho="ancho" titulo="Atajos del teclado" subtitulo="Las letras solas no hacen nada mientras escribe en un campo." alCerrar={alCerrar}>
      <div className="atajos-a">
        <section aria-label="En toda oficina">
          <h3>En toda oficina</h3>
          <Fila que="Buscar e ir" teclas={[mod, "K"]} />
          <Fila que="Plegar el menú" teclas={[mod, "B"]} />
          <Fila que="Esta lista" teclas={["?"]} />
          <Fila que="Cerrar o volver" teclas={["Esc"]} />
        </section>
        <section aria-label="Bandeja y revisión">
          <h3>Bandeja</h3>
          <Fila que="Bajar y subir" teclas={["J", "K"]} />
          <Fila que="Abrir" teclas={[etiquetaEnter()]} />
          <Fila que="Buscar en la lista" teclas={["/"]} />
          <h3>Revisión</h3>
          <Fila que="Tomar para revisar" teclas={["T"]} />
          <Fila que="Marcar revisado" teclas={["R"]} />
          <Fila que="Siguiente" teclas={["S"]} />
        </section>
      </div>
    </Dialogo>
  );
}
