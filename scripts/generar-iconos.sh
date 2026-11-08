#!/usr/bin/env sh
# Genera los íconos de TEINS (pantalla de inicio, pestaña del navegador y avisos) desde el símbolo en vector,
# paquetes/ui/src/simbolo-teins.svg. Necesita rsvg-convert (librsvg: `brew install librsvg`).
# Uso: sh scripts/generar-iconos.sh
set -eu
raiz=$(cd "$(dirname "$0")/.." && pwd)
simbolo="$raiz/paquetes/ui/src/simbolo-teins.svg"
trazos=$(grep -E '<(path|circle)' "$simbolo")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Centro y alto del símbolo dentro de su viewBox (0.95 0.85 82.9 88.3).
centro_x=42.4
centro_y=45
alto=88.3

# $1 archivo, $2 lado en píxeles, $3 parte del lado que ocupa el símbolo, $4 fondo ("none" o un color), $5 "blanco" para
# el símbolo de un solo color (la insignia de Android, que el sistema tiñe).
icono() {
  lado=$(echo "$alto / $3" | bc -l)
  x=$(echo "$centro_x - $lado / 2" | bc -l)
  y=$(echo "$centro_y - $lado / 2" | bc -l)
  dibujo=$trazos
  if [ "${5:-}" = blanco ]; then dibujo=$(echo "$trazos" | sed -E 's/(stroke|fill)="#[0-9A-Fa-f]+"/\1="#FFFFFF"/g'); fi
  fondo=""
  if [ "$4" != none ]; then fondo="<rect x=\"$x\" y=\"$y\" width=\"$lado\" height=\"$lado\" fill=\"$4\"/>"; fi
  cat > "$tmp/icono.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="$x $y $lado $lado" fill="none" stroke-width="5.2" stroke-linecap="round">
$fondo
$dibujo
</svg>
SVG
  rsvg-convert -w "$2" -h "$2" "$tmp/icono.svg" -o "$1"
}

for app in campo oficina portal; do
  publico="$raiz/paquetes/$app/public"
  mkdir -p "$publico"
  # La pestaña del navegador.
  cp "$simbolo" "$publico/favicon.svg"
  # iOS no admite transparencia en el ícono de inicio: fondo blanco, como el logo en papel.
  icono "$publico/apple-touch-icon.png" 180 0.62 "#FFFFFF"
done

# Campo se instala (manifiesto) y avisa; oficina también avisa.
icono "$raiz/paquetes/campo/public/icono-512.png" 512 0.62 "#FFFFFF"
# Android recorta el ícono «maskable» en círculo o en gota: el símbolo cabe en la zona segura (el 80 % del centro).
icono "$raiz/paquetes/campo/public/icono-mascara-512.png" 512 0.5 "#FFFFFF"
for app in campo oficina; do
  # El del manifiesto y el de los avisos.
  icono "$raiz/paquetes/$app/public/icono-192.png" 192 0.62 "#FFFFFF"
  # La insignia de la barra de estado de Android: una sola tinta sobre transparente.
  icono "$raiz/paquetes/$app/public/insignia-96.png" 96 0.9 none blanco
done
