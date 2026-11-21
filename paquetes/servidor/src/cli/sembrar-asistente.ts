import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { fechaEnColombia, type LineaCantidad } from "@teins/dominio";
import { enOrganizacion, type BaseDeDatos } from "../plataforma/base-de-datos";
import { registrarCambios } from "../modulos/cambios";
import { itemsCatalogo, preciosCatalogo } from "../modulos/catalogo/esquema";
import { clientesYSitios } from "../modulos/clientes";
import { lineasCantidad, levantamientos } from "../modulos/levantamientos/esquema";
import { crearVisitas } from "../modulos/visitas";

/**
 * Datos ficticios para probar el asistente (iteración 53), iguales a los del prototipo: cinco cableados revisados en
 * Ibagué, Espinal y Melgar, uno sin revisar y visitas de UPS por mes. Las fechas cuentan hacia atrás desde hoy, para que
 * «el último año» siempre las encuentre. Si el catálogo ya tiene el UTP de ejemplo, no hace nada.
 */
export async function sembrarDatosDelAsistente(bd: BaseDeDatos, organizacionId: string, personas: { tecnicoId: string; revisorId: string }): Promise<boolean> {
  return enOrganizacion(bd, organizacionId, async (tx) => {
    const [existe] = await tx.select({ id: itemsCatalogo.id }).from(itemsCatalogo).where(and(eq(itemsCatalogo.organizacionId, organizacionId), eq(itemsCatalogo.codigo, "CAB-UTP6")));
    if (existe) return false;

    const hoy = fechaEnColombia();
    const haceDias = (dias: number) => {
      const fecha = new Date(`${hoy}T12:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() - dias);
      return fecha.toISOString().slice(0, 10);
    };
    const contexto = { organizacionId, autorId: "administrador", correlacion: `sembrar:${randomUUID()}` };
    const visitas = crearVisitas(clientesYSitios);

    const items = {
      utp: { codigo: "CAB-UTP6", descripcion: "Cable UTP categoría 6", unidad: "m", precio: 2900 },
      punto: { codigo: "PTO-RED", descripcion: "Punto de red", unidad: "und", precio: null },
      fibra: { codigo: "CAB-FO12", descripcion: "Cable de fibra óptica 12 hilos", unidad: "m", precio: null },
      encauchetado: { codigo: "CAB-ENC312", descripcion: "Cable encauchetado 3x12 AWG", unidad: "m", precio: null },
    };
    const ids = Object.fromEntries(Object.keys(items).map((k) => [k, randomUUID()])) as Record<keyof typeof items, string>;
    for (const [clave, i] of Object.entries(items) as [keyof typeof items, (typeof items)[keyof typeof items]][]) {
      await tx.insert(itemsCatalogo).values({ id: ids[clave], organizacionId, codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad });
      if (i.precio !== null) await tx.insert(preciosCatalogo).values({ id: randomUUID(), organizacionId, itemId: ids[clave], valor: i.precio, desde: new Date(`${haceDias(80)}T12:00:00Z`), por: "administrador", origen: "manual" });
    }
    // El catálogo baja a los teléfonos (ADR-0025).
    await registrarCambios(tx, Object.values(ids).map((entidadId) => ({ organizacionId, entidad: "item_catalogo" as const, entidadId, operacion: "cambio" as const })));

    const sitio = (nombre: string, sitioNombre: string, ciudad: string) => clientesYSitios.crear(tx, { organizacionId, nombre, sitio: { nombre: sitioNombre, direccion: "Calle [N] # [N]-[N]", ciudad } });
    const hotel = await sitio("Hotel Mirador del Combeima", "Edificio principal", "Ibagué");
    const cableados = [
      { sitio: await sitio("Clínica Santa Lucía del Tolima", "Sede principal", "Ibagué"), dias: 279, utp: "1020", puntos: "36", fibra: "180", encauchetado: "35" },
      { sitio: hotel, dias: 256, utp: "610", puntos: "24" },
      { sitio: await sitio("Colegio Bilingüe Los Ocobos", "Sede campestre", "Ibagué"), dias: 212, utp: "1390", puntos: "48", fibra: "130", encauchetado: "50" },
      { sitio: await sitio("Distribuidora La Pola", "Bodega", "Espinal"), dias: 155, utp: "560", puntos: "18", sinVincular: "45" },
      { sitio: await sitio("Centro Médico Los Lagos", "Sede Melgar", "Melgar"), dias: 107, utp: "905", puntos: "30" },
    ];

    const levantar = async (visitaId: string, programada: string, revisado: boolean, lineas: Omit<LineaCantidad, "id">[]) => {
      // Directo en la tabla, sin los eventos de auditoría de un envío y una revisión: son solo datos de desarrollo.
      const id = randomUUID();
      const recibido = new Date(`${programada}T22:00:00Z`);
      const revisadoEn = new Date(recibido.getTime() + 24 * 3600_000);
      const materiales = lineas.map((l, i) => ({ id: `ejem${String(i).padStart(4, "0")}`, ...l }));
      await tx.insert(levantamientos).values({
        id,
        organizacionId,
        tecnicoId: personas.tecnicoId,
        formato: "prueba-ups",
        versionFormato: 10,
        visitaId,
        // Sin revisar, pero tomado por oficina: así no entra en la bandeja que recorren las pruebas de extremo a extremo.
        estado: revisado ? "revisado" : "en_revision",
        respuestas: {
          servicio: { horario: { desde: "08:00", hasta: "12:30" }, sistema_revisado: { elegidas: ["Red de datos"] }, solucionado: "Totalmente", se_emplearon: "Sí" },
          cuarto_tecnico: { descripcion: "Cableado estructurado con canaleta por el cielo raso. Datos de ejemplo." },
          materiales: { materiales },
        },
        revisorId: personas.revisorId,
        tomadoEn: revisadoEn,
        revisadoEn: revisado ? revisadoEn : null,
        creadoEnDispositivo: recibido,
        enviadoEnDispositivo: recibido,
        recibidoEn: recibido,
      });
      for (const [orden, l] of materiales.entries()) {
        await tx.insert(lineasCantidad).values({
          organizacionId,
          levantamientoId: id,
          seccion: "materiales",
          campo: "materiales",
          linea: l.id,
          orden,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          unidad: l.unidad,
          itemCatalogoId: l.item ?? null,
          ...(l.item ? { vinculadaPor: "tecnico", vinculadaEn: recibido } : {}),
        });
      }
    };

    const programar = (s: { clienteId: string; sitioId: string }, programadaPara: string, formato: string | null, motivo: string) =>
      visitas.crear(tx, { ...contexto, clienteId: s.clienteId, sitioId: s.sitioId, motivo, formato, programadaPara, tecnicos: [] });

    for (const c of cableados) {
      const programada = haceDias(c.dias);
      const visitaId = await programar(c.sitio, programada, null, "Cableado estructurado");
      await levantar(visitaId, programada, true, [
        { descripcion: "Cable UTP cat 6", cantidad: c.utp, unidad: "m", item: ids.utp },
        { descripcion: "Punto de red", cantidad: c.puntos, unidad: "und", item: ids.punto },
        ...(c.fibra ? [{ descripcion: "Fibra óptica 12 hilos", cantidad: c.fibra, unidad: "m", item: ids.fibra }] : []),
        ...(c.encauchetado ? [{ descripcion: "Encauchetado 3x12", cantidad: c.encauchetado, unidad: "m", item: ids.encauchetado }] : []),
        ...(c.sinVincular ? [{ descripcion: "cable utp cat6 azul", cantidad: c.sinVincular, unidad: "m" }] : []),
      ]);
    }
    const sexta = haceDias(18);
    await levantar(await programar(hotel, sexta, null, "Cableado estructurado"), sexta, false, [
      { descripcion: "Cable UTP cat 6", cantidad: "820", unidad: "m", item: ids.utp },
      { descripcion: "Punto de red", cantidad: "28", unidad: "und", item: ids.punto },
    ]);

    // Visitas de UPS, sin levantamientos, en los últimos 11 meses (el actual incluido), hasta hoy.
    const ups = [await sitio("Edificio Torre Central", "Cuarto técnico", "Bogotá"), await sitio("Supermercado El Ahorro", "Sede norte", "Neiva")];
    const [anio, mes, diaDeHoy] = hoy.split("-").map(Number) as [number, number, number];
    const porMes = [2, 3, 2, 4, 3, 5, 6, 4, 3, 5, 4];
    let n = 0;
    for (const [i, cuantas] of porMes.entries()) {
      const fecha = new Date(Date.UTC(anio, mes - 1 - (porMes.length - 1 - i), 1));
      const actual = i === porMes.length - 1;
      for (let k = 0; k < cuantas; k++) {
        const dia = actual ? Math.max(1, Math.min(diaDeHoy, 2 + k * 4)) : 2 + k * 4;
        await programar(ups[n++ % ups.length]!, `${fecha.toISOString().slice(0, 7)}-${String(dia).padStart(2, "0")}`, "prueba-ups", "Mantenimiento de UPS");
      }
    }
    return true;
  });
}
