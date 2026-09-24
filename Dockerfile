# Imagen única del sistema (ADR-0001, ADR-0016): el mismo contenido corre como rol web
# (por defecto) o como rol worker (`node dist/worker.js`). Portable a cualquier plataforma OCI.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS compilacion
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @teins/campo --filter @teins/oficina build \
 && pnpm --filter @teins/servidor compilar
# Solo el servidor con sus dependencias de producción; dominio y protocolo ya van dentro de dist/.
RUN pnpm --filter @teins/servidor deploy --prod --legacy /app \
 && mkdir -p /app/superficies \
 && cp -r paquetes/campo/dist /app/superficies/campo \
 && cp -r paquetes/oficina/dist /app/superficies/oficina

FROM node:24-alpine AS ejecucion
ENV NODE_ENV=production \
    SUPERFICIES_DIR=/app/superficies \
    PUERTO=3000
WORKDIR /app
COPY --from=compilacion --chown=node:node /app /app
# Sin privilegios: el proceso no puede modificar su propio código.
USER node
EXPOSE 3000
# Antes de cada versión: node dist/cli/migrar.js (ADR-0016, migraciones de expansión).
CMD ["node", "--enable-source-maps", "dist/web.js"]
