import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { crearMedida, esCantidades, esNoObtenido, type DefinicionCampo, type Valor, type ValorMedida } from "@teins/dominio";
import { ErrorApi } from "@teins/protocolo";
import { Aviso, Boton, CampoMedida, CampoTexto, FileText, MarcaNoObtenido, RefreshCw } from "@teins/ui";
import { mensajeDeError, mensajeDeValidacion, pideRecargar } from "../../mensajes";
import { useCorregir, type Escrito, type Levantamiento } from "../../revision";
import { SinEnviar } from "../../sinEnviar";
import { CorreccionEnCurso } from "./contexto";
import { CorregirCantidades } from "./CorregirCantidades";

/** Corrección de un campo, con las mismas reglas del envío (QA-8: queda con valor anterior y nuevo). */
export function EditorCorreccion({
  l,
  seccion,
  campo,
  valor,
  cerrar,
  alGuardar,
  recargar,
}: {
  l: Levantamiento;
  seccion: string;
  campo: DefinicionCampo;
  valor: Valor | undefined;
  cerrar: () => void;
  alGuardar: () => void;
  recargar: () => void;
}) {
  const corregir = useCorregir(l.id);
  const noObtenidoAntes = esNoObtenido(valor);
  const [nuevo, setNuevo] = useState<Valor | undefined>(valor);
  const [valido, setValido] = useState(true);
  // Lo que muestra el control y si se puede leer: marcar «No se pudo obtener» no lo borra, y desmarcarlo vuelve a él.
  const delControl = useRef<{ valor: Valor | undefined; valido: boolean }>({ valor: noObtenidoAntes ? undefined : valor, valido: true });
  const desdeElControl = (escrito: Valor | undefined, esValido = true) => {
    delControl.current = { valor: escrito, valido: esValido };
    setNuevo(escrito);
    setValido(esValido);
  };
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const idMotivo = `motivo-${seccion}-${campo.clave}`;
  const errorDelCampo = corregir.error instanceof ErrorApi ? corregir.error.problema.errores?.find((e) => e.seccion === seccion && e.campo === campo.clave) : undefined;
  const mensajeCampo = errorDelCampo ? mensajeDeValidacion[errorDelCampo.codigo as keyof typeof mensajeDeValidacion] : undefined;
  const marcado = esNoObtenido(nuevo);
  const enCurso = useContext(CorreccionEnCurso);
  useEffect(() => enCurso?.avisar({ seccion, campo: campo.clave, valor: nuevo }), [nuevo]);
  useEffect(() => () => enCurso?.avisar(null), []);
  // Escrita y sin guardar: «Marcar revisado» dice que se pierde.
  const pendientes = useContext(SinEnviar);
  const escrita = motivo.trim() !== "" || JSON.stringify(nuevo ?? null) !== JSON.stringify(valor ?? null);
  useEffect(() => {
    const que: Escrito = { tipo: "correccion", seccion, campo: campo.clave };
    const clave = JSON.stringify(que);
    if (escrita) pendientes?.set(clave, { que, valor: true });
    return () => void pendientes?.delete(clave);
  }, [escrita]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    // El motivo queda en el historial junto al valor anterior (regla 8): sin él, el registro no dice por qué.
    if (!motivo.trim()) {
      setFaltaMotivo(true);
      document.getElementById(idMotivo)?.focus();
      return;
    }
    try {
      await corregir.mutateAsync({ version: l.version, correcciones: [{ seccion, campo: campo.clave, valor: nuevo ?? null }], motivo: motivo.trim() });
      alGuardar();
    } catch {
      // El error queda a la vista en el formulario.
    }
  }

  const control = (() => {
    switch (campo.tipo) {
      case "texto":
        return (
          <CampoTexto
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            valorInicial={typeof valor === "string" ? valor : ""}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto) => desdeElControl(texto === "" ? undefined : texto)}
          />
        );
      case "medida": {
        const medida = valor && !noObtenidoAntes && typeof valor === "object" && "valor" in valor ? (valor as ValorMedida) : undefined;
        return (
          <CampoMedida
            etiqueta={`Nuevo valor de ${campo.etiqueta.toLowerCase()}`}
            unidades={campo.unidades}
            valorInicial={medida?.valor.replace(".", ",") ?? ""}
            unidadInicial={medida?.unidad}
            deshabilitado={marcado}
            error={marcado ? undefined : mensajeCampo}
            onCambio={(texto, unidad) => {
              if (texto.trim() === "") {
                desdeElControl(undefined);
                return true;
              }
              // Una medida que no se puede leer deja el último valor bueno, pero no se guarda.
              const m = crearMedida(texto, unidad, campo.unidades);
              desdeElControl(m ?? delControl.current.valor, m !== null);
              return m !== null;
            }}
          />
        );
      }
      case "cantidades": {
        const lineas = esCantidades(valor) ? valor : [];
        return <CorregirCantidades etiqueta={`Líneas corregidas de ${campo.etiqueta.toLowerCase()}`} inicial={lineas} unidades={campo.unidades} deshabilitado={marcado} error={marcado ? undefined : mensajeCampo} onCambio={(v) => desdeElControl(v)} />;
      }
      // Fotos, bocetos y firmas no se corrigen en revisión: se ven como los tomó el técnico.
      case "foto":
      case "boceto":
      case "firma":
        return null;
      default:
        return campo satisfies never;
    }
  })();

  return (
    <form className="editor-inline" onSubmit={(e) => void guardar(e)} noValidate>
      {control}
      {campo.obligatorio && (
        <MarcaNoObtenido
          dato={campo.etiqueta}
          marcado={marcado}
          motivoInicial={noObtenidoAntes ? valor.motivo : ""}
          error={marcado ? mensajeCampo : undefined}
          // Marcar o desmarcar reinicia la validez: marcado no importa lo escrito; desmarcado, vale lo que muestra el control.
          onMarcar={(m, motivoNoObtenido) => {
            setNuevo(m ? { noObtenido: true, motivo: motivoNoObtenido } : delControl.current.valor);
            setValido(m || delControl.current.valido);
          }}
          onMotivo={(motivoNoObtenido) => setNuevo({ noObtenido: true, motivo: motivoNoObtenido })}
        />
      )}
      <div className="campo">
        <label htmlFor={idMotivo}>
          Motivo de la corrección <small className="sec">obligatorio · queda en el historial</small>
        </label>
        <input
          id={idMotivo}
          className={`control ${faltaMotivo && !motivo.trim() ? "error" : ""}`}
          placeholder="Por ejemplo: la placa dice 25 kVA"
          maxLength={500}
          value={motivo}
          aria-invalid={(faltaMotivo && !motivo.trim()) || undefined}
          aria-describedby={faltaMotivo && !motivo.trim() ? `${idMotivo}-error` : undefined}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {faltaMotivo && !motivo.trim() && (
          <p id={`${idMotivo}-error`} className="msj-error">
            Escriba el motivo: queda en el historial junto al valor anterior.
          </p>
        )}
      </div>
      {corregir.isError && !errorDelCampo && (
        <Aviso tono="error">
          <b>{mensajeDeError(corregir.error)}</b>
          {pideRecargar(corregir.error) && (
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={recargar}>
                Recargar
              </Boton>
            </div>
          )}
        </Aviso>
      )}
      {enCurso &&
        (enCurso.verCapitulo ? (
          <Boton variante="fantasma" tamano="pequeno" icono={FileText} className="ir-capitulo" onClick={enCurso.verCapitulo}>
            Ver cómo queda en el informe
          </Boton>
        ) : (
          <p className="ayuda">El capítulo de la derecha ya muestra el valor nuevo, resaltado.</p>
        ))}
      <div className="fila-botones">
        <Boton onClick={cerrar} disabled={corregir.isPending}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="principal" cargando={corregir.isPending} disabled={!valido}>
          Guardar corrección
        </Boton>
      </div>
    </form>
  );
}
