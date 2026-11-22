// Comprueba fuentes candidatas para temas futuros y guarda qué responde en fuentes/sondas.json.
// No falla nunca: es solo un informe.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const URLS = {
  renfe_gtfs_av_ld_md: 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
  renfe_gtfs_cercanias: 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip',
  renfe_rt_posiciones_json: 'https://gtfsrt.renfe.com/vehicle_positions.json',
  renfe_rt_posiciones_pb: 'https://gtfsrt.renfe.com/vehicle_positions.pb',
  renfe_rt_retrasos_json: 'https://gtfsrt.renfe.com/trip_updates.json',
  renfe_ld_flota: 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json',
}
const out = { fecha: new Date().toISOString(), fuentes: {} }
for (const [k, u] of Object.entries(URLS)) {
  try {
    const r = await fetch(u, { headers: { Origin: 'https://sermase.github.io', 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
    const buf = Buffer.from(await r.arrayBuffer())
    out.fuentes[k] = {
      url: u, status: r.status, bytes: buf.length, tipo: r.headers.get('content-type'),
      cors: r.headers.get('access-control-allow-origin'),
      muestra: /json|text/.test(r.headers.get('content-type') ?? '') ? buf.toString('utf8', 0, 600) : null,
    }
  } catch (e) { out.fuentes[k] = { url: u, error: String(e.message ?? e) } }
}
writeFileSync(fileURLToPath(new URL('../fuentes/sondas.json', import.meta.url)), JSON.stringify(out, null, 1))
console.log(Object.entries(out.fuentes).map(([k, v]) => `${k}: ${v.status ?? v.error} ${v.bytes ?? ''} cors=${v.cors ?? '-'}`).join('\n'))
