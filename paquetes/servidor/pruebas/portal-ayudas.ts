import { expect } from "vitest";
import { derivarCodigo, secretoDeCodigos } from "../src/modulos/portal/claves";
import { ORIGEN, type servidorDePrueba } from "./ayudas";

type Servidor = Awaited<ReturnType<typeof servidorDePrueba>>;
type Respuesta = Awaited<ReturnType<Servidor["app"]["inject"]>>;
type Org = { organizacionId: string; oficina: { cookie: string } };

const ORIGEN_PORTAL = "http://localhost:5175";
const cookieDe = (r: Respuesta, nombre: string) =>
  [r.headers["set-cookie"]]
    .flat()
    .map(String)
    .find((c) => c.startsWith(`${nombre}=`))
    ?.split(";")[0];

/**
 * El código del último pedido de ese correo, como lo calcula el servidor (ADR-0053): del id del pedido y el secreto.
 * Así las pruebas no dependen del correo, que solo procesa portal.test.ts.
 */
export async function codigoDePrueba(s: Servidor, correo: string): Promise<string> {
  const { rows } = await s.propietario.pool.query("select p.pedido_id from portal.pedidos p join portal.accesos a on a.id = p.acceso_id where a.correo = $1", [correo]);
  expect(rows, `pedido de ${correo}`).toHaveLength(1);
  return derivarCodigo(secretoDeCodigos(s.config), rows[0].pedido_id);
}

/** Lo que hacen oficina y el cliente con el portal, por la API. */
export function conPortal(s: Servidor) {
  const { app } = s;
  const p = {
    ORIGEN_PORTAL,
    async contacto(org: Org, clienteId: string, datos: { nombre: string; correo: string | null; recibeInformes: boolean; recibeCotizaciones: boolean }) {
      const r = await app.inject({
        method: "POST",
        url: `/api/clientes/${clienteId}/contactos`,
        headers: { cookie: org.oficina.cookie, origin: ORIGEN },
        payload: { ...datos, recibeCorreo: datos.correo !== null, recibeWhatsapp: false },
      });
      expect(r.statusCode, r.body).toBe(201);
      return r.json().contactos.find((x: { nombre: string }) => x.nombre === datos.nombre) as { id: string; nombre: string };
    },
    darAcceso: (org: Org, clienteId: string, contactoId: string) =>
      app.inject({ method: "POST", url: `/api/clientes/${clienteId}/contactos/${contactoId}/portal`, headers: { cookie: org.oficina.cookie, origin: ORIGEN }, payload: { activo: true } }),
    pedir: (correo: string, ip: string) => app.inject({ method: "POST", url: "/api/portal/codigo", remoteAddress: ip, headers: { origin: ORIGEN_PORTAL }, payload: { correo } }),
    /** `pedido`: la respuesta de `pedir` del mismo navegador, con su cookie pendiente; null, sin ella. */
    entrar: (correo: string, codigo: string, pedido: Respuesta | null, ip: string) => {
      const pendiente = pedido && cookieDe(pedido, "teins-portal-pendiente");
      return app.inject({ method: "POST", url: "/api/portal/ingresar", remoteAddress: ip, headers: { origin: ORIGEN_PORTAL, ...(pendiente ? { cookie: pendiente } : {}) }, payload: { correo, codigo } });
    },
    sesionDe: (r: Respuesta) => cookieDe(r, "teins-portal")!,
    leer: (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } }),
    /** Pide el código y entra con él desde el mismo navegador: la cookie de la sesión. */
    async entrarCompleto(correo: string, ip: string) {
      const pedido = await p.pedir(correo, ip);
      expect(pedido.statusCode, pedido.body).toBe(202);
      const r = await p.entrar(correo, await codigoDePrueba(s, correo), pedido, ip);
      expect(r.statusCode, r.body).toBe(200);
      return p.sesionDe(r);
    },
  };
  return p;
}
