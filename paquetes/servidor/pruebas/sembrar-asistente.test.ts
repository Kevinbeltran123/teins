import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { describe, expect, inject, it } from "vitest";
import { fechaEnColombia } from "@teins/dominio";
import { sembrarDatosDelAsistente } from "../src/cli/sembrar-asistente";
import { enOrganizacion, type TxOrganizacion } from "../src/plataforma/base-de-datos";
import type { Archivos } from "../src/modulos/archivos";
import { crearHerramientasDelAsistente } from "../src/modulos/asistente/herramientas";
import { crearCatalogo } from "../src/modulos/catalogo";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearLevantamientos } from "../src/modulos/levantamientos";
import { crearVisitas } from "../src/modulos/visitas";
import { conexionesDePrueba, nuevaOrganizacion } from "./ayudas";

/** Los datos de ejemplo del asistente (iteración 53): sembrar dos veces no duplica y dan las cifras del prototipo. */
const { app, propietario } = conexionesDePrueba();
const bd = app.bd;
const formatos = crearFormatos();
const visitas = crearVisitas(clientesYSitios, formatos);
const sinNombres = { nombres: async () => new Map<string, string>(), buscarPorNombre: async () => [] };
const catalogo = crearCatalogo(bd, sinNombres);
const levantamientos = crearLevantamientos({ bd, formatos, archivos: {} as Archivos, visitas, identidad: sinNombres, catalogo });
const herramientas = crearHerramientasDelAsistente({ visitas, clientesYSitios, levantamientos, catalogo, formatos });
const requerir = createRequire(import.meta.url);

const org = await nuevaOrganizacion(propietario, "Organización sembrada");
const en = <T>(fn: (tx: TxOrganizacion) => Promise<T>) => enOrganizacion(bd, org, fn);
await en((tx) => formatos.publicar(tx, org, JSON.parse(readFileSync(requerir.resolve("@teins/dominio/formatos-de-prueba/prueba-ups.v10.json"), "utf8"))));
const personas = { tecnicoId: "tecnico-ficticio", revisorId: "oficina-ficticia" };

async function ejecutar(nombre: string, entrada: unknown) {
  const h = herramientas.find((x) => x.nombre === nombre)!;
  const datos = h.entrada.parse(entrada);
  return en((tx) => h.ejecutar(tx, datos, { organizacionId: org, usuarioId: "x", hoy: fechaEnColombia() }));
}

const contar = async () => (await propietario.pool.query("select (select count(*) from visitas.visitas where organizacion_id = $1)::int as visitas, (select count(*) from catalogo.items where organizacion_id = $1)::int as items, (select count(*) from levantamientos.levantamientos where organizacion_id = $1)::int as levantamientos", [org])).rows[0];

