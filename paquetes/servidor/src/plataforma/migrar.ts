import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { runMigrations } from "graphile-worker";
import { fileURLToPath } from "node:url";
import pg from "pg";

const carpeta = fileURLToPath(new URL("../../migraciones", import.meta.url));

/**
 * Migra con el rol dueño. Primero la cola (sus funciones las usa `cola.encolar`) y después
 * las migraciones del proyecto, cada una en su transacción (ADR-0005).
 */
export async function migrar(urlPropietario: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: urlPropietario, max: 1 });
  pool.on("error", (error) => console.error("Error en la conexión de migraciones", error));
  try {
    await runMigrations({ pgPool: pool });
    await migrate(drizzle(pool), { migrationsFolder: carpeta });
  } finally {
    await pool.end();
  }
}
