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

// ---------------- Barcos, tuberías y el globo (gas, petróleo y comercio) ----------------
/** Casco de barco: secciones a lo largo del eje x, con proa afilada. Devuelve la cubierta a la altura `yc`. */
function casco(fuerte: Seg[], tenue: Seg[], L: number, B: number, yc: number, bob: number) {
  const n = 10, sec: [number, number, number][][] = []
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (i / n) * L, f = i / n
    const ancho = B * (f > 0.8 ? Math.max(0.05, (1 - f) / 0.2) : f < 0.08 ? 0.75 + f * 3 : 1)
    sec.push([[x, bob, -ancho * 0.7], [x, bob + yc, -ancho], [x, bob + yc, ancho], [x, bob, ancho * 0.7]])
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) ((k === 1 || k === 2) ? fuerte : tenue).push([...sec[i][k], ...sec[i + 1][k]] as Seg)
  for (let i = 0; i <= n; i += 2) for (let k = 0; k < 3; k++) tenue.push([...sec[i][k], ...sec[i][k + 1]] as Seg)
}
function olas(t: number, n = 26): [number, number, number][] {
  const p: [number, number, number][] = []
  for (let i = 0; i < n; i++) { const x = -0.85 + ((i * 0.37) % 1.7), z = -0.5 + ((i * 0.61) % 1), f = (t * 0.25 + i / n) % 1; p.push([x - f * 0.2, 0.01 + 0.015 * Math.sin(t * 2 + i), z]) }
  return p
}
function esfera(out: Seg[], cx: number, cy: number, cz: number, r: number, lat = 4, lon = 8) {
  for (let k = 1; k < lat; k++) { const a = -Math.PI / 2 + (k / lat) * Math.PI; anillo(out, Math.cos(a) * r, cy + Math.sin(a) * r, 18, cx, cz) }
  for (let j = 0; j < lon; j++) {
    const b = (j / lon) * TAU
    for (let k = 0; k < 10; k++) { const a0 = -Math.PI / 2 + (k / 10) * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / 10) * Math.PI; out.push([cx + Math.cos(a0) * Math.cos(b) * r, cy + Math.sin(a0) * r, cz + Math.cos(a0) * Math.sin(b) * r, cx + Math.cos(a1) * Math.cos(b) * r, cy + Math.sin(a1) * r, cz + Math.cos(a1) * Math.sin(b) * r]) }
  }
}