describe("datos de ejemplo del asistente", () => {
  it("se siembran una vez y la segunda no duplica", async () => {
    expect(await sembrarDatosDelAsistente(bd, org, personas)).toBe(true);
    const primera = await contar();
    expect(primera).toEqual({ visitas: 6 + 41, items: 4, levantamientos: 6 });
    expect(await sembrarDatosDelAsistente(bd, org, personas)).toBe(false);
    expect(await contar()).toEqual(primera);
  });

  it("dan las cifras del prototipo con fechas de los últimos 300 días", async () => {
    const hace = new Date(`${fechaEnColombia()}T12:00:00Z`);
    hace.setUTCDate(hace.getUTCDate() - 300);
    const encontradas = await ejecutar("buscar_visitas", { desde: hace.toISOString().slice(0, 10), ciudades: ["Ibagué", "Espinal", "Melgar"] });
    expect(encontradas.resumen).toBe("5 revisadas, 1 sin revisar");
    const ids = (encontradas.datos as { visitas: { visitaId: string }[] }).visitas.map((v) => v.visitaId);

    const suma = (await ejecutar("sumar_materiales", { visitas: ids, texto: "cable" })).datos as { filas: { codigo: string | null; cantidad: string; visitas: number }[] };
    expect(suma.filas.map((f) => [f.codigo, f.cantidad, f.visitas])).toEqual([
      ["CAB-UTP6", "4485", 5],
      ["CAB-FO12", "310", 2],
      ["CAB-ENC312", "85", 2],
      [null, "45", 1],
    ]);

    const items = async (texto: string) => ((await ejecutar("buscar_en_catalogo", { texto })).datos as { items: { id: string }[] }).items[0]!.id;
    const estimado = await ejecutar("estimar_materiales", { visitas: ids, item: await items("UTP"), porItem: await items("punto de red"), cantidad: 40 });
    expect(estimado.cifras?.map((c) => c.valor)).toEqual(["1.215", "$ 3.523.500"]);

    // Sin ciudades entran también las de UPS, que no tienen levantamiento: no son «sin revisar».
    const haceUnAno = new Date(`${fechaEnColombia()}T12:00:00Z`);
    haceUnAno.setUTCDate(haceUnAno.getUTCDate() - 365);
    const delAnio = (await ejecutar("buscar_visitas", { desde: haceUnAno.toISOString().slice(0, 10) })).datos as { visitas: { visitaId: string }[] };
    const todas = delAnio.visitas.map((v) => v.visitaId);
    const sumaDelAnio = await ejecutar("sumar_materiales", { visitas: todas, texto: "cable" });
    expect(sumaDelAnio.tabla?.nota).toBe("1 visita sin revisar no entró en la suma.");
    expect(sumaDelAnio.fuentes?.visitas.map((v) => v.revisado)).toEqual([true, true, true, true, true, false]);
    expect(sumaDelAnio.datos).toMatchObject({ sinLevantamiento: 41, excluidas: [expect.objectContaining({ motivo: "sin_revisar" })] });
    const estimadoDelAnio = await ejecutar("estimar_materiales", { visitas: todas, item: await items("UTP"), porItem: await items("punto de red"), cantidad: 40 });
    expect(estimadoDelAnio.datos).toMatchObject({ n: 5, sinLevantamiento: 41 });
    expect((estimadoDelAnio.datos as { sinRevisar: unknown[] }).sinRevisar).toHaveLength(1);

    const ups = await ejecutar("contar_visitas", { servicios: ["UPS"], agruparPor: "mes" });
    expect(ups.serie?.puntos.map((p) => p.valor)).toEqual([2, 3, 2, 4, 3, 5, 6, 4, 3, 5, 4]);
  });
});

describe("el comando sembrar-asistente", () => {
  const correr = (args: string[], extra: Record<string, string> = {}) =>
    promisify(execFile)("node_modules/.bin/tsx", ["src/cli/sembrar-ejemplos-del-asistente.ts", ...args], {
      env: { ...process.env, NODE_ENV: "test", NIVEL_REGISTRO: "silent", DATABASE_URL: inject("urlApp"), DATABASE_URL_PROPIETARIO: inject("urlPropietario"), S3_REGION: "us-east-1", S3_BUCKET: "x", S3_ACCESS_KEY_ID: "x", S3_SECRET_ACCESS_KEY: "x", AUTH_SECRETO: "secreto-de-prueba-que-no-es-real-0123456789", ORIGENES_CONFIABLES: "http://localhost:5174", ...extra },
    });
  const usuario = async (organizacionId: string, nombre: string, rol: string) =>
    propietario.pool.query("insert into identidad.usuarios (id, nombre, correo, usuario, organizacion_id, rol) values ($1, $2, $3, $2, $4, $5)", [randomUUID(), nombre, `${nombre}@ejemplo.invalid`, organizacionId, rol]);

  it("publica el formato, siembra la organización dada y la segunda vez no duplica", async () => {
    const otra = await nuevaOrganizacion(propietario, "Organización del extremo a extremo");
    const sufijo = randomUUID().slice(0, 8);
    await usuario(otra, `tecnico.${sufijo}`, "tecnico");
    await usuario(otra, `oficina.${sufijo}`, "oficina");
    const args = ["--organizacion", otra, "--tecnico", `tecnico.${sufijo}`, "--revisor", `oficina.${sufijo}`];
    expect((await correr(args)).stdout).toContain("Datos del asistente: sembrados");
    expect((await correr(args)).stdout).toContain("Datos del asistente: ya existían");
    const { rows } = await propietario.pool.query(
      "select (select count(*) from visitas.visitas where organizacion_id = $1)::int as visitas, (select count(*) from formatos.versiones where organizacion_id = $1 and formato = 'prueba-ups' and version = 10)::int as formatos",
      [otra],
    );
    expect(rows[0]).toEqual({ visitas: 47, formatos: 1 });
  });

  it("falla con un usuario que no es de la organización", async () => {
    await expect(correr(["--organizacion", org, "--tecnico", "nadie", "--revisor", "nadie"])).rejects.toMatchObject({ stderr: expect.stringContaining("El usuario nadie no existe") });
  });

  it("en producción la guarda lo detiene; con ENTORNO_DE_PRUEBAS la deja pasar", async () => {
    // Lo que la configuración exige en producción, con valores ficticios: así lo que corta es la guarda.
    const produccion = { NODE_ENV: "production", ORIGENES_CONFIABLES: "https://oficina.ejemplo.invalid", PROXIES_DE_CONFIANZA: "1" };
    const args = ["--organizacion", org, "--tecnico", "nadie", "--revisor", "nadie"];
    await expect(correr(args, { ...produccion, ENTORNO_DE_PRUEBAS: "false" })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("sembrar-asistente no corre en producción"),
    });
    // Pasada la guarda, llega a la base y busca los usuarios.
    const pasa = correr(args, { ...produccion, ENTORNO_DE_PRUEBAS: "true" });
    await expect(pasa).rejects.toMatchObject({ stderr: expect.stringContaining("El usuario nadie no existe") });
    await expect(pasa).rejects.toMatchObject({ stderr: expect.not.stringContaining("no corre en producción") });
  });
});

