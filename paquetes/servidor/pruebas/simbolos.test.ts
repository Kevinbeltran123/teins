import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { DefinicionSimbolo } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearSimbolos } from "../src/modulos/simbolos";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Biblioteca ficticia (R5): la misma que siembra el entorno de desarrollo. */
const deArchivo: DefinicionSimbolo[] = JSON.parse(readFileSync(createRequire(import.meta.url).resolve("@teins/dominio/formatos-de-prueba/simbolos-prueba.json"), "utf8"));
const [tablero, ups, , toma] = deArchivo as [DefinicionSimbolo, DefinicionSimbolo, DefinicionSimbolo, DefinicionSimbolo];
const ultimo = deArchivo.at(-1)!;

const publicar = (organizacionId: string, biblioteca: unknown) => enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => crearSimbolos().publicar(tx, organizacionId, biblioteca));
const bajar = (cookie: string, version: number, desde = 0) =>
  app.inject({ method: "GET", url: `/api/sync/cambios?desde=${desde}&app=${version}&limite=500`, headers: { cookie, ...cabecerasSync } });
const simbolosDe = (bajada: { cambios: { tipo: string; simbolo?: unknown }[] }) => bajada.cambios.filter((c) => c.tipo === "simbolo").map((c) => c.simbolo);

describe("símbolos de los bocetos (iteración 19, ADR-0027)", () => {
  it("la biblioteca baja a la app 10 con su orden; una app anterior no la recibe; lo que sale se retira", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    expect(await publicar(org.organizacionId, deArchivo)).toEqual({ nuevos: 21, cambiados: 0, retirados: 0 });

    expect(simbolosDe((await bajar(org.tecnico.cookie, 9)).json())).toEqual([]);
    const primera = (await bajar(org.tecnico.cookie, 10)).json();
    const bajados = simbolosDe(primera) as (DefinicionSimbolo & { orden: number; activo: boolean })[];
    expect(bajados).toHaveLength(21);
    expect(bajados).toContainEqual({ ...tablero, orden: 0, activo: true });
    expect(bajados).toContainEqual({ ...ups, orden: 1, activo: true });

    // Publicar lo mismo no cambia nada; quitar el último lo retira y cambiar la toma la manda de nuevo.
    expect(await publicar(org.organizacionId, deArchivo)).toEqual({ nuevos: 0, cambiados: 0, retirados: 0 });
    const siguiente = deArchivo.filter((x) => x.id !== ultimo.id).map((x) => (x.id === toma.id ? { ...x, nombre: "Toma doble" } : x));
    expect(await publicar(org.organizacionId, siguiente)).toEqual({ nuevos: 0, cambiados: 1, retirados: 1 });
    const cambios = simbolosDe((await bajar(org.tecnico.cookie, 10, primera.puntoDeControl)).json());
    expect(cambios).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ultimo.id, activo: false }), expect.objectContaining({ id: toma.id, nombre: "Toma doble", orden: 3, activo: true })]),
    );
    expect(cambios).toHaveLength(2);
  });

  it("publicar repara los símbolos que perdieron su entrada en el registro: un teléfono nuevo los recibe", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    await publicar(org.organizacionId, deArchivo);
    // Lo que hacía la limpieza de pruebas antes de ADR-0038: borrar todo el registro de la organización.
    await s.propietario.pool.query("delete from cambios.registro where organizacion_id = $1", [org.organizacionId]);
    expect(simbolosDe((await bajar(org.tecnico.cookie, 10)).json())).toEqual([]);

    // Nada cambió en la biblioteca, pero volver a publicarla deja de nuevo la entrada de cada símbolo.
    expect(await publicar(org.organizacionId, deArchivo)).toEqual({ nuevos: 0, cambiados: 0, retirados: 0 });
    expect(simbolosDe((await bajar(org.tecnico.cookie, 10)).json())).toHaveLength(21);
  });

  it("cada organización tiene su biblioteca, aunque usen los mismos ids", async () => {
    const [una, otra] = [await s.nuevaOrganizacionConUsuarios(), await s.nuevaOrganizacionConUsuarios()];
    await publicar(una.organizacionId, [tablero]);
    await publicar(otra.organizacionId, [{ ...tablero, nombre: "Tablero general" }, toma]);
    expect(simbolosDe((await bajar(una.tecnico.cookie, 10)).json())).toEqual([{ ...tablero, orden: 0, activo: true }]);
    expect(simbolosDe((await bajar(otra.tecnico.cookie, 10)).json())).toHaveLength(2);
  });

  it("una biblioteca con un trazado que no es geometría no se publica, y no queda nada a medias", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    await expect(publicar(org.organizacionId, [tablero, { ...ups, trazado: 'M0 0"/><script>' }])).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(publicar(org.organizacionId, [tablero, { ...ups, nombre: "tablero" }])).rejects.toMatchObject({ codigo: "entrada_invalida" });
    // Un id que no es UUID según el protocolo rompería la bajada de todos los teléfonos.
    await expect(publicar(org.organizacionId, [tablero, { ...ups, id: "12345678-1234-1234-1234-123456789012" }])).rejects.toMatchObject({ codigo: "entrada_invalida" });
    expect(simbolosDe((await bajar(org.tecnico.cookie, 10)).json())).toEqual([]);
  });
});
