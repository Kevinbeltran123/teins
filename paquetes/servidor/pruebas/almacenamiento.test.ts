import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { configDePrueba, jpegDePrueba } from "./ayudas";

const firmar = (exigirHuella: boolean) => {
  const almacenamiento = almacenamientoS3(configDePrueba({ S3_EXIGIR_HUELLA: String(exigirHuella) }));
  const foto = jpegDePrueba();
  const clave = `prueba/${randomUUID()}`;
  return { almacenamiento, foto, clave, firma: almacenamiento.firmarSubida(clave, { bytes: foto.datos.length, tipo: "image/jpeg", sha256Hex: foto.huella }) };
};

describe("subida firmada (ADR-0007)", () => {
  it("con huella exigida, la firma la incluye y el almacenamiento rechaza otro contenido", async () => {
    const { foto, firma } = firmar(true);
    const { url, cabeceras } = await firma;
    expect(cabeceras).toHaveProperty("x-amz-checksum-sha256");
    // El SDK la lleva en la consulta de la URL, que también queda firmada.
    expect(new URL(url).searchParams.get("x-amz-checksum-sha256")).toBe(cabeceras["x-amz-checksum-sha256"]);
    const alterado = Buffer.from(foto.datos);
    alterado[alterado.length - 3] = alterado[alterado.length - 3]! ^ 0xff;
    expect((await fetch(url, { method: "PUT", headers: cabeceras, body: alterado })).ok).toBe(false);
  });

  it("sin huella exigida (Cloudflare R2), la URL no lleva sumas de verificación y la carga funciona", async () => {
    const { almacenamiento, foto, clave, firma } = firmar(false);
    const { url, cabeceras } = await firma;
    expect(cabeceras).toEqual({ "content-type": "image/jpeg" });
    // El SDK no debe agregar una suma propia: la del cuerpo vacío haría fallar la carga real.
    expect([...new URL(url).searchParams.keys()].filter((k) => k.toLowerCase().includes("checksum"))).toEqual([]);
    expect((await fetch(url, { method: "PUT", headers: cabeceras, body: foto.datos })).ok).toBe(true);
    // La garantía queda en el worker, que recalcula la huella de lo guardado.
    const guardado = Buffer.concat(await (await almacenamiento.leer(clave)).toArray());
    expect(createHash("sha256").update(guardado).digest("hex")).toBe(foto.huella);
  });
});
