import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Aviso, Boton, CampoTexto, CeldaTabla, Dialogo, enfocarPrimerError, ErrorDeCarga, EsqueletoBloques, EsqueletoTabla, EstadoVacio, FilaTabla, Tabla, UserRound, useNotificar } from "@teins/ui";
import { cliente } from "../api";
import { mensajeDeAdministracion } from "../administracion";
import { consultasDelAsistente, dolares, porcentajeDelTope, primeroDelMesSiguiente, textoDelMes, validarTope } from "../asistente";
import { iniciales } from "../formato";

/** Administración · {nombre}: el gasto del mes frente al tope y quién preguntó (iteración 53, prototipos/analisis). */
export function UsoDelAsistente({ nombre, cambiandoTope, setCambiandoTope }: { nombre: string; cambiandoTope: boolean; setCambiandoTope: (v: boolean) => void }) {
  const titulo = useId();
  const uso = useQuery(consultasDelAsistente.uso());
  if (uso.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <EsqueletoBloques etiqueta="Cargando el gasto del mes" altos={["bajo"]} />
        <EsqueletoTabla etiqueta="Cargando las preguntas por persona" filas={3} columnas={3} />
      </div>
    );
  }
  if (uso.isError) return <ErrorDeCarga texto={`No se pudo cargar el uso de ${nombre}.`} reintentar={() => void uso.refetch()} />;
  const u = uso.data;
  const porcentaje = porcentajeDelTope(u.gastoUsd, u.topeUsd);
  return (
    <section className="asis-uso" aria-labelledby={titulo}>
      <div className="asis-uso-cab">
        <div>
          <div className="asis-mes" id={titulo}>
            {textoDelMes(u.mes)}
          </div>
          <div className="asis-gasto">
            {`US$${dolares(u.gastoUsd)} `}
            <span>{`de US$${dolares(u.topeUsd)} de tope`}</span>
          </div>
        </div>
        <Boton onClick={() => setCambiandoTope(true)}>Cambiar el tope</Boton>
      </div>
      <div className={`asis-medidor${porcentaje >= 100 ? " lleno" : ""}`} role="meter" aria-label="Gasto del mes" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-valuetext={`${porcentaje} % del tope`}>
        <div style={{ "--p": `${porcentaje}%` } as CSSProperties} />
      </div>
      <p className="asis-nota">
        {u.preguntas === 1 ? "1 pregunta" : `${u.preguntas.toLocaleString("es-CO")} preguntas`} este mes. Al llegar al tope, nadie de oficina puede preguntar hasta el {primeroDelMesSiguiente(u.mes)}.
      </p>
      {u.porPersona.length === 0 ? (
        <EstadoVacio icono={UserRound} titulo="Nadie ha preguntado este mes">
          Aquí aparece cuántas preguntas hizo cada persona y cuánto costaron.
        </EstadoVacio>
      ) : (
        <Tabla etiqueta="Preguntas y gasto por persona" columnas={[{ titulo: "Persona" }, { titulo: "Preguntas", derecha: true }, { titulo: "Gasto", derecha: true }]}>
          {u.porPersona.map((p) => (
            <FilaTabla key={p.usuarioId}>
              <CeldaTabla principal>
                <span className="asis-persona">
                  <span className="avatar" aria-hidden>
                    {iniciales(p.nombre)}
                  </span>
                  {p.nombre}
                </span>
              </CeldaTabla>
              <CeldaTabla derecha>{p.preguntas.toLocaleString("es-CO")}</CeldaTabla>
              <CeldaTabla derecha>{`US$${dolares(p.gastoUsd)}`}</CeldaTabla>
            </FilaTabla>
          ))}
        </Tabla>
      )}
      {cambiandoTope && <CambiarTope nombre={nombre} topeUsd={u.topeUsd} alCerrar={() => setCambiandoTope(false)} />}
    </section>
  );
}

function CambiarTope({ nombre, topeUsd, alCerrar }: { nombre: string; topeUsd: string; alCerrar: () => void }) {
  const formulario = useId();
  const consultas = useQueryClient();
  const notificar = useNotificar();
  const inicial = topeUsd.replace(".", ",");
  const [texto, setTexto] = useState(inicial);
  const [falta, setFalta] = useState<string | undefined>();
  const guardar = useMutation({
    mutationFn: (tope: string) => cliente.llamar("cambiarTopeDelAsistente", { cuerpo: { topeUsd: tope } }),
    // El uso y el estado del asistente (tope agotado o no) se vuelven a leer.
    onSettled: () => void consultas.invalidateQueries({ queryKey: ["asistente"] }),
  });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const leido = validarTope(texto);
    if ("error" in leido) {
      setFalta(leido.error);
      enfocarPrimerError(formulario);
      return;
    }
    try {
      await guardar.mutateAsync(leido.topeUsd);
    } catch {
      // El error queda a la vista en el diálogo.
      return;
    }
    notificar({ texto: "Tope guardado" });
    alCerrar();
  }

  return (
    <Dialogo
      forma="formulario"
      titulo={`Tope mensual de ${nombre}`}
      cerrable={!guardar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={guardar.isPending}>
            Guardar el tope
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto etiqueta="Tope en dólares (US$)" modoEntrada="decimal" valorInicial={inicial} onCambio={(t) => (setTexto(t), setFalta(undefined))} error={falta} />
        <p className="ayuda">Es lo máximo que se gasta en un mes. Al llegar a él, nadie de oficina puede preguntar hasta el mes siguiente.</p>
        {guardar.isError && <Aviso tono="error">{mensajeDeAdministracion(guardar.error)}</Aviso>}
      </form>
    </Dialogo>
  );
}
