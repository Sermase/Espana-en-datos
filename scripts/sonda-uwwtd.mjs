// Sonda: datos UWWTD (depuradoras y aglomeraciones) de la Agencia Europea de Medio Ambiente. Escribe fuentes/sonda-uwwtd.json.
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const curl = (u, extra = []) => execFileSync('curl', ['-sSL', '--max-time', '90', ...extra, '-A', 'Mozilla/5.0 espana-en-datos', u], { encoding: 'latin1', maxBuffer: 64e6 })
const prueba = (id, u, f = (t) => t.slice(0, 1500)) => { try { out[id] = f(curl(u)) } catch (e) { out[id] = 'ERROR ' + String(e.message).slice(-250) } }
const lista = (t) => [...t.matchAll(/href="([^"?]+)"/g)].map(m => m[1]).filter(x => !x.startsWith('/') || x.includes('eea_'))
const W = 'https://sdi.eea.europa.eu/webdav/datastore/public/'
for (const d of ['eea_t_uwwtd-final_p_2023_v10_r00/', 'eea_v_4258_100_m_uwwtd-tp_p_2022-2023_v10_r00/', 'eea_v_4258_100_m_uwwtd-tp-public_p_2022-2023_v10_r00/']) {
  prueba('dav ' + d, W + d, lista)
  if (Array.isArray(out['dav ' + d])) for (const s of out['dav ' + d].filter(x => x.endsWith('/') && !x.includes('..')).slice(0, 6)) prueba('dav ' + d + ' > ' + s, (s.startsWith('http') ? s : s.startsWith('/') ? 'https://sdi.eea.europa.eu' + s : W + d + s), lista)
}
prueba('dav raíz uwwtd', W, t => lista(t).filter(x => /uwwtd/i.test(x)))
const R = 'https://water.discomap.eea.europa.eu/arcgis/rest/services/UWWTD'
prueba('rest carpeta', `${R}?f=json`)
prueba('rest tp 2023', `${R}/SDI_TreatmentPlants_public_ETRS89_202412/MapServer?f=json`, t => t.slice(0, 1200))
prueba('rest tp query', `${R}/SDI_TreatmentPlants_public_ETRS89_202412/MapServer/0/query?where=${encodeURIComponent("countryCode='ES'")}&outFields=*&resultRecordCount=2&f=json`, t => t.slice(0, 3000))
writeFileSync(here('../fuentes/sonda-uwwtd.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1).slice(0, 3000))
