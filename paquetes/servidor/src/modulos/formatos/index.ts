import { and, eq } from "drizzle-orm";
import { validarDefinicionFormato, type VersionFormato } from "@teins/dominio";
import { VersionFormato as EsquemaVersionFormato } from "@teins/protocolo";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { huellaCanonica } from "../../plataforma/canonico";
import { problema } from "../../plataforma/errores";
import { versiones } from "./esquema";

export interface Formatos {
  obtener(tx: TxOrganizacion, formato: string, version: number): Promise<VersionFormato | undefined>;
  /** Publica una versión nueva. Publicar dos veces la misma definición no hace nada; otra con el mismo número es un conflicto. */
  publicar(tx: TxOrganizacion, organizacionId: string, definicion: unknown): Promise<"publicada" | "ya_existia">;
}

/** Interfaz pública del módulo de formatos (ADR-0006). */
export function crearFormatos(): Formatos {
  return {
    async obtener(tx, formato, version) {
      const [fila] = await tx
        .select({ definicion: versiones.definicion })
        .from(versiones)
        .where(and(eq(versiones.formato, formato), eq(versiones.version, version)));
      return fila?.definicion;
    },

    async publicar(tx, organizacionId, entrada) {
      const forma = EsquemaVersionFormato.safeParse(entrada);
      if (!forma.success) {
        const detalle = forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw problema("entrada_invalida", `La definición no cumple el meta-esquema: ${detalle}`);
      }
      const definicion: VersionFormato = forma.data;
      const errores = validarDefinicionFormato(definicion);
      if (errores.length > 0) throw problema("entrada_invalida", errores.join("; "));

      const huella = huellaCanonica(definicion);
      const [insertada] = await tx
        .insert(versiones)
        .values({ organizacionId, formato: definicion.formato, version: definicion.version, definicion, huella })
        .onConflictDoNothing()
        .returning({ huella: versiones.huella });
      if (insertada) return "publicada";

      const [existente] = await tx
        .select({ huella: versiones.huella })
        .from(versiones)
        .where(and(eq(versiones.formato, definicion.formato), eq(versiones.version, definicion.version)));
      // Regla 8: una versión publicada no se modifica.
      if (existente?.huella !== huella) throw problema("conflicto", `La versión ${definicion.version} de ${definicion.formato} ya existe con otro contenido`);
      return "ya_existia";
    },
  };
}
