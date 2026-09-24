import { leerConfig } from "../config";
import { migrar } from "../plataforma/migrar";

const config = leerConfig();
await migrar(config.DATABASE_URL_PROPIETARIO);
console.log("Migraciones aplicadas.");
