import type { Escena, Modelo, Seg } from './Holo3D'

// Piezas sueltas en coordenadas de la escena: el suelo es y = 0, la altura útil ≈ 1.
const TAU = Math.PI * 2
function anillo(out: Seg[], r: number, y: number, n = 28, cx = 0, cz = 0) {
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU; out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, cx + Math.cos(b) * r, y, cz + Math.sin(b) * r]) }
}
function caja(out: Seg[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) out.push([...P[a], ...P[b]] as Seg)
}
function cilindro(out: Seg[], r0: number, r1: number, y0: number, y1: number, cx = 0, cz = 0, lados = 10, anillos = 2) {
  for (let k = 0; k <= anillos; k++) { const f = k / anillos; anillo(out, r0 + (r1 - r0) * f, y0 + (y1 - y0) * f, 20, cx, cz) }
  for (let i = 0; i < lados; i++) { const a = (i / lados) * TAU; out.push([cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0, cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1]) }
}
/** Partículas que suben y se abren, como vapor o humo. */
function humo(t: number, x: number, y: number, z: number, n: number, alto: number, vel = 0.12) {
  const p: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const f = ((t * vel + i / n) % 1), ang = i * 2.39996
    p.push([x + Math.cos(ang) * f * 0.12 + f * 0.1, y + f * alto, z + Math.sin(ang) * f * 0.12])
  }
  return p
}

/** Aerogenerador: las palas giran según `fuerza` (0–1, la eólica de esta hora frente a su máximo). */
export const eolica = (fuerza = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const H = 0.95, hub: [number, number, number] = [0, H, 0.06]
  cilindro(tenue, 0.05, 0.022, 0, H - 0.03, 0, 0, 8, 4)
  caja(fuerte, -0.05, 0.05, H - 0.04, H + 0.04, -0.12, 0.06)
  const a0 = t * (0.4 + fuerza * 2.6)
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k / 3) * TAU, L = 0.62, c = Math.cos(a), s = Math.sin(a), pc = Math.cos(a + 0.09), ps = Math.sin(a + 0.09)
    const tip: [number, number, number] = [hub[0] + c * L, hub[1] + s * L, hub[2]]
    const mid: [number, number, number] = [hub[0] + pc * L * 0.28, hub[1] + ps * L * 0.28, hub[2]]
    fuerte.push([...hub, ...tip] as Seg, [...hub, ...mid] as Seg, [...mid, ...tip] as Seg)
  }
  anillo(fuerte, 0.03, H, 10, 0, 0.06)
  // el viento: líneas que cruzan
  const puntos: [number, number, number][] = []
  for (let i = 0; i < 14; i++) { const f = (t * (0.15 + fuerza * 0.5) + i / 14) % 1; puntos.push([-0.8 + f * 1.6, 0.35 + (i % 5) * 0.16, -0.3 + ((i * 7) % 5) * 0.15]) }
  return { fuerte, tenue, puntos }
}

/** Campo solar: paneles inclinados y el sol a la altura que tocaría a esa hora (`sol` 0–1). */
export const solar = (sol = 0.6): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const inc = 0.5
  for (let fila = 0; fila < 3; fila++) for (let col = 0; col < 2; col++) {
    const x0 = -0.5 + col * 0.52, z0 = -0.4 + fila * 0.32, w = 0.46, d = 0.22, y0 = 0.12
    const p = (u: number, v: number): [number, number, number] => [x0 + u * w, y0 + v * d * Math.sin(inc), z0 + v * d * Math.cos(inc)]
    for (let i = 0; i <= 4; i++) tenue.push([...p(i / 4, 0), ...p(i / 4, 1)] as Seg)
    for (let j = 0; j <= 2; j++) (j === 0 || j === 2 ? fuerte : tenue).push([...p(0, j / 2), ...p(1, j / 2)] as Seg)
    fuerte.push([...p(0, 0), ...p(0, 1)] as Seg, [...p(1, 0), ...p(1, 1)] as Seg)
    tenue.push([x0 + w / 2, 0, z0 + 0.05, ...p(0.5, 0.3)] as Seg)
  }
  const ys = 0.45 + sol * 0.55, sx = 0.55 - sol * 0.4
  anillo(fuerte, 0.09, ys, 18, sx, 0)
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + t * 0.4; tenue.push([sx + Math.cos(a) * 0.13, ys + Math.sin(a) * 0.13, 0, sx + Math.cos(a) * (0.17 + 0.03 * Math.sin(t * 3 + i)), ys + Math.sin(a) * (0.17 + 0.03 * Math.sin(t * 3 + i)), 0]) }
  return { fuerte, tenue }
}

