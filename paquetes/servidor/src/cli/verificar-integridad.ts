import { conectar, enOrganizacion } from "../plataforma/base-de-datos";
import { todasLasCadenas, verificarCadena } from "../modulos/auditoria";

/**
 * Verifica todas las cadenas de la auditoría de una base (ADR-0008). Es el paso central del simulacro de
 * restauración (ADR-0016, nivel 4): una copia que restaura pero no conserva la cadena intacta no sirve.
 * Usa la conexión del dueño, porque debe ver todas las organizaciones. Termina con código 1 si alguna
 * cadena está rota.
 *   DATABASE_URL=postgresql://dueño@.../base pnpm verificar-integridad
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL: la conexión del dueño de la base que se verifica");
  process.exit(1);
}

const conexion = conectar(url, 2);
try {
  const cadenas = await todasLasCadenas(conexion.bd);
  let eslabones = 0;
  const rotas: string[] = [];
  for (const c of cadenas) {
    const r = await enOrganizacion(conexion.bd, c.organizacionId, (tx) => verificarCadena(tx, c.organizacionId, c.agregadoTipo, c.agregadoId));
    if (r.integra) eslabones += r.eslabones;
    else rotas.push(`${c.agregadoTipo} ${c.agregadoId} (organización ${c.organizacionId}): rota desde el eslabón ${r.primerEslabonRoto}`);
  }
  console.log(`Cadenas de auditoría: ${cadenas.length} verificadas, ${eslabones} eslabones íntegros, ${rotas.length} rotas.`);
  for (const r of rotas) console.error(`  ${r}`);
  if (rotas.length > 0) process.exitCode = 1;
} finally {
  await conexion.cerrar();
}
