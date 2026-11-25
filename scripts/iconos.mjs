// Iconos de la app instalable: España hecha de puntos de datos sobre fondo oscuro (como la entrada de la portada).
// Uso: node scripts/iconos.mjs → public/iconos/*.png y public/iconos/icono.svg. Necesita Chrome (playwright) para pasar el SVG a PNG.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { geoMercator, geoPath, geoArea } from 'd3-geo'
import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const prov = JSON.parse(readFileSync(here('../src/provincias.json'), 'utf8'))
// península y Baleares (Canarias, Ceuta y Melilla no caben en un icono pequeño)
prov.features = prov.features.filter(f => !['35', '38', '51', '52'].includes(String(f.properties.cod ?? f.properties.codigo ?? f.id ?? '').padStart(2, '0')) && !/palmas|tenerife|ceuta|melilla/i.test(JSON.stringify(f.properties)))
const topo = topology({ p: prov })
let es = merge(topo, topo.objects.p.geometries)
// sentido de los anillos para d3
es.coordinates = es.coordinates.map(pol => pol.map(r => { const g = { type: 'Polygon', coordinates: [r] }; return geoArea(g) > 2 * Math.PI ? r.slice().reverse() : r }))
const svgDe = (S, pad, redondeo) => {
  const p = geoMercator().fitExtent([[S * pad, S * pad * 1.15], [S * (1 - pad), S * (1 - pad * 0.85)]], es), d = geoPath(p)(es)
  const [[x0, y0], [x1, y1]] = geoPath(p).bounds(es)
  const paso = S / 30, r = paso * 0.32
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
 <radialGradient id="fondo" cx="70%" cy="20%" r="95%"><stop offset="0" stop-color="#0b2a38"/><stop offset=".55" stop-color="#05121b"/><stop offset="1" stop-color="#03090f"/></radialGradient>
 <linearGradient id="tinta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".35" stop-color="#3fe6ff"/><stop offset=".7" stop-color="#9f8cff"/><stop offset="1" stop-color="#ff6b9a"/></linearGradient>
 <pattern id="puntos" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse"><circle cx="${paso / 2}" cy="${paso / 2}" r="${r}" fill="#fff"/></pattern>
 <mask id="m"><path d="${d}" fill="url(#puntos)"/></mask>
 <filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${S / 90}"/></filter>
</defs>
<rect width="${S}" height="${S}" rx="${redondeo * S}" fill="url(#fondo)"/>
<path d="${d}" fill="#3fe6ff" opacity=".18" filter="url(#brillo)"/>
<path d="${d}" fill="none" stroke="#3fe6ff" stroke-opacity=".55" stroke-width="${S / 160}"/>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#tinta)" mask="url(#m)"/>
</svg>`
}
mkdirSync(here('../public/iconos'), { recursive: true })
const piezas = [['icono-192', 192, 0.13, 0.22], ['icono-512', 512, 0.13, 0.22], ['icono-mascara-512', 512, 0.2, 0], ['apple-touch-icon', 180, 0.12, 0]]
writeFileSync(here('../public/iconos/icono.svg'), svgDe(512, 0.13, 0.22))
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright')
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--no-sandbox'] })
const pg = await b.newPage()
for (const [n, S, pad, rr] of piezas) {
  await pg.setViewportSize({ width: S, height: S })
  await pg.setContent(`<html><body style="margin:0;background:transparent">${svgDe(S, pad, rr)}</body></html>`)
  await pg.locator('svg').screenshot({ path: here(`../public/iconos/${n}.png`), omitBackground: true })
}
await b.close()
console.log('Iconos listos')
