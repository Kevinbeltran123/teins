# Formatos de prueba

Definiciones **ficticias** (R5) para desarrollo y pruebas. El servidor las siembra y la bajada las entrega a `campo` como datos (corte 2). `campo` conserva v1 y v2 solo para la migración de su base local: los borradores de los cortes 0 y 1 no pierden su formato.

- `v1`: el formato del corte 0, sin campos obligatorios. Los borradores creados con él terminan con él (ADR-0006, regla 3).
- `v2`: potencia nominal y fotos del equipo obligatorias. Las claves de campo se conservan entre versiones (regla 4).
- `v3`: igual a v2, con el nombre que ve el técnico. Las versiones anteriores no lo tienen y no se modifican.
- `v4`: v3 más la sección repetible "Tableros" (iteración 9): cada tablero con su ubicación y corriente obligatorias y una foto opcional, de 0 a 10. Exige la app 4 (`appMinima`); una app anterior sigue con v3.
- `v5`: v4 más el campo "Croquis del cuarto" (tipo `boceto`, opcional; iteración 10). Exige la app 5.
- `v6`: v5 más el campo "Materiales" (tipo `cantidades` en unidades `und` y `m`, opcional; iteración 11). Exige la app 6.
- `v7`: v6 más la sección "Cierre de la visita" con "Firma de quien recibe la visita" (tipo `firma`, opcional para no obligar a firmar en cada prueba; iteración 16). Exige la app 7.

Una versión publicada no se modifica: un cambio es una versión nueva.

`simbolos-prueba.json`: biblioteca **ficticia** de 21 símbolos de los bocetos (iteración 19, ADR-0027) en tres categorías (Energía, Datos, Obra), dibujados en una caja de 100 × 100, hasta tener la lista de TEINS. Los ids son fijos: volver a publicarla no duplica nada. Se publica con `pnpm publicar-simbolos` y `sembrar` la publica en la organización de desarrollo.
- `v8`: el formato del rediseño Recorrido (iteración 22). Suma la sección "Llegada" (fotos de fachada y acceso, quién recibe), valores comunes que se eligen con un toque (potencia, ubicación, corriente, circuitos), fotos por puesto con nombre, el campo "Circuitos" en cada tablero y el título "Firma del cliente" para la sección de cierre. "Materiales" y "Croquis" pasan a ser secciones propias, en el orden de la visita; las claves de campo de v7 se conservan. Exige la app 11.
- `v9`: v8 con la sección "Llegada" marcada `soloEmpresa` (ADR-0039): sus fotos son para que la empresa verifique la visita y no salen en el informe del cliente salvo que oficina las muestre. Exige la app 11, como v8.
