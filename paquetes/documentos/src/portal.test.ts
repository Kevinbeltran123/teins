import { describe, expect, it } from "vitest";
import { correoDeCodigo, correoDeInvitacion } from "./portal";

describe("correos del portal (ADR-0053)", () => {
  it("el código va en el asunto y en grande, con su vencimiento y la advertencia de no darlo a nadie", () => {
    const c = correoDeCodigo({ organizacion: "TEINS", codigo: "482915" });
    expect(c.asunto).toBe("Su código para entrar al portal de TEINS: 482 915");
    for (const parte of [c.texto, c.html]) {
      expect(parte).toContain("482 915");
      expect(parte).toContain("Vence en 10 minutos.");
      expect(parte).toContain("Si usted no lo pidió, ignore este correo.");
      expect(parte).toContain("TEINS nunca le pedirá este código por teléfono ni por WhatsApp.");
    }
  });

  it("la invitación nombra solo lo que el contacto ve, y explica cómo se entra sin clave", () => {
    const base = { organizacion: "TEINS", nombre: "Carlos Peña", cliente: "Clínica San Rafael", portal: "https://portal.example/" };
    const soloCotizaciones = correoDeInvitacion({ ...base, ve: { informes: false, cotizaciones: true } });
    expect(soloCotizaciones.asunto).toBe("TEINS le dio acceso a sus cotizaciones");
    expect(soloCotizaciones.texto).toContain("Hola, Carlos:");
    expect(soloCotizaciones.texto).toContain("puede ver y descargar las cotizaciones de Clínica San Rafael");
    expect(soloCotizaciones.texto).toContain("https://portal.example/");
    expect(soloCotizaciones.html).toContain('href="https://portal.example/"');
    expect(soloCotizaciones.html).toContain("Entrar al portal");
    expect(soloCotizaciones.texto).toContain("escriba su correo y le enviaremos un código");

    expect(correoDeInvitacion({ ...base, ve: { informes: true, cotizaciones: true } }).asunto).toBe("TEINS le dio acceso a sus informes y cotizaciones");
    expect(correoDeInvitacion({ ...base, ve: { informes: true, cotizaciones: false } }).asunto).toBe("TEINS le dio acceso a sus informes");
  });

  it("lo que escribió oficina no rompe el HTML del correo", () => {
    const c = correoDeInvitacion({ organizacion: "TEINS", nombre: "<b>Ana</b>", cliente: "Clínica & Cía", portal: null, ve: { informes: true, cotizaciones: false } });
    expect(c.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(c.html).toContain("Clínica &amp; Cía");
    // Sin la dirección del portal en el entorno, sin botón.
    expect(c.html).not.toContain("Entrar al portal");
  });
});
