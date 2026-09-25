import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { abrirBase, repositorioDexie } from "../datos/dexie";
import type { BaseCampo } from "../datos/base";
import { almacenDexie } from "./almacen";
import { crearMotor, espera, ESPERA_MAXIMA_MS, INTERVALO_BAJADA_MS } from "./motor";
import { servidorFalso, type Falla } from "./pruebas/servidor-falso";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }, { clave: "fotos", etiqueta: "F", tipo: "foto" }] }],
};

const bases: BaseCampo[] = [];
afterEach(async () => {
  for (const db of bases.splice(0)) await db.delete();
});

let secuencia = 0;
function foto(): { id: string; datos: ArrayBuffer } {
  const datos = new TextEncoder().encode(`foto de prueba ${secuencia++} ${Math.random()}`);
  return { id: createHash("sha256").update(datos).digest("hex"), datos: datos.buffer };
}

/** Un dispositivo con N levantamientos enviados, cada uno con sus fotos. */
async function dispositivo(cantidad = 1, fotosPorLevantamiento = 2, tecnicoId = "t1") {
  const db = abrirBase(`motor-${Math.random()}`);
  bases.push(db);
  const repo = repositorioDexie(db);
  const ids: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const id = `0192f0e0-0000-7000-8000-${String(secuencia++).padStart(12, "0")}`;
    ids.push(id);
    await repo.crear(crearLevantamiento(formato, id, new Date("2026-09-24T10:00:00Z")), tecnicoId);
    for (let j = 0; j < fotosPorLevantamiento; j++) {
      const f = foto();
      await repo.agregarFoto(id, "s", "fotos", { ...f, tipo: "image/jpeg", creadoEn: "2026-09-24T10:00:00Z" }, new Date("2026-09-24T10:01:00Z"));
    }
    expect((await repo.enviar(id, formato, new Date("2026-09-24T11:00:00Z"))).ok).toBe(true);
  }
  let ahora = Date.parse("2026-09-24T11:00:00Z");
  const reloj = {
    ahora: () => ahora,
    avanzar: (ms: number) => {
      ahora += ms;
    },
  };
  return { db, ids, reloj };
}

const estados = async (db: BaseCampo) => (await db.envios.toArray()).map((e) => e.estado);

