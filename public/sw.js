// COURTSIDE Service Worker — Web Push 전용 (캐싱 X, MVP)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "COURTSIDE", body: "새 알림이 도착했어요" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (e) {
    // 텍스트 fallback
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (_) {
      /* ignore */
    }
  }
  const { title, body, url, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || "courtside-default",
      data: { url: url || "/" },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      // 이미 열려있는 탭이 있으면 거기로 focus
      for (const client of clientsArr) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
