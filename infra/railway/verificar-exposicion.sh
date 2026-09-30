#!/bin/bash
# Verifica qué se alcanza desde internet en el proyecto enlazado (ADR-0016). Solo campo, oficina y portal tienen
# dominio; nada tiene proxy TCP. La base, el worker y los respaldos viven solo en la red privada: .railway/railway.ts
# no declara un proxy para ellos, pero tampoco puede impedir uno creado a mano en el panel de Railway.
# Lo corre montar.sh al final; también se corre solo, con el proyecto enlazado:
#
#   infra/railway/verificar-exposicion.sh
set -euo pipefail

expuestos=0
for servicio in Postgres campo oficina portal worker respaldos; do
  sobra=$(railway variable list --service "$servicio" --json | python3 -c "
import json, sys
variables = json.load(sys.stdin)
publico = ['RAILWAY_TCP_PROXY_DOMAIN'] + ([] if sys.argv[1] in ('campo', 'oficina', 'portal') else ['RAILWAY_PUBLIC_DOMAIN'])
print(' '.join(v for v in publico if v in variables))" "$servicio")
  if [ -n "$sobra" ]; then
    echo "  $servicio se alcanza desde internet ($sobra): quítelo en Settings → Networking"
    expuestos=1
  fi
done
[ "$expuestos" = 0 ] || exit 1
echo "  Solo campo, oficina y portal tienen dominio; ningún servicio tiene proxy TCP"
