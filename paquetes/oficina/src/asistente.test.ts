import { describe, expect, it } from "vitest";
import { ErrorApi, ErrorDeRed, tipoDeProblema, type IntercambioDelAsistente, type RespuestaDelAsistente, type TablaDelAsistente } from "@teins/protocolo";
import {
  accionDeTecla,
  alTerminar,
  anuncioDelFinal,
  borradorTrasPreguntar,
  debeMostrarLaRespuesta,
  dejarDeSeguir,
  revisarSeguidas,
  erroresQueOlvidar,
  llaveDePregunta,
  olvidarErrorDeTope,
  textoDeNotificacion,
  destinoDeFuente,
  dolares,
  escalaDeSerie,
  estadoDelBoton,
  intervaloDeConsulta,
  mensajeAlPreguntar,
  nombreDePila,
  partirTexto,
  porcentajeDelTope,
  primeroDelMesSiguiente,
  respuestaComoTexto,
  tablaComoTsv,
  textoDelMes,
  validarTope,
} from "./asistente";

const tabla: TablaDelAsistente = {
  titulo: "Cable por material",
  columnas: [
    { titulo: "Material", numerica: false },
    { titulo: "Cantidad", numerica: true },
    { titulo: "Visitas", numerica: true },
  ],
  filas: [
    [{ texto: "UTP categoría 6", detalle: "CAB-UTP6" }, { texto: "4.485 m" }, { texto: "5" }],
    [{ texto: "«cable utp\tcat6\nazul»", marca: "sin_vincular" }, { texto: "45 m" }, { texto: "1" }],
  ],
};

const intercambio = (estado: IntercambioDelAsistente["estado"], id = "11111111-1111-4111-8111-111111111111"): IntercambioDelAsistente => ({
  id,
  pregunta: "¿Cuánto cable?",
  creadoEn: "2026-11-20T15:00:00.000Z",
  estado,
  duracionSegundos: estado === "en_curso" ? null : 6,
  pasos: [],
  respuesta: null,
  error: null,
});

describe("copiar una tabla", () => {
  it("sale en TSV con los encabezados, para pegar en Excel", () => {
    expect(tablaComoTsv(tabla)).toBe(["Material\tCantidad\tVisitas", "UTP categoría 6 (CAB-UTP6)\t4.485 m\t5", "«cable utp cat6 azul» (sin vincular)\t45 m\t1"].join("\n"));
  });

  it("cada celda en una línea: los espacios alrededor de un salto o un tabulador se vuelven uno; los demás quedan", () => {
    const celdas: TablaDelAsistente = {
      titulo: "t",
      columnas: [{ titulo: " Uno \r\n  dos\t", numerica: false }],
      filas: [[{ texto: "a  b\u00a0\n\u00a0c\t\t\td", detalle: "\nx " }], [{ texto: "sin  saltos " }]],
    };
    expect(tablaComoTsv(celdas)).toBe([" Uno dos ", "a  b c d ( x )", "sin  saltos "].join("\n"));
  });
});

describe("el texto del modelo", () => {
  it("se parte en párrafos por línea en blanco y en viñetas por las líneas que empiezan con «- »", () => {
    expect(partirTexto("Primero.\n\nSegundo, en\ndos líneas.\n- uno\n- dos\n\nFin.")).toEqual([
      { tipo: "parrafo", texto: "Primero." },
      { tipo: "parrafo", texto: "Segundo, en\ndos líneas." },
      { tipo: "lista", items: ["uno", "dos"] },
      { tipo: "parrafo", texto: "Fin." },
    ]);
  });

  it("no interpreta HTML ni Markdown: lo deja como texto", () => {
    expect(partirTexto("<b>hola</b> [enlace](https://x.co) ![i](https://x.co/a.png)")).toEqual([{ tipo: "parrafo", texto: "<b>hola</b> [enlace](https://x.co) ![i](https://x.co/a.png)" }]);
  });

  it("sin texto, nada", () => {
    expect(partirTexto("  \n\n ")).toEqual([]);
  });
});

describe("cuándo consultar la conversación", () => {
  it("cada segundo mientras hay un intercambio en curso, o mientras el que se espera no ha llegado", () => {
    expect(intervaloDeConsulta({ intercambios: [intercambio("lista", "a"), intercambio("en_curso", "b")] })).toBe(1000);
    expect(intervaloDeConsulta({ intercambios: [intercambio("lista", "a")] })).toBe(false);
    expect(intervaloDeConsulta({ intercambios: [intercambio("lista", "a")] }, "b")).toBe(1000);
    expect(intervaloDeConsulta(undefined)).toBe(false);
  });
});

