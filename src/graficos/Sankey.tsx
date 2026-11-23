import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useInView, useWidth } from './util'

export type NodoSankey = { id: string; nombre: string; corto?: string; valor: number; color: string; rayado?: boolean }

/**
 * Flujo de dos columnas que pasan por un tronco común: de dónde sale el dinero → la caja → a dónde va.
 * Las cintas se dibujan de izquierda a derecha al entrar en pantalla y por dentro corre un hilo de partículas
 * (se para con prefers-reduced-motion). Tocar un nodo lo resalta y avisa con onSel.
 */
export function Sankey({ izq, der, centro, fmt, titulo, sel, onSel, alto = 460 }: {
  izq: NodoSankey[]; der: NodoSankey[]; centro: string; fmt: (v: number) => string; titulo: string
  sel?: string | null; onSel?: (id: string | null) => void; alto?: number
}) {
  const [wref, w] = useWidth<HTMLDivElement>()
  const [vref, visto] = useInView<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const activo = hover ?? sel ?? null
  const estrecho = w < 620
  const lab = estrecho ? Math.max(92, w * 0.3) : Math.min(270, w * 0.23)
  const H = estrecho ? alto + 160 : alto
  const g = useMemo(() => {
    if (!w) return null
    const nw = 10, tw = estrecho ? 14 : 22, gap = estrecho ? 5 : 7
    const xl = lab, xr = w - lab - nw, xc = w / 2 - tw / 2
    const tot = Math.max(izq.reduce((a, n) => a + n.valor, 0), der.reduce((a, n) => a + n.valor, 0))
    const k = (H - 24 - gap * Math.max(izq.length, der.length)) / tot
    const col = (ns: NodoSankey[]) => { const hT = ns.reduce((a, n) => a + n.valor * k, 0) + gap * (ns.length - 1); let y = (H - hT) / 2; return ns.map(n => { const h = Math.max(1.5, n.valor * k); const o = { n, y, h }; y += h + gap; return o }) }
    const L = col(izq), R = col(der)
    const hC = tot * k, yC = (H - hC) / 2
    let yi = yC, yo = yC
    const cinta = (x0: number, a0: number, x1: number, a1: number, h: number) => { const m = (x0 + x1) / 2; return `M${x0},${a0}C${m},${a0} ${m},${a1} ${x1},${a1}L${x1},${a1 + h}C${m},${a1 + h} ${m},${a0 + h} ${x0},${a0 + h}Z` }
    const hilo = (x0: number, a0: number, x1: number, a1: number) => { const m = (x0 + x1) / 2; return `M${x0},${a0}C${m},${a0} ${m},${a1} ${x1},${a1}` }
    const ci = L.map(o => { const h = o.n.valor * k, r = { o, d: cinta(xl + nw, o.y, xc, yi, h), c: hilo(xl + nw, o.y + h / 2, xc, yi + h / 2), h }; yi += h; return r })
    const co = R.map(o => { const h = o.n.valor * k, r = { o, d: cinta(xc + tw, yo, xr, o.y, h), c: hilo(xc + tw, yo + h / 2, xr, o.y + h / 2), h }; yo += h; return r })
    // etiquetas: cada una en el centro de su nodo, pero sin pisarse (se empujan y una guía las une al nodo)
    const coloca = (os: { y: number; h: number }[]) => {
      const sp = estrecho ? 31 : 32, ys = os.map(o => o.y + o.h / 2)
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + sp)
      const sobra = ys.at(-1)! - (H - 12); if (sobra > 0) { ys[ys.length - 1] -= sobra; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - sp) }
      return ys
    }
    return { L, R, ci, co, xl, xr, xc, tw, nw, yC, hC, tot, eL: coloca(L), eR: coloca(R) }
  }, [w, izq, der, H, lab, estrecho])
  const etiqueta = (o: { n: NodoSankey; y: number; h: number }, lado: 'l' | 'r', cy: number) => {
    const x = lado === 'l' ? g!.xl - 14 : g!.xr + g!.nw + 14, cn = o.y + o.h / 2
    const dos = true
    return <>{Math.abs(cy - cn) > 2 && <path d={lado === 'l' ? `M${g!.xl - 2},${cn}L${g!.xl - 10},${cy}` : `M${g!.xr + g!.nw + 2},${cn}L${g!.xr + g!.nw + 10},${cy}`} className="sk-guia" />}<text x={x} y={cy} textAnchor={lado === 'l' ? 'end' : 'start'} className="sk-lab" opacity={activo && activo !== o.n.id ? 0.45 : 1}>
      <tspan x={x} dy={dos ? -2 : 4}>{estrecho ? o.n.corto ?? o.n.nombre : o.n.nombre}</tspan>
      {dos && <tspan x={x} dy={estrecho ? 13 : 15} className="sk-v">{fmt(o.n.valor)} · {Math.round((o.n.valor / g!.tot) * 100)} %</tspan>}
    </text></>
  }
  return (
    <figure className="g-fig sk" ref={vref}>
      <div ref={wref} className="g-plot">
        {g && <svg width={w} height={H} role="img" aria-label={titulo}>
          <defs>
            <pattern id="sk-raya" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,138,149,.12)" /><line x1="0" y1="0" x2="0" y2="6" stroke="#ff8a95" strokeWidth="2" /></pattern>
            <clipPath id="sk-clip"><motion.rect x={0} y={0} height={H} initial={{ width: 0 }} animate={{ width: visto ? w : 0 }} transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }} /></clipPath>
          </defs>
          <g clipPath="url(#sk-clip)">
            {[...g.ci, ...g.co].map(({ o, d, c, h }) => {
              const on = !activo || activo === o.n.id
              return <g key={o.n.id + d.slice(0, 12)} className="sk-cinta" onPointerEnter={() => setHover(o.n.id)} onPointerLeave={() => setHover(null)} onClick={() => onSel?.(sel === o.n.id ? null : o.n.id)}>
                <path d={d} fill={o.n.rayado ? 'url(#sk-raya)' : o.n.color} opacity={on ? 0.42 : 0.1} style={{ transition: 'opacity .25s' }} />
                {h > 3 && <path d={c} className="sk-hilo" style={{ strokeWidth: Math.min(2.5, h / 5), animationDuration: `${2 + (o.n.id.length % 3) * 0.4}s`, opacity: on ? 0.75 : 0.15 }} />}
              </g>
            })}
          </g>
          <rect x={g.xc} y={g.yC} width={g.tw} height={g.hC} className="sk-tronco" rx={2} />
          <text x={g.xc + g.tw / 2} y={g.yC - 8} textAnchor="middle" className="sk-centro">{centro}</text>
          {[...g.L.map(o => ['l', o] as const), ...g.R.map(o => ['r', o] as const)].map(([lado, o], i) => (
            <g key={lado + o.n.id} className="sk-nodo" tabIndex={0} role="button" aria-pressed={sel === o.n.id} aria-label={`${o.n.nombre}: ${fmt(o.n.valor)}`}
              onPointerEnter={() => setHover(o.n.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(o.n.id)} onBlur={() => setHover(null)}
              onClick={() => onSel?.(sel === o.n.id ? null : o.n.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel?.(sel === o.n.id ? null : o.n.id) } }}>
              <motion.rect x={lado === 'l' ? g.xl : g.xr} width={g.nw} rx={2} fill={o.n.rayado ? 'url(#sk-raya)' : o.n.color} stroke={sel === o.n.id ? '#fff' : 'none'}
                initial={{ y: o.y + o.h / 2, height: 0 }} animate={visto ? { y: o.y, height: o.h } : {}} transition={{ delay: (lado === 'l' ? 0 : 0.7) + i * 0.03, duration: 0.5 }} />
              {etiqueta(o, lado, (lado === 'l' ? g.eL : g.eR)[lado === 'l' ? i : i - g.L.length])}
              <rect x={lado === 'l' ? 0 : g.xr - 4} y={o.y - 2} width={lab + 14} height={Math.max(o.h + 4, 18)} fill="transparent" />
            </g>
          ))}
        </svg>}
      </div>
      <details className="g-table"><summary>Ver como tabla</summary>
        <table><thead><tr><th>Concepto</th><th>Importe</th></tr></thead><tbody>
          {izq.map(n => <tr key={'i' + n.id}><th scope="row">Entra · {n.nombre}</th><td>{fmt(n.valor)}</td></tr>)}
          {der.map(n => <tr key={'d' + n.id}><th scope="row">Sale · {n.nombre}</th><td>{fmt(n.valor)}</td></tr>)}
        </tbody></table>
      </details>
    </figure>
  )
}
