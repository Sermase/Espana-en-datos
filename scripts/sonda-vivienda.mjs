// Sonda 4 de Vivienda: rastrea el portal «El Catastro en cifras» buscando los CSV de titulares. Escribe fuentes/sonda-vivienda4.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const BASE = 'https://www.catastro.hacienda.gob.es/estadisticas/'
const out = { paginas: {}, ficheros: [] }
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (espana-en-datos; sonda)' }, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text() }
const vistas = new Set(), cola = [[BASE + 'catastroencifras.html', 0], [BASE + 'estadisticas.html', 0]]
while (cola.length && vistas.size < 40) {
  const [u, d] = cola.shift()
  if (vistas.has(u)) continue
  vistas.add(u)
  try {
    const t = await get(u)
    const hs = [...new Set([...t.matchAll(/href="([^"#]+)"/g)].map(m => { try { return new URL(m[1].replace(/&amp;/g, '&'), u).href } catch { return null } }).filter(Boolean))]
    out.paginas[u] = { n: hs.length, titulo: (t.match(/<title>([^<]*)/) || [])[1], clave: hs.filter(h => /catastro\.hacienda/.test(h) && /titular|propiedad|csv|xls|zip|urbana/i.test(h)).slice(0, 60) }
    for (const h of hs) {
      if (/\.(csv|xlsx?|zip)(\?|$)/i.test(h)) out.ficheros.push(h)
      else if (d < 2 && /catastro\.hacienda\.gob\.es\/(estadisticas|esp)\/.*\.(html?|asp)$/i.test(h) && /titular|propiedad|cifras|urbana|catastro|estadistic/i.test(h)) cola.push([h, d + 1])
    }
  } catch (e) { out.paginas[u] = String(e.message) }
}
out.ficheros = [...new Set(out.ficheros)]
writeFileSync(here('../fuentes/sonda-vivienda4.json'), JSON.stringify(out, null, 1))
console.log('ok', out.ficheros.length)
