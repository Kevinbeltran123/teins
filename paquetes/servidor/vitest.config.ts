import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./pruebas/preparar.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Cada archivo usa sus propias organizaciones: pueden correr en paralelo sobre la misma base.
    fileParallelism: true,
  },
});
