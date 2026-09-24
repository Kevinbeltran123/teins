import type { FastifyInstance } from "fastify";
import type { BaseDeDatos } from "../../plataforma/base-de-datos";
import { enOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Archivos } from "../archivos";
import { registrar } from "../auditoria";
import type { Formatos } from "../formatos";
import type { Identidad } from "../identidad";
import { recibirEnvio, type DependenciasEnvio } from "./aplicacion/recibir-envio";
import { detalle, paginaDeEnviados } from "./consultas";
import { repositorioDrizzle } from "./repositorio";

export interface Levantamientos {
  registrarRutas(app: FastifyInstance): void;
}

interface Dependencias {
  bd: BaseDeDatos;
  formatos: Formatos;
  archivos: Archivos;
  identidad: Pick<Identidad, "nombres">;
}

/** Interfaz pública del módulo de levantamientos: núcleo del sistema. */
export function crearLevantamientos({ bd, formatos, archivos, identidad }: Dependencias): Levantamientos {
  const envio: DependenciasEnvio = { bd, repositorio: repositorioDrizzle, formatos, archivos, registrarAuditoria: registrar };

  return {
    registrarRutas(app) {
      registrarOperacion(app, "enviarComando", {
        politica: politicas.tecnico,
        manejar: ({ cuerpo, actor, correlacion }) => recibirEnvio(envio, actor, cuerpo, correlacion),
      });

      registrarOperacion(app, "listarLevantamientos", {
        politica: politicas.oficina,
        manejar: async ({ consulta, actor }) => {
          const { filas, siguienteCursor } = await enOrganizacion(bd, actor.organizacionId, (tx) =>
            paginaDeEnviados(tx, consulta.cursor, consulta.limite),
          );
          const nombres = await identidad.nombres(actor.organizacionId, [...new Set(filas.map((f) => f.tecnicoId))]);
          return {
            elementos: filas.map((f) => ({
              id: f.id,
              formato: f.formato,
              versionFormato: f.versionFormato,
              estado: "enviado" as const,
              tecnico: { id: f.tecnicoId, nombre: nombres.get(f.tecnicoId) ?? "[Usuario no disponible]" },
              recibidoEn: f.recibidoEn.toISOString(),
              fotos: f.cantidadFotos,
            })),
            siguienteCursor,
          };
        },
      });

      registrarOperacion(app, "obtenerLevantamiento", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, actor }) => {
          const resultado = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const fila = await detalle(tx, id);
            if (!fila) return null;
            const definicion = await formatos.obtener(tx, fila.formato, fila.versionFormato);
            return definicion ? { fila, definicion } : null;
          });
          if (!resultado) throw problema("no_encontrado");
          const { fila, definicion } = resultado;
          const nombres = await identidad.nombres(actor.organizacionId, [fila.tecnicoId]);
          return {
            id: fila.id,
            formato: fila.formato,
            versionFormato: fila.versionFormato,
            estado: "enviado" as const,
            tecnico: { id: fila.tecnicoId, nombre: nombres.get(fila.tecnicoId) ?? "[Usuario no disponible]" },
            recibidoEn: fila.recibidoEn.toISOString(),
            fotos: fila.cantidadFotos,
            respuestas: fila.respuestas,
            formatoDefinicion: definicion,
            creadoEnDispositivo: fila.creadoEnDispositivo.toISOString(),
            enviadoEnDispositivo: fila.enviadoEnDispositivo.toISOString(),
          };
        },
      });
    },
  };
}
