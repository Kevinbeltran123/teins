import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton, LoaderCircle } from "@teins/ui";
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

  // Dentro de cada pantalla, bajo su marca: explica por qué no carga lo que falta.
  const sinConexion = !enLinea && <Aviso tono="alerta">Sin conexión. Conéctese a internet para ver y descargar sus informes.</Aviso>;

  if (sesion.isPending) {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-fondo">
        <p className="flex items-center gap-2 text-cuerpo text-texto-secundario">
          <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />
          Cargando
        </p>
      </main>
    );
  }
  if (sesion.isError && sesion.error instanceof ErrorApi && sesion.error.codigo === "no_autenticado") return <Ingreso sesionCerrada={habiaSesion()} aviso={sinConexion} />;
  if (sesion.isError) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        {sinConexion}
        <Aviso tono="error">
          <p>No se pudo conectar con el portal.</p>
          <Boton className="mt-3" onClick={() => void sesion.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      </main>
    );
  }
  return <Informes cliente={sesion.data.cliente} aviso={sinConexion} />;
}
