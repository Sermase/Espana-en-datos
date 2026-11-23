import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Barras, ColApiladas, LineChart, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { gasoducto, metanero, petrolero, red } from '../holo3d/modelos'
import { MapaMundo, nombrePais } from '../mundo/MapaMundo'
import { A } from '../Fuentes'
import { fMes, type Hoy } from './datos'

type Serie = [string, number][]
export type Extra = {
  fecha: string
  precio_componentes?: Record<string, Serie> | null
  intercambios?: Record<string, Serie> | null
  ire?: Record<string, Serie> | null
  sectores?: (Record<string, Serie> & { _labels?: Record<string, string> }) | null
  gas_origen?: (Record<string, Serie> & { _labels?: Record<string, string> }) | null
  crudo_origen?: (Record<string, Serie> & { _labels?: Record<string, string> }) | null
}
let cache: Promise<Extra> | null = null
export function useExtra() {
  const [e, setE] = useState<Extra | null>(null)
  useEffect(() => { cache ??= fetch('./data/extra.json').then(r => r.json()); cache.then(setE, () => { cache = null }) }, [])
  return e
}
const tMes = (k: string) => Date.parse(k.slice(0, 7) + '-15T00:00:00Z')
function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const twh = (mwh: number) => Math.abs(mwh) >= 1e6 ? `${nf(mwh / 1e6, 1)} TWh` : `${nf(mwh / 1e3, 0)} GWh`

// ------------------------------------------------------------------ Precio: de qué se compone
const TRAMOS_PRECIO = [
  { id: 'Mercados/Mercado diario', nombre: 'Mercado diario', color: '#ffb02e' },
  { id: 'Mercados/Mercado intradiario (subastas MIBEL y continuo)', nombre: 'Mercado intradiario', color: '#d95926' },
  { id: 'Servicios-ajuste/Servicios de ajuste', nombre: 'Servicios de ajuste', color: '#3987e5' },
  { id: 'Servicios-pagos/Pagos por capacidad', nombre: 'Pagos por capacidad', color: '#9085e9' },
  { id: 'Servicios-pagos/Mecanismo ajuste RD-L 10/2022', nombre: 'Tope al gas (2022–2023)', color: '#d55181' },
]
export function PrecioDesglose({ e }: { e: Extra | null }) {
  const [todo, setTodo] = useState(false)
  const c = e?.precio_componentes
  if (!c?.['Mercados/Mercado diario']) return null
  const meses = c['Mercados/Mercado diario'].map(p => p[0])
  const ver = todo ? meses : meses.slice(-36)
  const at = (id: string, m: string) => c[id]?.find(p => p[0] === m)?.[1] ?? 0
  const tramos = TRAMOS_PRECIO.filter(t => c[t.id]?.some(p => ver.includes(p[0]) && p[1])).map(t => ({ ...t, v: ver.map(m => at(t.id, m)) }))
  const ult = ver.at(-1)!, tot = at('Precio total/Precio total (€/MWh)', ult) || tramos.reduce((s, t) => s + t.v.at(-1)!, 0)
  const md = at('Mercados/Mercado diario', ult), aj = at('Servicios-ajuste/Servicios de ajuste', ult)
  return <Card t="De qué se compone el precio" wide lead={<>En {fMes(tMes(ult))} la energía costó <b>{nf(tot, 2)} €/MWh</b>: {nf(md, 2)} del mercado diario y {nf(aj, 2)} de los servicios de ajuste ({nf((aj / tot) * 100, 0)} %), que es lo que paga el sistema para cuadrar en tiempo real la producción con el consumo. Sin peajes, cargos ni impuestos.</>}
    fuente={<A id="ree_mercados">REE, componentes del precio final</A>}>
    <div className="modo" role="radiogroup" aria-label="Periodo">{[false, true].map(x => <button key={String(x)} role="radio" aria-checked={todo === x} className={todo === x ? 'is-on' : ''} onClick={() => setTodo(x)}>{x ? 'Desde 2014' : 'Últimos 3 años'}</button>)}</div>
    <ColApiladas xs={ver.map(m => fMes(tMes(m)))} tramos={tramos} titulo="Componentes del precio de la electricidad" fy={v => `${nf(v, 0)} €`} cadaX={todo ? 12 : 3} alto={240} />
  </Card>
}

