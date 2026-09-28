-- Deja el entorno de pruebas limpio para una demostración: borra todo lo capturado y creado por las pruebas y
-- conserva la organización, los formatos publicados, la biblioteca de símbolos y solo los usuarios
-- oficina.prueba y tecnico.prueba (con su contraseña, su segundo factor y sus llaves de acceso).
-- No se deshace: correr solo en el entorno de pruebas, nunca en producción.
-- Uso (desde la raíz, con la CLI enlazada a teins-pruebas):
--   railway ssh -s Postgres -- sh -c 'psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1' < infra/limpieza/dejar-limpio.sql

begin;

-- Lo capturado, revisado, publicado y enviado.
truncate levantamientos.lineas_cantidad, levantamientos.comentarios, levantamientos.comandos_procesados, levantamientos.levantamientos;
truncate informes.versiones, informes.informes;
truncate cotizaciones.versiones, cotizaciones.cotizaciones, cotizaciones.consecutivos;
truncate envios.envios;
truncate visitas.visitas;
truncate clientes.contactos, clientes.sitios, clientes.clientes;
truncate catalogo.precios, catalogo.items;
truncate portal.sesiones, portal.intentos, portal.accesos;
truncate archivos.archivos;
truncate avisos.suscripciones;

-- El historial de lo borrado ya no describe nada: las cadenas empiezan de nuevo.
truncate auditoria.registros, cambios.registro;

-- Trabajos pendientes del worker (PDF, envíos, avisos) de lo que se borró.
delete from graphile_worker._private_jobs;

-- Usuarios: solo los dos de prueba.
delete from identidad.sesiones;
delete from identidad.dispositivos where usuario_id in (select id from identidad.usuarios where usuario not in ('oficina.prueba', 'tecnico.prueba'));
delete from identidad.llaves_de_acceso where usuario_id in (select id from identidad.usuarios where usuario not in ('oficina.prueba', 'tecnico.prueba'));
delete from identidad.segundos_factores where usuario_id in (select id from identidad.usuarios where usuario not in ('oficina.prueba', 'tecnico.prueba'));
delete from identidad.cuentas where usuario_id in (select id from identidad.usuarios where usuario not in ('oficina.prueba', 'tecnico.prueba'));
delete from identidad.usuarios where usuario not in ('oficina.prueba', 'tecnico.prueba');
delete from identidad.verificaciones;
delete from identidad.limites_de_tasa;

select 'usuarios' as que, count(*) from identidad.usuarios
union all select 'levantamientos', count(*) from levantamientos.levantamientos
union all select 'clientes', count(*) from clientes.clientes
union all select 'formatos', count(*) from formatos.versiones
union all select 'simbolos', count(*) from simbolos.simbolos;

commit;
