import snapshot from './data/snapshot.json'
import basinsGeo from './data/basins.json'
import landGeo from './data/land.json'
import riversGeo from './data/rivers.json'
import regionsGeo from './data/regions.json'
import consumoData from './data/consumo.json'
import type { FeatureCollection, Geometry } from 'geojson'

/** Un embalse del Boletín Hidrológico (MITECO). Volúmenes en hm³, energía en GWh. */
export type Reservoir = {
  id: number; n: string; x: number; y: number
  a: number; c: number // agua actual / capacidad
  e: number; ec: number // energía actual / capacidad energética
  d: number // variación semanal hm³
  h: 0 | 1 // uso hidroeléctrico
  b: string // demarcación
  riv?: string // río (Inventario de presas)
  hm?: number // altura de la presa desde cimientos, m
}
export type Flow = { n: string; r: string; e: 0 | 1; q: number; qa: number | null; x: number; y: number }
export type RainGauge = { n: string; z: string; p: number; x: number; y: number }
export type Discharger = { n: string; m: string; pr: string; v: number; c: string; t: string; x: number; y: number }

type Snapshot = {
  meta: {
    boletin: string; fecha: string; note: string
    national: { a: number; c: number; d: number; prevYear: number; avg10: number }
  }
  basins: Record<string, string>
  reservoirs: Reservoir[]
  rain: RainGauge[]
  dischargers: Discharger[]
  flows: Flow[]
  /** Producción hidráulica diaria de REE (MWh). La rellena scripts/update-data.mjs. */
  hydro?: { days: { d: string; mwh: number }[] }
}

export const data = snapshot as unknown as Snapshot
export const basins = basinsGeo as unknown as FeatureCollection<Geometry, { id: string; name: string }>
export const land = landGeo as unknown as FeatureCollection
export const regions = regionsGeo as unknown as FeatureCollection<Geometry, { name: string }>
/** Abastecimiento y saneamiento de una comunidad (INE). Volúmenes de la red en hm³ al año; tratada y reutilizada en m³ al día. */
export type RegionUse = {
  n: string; l: number; v: number | null; cost: number | null
  supplied?: number; registered?: number; lossReal?: number; lossApparent?: number; lossPct?: number | null; lossPctPrev?: number | null; households?: number
  treated?: number | null; reused?: number | null; reusePct?: number | null; reusePctPrev?: number | null
  dest?: Record<string, number | null>; usos?: Record<string, number | null>; sewerKm?: number | null; supplyKm?: number | null; sludge?: number | null
}
export const consumo = consumoData as unknown as { year: number; prevYear?: number; litrosCalculados?: boolean; national: RegionUse & { supplied: number; registered: number; households: number; lossReal: number; lossApparent: number; origin: { sup: number; sub: number; otras: number } }; regions: RegionUse[] }
/** Las comunidades con dato de depuración, de más a menos agua reutilizada. */
export const depOrder = consumo.regions.map((u, i) => ({ u, i })).filter(x => x.u.reusePct != null).sort((a, b) => (b.u.reusePct ?? 0) - (a.u.reusePct ?? 0)).map(x => x.i)
export const rivers = riversGeo as unknown as FeatureCollection<Geometry, { o: number; q: number }>

export type BasinStat = { id: string; name: string; a: number; c: number; e: number; ec: number; d: number; k: number; pct: number }

export const basinStats: BasinStat[] = (() => {
  const m = new Map<string, BasinStat>()
  for (const r of data.reservoirs) {
    const s = m.get(r.b) ?? { id: r.b, name: data.basins[r.b], a: 0, c: 0, e: 0, ec: 0, d: 0, k: 0, pct: 0 }
    s.a += r.a; s.c += r.c; s.e += r.e; s.ec += r.ec; s.d += r.d; s.k++
    m.set(r.b, s)
  }
  return [...m.values()].map(s => ({ ...s, pct: (s.a / s.c) * 100 })).sort((x, y) => y.pct - x.pct)
})()

export const energyTotals = data.reservoirs.reduce((t, r) => ({ e: t.e + r.e, ec: t.ec + r.ec }), { e: 0, ec: 0 })

export const pct = (r: { a: number; c: number }) => (r.c ? (r.a / r.c) * 100 : 0)