describe("el botón del asistente", () => {
  it("piensa mientras responde con el panel cerrado y marca lo que no se ha visto", () => {
    expect(estadoDelBoton({ abierto: false, respondiendo: true, sinVer: false })).toEqual({ pensando: true, listo: false });
    expect(estadoDelBoton({ abierto: true, respondiendo: true, sinVer: false })).toEqual({ pensando: false, listo: false });
    expect(estadoDelBoton({ abierto: false, respondiendo: false, sinVer: true })).toEqual({ pensando: false, listo: true });
    expect(estadoDelBoton({ abierto: true, respondiendo: false, sinVer: true })).toEqual({ pensando: false, listo: false });
  });

  it("al terminar, avisa si no se está viendo esa conversación y deja el punto si el panel está cerrado", () => {
    expect(alTerminar("en_curso", { abierto: false, viendo: false })).toBeNull();
    expect(alTerminar("lista", { abierto: false, viendo: false })).toEqual({ notificar: true, sinVer: true });
    expect(alTerminar("lista", { abierto: true, viendo: false })).toEqual({ notificar: true, sinVer: false });
    expect(alTerminar("lista", { abierto: true, viendo: true })).toEqual({ notificar: false, sinVer: false });
    // Un error no va en una notificación: el punto lleva a verlo.
    expect(alTerminar("error", { abierto: false, viendo: false })).toEqual({ notificar: false, sinVer: true });
    expect(alTerminar("detenida", { abierto: false, viendo: false })).toEqual({ notificar: false, sinVer: false });
  });
});

describe("el tope del mes", () => {
  it("se escribe en dólares con coma o punto y hasta dos decimales, de 0 a 1.000", () => {
    expect(validarTope("5")).toEqual({ topeUsd: "5" });
    expect(validarTope(" 12,5 ")).toEqual({ topeUsd: "12.5" });
    expect(validarTope("0.75")).toEqual({ topeUsd: "0.75" });
    expect(validarTope("007")).toEqual({ topeUsd: "7" });
    expect(validarTope("1000")).toEqual({ topeUsd: "1000" });
    expect(validarTope("")).toEqual({ error: "Escriba el tope en dólares, por ejemplo 5,00." });
    expect(validarTope("5,123")).toEqual({ error: "Escriba el tope en dólares, por ejemplo 5,00." });
    expect(validarTope("-1")).toEqual({ error: "Escriba el tope en dólares, por ejemplo 5,00." });
    expect(validarTope("1000,01")).toEqual({ error: "El tope va de 0 a 1.000 dólares." });
  });

  it("se muestra con dos decimales y el medidor no pasa de lleno", () => {
    expect(dolares("1.8")).toBe("1,80");
    expect(dolares("1.84")).toBe("1,84");
    expect(dolares("0.004512")).toBe("0,00");
    expect(dolares("1000")).toBe("1.000,00");
    expect(porcentajeDelTope("1.84", "5")).toBe(37);
    expect(porcentajeDelTope("7", "5")).toBe(100);
    expect(porcentajeDelTope("0", "0")).toBe(100);
  });

  it("dice el mes y cuándo se puede volver a preguntar", () => {
    expect(textoDelMes("2026-11")).toBe("Noviembre de 2026");
    expect(primeroDelMesSiguiente("2026-11")).toBe("1 de diciembre");
    expect(primeroDelMesSiguiente("2026-12")).toBe("1 de enero");
  });
});

describe("los mensajes al preguntar", () => {
  const error = (codigo: "tope_agotado" | "no_disponible" | "estado_invalido", status: number) => new ErrorApi({ type: tipoDeProblema(codigo), title: codigo, status, codigo });
  it("cada error del contrato dice qué pasó y qué hacer", () => {
    expect(mensajeAlPreguntar(error("tope_agotado", 429), "Chispa", "2026-11-20")).toBe("Se usó el tope de Chispa de este mes. Se puede volver a preguntar el 1 de diciembre.");
    expect(mensajeAlPreguntar(error("no_disponible", 503), "Chispa", "2026-11-20")).toBe("Chispa no está disponible en este momento. Intente de nuevo más tarde.");
    expect(mensajeAlPreguntar(error("estado_invalido", 409), "Chispa", "2026-11-20")).toBe("Espere a que termine la respuesta en curso de esta conversación, o deténgala.");
    expect(mensajeAlPreguntar(new ErrorDeRed(new Error("x")), "Chispa", "2026-11-20")).toBe("Sin conexión con el servidor. No se envió la pregunta; intente de nuevo al recuperar la conexión.");
  });
});

