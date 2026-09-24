/* NuNa · sw.js — service worker do app instalavel (PWA).
   Sempre busca na rede primeiro, entao codigo e dados ficam sempre atuais;
   so usa a copia guardada se estiver sem internet. Nada do banco (Supabase)
   e guardado aqui: so as paginas e arquivos do proprio site. */
var CACHE = 'nuna-shell-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
    return res;
  }).catch(function () { return caches.match(req); }));
});