describe("sembrar", () => {
  const ORGANIZACION_DEL_ASISTENTE = "00000000-0000-4000-8000-000000000053";
  const ORGANIZACION_DE_DESARROLLO = "00000000-0000-4000-8000-000000000001";
  const sembrar = () =>
    promisify(execFile)("node_modules/.bin/tsx", ["src/cli/sembrar.ts"], {
      env: { ...process.env, NODE_ENV: "test", NIVEL_REGISTRO: "silent", DATABASE_URL: inject("urlApp"), DATABASE_URL_PROPIETARIO: inject("urlPropietario"), S3_REGION: "us-east-1", S3_BUCKET: "x", S3_ACCESS_KEY_ID: "x", S3_SECRET_ACCESS_KEY: "x", S3_CONFIGURAR_CORS: "false", AUTH_SECRETO: "secreto-de-prueba-que-no-es-real-0123456789", ORIGENES_CONFIABLES: "http://localhost:5174" },
    });
  const cuantos = async (organizacionId: string) =>
    (
      await propietario.pool.query(
        `select (select count(*) from visitas.visitas where organizacion_id = $1)::int as visitas,
                (select count(*) from levantamientos.levantamientos where organizacion_id = $1)::int as levantamientos,
                (select count(*) from catalogo.items where organizacion_id = $1 and codigo = 'CAB-UTP6')::int as utp,
                (select count(*) from identidad.usuarios where organizacion_id = $1 and usuario like '%.chispa')::int as usuarios,
                (select count(*) from formatos.versiones where organizacion_id = $1 and formato = 'prueba-ups' and version = 10)::int as formato`,
        [organizacionId],
      )
    ).rows[0];

  it("siembra Chispa en su organización, dos veces sin duplicar, y nada en la de desarrollo", { timeout: 120_000 }, async () => {
    const primera = await sembrar();
    expect(primera.stdout).toMatch(/Usuario oficina\.chispa \(oficina\): contraseña \S+/);
    expect(primera.stdout).toMatch(/Usuario tecnico\.chispa \(tecnico\): contraseña \S+/);
    expect(await cuantos(ORGANIZACION_DEL_ASISTENTE)).toEqual({ visitas: 47, levantamientos: 6, utp: 1, usuarios: 2, formato: 1 });
    const segunda = await sembrar();
    expect(segunda.stdout).not.toMatch(/\): contraseña /);
    expect(segunda.stdout).toContain("ya existían");
    expect(await cuantos(ORGANIZACION_DEL_ASISTENTE)).toEqual({ visitas: 47, levantamientos: 6, utp: 1, usuarios: 2, formato: 1 });
    expect(await cuantos(ORGANIZACION_DE_DESARROLLO)).toMatchObject({ levantamientos: 0, utp: 0, usuarios: 0 });
  });
});