describe("motor de sincronización", () => {
  it("sube las fotos, envía y deja el envío recibido", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

    expect(await motor.sincronizar()).toBe("completa");
    expect(await estados(db)).toEqual(["recibido"]);
    expect(s.almacenamiento.size).toBe(2);
    expect((await db.archivos.toArray()).every((a) => a.subida === "subida")).toBe(true);
  });

  it("registra si el servidor es alcanzable según el resultado real de cada intento", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    s.programar("autorizarSubida", "red_antes");
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });
    await motor.sincronizar();
    expect((await db.ajustes.get("red"))?.valor).toMatchObject({ alcanzable: false });
    await motor.sincronizar();
    expect((await db.ajustes.get("red"))?.valor).toMatchObject({ alcanzable: true });
  });

  it("si la red se corta a mitad de una subida, retoma sin volver a subir lo confirmado", async () => {
    const { db, reloj } = await dispositivo(1, 3);
    const s = servidorFalso();
    s.programar("subir", "red_antes");
    s.programar("subir"); // la primera falla; las demás pasan
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

    expect(await motor.sincronizar()).toBe("sin_conexion");
    expect(await estados(db)).toEqual(["pendiente"]);
    const subidasAntes = s.llamadas.filter((l) => l === "subir").length;

    expect(await motor.sincronizar()).toBe("completa");
    // Solo se suben las fotos que faltaban (QA-2).
    expect(s.llamadas.filter((l) => l === "subir").length - subidasAntes).toBe(3);
    expect(await estados(db)).toEqual(["recibido"]);
  });

  it("si la respuesta se pierde después de que el servidor confirmó, el reintento no duplica", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    s.programar("enviarComando", "red_despues");
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: () => 0 });

    expect(await motor.sincronizar()).toBe("sin_conexion");
    expect(await estados(db)).toEqual(["pendiente"]);
    reloj.avanzar(ESPERA_MAXIMA_MS);
    expect(await motor.sincronizar()).toBe("completa");

    expect(await estados(db)).toEqual(["recibido"]);
    expect(s.recibidos.size).toBe(1);
    expect([...s.recibidos.values()][0]!.veces).toBe(2);
  });

  it("respeta la espera: no reintenta antes de tiempo y la espera crece", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    s.programar("enviarComando", "error_500", "error_500");
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: () => 1 });

    await motor.sincronizar();
    const primera = (await db.envios.toArray())[0]!;
    expect(primera.proximoIntentoEn - reloj.ahora()).toBe(espera(1, () => 1));

    await motor.sincronizar();
    expect(s.llamadas.filter((l) => l === "enviarComando")).toHaveLength(1);

    reloj.avanzar(espera(1, () => 1));
    await motor.sincronizar();
    const segunda = (await db.envios.toArray())[0]!;
    expect(segunda.intentos).toBe(2);
    expect(segunda.proximoIntentoEn - reloj.ahora()).toBe(espera(2, () => 1));
  });

  it("vuelve a subir los archivos que el servidor no encuentra y reintenta en la misma sincronización", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });
    // Las fotos suben, pero el almacenamiento pierde una antes del envío.
    s.programar("enviarComando", "red_antes");
    await motor.sincronizar();
    const [perdida] = await db.archivos.toArray();
    s.perderArchivo(perdida!.id);
    reloj.avanzar(ESPERA_MAXIMA_MS);

    expect(await motor.sincronizar()).toBe("completa");
    expect(await estados(db)).toEqual(["recibido"]);
    expect(s.almacenamiento.has(perdida!.id)).toBe(true);
  });

  it("espera la verificación de archivos el tiempo que indica el servidor y avisa cuándo despertar", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso({ verificacionesPendientes: 1 });
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

    await motor.sincronizar();
    expect(await motor.proximoIntento()).toBe(reloj.ahora() + 5000);
    const envio = (await db.envios.toArray())[0]!;
    expect(envio).toMatchObject({ estado: "pendiente", ultimoError: { codigo: "archivos_en_verificacion" } });
    expect(envio.proximoIntentoEn - reloj.ahora()).toBe(5000);
    reloj.avanzar(5000);
    await motor.sincronizar();
    expect(await estados(db)).toEqual(["recibido"]);
    expect(await motor.proximoIntento()).toBeNull();
  });

  it("con la sesión vencida espera a que el técnico vuelva a iniciar sesión, sin perder nada", async () => {
    const { db, reloj } = await dispositivo();
    const s = servidorFalso();
    s.programar("enviarComando", "sesion_vencida");
    const almacen = almacenDexie(db);
    const motor = crearMotor({ versionApp: 2, almacen, transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

    await motor.sincronizar();
    expect(await estados(db)).toEqual(["requiere_sesion"]);
    await motor.sincronizar();
    expect(s.llamadas.filter((l) => l === "enviarComando")).toHaveLength(1);

    await almacen.reanudar("requiere_sesion");
    await motor.sincronizar();
    expect(await estados(db)).toEqual(["recibido"]);
  });

  it("un envío que quedó 'enviando' porque la app se cerró en medio se retoma", async () => {
    const { db, reloj } = await dispositivo();
    await db.envios.toCollection().modify({ estado: "enviando" });
    const s = servidorFalso();
    await crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora }).sincronizar();
    expect(await estados(db)).toEqual(["recibido"]);
  });

  it("con la sesión de otro técnico no envía ni sube lo del primero; sin sesión no hace nada", async () => {
    const { db, reloj } = await dispositivo(1, 2, "t1");
    const s = servidorFalso();
    const conOtro = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t2", reloj: reloj.ahora });
    await conOtro.sincronizar();
    // El otro técnico solo baja lo suyo.
    expect(s.llamadas).toEqual(["informarDispositivo", "obtenerCambios"]);
    const sinSesion = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => null, reloj: reloj.ahora });
    await sinSesion.sincronizar();
    expect(s.llamadas).toHaveLength(2);
    expect(await estados(db)).toEqual(["pendiente"]);
  });

  it("dos sincronizaciones pedidas a la vez no envían en paralelo", async () => {
    const { db, reloj } = await dispositivo(3);
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });
    await Promise.all([motor.sincronizar(), motor.sincronizar(), motor.sincronizar()]);
    expect(await estados(db)).toEqual(["recibido", "recibido", "recibido"]);
    expect([...s.recibidos.values()].every((r) => r.veces === 1)).toBe(true);
  });

  it("propiedad: con cualquier combinación de fallas, al volver la señal cada levantamiento llega exactamente una vez", async () => {
    const falla = fc.constantFrom<Falla>("red_antes", "red_despues", "error_500", "ninguna");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.tuple(fc.constantFrom("autorizarSubida", "subir", "confirmarSubida", "enviarComando" as const), falla), { maxLength: 12 }),
        async (cantidad, programa) => {
          const { db, ids, reloj } = await dispositivo(cantidad, 2);
          const s = servidorFalso({ verificacionesPendientes: 1 });
          for (const [op, f] of programa) s.programar(op, f);
          const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: Math.random });

          // Mientras haya fallas programadas, la señal va y viene; después, el tiempo avanza hasta que todo llega.
          for (let i = 0; i < 40 && (await estados(db)).some((e) => e !== "recibido"); i++) {
            await motor.sincronizar();
            reloj.avanzar(ESPERA_MAXIMA_MS);
          }

          expect(await estados(db)).toEqual(ids.map(() => "recibido"));
          expect(s.recibidos.size).toBe(cantidad);
          for (const id of ids) expect(s.recibidos.has(`enviar:${id}`)).toBe(true);
          // Cada foto está en el almacenamiento y ninguna se perdió localmente.
          const locales = await db.archivos.toArray();
          expect(locales.every((a) => s.almacenamiento.has(a.id))).toBe(true);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("bajada (ADR-0003)", () => {
  const visita = (id: string) => ({
    id,
    cliente: { nombre: "Cliente ficticio" },
    sitio: { nombre: "Sede", direccion: "Calle [N]" },
    motivo: "Mantenimiento",
    programadaPara: "2026-09-30",
  });
  const idVisita = (n: number) => `0192f0e0-0000-7000-8000-${String(900 + n).padStart(12, "0")}`;
  const motorDe = (db: BaseCampo, s: ReturnType<typeof servidorFalso>, reloj: { ahora: () => number }, versionApp = 2, usuario = "t1") =>
    crearMotor({ versionApp, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => usuario, reloj: reloj.ahora });

  it("aplica formatos, visitas y el estado de lo enviado, y avanza el punto de control por páginas", async () => {
    const { db, ids, reloj } = await dispositivo();
    const s = servidorFalso();
    s.paginasDe(1);
    s.publicar({ tipo: "formato", definicion: { ...formato, version: 2, nombre: "Formato de prueba" } }, { tipo: "visita", visita: visita(idVisita(1)) });
    await motorDe(db, s, reloj).sincronizar();

    expect(await db.formatos.toArray()).toEqual([{ ...formato, version: 2, nombre: "Formato de prueba" }]);
    expect(await db.visitas.toArray()).toEqual([{ ...visita(idVisita(1)), tecnicoId: "t1" }]);
    // El envío de esta misma sincronización baja con su estado según el servidor.
    expect((await db.estadosServidor.toArray()).map((e) => [e.id, e.estado])).toEqual([[ids[0], "enviado"]]);
    expect(await db.bajadas.get("t1")).toMatchObject({ puntoDeControl: 3, versionApp: 2, permisoLocalHasta: "2026-10-01T00:00:00.000Z" });
  });

  it("guarda el estado de revisión y los comentarios de oficina de un levantamiento propio (corte 3)", async () => {
    const { db, ids, reloj } = await dispositivo();
    const s = servidorFalso();
    await motorDe(db, s, reloj, 3).sincronizar();
    const comentario = { id: "0192f0e0-0000-7000-8000-000000000555", texto: "Revisa la placa", seccion: "s", campo: "t", autor: "Oficina", creadoEn: "2026-09-25T10:00:00.000Z" };
    s.publicar({ tipo: "levantamiento", id: ids[0]!, estado: "revisado", recibidoEn: "2026-09-24T00:00:00.000Z", comentarios: [comentario] });
    await motorDe(db, s, reloj, 3).sincronizar({ bajar: true });
    expect(await db.estadosServidor.get(ids[0]!)).toMatchObject({ estado: "revisado", comentarios: [comentario] });
  });

  it("baja al pedirla o cada 5 minutos, no en cada ciclo de 30 segundos", async () => {
    const { db, reloj } = await dispositivo(0);
    const s = servidorFalso();
    const motor = motorDe(db, s, reloj);
    const bajadas = () => s.llamadas.filter((l) => l === "obtenerCambios").length;
    await motor.sincronizar();
    expect(bajadas()).toBe(1);
    reloj.avanzar(30_000);
    await motor.sincronizar();
    expect(bajadas()).toBe(1);
    await motor.sincronizar({ bajar: true });
    expect(bajadas()).toBe(2);
    reloj.avanzar(INTERVALO_BAJADA_MS);
    await motor.sincronizar();
    expect(bajadas()).toBe(3);
  });

  it("una app actualizada baja desde cero: recibe lo que su versión anterior no sabía mostrar (ADR-0015)", async () => {
    const { db, reloj } = await dispositivo(0);
    const s = servidorFalso();
    s.publicar({ tipo: "formato", definicion: formato });
    await motorDe(db, s, reloj, 2).sincronizar();
    expect((await db.bajadas.get("t1"))?.puntoDeControl).toBe(1);
    const desde: number[] = [];
    const transporte = { ...s.transporte, obtenerCambios: (d: number, app: number) => (desde.push(d), s.transporte.obtenerCambios(d, app)) };
    await crearMotor({ versionApp: 3, almacen: almacenDexie(db), transporte, usuarioActual: async () => "t1", reloj: reloj.ahora }).sincronizar();
    expect(desde).toEqual([0]);
    expect(await db.bajadas.get("t1")).toMatchObject({ versionApp: 3, puntoDeControl: 1 });
  });

  it("una visita reasignada sale del teléfono, salvo que el técnico ya haya empezado algo en ella (regla 17)", async () => {
    const db = abrirBase(`motor-${Math.random()}`);
    bases.push(db);
    const s = servidorFalso();
    const reloj = { ahora: () => Date.parse("2026-09-24T11:00:00Z") };
    s.publicar({ tipo: "visita", visita: visita(idVisita(1)) }, { tipo: "visita", visita: visita(idVisita(2)) });
    await motorDe(db, s, reloj).sincronizar();
    await repositorioDexie(db).crear(crearLevantamiento(formato, "0192f0e0-0000-7000-8000-000000000999", new Date(), idVisita(2)), "t1");

    s.publicar({ tipo: "fuera_de_alcance", entidad: "visita", id: idVisita(1) }, { tipo: "fuera_de_alcance", entidad: "visita", id: idVisita(2) });
    await motorDe(db, s, reloj).sincronizar({ bajar: true });
    expect(await db.visitas.toArray()).toEqual([{ ...visita(idVisita(2)), tecnicoId: "t1", fueraDeAlcance: true }]);
  });

  it("informa la salud del dispositivo con cada bajada, sin contenido de levantamientos (ADR-0017)", async () => {
    const { db, reloj } = await dispositivo(1, 1);
    const s = servidorFalso();
    s.programar("enviarComando", "error_500");
    await motorDe(db, s, reloj).sincronizar({ bajar: true });
    const [informe] = s.informes;
    expect(informe!.secreto).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(informe!.salud).toMatchObject({ versionApp: 2, versionEsquemaLocal: 3, pendientes: 1, pendienteMasAntiguo: "2026-09-24T11:00:00.000Z", ultimoError: "error_interno" });
    // El mismo dispositivo en cada informe.
    await motorDe(db, s, reloj).sincronizar({ bajar: true });
    expect(new Set(s.informes.map((i) => i.id)).size).toBe(1);
  });
});

