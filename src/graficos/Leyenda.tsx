import { useState } from 'react'

/**
 * Leyenda en la que cada etiqueta es un botón: al pulsarla, esa serie se oculta o vuelve (siempre queda al menos una).
 * «Solo esta» con doble clic. Devuelve el conjunto de ocultas para filtrar las series del gráfico.
 */
export function useOcultas() {
  const [off, setOff] = useState<Set<string>>(new Set())
  return { off, setOff }
}
export function Leyenda({ items, off, setOff, linea = false }: { items: { id: string; nombre: string; color?: string; fondo?: boolean }[]; off: Set<string>; setOff: (s: Set<string>) => void; linea?: boolean }) {
  const toggle = (id: string) => {
    const n = new Set(off)
    if (n.has(id)) n.delete(id); else if (items.length - n.size > 1) n.add(id)
    setOff(n)
  }
  const solo = (id: string) => setOff(off.size === items.length - 1 && !off.has(id) ? new Set() : new Set(items.map(i => i.id).filter(x => x !== id)))
  return <ul className="g-legend g-legend-sel g-legend-tog">
    {items.map(c => <li key={c.id}>
      <button className={off.has(c.id) ? 'is-off' : ''} onClick={() => toggle(c.id)} onDoubleClick={() => solo(c.id)} aria-pressed={!off.has(c.id)} title={off.has(c.id) ? `Mostrar ${c.nombre}` : `Ocultar ${c.nombre} (doble clic: solo esta)`}>
        <i className={c.fondo ? 'is-fondo' : ''} style={{ background: c.color, ...(linea ? {} : { height: 8 }) }} />{c.nombre}
      </button>
    </li>)}
    {off.size > 0 && <li><button className="g-legend-todas" onClick={() => setOff(new Set())}>Ver todas</button></li>}
  </ul>
}
