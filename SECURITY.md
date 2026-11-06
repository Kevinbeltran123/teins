# Seguridad

## Cómo reportar una vulnerabilidad

No abras un issue ni un pull request: son visibles para todos los que tienen acceso al repositorio.

Escríbele directamente, por un canal privado (correo o mensaje), al responsable del repositorio: el que figura en `.github/CODEOWNERS`. El reporte privado de GitHub solo existe en repositorios públicos.

Incluye qué superficie afecta (campo, oficina, portal, servidor o worker), cómo reproducirlo y qué datos quedan expuestos. No incluyas datos reales de clientes (R5).

## Qué esperar

- Confirmación de recibido en 2 días hábiles.
- Una evaluación de gravedad y un plan en 5 días hábiles.
- El arreglo sale en una versión nueva; el aviso de la versión dice qué se corrigió, sin dar los detalles que permitan explotarlo antes de actualizar.

## Versiones con soporte

Solo la última versión publicada (pestaña **Releases**). Producción se despliega siempre desde una versión (ADR-0056).

## Cómo está protegido

El modelo de amenazas y sus controles están en [`docs/adr/0009-identidad-y-acceso.md`](docs/adr/0009-identidad-y-acceso.md) y en los escenarios de calidad de [`docs/arquitectura/01-impulsores.md`](docs/arquitectura/01-impulsores.md). La integración continua revisa secretos (gitleaks), licencias y vulnerabilidades conocidas en cada cambio.