describe("revocación (ADR-0009, QA-5)", () => {
  async function telefonoCompartido() {
    const { db, reloj } = await dispositivo(1, 2, "t1");
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "0192f0e0-0000-7000-8000-000000000777", new Date("2026-09-24T10:00:00Z")), "t2");
    await repo.agregarFoto("0192f0e0-0000-7000-8000-000000000777", "s", "fotos", { ...foto(), tipo: "image/jpeg", creadoEn: "2026-09-24T10:00:00Z" }, new Date());
    await db.ajustes.put({ clave: "usuario", valor: { id: "t1", nombre: "Técnico uno", rol: "tecnico" } });
    const usuario = async () => ((await db.ajustes.get("usuario"))?.valor as { id: string } | undefined)?.id ?? null;
    return { db, reloj, usuario };
  }

  it("borra solo los datos del usuario revocado, conserva los del otro y confirma el borrado", async () => {
    const { db, reloj, usuario } = await telefonoCompartido();
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: usuario, reloj: reloj.ahora });
    // El dispositivo quedó registrado en una sincronización anterior.
    await motor.sincronizar({ bajar: true });
    expect(s.informes).toHaveLength(1);

    // El siguiente contacto: abrir la app o recuperar señal piden la bajada.
    s.revocar("t1");
    await motor.sincronizar({ bajar: true });

    expect((await db.levantamientos.toArray()).map((l) => l.tecnicoId)).toEqual(["t2"]);
    expect(await db.envios.count()).toBe(0);
    expect(await db.archivos.count()).toBe(1);
    expect(await db.bajadas.get("t1")).toBeUndefined();
    expect(await db.ajustes.get("usuario")).toBeUndefined();
    expect((await db.ajustes.get("acceso_cerrado"))?.valor).toMatchObject({ nombre: "Técnico uno" });
    expect(s.confirmados).toEqual(["t1"]);
    expect(await db.ajustes.get("borrados_por_confirmar")).toBeUndefined();
  });

  it("si la confirmación no alcanza a salir, se envía en la siguiente sincronización aunque nadie tenga sesión", async () => {
    const { db, reloj, usuario } = await telefonoCompartido();
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: usuario, reloj: reloj.ahora });
    await motor.sincronizar({ bajar: true });
    s.revocar("t1");
    s.programar("consultarOrdenes", "ninguna", "red_antes");
    await motor.sincronizar({ bajar: true });
    expect(await db.levantamientos.where("tecnicoId").equals("t1").count()).toBe(0);
    expect(s.confirmados).toEqual([]);

    await motor.sincronizar();
    expect(s.confirmados).toEqual(["t1"]);
  });

  it("una sesión vencida sin orden de borrado conserva todo y pide iniciar sesión", async () => {
    const { db, reloj, usuario } = await telefonoCompartido();
    const s = servidorFalso();
    const motor = crearMotor({ versionApp: 2, almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: usuario, reloj: reloj.ahora });
    await motor.sincronizar({ bajar: true });
    s.programar("obtenerCambios", "sesion_vencida");
    s.programar("informarDispositivo", "sesion_vencida");
    await motor.sincronizar({ bajar: true });
    expect(await db.levantamientos.count()).toBe(2);
    expect(await db.bajadas.get("t1")).toMatchObject({ sesionVencida: true });
    expect(await db.ajustes.get("usuario")).toBeDefined();
  });
});
