# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]: 2.0.0

A full TypeScript rewrite with a modern toolchain, tests and a live demo.

### Breaking

- The package ships ESM and CJS from `dist/` behind an `exports` map. Deep
  imports into `build/` no longer work.
- The default export is gone; use the named export
  (`import { DrawLayer } from 'leaflet-draw-shapes'`) or `drawLayer()`.
- Removed internal exports: `polygons`, `instanceKey`, `modesKey`, `edgesKey`
  and `notifyDeferredKey`, along with the `map.simplifyPolygon` injection.
- Mode flags moved onto a `Mode` object (`Mode.CREATE`, …, also
  `DrawLayer.Mode`). `EDIT_APPEND` is gone; use `Mode.EDIT | Mode.APPEND`.
- Methods follow Leaflet's naming: `mode()` is `getMode()`/`setMode()`,
  `style()` is `getStyle()`/`setStyle()`, `create()` is `addPolygon()`,
  `removePolygon()` is `removeLayer()` and `clear()` is `clearLayers()`.
  `all()` and `size()` are gone; use `getLayers()`. Setters and `cancel()`
  return the layer for chaining.
- The `markers` event is replaced by `shapes:create`, `shapes:edit` and
  `shapes:remove`, carrying the affected polygons as `layers`, and
  `shapes:change`, carrying every polygon. The `mode` event is now
  `shapes:modechange`. All of them also fire on the map.
- Renamed options: `elbowDistance` to `appendTolerance`, `concavePolygon` to
  `concaveHull` and `maximumPolygons` to `maxPolygons`. `defaultOptions` is no
  longer exported; the defaults are on `DrawLayer.prototype.options`.
- CSS classes are prefixed with `leaflet-draw-shapes-`: `.leaflet-polygon`,
  `.leaflet-edge`, `.leaflet-line` and the `mode-*` container classes became
  `-polygon`, `-vertex`, `-sketch` and `-mode-*`.
- Styling moved to the `style` option. Polygon options such as `color` and
  `smoothFactor` sit at its top level, like `Path.setStyle()`. The
  `strokeWidth` option is now `style.sketch.width`.
- Polygons are now children of the `DrawLayer` feature group.
- Removing the layer from the map takes its polygons and vertex handles off the
  map, removes its SVG overlay, DOM listeners and mode classes, and re-enables
  map dragging. The polygons are kept and return when the layer is added again.
- Vertex handles are SVG circle markers instead of `DivIcon` markers, and are
  only on the map in `EDIT` mode. The `.leaflet-edge.disabled` class is gone.
- No event is fired after a click that didn't draw anything.

### Added

- Strict TypeScript source. Listeners for the `shapes:*` events are typed on
  the layer and on the map.
- Each mode flag is also an `L.Handler`: `layer.drawing`, `layer.editing`,
  `layer.deleting` and `layer.appending`.
- `addData(geojson)` adds the polygons of a GeoJSON object as given.
- `addLayer(polygon)` makes any `L.Polygon` editable.
- Typed `style` option: one accent `color` themes polygons, vertex handles and
  the freehand line, with `vertex` and `sketch` overrides. No CSS import is
  needed.
- Vertex handles are invisible until hovered or dragged, so shapes look clean
  while staying editable. Use `style.showVertices: 'always'` to keep them visible.
- `addPolygon()` accepts `[lat, lng]` tuples, and queues shapes added before
  the layer is on a map.
- `setMode()` works before the layer is added to a map.
- Several `DrawLayer` instances can share one map.
- `DrawLayer.extend()`, `include()`, `mergeOptions()` and `addInitHook()` work
  as for Leaflet's own classes, as does `class extends DrawLayer`.
- A script-tag build, `dist/leaflet-draw-shapes.iife.js`, which registers
  `L.DrawLayer` and `L.drawLayer`, served by unpkg and jsDelivr.
- `@types/leaflet` is an optional peer dependency.
- Interactive demo, published to GitHub Pages.
- Test suite with Vitest, run in CI against Leaflet 1.8 and 1.9.
- Releases publish to npm from GitHub Releases, with provenance.

### Fixed

- Every vertex drag added another `mouseup` listener to the marker, so later
  drags re-ran the edit logic several times.
- Dragging a vertex in `CREATE | EDIT` mode (including the default `ALL`) also
  drew a freehand stroke.
- Mouse buttons other than the primary one started strokes.
- After the layer was removed, `mousedown` on the map still ran draw handlers
  and threw.
- `create()` returned `[]` when the new polygon didn't overlap anything while
  merging was enabled.
- Appending a vertex with both `DELETE` and `APPEND` active fired a `remove`
  event.
- `maximumPolygons` could be exceeded when a self-intersecting stroke split
  into several polygons.
- At `maxPolygons`, a shape that overlaps an existing one is merged into it
  instead of being rejected.
- Leaving `CREATE` mode no longer re-enables dragging on maps created with
  `dragging: false`.
- The example build failed: Parcel treated `main` as an output target.

### Changed

- The build uses tsdown (ESM + CJS + `.d.ts`), replacing `tsc` to ES5/CJS.
- Dependencies cut from six to one, and the bundle size added to apps from
  about 30 kB to 14 kB gzipped. `d3-selection`, `d3-shape`, `@turf/intersect`,
  `turf-polygon`, `concavehull` and `clipper-lib` were removed. Polygon
  operations use [`polygon-clipping`](https://github.com/mfogel/polygon-clipping)
  (non-zero rule, as before), and the concave hull is a TypeScript port
  verified against the original.
- The freehand stroke is a single SVG path instead of one path per mouse move.
- Moved from Yarn 1 to pnpm, Parcel to Vite, TypeScript 4.7 to 6.0 and
  Prettier 2 to 3, and added ESLint with typescript-eslint.

## 1.0.6 and earlier

Initial releases. See the [git history](https://github.com/Nalhin/leaflet-draw-shapes/commits/main).
