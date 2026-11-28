import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { TEMAS } from '../temas'

type Org = { id: string; n: string; lic: string; hosts: string[] }
type Fichero = { p: string; ultimo: string | null; bajado: string | null; kb: number }
type Script = { script: string; desc: string; tema: string | null; flujo: string | null; paso: string | null; frecuencia: string; cadaDias: number | null; orgs: Org[]; eurostat: string[]; ine: string[]; ficheros: Fichero[] }
type Datos = { generado: string; commit: string | null; scripts: Script[] }
type Fila = { k: string; s: Script; o: Org; tema: string; ultimo: string | null; bajado: string | null }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function periodo(p: string | null) {
  if (!p) return '—'
  const m = p.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?|-[TQ](\d)|-S(\d))?/)
  if (!m) return p
  if (m[3]) return `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}`
  if (m[2]) return `${MESES[+m[2] - 1]} ${m[1]}`
  if (m[4]) return `${m[4]}.º trim. ${m[1]}`
  if (m[5]) return `${m[5]}.º sem. ${m[1]}`
  return m[1]
}
const dias = (f: string | null) => f ? Math.round((Date.now() - Date.parse(f)) / 864e5) : null
const masReciente = (a: (string | null)[]) => a.filter(Boolean).sort().at(-1) ?? null

export default function App() {
  const [d, setD] = useState<Datos | null>(null)
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState<keyof Fila | 'org'>('tema')
  const [soloViejos, setSoloViejos] = useState(false)
  useEffect(() => { fetch('./fuentes.json').then(r => r.json()).then(setD, () => {}) }, [])
  const filas = useMemo<Fila[]>(() => (d?.scripts ?? []).flatMap(s => s.orgs.map(o => {
    const t = TEMAS.find(t => t.id === s.tema)
    return { k: s.script + o.id, s, o, tema: t?.nombre ?? s.tema ?? '—', ultimo: masReciente(s.ficheros.map(f => f.ultimo)), bajado: masReciente(s.ficheros.map(f => f.bajado)) }
  })), [d])
  // Un fichero va con retraso si su última descarga es más antigua que tres veces su frecuencia (y al menos 3 días).
  const viejo = (f: Fila) => { const n = dias(f.bajado); return n != null && f.s.cadaDias != null && n > Math.max(3, f.s.cadaDias * 3) }
  const vista = filas.filter(f => (!soloViejos || viejo(f)) && (!q || `${f.tema} ${f.o.n} ${f.o.id} ${f.s.script} ${f.s.desc} ${f.s.eurostat.join(' ')} ${f.s.ine.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(orden === 'org' ? a.o.n : a[orden] ?? '').localeCompare(String(orden === 'org' ? b.o.n : b[orden] ?? ''), 'es') || a.tema.localeCompare(b.tema, 'es'))
  const nOrgs = new Set(filas.map(f => f.o.id)).size, nViejos = filas.filter(viejo).length
  const th = (k: typeof orden, t: string) => <th aria-sort={orden === k ? 'ascending' : undefined} onClick={() => setOrden(k)}>{t}</th>
  return (
    <main className="fu">
      <a className="home-link" href="../index.html">España en datos</a>
      <h1 className="ac-cab" style={{ font: '700 clamp(32px,6vw,48px)/1 Oxanium, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', margin: '10px 0 0' }}>Fuentes</h1>
      <p className="ac-lema" style={{ maxWidth: '70ch' }}>Tabla interna de las bases de datos: quién publica cada una, qué programa la baja, cada cuánto, el último periodo que trae y la licencia. Se genera sola en cada despliegue a partir de los programas de <code>scripts/</code> y de los workflows.</p>
      {d && <div className="fu-res">
        <span><b>{filas.length}</b>bases de datos</span>
        <span><b>{nOrgs}</b>organismos</span>
        <span><b>{d.scripts.length}</b>programas de descarga</span>
        <span><b className={nViejos ? 'fu-viejo' : ''}>{nViejos}</b>{nViejos === 1 ? 'con retraso' : 'con retraso'}</span>
      </div>}
      <div className="fu-filtro">
        <input type="search" placeholder="Buscar tema, organismo, programa o tabla" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
        <button aria-pressed={soloViejos} onClick={() => setSoloViejos(v => !v)}>Solo con retraso</button>
      </div>
      {!d ? <p className="ac-lema">Cargando…</p> :
        <table className="fu-tabla">
          <thead><tr>{th('tema', 'Tema')}{th('org', 'Organismo')}<th>Programa</th><th>Frecuencia</th>{th('ultimo', 'Último dato')}{th('bajado', 'Descargado')}<th>Licencia</th></tr></thead>
          <tbody>{vista.map(f => {
            const t = TEMAS.find(t => t.id === f.s.tema)
            const tablas = f.o.id === 'Eurostat' ? f.s.eurostat : f.o.id === 'INE' ? f.s.ine : []
            return <tr key={f.k}>
              <td data-l="Tema">{t?.ruta ? <a className="fu-tema" style={{ '--c': t.color } as CSSProperties} href={`..${t.ruta}`}><i />{f.tema}</a> : <span className="fu-tema" style={{ '--c': t?.color ?? '#86a9b5' } as CSSProperties}><i />{f.tema}</span>}</td>
              <td data-l="Organismo"><div>{f.o.n}{tablas.length > 0 && <small>{f.o.id === 'INE' ? 'Tablas' : 'Conjuntos'}: {tablas.slice(0, 8).join(', ')}{tablas.length > 8 ? ` y ${tablas.length - 8} más` : ''}</small>}</div></td>
              <td data-l="Programa"><div><a href={`https://github.com/Sermase/Espana-en-datos/blob/main/scripts/${f.s.script}`} target="_blank" rel="noopener noreferrer"><code>{f.s.script}</code></a><small>{f.s.desc.length > 150 ? f.s.desc.slice(0, f.s.desc.lastIndexOf(' ', 145)) + '…' : f.s.desc}</small></div></td>
              <td data-l="Frecuencia">{f.s.frecuencia}</td>
              <td data-l="Último dato">{periodo(f.ultimo)}</td>
              <td data-l="Descargado" className={viejo(f) ? 'fu-viejo' : ''}><div>{periodo(f.bajado)}{dias(f.bajado) != null && <small>hace {dias(f.bajado)} {dias(f.bajado) === 1 ? 'día' : 'días'}</small>}</div></td>
              <td data-l="Licencia">{f.o.lic}</td>
            </tr>
          })}</tbody>
        </table>}
      {d && <p className="ac-pie" style={{ marginTop: 24, color: 'var(--muted)', fontSize: 13 }}>Generada el {periodo(d.generado.slice(0, 10))}{d.commit ? `, versión ${d.commit}` : ''}. «Último dato» es el periodo más reciente que se encuentra en el fichero; «con retraso», una descarga más antigua que tres veces su frecuencia.</p>}
    </main>
  )
}