const nf = new Intl.NumberFormat('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions)
export const fmt = (n: number, d = 0) => nf.format(Number(n.toFixed(d)))
/** Cifras enormes en millones para que quepan en una ficha. */
export const fmtBig = (n: number) => (Math.abs(n) >= 1e6 ? `${fmt(n / 1e6, n >= 1e7 ? 0 : 1)} mill.` : fmt(n))
export const fmtPct = (n: number) => `${fmt(n, n < 10 ? 1 : 0)} %`

/** Tinte de cada cuenca en el tablero según su llenado: rojo apagado (seca) → cian profundo (llena). */
const stops: [number, [number, number, number]][] = [
  [25, [74, 24, 38]], [40, [70, 50, 30]], [55, [24, 58, 62]], [70, [16, 72, 88]], [88, [14, 98, 118]],
]
export function landColor(p: number) {
  if (p <= stops[0][0]) return rgb(stops[0][1])
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, c0] = stops[i - 1], [p1, c1] = stops[i], t = (p - p0) / (p1 - p0)
      return rgb(c0.map((v, j) => v + (c1[j] - v) * t) as [number, number, number])
    }
  }
  return rgb(stops[stops.length - 1][1])
}
const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(',')})`

export const status = (p: number) => (p < 30 ? 'low' : p < 50 ? 'mid' : 'ok') as 'low' | 'mid' | 'ok'

export const fechaLarga = new Date(data.meta.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export const hydroCount = data.reservoirs.filter(r => r.ec > 0).length
export const hydroMain = data.reservoirs.filter(r => r.h).length

/** Textos de los botones «i». */
export const INFO: Record<string, { t: string; b: string }> = {
  reserva: { t: 'Agua embalsada', b: 'El volumen que guardan ahora los embalses peninsulares de más de 5 hm³ que sigue el Boletín Hidrológico del Ministerio para la Transición Ecológica. Se publica cada martes.' },
  hm3: { t: 'Qué es un hm³', b: 'Un hectómetro cúbico: un cubo de 100 m de lado, o mil millones de litros. Llena unas 400 piscinas olímpicas.' },
  capacidad: { t: 'Capacidad', b: 'El agua que cabe en el embalse a su nivel máximo normal. El porcentaje de llenado es agua embalsada dividida entre capacidad.' },
  energia: { t: 'Energía embalsada', b: 'La electricidad que se podría generar si se turbinara toda el agua guardada en los embalses que tienen central hidroeléctrica. Es una reserva, como la batería de un móvil, no lo que se produce cada semana.' },
  hidro: { t: '¿Todos producen luz?', b: `No. De los ${data.reservoirs.length} embalses, ${hydroCount} tienen una central que puede turbinar su agua, y el ministerio clasifica ${hydroMain} como de uso principalmente hidroeléctrico. Los demás sirven para abastecer ciudades, regar o laminar avenidas y no generan electricidad.` },
  semana: { t: 'Variación semanal', b: 'Diferencia entre el agua de esta semana y la del boletín anterior. Sube con la lluvia y el deshielo; baja con el riego, el consumo, la evaporación y los desembalses.' },
  media10: { t: 'Media de 10 años', b: 'El promedio del agua embalsada en la misma semana durante los diez años hidrológicos anteriores. Sirve para saber si estamos por encima o por debajo de lo normal.' },
  anyo: { t: 'Año hidrológico', b: 'Va del 1 de octubre al 30 de septiembre. Empieza en otoño porque es cuando suelen llegar las lluvias y los embalses tocan fondo tras el verano.' },
  cuenca: { t: 'Cuenca o demarcación', b: 'El territorio que drena hacia un mismo río principal. Cada una la gestiona su confederación hidrográfica (Tajo, Ebro, Duero…) o su comunidad autónoma.' },
  lluvia: { t: 'Lluvia semanal', b: 'Precipitación acumulada en siete días en los observatorios principales de AEMET. Un litro por metro cuadrado equivale a un milímetro de agua.' },
  longitud: { t: 'Longitud del río', b: 'Longitud total según el CEDEX, del nacimiento a la desembocadura, aunque parte del río esté en Portugal o Francia. Si no está en esa tabla, los kilómetros que se ven en el mapa del IGN a escala 1:3 millones, que se quedan algo cortos.' },
  perfil: { t: 'Perfil del río', b: 'Altitud del cauce desde que nace hasta que sale del mapa. Se calcula cruzando el río con las curvas de nivel del IGN (0, 200, 400, 700, 1.000, 1.500, 2.000 m…) y suavizando entre ellas: sirve para ver la forma, no para medir.' },
  caudal: { t: 'Caudal', b: 'El agua que pasa por un punto del río cada segundo, en metros cúbicos. Es la media de la semana en estaciones de aforo y salidas de embalse.' },
  vertidos: { t: 'Vertidos autorizados', b: 'Permisos para devolver agua usada a ríos o al mar: depuradoras de ciudades, refrigeración de centrales, piscifactorías, industria o desaladoras. Es el máximo autorizado al año, no lo que se consume.' },
  records: { t: 'Récords', b: 'El máximo y el mínimo porcentaje de llenado registrados en la base de datos histórica del ministerio desde 1988, contando desde que el embalse se llenó por primera vez por encima de la mitad.' },
  consumo: { t: 'Consumo de los hogares', b: `Litros que gasta de media cada habitante al día en su casa: agua registrada por los contadores de los hogares dividida entre la población. No incluye industria, riego ni comercios. Lo publica el INE cada dos años; los datos de municipios no se publican para toda España.${consumo.litrosCalculados ? ' Aquí se calcula con el volumen de los hogares del INE y la población del padrón, así que puede diferir en un litro de la cifra de su nota de prensa, que usa la población a 1 de julio.' : ''}` },
  depuracion: { t: 'Depuración y reutilización', b: 'Agua residual que recogen las alcantarillas y tratan las depuradoras (EDAR), y la parte que se vuelve a usar para regar, limpiar calles o en la industria en lugar de devolverse al río o al mar. Reutilización = 100 × agua reutilizada / agua tratada, en la misma comunidad y el mismo año, como define el INE su indicador. El INE da estos volúmenes en metros cúbicos al día. La tabla de destinos del INE reparte el agua tratada de otra forma y su porcentaje de «reutilizada» no coincide exactamente.' },
  abastecimiento: { t: 'Abastecimiento', b: 'El agua que entra en la red pública y lo que se registra en los contadores. La diferencia es agua no registrada: fugas y roturas (pérdidas reales) y errores de contador, fraudes o usos sin medir (pérdidas aparentes). Lo publica el INE cada dos años por comunidad.' },
  perdidas: { t: 'Pérdidas en la red', b: 'Agua que entra en la red de abastecimiento pero no llega a nadie: las pérdidas reales son fugas, roturas y averías; las aparentes, errores de contador, fraudes y usos no medidos.' },
  coste: { t: 'Coste unitario', b: 'Lo que cuesta de media cada metro cúbico (1.000 litros) sumando abastecimiento y saneamiento, según el INE.' },
  presa: { t: 'Datos de la presa', b: 'Del Inventario de Presas y Embalses del ministerio. Altura desde cimientos: lo que mide la presa desde su base hasta la coronación.' },
}
