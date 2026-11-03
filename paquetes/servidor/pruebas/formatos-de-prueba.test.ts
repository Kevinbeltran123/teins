import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { validarDefinicionFormato, type VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearFormatos } from "../src/modulos/formatos";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

/*
  Los formatos ficticios del repositorio, y los reales de TEINS si están en esta máquina (`datos-reales/formatos/`, fuera
  de git por R5): todos pasan el meta-esquema, o no se podrían publicar (ADR-0006, regla 1).
*/

const carpetaDePrueba = dirname(createRequire(import.meta.url).resolve("@teins/dominio/formatos-de-prueba/prueba-ups.v1.json"));
const carpetaReal = join(import.meta.dirname, "../../../datos-reales/formatos");
const leer = (carpeta: string) => readdirSync(carpeta).filter((f) => /^[a-z-]+(\.v\d+)?\.json$/.test(f) && !f.startsWith("simbolos")).map((f) => [f, JSON.parse(readFileSync(join(carpeta, f), "utf8")) as VersionFormato] as const);
const formatoDePrueba = (archivo: string) => JSON.parse(readFileSync(join(carpetaDePrueba, archivo), "utf8")) as VersionFormato;

describe("los formatos de prueba pasan el meta-esquema", () => {
  it.each(leer(carpetaDePrueba))("%s", (_nombre, formato) => {
    expect(validarDefinicionFormato(formato)).toEqual([]);
  });

  it("el v10 y la visita de prueba ejercitan lo nuevo: selección, horario, tablas, sello y cédula, con appMinima 16", () => {
    const v10 = formatoDePrueba("prueba-ups.v10.json");
    const campos = v10.secciones.flatMap((s) => s.campos);
    expect(v10.appMinima).toBe(16);
    expect(campos.some((c) => c.tipo === "horario")).toBe(true);
    expect(campos.some((c) => c.tipo === "opcion")).toBe(true);
    expect(campos.some((c) => c.tipo === "opciones" && c.otro)).toBe(true);
    expect(campos.some((c) => c.tipo === "foto" && c.sello?.ubicacion && c.sello.mapa)).toBe(true);
    expect(campos.some((c) => c.tipo === "firma" && c.documento === "opcional")).toBe(true);
    expect(v10.secciones.some((s) => (s.tablas?.[0]?.columnas.length ?? 0) === 3)).toBe(true);
  });

  // Sin lo nuevo no hay nada que forzar: lo que ya estaba publicado no se toca.
  it("ningún campo nuevo del v10 es obligatorio: las pruebas anteriores siguen pudiendo enviar", () => {
    const v10 = formatoDePrueba("prueba-ups.v10.json");
    const v9 = formatoDePrueba("prueba-ups.v9.json");
    const antes = new Set(v9.secciones.flatMap((s) => s.campos.map((c) => `${s.clave}.${c.clave}`)));
    const nuevos = v10.secciones.flatMap((s) => s.campos.map((c) => [`${s.clave}.${c.clave}`, c] as const)).filter(([k]) => !antes.has(k));
    expect(nuevos.length).toBeGreaterThan(5);
    expect(nuevos.filter(([, c]) => c.obligatorio)).toEqual([]);
  });
});

// Los de TEINS (R5): solo si la carpeta existe en esta máquina; un clon nuevo no los tiene.
describe.skipIf(!existsSync(carpetaReal))("los formatos reales de TEINS pasan el meta-esquema", () => {
  it.each(existsSync(carpetaReal) ? leer(carpetaReal) : [])("%s", (_nombre, formato) => {
    expect(validarDefinicionFormato(formato)).toEqual([]);
  });
});

describe("una app anterior no recibe lo que no sabe dibujar (ADR-0015, ADR-0050)", () => {
  it("la bajada entrega el v10 solo a la app 16 o posterior; la 15 sigue con el v9", async () => {
    const s = await servidorDePrueba();
    const org = await s.nuevaOrganizacionConUsuarios();
    const formatos = crearFormatos();
    for (const v of ["prueba-ups.v9.json", "prueba-ups.v10.json"]) await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => formatos.publicar(tx, org.organizacionId, formatoDePrueba(v)));
    const bajar = async (app: number) => {
      const r = await s.app.inject({ method: "GET", url: `/api/sync/cambios?desde=0&app=${app}`, headers: { cookie: org.tecnico.cookie, ...cabecerasSync } });
      expect(r.statusCode, r.body).toBe(200);
      return (r.json().cambios as { tipo: string; definicion?: { formato: string; version: number } }[]).filter((c) => c.tipo === "formato").map((c) => `${c.definicion!.formato}@${c.definicion!.version}`);
    };
    const con15 = await bajar(15);
    expect(con15).toContain("prueba-ups@9");
    expect(con15).not.toContain("prueba-ups@10");
    const con16 = await bajar(16);
    expect(con16).toContain("prueba-ups@10");
  });
});
