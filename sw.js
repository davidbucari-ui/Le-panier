/* Service worker minimal : requis pour que le navigateur propose l'installation.
   Réseau d'abord (les données sont synchronisées par Supabase) ; aucune mise en cache. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request))});
