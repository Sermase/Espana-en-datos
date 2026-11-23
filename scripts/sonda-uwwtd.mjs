// Sonda: datos UWWTD (depuradoras y aglomeraciones) de la Agencia Europea de Medio Ambiente. Escribe fuentes/sonda-uwwtd.json.
import { writeFileSync, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const tmp = '/tmp/uwwtd'; mkdirSync(tmp, { recursive: true })
const sh = (c) => execFileSync('bash', ['-c', c], { encoding: 'utf8', maxBuffer: 64e6, timeout: 900000 })
try {
  // la carpeta pública de la AEMA redirige a una descarga compartida
  out.cabeceras = sh(`curl -sSIL --max-time 60 'https://sdi.eea.europa.eu/webdav/datastore/public/eea_t_uwwtd-final_p_2023_v10_r00/' | grep -iE '^(HTTP|location|content-type|content-length|content-disposition)' | head -20`)
  sh(`curl -sSL --max-time 900 -o ${tmp}/t.zip 'https://sdi.eea.europa.eu/datashare/s/sptXqwkQr5g7Bp5/download'`)
  out.tamano = statSync(`${tmp}/t.zip`).size
  out.inicio = readFileSync(`${tmp}/t.zip`).subarray(0, 4).toString('hex')
  out.contenido = sh(`unzip -l ${tmp}/t.zip | head -60`)
  sh(`cd ${tmp} && unzip -o -q t.zip && (for z in $(find . -name '*.zip'); do unzip -o -q "$z" -d "$(dirname "$z")"; done) || true`)
  const csv = sh(`find ${tmp} -iname '*.csv'`).split('\n').filter(Boolean)
  out.csv = csv.map(p => `${p.slice(tmp.length)} ${statSync(p).size}`)
  for (const p of csv.filter(p => /uwwtp|agglo|dcp|T_UWWTPS|T_Agglomerations|UWWTPAgglos/i.test(p)).slice(0, 8)) {
    const txt = readFileSync(p, 'utf8')
    const lin = txt.split(/\r?\n/)
    const es = lin.filter(l => /(^|[,;"])ES[A-Z0-9_]*[,;"]/.test(l) || /"ES"/.test(l))
    out['tabla ' + p.slice(tmp.length)] = { cabecera: lin[0].slice(0, 3000), filas: lin.length, filasES: es.length, ejemplo: es.slice(0, 2).map(x => x.slice(0, 1500)) }
  }
} catch (e) { out.error = String(e.message).slice(-500) }
writeFileSync(here('../fuentes/sonda-uwwtd.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1).slice(0, 3000))
