import { migrate } from "drizzle-orm/node-postgres/migrator";
import { runMigrations } from "graphile-worker";
import { conectar } from "./base-de-datos";

/**
 * Migra con el rol dueño. Primero la cola (sus funciones las usa `cola.encolar`) y después
 * las migraciones del proyecto, cada una en su transacción (ADR-0005).
 */
export async function migrar(urlPropietario: string, carpeta: string): Promise<void> {
  const { bd, pool, cerrar } = conectar(urlPropietario, 1, (error) => console.error("Error en la conexión de migraciones", error));
  try {
    await runMigrations({ pgPool: pool });
    await migrate(bd, { migrationsFolder: carpeta });
  } finally {
    await cerrar();
  }
}
