// Sonda para Impuestos: baja los Excel de la Agencia Tributaria a fuentes/aeat/ para estudiar su estructura.
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const D = here('../fuentes/aeat/'); mkdirSync(D, { recursive: true })
const B = 'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/'
for (const f of ['Cuadros_estadisticos_series_es_es.xlsx', 'Serie_mensual_graficos_es_es.xlsx', 'Ingresos_por_Delegaciones.xlsx'])
  try { execFileSync('curl', ['-sSfL', '--max-time', '120', '-A', 'Mozilla/5.0 espana-en-datos', '-o', D + f, B + f]); console.log('ok', f) } catch (e) { console.log('ERROR', f, e.message) }