/** Metanero: buque de gas natural licuado con sus tanques esféricos. */
export const metanero = (): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], bob = 0.04 + 0.015 * Math.sin(t * 1.3)
  casco(fuerte, tenue, 1.5, 0.2, 0.14, bob)
  for (let i = 0; i < 4; i++) esfera(i % 2 ? tenue : fuerte, -0.42 + i * 0.27, bob + 0.24, 0, 0.12, 4, 8)
  caja(fuerte, -0.72, -0.6, bob + 0.14, bob + 0.36, -0.12, 0.12)
  return { fuerte, tenue, puntos: olas(t) }
}
/** Petrolero: casco largo, tuberías en cubierta y el puente a popa. */
export const petrolero = (): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], bob = 0.04 + 0.012 * Math.sin(t * 1.1)
  casco(fuerte, tenue, 1.55, 0.22, 0.15, bob)
  for (const z of [-0.05, 0, 0.05]) tenue.push([-0.55, bob + 0.17, z, 0.6, bob + 0.17, z])
  for (let i = 0; i < 6; i++) tenue.push([-0.45 + i * 0.2, bob + 0.15, -0.16, -0.45 + i * 0.2, bob + 0.15, 0.16])
  caja(fuerte, -0.74, -0.58, bob + 0.15, bob + 0.42, -0.14, 0.14)
  cilindro(fuerte, 0.025, 0.02, bob + 0.42, bob + 0.55, -0.66, 0, 6, 1)
  return { fuerte, tenue, puntos: [...olas(t), ...humo(t, -0.66, bob + 0.56, 0, 6, 0.2, 0.08)] }
}
/** Gasoducto: tramo de tubería sobre soportes con el gas que corre por dentro. */
export const gasoducto = (flujo = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const y = 0.3, r = 0.06, L = 0.85
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; (i % 3 ? tenue : fuerte).push([-L, y + Math.cos(a) * r, Math.sin(a) * r, L, y + Math.cos(a) * r, Math.sin(a) * r]) }
  for (let k = 0; k <= 8; k++) { const x = -L + (k / 8) * 2 * L; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, b = ((i + 1) / 12) * TAU; tenue.push([x, y + Math.cos(a) * r, Math.sin(a) * r, x, y + Math.cos(b) * r, Math.sin(b) * r]) } }
  for (let k = 0; k < 4; k++) { const x = -0.65 + k * 0.43; fuerte.push([x, 0, -0.08, x, y - r, 0], [x, 0, 0.08, x, y - r, 0]) }
  const puntos: [number, number, number][] = [], n = Math.round(10 + flujo * 20)
  for (let i = 0; i < n; i++) { const f = (t * (0.15 + flujo * 0.35) + i / n) % 1; puntos.push([-L + f * 2 * L, y + 0.02 * Math.sin(i * 1.7), 0.02 * Math.cos(i * 2.3)]) }
  return { fuerte, tenue, puntos }
}
/** Portacontenedores: casco y pilas de contenedores. */
export const portacontenedores = (): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], bob = 0.04 + 0.012 * Math.sin(t * 1.2)
  casco(fuerte, tenue, 1.5, 0.22, 0.13, bob)
  for (let i = 0; i < 7; i++) for (let k = 0; k < 2 + ((i * 5) % 3); k++) caja(k % 2 ? tenue : fuerte, -0.5 + i * 0.14, -0.38 + i * 0.14, bob + 0.13 + k * 0.06, bob + 0.19 + k * 0.06, -0.15, 0.15)
  caja(fuerte, -0.74, -0.6, bob + 0.13, bob + 0.42, -0.14, 0.14)
  return { fuerte, tenue, puntos: olas(t) }
}
/** Globo con rutas: arcos desde cada socio hasta España, con pulsos que viajan (peso 0–1 = grosor del flujo). */
export type Ruta = { lat: number; lon: number; peso: number; sale?: boolean }
export const globo = (rutas: Ruta[]): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], R = 0.5, C: [number, number, number] = [0, 0.62, 0]
  const P = (lat: number, lon: number, r = R): [number, number, number] => { const a = (lat * Math.PI) / 180, b = (-lon * Math.PI) / 180; return [C[0] + Math.cos(a) * Math.cos(b) * r, C[1] + Math.sin(a) * r, C[2] + Math.cos(a) * Math.sin(b) * r] }
  for (let la = -60; la <= 60; la += 30) { let prev: [number, number, number] | null = null; for (let lo = -180; lo <= 180; lo += 12) { const p = P(la, lo); if (prev) tenue.push([...prev, ...p] as Seg); prev = p } }
  for (let lo = -180; lo < 180; lo += 30) { let prev: [number, number, number] | null = null; for (let la = -84; la <= 84; la += 12) { const p = P(la, lo); if (prev) tenue.push([...prev, ...p] as Seg); prev = p } }
  const es = P(40.4, -3.7)
  anillo(fuerte, 0.025, es[1], 10, es[0], es[2])
  const puntos: [number, number, number][] = []
  for (const [i, r] of rutas.entries()) {
    // arco de círculo máximo, levantado sobre la esfera según la distancia
    const a = P(r.lat, r.lon), b = es, arco: [number, number, number][] = []
    const va = [a[0] - C[0], a[1] - C[1], a[2] - C[2]], vb = [b[0] - C[0], b[1] - C[1], b[2] - C[2]]
    const ang = Math.acos(Math.max(-1, Math.min(1, (va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]) / (R * R))))
    for (let k = 0; k <= 16; k++) {
      const f = k / 16, s = Math.sin(ang) || 1, wa = Math.sin((1 - f) * ang) / s, wb = Math.sin(f * ang) / s
      const h = 1 + 0.25 * Math.sin(f * Math.PI) * Math.min(1, ang)
      arco.push([C[0] + (va[0] * wa + vb[0] * wb) * h, C[1] + (va[1] * wa + vb[1] * wb) * h, C[2] + (va[2] * wa + vb[2] * wb) * h])
    }
    for (let k = 0; k < 16; k++) (r.peso > 0.5 ? fuerte : tenue).push([...arco[k], ...arco[k + 1]] as Seg)
    const n = 1 + Math.round(r.peso * 3)
    for (let j = 0; j < n; j++) { const f = (t * 0.35 + j / n + i * 0.13) % 1, idx = Math.min(15, Math.floor((r.sale ? 1 - f : f) * 16)); puntos.push(arco[idx]) }
  }
  return { fuerte, tenue, puntos }
}

