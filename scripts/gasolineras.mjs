// Precios de hoy en todas las gasolineras de España (Ministerio para la Transición Ecológica).
// Escribe public/gasolineras/data/hoy.json, añade el día a historia.json y actualiza src/resumen.json.
// Uso: node scripts/gasolineras.mjs        (Node 20+; sin dependencias)
//
// Fuente: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/
// Sin Accept: application/json el servicio contesta en XML.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DIR = here('../public/gasolineras/data/')
const URL_ = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/'

// Combustibles que se publican: clave corta → campo del ministerio
const FUELS = {
  g95: 'Precio Gasolina 95 E5',
  dsl: 'Precio Gasoleo A',
  g98: 'Precio Gasolina 98 E5',
  dslp: 'Precio Gasoleo Premium',
  glp: 'Precio Gases licuados del petróleo',
}

async function get() {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(URL_, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const j = await r.json()
      if (!j.ListaEESSPrecio?.length) throw new Error('lista vacía')
      return j
    } catch (e) {
      console.warn('Intento', i + 1, 'fallido:', e.message)
      await new Promise(s => setTimeout(s, 5000 * (i + 1)))
    }
  }
  throw new Error('El servicio de carburantes no responde')
}

const num = (s) => { const v = parseFloat(String(s ?? '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null }
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000
const title = (s) => String(s ?? '').trim().toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())

const j = await get()
// «23/11/2026 0:28:36» → 2026-11-23T00:28
const [d, t] = j.Fecha.split(' '), [dd, mm, yy] = d.split('/'), [hh, mi] = t.split(':')
const fecha = `${yy}-${mm}-${dd}T${hh.padStart(2, '0')}:${mi}`

const provs = new Map(), ccaa = new Map(), brands = new Map()
const rows = []
for (const e of j.ListaEESSPrecio) {
  const lat = num(e.Latitud), lon = num(e['Longitud (WGS84)'])
  if (lat == null || lon == null) continue
  const lonS = String(e['Longitud (WGS84)']).trim().startsWith('-') ? -Math.abs(lon) : lon
  const p = e.IDProvincia, c = e.IDCCAA
  if (!provs.has(p)) provs.set(p, { n: title(e.Provincia), c })
  const brand = String(e['Rótulo'] ?? '').trim().toUpperCase() || 'SIN RÓTULO'
  if (!brands.has(brand)) brands.set(brand, brands.size)
  const prices = Object.values(FUELS).map(k => r3(num(e[k])))
  if (prices.every(v => v == null)) continue
  rows.push([
    Number(e.IDEESS), +lat.toFixed(5), +lonS.toFixed(5), brands.get(brand), title(e.Municipio), p,
    ...prices,
    /24\s*H/i.test(e.Horario ?? '') ? 1 : 0,
    title(e['Dirección']),
    e['Tipo Venta'] === 'R' ? 1 : 0,
  ])
}

// Medianas (las medias se las comen las gasolineras raras): España, comunidad y provincia
const col = Object.keys(FUELS)
const stats = (list) => Object.fromEntries(col.map((k, i) => [k, r3(median(list.map(r => r[6 + i]).filter(v => v != null)))]))
const pub = rows.filter(r => !r[13])
const byProv = {}
for (const [p] of provs) byProv[p] = { ...stats(pub.filter(r => r[5] === p)), n: pub.filter(r => r[5] === p).length }

const hoy = {
  fecha, fuels: col,
  cols: ['id', 'lat', 'lon', 'marca', 'municipio', 'prov', ...col, 'h24', 'dir', 'restringida'],
  marcas: [...brands.keys()],
  provincias: Object.fromEntries([...provs].map(([id, v]) => [id, { ...v, ...byProv[id] }])),
  espana: { ...stats(pub), n: pub.length },
  rows,
}
writeFileSync(DIR + 'hoy.json', JSON.stringify(hoy))

// Historia: una fila por día con la mediana de España y de cada provincia
let hist = { dias: [] }
try { hist = JSON.parse(readFileSync(DIR + 'historia.json', 'utf8')) } catch {}
const dia = fecha.slice(0, 10)
hist.dias = hist.dias.filter(x => x.d !== dia)
hist.dias.push({ d: dia, es: Object.fromEntries(col.map(k => [k, hoy.espana[k]])), p: Object.fromEntries(Object.entries(byProv).map(([id, v]) => [id, [v.g95, v.dsl]])) })
hist.dias.sort((a, b) => a.d.localeCompare(b.d))
writeFileSync(DIR + 'historia.json', JSON.stringify(hist))

const RES = here('../src/resumen.json')
const res = JSON.parse(readFileSync(RES, 'utf8'))
res.gasolineras = { fecha, g95: hoy.espana.g95, dsl: hoy.espana.dsl, n: hoy.espana.n }
writeFileSync(RES, JSON.stringify(res, null, 1))
console.log(`Gasolineras: ${rows.length} estaciones · 95 ${hoy.espana.g95} €/l · diésel ${hoy.espana.dsl} €/l · ${fecha}`)