// ------------------------------------------------------------------ Demanda: hogares, empresas, industria
const SECT = [
  { id: 'FC_OTH_HH_E', nombre: 'Hogares', color: '#ffb02e' },
  { id: 'FC_OTH_CP_E', nombre: 'Comercio y servicios públicos', color: '#3987e5' },
  { id: 'FC_IND_E', nombre: 'Industria', color: '#d95926' },
  { id: 'FC_TRA_E', nombre: 'Transporte', color: '#9085e9' },
  { id: 'FC_OTH_AF_E', nombre: 'Agricultura y pesca', color: '#199e70' },
]
export function Sectores({ e }: { e: Extra | null }) {
  const s = e?.sectores
  if (!s?.FC_OTH_HH_E) return null
  const años = s.FC_OTH_HH_E.map(p => p[0])
  const at = (id: string, a: string) => (s[id] as Serie | undefined)?.find(p => p[0] === a)?.[1] ?? 0
  const ult = años.at(-1)!, tot = SECT.reduce((x, t) => x + at(t.id, ult), 0)
  const rk = SECT.map(t => ({ t, v: at(t.id, ult) })).sort((a, b) => b.v - a.v)
  const hh0 = at('FC_OTH_HH_E', años[0]), hh1 = at('FC_OTH_HH_E', ult)
  return <Card t="Quién gasta la electricidad" wide lead={<>En {ult} los hogares gastaron el <b>{nf((hh1 / tot) * 100, 0)} %</b> de la electricidad, {nf(Math.abs(hh1 / hh0 - 1) * 100, 0)} % {hh1 > hh0 ? 'más' : 'menos'} que en {años[0]}. Lo que más consume es {rk[0].t.nombre.toLowerCase()} ({nf((rk[0].v / tot) * 100, 0)} %). Comercio, oficinas y servicios públicos son «empresas» pequeñas y grandes del sector servicios; la industria va aparte.</>}
    fuente={<>Eurostat, balance energético (<a href="https://ec.europa.eu/eurostat/databrowser/view/nrg_bal_c/default/table?lang=es" target="_blank" rel="noopener noreferrer">nrg_bal_c</a>) · consumo final de electricidad, anual</>}>
    <ColApiladas xs={años} tramos={SECT.map(t => ({ ...t, v: años.map(a => at(t.id, a) / 1000) }))} titulo="Consumo final de electricidad por sectores" fy={v => `${nf(v, 0)} TWh`} cadaX={4} alto={240} />
  </Card>
}
export function Ire({ e, desde }: { e: Extra | null; desde: number }) {
  const r = e?.ire
  if (!r?.['Índice industria corregido']) return null
  const s = (k: string) => r[k].map(p => [tMes(p[0]), p[1]] as [number, number]).filter(p => p[0] >= desde)
  const ind = r['Índice industria corregido'].at(-1)!, ser = r['Índice servicios corregido']?.at(-1)
  return <Card t="Las empresas que más consumen, mes a mes" lead={<>Índice del consumo de los grandes consumidores (base 100). La industria está en <b>{nf(ind[1], 1)}</b>{ser && <> y los servicios en <b>{nf(ser[1], 1)}</b></>} ({fMes(tMes(ind[0]))}), ya corregidos de calendario y temperatura.</>}
    fuente={<A id="ree_demanda">REE, índice de Red Eléctrica (IRE)</A>}>
    <LineChart titulo="Índice de consumo eléctrico de grandes consumidores" series={[{ id: 'i', nombre: 'Industria', datos: s('Índice industria corregido'), color: '#d95926' }, { id: 's', nombre: 'Servicios', datos: s('Índice servicios corregido'), color: '#3987e5' }]} fx={fMes} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => nf(v, 0)} />
  </Card>
}

