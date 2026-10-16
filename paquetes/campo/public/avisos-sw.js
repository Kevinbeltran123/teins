/*
  Avisos push (ADR-0023). El service worker que genera vite-plugin-pwa importa este archivo.
  Safari 18.4 o posterior muestra el formato declarativo ("web_push": 8030) sin este código; Chrome,
  Android y los Safari anteriores lo muestran aquí, con los mismos campos.
*/

// La conversación que cada ventana tiene abierta (ADR-0040): la pantalla lo dice al abrir y al cerrar el chat. Si el
// service worker se reinicia, la olvida y el aviso se muestra: es lo seguro.
const abiertas = new Map();
self.addEventListener("message", (evento) => {
  const datos = evento.data;
  if (!datos || datos.tipo !== "conversacion" || !evento.source) return;
  if (datos.etiqueta) abiertas.set(evento.source.id, datos.etiqueta);
  else abiertas.delete(evento.source.id);
});

self.addEventListener("push", (evento) => {
  let datos;
  try {
    datos = evento.data ? evento.data.json() : null;
  } catch {
    return;
  }
  const aviso = datos && datos.notification;
  if (!aviso || !aviso.title) return;
  const opciones = { body: aviso.body, tag: aviso.tag, lang: aviso.lang, dir: aviso.dir, icon: "/icono-192.png", data: { navigate: aviso.navigate } };
  evento.waitUntil(
    self.clients.matchAll({ type: "window" }).then(async (ventanas) => {
      const mirando = ventanas.find((v) => v.focused && abiertas.get(v.id) === aviso.tag);
      if (!mirando) return self.registration.showNotification(aviso.title, opciones);
      // Con la conversación a la vista no hay aviso: el navegador exige mostrar algo, así que se muestra en silencio,
      // se cierra al instante y la pantalla consulta de una vez.
      await self.registration.showNotification(aviso.title, { ...opciones, silent: true });
      for (const n of await self.registration.getNotifications({ tag: aviso.tag })) n.close();
      mirando.postMessage({ tipo: "consultar" });
    }),
  );
});

// Tocar el aviso abre la app. Si ya estaba abierta, la trae al frente sin recargarla y le pide abrir lo del aviso (el
// chat de una conversación); al abrir, sincroniza sola. Solo abre direcciones de la propia app: un aviso con otra
// abriría otro sitio con la marca de TEINS.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  let destino = "/";
  try {
    const pedido = new URL((evento.notification.data && evento.notification.data.navigate) || "/", self.location.origin);
    if (pedido.origin === self.location.origin) destino = pedido.href;
  } catch {
    // Una dirección que no se entiende abre el inicio.
  }
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (!abierta) return self.clients.openWindow(destino);
      abierta.postMessage({ tipo: "abrir", navigate: destino });
      return abierta.focus();
    }),
  );
});
