import { randomUUID } from "node:crypto";
import { afterAll, inject } from "vitest";
import { leerConfig, type Config } from "../src/config";
import { conectar, type Conexion } from "../src/plataforma/base-de-datos";
import { BUCKET_DE_PRUEBA } from "./preparar";

/** Conexiones con el rol de la aplicación y con el dueño; se cierran al terminar el archivo. */
export function conexionesDePrueba(): { app: Conexion; propietario: Conexion } {
  const app = conectar(inject("urlApp"), 5);
  const propietario = conectar(inject("urlPropietario"), 2);
  afterAll(async () => {
    await Promise.all([app.cerrar(), propietario.cerrar()]);
  });
  return { app, propietario };
}

export function configDePrueba(extra: Partial<Record<string, string>> = {}): Config {
  return leerConfig({
    NODE_ENV: "test",
    NIVEL_REGISTRO: "silent",
    DATABASE_URL: inject("urlApp"),
    DATABASE_URL_PROPIETARIO: inject("urlPropietario"),
    S3_ENDPOINT: inject("s3Endpoint"),
    S3_REGION: "us-east-1",
    S3_BUCKET: BUCKET_DE_PRUEBA,
    S3_ACCESS_KEY_ID: "prueba",
    S3_SECRET_ACCESS_KEY: "prueba",
    S3_FORZAR_RUTA: "true",
    AUTH_SECRETO: "secreto-de-prueba-que-no-es-real-0123456789",
    ORIGENES_CONFIABLES: "http://localhost:5173,http://localhost:5174",
    ...extra,
  });
}

/** Crea una organización nueva: cada prueba trabaja aislada sin limpiar la base. */
export async function nuevaOrganizacion(propietario: Conexion, nombre = "Organización de prueba"): Promise<string> {
  const id = randomUUID();
  await propietario.pool.query("insert into identidad.organizaciones (id, nombre) values ($1, $2)", [id, nombre]);
  return id;
}
