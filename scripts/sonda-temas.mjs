// Sonda: servicio de descarga de la Agencia Europea de Medio Ambiente (datos E2a, casi en directo) para España.
// Pide la lista de ficheros Parquet de las últimas 48 horas, baja unos pocos y cuenta filas, columnas y fechas.
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { asyncBufferFromFile, parquetReadObjects, parquetMetadataAsync } from 'hyparquet'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/sonda-aire'; mkdirSync(tmp, { recursive: true })
const out = {}
const API = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net'
const iso = (t) => new Date(t).toISOString().slice(0, 19) + 'Z'
const cuerpo = (pol) => JSON.stringify({ countries: ['ES'], cities: [], pollutants: pol, dataset: 1, source: 'Api', dateTimeStart: iso(Date.now() - 48 * 3600e3), dateTimeEnd: iso(Date.now()), aggregationType: 'hour' })
const post = (ruta, body, f) => execFileSync('curl', ['-sSL', '--max-time', '300', '-X', 'POST', '-H', 'Content-Type: application/json', '--data', body, '-o', f, '-w', '%{http_code} %{content_type} %{size_download}', API + ruta], { encoding: 'utf8' })
try {
  for (const pol of [['NO2'], ['O3'], ['PM10'], ['PM2.5'], []]) {
    const f = `${tmp}/urls-${pol.join('') || 'todos'}.csv`
    out['urls ' + (pol.join() || 'todos')] = post('/ParquetFile/urls', cuerpo(pol), f)
    const urls = (await import('node:fs')).readFileSync(f, 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
    out['n ' + (pol.join() || 'todos')] = urls.length
    if (pol[0] === 'NO2') out.ejemplosUrl = urls.slice(0, 5)
    if (pol[0] === 'NO2') for (const u of urls.slice(0, 3)) {
      const g = `${tmp}/${u.split('/').pop()}`
      execFileSync('curl', ['-sSL', '--max-time', '120', '-o', g, u])
      const buf = await asyncBufferFromFile(g), meta = await parquetMetadataAsync(buf)
      const filas = await parquetReadObjects({ file: buf })
      out['parquet ' + u.split('/').pop()] = { bytes: statSync(g).size, filas: Number(meta.num_rows), columnas: meta.schema.map(s => s.name), primeras: filas.slice(0, 3), ultimas: filas.slice(-3) }
    }
  }
  // la descarga de todo junto en un zip
  const z = `${tmp}/todo.zip`
  out.zip = post('/ParquetFile', cuerpo(['NO2']), z)
  out.zipLista = execFileSync('bash', ['-c', `unzip -l ${z} | tail -5; unzip -l ${z} | wc -l`], { encoding: 'utf8' })
} catch (e) { out.error = String(e.message).slice(-500) }
// metadatos de las estaciones (coordenadas y tipo)
try { out.estaciones = execFileSync('curl', ['-sSL', '--max-time', '120', '-o', `${tmp}/meta.csv`, '-w', '%{http_code} %{size_download}', 'https://discomap.eea.europa.eu/App/AQViewer/download?fqn=Airquality_Dissem.b2g.measurements&f=csv'], { encoding: 'utf8' }) } catch (e) { out.estacionesError = String(e.message).slice(-200) }
writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, (k, v) => typeof v === 'bigint' ? Number(v) : v, 1))
console.log(JSON.stringify(out, (k, v) => typeof v === 'bigint' ? Number(v) : v).slice(0, 3000))
