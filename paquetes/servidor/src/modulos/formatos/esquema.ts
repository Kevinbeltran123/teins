import { integer, jsonb, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";
import type { VersionFormato } from "@teins/dominio";
import { aislamientoPorOrganizacion, marcaDeTiempo, organizacionId } from "../../plataforma/esquema-comun";

export const formatos = pgSchema("formatos");

/** Versiones de formato publicadas: inmutables (ADR-0006, regla 8). La aplicación solo inserta y lee. */
export const versiones = formatos.table(
  "versiones",
  {
    organizacionId: organizacionId(),
    formato: text("formato").notNull(),
    version: integer("version").notNull(),
    definicion: jsonb("definicion").$type<VersionFormato>().notNull(),
    /** SHA-256 de la definición canónica: detecta dos definiciones distintas con el mismo número. */
    huella: text("huella").notNull(),
    publicadaEn: marcaDeTiempo("publicada_en").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizacionId, t.formato, t.version] }), aislamientoPorOrganizacion("versiones")],
).enableRLS();
