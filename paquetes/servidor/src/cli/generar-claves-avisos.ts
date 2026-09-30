import webpush from "web-push";

/**
 * Genera el par de claves VAPID de un entorno (ADR-0023). Cada entorno tiene el suyo: las suscripciones
 * quedan atadas a la clave pública, así que cambiarla obliga a cada navegador a suscribirse otra vez.
 * La privada es un secreto: va a las variables del entorno (worker), nunca al repositorio.
 *   pnpm --filter @teins/servidor generar-claves-avisos
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`AVISOS_VAPID_PUBLICA=${publicKey}`);
console.log(`AVISOS_VAPID_PRIVADA=${privateKey}`);
console.log("AVISOS_CONTACTO=mailto:[CORREO DE SOPORTE]");
