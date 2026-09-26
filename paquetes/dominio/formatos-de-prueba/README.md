# Formatos de prueba

Definiciones **ficticias** (R5) para desarrollo y pruebas. El servidor las siembra y la bajada las entrega a `campo` como datos (corte 2). `campo` conserva v1 y v2 solo para la migración de su base local: los borradores de los cortes 0 y 1 no pierden su formato.

- `v1`: el formato del corte 0, sin campos obligatorios. Los borradores creados con él terminan con él (ADR-0006, regla 3).
- `v2`: potencia nominal y fotos del equipo obligatorias. Las claves de campo se conservan entre versiones (regla 4).
- `v3`: igual a v2, con el nombre que ve el técnico. Las versiones anteriores no lo tienen y no se modifican.
- `v4`: v3 más la sección repetible "Tableros" (iteración 9): cada tablero con su ubicación y corriente obligatorias y una foto opcional, de 0 a 10. Exige la app 4 (`appMinima`); una app anterior sigue con v3.
- `v5`: v4 más el campo "Croquis del cuarto" (tipo `boceto`, opcional; iteración 10). Exige la app 5.

Una versión publicada no se modifica: un cambio es una versión nueva.
