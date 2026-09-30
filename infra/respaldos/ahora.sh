#!/bin/bash
# Corre el respaldo ya, sin esperar a las 07:00 UTC (por ejemplo, antes de un simulacro o de una migración
# delicada). Usa el proyecto enlazado: railway link --project teins-produccion
set -euo pipefail
AMBIENTE=$(railway status --json | python3 -c "import json,sys; print(json.load(sys.stdin)['environments']['edges'][0]['node']['id'])")
SERVICIO=$(railway status --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(s['node']['id'] for s in d['services']['edges'] if s['node']['name'] == 'respaldos'))")
INSTANCIA=$(railway api "{ serviceInstance(serviceId: \"$SERVICIO\", environmentId: \"$AMBIENTE\") { id } }" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['serviceInstance']['id'])")
railway api "mutation { deploymentInstanceExecutionCreate(input: { serviceInstanceId: \"$INSTANCIA\" }) }" > /dev/null
echo "Respaldo lanzado. Siga su avance con: railway logs --service respaldos"