/** Presa: muro en arco, el agua del embalse detrás y el chorro que turbina según `caudal` (0–1). */
export const hidraulica = (caudal = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const R = 0.9, a0 = -0.55, a1 = 0.55, n = 14, Hm = 0.6
  const P = (a: number, y: number, r = R): [number, number, number] => [Math.sin(a) * r, y, Math.cos(a) * r - R + 0.1]
  fuerte.push([...P(a0, 0), ...P(a0, Hm)] as Seg, [...P(a1, 0), ...P(a1, Hm)] as Seg)
  for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / n), b = a0 + (a1 - a0) * ((i + 1) / n); fuerte.push([...P(a, Hm), ...P(b, Hm)] as Seg, [...P(a, 0, R + 0.08), ...P(b, 0, R + 0.08)] as Seg); tenue.push([...P(a, 0), ...P(b, 0)] as Seg, [...P(a, Hm * 0.5, R - 0.03), ...P(b, Hm * 0.5, R - 0.03)] as Seg) }
  for (let i = 0; i <= n; i += 2) { const a = a0 + (a1 - a0) * (i / n); tenue.push([...P(a, 0, R + 0.08), ...P(a, Hm)] as Seg) }
  // lámina de agua con ondas
  for (let k = 0; k < 5; k++) { const r = R + 0.12 + k * 0.1, y = Hm * 0.85 + 0.01 * Math.sin(t * 2 + k); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / n), b = a0 + (a1 - a0) * ((i + 1) / n); tenue.push([...P(a, y, r), ...P(b, y, r)] as Seg) } }
  const puntos: [number, number, number][] = []
  const m = Math.round(6 + caudal * 16)
  for (let i = 0; i < m; i++) { const f = (t * 0.7 + i / m) % 1; puntos.push([(i % 3 - 1) * 0.05, Hm * 0.35 * (1 - f * f), 0.12 + f * 0.55]) }
  return { fuerte, tenue, puntos }
}

/** Nuclear: dos torres de refrigeración (hiperboloides) con vapor. */
export const nuclear = (): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  for (const [cx, cz] of [[-0.32, 0], [0.32, 0.05]]) {
    const r = (y: number) => 0.16 * Math.sqrt(1 + ((y - 0.5) / 0.3) ** 2) * 0.85
    for (let k = 0; k <= 6; k++) { const y = 0.05 + (k / 6) * 0.65; anillo(k === 0 || k === 6 ? fuerte : tenue, r(y), y, 22, cx, cz) }
    for (let i = 0; i < 12; i++) { // generatrices torcidas: la forma típica
      const a = (i / 12) * TAU
      let prev: [number, number, number] | null = null
      for (let k = 0; k <= 6; k++) { const y = 0.05 + (k / 6) * 0.65, b = a + (k / 6) * 0.9, p: [number, number, number] = [cx + Math.cos(b) * r(y), y, cz + Math.sin(b) * r(y)]; if (prev) tenue.push([...prev, ...p] as Seg); prev = p }
    }
  }
  caja(fuerte, -0.1, 0.1, 0, 0.28, -0.42, -0.24)
  anillo(fuerte, 0.1, 0.32, 16, 0, -0.33)
  const puntos = [...humo(t, -0.32, 0.72, 0, 16, 0.4), ...humo(t + 3, 0.32, 0.72, 0.05, 16, 0.4)]
  return { fuerte, tenue, puntos }
}

/** Central térmica (gas, carbón, cogeneración): nave, chimeneas y humo según `uso` (0–1). */
export const termica = (chimeneas = 1, uso = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  caja(fuerte, -0.45, 0.15, 0, 0.3, -0.25, 0.2)
  caja(tenue, 0.15, 0.45, 0, 0.18, -0.2, 0.15)
  for (let i = 0; i < 4; i++) tenue.push([-0.45 + i * 0.15, 0.3, -0.25, -0.45 + i * 0.15, 0.3, 0.2])
  const puntos: [number, number, number][] = []
  for (let c = 0; c < chimeneas; c++) {
    const x = 0.28 - c * 0.5, z = -0.05
    cilindro(fuerte, 0.06, 0.04, 0, 0.9, x, z, 8, 3)
    puntos.push(...humo(t + c * 2, x, 0.92, z, Math.round(4 + uso * 14), 0.3, 0.1))
  }
  return { fuerte, tenue, puntos }
}

/** Red eléctrica: una torre de alta tensión con pulsos que corren por los cables (la demanda). */
export const red = (carga = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const pata = 0.22, H = 1
  const base = [[-pata, -pata], [pata, -pata], [pata, pata], [-pata, pata]]
  const w = (y: number) => pata * (1 - y / H * 0.85)
  for (const [bx, bz] of base) fuerte.push([bx, 0, bz, Math.sign(bx) * w(H), H, Math.sign(bz) * w(H)])
  for (let k = 1; k <= 5; k++) { const y0 = ((k - 1) / 5) * H, y1 = (k / 5) * H; const a = w(y0), b = w(y1); tenue.push([-a, y0, -a, b, y1, -b], [a, y0, -a, -b, y1, -b], [-a, y0, a, b, y1, b], [a, y0, a, -b, y1, b]); anillo(tenue, b * 1.41, y1, 4) }
  const brazos = [0.62, 0.8]
  for (const y of brazos) fuerte.push([-0.5, y, 0, 0.5, y, 0])
  const puntos: [number, number, number][] = []
  for (const y of brazos) for (const x of [-0.5, 0.5]) {
    tenue.push([x, y, 0, x, y - 0.08, 0], [x, y - 0.08, -0.9, x, y - 0.08, 0.9])
    const n = Math.round(2 + carga * 5)
    for (let i = 0; i < n; i++) puntos.push([x, y - 0.08, -0.9 + ((t * (0.25 + carga * 0.4) + i / n) % 1) * 1.8])
  }
  return { fuerte, tenue, puntos } as Escena
}
