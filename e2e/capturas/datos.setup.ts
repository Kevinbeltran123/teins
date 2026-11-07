import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { OFICINA } from "../destino";
import { codigoTotp } from "../totp";
import { CATALOGO, CLIENTES, CONTRASENA, dia, FORMATOS, guardarEstado, hhmm, horaDeAhora, leerFormato, PERSONAS, type Estado } from "./comun";

/**
 * Los datos de la historia que cuentan las capturas, por la API de oficina como los dejaría TEINS: clientes con NIT,
 * ciudad y contactos, el catálogo con precios, los técnicos y sus visitas de hoy y de mañana.
 */
async function api(): Promise<{ api: APIRequestContext; secreto: string }> {
  const api = await request.newContext({ baseURL: OFICINA, extraHTTPHeaders: { origin: OFICINA } });
  const pedir = async (ruta: string, datos: object) => {
    const r = await api.post(`/api/auth${ruta}`, { data: datos });
    expect(r.ok(), `${ruta}: ${await r.text()}`).toBe(true);
    return r.json() as Promise<Record<string, string>>;
  };
  await pedir("/sign-in/username", { username: PERSONAS.admin.usuario, password: CONTRASENA });
  const { totpURI } = await pedir("/two-factor/enable", { password: CONTRASENA });
  const secreto = new URL(totpURI!).searchParams.get("secret")!;
  await pedir("/two-factor/verify-totp", { code: codigoTotp(secreto) });
  return { api, secreto };
}

async function post<T>(api: APIRequestContext, ruta: string, datos: object): Promise<T> {
  const r = await api.post(ruta, { data: datos });
  expect(r.ok(), `${ruta}: ${r.status()} ${await r.text()}`).toBe(true);
  return (await r.json()) as T;
}

test("datos de las capturas", async () => {
  const { api: a, secreto } = await api();

  // Quienes entran por primera vez con una contraseña temporal.
  const tecnico = await post<{ usuario: { id: string }; contrasena: string }>(a, "/api/administracion/usuarios", { usuario: PERSONAS.tecnico.usuario, nombre: PERSONAS.tecnico.nombre, rol: "tecnico", documento: "1110482337" });
  const oficina = await post<{ contrasena: string }>(a, "/api/administracion/usuarios", { usuario: PERSONAS.oficina.usuario, nombre: PERSONAS.oficina.nombre, rol: "oficina" });
  const usuarios = ((await (await a.get("/api/administracion/usuarios")).json()) as { usuarios: { id: string; usuario: string }[] }).usuarios;
  const id = (usuario: string) => usuarios.find((x) => x.usuario === usuario)!.id;
  for (const [quien, cedula] of [[PERSONAS.admin.usuario, "52814903"], [PERSONAS.tecnico2.usuario, "1020733418"], [PERSONAS.tecnico3.usuario, "1106778291"]] as const) {
    await post(a, `/api/administracion/usuarios/${id(quien)}/documento`, { documento: cedula });
  }

  await post(a, "/api/catalogo/importar", { items: CATALOGO.map((i) => ({ ...i })) });

  const clientes = {} as Estado["clientes"];
  for (const [clave, c] of Object.entries(CLIENTES) as [keyof typeof CLIENTES, (typeof CLIENTES)[keyof typeof CLIENTES]][]) {
    const creado = await post<{ id: string; sitios: { id: string }[] }>(a, "/api/clientes", {
      nombre: c.nombre,
      nit: c.nit,
      sitio: c.sitio,
      contacto: { ...c.contacto, recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: true },
    });
    for (const otro of c.otros) await post(a, `/api/clientes/${creado.id}/contactos`, { ...otro, recibeCorreo: true, recibeWhatsapp: false });
    const detalle = (await (await a.get(`/api/clientes/${creado.id}`)).json()) as { contactos: { id: string; nombre: string }[] };
    clientes[clave] = { id: creado.id, sitioId: creado.sitios[0]!.id, contactoId: detalle.contactos.find((x) => x.nombre === c.contacto.nombre)!.id };
  }

  const tecnicos = ((await (await a.get("/api/tecnicos")).json()) as { tecnicos: { id: string; usuario: string }[] }).tecnicos;
  const idTecnico = (usuario: string) => tecnicos.find((t) => t.usuario === usuario)!.id;
  const h = horaDeAhora();
  // El servicio de cada visita (ADR-0057): A es el formato de servicio, B el general.
  const [A, B] = FORMATOS.map((f) => leerFormato(f).formato);
  const visita = async (cliente: keyof typeof CLIENTES, datos: { formato: string; fecha: string; inicio: string | null; fin: string | null; tecnicos: string[]; referencia?: string }) => {
    const c = clientes[cliente];
    const v = await post<{ id: string }>(a, "/api/visitas", {
      clienteId: c.id,
      sitioId: c.sitioId,
      formato: datos.formato,
      programadaPara: datos.fecha,
      horaInicio: datos.inicio,
      horaFin: datos.fin,
      solicitanteId: c.contactoId,
      referencia: datos.referencia ?? null,
      tecnicos: datos.tecnicos.map(idTecnico),
    });
    return v.id;
  };
  const andres = PERSONAS.tecnico.usuario;
  const visitas: Estado["visitas"] = {
    principal: await visita("clinica", { formato: A!, fecha: dia(), inicio: hhmm(h), fin: hhmm(h + 2), tecnicos: [andres], referencia: "TK-2291" }),
    segunda: await visita("bodegas", { formato: B!, fecha: dia(), inicio: hhmm(h + 2, 30), fin: hhmm(h + 4), tecnicos: [andres] }),
    manana: await visita("colegio", { formato: A!, fecha: dia(1), inicio: "08:00", fin: "10:00", tecnicos: [andres], referencia: "OC-1187" }),
    delSegundo: await visita("hotel", { formato: A!, fecha: dia(), inicio: hhmm(h), fin: hhmm(h + 3), tecnicos: [PERSONAS.tecnico2.usuario] }),
    delTercero: await visita("colegio", { formato: B!, fecha: dia(), inicio: null, fin: null, tecnicos: [PERSONAS.tecnico3.usuario] }),
  };

  guardarEstado({ secretoAdmin: secreto, temporalTecnico: tecnico.contrasena, temporalOficina: oficina.contrasena, clientes, visitas });
  await a.dispose();
});
