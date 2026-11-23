// Mapa del mundo para Comercio: world-atlas (Natural Earth, 1:110M) con código ISO de dos letras y nombre en español.
// Uso: node scripts/build-mundo.mjs  → public/comercio/data/mundo.json
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const iso = require('i18n-iso-countries')
iso.registerLocale(require('i18n-iso-countries/langs/es.json'))
const w = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'))
const raros = { '-99': null }
for (const g of w.objects.countries.geometries) {
  const a2 = g.id && !raros[g.id] ? iso.numericToAlpha2(g.id) : null
  g.properties = { a2: a2 ?? null, n: (a2 && iso.getName(a2, 'es', { select: 'alias' })) || g.properties.name }
}
delete w.objects.land
writeFileSync(new URL('../public/mundo.json', import.meta.url), JSON.stringify(w))
console.log(w.objects.countries.geometries.length, 'países;', w.objects.countries.geometries.filter(g => !g.properties.a2).map(g => g.properties.n).join(', '))
