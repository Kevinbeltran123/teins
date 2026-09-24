import { stat } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import type { FastifyInstance, RouteHandlerMethod } from "fastify";
import fastifyStatic from "@fastify/static";
import { problema } from "./errores";
import { registrarRutaPublica } from "./rutas";

export interface Superficie {
  /** Nombre de host sin puerto: `campo.teins.example`. */
  host: string;
  /** Carpeta con la compilación de la superficie (index.html, assets/). */
  carpeta: string;
}

/** Nombres con huella de contenido: nunca cambian, se cachean un año. */
const esInmutable = (ruta: string) => ruta.startsWith("assets/");

async function esArchivo(ruta: string): Promise<boolean> {
  try {
    return (await stat(ruta)).isFile();
  } catch {
    return false;
  }
}

/**
 * Sirve cada superficie en su propio host con la API en el mismo origen (ADR-0016): sin CORS y con
 * cookies aisladas por superficie. index.html, sw.js y el manifiesto no se cachean, así una versión
 * nueva siempre llega (ADR-0015); lo que está en assets/ tiene huella en el nombre y se cachea un año.
 */
export async function servirSuperficies(app: FastifyInstance, superficies: readonly Superficie[]): Promise<void> {
  const porHost = new Map(superficies.map((s) => [s.host.toLowerCase(), resolve(s.carpeta)]));
  // Solo se usa reply.sendFile: las rutas las registra esta función, con su política declarada.
  // cacheControl apagado: la política de caché la decide esta función, no la biblioteca.
  await app.register(fastifyStatic, { root: [...porHost.values()], serve: false, cacheControl: false });

  const manejar: RouteHandlerMethod = async (solicitud, respuesta) => {
    // Una ruta /api desconocida es un 404 del contrato, nunca la aplicación.
    if (solicitud.url.startsWith("/api/") || solicitud.url === "/api") throw problema("no_encontrado", "La ruta no existe");
    const carpeta = porHost.get(solicitud.hostname.toLowerCase());
    if (!carpeta) throw problema("no_encontrado", "Superficie desconocida");

    const pedida = decodeURIComponent((solicitud.params as { "*"?: string })["*"] ?? "");
    const relativa = normalize(pedida).replace(/^([/\\])+/, "");
    const completa = join(carpeta, relativa);
    if (isAbsolute(relativa) || !(completa === carpeta || completa.startsWith(carpeta + sep))) throw problema("no_encontrado");

    if (relativa !== "" && relativa !== "." && (await esArchivo(completa))) {
      respuesta.header("cache-control", esInmutable(relativa) ? "public, max-age=31536000, immutable" : "no-cache");
      return respuesta.sendFile(relativa, carpeta);
    }
    // Rutas de la aplicación (/levantamientos/…): las resuelve el enrutador del navegador.
    if (extname(relativa) === "") {
      respuesta.header("cache-control", "no-cache");
      return respuesta.sendFile("index.html", carpeta);
    }
    throw problema("no_encontrado");
  };

  for (const url of ["/", "/*"]) {
    registrarRutaPublica(app, { method: "GET", url, motivo: "Archivos estáticos de las superficies: no contienen datos", handler: manejar });
  }
}
