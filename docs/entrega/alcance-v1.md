# Alcance de la versión 1

Qué entrega TEINS con la versión 1, qué queda por fuera y qué depende de información que TEINS todavía no ha enviado. Es la base para el piloto y para la entrega: lo que no está en «Incluye» no se considera una falla de la versión 1.

Versión del piloto: **0.9.0**. Cuando TEINS acepte el piloto, la misma versión con los arreglos que salgan de él pasa a ser la **1.0.0**.

## Incluye

### Para los técnicos (en el celular)

- La app se instala desde el navegador en iPhone y Android, sin tienda de aplicaciones.
- Las visitas del día de cada técnico, con su horario, el cliente, el sitio y a quién preguntar al llegar.
- La captura paso a paso de un levantamiento con los formatos de TEINS (visita técnica y servicio de UPS), con o sin señal:
  - texto, medidas con su unidad, selecciones, horario de entrada y salida, y tablas de medidas por fase;
  - fotos, incluida la foto de llegada con la hora, la ubicación y el mapa;
  - secciones que se repiten, como tableros o pisos;
  - croquis a mano, con formas, cotas y símbolos;
  - materiales tomados del catálogo;
  - la firma de quien recibe la visita.
- Todo se guarda en el teléfono al momento. El envío a oficina sale solo cuando hay señal, sin perder ni duplicar nada.
- Una conversación con oficina sobre cada levantamiento, y avisos en el teléfono.
- Una papelera de 30 días para recuperar lo descartado.
- Seguridad:
  - la información guardada en el teléfono está cifrada;
  - si oficina desactiva a un técnico, su teléfono borra los datos de TEINS.

### Para oficina (en el computador)

- Clientes, sitios, contactos y visitas: programar, reprogramar, reasignar y cancelar, con un número de orden de servicio por visita.
- La bandeja de levantamientos recibidos y su revisión:
  - cada corrección queda registrada con quién, cuándo, el valor anterior y el nuevo;
  - solo una persona revisa un levantamiento a la vez.
- El informe:
  - se ve en vivo mientras se arma;
  - se elige qué sale en él;
  - al publicarlo queda una versión con su PDF que ya no se modifica: corregir es publicar otra.
- El envío del informe por correo, con el estado de cada contacto.
- Cotizaciones armadas desde las cantidades del levantamiento, con la lista de precios del catálogo.
- La exportación de las cantidades de una visita a una hoja de cálculo (CSV).
- Usuarios: crear, desactivar y reactivar. Administración con segundo factor. Búsqueda en todo con ⌘K o Ctrl + K.

### Para los clientes de TEINS (portal)

- Cada contacto del cliente entra con su correo y un código que le llega en el momento, y descarga sus informes y cotizaciones vigentes. Nunca ve los de otro cliente.
- Un acceso sin usar en 12 meses se quita solo, y oficina lo devuelve con un clic.

### Operación

- Copia diaria de la información, cifrada y fuera del sistema, con un simulacro de restauración comprobado.
- Las versiones del sistema quedan numeradas, con sus notas y la lista de componentes de terceros con sus licencias.
- Manuales para técnicos y oficina.

## Queda por fuera de la versión 1

| Qué | Por qué | Cuándo podría entrar |
|---|---|---|
| Enviar el informe por WhatsApp | Falta el número de WhatsApp Business que Meta debe aprobar | Cuando TEINS tenga la cuenta de Meta aprobada |
| Que el cliente acepte o pida cambios a una cotización en el portal | TEINS no ha definido cómo es ese proceso | Cuando TEINS lo defina |
| Un editor visual de formatos | Hoy un formato nuevo se carga como archivo, sin programar, en menos de un día | Si TEINS necesita que su propio personal cree formatos (P10) |
| Un rol de supervisor distinto del administrador | No se ha definido qué hace el supervisor que no haga el administrador | Cuando TEINS lo defina |
| La exportación a Excel con las columnas de TEINS | Falta saber qué columnas necesita (P29) | Cuando TEINS envíe su plantilla |
| Migrar levantamientos históricos | No es necesario por ahora (P39) | Si TEINS lo pide |
| Varias empresas usando el mismo sistema | La información ya está separada por empresa, pero no hay alta de empresas desde la pantalla | Si se ofrece a otras empresas (P44) |

## Depende de información de TEINS

Si al cierre del piloto alguno de estos no ha llegado, la función se entrega como está hoy y se ajusta después. El detalle, con cada pregunta, está en [`pendientes-de-teins.md`](pendientes-de-teins.md).

| Función | Qué falta | Cómo queda mientras tanto |
|---|---|---|
| Cotizaciones | Lista de precios, plantilla de la cotización, impuestos y numeración | Funcionan con los precios que se carguen en el catálogo |
| Informe | Secciones, orden, logo en vector y datos legales | Sigue la estructura del formato en papel, con el logo actual |
| Formato de UPS | Si «Tipo de servicio» admite varias opciones y si «potencial» es «potencia» | Permite varias opciones y dice «potencial», como el papel |
| Mapa de la foto de llegada | La cuenta de Geoapify a nombre de TEINS | Con la cuenta actual, sin tope diario por empresa |
