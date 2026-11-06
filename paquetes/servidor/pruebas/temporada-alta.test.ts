import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, iniciarSesion, jpegDePrueba, servidorDePrueba } from "./ayudas";

/*
  Temporada alta (QA-14, iteración 51): el escenario de la prueba de carga, todo a la vez y con más solicitudes que
  conexiones (el pool de prueba tiene 5). Busca lo que solo aparece con concurrencia: una operación que pide una segunda
  conexión con una transacción abierta (todas se traban y fallan a los 10 s, como pasó en la iteración 42), bloqueos en
  orden cruzado o envíos duplicados. Cuánto tarda cada cosa con datos y servidores reales lo mide el ensayo
  (`pnpm --filter @teins/servidor ensayo-de-carga`).
*/

const s = await servidorDePrueba();
const { app } = s;
const visitas = crearVisitas(clientesYSitios);

const TECNICOS = 10;
/** Más que las conexiones del pool de prueba: cada paso de la revisión corre más veces a la vez que conexiones hay. */
const REVISORES = 6;
const FOTOS_POR_LEVANTAMIENTO = 2;
const CONTRASENA = "contrasena-de-prueba";

type Respuesta = Awaited<ReturnType<typeof app.inject>>;
interface Persona {
  id: string;
  cookie: string;
}

const get = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie, ...cabecerasSync } });
const post = (cookie: string, url: string, payload?: object) => app.inject({ method: "POST", url, headers: { cookie, ...cabecerasSync }, ...(payload ? { payload } : {}) });

/** Cada respuesta de la ráfaga, para revisar al final que ninguna fue un error del servidor. */
const respuestas: { operacion: string; estado: number }[] = [];

async function medir(operacion: string, pedido: Promise<Respuesta>): Promise<Respuesta> {
  const r = await pedido;
  respuestas.push({ operacion, estado: r.statusCode });
  return r;
}

/** Corta el recorrido de esa persona con lo que respondió el servidor, para saber dónde falló. */
function exigir(r: Respuesta, operacion: string, estado = 200) {
  if (r.statusCode !== estado) throw new Error(`${operacion}: ${r.statusCode} ${r.body}`);
  return r.json();
}

/** Como el teléfono: pide la URL firmada, sube directo al almacenamiento y confirma (ADR-0007). */
async function subirFoto(cookie: string): Promise<string> {
  const { datos, huella } = jpegDePrueba();
  const autorizacion = exigir(await medir("autorizarSubida", post(cookie, "/api/archivos/subidas", { huella, bytes: datos.length, tipo: "image/jpeg" })), "autorizarSubida");
  if (autorizacion.estado === "autorizada") {
    const subida = await fetch(autorizacion.url, { method: "PUT", headers: autorizacion.cabeceras, body: datos });
    if (subida.status !== 200) throw new Error(`subir: ${subida.status}`);
  }
  exigir(await medir("confirmarSubida", post(cookie, `/api/archivos/${huella}/subido`)), "confirmarSubida", 202);
  return huella;
}

/** Como el teléfono: mientras el worker verifica las fotos, el servidor pide esperar y se reintenta con la misma llave. */
async function enviar(cookie: string, visitaId: string, fotos: string[]): Promise<string> {
  const id = randomUUID();
  const comando = {
    tipo: "EnviarLevantamiento",
    llave: llaveDeEnvio(id),
    levantamiento: {
      id,
      formato: "prueba-ups",
      versionFormato: 1,
      visitaId,
      respuestas: { cuarto_tecnico: { potencia_nominal: { valor: "12.5", unidad: "kVA" }, fotos_equipo: fotos } },
      creadoEn: "2026-09-30T10:00:00.000-05:00",
      enviadoEn: "2026-09-30T11:00:00.000-05:00",
    },
  };
  for (let intento = 0; intento < 300; intento++) {
    const r = await medir("enviarComando", post(cookie, "/api/sync/comandos", comando));
    if (r.statusCode === 200) return id;
    if (r.json().codigo !== "archivos_en_verificacion") throw new Error(`enviarComando: ${r.statusCode} ${r.body}`);
    await new Promise((listo) => setTimeout(listo, 100));
  }
  throw new Error("enviarComando: las fotos nunca se verificaron");
}

/** Una organización con sus técnicos, las personas de oficina y lo que cada una revisa: todo antes de la ráfaga. */
async function preparar() {
  const org = await s.nuevaOrganizacionConUsuarios();
  const nuevaVisita = (tecnicoId: string) =>
    enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
      const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente ficticio", sitio: { nombre: "Sede", direccion: "Calle [N] # [N]-[N]" } });
      return visitas.crear(tx, { organizacionId: org.organizacionId, autorId: "prueba", correlacion: "temporada-alta", clienteId, sitioId, motivo: "Mantenimiento", programadaPara: "2026-09-30", tecnicos: [tecnicoId] });
    });

  const tecnicos: Persona[] = [org.tecnico];
  while (tecnicos.length < TECNICOS) tecnicos.push(await s.nuevoTecnico(org.organizacionId));
  const visitasDeCampo: string[] = [];
  for (const t of tecnicos) visitasDeCampo.push(await nuevaVisita(t.id));

  const revisores: Persona[] = [org.oficina];
  while (revisores.length < REVISORES) {
    const usuario = `oficina.${randomBytes(4).toString("hex")}`;
    const { id } = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: `Revisora ${revisores.length}`, rol: "oficina", contrasena: CONTRASENA });
    revisores.push({ id, cookie: await iniciarSesion(app, usuario, CONTRASENA) });
  }
  // Lo que oficina revisa en la ráfaga: un levantamiento enviado antes por otro técnico, en su propia visita.
  const porRevisar: { id: string; visitaId: string; fotos: string[] }[] = [];
  for (let i = 0; i < REVISORES; i++) {
    const tecnico = await s.nuevoTecnico(org.organizacionId);
    const visitaId = await nuevaVisita(tecnico.id);
    const fotos = [await subirFoto(tecnico.cookie), await subirFoto(tecnico.cookie)];
    await s.procesarCola();
    porRevisar.push({ id: await enviar(tecnico.cookie, visitaId, fotos), visitaId, fotos });
  }
  respuestas.length = 0;
  return { org, tecnicos, visitasDeCampo, revisores, porRevisar };
}