/** Bloque de viviendas: plantas, ventanas que se encienden y una casa al lado. `luz` 0–1 = cuántas ventanas encendidas. */
export const edificio = (luz = 0.6): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const W = 0.34, D = 0.26, P = 9, hp = 0.1, x0 = -0.32
  caja(fuerte, x0 - W / 2, x0 + W / 2, 0, P * hp, -D / 2, D / 2)
  for (let k = 1; k < P; k++) { const y = k * hp; tenue.push([x0 - W / 2, y, D / 2, x0 + W / 2, y, D / 2], [x0 + W / 2, y, -D / 2, x0 + W / 2, y, D / 2]) }
  // casa unifamiliar con tejado a dos aguas
  const cx = 0.34, w = 0.22, d = 0.2, h = 0.2
  caja(fuerte, cx - w / 2, cx + w / 2, 0, h, -d / 2, d / 2)
  for (const z of [-d / 2, d / 2]) fuerte.push([cx - w / 2, h, z, cx, h + 0.14, z], [cx + w / 2, h, z, cx, h + 0.14, z])
  fuerte.push([cx, h + 0.14, -d / 2, cx, h + 0.14, d / 2])
  // ventanas: se encienden y apagan despacio
  const puntos: [number, number, number][] = []
  for (let k = 0; k < P; k++) for (let j = 0; j < 4; j++) {
    const s = Math.sin(k * 12.9898 + j * 78.233) * 43758.5453, r = s - Math.floor(s)
    const on = (r + t * 0.03 * (0.5 + r)) % 1 < luz
    if (on) puntos.push([x0 - W / 2 + (j + 0.5) * (W / 4), k * hp + hp * 0.55, D / 2 + 0.005])
  }
  puntos.push([cx - 0.05, 0.1, d / 2 + 0.005], [cx + 0.05, 0.1, d / 2 + 0.005])
  return { fuerte, tenue, puntos }
}

/** Edificio público de columnas: el dinero entra por un lado y sale repartido por el otro (`flujo` 0–1). */
export const parlamento = (flujo = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const W = 0.62, D = 0.34
  for (let k = 0; k < 3; k++) caja(k === 0 ? fuerte : tenue, -W - 0.06 + k * 0.03, W + 0.06 - k * 0.03, k * 0.03, (k + 1) * 0.03, -D - 0.06 + k * 0.03, D + 0.06 - k * 0.03)
  const y0 = 0.09, y1 = 0.56
  for (let i = 0; i < 6; i++) { const x = -W + 0.06 + (i * (2 * W - 0.12)) / 5; cilindro(i === 0 || i === 5 ? fuerte : tenue, 0.035, 0.03, y0, y1, x, D - 0.04, 8, 1) }
  caja(fuerte, -W, W, y1, y1 + 0.07, -D, D)
  caja(tenue, -W + 0.08, W - 0.08, y0, y1, -D + 0.04, D - 0.12)
  const yt = y1 + 0.07, yc = yt + 0.2
  for (const z of [-D, D]) fuerte.push([-W, yt, z, 0, yc, z], [W, yt, z, 0, yc, z])
  fuerte.push([0, yc, -D, 0, yc, D])
  tenue.push([-W * 0.45, yt + 0.04, D, W * 0.45, yt + 0.04, D])
  // el dinero: entra en un chorro por la izquierda y sale abierto en abanico por la derecha
  const puntos: [number, number, number][] = [], v = 0.12 + flujo * 0.35
  for (let i = 0; i < 18; i++) { const f = (t * v + i / 18) % 1; puntos.push([-1.05 + f * 0.5, 0.3 + Math.sin(i * 3.1) * 0.04, D * 0.4]) }
  for (let i = 0; i < 24; i++) { const f = (t * v + i / 24) % 1, c = (i % 6) / 5 - 0.5; puntos.push([W - 0.05 + f * 0.5, 0.3 + c * f * 0.5, D * 0.4 + c * f * 0.2]) }
  return { fuerte, tenue, puntos }
}

