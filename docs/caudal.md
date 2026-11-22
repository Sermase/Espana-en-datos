# Caudal

Consola de mando futurista del agua de España: embalses, energía embalsada, lluvia, caudales de ríos y vertidos, con 38 años de histórico semanal. Web pública, sin login, hecha con la plantilla de IstariCore (React 19, Vite, TypeScript, Tailwind 4, Motion, Lucide) y d3-geo para el mapa.

## Capas

| Tecla | Capa | Qué muestra | Fuente |
|---|---|---|---|
| 1 | Agua | 375 embalses peninsulares, llenado por cuenca, subidas de la semana | MITECO, Boletín Hidrológico |
| 2 | Energía | GWh que podrían producir los embalses hidroeléctricos; producción diaria | MITECO; REE (REData) |
| 3 | Lluvia | Precipitación semanal en los observatorios principales | AEMET, vía el boletín |
| 4 | Ríos | Caudal semanal en 111 estaciones de aforo | MITECO, boletín |
| 5 | Vertidos | Mayores vertidos autorizados (más de 20 hm³/año) de empresas y ciudades | MITECO, Censo Nacional de Vertidos |

Toca cualquier embalse, cuenca, nube o vertido para abrir su ficha; en el móvil se desliza para pasar al siguiente. El dado salta a uno al azar (tecla `R`) y la colección cuenta los embalses que has abierto (se guarda en el navegador).

`/` abre el buscador, `←` `→` recorren, `Esc` cierra. Cada ficha tiene su enlace: `#embalse-15`, `#cuenca-ES030`, `#lluvia-1`, `#vertido-10`.

## Datos

`node scripts/update-data.mjs` regenera `src/agua/data/snapshot.json` y `public/agua/data/history.json` (histórico semanal desde 1988, récords, río y altura de cada presa) desde los servicios públicos de MITECO y la API de REE. No necesita claves. El workflow `.github/workflows/datos.yml` lo ejecuta cada día (REE) y los martes (boletín), guarda el JSON en el repo y publica en GitHub Pages.

Mapa: demarcaciones hidrográficas de MITECO y red de ríos y canales del IGN (SIANE 1:3M, CC BY 4.0, vía rOpenSpain/mapSpain), simplificada con mapshaper; siluetas de embalses del IGN y de MITECO (Láminas_Embalses).

## Desarrollo

```sh
npm ci
npm run dev
npm run build
```

Pendiente: nieve (`Superficie_innivada_cotas`), acuíferos (`Piezómetros`), consumos por unidad de demanda urbana (capa `Unidades_de_demanda_urbana_PHC_2022_2027`) y lluvia en tiempo real con AEMET OpenData (requiere API key como secreto).

## Ríos

`public/agua/data/rios.json` sale de `scripts/build-rivers.py` a partir de la red de ríos y las curvas hipsométricas del IGN (SIANE 1:3M, carpeta `fuentes/siane`) y de las longitudes oficiales del CEDEX (`fuentes/longitudes.txt`). Es geografía fija: no hace falta regenerarlo en cada boletín. Los embalses se enlazan por su identificador y los aforos por su nombre, así que siguen bien aunque cambie el boletín.
