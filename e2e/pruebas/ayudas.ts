import { randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Locator, Page } from "@playwright/test";
import { codigoTotp } from "../totp";

/**
 * Imagen de prueba (ficticia, R5): la app la recodifica a JPEG como una foto de la cámara.
 * Una franja de tono aleatorio la hace única por corrida: los archivos se direccionan por contenido,
 * y una foto repetida no se vuelve a subir, así que la prueba no ejercitaría la carga.
 */
export function fotoDePrueba(tono = randomInt(20, 236)): Buffer {
  const [ancho, alto] = [640, 480];
  const fila = (y: number) => Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, y < 32 ? tono : y % 2 ? 90 : 200)]);
  const datos = deflateSync(Buffer.concat(Array.from({ length: alto }, (_, y) => fila(y))));
  const trozo = (tipo: string, contenido: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(contenido.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo), contenido])));
    return Buffer.concat([largo, Buffer.from(tipo), contenido, crc]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo("IHDR", cabecera), trozo("IDAT", datos), trozo("IEND", Buffer.alloc(0))]);
}

function crc32(b: Buffer): number {
  let c = ~0;
  for (const byte of b) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export async function iniciarSesion(page: Page, u: { usuario: string; contrasena: string }) {
  await page.getByLabel("Usuario").fill(u.usuario);
  await page.getByLabel("Contraseña").fill(u.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/**
 * La fila del técnico en la pestaña abierta de la bandeja. La bandeja va del más antiguo al más reciente,
 * 50 por página: en un entorno con levantamientos de corridas anteriores, el recién enviado puede estar
 * más abajo, así que se carga más hasta encontrarlo.
 */
export async function filaDeLaBandeja(pagina: Page, nombre: string): Promise<Locator> {
  const fila = pagina.getByRole("row").filter({ hasText: nombre });
  const mas = pagina.getByRole("button", { name: "Cargar más" });
  for (let i = 0; i < 20; i++) {
    // Espera a que la página cargue: o aparece la fila, o el botón para cargar más, o la lista termina.
    await fila.or(mas).or(pagina.getByRole("row").last()).first().waitFor();
    if (await fila.count()) return fila;
    if (!(await mas.isVisible())) break;
    await mas.click();
    await pagina.locator('button[aria-busy="true"]').waitFor({ state: "detached" });
  }
  return fila;
}

/**
 * Activa el segundo factor por la API, con la sesión de la página: para pruebas cuyo tema no es la
 * activación (esa la recorre administracion.spec.ts por la interfaz). Deja la página con sesión.
 */
export async function activarSegundoFactor(page: Page, base: string, u: { usuario: string; contrasena: string }) {
  const pedir = async (ruta: string, datos: object) => {
    const r = await page.request.post(`${base}/api/auth${ruta}`, { data: datos, headers: { origin: base } });
    if (!r.ok()) throw new Error(`${ruta}: ${r.status()} ${await r.text()}`);
    return r.json();
  };
  await pedir("/sign-in/username", { username: u.usuario, password: u.contrasena });
  const { totpURI } = await pedir("/two-factor/enable", { password: u.contrasena });
  await pedir("/two-factor/verify-totp", { code: codigoTotp(new URL(totpURI).searchParams.get("secret")!) });
}

/** PDF mínimo válido de una página (ficticio, R5), armado a mano con su tabla de referencias. */
export function pdfDePrueba(texto = `Plano ficticio ${randomInt(1_000_000)}`): Buffer {
  const contenido = `BT /F1 24 Tf 72 700 Td (${texto}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  objetos.forEach((o, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