/** Pilas de monedas (una por cada parte, `partes` de 0 a 1) y una moneda que cae, gira y se apila. */
export const monedas = (partes: number[]): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const n = partes.length, gap = 1.2 / Math.max(1, n), r = Math.min(0.15, gap * 0.38), h = 0.035
  const tops: [number, number][] = []
  partes.forEach((p, i) => {
    const x = -0.6 + gap * (i + 0.5), pisos = Math.max(1, Math.round(p * 22))
    for (let k = 0; k <= pisos; k++) anillo(k === pisos || k === 0 ? fuerte : tenue, r, k * h, 22, x, 0)
    for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU; tenue.push([x + Math.cos(a) * r, 0, Math.sin(a) * r, x + Math.cos(a) * r, pisos * h, Math.sin(a) * r]) }
    tops.push([x, pisos * h])
  })
  // la moneda que cae: va pasando de pila en pila
  const ciclo = 1.6, k = Math.floor(t / ciclo) % Math.max(1, n), f = (t % ciclo) / ciclo
  const [x, top] = tops[k] ?? [0, 0], y = top + 0.05 + (1 - f * f) * 0.9, giro = t * 5
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, b = ((i + 1) / 18) * TAU
    fuerte.push([x + Math.cos(a) * r * Math.cos(giro), y + Math.sin(a) * r, Math.cos(a) * r * Math.sin(giro), x + Math.cos(b) * r * Math.cos(giro), y + Math.sin(b) * r, Math.cos(b) * r * Math.sin(giro)])
  }
  const puntos: [number, number, number][] = []
  if (f > 0.85) for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, e = (f - 0.85) * 3; puntos.push([x + Math.cos(a) * (r + e * 0.4), top + 0.02, Math.sin(a) * (r + e * 0.4)]) }
  return { fuerte, tenue, puntos }
}

/** Embudo de recaudación: entran monedas de todas partes y salen por abajo en tantos chorros como `partes` (0–1 cada uno). */
export const embudo = (partes: number[]): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = []
  const yTop = 0.95, yCuello = 0.42, rTop = 0.5, rCuello = 0.07
  anillo(fuerte, rTop, yTop, 40); anillo(tenue, rTop * 0.72, yTop - 0.15, 32); anillo(tenue, rTop * 0.45, yTop - 0.33, 28); anillo(fuerte, rCuello, yCuello, 16)
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; (i % 3 ? tenue : fuerte).push([Math.cos(a) * rTop, yTop, Math.sin(a) * rTop, Math.cos(a) * rCuello, yCuello, Math.sin(a) * rCuello]) }
  cilindro(tenue, rCuello, rCuello, yCuello - 0.1, yCuello, 0, 0, 8, 1)
  const puntos: [number, number, number][] = []
  // monedas que caen en espiral dentro del embudo
  for (let i = 0; i < 26; i++) {
    const f = (t * 0.22 + i / 26) % 1, a = i * 2.4 + f * 7, r = rTop * (1 - f) * 0.92 + rCuello * f
    puntos.push([Math.cos(a) * r, yTop + 0.08 - f * (yTop + 0.08 - yCuello), Math.sin(a) * r])
  }
  // chorros de salida, uno por administración, más denso cuanto mayor su parte
  const n = partes.length
  partes.forEach((p, k) => {
    const ang = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * 1.8, dx = Math.sin(ang), dz = Math.cos(ang) * 0.3
    const m = Math.max(2, Math.round(p * 16))
    for (let i = 0; i < m; i++) { const f = (t * 0.5 + i / m) % 1; puntos.push([dx * f * 0.62, yCuello - 0.1 - f * 0.3, dz * f * 0.62]) }
    tenue.push([0, yCuello - 0.1, 0, dx * 0.62, yCuello - 0.4, dz * 0.62])
  })
  return { fuerte, tenue, puntos }
}

/**
 * Radar de seguridad: un disco con anillos y una aguja que barre; alrededor, una columna por tipo de delito
 * con su peso (`partes`, 0–1). La columna se enciende cuando la aguja pasa por encima y deja un eco en el disco.
 */
