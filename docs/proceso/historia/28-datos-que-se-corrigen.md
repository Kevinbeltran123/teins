[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 27 · Flujos](27-flujos.md) · Siguiente: [Iteraciones 29 a 31 · Ajustes de oficina, el correo que escribe oficina y visitas con horario](29-ajustes-de-oficina-correo-y-horario.md)

# Iteración 28 · Datos que se corrigen

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas y en producción (2026-10-02); falta que Kevin la pruebe

**Estado:** prototipo aprobado por Kevin el 2026-10-02 (`prototipos/correcciones/prototipo.html`, https://claude.ai/artifact/5zrTMQo97hoNsoWUmxKwyN: "Dale, empieza la implementacion") con sus seis decisiones; construida y verificada en local el mismo día, y desplegada en el entorno de pruebas desde el commit 1eff68c. Kevin pidió llevarla a producción de una vez ("despliega en todo lado de una vez"). En producción el 2026-10-02 desde el commit 1eff68c: Kevin corrió las escrituras (mi permiso ya no admite desplegar ahí); respaldo `20261002T174223Z` listo antes, `campo` primero (aplicó la `0032`) y después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-De-fAUDX.js`), la ruta para archivar un cliente sin sesión 401, las mismas 8 cabeceras de seguridad que el entorno de pruebas y `verificar-exposicion.sh`. Falta que Kevin la pruebe y el extremo a extremo contra el entorno de pruebas, que corre él.

**Para qué (ADR-0034 y ADR-0035):** que un error se corrija en el lapso en que todavía se puede, sin borrar historia ni tocar lo publicado. Un envío equivocado se detiene mientras espera en la cola; una cotización mal publicada deja de valer; un cliente, un sitio o un comentario se corrigen o se archivan; y el técnico quita de su teléfono un levantamiento empezado por error sin perderlo de una vez.

## Alcance

- **Cancelar un envío en cola** (decisión 1, ADR-0034): "Cancelar" junto al envío `en_cola`, en las versiones del informe y de la cotización y en el avance de publicar, sin confirmar y con "Deshacer" en la notificación mientras siga en cola. El envío cancelado queda tachado con quién y cuándo ("cancelado por … : no sale"). Estado nuevo `cancelado` con `cancelado_por` y `cancelado_en`. Si ya salió, la app lo dice ("ya salió"). Operaciones `cancelarEnvio`, `reanudarEnvio`, `cancelarEnvioDeCotizacion` y `reanudarEnvioDeCotizacion`; reanudar no se ofrece en una versión retirada ni si el PDF falló.
- **Retirar una versión de cotización** (decisión 2): "Retirar versión" solo en la vigente y solo para quien administra, con motivo obligatorio y confirmación irreversible. La versión y su PDF se conservan; la anterior no retirada pasa a vigente, o la cotización queda "Sin versión vigente" (también en la lista). Sus envíos en cola se cancelan y una versión retirada no se vuelve a enviar. Evento `version_retirada`.
- **Corregir clientes y sitios** (decisiones 3 y 4, ADR-0035): "Editar" (hoja lateral) para el nombre del cliente y "Editar sitio" para el nombre y la dirección; el encabezado dice "Cambiado por … · fecha" y la auditoría guarda el valor anterior y el nuevo. "Archivar cliente" y "Archivar sitio" son confirmaciones con consecuencias; con visitas por hacer no se archiva y el diálogo dice cuáles (fecha, sitio y técnicos) con "Ver las visitas". Clientes tiene las pestañas "Activos" y "Archivados", con quién archivó, cuándo y "Recuperar". Un cliente archivado sale de las listas, de "Programar visita" y deja de recibir envíos (`paraEnviar` y `sigueRecibiendo`); no se le agregan sitios ni visitas. Archivar un sitio se deshace desde la notificación.
- **Corregir un comentario** (decisión 5): en el carril, "⋯" en el comentario propio con "Editar" (en su lugar) y "Borrar" (al instante, queda "Comentario retirado por … " con "Deshacer"), solo su autor y hasta que el levantamiento esté Revisado. Editar deja "Editado …". El técnico deja de ver lo retirado y ve la última versión en la siguiente bajada, con "· Editado". Los retirados no cuentan en la pestaña, en la fila del dato ni en la confirmación de "Marcar revisado". El historial dice "Editó su comentario" con el texto anterior y el nuevo, "Retiró" y "Restauró".
- **Descartar un levantamiento en campo** (decisión 6): "Descartar levantamiento" al final del recorrido, solo en un borrador nunca enviado, con confirmación irreversible que dice qué pasa con el trabajo y cuántas fotos tiene. Pasa a "Descartados", en "Tu cuenta", con la fecha en que se borra; "Recuperar" lo devuelve tal como estaba, o como levantamiento suelto si su visita ya tiene otro borrador. A los 30 días se borra con las fotos que nada más usa (al iniciar sesión). El servidor no se entera (ADR-0035).
- **Migración `0032_correcciones`:** las columnas de cada corrección y los `GRANT UPDATE` por columna para `teins_app`. En campo, `descartadoEn` es un campo visible del registro (no va sellado), así que Dexie no cambia de versión.

## Fuera de la iteración 28

| Qué | Cuándo |
|---|---|
| Una pantalla con el historial de cambios de un cliente (hoy, el último cambio en el encabezado y el registro completo en la auditoría) | Si oficina lo pide |
| Vaciar la papelera antes de los 30 días cuando el diagnóstico avisa de poco espacio (ADR-0035, mitigación) | Con la próxima iteración que toque el diagnóstico |
| Soltar, reabrir y devolver una revisión (ADR-0032, aplazado) | Cuando Kevin lo decida |
| La prueba en el iPhone de "Descartar" y "Descartados" | Con la prueba en iPhone de las fases 9 a 19 |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Pendiente: Kevin lo compara con el prototipo en el entorno de pruebas |
| 2. La carrera entre cancelar y mandar | `envios.test.ts`, "cancelar un envío en cola (ADR-0034)": cancelar mientras el worker procesa; gana quien llega primero a la fila (el worker marca `enviado_en` antes de salir y cancelar exige `enviado_en IS NULL`) |
| 3. Pruebas del servidor | `envios.test.ts` y `cotizaciones.test.ts` (cancelar, reanudar y retirar), `visitas.test.ts` ("corregir clientes y sitios (ADR-0035)": archivar bloqueado, el único sitio, sin envíos al archivado) y `revision.test.ts` ("corregir un comentario (ADR-0035)": solo su autor, no en Revisado, el técnico deja de verlo) |
| 4. Campo | `repositorio.test.ts`: descartar solo lo nunca enviado, recuperar como suelto si la visita ya tiene otro borrador, vaciar a los 30 días con las fotos que nada más usa |
| 5. Recorridos de punta a punta | `correcciones.spec.ts` (oficina corrige un cliente; el técnico descarta y recupera) y `revision.spec.ts` (editar y borrar un comentario) |
| 6. Verificación completa en local | Typecheck, arquitectura, licencias, auditoría (sin vulnerabilidades), pruebas de paquetes (dominio 111, documentos 6, protocolo 25, oficina 11, campo 88, servidor 207: una de la iteración 26, el estado de un plano, falló una vez en la corrida completa por una carrera con la cola y pasó tres veces seguidas sola), presupuesto de campo (129,3 de 135 KB) y el extremo a extremo completo: 100 pasan, 3 se saltan y 1 falla, `administracion.spec` en WebKit, por la base local con miles de usuarios (como en la iteración 27; pasa en el entorno de pruebas) |
| 7. Desplegada en el entorno de pruebas | 2026-10-02, desde el commit 1eff68c (subido a GitHub). `campo` primero (aplicó la `0032`: "Migraciones aplicadas"), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: salud 200 en las tres superficies, la misma compilación de oficina que la local (`index-De-fAUDX.js`), `POST /api/clientes/{id}/archivar` sin sesión 401 y `verificar-exposicion.sh`. El extremo a extremo contra el entorno lo corre Kevin (crea datos ficticios allí y mi permiso no lo admite) |

## Decisiones tomadas al construirlo

- **No se archiva el único sitio activo de un cliente activo.** Sin sitio no se le programa nada, y para eso está archivar el cliente. El diálogo lo dice en lugar de ofrecer la confirmación; el servidor también lo rechaza.
- **Cancelar y mandar se resuelven en la fila.** Cancelar es `UPDATE … WHERE estado = 'en_cola' AND enviado_en IS NULL`; el worker marca `enviado_en` con `WHERE estado = 'en_cola'` antes de llamar al proveedor. El que llega primero gana y el otro ve que la fila ya cambió: no hace falta un bloqueo aparte.
- **Reanudar vuelve a encolar el envío solo si el PDF está listo;** si todavía se está generando, el trabajo del PDF lo encola al terminar, como a los demás.
- **Clientes no importa Visitas:** "visitas por hacer" llega como una función que `app.ts` le pasa al registrar sus rutas (`visitas.porHacer`), porque Visitas ya depende de Clientes y la frontera no admite el ciclo. "Por hacer" es no cancelada y programada de hoy en adelante, en la hora de Colombia.
- **Editar un sitio también marca el cliente como cambiado,** para que el encabezado diga el último cambio de cualquiera de los dos.
- **Archivar un sitio no pide la pestaña de archivados:** se queda en la lista del cliente con la insignia "Archivado" y "Recuperar", porque un cliente tiene pocos sitios.
- **Los errores de clientes y sitios dicen lo que dice el servidor** (`mensajeDeCliente` en `src/programacion.ts`): `estado_invalido` ahí es "tiene visitas por hacer", "es el único sitio" o "está archivado", no "la visita ya está cancelada" como en Visitas. Las confirmaciones de archivar vuelven a leer las consultas de programación antes de cerrarse, para que la lista y el detalle ya digan lo nuevo.
- **Lo descartado no sube ni se sella aparte:** `descartadoEn` es un campo visible del registro local, `listar` lo deja fuera y la papelera lo lee con `descartados`. Así no cambia la versión de Dexie (regla 5).
