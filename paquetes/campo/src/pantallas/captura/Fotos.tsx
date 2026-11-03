import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { DefinicionCampo } from "@teins/dominio";
import { visitaDe } from "../../datos/lecturas";
import { completarOrganizacion } from "../../sesion/sesion";
import { useUsuario } from "../../sesion/usuario";
import { db } from "../../datos/instancia";
import { Aviso, CampoFotos, useNotificar } from "@teins/ui";
import { repositorio } from "../../datos/instancia";
import type { ArchivoNuevo } from "../../datos/repositorio";
import { procesarFoto } from "../../fotos/procesar";
import { prepararSello } from "../../fotos/prepararSello";
import { textoDeUbicacion } from "../../fotos/sello";
import { useUbicacion } from "../../fotos/useUbicacion";
import { sincronizarEnSegundoPlano } from "../../sincronizacion/disparar";

/** Las primeras fotos de un paso, en el repaso; si hay más, cuántas. */
export function MiniaturasDeFotos({ huellas }: { huellas: readonly string[] }) {
  const fotos = useUrlsDeFotos(huellas.slice(0, 4));
  return (
    <span className="mt-2 flex gap-1">
      {fotos.map((f) => (
        <img key={f.id} src={f.url} alt="" className="size-10 rounded-[6px] object-cover" />
      ))}
      {huellas.length > 4 && <span className="grid size-10 place-items-center rounded-[6px] bg-panel-hundido text-ayuda font-medium text-texto-secundario">{`+${huellas.length - 4}`}</span>}
    </span>
  );
}

export function useUrlsDeFotos(ids: readonly string[]) {
  const archivos = useLiveQuery(() => repositorio.obtenerArchivos(ids), [ids.join()]);
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  useEffect(() => {
    const nuevas = (archivos ?? []).map((a) => ({ id: a.id, url: URL.createObjectURL(new Blob([a.datos], { type: a.tipo })) }));
    setFotos(nuevas);
    return () => nuevas.forEach((f) => URL.revokeObjectURL(f.url));
  }, [archivos]);
  return fotos;
}

export function Fotos({ id, seccion, campo, ids, error, alGuardar }: { id: string; seccion: string; campo: DefinicionCampo; ids: unknown; error: string | undefined; alGuardar: () => void }) {
  const huellas = Array.isArray(ids) ? (ids as string[]) : [];
  const fotos = useUrlsDeFotos(huellas);
  const notificar = useNotificar();
  const [procesando, setProcesando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  // La foto de llegada lleva su franja (ADR-0052): solo los campos con `sello`. Sin él, nada de esto se activa.
  const sello = campo.tipo === "foto" ? campo.sello : undefined;
  const usuario = useUsuario();
  const ubicacion = useUbicacion(Boolean(sello?.ubicacion));
  useEffect(() => {
    if (sello) void completarOrganizacion().catch(() => undefined);
  }, [sello]);
  const lugar = useLiveQuery(async () => {
    if (!sello || !usuario) return undefined;
    const l = await repositorio.obtener(id);
    const visita = l?.visitaId ? await visitaDe(db, usuario.id, l.visitaId) : null;
    const organizacion = await db.ajustes.get("organizacion");
    return {
      organizacion: organizacion?.clave === "organizacion" ? organizacion.valor : undefined,
      cliente: visita?.cliente.nombre ?? l?.lugar?.cliente ?? "",
      sitio: visita?.sitio.nombre ?? l?.lugar?.sitio ?? "",
      direccion: visita?.sitio.direccion,
      ciudad: visita?.sitio.ciudad ?? undefined,
    };
  }, [sello?.ubicacion, usuario?.id, id]);

  async function agregar(originales: File[]) {
    setProcesando(true);
    setFallo(null);
    // Una que falla no detiene las demás del lote, y el aviso dice cuántas faltan (iteración 42).
    let fallidas = 0;
    for (const original of originales) {
      try {
        // La hora de red y el mapa se piden con señal y como mucho 3 s: la foto nunca se bloquea por ellos.
        const datos =
          sello && lugar
            ? await prepararSello({ sello, posicion: ubicacion.vigente(), lugar: { organizacion: lugar.organizacion, cliente: lugar.cliente, sitio: lugar.sitio }, direccion: lugar.direccion, ciudad: lugar.ciudad })
            : undefined;
        const archivo = await procesarFoto(original, new Date(), datos);
        await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
        alGuardar();
      } catch (error) {
        // El técnico ve un mensaje simple; soporte necesita la causa (ADR-0017).
        console.error("No se pudo guardar la foto", error);
        fallidas++;
      }
    }
    // Las fotos suben por adelantado cuando hay señal (ADR-0003).
    if (fallidas < originales.length) sincronizarEnSegundoPlano();
    if (fallidas === 1 && originales.length === 1) setFallo("No se pudo guardar la foto. Tómala de nuevo.");
    else if (fallidas > 0) setFallo(`No se ${fallidas === 1 ? "pudo guardar 1 foto" : `pudieron guardar ${fallidas} fotos`} de ${originales.length}. Tómalas de nuevo.`);
    setProcesando(false);
  }

  /** Quitar es inmediato y se deshace desde la notificación (DESIGN.md: qué se confirma y qué se deshace). */
  async function quitar(huella: string) {
    setFallo(null);
    try {
      const [archivo] = await repositorio.obtenerArchivos([huella]);
      const posicion = huellas.indexOf(huella);
      await repositorio.quitarFoto(id, seccion, campo.clave, huella, new Date());
      if (!archivo) return;
      const { subida: _subida, ultimoErrorDeSubida: _error, ...deVuelta } = archivo;
      notificar({ texto: "Foto eliminada", accion: { texto: "Deshacer", alHacer: () => void restaurar(deVuelta, posicion) } });
    } catch (error) {
      console.error("No se pudo quitar la foto", error);
      setFallo("No se pudo quitar la foto. Intenta de nuevo.");
    }
  }

  async function restaurar(archivo: ArchivoNuevo, posicion: number) {
    try {
      await repositorio.agregarFoto(id, seccion, campo.clave, archivo, new Date());
      // Agregar la pone al final: vuelve al lugar que tenía.
      const actuales = (await repositorio.obtener(id))?.respuestas[seccion]?.[campo.clave];
      if (Array.isArray(actuales)) {
        const orden = (actuales as string[]).filter((h) => h !== archivo.id);
        orden.splice(Math.min(posicion, orden.length), 0, archivo.id);
        await repositorio.guardarRespuesta(id, seccion, campo.clave, orden, new Date());
      }
      sincronizarEnSegundoPlano();
    } catch (error) {
      // Por ejemplo, si el levantamiento ya se envió: la foto ya no puede volver.
      console.error("No se pudo deshacer", error);
      setFallo("No se pudo recuperar la foto.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CampoFotos etiqueta={campo.etiqueta} obligatorio={campo.obligatorio} error={error} fotos={fotos} procesando={procesando} onAgregar={agregar} onQuitar={(h) => void quitar(h)} puestos={campo.tipo === "foto" ? campo.puestos : undefined} estado={sello?.ubicacion ? textoDeUbicacion(ubicacion.estado, ubicacion.vigente()) : undefined} />
      {fallo && <Aviso tono="error">{fallo}</Aviso>}
    </div>
  );
}

export function FotosLeidas({ etiqueta, ids }: { etiqueta: string; ids: readonly string[] }) {
  const fotos = useUrlsDeFotos(ids);
  return <CampoFotos etiqueta={etiqueta} fotos={fotos} procesando={false} onAgregar={() => undefined} soloLectura />;
}
