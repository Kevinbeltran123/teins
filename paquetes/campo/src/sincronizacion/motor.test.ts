import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { abrirBase, repositorioDexie } from "../datos/dexie";
import type { BaseCampo } from "../datos/base";
import { almacenDexie } from "./almacen";
import { crearMotor, espera, ESPERA_MAXIMA_MS } from "./motor";
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
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

    expect(await motor.sincronizar()).toBe("completa");
    expect(await estados(db)).toEqual(["recibido"]);
    expect(s.almacenamiento.size).toBe(2);
    expect((await db.archivos.toArray()).every((a) => a.subida === "subida")).toBe(true);
  });

  it("si la red se corta a mitad de una subida, retoma sin volver a subir lo confirmado", async () => {
    const { db, reloj } = await dispositivo(1, 3);
    const s = servidorFalso();
    s.programar("subir", "red_antes");
    s.programar("subir"); // la primera falla; las demás pasan
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

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
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: () => 0 });

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
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: () => 1 });

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
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });
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
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

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
    const motor = crearMotor({ almacen, transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });

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
    await crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora }).sincronizar();
    expect(await estados(db)).toEqual(["recibido"]);
  });

  it("con la sesión de otro técnico no envía ni sube lo del primero; sin sesión no hace nada", async () => {
    const { db, reloj } = await dispositivo(1, 2, "t1");
    const s = servidorFalso();
    const conOtro = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t2", reloj: reloj.ahora });
    await conOtro.sincronizar();
    const sinSesion = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => null, reloj: reloj.ahora });
    await sinSesion.sincronizar();
    expect(s.llamadas).toEqual([]);
    expect(await estados(db)).toEqual(["pendiente"]);
  });

  it("dos sincronizaciones pedidas a la vez no envían en paralelo", async () => {
    const { db, reloj } = await dispositivo(3);
    const s = servidorFalso();
    const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora });
    await Promise.all([motor.sincronizar(), motor.sincronizar(), motor.sincronizar()]);
    expect(await estados(db)).toEqual(["recibido", "recibido", "recibido"]);
    expect([...s.recibidos.values()].every((r) => r.veces === 1)).toBe(true);
  });

  it("propiedad: con cualquier combinación de fallas, al volver la señal cada levantamiento llega exactamente una vez", async () => {
    const falla = fc.constantFrom<Falla | "ninguna">("red_antes", "red_despues", "error_500", "ninguna");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.tuple(fc.constantFrom("autorizarSubida", "subir", "confirmarSubida", "enviarComando" as const), falla), { maxLength: 12 }),
        async (cantidad, programa) => {
          const { db, ids, reloj } = await dispositivo(cantidad, 2);
          const s = servidorFalso({ verificacionesPendientes: 1 });
          for (const [op, f] of programa) s.programar(op, ...(f === "ninguna" ? [] : [f]));
          const motor = crearMotor({ almacen: almacenDexie(db), transporte: s.transporte, usuarioActual: async () => "t1", reloj: reloj.ahora, aleatorio: Math.random });

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
