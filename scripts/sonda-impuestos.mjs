// Sonda para Impuestos: dónde publica la Agencia Tributaria las series mensuales de recaudación (Excel).
// Solo escribe fuentes/sonda-impuestos.json.
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const curl = (u) => execFileSync('curl', ['-sSL', '--max-time', '60', '-A', 'Mozilla/5.0 espana-en-datos', u], { encoding: 'latin1', maxBuffer: 64e6 })
const enlaces = (h, base) => [...h.matchAll(/href="([^"]+)"/g)].map(m => m[1]).map(x => x.startsWith('http') ? x : new URL(x, base).href)
try {
  const j = JSON.parse(curl('https://datos.gob.es/apidata/catalog/dataset/ea0028512-informe-mensual-de-recaudacion-tributaria.json'))
  const d = j.result?.items?.[0] ?? {}
  out.datosgob = { distribuciones: [].concat(d.distribution ?? []).map(x => `${x.format?.value ?? ''} ${x.accessURL}`), pagina: d.landingPage ?? d.identifier }
} catch (e) { out.datosgob = String(e.message).slice(0, 300) }
const paginas = [
  'https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Informe_mensual_de_Recaudacion_Tributaria.shtml',
  'https://sede.agenciatributaria.gob.es/Sede/estadisticas/recaudacion-tributaria/informes-mensuales.html',
  'https://sede.agenciatributaria.gob.es/Sede/estadisticas/recaudacion-tributaria.html',
  ...[].concat(out.datosgob?.pagina ?? []),
]
for (const p of paginas) {
  try {
    const h = curl(p)
    const ls = enlaces(h, p)
    out[p] = { bytes: h.length, excel: ls.filter(x => /\.xlsx?($|\?)/i.test(x)).slice(0, 40), paginas: ls.filter(x => /recaudaci|informe|mensual|series/i.test(x) && !/\.pdf/i.test(x)).slice(0, 30) }
    for (const q of out[p].paginas.slice(0, 6)) {
      try { const h2 = curl(q); out['  ' + q] = enlaces(h2, q).filter(x => /\.xlsx?($|\?)|series|\.csv/i.test(x)).slice(0, 40) } catch (e) { out['  ' + q] = String(e.message).slice(0, 120) }
    }
  } catch (e) { out[p] = String(e.message).slice(0, 200) }
}
writeFileSync(here('../fuentes/sonda-impuestos.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1).slice(0, 3000))
