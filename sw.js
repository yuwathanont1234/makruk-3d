// Service worker แบบ network-first: ออนไลน์ = ของสดเสมอ, ใช้ cache เฉพาะตอนออฟไลน์
// (เลี่ยงปัญหา cache-first เสิร์ฟเวอร์ชันเก่าค้าง)
const CACHE = 'makruk-3d-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k)))); // ล้าง cache เก่า
      await self.clients.claim();
    })()
  )
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const idx = (await caches.match('./')) || (await caches.match(new URL('./', location).href));
          if (idx) return idx;
        }
        throw err;
      }
    })()
  );
});
