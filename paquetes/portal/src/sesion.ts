/**
 * Recuerda, solo en esta pestaña, que hubo una sesión abierta. Si después el portal vuelve a pedir la clave
 * sin que la persona haya salido, se le explica por qué: la sesión venció (30 minutos sin uso) o TEINS
 * regeneró su acceso. Es una comodidad: si el navegador no deja guardar, simplemente no hay aviso.
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
