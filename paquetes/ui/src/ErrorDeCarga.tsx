import { Aviso } from "./Aviso";
import { Boton } from "./Boton";
import { RefreshCw } from "./iconos";

/**
 * Lo que no se pudo cargar, en el lugar donde iba (DESIGN.md, estados obligatorios), con «Reintentar». Sin `reintentar`
 * (lo que no existe), solo se dice: volver a pedirlo no lo cambia.
 */
export function ErrorDeCarga({ texto, reintentar }: { texto: string; reintentar?: (() => void) | undefined }) {
  return (
    <Aviso tono="error">
      <b>{texto}</b>
      {reintentar && (
        <div>
          <Boton tamano="pequeno" icono={RefreshCw} onClick={reintentar}>
            Reintentar
          </Boton>
        </div>
      )}
    </Aviso>
  );
}
