#!/bin/bash
# Monta un entorno de TEINS en Railway desde cero (ADR-0016, ADR-0021), con lo que el archivo de
# infraestructura (.railway/railway.ts) no puede declarar: secretos, roles de la base, dominios, despliegue,
# copias y la primera persona administradora. Se ejecuta una vez por entorno, desde la raíz del repositorio:
#
#   infra/railway/montar.sh teins-produccion
#
# Ningún secreto aparece en la terminal ni en el historial: se generan aquí y viajan a Railway por la
# entrada estándar. La contraseña de la primera persona administradora queda en privado/, que git ignora.
# Cada paso se puede repetir: lo que ya existe se conserva (secretos incluidos).
set -euo pipefail

PROYECTO="${1:?Uso: infra/railway/montar.sh <proyecto> (teins-produccion o teins-pruebas)}"
RESPALDOS="teins-respaldos"
DESTINO="respaldos-${PROYECTO#teins-}"
ORGANIZACION="${ORGANIZACION:-00000000-0000-4000-8000-000000000001}"
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
cd "$RAIZ"

paso() { printf '\n== %s\n' "$1"; }
existe() { railway variable list --service "$1" --json 2> /dev/null | python3 -c "import json,sys; sys.exit(0 if '$2' in json.load(sys.stdin) else 1)"; }
# Fija un secreto solo si no existe; el valor llega por la entrada estándar, nunca como argumento.
secreto() {
  local servicio=$1 variable=$2 valor=$3
  if existe "$servicio" "$variable"; then echo "  $servicio.$variable ya existe: se conserva"; return; fi
  printf '%s' "$valor" | railway variable set "$variable" --stdin --service "$servicio" --skip-deploys > /dev/null
  echo "  $servicio.$variable fijado"
}
aleatorio() { openssl rand -base64 "$1" | tr -d '\n'; }

paso "1. Destino de los respaldos: proyecto ${RESPALDOS}, almacenamiento ${DESTINO} (otra región)"
railway link --project "$RESPALDOS" > /dev/null 2>&1 || railway init --name "$RESPALDOS" > /dev/null
railway link --project "$RESPALDOS" > /dev/null
railway bucket info --bucket "$DESTINO" > /dev/null 2>&1 || railway bucket create "$DESTINO" --region sjc > /dev/null
# Credenciales del destino a un archivo temporal propio, legible solo por este usuario, y fuera enseguida.
CREDENCIALES=$(mktemp)
chmod 600 "$CREDENCIALES"
trap 'rm -f "$CREDENCIALES"' EXIT
railway bucket credentials --bucket "$DESTINO" --json > "$CREDENCIALES"
campo_de() { python3 -c "import json; print(json.load(open('$CREDENCIALES'))['$1'], end='')"; }

paso "2. Proyecto ${PROYECTO} y sus recursos (.railway/railway.ts)"
railway link --project "$PROYECTO" > /dev/null 2>&1 || railway init --name "$PROYECTO" > /dev/null
railway link --project "$PROYECTO" > /dev/null
railway config apply --yes

paso "3. Secretos"
AUTH=$(aleatorio 32)
for servicio in campo oficina portal worker; do secreto "$servicio" AUTH_SECRETO "$AUTH"; done
unset AUTH
secreto Postgres TEINS_APP_CONTRASENA "$(aleatorio 24 | tr '+/' '-_')"
secreto Postgres TEINS_PORTAL_CONTRASENA "$(aleatorio 24 | tr '+/' '-_')"
secreto respaldos DESTINO_BUCKET "$(campo_de bucketName)"
secreto respaldos RCLONE_CONFIG_DESTINO_ENDPOINT "$(campo_de endpoint)"
secreto respaldos RCLONE_CONFIG_DESTINO_ACCESS_KEY_ID "$(campo_de accessKeyId)"
secreto respaldos RCLONE_CONFIG_DESTINO_SECRET_ACCESS_KEY "$(campo_de secretAccessKey)"

paso "4. Roles de la aplicación en la base (infra/roles.sql), con las contraseñas que ya viven en Postgres"
# Se ejecuta dentro del contenedor de Postgres: las contraseñas se expanden allí, no en esta máquina.
# El SQL viaja en base64 para que ningún shell toque sus `$$`.
SQL=$(base64 < paquetes/servidor/infra/roles.sql | tr -d '\n')
railway ssh -s Postgres -- sh -c "echo $SQL | base64 -d | psql -v ON_ERROR_STOP=1 -q -U \"\$PGUSER\" -d \"\$PGDATABASE\" \
  && psql -v ON_ERROR_STOP=1 -q -U \"\$PGUSER\" -d \"\$PGDATABASE\" \
       -c \"ALTER ROLE teins_app PASSWORD '\$TEINS_APP_CONTRASENA'\" -c \"ALTER ROLE teins_portal PASSWORD '\$TEINS_PORTAL_CONTRASENA'\""

paso "5. Dominios gratuitos de Railway, uno por superficie (ADR-0016)"
for servicio in campo oficina portal; do
  if railway domain list --service "$servicio" 2> /dev/null | grep -q "up.railway.app"; then echo "  $servicio ya tiene dominio"; else railway domain --service "$servicio" --port 3000 > /dev/null; fi
  railway domain list --service "$servicio" 2> /dev/null | grep -o '[a-z0-9.-]*up.railway.app' | head -1 | sed "s/^/  $servicio: https:\/\//"
done

paso "6. Despliegue: campo primero (migra la base), después el resto"
railway up --service campo --ci > /dev/null
for servicio in oficina portal worker; do railway up --service "$servicio" --ci > /dev/null; done
railway up infra/respaldos --path-as-root --service respaldos --ci > /dev/null

paso "7. Copias en la plataforma (ADR-0016, nivel 1): punto en el tiempo y copias del volumen"
railway postgres pitr status --service Postgres | grep -q "Status:.*enabled" || railway postgres pitr enable --service Postgres
railway postgres pitr schedule set --service Postgres --daily --weekly --monthly > /dev/null

paso "8. Primera persona administradora (debe activar su segundo factor al entrar a Administración)"
mkdir -p privado
if [ ! -f "privado/${PROYECTO}.txt" ]; then
  CONTRASENA=$(aleatorio 18)
  railway ssh -s campo -- env TEINS_CONTRASENA="$CONTRASENA" node dist/cli/crear-usuario.js --organizacion "$ORGANIZACION" --usuario administracion --nombre "Administración TEINS" --rol oficina > /dev/null
  railway ssh -s campo -- node dist/cli/marcar-administrador.js --usuario administracion > /dev/null
  printf 'Proyecto %s\nUsuario: administracion\nContraseña: %s\n' "$PROYECTO" "$CONTRASENA" > "privado/${PROYECTO}.txt"
  chmod 600 "privado/${PROYECTO}.txt"
  unset CONTRASENA
  echo "  Usuario administracion creado; su contraseña está en privado/${PROYECTO}.txt"
else
  echo "  privado/${PROYECTO}.txt ya existe: la primera persona administradora ya se creó"
fi

paso "Listo. Siguiente: el primer respaldo y el simulacro (docs/proceso/produccion.md)"
