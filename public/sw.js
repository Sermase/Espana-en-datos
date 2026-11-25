/* España en datos como app: funciona sin conexión con lo último que se vio.
   Páginas y datos: primero la red (siempre lo más fresco) y, sin conexión, la copia guardada.
   Código y estilos (/assets/, con huella en el nombre) e iconos: primero la copia, que nunca cambia.
   Tipografías de Google: la copia y se refresca por detrás. Mapas de teselas y el resto: sin tocar. */
const CACHE = 'eed-v1'
const BASE = new URL('./', self.location).href
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './iconos/icono-192.png'].map(u => new URL(u, BASE).href))).catch(() => {}))
  self.skipWaiting()
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
const guarda = (req, res) => { if (res && res.ok && res.type !== 'opaque') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)) } return res }
const redPrimero = req => fetch(req).then(r => guarda(req, r)).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match(new URL('./index.html', BASE).href) : undefined)).then(r => r || Response.error()))
const copiaPrimero = req => caches.match(req).then(r => r || fetch(req).then(x => guarda(req, x)))
const copiaYRefresca = req => caches.match(req).then(r => { const red = fetch(req).then(x => guarda(req, x)).catch(() => r); return r || red })
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const u = new URL(req.url)
  if (u.origin === self.location.origin && u.href.startsWith(BASE)) {
    if (req.mode === 'navigate' || /\.(json|html|webmanifest)$/.test(u.pathname) || u.pathname.endsWith('/')) return e.respondWith(redPrimero(req))
    if (/\/assets\/|\/iconos\/|\.(svg|png|woff2?)$/.test(u.pathname)) return e.respondWith(copiaPrimero(req))
    return
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(copiaYRefresca(req))
})
