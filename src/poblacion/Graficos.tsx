import { useMemo } from 'react'
import { Barras, Columnas, LineChart, Piramide, nf, compact, type Serie as LSerie } from '../graficos'
import { last, popNow, type Datos, type Muni, type Serie } from './datos'
import { METRICAS, valorDe } from './metricas'
import { A } from '../Fuentes'

const H = '#3987e5', M = '#d95926' // hombres y mujeres, igual que en la pirámide
const year = (v: number) => String(Math.round(v))

/** La serie de una tabla nacional cuyo nombre encaja; si no, la primera. */
function pick(d: Datos, key: string, re?: RegExp): Serie | null {
  const t = d.series[key]?.series ?? []
  return (re ? t.find(s => re.test(s.n)) : null) ?? t[0] ?? null
}
const toPts = (s: Serie | null) => (s?.d ?? []).map(([x, y]) => [x, y] as [number, number])

/** Una tarjeta: título, la frase que resume el dato y el gráfico. */
function Card({ t, lead, children, wide }: { t: string; lead?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}</section>
}

export function Graficos({ d, onMuni }: { d: Datos; onMuni: (m: Muni) => void }) {
  const Y = d.years, yl = last(Y)
  const total = (i: number) => d.munis.reduce((t, m) => t + (m.pop[i] ?? 0), 0)

  // población desde 1971 (pirámide: suma de edades), y desde 1996 por padrón
  const pyrTot = useMemo(() => d.piramide ? Object.entries(d.piramide).map(([y, v]) => [Number(y), v.h.reduce((a, b) => a + b, 0) + v.m.reduce((a, b) => a + b, 0)] as [number, number]).sort((a, b) => a[0] - b[0]) : [], [d])
  const growth = pyrTot.slice(1).map(([y, v], i) => ({ y, dv: v - pyrTot[i][1] }))
  const best = growth.reduce((b, g) => (g.dv > b.dv ? g : b), growth[0] ?? { y: 0, dv: 0 })

  const nat = pick(d, 'natalidad'), mor = pick(d, 'mortalidad'), veg = pick(d, 'vegetativo')
  const fec = pick(d, 'fecundidad', /Ambas nacionalidades$/), fecE = pick(d, 'fecundidad', /Fecundidad\. Total Nacional\. Española$/), fecX = pick(d, 'fecundidad', /Extranjera$/)
  const mat = pick(d, 'maternidad', /Ambas nacionalidades$/)
  const vidaH = pick(d, 'vida', /Varones/), vidaM = pick(d, 'vida', /Mujeres/)
  const edad = pick(d, 'edadMedia', /Total\. Anual/), env = pick(d, 'envejecimiento')
  const fuera = pick(d, 'nacidosFuera', /Todas las edades\. Anual\. Porcentaje\. Total$/)
  const mig = [...toPts(pick(d, 'migracion')), ...toPts(pick(d, 'migracion21'))].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0])
  const vegLast = veg ? last(veg.d) : null
  const vegNeg = veg?.d.find(p => p[1] < 0)

  // comunidades y provincias: cambio desde 1996
  const regions = useMemo(() => {
    const by = (key: (m: Muni) => string) => {
      const acc = new Map<string, [number, number]>()
      for (const m of d.munis) { const k = key(m); if (!k) continue; const a = acc.get(k) ?? [0, 0]; a[0] += m.pop[0] ?? 0; a[1] += popNow(m); acc.set(k, a) }
      return [...acc].map(([n, [a, b]]) => ({ n, a, b, pct: a ? ((b - a) / a) * 100 : 0 })).sort((x, y) => y.pct - x.pct)
    }
    return { ccaa: by(m => m.ccaa), prov: by(m => m.prov) }
  }, [d])

  // España vaciada: municipios por tamaño y gente que vive en ellos
  const sizes = useMemo(() => {
    const cuts = [[0, 100, '<100'], [100, 500, '100–500'], [500, 1000, '500–1.000'], [1000, 5000, '1.000–5.000'], [5000, 20000, '5.000–20.000'], [20000, 100000, '20.000–100.000'], [100000, 1e9, '100.000+']] as const
    const tot = d.munis.reduce((t, m) => t + popNow(m), 0)
    return cuts.map(([a, b, x]) => { const ms = d.munis.filter(m => popNow(m) >= a && popNow(m) < b); return { x, n: ms.length, share: (ms.reduce((t, m) => t + popNow(m), 0) / tot) * 100 } })
  }, [d])
  const i00 = Math.max(0, Y.indexOf(2000))
  const losers = useMemo(() => d.munis.filter(m => (m.pop[i00] ?? 0) >= 1000).map(m => ({ m, v: valorDe('cambio', m) ?? 0 })).sort((a, b) => a.v - b.v), [d])
  const ESL = (v: number) => `${v > 0 ? '+' : ''}${nf(v, 1)} %`
  const shrinking = d.munis.filter(m => (valorDe('cambio', m) ?? 0) < 0).length
  const small = sizes[0].n + sizes[1].n, smallPct = (small / d.munis.length) * 100
  const fecEl = fecE ? last(fecE.d)[1] : null, fecXl = fecX ? last(fecX.d)[1] : null
  const migNeg = mig.filter(p => p[1] < 0).map(p => p[0])
  const v19 = vidaM?.d.find(p => p[0] === 2019)?.[1], v20 = vidaM?.d.find(p => p[0] === 2020)?.[1]

  return (
    <div className="graficos">
      {d.piramide && <Card t="La pirámide, año a año" wide lead={<>De la España de 1971, ancha por abajo, a la de {Object.keys(d.piramide).at(-1)}, con la cintura en los cuarenta y los mayores cada vez más arriba. Se reproduce sola al llegar; puedes pararla y elegir año.</>}>
        <Piramide datos={d.piramide} titulo="Pirámide de población de España" />
      </Card>}

      {pyrTot.length > 1 && <Card t="Cuántos somos" lead={<>De {nf(pyrTot[0][1] / 1e6, 1)} millones en {pyrTot[0][0]} a <b>{nf(last(pyrTot)[1] / 1e6, 1)} millones</b>. El mayor salto fue en {best.y}: {compact(best.dv)} personas más en un año.</>}>
        <LineChart titulo="Población residente en España desde 1971" series={[{ id: 'p', nombre: 'Población', datos: pyrTot, area: true }]} fx={year} fy={v => `${nf(v / 1e6, 1)} M`} alto={200}
          marcas={[{ x: best.y, y: pyrTot.find(p => p[0] === best.y)![1], texto: `+${compact(best.dv)} en ${best.y}` }]} />
      </Card>}

      {nat && mor && <Card t="Nacimientos y defunciones" lead={<>Por cada mil habitantes. {vegNeg ? <>Desde {vegNeg[0]} mueren más personas de las que nacen</> : 'Aún nacen más de los que mueren'}{vegLast ? <>: en {vegLast[0]}, el saldo fue de {nf(vegLast[1], 2)} por mil.</> : '.'}</>}>
        <LineChart titulo="Tasas de natalidad y mortalidad por mil habitantes" series={[{ id: 'n', nombre: 'Natalidad', datos: toPts(nat), color: '#3df5b0' }, { id: 'm', nombre: 'Mortalidad', datos: toPts(mor), color: '#c49bff' }]} fx={year} fy={v => `${nf(v, 1)} ‰`} alto={190} />
      </Card>}

      {veg && <Card t="Saldo vegetativo" lead="Nacimientos menos defunciones, por mil habitantes. Por debajo de cero, el país solo crece si llega gente de fuera.">
        <Columnas unidad="Nacimientos menos muertes, por cada 1.000 habitantes" titulo="Saldo vegetativo por mil habitantes" items={veg.d.map(([x, v]) => ({ x: String(x), valor: v, color: v < 0 ? '#d95926' : '#3987e5', destacado: x === vegNeg?.[0] }))} fmt={v => nf(v, 1)} cadaX={10} etiqueta={c => `primer año negativo: ${c.x}`} />
      </Card>}

      {fec && <Card t="Hijos por mujer" lead={<>Hacen falta unos 2,1 para que una generación se reemplace. España está en <b>{nf(last(fec.d)[1], 2)}</b> ({last(fec.d)[0]}){fecEl != null && fecXl != null ? <>: {nf(fecEl, 2)} las madres españolas y {nf(fecXl, 2)} las extranjeras.</> : '.'}</>}>
        <LineChart unidad="Hijos por mujer" titulo="Indicador coyuntural de fecundidad" series={[{ id: 't', nombre: 'Todas', datos: toPts(fec), color: '#c49bff' }, ...(fecE ? [{ id: 'e', nombre: 'Madre española', datos: toPts(fecE), color: '#3987e5', fondo: true }] : []), ...(fecX ? [{ id: 'x', nombre: 'Madre extranjera', datos: toPts(fecX), color: '#d95926', fondo: true }] : [])] as LSerie[]} fx={year} fy={v => nf(v, 2)} alto={190} />
      </Card>}

      {mat && <Card t="Edad de las madres" lead={<>La edad media al tener un hijo ha pasado de {nf(mat.d[0][1], 1)} años en {mat.d[0][0]} a <b>{nf(last(mat.d)[1], 1)}</b>.</>}>
        <LineChart titulo="Edad media a la maternidad" series={[{ id: 'm', nombre: 'Edad media', datos: toPts(mat), area: true }]} fx={year} fy={v => `${nf(v, 1)} años`} alto={170} />
      </Card>}

      {vidaH && vidaM && <Card t="Esperanza de vida" lead={<>Las mujeres viven de media <b>{nf(last(vidaM.d)[1] - last(vidaH.d)[1], 1)} años más</b> que los hombres.{v19 != null && v20 != null && v20 < v19 ? <> En 2020 bajó {nf(v19 - v20, 1)} años de golpe: la covid.</> : null}</>}>
        <LineChart titulo="Esperanza de vida al nacer" series={[{ id: 'h', nombre: 'Hombres', datos: toPts(vidaH), color: H }, { id: 'm', nombre: 'Mujeres', datos: toPts(vidaM), color: M }]} fx={year} fy={v => `${nf(v, 1)} años`} alto={190} />
      </Card>}

      {edad && <Card t="Un país que envejece" lead={<>La edad media ha subido de {nf(edad.d[0][1], 1)} a <b>{nf(last(edad.d)[1], 1)} años</b>.{env ? <> Ya hay {nf(last(env.d)[1], 0)} mayores de 64 por cada 100 menores de 16.</> : null}</>}>
        <LineChart titulo="Edad media de la población" series={[{ id: 'e', nombre: 'Edad media', datos: toPts(edad), area: true }]} fx={year} fy={v => `${nf(v, 1)} años`} alto={170} />
        {env && <LineChart unidad="Mayores de 64 años por cada 100 menores de 16" titulo="Índice de envejecimiento" series={[{ id: 'i', nombre: 'Mayores por cada 100 jóvenes', datos: toPts(env), color: '#c49bff' }]} fx={year} fy={v => nf(v)} alto={150} pie="Mayores de 64 por cada 100 menores de 16." />}
      </Card>}

      {fuera && <Card t="Nacidos en el extranjero" lead={<>Hoy son el <b>{nf(last(fuera.d)[1], 1)} %</b> de los vecinos, frente al {nf(fuera.d[0][1], 1)} % de {fuera.d[0][0]}.</>}>
        <LineChart titulo="Porcentaje de población nacida en el extranjero" series={[{ id: 'f', nombre: 'Nacidos fuera', datos: toPts(fuera), area: true }]} fx={year} fy={v => `${nf(v, 1)} %`} alto={170} />
      </Card>}

      {mig.length > 1 && <Card t="Migración con el extranjero" lead={<>Llegadas menos salidas, por mil habitantes. {migNeg.length ? <>Se marchó más gente de la que llegó en {migNeg.length === 1 ? migNeg[0] : `${migNeg[0]}–${last(migNeg)}`}.</> : 'Llega más gente de la que se va todos los años de la serie.'}</>}>
        <Columnas unidad="Personas que llegan menos las que se van, por cada 1.000 habitantes" titulo="Tasa de migración neta con el extranjero" items={mig.map(([x, v]) => ({ x: String(x), valor: v, color: v < 0 ? '#d95926' : '#3987e5' }))} fmt={v => nf(v, 1)} cadaX={3} />
      </Card>}

      <Card t="Comunidades: quién crece y quién se vacía" lead={<>Cambio de población entre {Y[0]} y {yl}. España en conjunto: {ESL(((total(Y.length - 1) - total(0)) / total(0)) * 100)}.</>}>
        <Barras titulo="Cambio de población por comunidad" fmt={ESL} limite={19} items={regions.ccaa.map(r => ({ id: r.n, nombre: r.n, sub: `${compact(r.a)} → ${compact(r.b)}`, valor: r.pct, color: r.pct < 0 ? '#d95926' : '#3987e5' }))} />
      </Card>

      <Card t="La España vaciada en un gráfico" lead={<><b>{nf(shrinking)}</b> de {nf(d.munis.length)} municipios tienen hoy menos gente que en 2000. El {nf(smallPct, 0)} % de los municipios tiene menos de 500 vecinos, pero entre todos suman solo el {nf(sizes[0].share + sizes[1].share, 1)} % de la población.</>}>
        <Columnas unidad="Número de municipios" titulo="Número de municipios por tamaño" items={sizes.map(s => ({ x: s.x, valor: s.n }))} fmt={v => nf(v)} alto={160} />
        <Columnas titulo="Porcentaje de la población que vive en cada tamaño de municipio" items={sizes.map(s => ({ x: s.x, valor: s.share, color: '#3987e5' }))} fmt={v => `${nf(v, 1)} %`} alto={160} />
        <p className="note">Arriba, cuántos municipios hay de cada tamaño; abajo, qué parte de la población vive en ellos.</p>
      </Card>

      <Card t="Los que más gente han perdido" lead="Municipios que tenían al menos 1.000 vecinos en 2000, por cuánto han cambiado desde entonces.">
        <Barras titulo="Municipios que más población han perdido" fmt={v => `−${nf(v, 1)} %`} limite={10} items={losers.slice(0, 30).map(({ m, v }) => ({ id: m.id, nombre: m.n, sub: `${METRICAS.hab.fmt(m.pop[i00] ?? 0)} → ${METRICAS.hab.fmt(popNow(m))} vecinos`, valor: -v, color: '#d95926', onClick: () => onMuni(m) }))} />
      </Card>

      <Card t="Y los que más han crecido" lead="Mismo criterio: al menos 1.000 vecinos en 2000.">
        <Barras titulo="Municipios que más población han ganado" fmt={ESL} limite={10} items={[...losers].reverse().slice(0, 30).map(({ m, v }) => ({ id: m.id, nombre: m.n, sub: `${METRICAS.hab.fmt(m.pop[i00] ?? 0)} → ${METRICAS.hab.fmt(popNow(m))} vecinos`, valor: v, color: '#3987e5', onClick: () => onMuni(m) }))} />
      </Card>

      <p className="src">Fuentes: INE — <A id="ine_padron">Revisión del Padrón Municipal (1996–{yl})</A>, <A id="ine_piramide">Estadística Continua de Población</A> (pirámide desde 1971) e <A id="ine_idb">Indicadores Demográficos Básicos</A>. Límites municipales: <A id="siane">IGN</A>.</p>
    </div>
  )
}