describe("las fuentes", () => {
  const fuente = { visitaId: "v", levantamientoId: "l" as string | null, orden: "0012", fecha: "2026-02-14", cliente: "C", sitio: "S", ciudad: "Ibagué", revisado: true };
  it("llevan al levantamiento; sin levantamiento, a la visita en su pestaña", () => {
    expect(destinoDeFuente(fuente, "2026-11-20")).toEqual({ a: "levantamiento", id: "l" });
    expect(destinoDeFuente({ ...fuente, levantamientoId: null }, "2026-11-20")).toEqual({ a: "visita", vista: "anteriores", id: "v" });
    expect(destinoDeFuente({ ...fuente, levantamientoId: null, fecha: "2026-11-20" }, "2026-11-20")).toEqual({ a: "visita", vista: "proximas", id: "v" });
  });
});

describe("el gráfico de la serie", () => {
  it("usa guías redondas que alcanzan el valor más alto", () => {
    expect(escalaDeSerie([2, 3, 6, 4])).toEqual({ maximo: 6, guias: [0, 2, 4, 6] });
    expect(escalaDeSerie([41])).toEqual({ maximo: 60, guias: [0, 20, 40, 60] });
    expect(escalaDeSerie([0, 0])).toEqual({ maximo: 3, guias: [0, 1, 2, 3] });
  });
});

describe("copiar la respuesta", () => {
  it("lleva la cifra, el texto, las tablas y las fuentes en texto plano", () => {
    const r: RespuestaDelAsistente = {
      texto: "Casi todo es UTP.\n\n- La fibra, en dos visitas.",
      destacado: { cifras: [{ valor: "4.485", unidad: "m" }], descripcion: "de UTP categoría 6" },
      tablas: [tabla],
      fuentes: { titulo: "De 5 visitas revisadas", visitas: [{ visitaId: "v", levantamientoId: null, orden: null, fecha: "2026-02-14", cliente: "Clínica", sitio: "Sede", ciudad: null, revisado: true }] },
      serie: null,
    };
    expect(respuestaComoTexto(r)).toBe(
      ["4.485 m de UTP categoría 6", "Casi todo es UTP.\n\n- La fibra, en dos visitas.", `Cable por material\n${tablaComoTsv(tabla)}`, "De 5 visitas revisadas\nSin número · 14 de feb · Clínica · Sede"].join("\n\n"),
    );
  });
});

describe("el saludo", () => {
  it("usa el nombre de pila", () => {
    expect(nombreDePila("Juliana Vargas Ospina")).toBe("Juliana");
    expect(nombreDePila("  ")).toBe("");
  });
});

describe("la llave de cada pregunta (regla 4)", () => {
  const nueva = () => "llave-nueva";
  it("tras un error de red, la misma pregunta en la misma conversación se reintenta con la misma llave", () => {
    const previa = { texto: "¿Cuánto cable?", conversacionId: null, llave: "llave-1" };
    expect(llaveDePregunta(previa, "¿Cuánto cable?", null, nueva)).toBe("llave-1");
  });
  it("otro texto u otra conversación llevan una llave nueva", () => {
    const previa = { texto: "¿Cuánto cable?", conversacionId: null, llave: "llave-1" };
    expect(llaveDePregunta(previa, "¿Cuánta fibra?", null, nueva)).toBe("llave-nueva");
    expect(llaveDePregunta(previa, "¿Cuánto cable?", "c1", nueva)).toBe("llave-nueva");
    expect(llaveDePregunta(null, "¿Cuánto cable?", null, nueva)).toBe("llave-nueva");
  });
});

