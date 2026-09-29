#!/bin/bash
# Genera la clave que cifra los respaldos (RESPALDOS_CLAVE, infra/respaldos/respaldar.sh) del proyecto enlazado,
# si todavía no tiene. La guarda primero en privado/<proyecto>-respaldos.txt (git lo ignora) y después en el
# servicio `respaldos`, sin mostrarla. Si se pierde el proyecto, esa copia es la única que abre los respaldos:
# guárdela también fuera de este computador. La corre montar.sh; en un entorno que ya existe, se corre sola:
#
#   infra/respaldos/clave.sh teins-produccion
set -euo pipefail

PROYECTO="${1:?Uso: infra/respaldos/clave.sh <proyecto> (el enlazado con railway link)}"
cd "$(dirname "$0")/../.."

# Si la CLI falla (red, sesión), se detiene: tomar el fallo por "no existe" cambiaría una clave en uso, y los
# respaldos cifrados con ella no se podrían leer.
TIENE=$(railway variable list --service respaldos --json | python3 -c "import json,sys; print('si' if 'RESPALDOS_CLAVE' in json.load(sys.stdin) else 'no')" 2> /dev/null) \
  || { echo "  No se pudieron leer las variables de respaldos: no se cambia nada" >&2; exit 1; }
if [ "$TIENE" = si ]; then
  echo "  respaldos.RESPALDOS_CLAVE ya existe: se conserva"
  exit 0
fi

mkdir -p privado
CLAVE=$(openssl rand -base64 32 | tr -d '\n')
( umask 077; printf 'Proyecto %s\nClave de cifrado de los respaldos (RESPALDOS_CLAVE): %s\nSin ella no se puede leer ningún respaldo de teins-respaldos. Guarde una copia fuera de este computador.\n' \
  "$PROYECTO" "$CLAVE" > "privado/${PROYECTO}-respaldos.txt" )
printf '%s' "$CLAVE" | railway variable set RESPALDOS_CLAVE --stdin --service respaldos --skip-deploys > /dev/null
unset CLAVE
echo "  respaldos.RESPALDOS_CLAVE fijada; copia en privado/${PROYECTO}-respaldos.txt"
