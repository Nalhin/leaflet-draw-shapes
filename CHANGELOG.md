# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]: 2.0.0

A full TypeScript rewrite with a modern toolchain, tests and a live demo.

### Breaking

- The package ships ESM and CJS from `dist/` behind an `exports` map. Deep
  imports into `build/` no longer work.
- Removed internal exports: `polygons`, `instanceKey`, `modesKey`, `edgesKey`
  and `notifyDeferredKey`, along with the `map.simplifyPolygon` injection.
- Removing the layer from the map now removes its polygons, vertex markers, SVG
  overlay, DOM listeners and mode classes, and re-enables map dragging.
- Polygons are now children of the `DrawLayer` feature group.
- `create()` returns `[]` instead of `undefined` when the layer isn't on a map.
- Vertex handles are SVG circle markers instead of `DivIcon` markers, and are
  only on the map in `EDIT` mode. The `.leaflet-edge.disabled` class is gone.
- `strokeWidth` is deprecated in favour of `style.stroke.width`.
- `markers` is no longer fired after a click that didn't draw anything.

### Added

- Strict TypeScript source with typed `on`/`once`/`off` for the `markers` and
  `mode` events, plus exported `MarkersEvent`, `ModeEvent` and `Mode` types.
- Typed `style` option: one accent `color` themes polygons, vertex handles and
  the drawing stroke, with per-part overrides (`polygon`, `vertex`, `stroke`).
  Change it at runtime with `layer.style({...})`. No CSS import is needed.
- Vertex handles are invisible until hovered or dragged, so shapes look clean
  while staying editable. Use `style.showVertices: 'always'` to keep them visible.
- `create()` accepts `[lat, lng]` tuples.
- `mode()` works before the layer is added to a map.
- Several `DrawLayer` instances can share one map.
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
- Leaving `CREATE` mode no longer re-enables dragging on maps created with
  `dragging: false`.
- The example build failed: Parcel treated `main` as an output target.

### Changed

- The build uses tsdown (ESM + CJS + `.d.ts`), replacing `tsc` to ES5/CJS.
- The `d3-selection`, `d3-shape`, `@turf/intersect`, `turf-polygon` and
  `concavehull` dependencies were removed. Overlap detection now uses
  `clipper-lib`, and the concave hull is a TypeScript port verified against the
  original.
- The freehand stroke is a single SVG path instead of one path per mouse move.
- Moved from Yarn 1 to pnpm, Parcel to Vite, TypeScript 4.7 to 6.0 and
  Prettier 2 to 3, and added ESLint with typescript-eslint.

## 1.0.6 and earlier

Initial releases. See the [git history](https://github.com/Nalhin/leaflet-draw-shapes/commits/main).
