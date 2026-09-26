import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";

/**
 * Autenticador WebAuthn de software para las pruebas del servidor: lo que harían Face ID o la huella,
 * con una clave P-256 en memoria y atestación "none". Solo lo mínimo de CBOR que WebAuthn usa.
 */

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest();

function cabecera(tipo: number, longitud: number): Buffer {
  if (longitud < 24) return Buffer.from([(tipo << 5) | longitud]);
  if (longitud < 256) return Buffer.from([(tipo << 5) | 24, longitud]);
  return Buffer.from([(tipo << 5) | 25, longitud >> 8, longitud & 0xff]);
}

type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function cbor(v: Cbor): Buffer {
  if (typeof v === "number") return v >= 0 ? cabecera(0, v) : cabecera(1, -1 - v);
  if (typeof v === "string") return Buffer.concat([cabecera(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (v instanceof Uint8Array) return Buffer.concat([cabecera(2, v.length), Buffer.from(v)]);
  return Buffer.concat([cabecera(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

const BANDERAS = { presente: 0x01, verificada: 0x04, conCredencial: 0x40 };

export interface Autenticador {
  /** Respuesta a `navigator.credentials.create` con las opciones del servidor. */
  crear(opciones: { challenge: string; rp: { id: string } }, origen: string): Record<string, unknown>;
  /** Respuesta a `navigator.credentials.get`; `verificada: false` imita un toque sin Face ID ni PIN. */
  firmar(opciones: { challenge: string; rpId: string }, origen: string, verificada?: boolean): Record<string, unknown>;
}

export function nuevoAutenticador(): Autenticador {
  const { privateKey, publicKey }: { privateKey: KeyObject; publicKey: KeyObject } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const credencial = randomBytes(16);
  let usuario = new Uint8Array();
  let contador = 0;

  const datosDeAutenticador = (rpId: string, banderas: number, extra = Buffer.alloc(0)) => {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(++contador);
    return Buffer.concat([sha256(rpId), Buffer.from([banderas]), c, extra]);
  };
  const datosDelCliente = (tipo: string, challenge: string, origen: string) => Buffer.from(JSON.stringify({ type: tipo, challenge, origin: origen, crossOrigin: false }));

  return {
    crear(opciones, origen) {
      usuario = Buffer.from((opciones as unknown as { user: { id: string } }).user.id, "base64url");
      const clavePublica = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]));
      const longitud = Buffer.alloc(2);
      longitud.writeUInt16BE(credencial.length);
      const credencialAtestada = Buffer.concat([Buffer.alloc(16), longitud, credencial, clavePublica]);
      const datos = datosDeAutenticador(opciones.rp.id, BANDERAS.presente | BANDERAS.verificada | BANDERAS.conCredencial, credencialAtestada);
      const atestacion = cbor(new Map<Cbor, Cbor>([["fmt", "none"], ["attStmt", new Map()], ["authData", datos]]));
      return {
        id: b64url(credencial),
        rawId: b64url(credencial),
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(datosDelCliente("webauthn.create", opciones.challenge, origen)),
          attestationObject: b64url(atestacion),
          transports: ["internal"],
        },
      };
    },

    firmar(opciones, origen, verificada = true) {
      const datos = datosDeAutenticador(opciones.rpId, BANDERAS.presente | (verificada ? BANDERAS.verificada : 0));
      const cliente = datosDelCliente("webauthn.get", opciones.challenge, origen);
      const firma = sign("sha256", Buffer.concat([datos, sha256(cliente)]), privateKey);
      return {
        id: b64url(credencial),
        rawId: b64url(credencial),
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        response: { clientDataJSON: b64url(cliente), authenticatorData: b64url(datos), signature: b64url(firma), userHandle: b64url(usuario) },
      };
    },
  };
}
