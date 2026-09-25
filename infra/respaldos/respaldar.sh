#!/bin/sh
# Respaldo fuera del proyecto (ADR-0016, nivel 2). Lo ejecuta Railway una vez al día y termina.
#
# 1. Volcado lógico de toda la base (formato personalizado, comprimido), verificado antes de subirlo.
# 2. Los archivos (fotos, planos, PDF) se copian al destino. Están direccionados por su huella y nunca
#    cambian (ADR-0007): se agregan los nuevos y nunca se borra ni se reemplaza nada en el destino.
# 3. Los volcados de más de RETENCION_DIAS se borran; los archivos se conservan siempre.
#
# Variables (docs/proceso/produccion.md): DATABASE_URL (dueño), ORIGEN_BUCKET y DESTINO_BUCKET, y las
# credenciales de rclone RCLONE_CONFIG_ORIGEN_* y RCLONE_CONFIG_DESTINO_*.
set -eu

MARCA=$(date -u +%Y%m%dT%H%M%SZ)
NOMBRE="teins-${MARCA}.dump"
ARCHIVO="/tmp/${NOMBRE}"
RETENCION_DIAS="${RETENCION_DIAS:-35}"

echo "respaldo ${MARCA}: volcado de la base"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$ARCHIVO"
# Un volcado que no se puede leer no es un respaldo.
pg_restore --list "$ARCHIVO" > /dev/null
HUELLA=$(sha256sum "$ARCHIVO" | cut -d' ' -f1)
BYTES=$(wc -c < "$ARCHIVO" | tr -d ' ')

rclone copyto "$ARCHIVO" "destino:${DESTINO_BUCKET}/base/${NOMBRE}" --s3-no-check-bucket
echo "${HUELLA}  ${NOMBRE}" | rclone rcat "destino:${DESTINO_BUCKET}/base/${NOMBRE}.sha256" --s3-no-check-bucket
rm -f "$ARCHIVO"
echo "respaldo ${MARCA}: volcado subido (${BYTES} bytes, sha256 ${HUELLA})"

echo "respaldo ${MARCA}: archivos"
rclone copy "origen:${ORIGEN_BUCKET}" "destino:${DESTINO_BUCKET}/archivos" --immutable --s3-no-check-bucket --stats-one-line --stats 0

rclone delete "destino:${DESTINO_BUCKET}/base" --min-age "${RETENCION_DIAS}d"
echo "respaldo ${MARCA}: listo"