describe("temporada alta (iteración 51, QA-14)", () => {
  it("diez técnicos enviando y bajando y oficina revisando y publicando, todo a la vez: nada falla ni se duplica", async () => {
    const { org, tecnicos, visitasDeCampo, revisores, porRevisar } = await preparar();

    const campo = async (tecnico: Persona, visitaId: string) => {
      exigir(await medir("obtenerCambios", get(tecnico.cookie, "/api/sync/cambios?app=2")), "obtenerCambios");
      const fotos: string[] = [];
      for (let i = 0; i < FOTOS_POR_LEVANTAMIENTO; i++) fotos.push(await subirFoto(tecnico.cookie));
      await enviar(tecnico.cookie, visitaId, fotos);
      exigir(await medir("obtenerCambios", get(tecnico.cookie, "/api/sync/cambios?app=2")), "obtenerCambios");
    };

    const integras: boolean[] = [];
    const oficina = async (revisora: Persona, { id, visitaId, fotos }: (typeof porRevisar)[number]) => {
      exigir(await medir("listarLevantamientos", get(revisora.cookie, "/api/levantamientos?estado=enviado")), "listarLevantamientos");
      let { version } = exigir(await medir("tomarLevantamiento", post(revisora.cookie, `/api/levantamientos/${id}/tomar`, { version: 1 })), "tomarLevantamiento");
      exigir(await medir("obtenerLevantamiento", get(revisora.cookie, `/api/levantamientos/${id}`)), "obtenerLevantamiento");
      // La revisión pide la URL de cada foto a la vez, como la pantalla.
      for (const r of await Promise.all(fotos.map((h) => medir("urlDeArchivo", get(revisora.cookie, `/api/archivos/${h}/url`))))) exigir(r, "urlDeArchivo");
      ({ version } = exigir(
        await medir("corregirLevantamiento", post(revisora.cookie, `/api/levantamientos/${id}/correcciones`, { version, correcciones: [{ seccion: "cuarto_tecnico", campo: "descripcion", valor: "Corregido en la revisión" }] })),
        "corregirLevantamiento",
      ));
      exigir(await medir("marcarRevisado", post(revisora.cookie, `/api/levantamientos/${id}/marcar-revisado`, { version })), "marcarRevisado");
      integras.push(exigir(await medir("historialLevantamiento", get(revisora.cookie, `/api/levantamientos/${id}/historial`)), "historialLevantamiento").integra);

      const { id: informeId } = exigir(await medir("abrirInformeDeVisita", post(revisora.cookie, "/api/informes", { visitaId })), "abrirInformeDeVisita");
      const borrador = exigir(await medir("obtenerInforme", get(revisora.cookie, `/api/informes/${informeId}`)), "obtenerInforme");
      const guardado = exigir(
        await medir("guardarInforme", post(revisora.cookie, `/api/informes/${informeId}/borrador`, { version: borrador.version, introduccion: "", conclusiones: "", levantamientos: [id], planos: [] })),
        "guardarInforme",
      );
      exigir(await medir("publicarInforme", post(revisora.cookie, `/api/informes/${informeId}/publicar`, { version: guardado.version, destinatarios: [] })), "publicarInforme", 201);
      exigir(await medir("listarInformes", get(revisora.cookie, "/api/informes")), "listarInformes");
    };

    // El worker trabaja durante toda la ráfaga: verifica fotos y genera los PDF mientras llegan las solicitudes. Que la
    // cola no se vacíe en una pasada solo dice que siguen llegando trabajos (en una máquina lenta, la ráfaga dura más).
    let enRafaga = true;
    const worker = (async () => {
      while (enRafaga) {
        await s.procesarCola().catch((error: unknown) => {
          if (!(error instanceof Error && error.message === "La cola no se vació")) throw error;
        });
        await new Promise((listo) => setTimeout(listo, 50));
      }
    })();
    const recorridos = await Promise.allSettled([...tecnicos.map((t, i) => campo(t, visitasDeCampo[i]!)), ...revisores.map((o, i) => oficina(o, porRevisar[i]!))]);
    enRafaga = false;
    await worker;

    expect(recorridos.flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : []))).toEqual([]);
    expect(respuestas.filter((r) => r.estado >= 500)).toEqual([]);
    // Cada envío llegó una sola vez: los de la ráfaga esperan en la bandeja y los revisados ya salieron de ella.
    expect(exigir(await get(org.oficina.cookie, "/api/levantamientos?estado=enviado"), "listarLevantamientos").total).toBe(TECNICOS);
    // La cadena de auditoría de cada revisado quedó íntegra (QA-8).
    expect(integras).toEqual(Array(REVISORES).fill(true));
    // Los PDF salen de a uno (cola `pdf`, ADR-0012): al final están todos.
    await s.esperarPdf({ organizacionId: org.organizacionId });
    const { rows } = await s.propietario.pool.query("select pdf_estado as estado, count(*)::int as n from informes.versiones where organizacion_id = $1 group by 1", [org.organizacionId]);
    expect(rows).toEqual([{ estado: "listo", n: REVISORES }]);
  }, 240_000);
});
