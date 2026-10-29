/*
  El número en el ícono de la app (Badging API): las conversaciones con algo sin leer de oficina. Es un complemento de
  la sección «Necesita atención»: iOS 16.4+ lo muestra en la app instalada con permiso de avisos; Android no muestra
  número. Con la app cerrada no sube solo: el servidor no sabe qué leyó el técnico en su teléfono, así que se
  actualiza al abrir la app.
*/

/** Pone el número en el ícono, o lo quita con 0. Sin la API, o si la rechaza, no hace nada. */
export async function ponerInsignia(cuantas: number): Promise<void> {
  try {
    if (cuantas > 0) await navigator.setAppBadge?.(cuantas);
    else await navigator.clearAppBadge?.();
  } catch {
    // Sin permiso de avisos o sin soporte: el número es un complemento, no hay nada que avisar.
  }
}