describe("lo escrito y la vista al llegar la respuesta del servidor", () => {
  it("solo se borra la caja si sigue teniendo la pregunta enviada", () => {
    expect(borradorTrasPreguntar("  ¿Cuánto cable? ", "¿Cuánto cable?")).toBe("");
    expect(borradorTrasPreguntar("Otra pregunta que ya empezó", "¿Cuánto cable?")).toBe("Otra pregunta que ya empezó");
  });
  it("se cambia a la conversación solo si la persona sigue donde preguntó; desde Buscar, siempre", () => {
    expect(debeMostrarLaRespuesta({ vista: "inicio", conversacionId: null }, { enConversacion: null, desdeBuscar: false })).toBe(true);
    expect(debeMostrarLaRespuesta({ vista: "conversacion", conversacionId: "c1" }, { enConversacion: "c1", desdeBuscar: false })).toBe(true);
    expect(debeMostrarLaRespuesta({ vista: "historial", conversacionId: "c1" }, { enConversacion: "c1", desdeBuscar: false })).toBe(false);
    expect(debeMostrarLaRespuesta({ vista: "conversacion", conversacionId: "c2" }, { enConversacion: "c1", desdeBuscar: false })).toBe(false);
    expect(debeMostrarLaRespuesta({ vista: "conversacion", conversacionId: "c2" }, { enConversacion: null, desdeBuscar: false })).toBe(false);
    expect(debeMostrarLaRespuesta({ vista: "historial", conversacionId: "c2" }, { enConversacion: null, desdeBuscar: true })).toBe(true);
  });
});

describe("los errores no se quedan pegados", () => {
  const tope = new ErrorApi({ type: tipoDeProblema("tope_agotado"), title: "t", status: 429, codigo: "tope_agotado" });
  it("el error del tope se olvida solo con un estado leído después del intento que dice que ya no está agotado", () => {
    expect(olvidarErrorDeTope(tope, { topeAgotado: false, estadoEn: 20, intentoEn: 10 })).toBe(true);
    // El estado en caché, anterior al intento, todavía no sabe que se agotó.
    expect(olvidarErrorDeTope(tope, { topeAgotado: false, estadoEn: 5, intentoEn: 10 })).toBe(false);
    expect(olvidarErrorDeTope(tope, { topeAgotado: true, estadoEn: 20, intentoEn: 10 })).toBe(false);
    expect(olvidarErrorDeTope(tope, { topeAgotado: undefined, estadoEn: 20, intentoEn: 10 })).toBe(false);
    expect(olvidarErrorDeTope(new ErrorDeRed(new Error("x")), { topeAgotado: false, estadoEn: 20, intentoEn: 10 })).toBe(false);
    expect(olvidarErrorDeTope(null, { topeAgotado: false, estadoEn: 20, intentoEn: 10 })).toBe(false);
  });

  it("al ir a otra parte se olvida solo lo que falló: un envío en curso sigue", () => {
    expect(erroresQueOlvidar({ isError: true }, { isError: false })).toEqual({ pregunta: true, detener: false });
    expect(erroresQueOlvidar({ isError: false }, { isError: true })).toEqual({ pregunta: false, detener: true });
    expect(erroresQueOlvidar({ isError: false }, { isError: false })).toEqual({ pregunta: false, detener: false });
  });
});

describe("cuándo se deja de seguir una respuesta", () => {
  const noEncontrado = new ErrorApi({ type: tipoDeProblema("no_encontrado"), title: "n", status: 404, codigo: "no_encontrado" });
  const red = new ErrorDeRed(new Error("x"));
  it("con no_encontrado, siempre", () => {
    expect(dejarDeSeguir({ error: noEncontrado, errorEn: 5, encoladoEn: 10, consultando: true })).toBe(true);
  });
  it("un error anterior a encolar, o uno mientras se vuelve a consultar, no la abandona", () => {
    expect(dejarDeSeguir({ error: red, errorEn: 5, encoladoEn: 10, consultando: false })).toBe(false);
    expect(dejarDeSeguir({ error: red, errorEn: 15, encoladoEn: 10, consultando: true })).toBe(false);
    expect(dejarDeSeguir({ error: null, errorEn: 0, encoladoEn: 10, consultando: false })).toBe(false);
  });
  it("un error posterior, sin consulta en curso, sí", () => {
    expect(dejarDeSeguir({ error: red, errorEn: 15, encoladoEn: 10, consultando: false })).toBe(true);
  });
});

describe("la notificación al terminar", () => {
  it("lleva la pregunta recortada a 80 caracteres", () => {
    expect(textoDeNotificacion("Chispa", "¿Cuánto cable?")).toBe("Chispa respondió: ¿Cuánto cable?");
    const larga = "a".repeat(100);
    expect(textoDeNotificacion("Chispa", larga)).toBe(`Chispa respondió: ${"a".repeat(79)}…`);
  });
});

