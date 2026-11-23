import { geoArea } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import provRaw from '../provincias.json'

/** Provincias (IGN, simplificadas) con el sentido de los anillos corregido para d3 (si no, rellena «todo menos»). */
export const PROVINCIAS = (() => {
  const fc = JSON.parse(JSON.stringify(provRaw)) as FeatureCollection<Geometry, { id: string; n: string }>
  for (const f of fc.features) {
    const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] }
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
    for (const poly of polys) if (geoArea({ type: 'Polygon', coordinates: poly } as never) > 2 * Math.PI) poly.forEach(r => r.reverse())
  }
  return fc
})()

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
/** Nombre del INE (o casi) → código de provincia. «Coruña, A», «Alicante/Alacant», «Araba/Álava», «Palmas, Las»… */
const ALIAS: Record<string, string> = {
  alava: '01', araba: '01', albacete: '02', alicante: '03', alacant: '03', almeria: '04', avila: '05', badajoz: '06', balears: '07', baleares: '07', barcelona: '08', burgos: '09', caceres: '10',
  cadiz: '11', castellon: '12', castello: '12', 'ciudad real': '13', cordoba: '14', coruna: '15', cuenca: '16', girona: '17', gerona: '17', granada: '18', guadalajara: '19', gipuzkoa: '20', guipuzcoa: '20',
  huelva: '21', huesca: '22', jaen: '23', leon: '24', lleida: '25', lerida: '25', rioja: '26', lugo: '27', madrid: '28', malaga: '29', murcia: '30', navarra: '31', ourense: '32', orense: '32',
  asturias: '33', palencia: '34', palmas: '35', pontevedra: '36', salamanca: '37', 'santa cruz de tenerife': '38', cantabria: '39', segovia: '40', sevilla: '41', soria: '42', tarragona: '43',
  teruel: '44', toledo: '45', valencia: '46', valladolid: '47', bizkaia: '48', vizcaya: '48', zamora: '49', zaragoza: '50', ceuta: '51', melilla: '52',
}
export function codigoProvincia(nombre: string): string | null {
  const partes = nombre.split('/').map(norm)
  for (let p of partes) {
    const m = p.match(/^(.*) (a|el|la|las|los|illes)$/); if (m) p = m[1]
    if (ALIAS[p]) return ALIAS[p]
    const k = Object.keys(ALIAS).find(a => p === a || p.startsWith(a + ' '))
    if (k) return ALIAS[k]
  }
  return null
}
/** Comunidad autónoma del INE → el nombre corto que usamos («Madrid, Comunidad de» → «Madrid»). */
const CCAA: Record<string, string> = {
  andalucia: 'Andalucía', aragon: 'Aragón', 'asturias principado de': 'Asturias', 'balears illes': 'Illes Balears', canarias: 'Canarias', cantabria: 'Cantabria',
  'castilla la mancha': 'Castilla-La Mancha', 'castilla y leon': 'Castilla y León', cataluna: 'Cataluña', 'comunitat valenciana': 'C. Valenciana', extremadura: 'Extremadura',
  galicia: 'Galicia', 'madrid comunidad de': 'Madrid', 'murcia region de': 'Murcia', 'navarra comunidad foral de': 'Navarra', 'pais vasco': 'País Vasco', 'rioja la': 'La Rioja', ceuta: 'Ceuta', melilla: 'Melilla',
}
export const ccaaCorta = (nombre: string) => CCAA[norm(nombre)] ?? null