// ------------------------------------------------------------------ Fronteras: lo que compramos y vendemos de electricidad
const FR = [
  { id: 'francia', nombre: 'Francia', color: '#3987e5', iso: 'FR', tr: ['expFra', 'impFra'] },
  { id: 'portugal', nombre: 'Portugal', color: '#199e70', iso: 'PT', tr: ['expPor', 'impPor'] },
  { id: 'marruecos', nombre: 'Marruecos', color: '#d95926', iso: 'MA', tr: ['expMar', 'impMar'] },
  { id: 'andorra', nombre: 'Andorra', color: '#9085e9', iso: 'AD', tr: ['expAnd', 'impAnd'] },
]
export function Fronteras({ e, hoy }: { e: Extra | null; hoy: Hoy }) {
  const [todo, setTodo] = useState(false)
  const x = e?.intercambios
  const ahora = hoy.tr?.at(-1)
  const vivo = ahora ? FR.map(f => ({ f, exp: -Number(ahora[f.tr[0]] ?? 0), imp: Number(ahora[f.tr[1]] ?? 0) })) : null
  const netoAhora = vivo?.reduce((s, v) => s + v.imp - v.exp, 0) ?? 0
  const meses = x?.['francia/saldo']?.map(p => p[0]) ?? []
  const ver = todo ? meses : meses.slice(-36)
  const at = (k: string, m: string) => x?.[k]?.find(p => p[0] === m)?.[1] ?? 0
  const años = [...new Set(meses.map(m => m.slice(0, 4)))].filter(a => meses.filter(m => m.startsWith(a)).length === 12)
  const aUlt = años.at(-1)
  const anual = aUlt ? FR.map(f => ({ f, v: meses.filter(m => m.startsWith(aUlt)).reduce((s, m) => s + at(`${f.id}/saldo`, m), 0) })) : []
  const neto = anual.reduce((s, a) => s + a.v, 0)
  const max = Math.max(1, ...(vivo ?? []).map(v => v.exp + v.imp))
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={red(Math.min(1, Math.abs(netoAhora) / 4000))} color="#ffb02e" alto={250} etiqueta="Holograma: torre de alta tensión" />
        <div className="sala-dato">
          <span className="sala-k">Intercambios ahora{ahora && `, ${String(ahora.ts).slice(11, 16)}`}</span>
          <b>{nf(Math.abs(netoAhora))} MW</b>
          <span>España está {netoAhora < 0 ? <b>exportando</b> : <b>importando</b>} electricidad en este momento, sumando todas las fronteras.</span>
        </div>
      </div>
      {vivo && <div className="fronteras">{vivo.map(({ f, exp, imp }) => <div key={f.id} className="frontera" style={{ ['--c' as string]: f.color }}>
        <span className="fr-n">{f.nombre}</span>
        <span className="fr-b"><i className="fr-exp" style={{ width: `${(exp / max) * 100}%` }} /><i className="fr-imp" style={{ width: `${(imp / max) * 100}%` }} /></span>
        <span className="fr-v">{exp > imp ? `sale ${nf(exp - imp)} MW` : imp > exp ? `entra ${nf(imp - exp)} MW` : 'sin flujo'}</span>
      </div>)}</div>}
    </section>
    {aUlt && <Card t={`El balance de ${aUlt}`} lead={<>En {aUlt} España {neto < 0 ? 'vendió' : 'compró'} en neto <b>{twh(Math.abs(neto))}</b> de electricidad a sus vecinos. {anual.filter(a => a.v > 0).map(a => a.f.nombre).join(' y ') || 'Ningún país'} {anual.filter(a => a.v > 0).length === 1 ? 'fue el único que nos vendió más de lo que nos compró' : anual.filter(a => a.v > 0).length ? 'nos vendieron más de lo que nos compraron' : ''}.</>} fuente={<A id="ree">REE, intercambios internacionales programados</A>}>
      <Barras titulo="Saldo anual de intercambios por país" fmt={v => `${v > 0 ? 'compra ' : 'vende '}${twh(Math.abs(v))}`} items={anual.map(a => ({ id: a.f.id, nombre: a.f.nombre, sub: a.v < 0 ? 'España exporta' : 'España importa', valor: a.v, color: a.f.color }))} />
    </Card>}
    {ver.length > 1 && <Card t="Mes a mes" lead="Por debajo de cero, lo que España vende a cada país; por encima, lo que le compra." fuente={<A id="ree">REE</A>}>
      <div className="modo" role="radiogroup" aria-label="Periodo">{[false, true].map(v => <button key={String(v)} role="radio" aria-checked={todo === v} className={todo === v ? 'is-on' : ''} onClick={() => setTodo(v)}>{v ? 'Desde 2014' : 'Últimos 3 años'}</button>)}</div>
      <ColApiladas xs={ver.map(m => fMes(tMes(m)))} tramos={FR.map(f => ({ id: f.id, nombre: f.nombre, color: f.color, v: ver.map(m => at(`${f.id}/saldo`, m) / 1000) }))} titulo="Saldo mensual de intercambios por país" fy={v => `${nf(v, 0)} GWh`} cadaX={todo ? 12 : 4} total />
    </Card>}
  </div>
}

