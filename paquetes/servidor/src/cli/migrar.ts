import { fileURLToPath } from "node:url";
import { leerConfig } from "../config";
import { migrar } from "../plataforma/migrar";

const config = leerConfig();
// src/cli/ y dist/cli/ están a la misma altura: las migraciones quedan dos niveles arriba en ambos casos.
await migrar(config.DATABASE_URL_PROPIETARIO, fileURLToPath(new URL("../../migraciones", import.meta.url)));
console.log("Migraciones aplicadas.");
