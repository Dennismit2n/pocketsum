/*
 * Pocketsum — Service Worker: hält die App für den Start ohne Netz bereit.
 * Pocketsum ruft nichts aus dem Netz ab; der Worker legt nur die eigenen Dateien in den Cache.
 * Muster und Begründungen wie bei Heizwarte (dennismit2n.github.io/heizwarte).
 */
'use strict';

// Bei jedem Deploy, der index.html oder eine der Dateien unten ändert, um 1 erhöhen.
const CACHE = 'pocketsum-v1';

// Genau die Dateien, die index.html und das Manifest laden. Eine Datei, die es nicht gibt,
// ließe addAll und damit die ganze Installation scheitern.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// Am HTTP-Cache des Browsers vorbei laden (cache: 'reload'): GitHub Pages schickt jede Datei mit
// max-age=600, sonst landete womöglich eine zehn Minuten alte Fassung im Offline-Cache.
function fillShell(cache) {
  return cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(fillShell).then(() => self.skipWaiting()));
});

// Nur eigene alte Caches löschen. Cache Storage gehört dem ganzen Origin dennismit2n.github.io,
// die Caches der anderen Werkzeuge (bigday-…, heizwarte-…) dürfen nicht angefasst werden.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('pocketsum-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Manche Geschwister-Werkzeuge löschen beim Aktivieren jeden fremden Cache, also auch diesen.
// Fehlt ./index.html, obwohl das Netz antwortet, holt der Worker die ganze Hülle nach.
async function healShell(cache) {
  const index = await cache.match('./index.html');
  if (!index) { await fillShell(cache); }
}

async function answer(e) {
  const req = e.request;
  const isNav = req.mode === 'navigate';
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: isNav });

  // Netzantwort holen und, wenn sie in Ordnung ist, für das nächste Mal ablegen (nie ein 404).
  // Eine Navigation fragt immer beim Server nach (bedingte Anfrage, meist nur 304).
  let stored = null;
  const net = fetch(req, isNav ? { cache: 'no-cache' } : undefined).then(r => {
    if (r.ok) {
      // Navigationen ohne Abfrage ablegen: sonst legte jeder geteilte Link mit ?fbclid=… eine eigene
      // Kopie der ganzen Seite an, die bis zum nächsten Versionswechsel liegen bliebe.
      let key = req;
      if (isNav) { const u = new URL(req.url); u.search = ''; key = u.href; }
      stored = cache.put(key, r.clone()).catch(console.error);
    }
    return r;
  });

  const after = net.then(
    () => Promise.resolve(stored).then(() => (isNav ? healShell(cache).catch(console.error) : null)),
    () => null
  );
  e.waitUntil(after);

  // Stale-while-revalidate: den Altbestand sofort liefern, die Netzantwort erneuert ihn nebenbei.
  if (hit) { return hit; }

  try {
    return await net;
  } catch (err) {
    if (isNav) {
      const index = await cache.match('./index.html');
      if (index) { return index; }
    }
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) { return; }
  // Nur Anfragen unterhalb von /pocketsum/ – die Nachbar-Werkzeuge haben ihre eigenen Worker.
  if (!new URL(req.url).pathname.startsWith(new URL('./', self.location).pathname)) { return; }
  e.respondWith(answer(e));
});
