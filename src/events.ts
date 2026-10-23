import type { LeafletEvent, Polygon } from 'leaflet';
import type { Mode } from './modes';

/**
 * Fired with the polygons involved:
 * - `shapes:create`: the polygons that now contain the new shape.
 * - `shapes:edit`: the polygons that resulted from the edit.
 * - `shapes:remove`: the removed polygons.
 * - `shapes:change`: every polygon on the layer.
 */
export interface ShapesEvent extends LeafletEvent {
  layers: Polygon[];
}

/** Fired whenever the interaction mode changes. */
export interface ModeChangeEvent extends LeafletEvent {
  mode: Mode;
}

/**
 * Events fired by a `DrawLayer`, and by the map it's on. Map listeners can
 * tell layers apart with `event.sourceTarget`.
 *
 * `shapes:create`, `shapes:edit` and `shapes:remove` are fired for user
 * interactions. `shapes:change` follows each of them, and is also fired after
 * changes made through the API (`addPolygon()`, `addData()`, `addLayer()`,
 * `removeLayer()`, `clearLayers()`).
 */
export interface DrawLayerEventMap {
  'shapes:create': ShapesEvent;
  'shapes:edit': ShapesEvent;
  'shapes:remove': ShapesEvent;
  'shapes:change': ShapesEvent;
  'shapes:modechange': ModeChangeEvent;
}

type Listener<K extends keyof DrawLayerEventMap> = (
  event: DrawLayerEventMap[K],
) => void;

// Types listeners for these events on the layer and on the map.
declare module 'leaflet' {
  interface Evented {
    on<K extends keyof DrawLayerEventMap>(
      type: K,
      fn: Listener<K>,
      context?: unknown,
    ): this;
    once<K extends keyof DrawLayerEventMap>(
      type: K,
      fn: Listener<K>,
      context?: unknown,
    ): this;
    off<K extends keyof DrawLayerEventMap>(
      type: K,
      fn?: Listener<K>,
      context?: unknown,
    ): this;
  }
}
