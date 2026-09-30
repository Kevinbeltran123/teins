import { useEffect, useState, type ReactNode } from "react";
import { Aviso, Boton, Download, Ellipsis, Share, SquarePlus, type LucideIcon } from "@teins/ui";
import { alCambiarInstalacion, instalar, omitirInstalacion, plataforma, puedeInstalarConBoton } from "../dispositivo/instalacion";

/** El ícono tal como la persona lo busca en su pantalla: el mismo botón que ve en el navegador. */
function Tecla({ icono: Icono, nombre }: { icono: LucideIcon; nombre: string }) {
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-panel-hundido text-texto [&_svg]:size-5">
      <Icono role="img" aria-label={nombre} />
    </span>
  );
}

function Paso({ numero, titulo, ayuda }: { numero: number; titulo: ReactNode; ayuda: ReactNode }) {
  return (
    <li className="flex gap-3.5 border-b border-division px-4.5 py-4 last:border-b-0">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-acento text-cuerpo font-extrabold text-sobre-acento">
        {numero}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2.5 text-cuerpo font-bold">{titulo}</span>
        <span className="flex items-center gap-2.5 text-ayuda text-texto-secundario">{ayuda}</span>
      </div>
    </li>
  );
}

const Abrir = (
  <Paso
    numero={3}
    titulo="Abre TEINS desde tu pantalla de inicio"
    ayuda={
      <>
        <img src="/icono-192.png" alt="" className="size-10 shrink-0 rounded-[10px]" />
        Ahí inicias sesión.
      </>
    }
  />
);

/**
 * Los pasos para instalar según el teléfono. En Android con Chrome basta el botón (el navegador pregunta);
 * en los demás, los pasos del menú.
 */
export function GuiaDeInstalacion() {
  const [conBoton, setConBoton] = useState(puedeInstalarConBoton);
  const [instalada, setInstalada] = useState(false);
  useEffect(() => alCambiarInstalacion(() => setConBoton(puedeInstalarConBoton())), []);

  if (plataforma() === "iphone") {
    return (
      <ol aria-label="Pasos para instalar" className="flex flex-col rounded-panel bg-panel">
        <Paso
          numero={1}
          titulo={
            <>
              Toca Compartir <Tecla icono={Share} nombre="ícono de Compartir" />
            </>
          }
          ayuda={
            <span>
              Está en la barra de Safari, abajo. Si no lo ves, toca primero <Ellipsis role="img" aria-label="Más" className="inline size-5 align-middle text-texto" />.
            </span>
          }
        />
        <Paso
          numero={2}
          titulo={
            <>
              Elige “Agregar a inicio” <Tecla icono={SquarePlus} nombre="ícono de Agregar" />
            </>
          }
          ayuda="Si no aparece, baja en la lista."
        />
        {Abrir}
      </ol>
    );
  }

  if (instalada) return <Aviso tono="exito">Listo. Abre TEINS desde su ícono en la pantalla de inicio.</Aviso>;
  if (conBoton) {
    return (
      <div className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-4">
        <Boton variante="principal" icono={Download} onClick={() => void instalar().then(setInstalada)}>
          Instalar la app
        </Boton>
        <p className="text-ayuda text-texto-secundario">El teléfono te pide confirmar. Después abre TEINS desde su ícono.</p>
      </div>
    );
  }
  return (
    <ol aria-label="Pasos para instalar" className="flex flex-col rounded-panel bg-panel">
      <Paso numero={1} titulo="Abre el menú del navegador" ayuda="Los tres puntos, arriba o abajo de la pantalla." />
      <Paso numero={2} titulo="Elige “Instalar app” o “Agregar a pantalla principal”" ayuda="El nombre cambia según el navegador." />
      {Abrir}
    </ol>
  );
}

/**
 * Antes de iniciar sesión, en un teléfono sin la app instalada (ADR-0023, parte 3). "Seguir en Safari"
 * existe para tabletas y pruebas; el inicio sigue recordando instalarla.
 */
export default function InstalarApp({ alSeguir }: { alSeguir: () => void }) {
  const enIphone = plataforma() === "iphone";
  return (
    <main className="flex min-h-dvh flex-col bg-fondo px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md grow flex-col gap-5">
        <div className="flex items-center gap-3 pt-4">
          <span aria-hidden className="h-10 w-1.5 rounded-full bg-acento" />
          <span className="text-titulo leading-none font-extrabold tracking-[0.08em]">TEINS</span>
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <h1 className="text-[40px] leading-[1.05] font-extrabold tracking-tight">Instala la app</h1>
          <p className="text-cuerpo text-texto-secundario">Instalada, el teléfono no borra lo que capturas sin señal y te avisa de visitas nuevas.</p>
        </div>
        {/* Solo en iPhone: Android comparte los datos entre el navegador y la app instalada. */}
        {enIphone && (
          <Aviso tono="alerta">
            Hazlo antes de iniciar sesión: lo que captures aquí en Safari no pasa a la app instalada.
          </Aviso>
        )}
        <GuiaDeInstalacion />
        <Boton
          variante="fantasma"
          className="mt-auto self-center"
          onClick={() => {
            omitirInstalacion();
            alSeguir();
          }}
        >
          {enIphone ? "Seguir en Safari" : "Seguir en el navegador"}
        </Boton>
      </div>
    </main>
  );
}
