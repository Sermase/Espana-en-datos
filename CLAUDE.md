# España en datos — notas para Claude

- Web pública sin login. No añadir Firebase ni la cuenta IstariCore salvo que Ser lo pida.
- Una página por tema (`agua/`, …) más la portada. Los temas, su orden y su color de acento viven en `src/temas.ts`: el color de cada tema se usa en su página y en la portada.
- No todo es mapa: cada tema usa la vista que mejor cuenta su dato (mapa, paneles y series, pirámide, relieve).
- Los datos salen de los scripts de `scripts/`, nunca editados a mano. Un tema solo se publica si su descarga está en el workflow.
- La portada lee solo `src/resumen.json`; no importar los datos completos de un tema desde la portada.
- Agua (Caudal): todo sale de `src/agua/data/snapshot.json` y `public/agua/data/`. Vertidos: es volumen *autorizado*, no consumo; no mostrar titulares que sean personas físicas. Los ríos (`rios.json`) se regeneran con `python3 scripts/build-rivers.py fuentes/siane`. El plano de referencia de las capas sin ríos (`public/agua/data/referencia.json`: autovías, manchas urbanas y ciudades de Natural Earth) se regenera con `python3 scripts/build-referencia.py`.
- Caudal es un solo mapa SVG para todas las capas (`src/agua/geo.ts`): Canarias en recuadro y Ceuta y Melilla marcadas siempre. Ríos solo en Embalses, Energía y Ríos. Las capas de ciudad (Grifo → Cloacas → Depuradora) enseñan comunidades de lejos y puntos de cerca (`CERCA` en `Board.tsx`).
- Los textos de los paneles se calculan a partir del dato (sube/baja, más/menos). Si añades frases, que también lo hagan.
- Antes de dar algo por bueno: `npx tsc -b && npm run build`, y capturas en 1440×900 y 390×844.
- Movimiento: respetar `prefers-reduced-motion`.
