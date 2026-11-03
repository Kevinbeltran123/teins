/**
 * Recuerda, solo en esta pestaña, que hubo una sesión abierta. Si después el portal vuelve a pedir el correo
 * sin que la persona haya salido, se le explica por qué: la sesión venció (30 minutos sin uso) o le quitaron el
 * acceso. Es una comodidad: si el navegador no deja guardar, simplemente no hay aviso.
 */
const LLAVE = "teins-portal-sesion-abierta";

export function marcarSesionAbierta(): void {
  try {
    sessionStorage.setItem(LLAVE, "1");
  } catch {
    // Sin almacenamiento de la pestaña: no hay aviso, y el ingreso funciona igual.
  }
}

export function olvidarSesion(): void {
  try {
    sessionStorage.removeItem(LLAVE);
  } catch {
    // Igual que arriba.
  }
}

export function habiaSesion(): boolean {
  try {
    return sessionStorage.getItem(LLAVE) === "1";
  } catch {
    return false;
  }
}

/**
 * El código pedido (ADR-0053), en esta pestaña: en el teléfono, ir al correo a leerlo puede recargar el portal, y al
 * volver sigue en «Revise su correo» mientras el código no venza (10 minutos). Sin almacenamiento, se pide otro.
 */
const PEDIDO = "teins-portal-pedido";
const VIGENCIA_MS = 10 * 60_000;

export function guardarPedido(correo: string, en: number): void {
  try {
    sessionStorage.setItem(PEDIDO, JSON.stringify({ correo, en }));
  } catch {
    // Igual que arriba.
  }
}

export function pedidoGuardado(ahora = Date.now()): { correo: string; en: number } | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PEDIDO) ?? "null") as { correo?: unknown; en?: unknown } | null;
    return p && typeof p.correo === "string" && typeof p.en === "number" && ahora - p.en < VIGENCIA_MS ? { correo: p.correo, en: p.en } : null;
  } catch {
    return null;
  }
}

export function olvidarPedido(): void {
  try {
    sessionStorage.removeItem(PEDIDO);
  } catch {
    // Igual que arriba.
  }
}
