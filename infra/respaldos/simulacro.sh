#!/bin/bash
# Simulacro de restauración (ADR-0016, nivel 4). Trae el volcado más reciente del destino de los respaldos,
# lo restaura en un PostgreSQL desechable y comprueba lo que importa: que la base restaura sin errores,
# que las cadenas de la auditoría siguen íntegras y que cada archivo que la base referencia está en la copia.
# Informa el tiempo de restauración y la antigüedad del volcado: el tiempo y el punto de recuperación reales.
#
# Toma las credenciales del destino del servicio `respaldos`, sin mostrarlas:
#   railway run --service respaldos infra/respaldos/simulacro.sh
# Requiere Docker y el repositorio instalado (pnpm install). No toca producción: solo lee la copia.
set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
: "${DESTINO_BUCKET:?Falta DESTINO_BUCKET: ejecútelo con railway run --service respaldos}"
# Bajo el directorio personal: Docker Desktop y Colima lo comparten con los contenedores; /tmp no siempre.
mkdir -p "$HOME/.cache"
TRABAJO=$(mktemp -d "$HOME/.cache/teins-simulacro.XXXXXX")
PG="teins-simulacro-$$"
IMAGEN="teins-respaldos:simulacro"
limpiar() {
  docker rm -f "$PG" > /dev/null 2>&1 || true
  rm -f "$TRABAJO"/*
  rmdir "$TRABAJO"
}
trap limpiar EXIT

docker build -q -t "$IMAGEN" "$RAIZ/infra/respaldos" > /dev/null
destino() {
  docker run --rm --user 0 -v "$TRABAJO:/trabajo" --entrypoint rclone --add-host=host.docker.internal:host-gateway \
    -e RCLONE_CONFIG_DESTINO_TYPE -e RCLONE_CONFIG_DESTINO_PROVIDER -e RCLONE_CONFIG_DESTINO_ENDPOINT \
    -e RCLONE_CONFIG_DESTINO_ACCESS_KEY_ID -e RCLONE_CONFIG_DESTINO_SECRET_ACCESS_KEY -e RCLONE_CONFIG_DESTINO_REGION \
    -e RCLONE_CONFIG_DESTINO_FORCE_PATH_STYLE "$IMAGEN" "$@"
}

# 1. El volcado más reciente, con su huella.
ULTIMO=$(destino lsf "destino:${DESTINO_BUCKET}/base" --include '*.dump' | sort | tail -1)
[ -n "$ULTIMO" ] || { echo "No hay volcados en ${DESTINO_BUCKET}/base"; exit 1; }
destino copy "destino:${DESTINO_BUCKET}/base" /trabajo --include "${ULTIMO}*" > /dev/null
(cd "$TRABAJO" && shasum -a 256 -c "${ULTIMO}.sha256" > /dev/null) || { echo "La huella del volcado no coincide"; exit 1; }
MARCA=${ULTIMO#teins-}
MARCA=${MARCA%.dump}
ANTIGUEDAD_H=$(python3 -c "import datetime as d; t=d.datetime.strptime('$MARCA','%Y%m%dT%H%M%SZ').replace(tzinfo=d.timezone.utc); print(round((d.datetime.now(d.timezone.utc)-t).total_seconds()/3600,1))")

# 2. PostgreSQL desechable con los roles de la aplicación (sus contraseñas no importan aquí).
docker run -d --name "$PG" -e POSTGRES_PASSWORD=simulacro -e POSTGRES_DB=restaurada -p 127.0.0.1::5432 \
  -v "$RAIZ/paquetes/servidor/infra/roles.sql:/roles.sql:ro" -v "$TRABAJO:/trabajo" postgres:18-alpine > /dev/null
until docker exec "$PG" pg_isready -U postgres -d restaurada > /dev/null 2>&1; do sleep 1; done
sleep 2
docker exec "$PG" psql -q -U postgres -d restaurada -v ON_ERROR_STOP=1 -f /roles.sql > /dev/null

# 3. Restaurar, midiendo el tiempo.
INICIO=$(date +%s)
docker exec "$PG" pg_restore -U postgres -d restaurada --no-owner --exit-on-error "/trabajo/${ULTIMO}"
SEGUNDOS=$(( $(date +%s) - INICIO ))
consulta() { docker exec "$PG" psql -U postgres -d restaurada -At -c "$1"; }
docker exec "$PG" psql -q -U postgres -d restaurada -c "analyze" > /dev/null

# 4. Qué hay: filas de las tablas del negocio.
echo "Volcado ${ULTIMO}: ${ANTIGUEDAD_H} h de antigüedad; restaurado en ${SEGUNDOS} s."
consulta "select format('  %-34s %s', schemaname || '.' || relname, n_live_tup) from pg_stat_user_tables
          where schemaname not in ('graphile_worker', 'drizzle') order by 1"

# 5. Cadenas de la auditoría (ADR-0008).
PUERTO=$(docker port "$PG" 5432/tcp | head -1 | sed 's/.*://')
DATABASE_URL="postgresql://postgres:simulacro@127.0.0.1:${PUERTO}/restaurada" pnpm --dir "$RAIZ/paquetes/servidor" --silent verificar-integridad

# 6. Cada archivo que la base referencia está en la copia (fotos y planos verificados, PDF generados).
consulta "select organizacion_id || '/' || huella from archivos.archivos where estado = 'verificado'
          union select organizacion_id || '/' || pdf_huella from informes.versiones where pdf_huella is not null" | sort -u > "$TRABAJO/esperados"
destino lsf -R --files-only "destino:${DESTINO_BUCKET}/archivos" | sort -u > "$TRABAJO/copiados"
FALTANTES=$(comm -23 "$TRABAJO/esperados" "$TRABAJO/copiados" | wc -l | tr -d ' ')
echo "Archivos: $(wc -l < "$TRABAJO/esperados" | tr -d ' ') referenciados, ${FALTANTES} faltantes en la copia."
if [ "$FALTANTES" != "0" ]; then
  comm -23 "$TRABAJO/esperados" "$TRABAJO/copiados" | head -20 | sed 's/^/  falta /'
  exit 1
fi
echo "Simulacro correcto."
