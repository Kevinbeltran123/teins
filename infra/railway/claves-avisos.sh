#!/bin/bash
# Genera el par VAPID de los avisos push (ADR-0023) del proyecto enlazado, si el worker todavía no lo tiene, y lo
# guarda en el worker sin mostrarlo; campo y oficina leen la pública por referencia (.railway/railway.ts). Nunca
# reemplaza un par que ya existe: las suscripciones de los navegadores quedan atadas a la clave pública. La corre
# montar.sh; en un entorno montado antes de los avisos, se corre sola (necesita pnpm con Node 24):
#
#   infra/railway/claves-avisos.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

# Si la CLI falla (red, sesión), se detiene: tomar el fallo por "no existe" cambiaría un par en uso.
TIENE=$(railway variable list --service worker --json | python3 -c "import json,sys; print('si' if 'AVISOS_VAPID_PRIVADA' in json.load(sys.stdin) else 'no')" 2> /dev/null) \
  || { echo "  No se pudieron leer las variables del worker: no se cambia nada" >&2; exit 1; }
if [ "$TIENE" = si ]; then
  echo "  worker.AVISOS_VAPID_PRIVADA ya existe: se conserva el par"
  exit 0
fi

CLAVES=$(pnpm --silent --filter @teins/servidor generar-claves-avisos)
PUBLICA=$(printf '%s\n' "$CLAVES" | sed -n 's/^AVISOS_VAPID_PUBLICA=//p')
PRIVADA=$(printf '%s\n' "$CLAVES" | sed -n 's/^AVISOS_VAPID_PRIVADA=//p')
unset CLAVES
[ -n "$PUBLICA" ] && [ -n "$PRIVADA" ] || { echo "  generar-claves-avisos no devolvió el par: no se cambia nada" >&2; exit 1; }
# Las dos juntas: una pública sin su privada (o al revés) deja los avisos rotos sin que nada falle al arrancar.
printf '%s' "$PUBLICA" | railway variable set AVISOS_VAPID_PUBLICA --stdin --service worker --skip-deploys > /dev/null
printf '%s' "$PRIVADA" | railway variable set AVISOS_VAPID_PRIVADA --stdin --service worker --skip-deploys > /dev/null
unset PUBLICA PRIVADA
echo "  worker.AVISOS_VAPID_PUBLICA y AVISOS_VAPID_PRIVADA fijadas"
