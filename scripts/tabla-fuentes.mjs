// Tabla interna de fuentes: lee los workflows y los scripts de descarga y escribe, para cada base de datos (script × organismo),
// el organismo, el script, cada cuánto se baja, el último periodo con dato, cuándo se bajó y la licencia.
// No usa la red. Escribe public/datos/fuentes.json. Se ejecuta en cada despliegue, después de las descargas.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const raiz = fileURLToPath(new URL('..', import.meta.url))
const leer = (p) => readFileSync(raiz + p, 'utf8')
const git = (...a) => { try { return execFileSync('git', a, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
const hoy = new Date().toISOString().slice(0, 10)

// Organismo y licencia de cada servidor. Es configuración (quién publica en cada dominio), no un dato.
const AGE = 'Reutilización libre citando la fuente (Ley 37/2007)'
const ORG = [
  [/(^|\.)ine\.es$/, 'INE', 'Instituto Nacional de Estadística', 'Reutilización libre citando al INE (aviso legal del INE)'],
  [/^ec\.europa\.eu$/, 'Eurostat', 'Eurostat (Comisión Europea)', 'CC BY 4.0'],
  [/(^|\.)ree\.es$/, 'REE', 'Red Eléctrica', 'Uso libre citando a Red Eléctrica (condiciones de REData)'],
  [/(^|\.)miteco\.gob\.es$|^sedeaplicaciones\.minetur\.gob\.es$/, 'MITECO', 'Ministerio para la Transición Ecológica', AGE],
  [/arcgis\.com$/, 'MITECO', 'Ministerio para la Transición Ecológica (boletín hidrológico, servicio ArcGIS)', AGE],
  [/(^|\.)eea\.europa\.eu$|eeadmz1-downloads/, 'AEMA', 'Agencia Europea de Medio Ambiente', 'CC BY 4.0'],
  [/(^|\.)cores\.es$/, 'CORES', 'Corporación de Reservas Estratégicas de Productos Petrolíferos', 'Reutilización citando a CORES'],
  [/(^|\.)dgt\.es$/, 'DGT', 'Dirección General de Tráfico', AGE],
  [/open-meteo\.com$/, 'Open-Meteo', 'Open-Meteo (reanálisis ERA5 y previsiones)', 'CC BY 4.0'],
  [/(^|\.)ecb\.europa\.eu$/, 'BCE', 'Banco Central Europeo', 'Reutilización libre citando al BCE'],
  [/meteoalarm\.org$/, 'AEMET', 'AEMET, vía MeteoAlarm', 'Uso libre citando la fuente (condiciones de MeteoAlarm)'],
  [/(^|\.)boe\.es$/, 'BOE', 'Boletín Oficial del Estado', AGE],
  [/(^|\.)ign\.es$/, 'IGN', 'Instituto Geográfico Nacional', 'CC BY 4.0'],
  [/igualdad\.gob\.es$/, 'Igualdad', 'Delegación del Gobierno contra la Violencia de Género', AGE],
  [/agenciatributaria\.gob\.es$/, 'AEAT', 'Agencia Tributaria', AGE],
  [/(^|\.)mir\.es$/, 'Interior', 'Ministerio del Interior', AGE],
  [/infosubvenciones\.es$/, 'BDNS', 'Base de Datos Nacional de Subvenciones (IGAE)', AGE + '; sin datos de personas físicas'],
  [/fomento\.gob\.es$|mivau\.gob\.es$|transportes\.gob\.es$/, 'Vivienda', 'Ministerio de Vivienda y Agenda Urbana', AGE],
  [/wikidata\.org$/, 'Wikidata', 'Wikidata (datos de apoyo: nombres y enlaces)', 'CC0'],
]
const SIN_ORG = /sermase\.github\.io|^github\.com$|wikipedia\.org$|w3\.org$|schema\.org$/

// 1) Workflows: qué script corre en qué paso y con qué condición.
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
function cronTexto(c) {
  const [m, h, , , d] = c.split(/\s+/)
  if (h.startsWith('*/')) return `cada ${h.slice(2)} h`
  const hora = `${h.padStart(2, '0')}:${m.padStart(2, '0')} UTC`
  return d === '*' ? `cada día, ${hora}` : `los ${DIAS[+d]}, ${hora}`
}
const pasos = [] // { flujo, nombre, cond, scripts[], crons[] }
for (const f of readdirSync(raiz + '.github/workflows').filter(f => /\.ya?ml$/.test(f))) {
  const t = leer('.github/workflows/' + f)
  const flujo = (t.match(/^name:\s*(.+)$/m) || [])[1] ?? f
  const crons = [...t.matchAll(/cron:\s*'([^']+)'/g)].map(m => m[1])
  const lineas = t.split('\n')
  let p = null
  for (const l of lineas) {
    const ini = l.match(/^\s{6}- (name|run|uses):\s*(.*)$/)
    if (ini) { if (p) pasos.push(p); p = { flujo, nombre: ini[1] === 'name' ? ini[2] : '', cond: '', scripts: [], crons } ; if (ini[1] === 'run') p.cuerpo = ini[2]; continue }
    if (!p) continue
    const c = l.match(/^\s{8}if:\s*(.*)$/); if (c) p.cond = c[1]
    p.cuerpo = (p.cuerpo ?? '') + '\n' + l
  }
  if (p) pasos.push(p)
}
for (const p of pasos) p.scripts = [...new Set([...(p.cuerpo ?? '').matchAll(/node scripts\/([\w-]+\.mjs)/g)].map(m => m[1]))]
function frecuencia(p) {
  const c = p.cond
  if (/hashFiles/.test(c)) return { txt: 'Una vez (se rehace a mano)', dias: null }
  let cr = p.crons
  if (c) {
    const igual = [...c.matchAll(/schedule == '([^']+)'/g)].map(m => m[1]), distinto = [...c.matchAll(/schedule != '([^']+)'/g)].map(m => m[1])
    if (igual.length) cr = igual
    else if (/event_name != 'push'/.test(c)) cr = cr.filter(x => !distinto.includes(x))
    else cr = []
  }
  if (!cr.length) return { txt: 'Solo a mano', dias: null }
  const dias = Math.min(...cr.map(x => x.split(/\s+/)[1].startsWith('*/') ? 0.1 : x.split(/\s+/)[4] === '*' ? 1 : 7))
  const txt = cr.some(x => x.split(/\s+/)[1].startsWith('*/')) ? 'Cada 2 horas' : cr.some(x => x.split(/\s+/)[4] === '*') ? `A diario${cr.filter(x => x.split(/\s+/)[4] === '*').length > 1 ? ` (${cr.filter(x => x.split(/\s+/)[4] === '*').length} veces)` : ''}` : cr.map(cronTexto).join(' y ')
  return { txt: txt.charAt(0).toUpperCase() + txt.slice(1), dias }
}

// 2) Último periodo con dato dentro de un JSON (fechas como «2026-09», «2025-T3», «2024» o años al frente de [año, valor]).
const RE_PER = /^((?:19|20)\d{2})(?:-(0[1-9]|1[0-2])(?:-(\d{2}))?|-T([1-4])|-S([12])|-Q([1-4]))?(?:[T ][\d:.]+Z?)?$/
const clave = (s) => { const m = String(s).match(RE_PER); if (!m) return null; const mes = m[2] ? +m[2] : m[4] ? +m[4] * 3 : m[6] ? +m[6] * 3 : m[5] ? +m[5] * 6 : 12; return `${m[1]}-${String(mes).padStart(2, '0')}-${m[3] ?? (m[2] ? '28' : '28')}` }
function ultimoPeriodo(j, conDia) {
  let mejor = null, mk = ''
  const tope = hoy
  const ver = (s) => { if (!conDia && /^\d{4}-\d{2}-\d{2}/.test(String(s))) return; const k = clave(s); if (k && k <= tope + 'z' && k.slice(0, 7) <= tope.slice(0, 7) && k > mk) { mk = k; mejor = String(s) } }
  const pila = [j]; let n = 0
  while (pila.length && n++ < 3e6) {
    const x = pila.pop()
    if (typeof x === 'string') { if (x.length <= 25) ver(x) }
    else if (Array.isArray(x)) { if (x.length > 2 && x.every(y => Number.isInteger(y) && y >= 1990 && y <= 2100)) ver(String(Math.max(...x))); if (x.length === 2 && Number.isInteger(x[0]) && x[0] >= 1990 && x[0] <= 2100 && typeof x[1] === 'number') ver(String(x[0])); for (const y of x) if (y && typeof y === 'object' || typeof y === 'string') pila.push(y) }
    else if (x && typeof x === 'object') { const a = x['año'] ?? x.anyo ?? x.year; if (Number.isInteger(a)) ver(x.trimestre ? `${a}-T${x.trimestre}` : x.mes ? `${a}-${String(x.mes).padStart(2, '0')}` : String(a)) }
    if (x && typeof x === 'object' && !Array.isArray(x)) for (const [k, v] of Object.entries(x)) { if (/^(generado|actualizado|descargado|updated|fecha_descarga)$/i.test(k)) continue; ver(k); pila.push(v) }
  }
  return mejor
}
const generadoDe = (j) => { for (const k of ['actualizado', 'generado', 'updated', 'descargado']) if (typeof j?.[k] === 'string') return j[k].slice(0, 10); return null }

// 3) Scripts de descarga
const fichas = []
const ignorar = /^(sonda|iconos|build-|capitales|tabla-fuentes|enlaces)/
for (const s of readdirSync(raiz + 'scripts').filter(f => f.endsWith('.mjs') && !ignorar.test(f)).sort()) {
  const src = leer('scripts/' + s)
  const cab = src.split('\n').filter(l => l.startsWith('//')).slice(0, 4).map(l => l.replace(/^\/\/\s?/, '')).join(' ').replace(/\s+/g, ' ').trim()
  const desc = cab.split(/(?<=[.:])\s/)[0].replace(/[:.]$/, '')
  const hosts = [...new Set([...src.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map(m => m[1].toLowerCase()))].filter(h => !SIN_ORG.test(h))
  const salidas = [...new Set([...src.matchAll(/((?:public|src)\/[\w/.-]+\.json)/g)].map(m => m[1]))].filter(p => !/resumen\.json$|fuentes\.json$/.test(p))
  // Las salidas de otro tema que el script solo lee (población, municipios) no son suyas: se quedan las que comparten carpeta con la principal o las que escribe.
  const escritas = salidas.filter(p => new RegExp(`(writeFileSync|OUT|out|here)\\([^)]*${p.split('/').slice(-2).join('/').replace(/[.]/g, '\\.')}|${p.split('/').at(-1).replace('.', '\\.')}`).test(src))
  const paso = pasos.find(p => p.scripts.includes(s))
  const fr = paso ? frecuencia(paso) : { txt: 'No está en ningún workflow', dias: null }
  const eurostat = hosts.includes('ec.europa.eu') ? [...new Set([...src.matchAll(/['"`]([a-z]{2,8}_[a-z0-9]{2,}(?:_[a-z0-9]+)*)['"`]/g)].map(m => m[1]))].filter(c => !/^(utf_|user_|en_|es_|lang_|no_|sin_|con_|por_|tipo_|total_)/.test(c)).slice(0, 40) : []
  const ine = hosts.some(h => /ine\.es$/.test(h)) ? [...new Set([...src.matchAll(/\b(?:tabla|TABLA|t|id)\s*[(:=]\s*(\d{4,5})\b|DATOS_TABLA\/(\d{4,5})|\b(\d{4,5})\s*(?:,\s*\/\/|\/\/)/g)].map(m => m[1] ?? m[2] ?? m[3]))].slice(0, 40) : []
  // Último dato y fecha de descarga de cada salida
  const ficheros = []
  const propias = (escritas.length ? escritas : salidas)
  const carpeta = s.replace(/(-extra|-ahora|-normales)?\.mjs$/, '')
  const mias = propias.filter(p => p.includes('/' + carpeta + '/') || (carpeta === 'update-data' && /agua|data\//.test(p)) || (/saneamiento|depuradoras/.test(carpeta) && /agua/.test(p)))
  const lista = mias.length ? mias : propias.length ? propias : existsSync(raiz + `public/${carpeta}/data`) ? readdirSync(raiz + `public/${carpeta}/data`).filter(f => f.endsWith('.json')).map(f => `public/${carpeta}/data/${f}`) : []
  for (const p of lista) {
    if (!existsSync(raiz + p)) continue
    let j = null; try { j = JSON.parse(readFileSync(raiz + p, 'utf8')) } catch { continue }
    const enGit = git('ls-files', '--error-unmatch', p) != null
    const cambiado = enGit && git('diff', '--quiet', 'HEAD', '--', p) === null
    const bajado = generadoDe(j) ?? (!enGit || cambiado ? statSync(raiz + p).mtime.toISOString().slice(0, 10) : git('log', '-1', '--format=%cs', '--', p))
    ficheros.push({ p, ultimo: ultimoPeriodo(j, /(hoy|ahora|snapshot|history|historia)\.json$/.test(p)), bajado, kb: Math.round(statSync(raiz + p).size / 1024) })
  }
  const tema = s === 'update-data.mjs' ? 'agua' : s === 'poblacion.mjs' ? 'poblacion' : (ficheros[0]?.p ?? escritas[0] ?? salidas[0] ?? '').match(/^(?:public|src)\/(\w+)\//)?.[1] ?? null
  const orgs = new Map()
  for (const h of hosts) { const o = ORG.find(([re]) => re.test(h)); const k = o ? o[1] : h; if (!orgs.has(k)) orgs.set(k, { id: k, n: o ? o[2] : h, lic: o ? o[3] : 'Sin comprobar', hosts: [] }); orgs.get(k).hosts.push(h) }
  fichas.push({ script: s, desc, tema, flujo: paso?.flujo ?? null, paso: paso?.nombre ?? null, frecuencia: fr.txt, cadaDias: fr.dias, orgs: [...orgs.values()], eurostat, ine, ficheros })
}
mkdirSync(raiz + 'public/datos', { recursive: true })
writeFileSync(raiz + 'public/datos/fuentes.json', JSON.stringify({ generado: new Date().toISOString(), commit: git('rev-parse', '--short', 'HEAD'), scripts: fichas }, null, 1))
console.log('ok', fichas.length, 'scripts', fichas.reduce((t, f) => t + f.orgs.length, 0), 'bases')
