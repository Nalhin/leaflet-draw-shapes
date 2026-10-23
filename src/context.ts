import {
  DomEvent,
  Polygon,
  type CircleMarker,
  type LatLng,
  type LayerGroup,
  type LeafletEvent,
  type Map,
} from 'leaflet';
import type { DrawLayer } from './draw-layer';
import type { DrawLayerEventMap } from './events';
import type { ResolvedStyle } from './style';

/** Events fired for user interactions, each followed by `shapes:change`. */
export type ActionEventType = keyof Pick<
  DrawLayerEventMap,
  'shapes:create' | 'shapes:edit' | 'shapes:remove'
>;

/** Per-layer state shared by the drawing, editing and merging helpers. */
export interface DrawContext {
  readonly layer: DrawLayer;
  /** The map the layer is on, or `null` while it isn't on one. */
  map: Map | null;
  /** Vertex markers live here so they never leak into `layer.toGeoJSON()`. */
  readonly vertexLayer: LayerGroup;
  readonly vertices: WeakMap<Polygon, CircleMarker[]>;
  style: ResolvedStyle;
  /** Set while a vertex is being dragged, so no freehand stroke starts. */
  draggingVertex: boolean;
  /**
   * Runs `change` as one batch. If it changed anything, fires `type` with the
   * polygons it returns, then `shapes:change`. With `defer`, holds the events
   * back until the mode changes.
   */
  commit(type: ActionEventType, change: () => Polygon[], defer?: boolean): void;
}

/** The polygons on the layer, in the order they were added. */
export function polygonsOf(layer: DrawLayer): Polygon[] {
  return layer
    .getLayers()
    .filter((child): child is Polygon => child instanceof Polygon);
}

export function outerRing(polygon: Polygon): LatLng[] {
  return (polygon.getLatLngs()[0] ?? []) as LatLng[];
}

/**
 * Stops a layer's pointer event from reaching map-level handlers
 * (e.g. double-click zoom). Leaflet layer events are not DOM events, so this
 * marks the underlying `originalEvent` as stopped.
 */
export function stopMapPropagation(event: LeafletEvent): void {
  DomEvent.stopPropagation(event);
}

export const propagationEvents = 'mousedown touchstart dblclick contextmenu';
