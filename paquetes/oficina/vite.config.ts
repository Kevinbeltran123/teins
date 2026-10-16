import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { ARCHIVO_FUENTE, ESTILOS_COTIZACION, ESTILOS_INFORME, hojaDeLaVista, RUTA_DOCUMENTOS } from "@teins/documentos";

const api = process.env.TEINS_API ?? "http://localhost:3000";

/**
 * La vista en vivo de los documentos (ADR-0031) enlaza sus estilos y su fuente como archivos de oficina, porque la
 * CSP solo admite estilos del propio origen. Salen de las mismas plantillas que imprime el servidor; en desarrollo
 * se sirven y en la compilación quedan en dist/documentos/.
 */
function documentos(): Plugin {
  const fuente = createRequire(import.meta.url).resolve("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");
  const archivos = (): Record<string, string | Buffer> => ({
    "informe.css": hojaDeLaVista("informe", ESTILOS_INFORME),
    "cotizacion.css": hojaDeLaVista("cotizacion", ESTILOS_COTIZACION),
    [ARCHIVO_FUENTE]: readFileSync(fuente),
  });
  return {
    name: "teins-documentos",
    configureServer(servidor) {
      servidor.middlewares.use(RUTA_DOCUMENTOS, (solicitud, respuesta, siguiente) => {
        const nombre = (solicitud.url ?? "").slice(1).split("?")[0] ?? "";
        const contenido = archivos()[nombre];
        if (contenido === undefined) return siguiente();
        respuesta.setHeader("content-type", nombre.endsWith(".css") ? "text/css; charset=utf-8" : "font/woff2");
        respuesta.end(contenido);
      });
    },
    generateBundle() {
      for (const [nombre, contenido] of Object.entries(archivos())) this.emitFile({ type: "asset", fileName: `${RUTA_DOCUMENTOS.slice(1)}/${nombre}`, source: contenido });
    },
  };
}

// Oficina trabaja en línea: su service worker (public/avisos-sw.js) solo muestra avisos, sin caché (ADR-0002, ADR-0023).
// Mismo origen para la API (ADR-0016).
export default defineConfig({
  plugins: [react(), tailwindcss(), documentos()],
  server: { port: 5174, strictPort: true, proxy: { "/api": api } },
  preview: { port: 5174, strictPort: true, proxy: { "/api": api } },
});
