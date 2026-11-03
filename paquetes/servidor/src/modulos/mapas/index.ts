import type { FastifyInstance } from "fastify";
import { coordenadaParaMapa } from "@teins/dominio";
import type { Config } from "../../config";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";

/*
  La foto de llegada (ADR-0052). El servidor da la «hora de red» y el mapa: Geoapify (OpenStreetMap) por medio de este
  módulo, que redondea las coordenadas a 3 decimales (unos 110 m) antes de pedirlo, así el servicio nunca conoce el punto
  exacto; la llave nunca sale del servidor; y las coordenadas no se registran en ningún log. El pin exacto lo dibuja campo.
*/

/** Estilo, zoom y tamaño del mapa: 400 × 400 a escala 2 (800 × 800), sin marcador. */
const ESTILO = "osm-bright";
const ZOOM = 16;
const LADO = 400;
/** Lo que exige Geoapify y OpenStreetMap: va dentro del mapa, con la dirección escrita porque una foto no lleva enlaces. */
const ATRIBUCION = "Powered by Geoapify · © OpenMapTiles · © OpenStreetMap contributors\nopenstreetmap.org/copyright";

const POR_MINUTO = 30;
/** El mapa es un complemento: no se espera más de lo que campo espera por él (3 segundos en total). */
const ESPERA_MS = 2_500;


export interface Mapas {
  registrarRutas(app: FastifyInstance): void;
}

export function crearMapas({ config }: { config: Pick<Config, "GEOAPIFY_LLAVE" | "GEOAPIFY_URL"> }): Mapas {
  // Ventana deslizante de un minuto por técnico. El rol web es uno solo, así que la cuenta vive aquí.
  const usos = new Map<string, number[]>();
  function limitar(usuarioId: string) {
    const ahora = Date.now();
    const recientes = (usos.get(usuarioId) ?? []).filter((t) => ahora - t < 60_000);
    if (recientes.length >= POR_MINUTO) {
      usos.set(usuarioId, recientes);
      throw problema("demasiadas_solicitudes", "Demasiados mapas en un minuto: la foto sale sin mapa.", { reintentarEnSegundos: Math.ceil((60_000 - (ahora - recientes[0]!)) / 1000) });
    }
    usos.set(usuarioId, [...recientes, ahora]);
    // La memoria no crece con técnicos que ya no piden.
    if (usos.size > 1000) for (const [id, marcas] of usos) if (marcas.every((t) => ahora - t >= 60_000)) usos.delete(id);
  }

  return {
    registrarRutas(app) {
      registrarOperacion(app, "horaDelServidor", {
        politica: politicas.tecnico,
        manejar: async () => ({ ahora: new Date().toISOString() }),
      });

      registrarOperacion(app, "mapaDeLlegada", {
        politica: politicas.tecnico,
        manejar: async ({ consulta, actor }) => {
          limitar(actor.usuarioId);
          if (!config.GEOAPIFY_LLAVE) throw problema("no_disponible", "Este entorno no tiene mapa: la foto sale sin él.");
          const centro = { lat: coordenadaParaMapa(consulta.lat), lon: coordenadaParaMapa(consulta.lon) };
          const url = new URL("/v1/staticmap", config.GEOAPIFY_URL);
          url.search = new URLSearchParams({
            style: ESTILO,
            width: String(LADO),
            height: String(LADO),
            center: `lonlat:${centro.lon},${centro.lat}`,
            zoom: String(ZOOM),
            scaleFactor: "2",
            format: "jpeg",
            apiKey: config.GEOAPIFY_LLAVE,
          }).toString();
          let tipo: string;
          let imagen: Buffer;
          try {
            // El tiempo cuenta hasta leer toda la imagen, no solo la cabecera.
            const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
            tipo = respuesta.headers.get("content-type") ?? "";
            if (!respuesta.ok || !/^image\/(jpeg|png)/.test(tipo)) throw new Error("respuesta sin imagen");
            imagen = Buffer.from(await respuesta.arrayBuffer());
          } catch {
            // Sin el error original: su mensaje podría traer la dirección con la llave y las coordenadas.
            throw problema("no_disponible", "El mapa no respondió: la foto sale sin él.");
          }
          return { imagen: `data:${tipo.split(";")[0]};base64,${imagen.toString("base64")}`, centro, zoom: ZOOM, atribucion: ATRIBUCION };
        },
      });
    },
  };
}
