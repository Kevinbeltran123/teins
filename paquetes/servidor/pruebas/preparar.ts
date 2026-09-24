import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { migrar } from "../src/plataforma/migrar";

declare module "vitest" {
  export interface ProvidedContext {
    urlApp: string;
    urlPropietario: string;
    s3Endpoint: string;
  }
}

/** Colima expone Docker en otro socket; Testcontainers lo necesita explícito. */
function configurarDocker() {
  const colima = join(homedir(), ".colima", "default", "docker.sock");
  if (!process.env.DOCKER_HOST && existsSync(colima)) {
    process.env.DOCKER_HOST = `unix://${colima}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ??= "/var/run/docker.sock";
  }
}

export const BUCKET_DE_PRUEBA = "archivos-prueba";

export default async function preparar(proyecto: TestProject) {
  configurarDocker();
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
  const { GenericContainer, Wait } = await import("testcontainers");

  const [postgres, s3] = await Promise.all([
    new PostgreSqlContainer("postgres:18-alpine").withDatabase("teins").withUsername("teins_propietario").withPassword("propietario").start(),
    new GenericContainer("adobe/s3mock:latest")
      .withEnvironment({ COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS: BUCKET_DE_PRUEBA })
      .withExposedPorts(9090)
      .withWaitStrategy(Wait.forHttp("/", 9090))
      .start(),
  ]);

  const urlPropietario = postgres.getConnectionUri();
  const admin = new pg.Client({ connectionString: urlPropietario });
  await admin.connect();
  await admin.query(readFileSync(new URL("../infra/roles.sql", import.meta.url), "utf8"));
  await admin.query("ALTER ROLE teins_app PASSWORD 'app'");
  await admin.end();
  await migrar(urlPropietario);

  const urlApp = new URL(urlPropietario);
  urlApp.username = "teins_app";
  urlApp.password = "app";

  proyecto.provide("urlPropietario", urlPropietario);
  proyecto.provide("urlApp", urlApp.toString());
  proyecto.provide("s3Endpoint", `http://${s3.getHost()}:${s3.getMappedPort(9090)}`);

  return async () => {
    await Promise.all([postgres.stop(), s3.stop()]);
  };
}
