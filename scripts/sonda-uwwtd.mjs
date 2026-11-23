// Sonda: tablas UWWTD de la Agencia Europea de Medio Ambiente, por el WebDAV de su enlace público. Escribe fuentes/sonda-uwwtd.json.
import { writeFileSync, mkdirSync, statSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const tmp = '/tmp/uwwtd'; mkdirSync(tmp, { recursive: true })
const sh = (c, t = 300000) => execFileSync('bash', ['-c', c], { encoding: 'utf8', maxBuffer: 64e6, timeout: t })
const DAV = 'https://sdi.eea.europa.eu/datashare/public.php/webdav'
const AUTH = "-u 'sptXqwkQr5g7Bp5:'"
const ls = (p) => { const x = sh(`curl -sS --max-time 60 ${AUTH} -X PROPFIND -H 'Depth: 1' '${DAV}${p}'`); return [...x.matchAll(/<d:href>([^<]+)<\/d:href>[\s\S]*?(?:<d:getcontentlength>(\d+)<\/d:getcontentlength>)?/g)].map(m => `${decodeURIComponent(m[1]).replace(/^.*webdav/, '')} ${m[2] ?? ''}`) }
try {
  out.raiz = ls('/eea_t_uwwtd-final_p_2023_v10_r00/')
  for (const d of out.raiz.map(x => x.split(' ')[0]).filter(x => x.endsWith('/') && x !== '/eea_t_uwwtd-final_p_2023_v10_r00/')) out['ls ' + d] = ls(d)
  out.tp = ls('/eea_v_4258_100_m_uwwtd-tp_p_2022-2023_v10_r00/')
} catch (e) { out.errorLs = String(e.message).slice(-400) }
// los CSV de depuradoras y aglomeraciones, si están sueltos
try {
  const todos = Object.values(out).flat().filter(x => typeof x === 'string').map(x => x.split(' ')[0])
  const csv = todos.filter(x => /\.(csv|zip)$/i.test(x) && /uwwtp|agglo|csv/i.test(x)).slice(0, 6)
  out.elegidos = csv
  for (const p of csv) {
    const f = `${tmp}/${p.split('/').pop()}`
    sh(`curl -sS --max-time 600 ${AUTH} -o '${f}' '${DAV}${encodeURI(p)}'`, 650000)
    out['bajado ' + p] = statSync(f).size
    if (/\.csv$/i.test(f)) {
      const lin = readFileSync(f, 'utf8').split(/\r?\n/)
      const es = lin.filter(l => /(^|[,;"\t])ES[A-Z0-9_]*([,;"\t]|$)/.test(l))
      out['tabla ' + p] = { cabecera: lin[0].slice(0, 3000), filas: lin.length, filasES: es.length, ejemplo: es.slice(0, 2).map(x => x.slice(0, 1500)) }
    } else out['zip ' + p] = sh(`unzip -l '${f}' | head -40`)
  }
} catch (e) { out.errorCsv = String(e.message).slice(-400) }
writeFileSync(here('../fuentes/sonda-uwwtd.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1).slice(0, 3000))
