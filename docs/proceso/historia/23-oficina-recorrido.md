[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 22 · Campo rehecho con la dirección Recorrido](22-campo-recorrido.md) · Siguiente: [Iteración 24 · Robustez y protección](24-robustez-y-proteccion.md)

# Iteración 23 · Oficina con la identidad Recorrido

**Estado en el mapa al 2026-10-16:** Construida y desplegada en el entorno de pruebas (con la ronda de revisión, 2026-09-29); falta que Kevin la apruebe

**Estado:** construida y verificada en local el 2026-09-27, y desplegada en el entorno de pruebas el 2026-09-29 con la ronda de revisión de código; falta que Kevin la apruebe.

**Para qué:** llevar a oficina la identidad que Kevin aprobó en campo, sin repetir lo que no funcionaba: pantallas llenas de recuadros y listas sin búsqueda.

## Cómo se hizo

1. **Inventario** de las 15 pantallas de oficina: datos, acciones, diálogos y estados, con sus textos exactos.
2. **Prototipo navegable** (`prototipos/oficina/prototipo.html`, https://claude.ai/artifact/XwTGDmPxCJ1wFFpqcBGycX) con tema oscuro y claro, los estados vacío, cargando, error y sin conexión, y los flujos de revisión, informe, cotización y administración.
3. **Corrección de Kevin:** "que en cada módulo haya tantos recuadros resulta agobiante... piensa cómo se puede reorganizar esta información". Se rehízo: primero qué hace la persona en cada pantalla y en qué orden lee, después Mobbin para validar (Stripe, Linear, Xero, Squarespace, Frame.io, entre otras). Cada pantalla del prototipo lo explica.
4. **Detalles que pidió Kevin sobre el prototipo:** impuestos como dos opciones en lista, comentario escrito debajo del dato (sin subir y bajar), búsqueda en todas las listas, y un inicio de sesión con el plano de un cuarto eléctrico dibujado en luz, sin textos de venta.
5. **Construcción módulo por módulo**, comparando cada pantalla de la app con la del prototipo en capturas del mismo tamaño.

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| Cada pantalla igual al prototipo | Capturas lado a lado de inicio de sesión, bandeja, detalle, confirmaciones, visitas, clientes, catálogo, informes, informe, cotizaciones, cotización, administración y mi cuenta |
| El CSS del prototipo, sin estilos en las pantallas (regla 11) | `paquetes/ui/oficina.css`, importado solo por oficina; los componentes compartidos llevan clases gancho que en campo y en el portal no pintan nada |
| La bandeja busca en el servidor | `buscar` opcional en `listarLevantamientos` (cliente y sitio por la interfaz de visitas, técnico por la de identidad, formato en el propio módulo), sin tildes ni mayúsculas; prueba en `revision.test.ts` |
| Sin romper funciones ni el servidor | Las operaciones, validaciones, confirmaciones y textos de error siguen iguales; el protocolo solo ganó dos campos opcionales (`buscar`, `nombreFormato`) |
| Verificación | Tipos, arquitectura y licencias; extremo a extremo en Chromium (21 pruebas) con los selectores del diseño nuevo |

## Decisiones tomadas al construirlo

- El título del detalle es el cliente y el sitio: es lo que oficina reconoce. El estado va junto al título pero fuera del `h1`, así el título se lee solo.
- La acción de la revisión va en el carril, que queda fijo al bajar.
- "Lleva esperando" cuenta días de calendario: "Hoy", "Desde ayer", "3 días"; en ámbar desde dos días.
- Las visitas se agrupan por día; "Hoy" va en la cabecera del día.
- Guardar borrador aparece solo cuando hay cambios; si no, se lee "Todo guardado".
- `Dialogo` ignora un `close` que quedó en cola de un montaje anterior: en desarrollo (StrictMode) cerraba las confirmaciones apenas se abrían.

## Fuera de la iteración 23

- El tema claro: está en el prototipo, pero oficina queda en oscuro como campo.
- El portal del cliente sigue con Consola.

## Al cerrarla

**Oficina con la identidad Recorrido (iteración 23, 2026-09-27).** Kevin pidió llevar a oficina la identidad de campo. Se hizo el prototipo (`prototipos/oficina/prototipo.html`); Kevin rechazó la primera versión por agobiante (todo en recuadros) y se rehízo ordenando primero la información de cada pantalla. Aprobado el prototipo, la app quedó igual a él, pantalla por pantalla, sin tocar funciones: solo se agregó al servidor la búsqueda opcional de la bandeja y el nombre del formato en la lista. Desplegada en el entorno de pruebas el 2026-09-29 con la ronda de revisión de código. Siguiente: que Kevin la revise.

**Revisión de seguridad por áreas (2026-09-29).** Las correcciones de 4a a 4d están hechas, desplegadas en el entorno de pruebas y verificadas allí el 2026-09-29: salud de las tres superficies, cabeceras de seguridad, `verificar-exposicion.sh`, la IP real del cliente en el registro también con un `X-Forwarded-For` falso, respaldo cifrado con simulacro correcto (177 cadenas, 27 archivos) y los 22 del extremo a extremo en Chromium (un archivo por minuto: la suite seguida choca con el límite de ingresos por IP, `entorno-de-pruebas.md`). Las de 4e (campo y portal) están hechas, desplegadas en el entorno de pruebas y verificadas allí el 2026-09-29 con `e2e/pruebas/cierre-de-sesion.spec.ts` (2 de 2 en Chromium): sin otra clave para un técnico con borrado pendiente, cierre de sesión sin señal completado en el servidor al volver la señal, "Salir" del portal que dice si no llegó al servidor, diagnóstico solo con las fotos propias y avisos que solo abren la propia app. Tres hallazgos de 4e no eran errores: el motivo de la visita que ve el cliente se elige de la lista del lenguaje común (Mantenimiento, Cotización, Modificación), las huellas de los archivos a la vista las acepta ADR-0022 y el código del QR no es secreto (ADR-0009, parte 4). **Producción actualizada el 2026-09-29** a esta versión (iteraciones 9 a 23, migraciones 0014 a 0028 y la revisión de seguridad), en este orden: `railway config plan` (7 cambios y 2 borrados, los previstos); `infra/railway/claves-avisos.sh`, nuevo: producción se montó antes de la iteración 15 y su `worker` no tenía el par VAPID, sin el cual `campo` y `oficina` reciben la pública vacía por referencia y la configuración no las deja arrancar ni migrar; `infra/respaldos/clave.sh teins-produccion`; `railway config apply --yes --confirm-destructive` (después, el plan sin diferencias; el redespliegue de la imagen anterior falló en `oficina` y `portal` sin la variable del dueño y Railway dejó la versión que corría, como en pruebas); el despliegue de `campo`, que migró, y después `oficina`, `portal`, `worker` y `respaldos`. Verificado: los cinco en `SUCCESS`, cada superficie con el paquete recién compilado, salud y las 7 cabeceras de seguridad en las tres, `verificar-exposicion.sh`, la IP real en el registro también con `X-Forwarded-For: 203.0.113.77`, el primer respaldo cifrado (los volcados en claro pasaron a `cifrado/`) y el simulacro correcto (`produccion.md`). Los secretos, el `apply` y los despliegues los corrió Kevin: el clasificador de permisos no deja que un agente escriba en producción. En producción no se corre el extremo a extremo (ADR-0021); falta que Kevin entre a oficina con `administracion` y su segundo factor. Siguiente en la ronda de revisión: `/code-review max paquetes/campo`.
