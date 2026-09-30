/*
  Avisos push (ADR-0023). El service worker que genera vite-plugin-pwa importa este archivo.
  Safari 18.4 o posterior muestra el formato declarativo ("web_push": 8030) sin este código; Chrome,
  Android y los Safari anteriores lo muestran aquí, con los mismos campos.
*/
self.addEventListener("push", (evento) => {
  let datos;
  try {
    datos = evento.data ? evento.data.json() : null;
  } catch {
    return;
  }
  const aviso = datos && datos.notification;
  if (!aviso || !aviso.title) return;
  evento.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      tag: aviso.tag,
      lang: aviso.lang,
      dir: aviso.dir,
      icon: "/icono-192.png",
      data: { navigate: aviso.navigate },
    }),
  );
});

// Tocar el aviso abre la app (o la trae al frente si ya estaba abierta, sin recargarla ni cambiarle la
// pantalla); al abrir, sincroniza sola. Solo abre direcciones de la propia app: un aviso con otra abriría
// otro sitio con la marca de TEINS.
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
      return abierta ? abierta.focus() : self.clients.openWindow(destino);
    }),
  );
});