// ------------------------------------------------------------------ Gas y petróleo: de dónde vienen
const fuera = new Set(['TOTAL', 'EU27_2020', 'EU28', 'EX_SU_OTH', 'EUR_OTH', 'AFR_OTH', 'AME_OTH', 'ASI_OTH', 'NSP', 'OTH', 'ES', '_labels'])
function origen(d: Record<string, Serie> | null | undefined, meses = 12) {
  if (!d) return null
  const fin = d.TOTAL?.at(-1)?.[0] ?? Object.values(d).flat().map(p => p[0]).sort().at(-1)!
  const ult = d.TOTAL ? d.TOTAL.slice(-meses).map(p => p[0]) : []
  const suma = (k: string) => d[k]?.filter(p => ult.includes(p[0])).reduce((s, p) => s + p[1], 0) ?? 0
  const paises = Object.keys(d).filter(k => !fuera.has(k) && !k.includes('_')).map(k => ({ pais: k, valor: suma(k) })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor)
  return { fin, desde: ult[0], total: suma('TOTAL') || paises.reduce((s, x) => s + x.valor, 0), paises }
}
export function GasPetroleo({ e }: { e: Extra | null }) {
  const [que, setQue] = useState<'gas' | 'crudo'>('gas')
  const [holo, setHolo] = useState<'metanero' | 'gasoducto' | 'petrolero'>('metanero')
  const [sel, setSel] = useState<string | null>(null)
  const o = useMemo(() => origen(que === 'gas' ? e?.gas_origen : e?.crudo_origen), [e, que])
  const color = que === 'gas' ? '#3fe6ff' : '#ffb02e'
  if (!o) return <p className="note">Cargando…</p>
  const u = que === 'gas' ? (v: number) => `${nf(v / 1000, 1)} bcm` : (v: number) => `${nf(v / 1000, 1)} Mt`
  const top = o.paises.slice(0, 3)
  const d = que === 'gas' ? e?.gas_origen : e?.crudo_origen
  const s = sel && d?.[sel] ? d[sel].map(p => [tMes(p[0]), p[1]] as [number, number]) : null
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D key={holo} modelo={holo === 'metanero' ? metanero() : holo === 'petrolero' ? petrolero() : gasoducto(0.6)} color={color} alto={250} etiqueta={`Holograma: ${holo}`} />
        <div className="sala-dato">
          <div className="modo" role="radiogroup" aria-label="Qué importamos">{(['gas', 'crudo'] as const).map(q => <button key={q} role="radio" aria-checked={que === q} className={que === q ? 'is-on' : ''} onClick={() => { setQue(q); setSel(null); setHolo(q === 'gas' ? 'metanero' : 'petrolero') }}>{q === 'gas' ? 'Gas natural' : 'Petróleo crudo'}</button>)}</div>
          <span className="sala-k">Importaciones de los últimos 12 meses (hasta {fMes(tMes(o.fin))})</span>
          <b>{u(o.total)}</b>
          <span>{que === 'gas' ? 'Miles de millones de metros cúbicos.' : 'Millones de toneladas.'} Primeros proveedores: {top.map((t, i) => <span key={t.pais}>{i ? (i === top.length - 1 ? ' y ' : ', ') : ''}<b>{nombrePais(t.pais)}</b> ({nf((t.valor / o.total) * 100, 0)} %)</span>)}.</span>
          {que === 'gas' && <div className="modo" role="radiogroup" aria-label="Cómo llega">{(['metanero', 'gasoducto'] as const).map(h => <button key={h} role="radio" aria-checked={holo === h} className={holo === h ? 'is-on' : ''} onClick={() => setHolo(h)}>{h === 'metanero' ? 'En barco (GNL)' : 'Por gasoducto'}</button>)}</div>}
        </div>
      </div>
      <p className="note">{que === 'gas'
        ? holo === 'gasoducto' ? 'Por gasoducto llega gas de Argelia (Medgaz, a Almería) y, en menor medida, por las conexiones con Francia y Portugal.' : 'Casi todo lo demás llega licuado en barcos metaneros a las regasificadoras de Barcelona, Cartagena, Huelva, Sagunto, Bilbao, Mugardos y El Musel (Gijón), donde se vuelve a convertir en gas.'
        : 'Todo el crudo llega en petroleros a las refinerías de la costa. España casi no produce petróleo propio.'}</p>
    </section>
    <Card t={que === 'gas' ? 'De dónde viene el gas' : 'De dónde viene el petróleo'} wide lead="Toca un país para ver su evolución mes a mes." fuente={<>Eurostat, importaciones de energía por país de origen (<a href={`https://ec.europa.eu/eurostat/databrowser/view/${que === 'gas' ? 'nrg_ti_gasm' : 'nrg_ti_oilm'}/default/table?lang=es`} target="_blank" rel="noopener noreferrer">{que === 'gas' ? 'nrg_ti_gasm' : 'nrg_ti_oilm'}</a>), con datos de CORES</>}>
      <MapaMundo datos={o.paises} color={color} fmt={u} titulo={`Importaciones de ${que === 'gas' ? 'gas' : 'crudo'} por país`} sel={sel} onSel={setSel} rutas={8} />
      {sel && s && <LineChart titulo={`Importaciones desde ${nombrePais(sel)}`} series={[{ id: sel, nombre: nombrePais(sel), datos: s, color, area: true }]} fx={fMes} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => que === 'gas' ? `${nf(v, 0)} Mm³` : `${nf(v, 0)} kt`} alto={180} />}
    </Card>
    <Card t="Ranking de proveedores" lead={`Últimos 12 meses, en ${que === 'gas' ? 'miles de millones de m³' : 'millones de toneladas'}.`}>
      <Barras titulo="Proveedores" fmt={u} limite={10} items={o.paises.map(p => ({ id: p.pais, nombre: nombrePais(p.pais), sub: `${nf((p.valor / o.total) * 100, 1)} %`, valor: p.valor, color, destacado: p.pais === sel, onClick: () => setSel(p.pais) }))} />
    </Card>
  </div>
}
