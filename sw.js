/* RepForge service worker: works offline after the first online load.
   - app files: network first, fall back to cache
   - Firebase modules (gstatic, versioned URLs): cache first, saved on first load
   - Firestore / Auth calls go straight to the network */
const CACHE = 'repforge-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // add files one by one so a single missing file doesn't break the install
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const own = u.origin === location.origin;
  const lib = u.hostname === 'www.gstatic.com';
  if (!own && !lib) return;

  const save = res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  };

  if (lib) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(save)));
    return;
  }

  e.respondWith(
    fetch(r).then(save).catch(() =>
      caches.match(r, { ignoreSearch: true })
        .then(m => m || (r.mode === 'navigate' ? caches.match('./index.html').then(x => x || caches.match('./')) : undefined))
    )
  );
});
