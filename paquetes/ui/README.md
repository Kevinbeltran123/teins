# ui

Componentes compartidos (base shadcn/ui reestilizada) y tokens de diseño.

**Dependencias:** No depende de ningún otro paquete del monorepo.

**ADR relevantes:** 0011, 0020

Los tokens de tamaño son neutros (`texto-cuerpo`, `tactil`, `fondo`): cada superficie los redefine con `data-superficie` y los componentes no cambian. Una sola familia de letra en toda la interfaz (DESIGN.md).

Iteración 6: `GrupoDeOpciones` (una opción entre pocas, a la vista) y `modoEntrada="numeric"` en `CampoTexto` para códigos de verificación.
Iteración 7: `CampoSeleccion` (lista nativa para elegir entre muchos, como clientes y sitios) y `tipo="date"` en `CampoTexto`.
Iteración 10: `Boceto` dibuja un boceto con los tokens (cuadrícula `division`, tinta `texto`); lo usan la miniatura y el editor de campo y la revisión de oficina.
