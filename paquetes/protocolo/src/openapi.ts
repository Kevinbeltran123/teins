import { createDocument } from "zod-openapi";
import type { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { operaciones, type Operacion } from "./operaciones";
import { ESTADO_POR_CODIGO, Problema, TIPO_PROBLEMA } from "./problemas";
import { CABECERA_VERSION, VERSION_PROTOCOLO } from "./version";
import { z } from "zod";

/** Especificación OpenAPI generada desde el catálogo: la documentación no puede desactualizarse (ADR-0014). */
export function documentoOpenApi() {
  const paths: ZodOpenApiPathsObject = {};
  for (const [nombre, op] of Object.entries(operaciones) as [string, Operacion][]) {
    const errores = Object.fromEntries(
      [...new Set(op.errores.map((c) => ESTADO_POR_CODIGO[c]))].map((estado) => [
        String(estado),
        {
          description: op.errores.filter((c) => ESTADO_POR_CODIGO[c] === estado).join(", "),
          content: { [TIPO_PROBLEMA]: { schema: Problema } },
        },
      ]),
    );
    const operacion: ZodOpenApiOperationObject = {
      operationId: nombre,
      summary: op.resumen,
      requestParams: {
        ...(op.parametros ? { path: op.parametros } : {}),
        ...(op.consulta ? { query: op.consulta } : {}),
        ...(op.sincronizacion ? { header: z.object({ [CABECERA_VERSION]: z.string().meta({ example: String(VERSION_PROTOCOLO) }) }) } : {}),
      },
      ...(op.cuerpo ? { requestBody: { content: { "application/json": { schema: op.cuerpo } } } } : {}),
      responses: {
        [String(op.estadoExito)]: { description: "Éxito", content: { "application/json": { schema: op.respuesta } } },
        ...errores,
      },
    };
    paths[op.ruta] = { ...paths[op.ruta], [op.metodo.toLowerCase()]: operacion };
  }
  return createDocument({
    openapi: "3.1.0",
    info: { title: "TEINS", version: `protocolo ${VERSION_PROTOCOLO}` },
    paths,
  });
}
