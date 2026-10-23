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
import type { MarkersEventType } from './events';

/** Per-map state shared by the drawing, editing and merging helpers. */
export interface DrawContext {
  readonly map: Map;
  readonly layer: DrawLayer;
  /** Vertex markers live here so they never leak into `layer.toGeoJSON()`. */
  readonly vertexLayer: LayerGroup;
  readonly vertices: WeakMap<Polygon, CircleMarker[]>;
  /** Set while a vertex is being dragged, so no freehand stroke starts. */
  draggingVertex: boolean;
  /** Pending `markers` event while `notifyAfterEditExit` is enabled. */
  deferredNotify: (() => void) | null;
}

export function polygonsOf(context: DrawContext): Polygon[] {
  return context.layer
    .getLayers()
    .filter((layer): layer is Polygon => layer instanceof Polygon);
}

export function outerRing(polygon: Polygon): LatLng[] {
  return (polygon.getLatLngs()[0] ?? []) as LatLng[];
}

/** Fires `markers` with every polygon as a closed ring. */
export function notify(
  context: DrawContext,
  eventType: MarkersEventType,
): void {
  const latLngs = polygonsOf(context).map((polygon) => {
    const ring = outerRing(polygon);
    return ring.length ? [...ring, ring[0]!] : ring;
  });
  context.layer.fire('markers', { latLngs, eventType });
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
