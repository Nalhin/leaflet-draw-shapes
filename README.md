<div align="center">

# ✏️ Leaflet Draw Shapes

**Freehand polygon drawing for [Leaflet](https://leafletjs.com).**
Sketch shapes with a mouse, pen or finger. Overlapping shapes merge, vertices drag, edges split, and everything comes back as GeoJSON.

[![CI](https://img.shields.io/github/actions/workflow/status/Nalhin/leaflet-draw-shapes/ci.yml?branch=main&event=push&label=CI)](https://github.com/Nalhin/leaflet-draw-shapes/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/leaflet-draw-shapes)](https://www.npmjs.com/package/leaflet-draw-shapes)
[![Downloads](https://img.shields.io/npm/dm/leaflet-draw-shapes)](https://www.npmjs.com/package/leaflet-draw-shapes)
[![Types](https://img.shields.io/npm/types/leaflet-draw-shapes)](https://www.npmjs.com/package/leaflet-draw-shapes)
[![License](https://img.shields.io/github/license/Nalhin/leaflet-draw-shapes)](LICENSE.md)

### [Try the live demo →](https://nalhin.github.io/leaflet-draw-shapes/)

[![Drawing shapes on a map of Warsaw](docs/demo.jpg)](https://nalhin.github.io/leaflet-draw-shapes/)

</div>

## Features

- 🖊️ **Freehand drawing** with mouse, pen and touch.
- 🧲 **Smart shapes.** Strokes are cleaned up with a concave hull, self-intersections are split, and overlapping shapes merge.
- 🎛️ **Composable modes.** Create, edit, delete and append are bit flags, and each one is also an `L.Handler` you can `enable()` and `disable()`.
- 🗺️ **A real Leaflet layer.** `DrawLayer` is a `FeatureGroup`: `addLayer()`, `removeLayer()`, `clearLayers()`, `toGeoJSON()` and `getBounds()` just work, shapes survive being toggled in a layers control, and `extend()`, `include()`, `mergeOptions()` and `addInitHook()` behave like they do for Leaflet's own classes.
- 🎨 **One-line theming.** No CSS to import. A single `color` themes shapes, handles and the freehand line, and `setStyle()` restyles everything live.
- 🦺 **TypeScript-first.** Strictly typed, including listeners for the plugin's events on both the layer and the map.
- 📦 **Light.** About 14 kB gzipped including its single dependency, [`polygon-clipping`](https://github.com/mfogel/polygon-clipping). Ships ESM, CJS and a script-tag build.

## Install

```sh
npm install leaflet-draw-shapes leaflet
# or
pnpm add leaflet-draw-shapes leaflet
```

Supports Leaflet `1.8` and `1.9`.

Or load it from a CDN after Leaflet. The script-tag build registers `L.DrawLayer` and `L.drawLayer`:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw-shapes@2"></script>
<script>
  const shapes = L.drawLayer({ mode: L.DrawLayer.Mode.CREATE }).addTo(map);
</script>
```

## Quick start

```ts
import 'leaflet/dist/leaflet.css';
import { map, tileLayer } from 'leaflet';
import { drawLayer, Mode } from 'leaflet-draw-shapes';

const myMap = map('map').setView([52.2297, 21.0122], 13);
tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(myMap);

const shapes = drawLayer({
  mode: Mode.CREATE | Mode.EDIT,
  style: { color: '#6d5efc' },
}).addTo(myMap);

shapes.on('shapes:create', ({ layers }) => {
  console.log(`drew ${layers.length} shape(s)`);
});

// Later…
const geojson = shapes.toGeoJSON();
```

## Modes

Modes are bit flags on the `Mode` object (also available as `DrawLayer.Mode`). Combine them with `|` and toggle them with `^`.

| Flag          | Value | What it does                                                                                                                       |
| ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Mode.NONE`   | `0`   | Read-only.                                                                                                                         |
| `Mode.CREATE` | `1`   | Draw new shapes. Map panning is paused while active.                                                                               |
| `Mode.EDIT`   | `2`   | Drag vertices.                                                                                                                     |
| `Mode.DELETE` | `4`   | Click a shape to remove it.                                                                                                        |
| `Mode.APPEND` | `8`   | Click near an edge to insert a vertex.                                                                                             |
| `Mode.ALL`    | `15`  | Everything. With `DELETE` and `APPEND` both on, clicks within `appendTolerance` px of an edge append and clicks further in delete. |

```ts
shapes.setMode(Mode.CREATE | Mode.DELETE); // set
shapes.setMode(shapes.getMode() ^ Mode.CREATE); // toggle CREATE
```

Each flag is also a Leaflet [handler](https://leafletjs.com/reference.html#handler), like `map.dragging`:

| Handler            | Flag          |
| ------------------ | ------------- |
| `shapes.drawing`   | `Mode.CREATE` |
| `shapes.editing`   | `Mode.EDIT`   |
| `shapes.deleting`  | `Mode.DELETE` |
| `shapes.appending` | `Mode.APPEND` |

```ts
shapes.editing.enable();
shapes.drawing.disable();
shapes.deleting.enabled(); // false
```

The active modes are also added to the map container as classes (`leaflet-draw-shapes-mode-create`, `-mode-edit`, `-mode-delete`, `-mode-append` and `-mode-none`), which makes styling easy.

## Options

Every option is optional. The defaults live on `DrawLayer.prototype.options`, so `DrawLayer.mergeOptions({ ... })` changes them for every new layer.

| Option                 | Default    | Description                                                                                       |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `mode`                 | `Mode.ALL` | Initial mode.                                                                                     |
| `style`                | see below  | How everything looks. See [Styling](#styling).                                                    |
| `mergePolygons`        | `true`     | Merge shapes that overlap.                                                                        |
| `concaveHull`          | `true`     | Run a concave hull over freehand strokes to tidy them up.                                         |
| `maxPolygons`          | `Infinity` | Maximum number of shapes on the layer.                                                            |
| `leaveModeAfterCreate` | `false`    | Leave `CREATE` mode after each stroke.                                                            |
| `notifyAfterEditExit`  | `false`    | Hold back the events for vertex drags until the mode changes or the layer is removed.             |
| `appendTolerance`      | `10`       | Pixel distance from an edge that counts as an append click when `DELETE` and `APPEND` are active. |
| `simplifyFactor`       | `1.1`      | Pixel distance under which near-duplicate vertices are dropped.                                   |

## API

`DrawLayer` extends [`L.FeatureGroup`](https://leafletjs.com/reference.html#featuregroup), and its inherited methods are the way to manage shapes: `addLayer(polygon)` makes any `L.Polygon` editable (keeping its own style), and `removeLayer()` and `clearLayers()` clean up vertex handles too. On top of that it has:

| Method                          | Returns                   | Description                                                                                                                                                                                 |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addPolygon(latLngs, options?)` | `Polygon[]`               | Add a shape the way a stroke would: self-intersections split and overlaps merge. Skips the concave hull by default. Before the layer is on a map, the shape is queued and `[]` is returned. |
| `addData(geojson)`              | `this`                    | Add the `Polygon`s and `MultiPolygon`s of a GeoJSON object exactly as given. Holes are ignored. Works before the layer is on a map.                                                         |
| `getMode()` / `setMode(mode)`   | `Mode` / `this`           | Read or set the mode.                                                                                                                                                                       |
| `getStyle()` / `setStyle(s)`    | `DrawLayerStyle` / `this` | Read the style, or merge in changes. Existing and new shapes update.                                                                                                                        |
| `cancel()`                      | `this`                    | Abandon the stroke in progress. Handy for an `Escape` key binding.                                                                                                                          |

Use `drawLayer(options)` or `new DrawLayer(options)`. Removing the layer from the map takes its shapes off the map and stops listening for input, but keeps the shapes, so adding it back restores them.

To subclass, use either `class MyLayer extends DrawLayer {}` or Leaflet's `DrawLayer.extend({ ... })`, and `DrawLayer.addInitHook()` and `DrawLayer.include()` work as for any Leaflet class.

### Events

| Event               | Payload      | Fired                                                                                                                                                                                                                       |
| ------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shapes:create`     | `{ layers }` | After the user draws a shape. `layers` are the polygons that now contain it.                                                                                                                                                |
| `shapes:edit`       | `{ layers }` | After the user drags or adds a vertex. `layers` are the resulting polygons.                                                                                                                                                 |
| `shapes:remove`     | `{ layers }` | After the user deletes a shape. `layers` are the removed polygons.                                                                                                                                                          |
| `shapes:change`     | `{ layers }` | After any change to the shapes, including `addPolygon()`, `addData()`, `addLayer()`, `removeLayer()` and `clearLayers()`. `layers` are all shapes. Once per operation, even when a merge adds and removes several polygons. |
| `shapes:modechange` | `{ mode }`   | When the mode changes.                                                                                                                                                                                                      |

Each event fires on the layer and on the map it's on, where `event.sourceTarget` is the layer. Listeners are fully typed:

```ts
import type { ShapesEvent } from 'leaflet-draw-shapes';

shapes.on('shapes:change', ({ layers }: ShapesEvent) =>
  save(shapes.toGeoJSON()),
);
map.on('shapes:create', ({ layers, sourceTarget }) =>
  console.log(sourceTarget, layers),
);
```

Leaflet's own `layeradd` and `layerremove` keep working too, and fire for every polygon a merge adds or removes.

## Styling

There's no CSS to import. Everything is styled from JavaScript through one typed `style` option.

Start with a single accent colour, which themes the shapes, vertex handles and freehand line together:

```ts
drawLayer({ style: { color: 'tomato' } });
```

Vertex handles stay invisible so shapes look clean, but they can still be grabbed. A handle appears when the pointer is on it or while it's being dragged. Set `showVertices: 'always'` to keep them visible.

The top level takes Leaflet [polyline options](https://leafletjs.com/reference.html#polyline-option) for the shapes, just like `Path.setStyle()`. `vertex` takes [circle marker options](https://leafletjs.com/reference.html#circlemarker-option), and `sketch` styles the line drawn while sketching:

```ts
drawLayer({
  style: {
    color: '#6d5efc',
    weight: 2,
    fillOpacity: 0.25,
    dashArray: '6 4',
    vertex: { radius: 6, fillColor: '#fff' },
    sketch: { width: 3, opacity: 0.8 },
  },
});
```

| Part           | Type                                                                       | Defaults                                                     |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `color`        | `string`                                                                   | `'#3388ff'`, Leaflet's blue                                  |
| other keys     | [`PolylineOptions`](https://leafletjs.com/reference.html#polyline-option)  | Leaflet's defaults, `smoothFactor: 0.3`                      |
| `showVertices` | `'hover' \| 'always'`                                                      | `'hover'`: handles are invisible until the pointer is on one |
| `vertex`       | [`CircleMarkerOptions`](https://leafletjs.com/reference.html#circlemarker) | `radius: 5`, `weight: 2`, white fill                         |
| `sketch`       | `{ color, width, opacity, dashArray }`                                     | `width: 2`, `opacity: 1`                                     |

### Changing the style at runtime

`setStyle()` merges a partial style in. Existing shapes and handles update immediately, and new shapes use it too. `getStyle()` returns the current style.

```ts
shapes.setStyle({ color: darkMode ? '#a5b4fc' : '#4f46e5' });
shapes.getStyle(); // the current style
```

### Prefer CSS?

Every element also has a class, so you can style with CSS instead. CSS rules override the SVG attributes set from `style`.

| Class                                                 | Element                                        |
| ----------------------------------------------------- | ---------------------------------------------- |
| `.leaflet-draw-shapes-polygon`                        | Shapes                                         |
| `.leaflet-draw-shapes-vertex`                         | Vertex handles, only on the map in `EDIT` mode |
| `svg.leaflet-draw-shapes .leaflet-draw-shapes-sketch` | The line while drawing                         |
| `.leaflet-draw-shapes-mode-*`                         | Map container, one class per active mode       |

## React Leaflet

```tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { drawLayer, Mode, type ShapesEvent } from 'leaflet-draw-shapes';

export function DrawShapes({
  onChange,
}: {
  onChange: (e: ShapesEvent) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const layer = drawLayer({ mode: Mode.CREATE }).addTo(map);
    layer.on('shapes:change', onChange);
    return () => void layer.remove();
  }, [map, onChange]);

  return null;
}
```

## Upgrading from 1.x

Version 2 is a TypeScript rewrite that follows Leaflet's conventions more closely. The breaking changes are:

- **Package layout.** Files moved from `build/` to `dist/`, and the package now has an `exports` map (ESM plus CJS). Deep imports such as `leaflet-draw-shapes/build/...` no longer resolve. Script-tag users get `dist/leaflet-draw-shapes.iife.js`.
- **No default export.** Use `import { DrawLayer } from 'leaflet-draw-shapes'` or `drawLayer()`.
- **Modes.** The `NONE`, `CREATE`, `EDIT`, `DELETE`, `APPEND`, `EDIT_APPEND` and `ALL` exports are now `Mode.NONE`, `Mode.CREATE` and so on. `EDIT_APPEND` is gone; use `Mode.EDIT | Mode.APPEND`. `mode()` is now `getMode()` and `setMode()`, and `setMode()` returns the layer.
- **Methods.** `create()` is `addPolygon()`, `removePolygon()` is `removeLayer()`, `clear()` is `clearLayers()`, `all()` and `size()` are `getLayers()` and `getLayers().length`.
- **Events.** `markers` is replaced by `shapes:create`, `shapes:edit` and `shapes:remove` with the affected polygons as `layers`, and `shapes:change` with every polygon. Use `layer.toGeoJSON()` where you used `latLngs`. Appending a vertex is a `shapes:edit`. `mode` is now `shapes:modechange`.
- **Options.** `elbowDistance` is `appendTolerance`, `concavePolygon` is `concaveHull` and `maximumPolygons` is `maxPolygons`.
- **Styling moved to `style`.** Polygon options such as `color` and `smoothFactor` go at the top level of `style`, and `color` also themes vertex handles and the freehand line. `strokeWidth` is now `style.sketch.width`. Vertex handles are SVG circles now.
- **CSS classes are prefixed.** `.leaflet-polygon` is `.leaflet-draw-shapes-polygon`, `.leaflet-edge` is `.leaflet-draw-shapes-vertex`, `.leaflet-line` is `.leaflet-draw-shapes-sketch` and `mode-*` is `leaflet-draw-shapes-mode-*`.
- **Internal exports removed.** `polygons`, `instanceKey`, `modesKey`, `edgesKey`, `notifyDeferredKey` and the `map.simplifyPolygon` hook are gone.
- **Shapes are children of the layer.** `getLayers()`, `toGeoJSON()` and `getBounds()` return them.

See the [changelog](CHANGELOG.md) for the full list, including bug fixes.

## Development

```sh
pnpm install
pnpm dev          # demo at http://localhost:5173, using the source directly
pnpm test         # vitest (jsdom + a real Leaflet map)
pnpm check        # lint, format, typecheck, test and build: everything CI runs
```

Releases are published from GitHub Releases. See [CONTRIBUTING.md](CONTRIBUTING.md#releasing).

## Credits

Based on [Leaflet.FreeDraw](https://github.com/Wildhoney/Leaflet.FreeDraw) by Adam Timberlake, including a TypeScript port of his [ConcaveHull](https://github.com/Wildhoney/ConcaveHull). Polygon operations use [polygon-clipping](https://github.com/mfogel/polygon-clipping).

## License

[MIT](LICENSE.md) © Krzysztof Olipra
