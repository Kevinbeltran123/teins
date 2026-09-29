#!/bin/sh
# Respaldo fuera del proyecto (ADR-0016, nivel 2). Lo ejecuta Railway una vez al día y termina.
#
# 1. Volcado lógico de toda la base (formato personalizado, comprimido), verificado antes de subirlo.
# 2. Los archivos (fotos, planos, PDF) se copian al destino. Están direccionados por su huella y nunca
#    cambian (ADR-0007): se agregan los nuevos y nunca se borra ni se reemplaza nada en el destino.
# 3. Los volcados de más de RETENCION_DIAS se borran; los archivos se conservan siempre.
#
# Todo sale cifrado con RESPALDOS_CLAVE (rclone crypt): quien lea el destino sin la clave no ve datos de los
# clientes. La clave tiene una copia fuera de Railway (montar.sh); sin ella no se restaura nada.
#
# Variables (docs/proceso/produccion.md): DATABASE_URL (dueño), ORIGEN_BUCKET, DESTINO_BUCKET, RESPALDOS_CLAVE y
# las credenciales de rclone RCLONE_CONFIG_ORIGEN_* y RCLONE_CONFIG_DESTINO_*.
set -eu

: "${RESPALDOS_CLAVE:?Falta RESPALDOS_CLAVE: sin ella el respaldo saldría sin cifrar}"
MARCA=$(date -u +%Y%m%dT%H%M%SZ)
NOMBRE="teins-${MARCA}.dump"
ARCHIVO="/tmp/${NOMBRE}"
RETENCION_DIAS="${RETENCION_DIAS:-35}"

# El destino cifrado vive en cifrado/ dentro del almacenamiento. Los nombres quedan legibles (fechas y huellas,
# sin datos de nadie): así se ve desde el panel que cada día hay un respaldo.
export RCLONE_CONFIG_CIFRADO_TYPE=crypt
export RCLONE_CONFIG_CIFRADO_REMOTE="destino:${DESTINO_BUCKET}/cifrado"
export RCLONE_CONFIG_CIFRADO_FILENAME_ENCRYPTION=off
export RCLONE_CONFIG_CIFRADO_DIRECTORY_NAME_ENCRYPTION=false
RCLONE_CONFIG_CIFRADO_PASSWORD=$(printf '%s' "$RESPALDOS_CLAVE" | rclone obscure -)
export RCLONE_CONFIG_CIFRADO_PASSWORD

# Una sola vez: lo que se copió antes sin cifrar (base/ y archivos/ en la raíz del destino) pasa a la copia
# cifrada y sale de la raíz. Desde entonces no hay nada que mover.
for anterior in base archivos; do
  if rclone lsf "destino:${DESTINO_BUCKET}" --dirs-only --s3-no-check-bucket | grep -qx "${anterior}/"; then
    echo "respaldo ${MARCA}: se cifra la copia anterior de ${anterior}/"
    rclone move "destino:${DESTINO_BUCKET}/${anterior}" "cifrado:${anterior}" --size-only --s3-no-check-bucket --stats 0
  fi
done

echo "respaldo ${MARCA}: volcado de la base"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$ARCHIVO"
# Un volcado que no se puede leer no es un respaldo.
pg_restore --list "$ARCHIVO" > /dev/null
HUELLA=$(sha256sum "$ARCHIVO" | cut -d' ' -f1)
BYTES=$(wc -c < "$ARCHIVO" | tr -d ' ')

rclone copyto "$ARCHIVO" "cifrado:base/${NOMBRE}" --s3-no-check-bucket
echo "${HUELLA}  ${NOMBRE}" | rclone rcat "cifrado:base/${NOMBRE}.sha256" --s3-no-check-bucket
rm -f "$ARCHIVO"
echo "respaldo ${MARCA}: volcado subido (${BYTES} bytes, sha256 ${HUELLA})"

echo "respaldo ${MARCA}: archivos"
# Cifrado, el destino no tiene la huella del contenido: se compara el tamaño. Basta porque la llave de cada
# archivo es su huella (ADR-0007): la misma llave es el mismo contenido. --immutable nunca reemplaza nada.
rclone copy "origen:${ORIGEN_BUCKET}" "cifrado:archivos" --immutable --size-only --s3-no-check-bucket --stats-one-line --stats 0

rclone delete "cifrado:base" --min-age "${RETENCION_DIAS}d"
echo "respaldo ${MARCA}: listo"
