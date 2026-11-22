/* Home AI service worker: notifications only (no caching, so updates always show up). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: "Home AI", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Home AI", {
    body: d.body || "",
    tag: d.tag,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if ("focus" in c) { await c.focus(); c.postMessage({ url }); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
