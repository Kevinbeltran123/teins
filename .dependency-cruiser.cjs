/**
 * Reglas de arquitectura ejecutables (ADR-0018). Cada regla protege una decisión escrita:
 * si se viola, falla la integración continua. Para cambiar una regla, primero cambie el ADR.
 */
const paquete = (nombre) => `^paquetes/${nombre}/`;

module.exports = {
  forbidden: [
    {
      name: "dominio-puro",
      comment: "dominio es TypeScript puro: no depende de ningún paquete ni de bibliotecas (ADR-0010).",
      severity: "error",
      from: { path: paquete("dominio"), pathNot: "\\.test\\.ts$" },
      to: { pathNot: [paquete("dominio"), "^node:"] },
    },
    {
      name: "protocolo-solo-dominio",
      comment: "protocolo solo depende de dominio y de Zod (ADR-0010).",
      severity: "error",
      from: { path: paquete("protocolo") },
      to: { path: "^paquetes/", pathNot: [paquete("protocolo"), paquete("dominio")] },
    },
    {
      name: "ui-independiente",
      comment: "ui no depende de ningún otro paquete del monorepo.",
      severity: "error",
      from: { path: paquete("ui") },
      to: { path: "^paquetes/", pathNot: paquete("ui") },
    },
    {
      name: "superficies-sin-servidor",
      comment: "Las superficies hablan con el servidor solo por el contrato HTTP de protocolo.",
      severity: "error",
      from: { path: "^paquetes/(campo|oficina|portal)/" },
      to: { path: paquete("servidor") },
    },
    {
      name: "superficies-aisladas",
      comment: "Ninguna superficie importa otra; portal nunca ve oficina ni campo (ADR-0002, QA-4).",
      severity: "error",
      from: { path: "^paquetes/(campo|oficina|portal)/" },
      to: { path: "^paquetes/(campo|oficina|portal)/", pathNot: "^paquetes/$1/" },
    },
    {
      name: "servidor-sin-superficies",
      comment: "El servidor no depende de las superficies ni de ui.",
      severity: "error",
      from: { path: paquete("servidor") },
      to: { path: "^paquetes/(campo|oficina|portal|ui)/" },
    },
    {
      name: "modulos-por-interfaz-publica",
      comment:
        "Un módulo del servidor solo importa la interfaz pública de otro (modulos/<m>/index.ts), nunca sus tablas ni partes internas (ADR-0001).",
      severity: "error",
      from: { path: "^paquetes/servidor/src/modulos/([^/]+)/" },
      to: {
        path: "^paquetes/servidor/src/modulos/([^/]+)/",
        pathNot: ["^paquetes/servidor/src/modulos/$1/", "^paquetes/servidor/src/modulos/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "plataforma-sin-modulos",
      comment: "La plataforma es la base de todos los módulos: no puede depender de ninguno.",
      severity: "error",
      from: { path: "^paquetes/servidor/src/plataforma/" },
      to: { path: "^paquetes/servidor/src/modulos/" },
    },
    {
      name: "sin-ciclos",
      comment: "Un ciclo de dependencias impide separar o reemplazar piezas.",
      severity: "error",
      from: { pathNot: "\\.test\\.tsx?$" },
      to: { circular: true },
    },
    {
      name: "sin-dependencias-no-declaradas",
      comment: "Todo import de una biblioteca debe estar declarado en el package.json de su paquete.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|node_modules|coverage)/|\\.d\\.ts$" },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "types", "default"], extensions: [".ts", ".tsx", ".js", ".json"] },
    tsConfig: { fileName: "tsconfig.base.json" },
  },
};
