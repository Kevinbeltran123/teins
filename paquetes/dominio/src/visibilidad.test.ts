import { describe, expect, it } from "vitest";
import type { VersionFormato } from "./formato";
import { validarDefinicionFormato } from "./meta-esquema";
import { validarRespuestas } from "./validacion";
import { campoVisible, seccionVisible, VERSION_APP_VISIBILIDAD } from "./visibilidad";

// Formato ficticio (R5), con la forma de los de TEINS: causas solo si es correctivo; materiales solo si se usaron.
const formato: VersionFormato = {
  formato: "condiciones",
  version: 1,
  appMinima: VERSION_APP_VISIBILIDAD,
  secciones: [
    {
      clave: "servicio",
      titulo: "Servicio",
      campos: [
        { clave: "tipo", etiqueta: "Tipo de servicio", tipo: "opciones", opciones: ["Preventivo", "Correctivo"] },
        { clave: "se_emplearon", etiqueta: "¿Se emplearon materiales?", tipo: "opcion", opciones: ["Sí", "No"] },
        { clave: "materiales", etiqueta: "Materiales", tipo: "texto", obligatorio: true, visibleSi: { campo: "se_emplearon", en: ["Sí"] } },
      ],
    },
    {
      clave: "causas",
      titulo: "Causas del correctivo",
      visibleSi: { seccion: "servicio", campo: "tipo", en: ["Correctivo"] },
      campos: [{ clave: "causa", etiqueta: "Causa", tipo: "texto", obligatorio: true }],
    },
  ],
};

describe("visibilidad (ADR-0058)", () => {
  it("un campo aparece si su selección tiene una de las opciones; sin respuesta, no", () => {
    const materiales = formato.secciones[0]!.campos[2]!;
    expect(campoVisible(materiales, "servicio", { servicio: { se_emplearon: "Sí" } })).toBe(true);
    expect(campoVisible(materiales, "servicio", { servicio: { se_emplearon: "No" } })).toBe(false);
    expect(campoVisible(materiales, "servicio", {})).toBe(false);
  });

  it("una sección aparece si alguna opción elegida está en la lista", () => {
    const causas = formato.secciones[1]!;
    expect(seccionVisible(causas, { servicio: { tipo: { elegidas: ["Preventivo", "Correctivo"] } } })).toBe(true);
    expect(seccionVisible(causas, { servicio: { tipo: { elegidas: ["Preventivo"] } } })).toBe(false);
    expect(seccionVisible(formato.secciones[0]!, {})).toBe(true);
  });

  it("lo oculto no se exige al enviar; lo visible sí", () => {
    expect(validarRespuestas(formato, { servicio: { se_emplearon: "No", tipo: { elegidas: ["Preventivo"] } } })).toEqual([]);
    const errores = validarRespuestas(formato, { servicio: { se_emplearon: "Sí", tipo: { elegidas: ["Correctivo"] } } });
    expect(errores).toEqual(expect.arrayContaining([expect.objectContaining({ seccion: "servicio", campo: "materiales", codigo: "campo_obligatorio" }), expect.objectContaining({ seccion: "causas", campo: "causa", codigo: "campo_obligatorio" })]));
  });

  it("al publicar: la condición apunta a una selección anterior, con sus opciones, y exige la app que la entiende", () => {
    expect(validarDefinicionFormato(formato)).toEqual([]);
    expect(validarDefinicionFormato({ ...formato, appMinima: 16 })).toContain(`Los campos condicionales exigen appMinima ${VERSION_APP_VISIBILIDAD} o mayor`);
    const con = (visibleSi: object) => ({ ...formato, secciones: [formato.secciones[0]!, { ...formato.secciones[1]!, visibleSi }] }) as VersionFormato;
    expect(validarDefinicionFormato(con({ seccion: "servicio", campo: "no_existe", en: ["Correctivo"] }))).toContain("La condición de causas apunta a un campo que no existe antes: servicio.no_existe");
    expect(validarDefinicionFormato(con({ seccion: "servicio", campo: "tipo", en: ["Otro"] }))).toContain("La condición de causas usa opciones que servicio.tipo no tiene");
    expect(validarDefinicionFormato(con({ seccion: "servicio", campo: "tipo", en: [] }))).toContain("La condición de causas usa opciones que servicio.tipo no tiene");
    // Una sección no puede depender de sí misma: la condición nombra otra.
    expect(validarDefinicionFormato(con({ campo: "causa", en: ["x"] }))).toContain("La condición de la sección causas debe nombrar otra sección");
    // Un campo que aparece después no sirve: así no hay ciclos.
    const alReves: VersionFormato = { ...formato, secciones: [{ ...formato.secciones[0]!, campos: [formato.secciones[0]!.campos[2]!, ...formato.secciones[0]!.campos.slice(0, 2)] }, formato.secciones[1]!] };
    expect(validarDefinicionFormato(alReves)).toContain("La condición de servicio.materiales apunta a un campo que no existe antes: servicio.se_emplearon");
    // Solo selecciones.
    const sobreTexto = con({ seccion: "servicio", campo: "materiales", en: ["Sí"] });
    expect(validarDefinicionFormato(sobreTexto)).toContain("La condición de causas apunta a servicio.materiales, que no es una selección");
  });
});
