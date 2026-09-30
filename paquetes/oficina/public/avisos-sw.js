/*
  Service worker de oficina, solo para avisos push (ADR-0023): no intercepta solicitudes ni guarda nada en
  caché, así que oficina sigue siendo una app en línea (ADR-0002).
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
      data: { navigate: aviso.navigate },
    }),
  );
});

// Tocar el aviso abre la app (o la trae al frente si ya estaba abierta); al abrir, sincroniza sola.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.navigate) || "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      return abierta ? abierta.focus() : self.clients.openWindow(destino);
    }),
  );
});
