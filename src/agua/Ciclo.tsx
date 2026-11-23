import { fmt } from './data'

/**
 * Después del grifo: el agua usada baja por las alcantarillas, entra en la depuradora (con su puente giratorio)
 * y sale repartida por destinos, cada tubería tan gruesa como su parte. Por dentro corren partículas.
 */
const DEST: [string, string, string][] = [
  ['Agua reutilizada', 'Se reutiliza', '#3df5b0'],
  ['A un cauce fluvial', 'Al río', '#3fe6ff'],
  ['Al mar', 'Al mar', '#3987e5'],
  ['Infiltraciones al terreno', 'Al terreno', '#c9a46a'],
  ['Otros', 'Otros', '#8a9bb0'],
]
export function Ciclo({ dest, tratada, km, titulo }: { dest: Record<string, number | null>; tratada?: number | null; km?: number | null; titulo: string }) {
  const W = 392, H = 214, cx = 170, cy = 96, R = 34
  const partes = DEST.map(([k, n, c]) => ({ k, n, c, v: Math.max(0, dest[k] ?? 0) })).filter(x => x.v > 0.05)
  const tot = partes.reduce((s, x) => s + x.v, 0) || 1
  const x1 = W - 104
  // salidas repartidas en vertical, de arriba abajo
  const gap = Math.min(40, (H - 30) / Math.max(1, partes.length))
  const y0 = cy - ((partes.length - 1) * gap) / 2
  return (
    <figure className="ciclo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: ${partes.map(p => `${p.n} ${fmt(p.v, 1)} %`).join(', ')}`}>
        {/* el grifo y la casa */}
        <g className="ci-casa" transform="translate(10 56)">
          <path d="M0 22 L20 6 L40 22 L40 50 L0 50 Z" />
          <path d="M14 50 V34 H26 V50" />
          <text x={20} y={66} textAnchor="middle" className="ci-lab">Grifo</text>
        </g>
        {/* alcantarilla: baja bajo tierra y llega a la depuradora */}
        <line x1={0} x2={W} y1={cy + 52} y2={cy + 52} className="ci-suelo" />
        <path d={`M40 ${cy - 4} C 70 ${cy - 4}, 64 ${cy + 40}, 96 ${cy + 40} L ${cx - R - 6} ${cy + 40} C ${cx - R + 4} ${cy + 40}, ${cx - R} ${cy + 12}, ${cx - R} ${cy}`} className="ci-tubo" style={{ strokeWidth: 9 }} />
        <path d={`M40 ${cy - 4} C 70 ${cy - 4}, 64 ${cy + 40}, 96 ${cy + 40} L ${cx - R - 6} ${cy + 40} C ${cx - R + 4} ${cy + 40}, ${cx - R} ${cy + 12}, ${cx - R} ${cy}`} className="ci-flujo" style={{ stroke: '#a98d6a' }} />
        <text x={100} y={cy + 66} className="ci-lab">Alcantarillado{km ? ` · ${fmt(km)} km` : ''}</text>
        {/* salidas */}
        {partes.map((p, i) => {
          const y = y0 + i * gap, w = Math.max(2, (p.v / tot) * 26)
          const d = `M ${cx + R} ${cy} C ${cx + R + 40} ${cy}, ${x1 - 60} ${y}, ${x1} ${y}`
          return <g key={p.k}>
            <path d={d} className="ci-tubo" style={{ strokeWidth: w + 4 }} />
            <path d={d} className="ci-cinta" style={{ stroke: p.c, strokeWidth: w }} />
            <path d={d} className="ci-flujo" style={{ animationDuration: `${1.2 + i * 0.25}s` }} />
            <text x={x1 + 6} y={y - 1} className="ci-lab" style={{ fill: p.c }}>{p.n}</text>
            <text x={x1 + 6} y={y + 12} className="ci-num">{fmt(p.v, p.v < 10 ? 1 : 0)} %</text>
          </g>
        })}
        {/* la depuradora: decantador redondo con su puente girando */}
        <circle cx={cx} cy={cy} r={R + 5} className="ci-muro" />
        <circle cx={cx} cy={cy} r={R} className="ci-balsa" />
        <circle cx={cx} cy={cy} r={R * 0.55} className="ci-anillo" />
        <g className="ci-puente" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <line x1={cx - R} x2={cx + R} y1={cy} y2={cy} />
          <circle cx={cx + R - 4} cy={cy} r={2.5} />
        </g>
        <circle cx={cx} cy={cy} r={4} className="ci-centro" />
        <text x={cx} y={cy - R - 12} textAnchor="middle" className="ci-lab">Depuradora</text>
        {tratada ? <text x={cx} y={cy + R + 20} textAnchor="middle" className="ci-num">{fmt(tratada / 1e6, tratada >= 1e7 ? 1 : 2)} millones m³/día</text> : null}
      </svg>
    </figure>
  )
}