export const radar = (partes: number[]): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], puntos: [number, number, number][] = []
  const R = 0.62, n = partes.length
  for (const r of [0.2, 0.4, R]) anillo(r === R ? fuerte : tenue, r, 0, 48)
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; tenue.push([0, 0, 0, Math.cos(a) * R, 0, Math.sin(a) * R]) }
  const barrido = (t * 0.9) % TAU
  // la aguja y su estela
  fuerte.push([0, 0.005, 0, Math.cos(barrido) * R, 0.005, Math.sin(barrido) * R])
  for (let k = 1; k <= 6; k++) { const a = barrido - k * 0.07; tenue.push([0, 0.004, 0, Math.cos(a) * R * (1 - k * 0.04), 0.004, Math.sin(a) * R * (1 - k * 0.04)]) }
  partes.forEach((p, i) => {
    const a = (i / n) * TAU + 0.3, r = 0.28 + (i % 2) * 0.2, x = Math.cos(a) * r, z = Math.sin(a) * r
    const h = 0.06 + Math.sqrt(Math.max(0, p)) * 0.85, w = 0.035
    const d = ((barrido - a) % TAU + TAU) % TAU, vivo = d < 0.9
    caja(vivo ? fuerte : tenue, x - w, x + w, 0, h, z - w, z + w)
    if (vivo) { const e = d / 0.9; anillo(tenue, 0.04 + e * 0.12, 0.002, 14, x, z); for (let j = 0; j < 3; j++) puntos.push([x, h + 0.04 + j * 0.05 + e * 0.1, z]) }
  })
  return { fuerte, tenue, puntos }
}

/**
 * Cúpula de aire: una semiesfera de alambre sobre una ciudad de bloques; desde las chimeneas y los coches
 * suben partículas. `densidad` (0–1) marca cuántas: el aire de ahora o las emisiones del año frente al máximo.
 */
export const cupula = (densidad = 0.5): Modelo => t => {
  const fuerte: Seg[] = [], tenue: Seg[] = [], puntos: [number, number, number][] = []
  const R = 0.62
  // meridianos y paralelos de la cúpula
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU
    for (let j = 0; j < 8; j++) { const b0 = (j / 8) * (Math.PI / 2), b1 = ((j + 1) / 8) * (Math.PI / 2); tenue.push([Math.cos(a) * Math.cos(b0) * R, Math.sin(b0) * R, Math.sin(a) * Math.cos(b0) * R, Math.cos(a) * Math.cos(b1) * R, Math.sin(b1) * R, Math.sin(a) * Math.cos(b1) * R]) }
  }
  for (const b of [0.35, 0.75, 1.15]) anillo(tenue, Math.cos(b) * R, Math.sin(b) * R, 32)
  anillo(fuerte, R, 0, 48)
  // la ciudad: bloques y dos chimeneas
  const bloques: [number, number, number, number][] = [[-0.25, -0.1, 0.16, 0.08], [-0.05, 0.12, 0.24, 0.07], [0.15, -0.15, 0.12, 0.09], [0.28, 0.1, 0.2, 0.07], [-0.32, 0.18, 0.1, 0.06], [0.02, -0.3, 0.14, 0.07]]
  for (const [x, z, h, w] of bloques) caja(tenue, x - w, x + w, 0, h, z - w, z + w)
  const chimeneas: [number, number][] = [[0.38, -0.2], [-0.15, 0.32]]
  for (const [x, z] of chimeneas) cilindro(fuerte, 0.025, 0.02, 0, 0.32, x, z, 6, 1)
  // partículas: más cuanto más densidad; suben y se abren hasta chocar con la cúpula
  const n = Math.round(6 + densidad * 40)
  chimeneas.forEach(([x, z], c) => puntos.push(...humo(t + c * 1.7, x, 0.33, z, Math.round(n / 2), 0.32, 0.1)))
  for (let i = 0; i < n; i++) { const f = (t * 0.05 + i / n) % 1, a = i * 2.4; const r = Math.sqrt((i * 0.618) % 1) * R * 0.85; puntos.push([Math.cos(a) * r, 0.02 + f * Math.sqrt(Math.max(0, R * R - r * r)) * 0.9, Math.sin(a) * r]) }
  return { fuerte, tenue, puntos }
}
