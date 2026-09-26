import { describe, expect, it } from "vitest";
import { bocetoVacio, type DocumentoBoceto } from "./boceto";
import { describirValor } from "./describir";
import { DECLARACION_POR_DEFECTO, firmaASvg, llenarDeclaracion, VERSION_APP_FIRMA } from "./firma";
import type { DefinicionCampo, VersionFormato } from "./formato";
import type { ValorFirma } from "./levantamiento";
import { validarDefinicionFormato } from "./meta-esquema";
import { corregir } from "./revision";
import { archivosReferenciados, bocetosReferenciados, fotosReferenciadas, validarCampo } from "./validacion";
import v7 from "../formatos-de-prueba/prueba-ups.v7.json";

const HUELLA = "a".repeat(64);
const campo: DefinicionCampo = { clave: "firma_cliente", etiqueta: "Firma de quien recibe la visita", tipo: "firma", obligatorio: true };
const firma: ValorFirma = {
  firma: HUELLA,
  nombre: "Martha Gómez",
  cargo: "Jefe de mantenimiento",
  firmadoEn: "2026-09-26T15:40:00.000-05:00",
  declaracion: "Confirmo que Carlos Rojas visitó Clínica de Prueba · Sede Norte el viernes, 26 de septiembre de 2026.",
};

describe("firma del cliente (iteración 16, ADR-0024)", () => {
  it("valida quién firmó, cuándo y qué leyó; el cargo es opcional", () => {
    expect(validarCampo(campo, firma)).toBeNull();
    const { cargo: _, ...sinCargo } = firma;
    expect(validarCampo(campo, sinCargo)).toBeNull();
    expect(validarCampo(campo, undefined)).toBe("campo_obligatorio");
    expect(validarCampo({ ...campo, obligatorio: false }, undefined)).toBeNull();
    expect(validarCampo(campo, { noObtenido: true, motivo: "Nadie del cliente estaba en el sitio" })).toBeNull();
  });

  it("rechaza una firma sin trazos, sin nombre, sin fecha, sin constancia o con datos de más", () => {
    for (const mala of [
      { ...firma, firma: "no-es-huella" },
      { ...firma, nombre: "  " },
      { ...firma, cargo: "" },
      { ...firma, firmadoEn: "ayer" },
      { ...firma, declaracion: "" },
      { ...firma, nombre: "x".repeat(121) },
    ]) {
      expect(validarCampo(campo, mala)).toBe("firma_invalida");
    }
    // Sin número de documento ni otros datos personales (regla 18).
    expect(validarCampo(campo, { ...firma, cedula: "123" })).toBe("tipo_invalido");
    expect(validarCampo(campo, "Martha")).toBe("tipo_invalido");
  });

  it("la constancia se llena con el técnico, el sitio y el día; sin texto en el formato, la de por defecto", () => {
    const datos = { tecnico: "Carlos Rojas", sitio: "Clínica de Prueba · Sede Norte", fecha: "viernes, 26 de septiembre de 2026" };
    expect(llenarDeclaracion("Confirmo que {tecnico}, de TEINS, visitó {sitio} el {fecha}.", datos)).toBe(
      "Confirmo que Carlos Rojas, de TEINS, visitó Clínica de Prueba · Sede Norte el viernes, 26 de septiembre de 2026.",
    );
    expect(llenarDeclaracion(undefined, datos)).toBe(DECLARACION_POR_DEFECTO.replace("{tecnico}", datos.tecnico).replace("{sitio}", datos.sitio).replace("{fecha}", datos.fecha));
    // Otras llaves no se tocan: el texto es del formato.
    expect(llenarDeclaracion("Hola {cliente}", datos)).toBe("Hola {cliente}");
  });

  it("oficina no corrige una firma: es de quien recibió la visita", () => {
    const formato: VersionFormato = { formato: "f", version: 1, appMinima: VERSION_APP_FIRMA, secciones: [{ clave: "cierre", titulo: "Cierre", campos: [campo] }] };
    const r = corregir(formato, { cierre: { firma_cliente: firma } }, [{ seccion: "cierre", campo: "firma_cliente", valor: { ...firma, nombre: "Otra persona" } }]);
    expect(r).toEqual({ ok: false, errores: [{ seccion: "cierre", campo: "firma_cliente", codigo: "no_corregible" }] });
  });

  it("sus trazos suben al enviar, como un boceto, y no cuentan como foto", () => {
    const respuestas = { cierre: { firma_cliente: firma } };
    expect(archivosReferenciados(respuestas)).toEqual([HUELLA]);
    expect(bocetosReferenciados(respuestas)).toEqual([HUELLA]);
    expect(fotosReferenciadas(respuestas)).toEqual([]);
  });

  it("se lee con el nombre y el cargo de quien firmó", () => {
    expect(describirValor(campo, firma)).toBe("Firmada por Martha Gómez (Jefe de mantenimiento)");
  });

  it("un formato con firma exige la app 7 y una constancia con texto", () => {
    const base: VersionFormato = { formato: "f", version: 1, secciones: [{ clave: "cierre", titulo: "Cierre", campos: [campo] }] };
    expect(validarDefinicionFormato({ ...base, appMinima: 6 })).toContain(`Las firmas exigen appMinima ${VERSION_APP_FIRMA} o mayor`);
    expect(validarDefinicionFormato({ ...base, appMinima: 7 })).toEqual([]);
    expect(validarDefinicionFormato({ ...base, appMinima: 7, secciones: [{ clave: "cierre", titulo: "Cierre", campos: [{ ...campo, declaracion: " " }] }] })).not.toEqual([]);
    expect(validarDefinicionFormato(v7 as VersionFormato)).toEqual([]);
  });

  it("el SVG de la firma va sin cuadrícula y recortado a sus trazos", () => {
    const d: DocumentoBoceto = {
      ...bocetoVacio(),
      elementos: [{ tipo: "trazo", grosor: 6, puntos: [[300, 400, 0.5]], contorno: [[300, 380], [700, 420], [500, 460]] }],
    };
    const svg = firmaASvg(d);
    expect(svg).toContain('viewBox="288 368 424 104"');
    expect(svg).not.toContain("cuadricula");
    // Vacía: el lienzo completo, sin fallar.
    expect(firmaASvg(bocetoVacio())).toContain('viewBox="0 0 1000 750"');
  });
});