describe("el final de la respuesta se anuncia", () => {
  it("dice cómo terminó; en curso, nada", () => {
    expect(anuncioDelFinal("en_curso", "Chispa")).toBe("");
    expect(anuncioDelFinal("lista", "Chispa")).toBe("Chispa respondió");
    expect(anuncioDelFinal("error", "Chispa")).toBe("No se pudo terminar la respuesta");
    expect(anuncioDelFinal("detenida", "Chispa")).toBe("Detuvo la respuesta");
  });
});

describe("las teclas de la caja", () => {
  const enter = { key: "Enter", shiftKey: false, isComposing: false };
  it("Enter pregunta; Mayús + Enter baja de línea; escribiendo con el teclado de acentos, nada", () => {
    expect(accionDeTecla(enter, { bloqueada: false, enCurso: false })).toBe("preguntar");
    expect(accionDeTecla({ ...enter, shiftKey: true }, { bloqueada: false, enCurso: false })).toBe("escribir");
    expect(accionDeTecla({ ...enter, isComposing: true }, { bloqueada: false, enCurso: false })).toBe("escribir");
    expect(accionDeTecla({ ...enter, key: "a" }, { bloqueada: false, enCurso: false })).toBe("escribir");
  });
  it("con una respuesta en curso o la caja bloqueada, Enter no pregunta", () => {
    expect(accionDeTecla(enter, { bloqueada: false, enCurso: true })).toBe("nada");
    expect(accionDeTecla(enter, { bloqueada: true, enCurso: false })).toBe("nada");
  });
});

describe("varias respuestas en curso a la vez", () => {
  const A = { conversacionId: "A", intercambioId: "a1", encoladoEn: 10 };
  const B = { conversacionId: "B", intercambioId: "b1", encoladoEn: 20 };
  const lectura = (estado: IntercambioDelAsistente["estado"] | null, pregunta: string) => ({ intercambio: estado ? { estado, pregunta } : undefined, error: null, errorEn: 0, consultando: false });
  const cerrado = { abierto: false, vista: "inicio" as const, conversacionId: null };

  it("A termina primero: se avisa de A y el botón sigue pensando por B", () => {
    const r = revisarSeguidas([A, B], [lectura("lista", "¿Pregunta A?"), lectura("en_curso", "¿Pregunta B?")], cerrado);
    expect(r.siguen).toEqual([B]);
    expect(r.terminadas).toEqual([{ conversacionId: "A", pregunta: "¿Pregunta A?", notificar: true, sinVer: true }]);
    expect(estadoDelBoton({ abierto: false, respondiendo: r.siguen.length > 0, sinVer: true })).toEqual({ pensando: true, listo: false });
  });

  it("B termina después: se avisa de B y el botón queda quieto, con el punto", () => {
    const r = revisarSeguidas([B], [lectura("lista", "¿Pregunta B?")], cerrado);
    expect(r.siguen).toEqual([]);
    expect(r.terminadas).toEqual([{ conversacionId: "B", pregunta: "¿Pregunta B?", notificar: true, sinVer: true }]);
    expect(estadoDelBoton({ abierto: false, respondiendo: false, sinVer: true })).toEqual({ pensando: false, listo: true });
  });

  it("la que se está viendo termina sin aviso; la otra sí avisa", () => {
    const viendoA = { abierto: true, vista: "conversacion" as const, conversacionId: "A" };
    const r = revisarSeguidas([A, B], [lectura("lista", "¿Pregunta A?"), lectura("lista", "¿Pregunta B?")], viendoA);
    expect(r.terminadas).toEqual([
      { conversacionId: "A", pregunta: "¿Pregunta A?", notificar: false, sinVer: false },
      { conversacionId: "B", pregunta: "¿Pregunta B?", notificar: true, sinVer: false },
    ]);
  });

  it("una que da no_encontrado sale sin aviso y sin afectar a la otra; una todavía sin leer sigue", () => {
    const noEncontrado = new ErrorApi({ type: tipoDeProblema("no_encontrado"), title: "n", status: 404, codigo: "no_encontrado" });
    const r = revisarSeguidas([A, B], [{ intercambio: undefined, error: noEncontrado, errorEn: 30, consultando: false }, lectura(null, "")], cerrado);
    expect(r.siguen).toEqual([B]);
    expect(r.terminadas).toEqual([]);
  });
});
