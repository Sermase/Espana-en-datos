// Sonda: Índice de Calidad del Aire del ministerio (qué API usa su visor) y los datos casi en directo de la Agencia Europea.
// Escribe fuentes/sonda-temas.json.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/sonda-temas'; mkdirSync(tmp, { recursive: true })
const out = {}
let n = 0
function get(url, { max = 90, cabeza = 1500, metodo, datos, tipo } = {}) {
  const f = `${tmp}/${++n}`
  try {
    const args = ['-sSL', '--max-time', String(max), '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-H', 'Accept: application/json, text/plain, */*', '-H', 'Origin: https://ica.miteco.es', '-H', 'Referer: https://ica.miteco.es/', '-o', f, '-w', '%{http_code} %{content_type}']
    if (metodo) args.push('-X', metodo)
    if (datos) args.push('-H', `Content-Type: ${tipo ?? 'application/json'}`, '--data', datos)
    const meta = execFileSync('curl', [...args, url], { encoding: 'utf8', timeout: (max + 10) * 1000 })
    const [code, ct] = meta.split(' ')
    const txt = readFileSync(f, 'utf8')
    return { code: +code, ct, size: statSync(f).size, cabeza: txt.slice(0, cabeza), txt }
  } catch (e) { return { error: String(e.message).slice(-300) } }
}
const sin = ({ txt, ...r }) => r

// 1. El JS del visor: todas las cadenas que parecen rutas del API
const html = get('https://ica.miteco.es/').txt ?? ''
const js = [...html.matchAll(/src="([^"]*main[^"]*\.js)"/g)].map(m => m[1])
out.js = js
for (const j of js) {
  const t = get('https://ica.miteco.es/' + j.replace(/^\.?\//, ''), { cabeza: 0 }).txt ?? ''
  const i = t.indexOf('backend.ica.miteco.es')
  out.alrededor = t.slice(Math.max(0, i - 1500), i + 2500)
  out.rutas = [...new Set([...t.matchAll(/["'`](\/?[a-zA-Z][\w-]*(?:\/[\w{}:$.-]+)+\/?)["'`]/g)].map(m => m[1]).filter(r => !/^(\.\/|assets|http)/.test(r) && r.length < 80))].slice(0, 200)
  // solo las rutas GET del API (las que el visor pide con queryGet); las consultas SQL por POST no se tocan
  out.queryGet = [...new Set([...t.matchAll(/queryGet\(\s*([`"'])([^`"']+)\1([^)]{0,200})/g)].map(m => m[2] + ' ' + m[3].slice(0, 200)))].slice(0, 60)
  out.palabras = [...new Set([...t.matchAll(/["'`]([a-z][a-zA-Z]*(?:Ica|ica|Estacion|estacion|Indice|indice|Medida|medida|Contaminante|contaminante|Prevision|prevision)[a-zA-Z]*)["'`]/g)].map(m => m[1]))].slice(0, 100)
}
// 2. Las rutas GET que usa el visor, tal cual (sin parámetros de más)
for (const r of (out.queryGet ?? []).map(x => x.split(' ')[0]).filter(r => !r.includes('$')).slice(0, 12))
  out['ica ' + r] = sin(get('https://backend.ica.miteco.es/sgca/' + r, { cabeza: 1500 }))
writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v?.code ?? ''} ${v?.size ?? ''}`).join('\n'))
