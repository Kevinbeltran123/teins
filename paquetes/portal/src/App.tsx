import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton } from "@teins/ui";
import { consultas } from "./api";
import { useConexion } from "./conexion";
import { Ingreso } from "./pantallas/Ingreso";
import { Informes } from "./pantallas/Informes";
import { habiaSesion, marcarSesionAbierta } from "./sesion";

export function App() {
  const sesion = useQuery(consultas.sesion());
  const enLinea = useConexion();
  useEffect(() => {
    if (sesion.data) marcarSesionAbierta();
  }, [sesion.data]);

  let pantalla;
  if (sesion.isPending) pantalla = <div className="min-h-dvh bg-fondo" aria-busy="true" />;
  else if (sesion.isError && sesion.error instanceof ErrorApi && sesion.error.codigo === "no_autenticado") pantalla = <Ingreso sesionCerrada={habiaSesion()} />;
  else if (sesion.isError)
    pantalla = (
      <main className="mx-auto max-w-md px-4 py-8">
        <Aviso tono="error">
          <p>No se pudo conectar con el portal.</p>
          <Boton className="mt-3" onClick={() => void sesion.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      </main>
    );
  else pantalla = <Informes cliente={sesion.data.cliente} />;

  return (
    <>
      {!enLinea && (
        <div className="mx-auto max-w-xl px-4 pt-3">
          <Aviso tono="alerta">Sin conexión. Conéctese a internet para ver y descargar sus informes.</Aviso>
        </div>
      )}
      {pantalla}
    </>
  );
}
