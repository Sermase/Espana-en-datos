// Comprueba que los enlaces a las fuentes siguen vivos (los organismos cambian sus webs).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const F = JSON.parse(readFileSync(here('../src/fuentes.json'), 'utf8'))
const ser = JSON.parse(readFileSync(here('../public/economia/data/series.json'), 'utf8'))
const tablas = [...new Set(Object.values(ser.temas).flatMap(t => Object.values(t).flatMap(s => s.tablas ?? [])))]
const urls = [...Object.entries(F).map(([k, v]) => [k, v.u]), ...tablas.map(c => ['eurostat:' + c, `https://ec.europa.eu/eurostat/databrowser/view/${c}/default/table?lang=es`])]
const out = {}
for (const [k, u] of urls) {
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; comprobación de enlaces)' } })
    const txt = await r.text()
    out[k] = `${r.status} ${r.url === u ? '' : '→ ' + r.url} · ${(txt.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '').trim().slice(0, 90)}`
  } catch (e) { out[k] = 'ERROR ' + e.message }
}
writeFileSync(here('../fuentes/enlaces-log.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).filter(([, v]) => !v.startsWith('200')).map(([k, v]) => k + ' ' + v).join('\n') || 'Todos los enlaces responden')
