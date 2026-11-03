import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CODIGO_DEL_PORTAL, ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { Aviso, Boton, CampoDeIngreso, claseBotonIngreso, LoaderCircle, MarcoDeIngreso } from "@teins/ui";
import { cliente, consultas } from "../api";
import { guardarPedido, olvidarPedido, pedidoGuardado } from "../sesion";

/** «Reenviar código» espera un minuto: el correo puede tardar en llegar (ADR-0053). */
const ESPERA_REENVIO_MS = 60_000;

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeRed) return "No hay conexión con el portal. Revise su conexión e intente de nuevo.";
  if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") {
    const minutos = Math.max(1, Math.ceil((error.problema.reintentarEnSegundos ?? 60) / 60));
    return `Demasiados intentos. Por seguridad, espere ${minutos === 1 ? "un minuto" : `${minutos} minutos`} antes de volver a intentar.`;
  }
  if (error instanceof ErrorApi && error.codigo === "entrada_invalida") return "Escriba un correo válido, por ejemplo nombre@empresa.com.";
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "El código no es correcto o venció. Pida uno nuevo.";
  return "No se pudo continuar. Intente de nuevo.";
}

/** «0:42», «1:00». */
const minutosYSegundos = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Paso = { tipo: "correo" } | { tipo: "codigo"; correo: string; en: number };
type Estado = { tipo: "listo" } | { tipo: "enviando" } | { tipo: "error"; mensaje: string; codigoMalo?: boolean };

/**
 * Entrar al portal (ADR-0053): el correo y, en la misma tarjeta, el código de 6 dígitos que le llega. Nada que entregar
 * a mano ni clave que recordar.
 */
export function Ingreso({ sesionCerrada = false, aviso }: { sesionCerrada?: boolean; aviso?: ReactNode }) {
  const consultasCliente = useQueryClient();
  const [paso, setPaso] = useState<Paso>(() => {
    const p = pedidoGuardado();
    return p ? { tipo: "codigo", ...p } : { tipo: "correo" };
  });
  const [correo, setCorreo] = useState(paso.tipo === "codigo" ? paso.correo : "");
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const [ahora, setAhora] = useState(Date.now);

  // La cuenta del «Reenviar código», segundo a segundo, solo mientras falta.
  const faltaMs = paso.tipo === "codigo" ? Math.max(0, paso.en + ESPERA_REENVIO_MS - ahora) : 0;
  useEffect(() => {
    if (faltaMs === 0) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [faltaMs === 0]);

  async function pedir(evento?: FormEvent) {
    evento?.preventDefault();
    const limpio = correo.trim();
    if (!limpio.includes("@")) return setEstado({ tipo: "error", mensaje: "Escriba su correo, por ejemplo nombre@empresa.com." });
    setEstado({ tipo: "enviando" });
    try {
      await cliente.llamar("pedirCodigoDelPortal", { cuerpo: { correo: limpio } });
      const en = Date.now();
      guardarPedido(limpio, en);
      setAhora(en);
      setCodigo("");
      setPaso({ tipo: "codigo", correo: limpio, en });
      setEstado({ tipo: "listo" });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error) });
    }
  }

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    if (paso.tipo !== "codigo") return;
    const limpio = codigo.replace(/\s/g, "");
    if (!CODIGO_DEL_PORTAL.test(limpio)) return setEstado({ tipo: "error", mensaje: "Escriba los 6 dígitos del código." });
    setEstado({ tipo: "enviando" });
    try {
      await cliente.llamar("ingresarConCodigo", { cuerpo: { correo: paso.correo, codigo: limpio } });
      olvidarPedido();
      await consultasCliente.invalidateQueries({ queryKey: consultas.sesion().queryKey });
    } catch (error) {
      setEstado({ tipo: "error", mensaje: mensajeDeError(error), codigoMalo: error instanceof ErrorApi && error.codigo === "no_autenticado" });
    }
  }

  function otroCorreo() {
    olvidarPedido();
    setPaso({ tipo: "correo" });
    setEstado({ tipo: "listo" });
  }

  const enviando = estado.tipo === "enviando";
  const error = estado.tipo === "error" && <Aviso tono="error">{estado.mensaje}</Aviso>;

  if (paso.tipo === "correo") {
    return (
      <MarcoDeIngreso titulo="Sus informes y cotizaciones" debajo="¿Su correo no tiene acceso? Pídaselo a TEINS.">
        <p className="-mt-3 text-center text-[14px] text-texto-secundario">Escriba su correo y le enviaremos un código para entrar.</p>
        {aviso}
        {sesionCerrada && <Aviso tono="alerta">Su sesión se cerró: pasaron 30 minutos sin usarla o se le quitó el acceso. Entre de nuevo con su correo.</Aviso>}
        <form onSubmit={(e) => void pedir(e)} noValidate className="flex flex-col gap-4">
          <CampoDeIngreso etiqueta="Correo" nombre="correo" tipo="email" autoComplete="email" valor={correo} onCambio={setCorreo} error={estado.tipo === "error"} />
          {error}
          <button type="submit" aria-busy={enviando || undefined} className={claseBotonIngreso(true)}>
            {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
            Enviar código
          </button>
        </form>
      </MarcoDeIngreso>
    );
  }

  // Con el código vencido o equivocado no tiene sentido esperar: se puede pedir otro de una vez.
  const puedeReenviar = faltaMs === 0 || (estado.tipo === "error" && estado.codigoMalo === true);
  return (
    <MarcoDeIngreso titulo="Revise su correo" debajo="Si no le llega, revise el correo no deseado.">
      <p className="-mt-3 text-center text-[14px] text-texto-secundario">
        Le enviamos un código a <b className="font-medium text-texto">{paso.correo}</b>. Vence en 10 minutos.
      </p>
      {aviso}
      <form onSubmit={(e) => void entrar(e)} noValidate className="flex flex-col gap-4">
        <CampoDeIngreso etiqueta="Código" nombre="codigo" autoComplete="one-time-code" codigo valor={codigo} onCambio={(v) => setCodigo(v.replace(/\D/g, "").slice(0, 6))} error={estado.tipo === "error"} />
        {error}
        <button type="submit" aria-busy={enviando || undefined} className={claseBotonIngreso(true)}>
          {enviando && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
          Entrar
        </button>
        <div className="flex items-center justify-between gap-3">
          {puedeReenviar ? (
            <Boton variante="fantasma" tamano="pequeno" disabled={enviando} onClick={() => void pedir()}>
              Reenviar código
            </Boton>
          ) : (
            <span className="text-[14px] text-texto-terciario tabular-nums">{`Reenviar código en ${minutosYSegundos(faltaMs)}`}</span>
          )}
          <Boton variante="fantasma" tamano="pequeno" disabled={enviando} onClick={otroCorreo}>
            Usar otro correo
          </Boton>
        </div>
      </form>
    </MarcoDeIngreso>
  );
}
