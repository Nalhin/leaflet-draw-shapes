import {
  CircleMarker,
  type CircleMarkerOptions,
  type Map,
  type Point,
  type Polygon,
} from 'leaflet';
import { classNames, withClass } from './class-names';
import {
  outerRing,
  polygonsOf,
  propagationEvents,
  stopMapPropagation,
  type DrawContext,
} from './context';
import { hasMode, Mode } from './modes';
import { createPolygons, mergePolygons } from './polygons';
import type { ResolvedStyle } from './style';

/**
 * The pane vertex handles are drawn in. It sits above `overlayPane`, so
 * polygons added after their handles can't cover them.
 */
export const vertexPane = 'drawShapesVertexPane';

/** Pixels a press has to travel before it moves the vertex, like Leaflet's `clickTolerance`. */
const dragThreshold = 3;

/** Pixels from a vertex within which it can be grabbed, however small it's drawn. */
const minGrabRadius = { mouse: 8, touch: 20 };

/** Vertices are only on the map, and so only interactive, in `EDIT` mode. */
export function syncVertexVisibility(
  context: DrawContext,
  map: Map,
  mode: Mode,
): void {
  if (hasMode(mode, Mode.EDIT)) context.vertexLayer.addTo(map);
  else context.vertexLayer.remove();
}

/**
 * Path options for a vertex handle. Hidden handles are fully transparent but
 * keep their shape, so they can still be hovered and grabbed.
 */
export function vertexAppearance(
  style: ResolvedStyle,
  visible: boolean,
): CircleMarkerOptions {
  return visible || style.showVertices === 'always'
    ? style.vertex
    : { ...style.vertex, opacity: 0, fillOpacity: 0 };
}

export function removeVertices(context: DrawContext, polygon: Polygon): void {
  context.vertices
    .get(polygon)
    ?.forEach((marker) => context.vertexLayer.removeLayer(marker));
  context.vertices.delete(polygon);
}

/** Creates a handle for each vertex of `polygon`. */
export function createVertices(
  context: DrawContext,
  polygon: Polygon,
): CircleMarker[] {
  return outerRing(polygon).map((latLng) => {
    const marker = new CircleMarker(latLng, {
      pane: vertexPane,
      ...vertexAppearance(context.style, false),
      className: withClass(classNames.vertex, context.style.vertex.className),
      bubblingMouseEvents: false,
    });
    context.vertexLayer.addLayer(marker);
    marker.on(propagationEvents, stopMapPropagation);
    return marker;
  });
}

export interface VertexDraggingHandle {
  /** Ends the drag in progress, keeping the edit, and stops listening. */
  dispose(): void;
}

interface VertexHit {
  polygon: Polygon;
  marker: CircleMarker;
  markers: CircleMarker[];
}

/**
 * Lets vertices be hovered and dragged with mouse, pen or touch in `EDIT` mode.
 *
 * Presses are hit-tested against the vertex positions on the map container
 * instead of relying on the handles' own events, so a handle can be grabbed
 * whatever is drawn over it, from a few pixels away, and with a finger.
 */
export function enableVertexDragging(
  context: DrawContext,
  map: Map,
): VertexDraggingHandle {
  const { layer } = context;
  const container = map.getContainer();
  if (!map.getPane(vertexPane)) {
    // Between `overlayPane` (400) and `shadowPane` (500).
    map.createPane(vertexPane).style.zIndex = '450';
  }

  let hovered: CircleMarker | null = null;
  let endDrag: (() => void) | null = null;
  let releaseClicks: (() => void) | null = null;

  const editing = () => hasMode(layer.getMode(), Mode.EDIT);

  const reveal = (marker: CircleMarker | null): void => {
    if (marker === hovered) return;
    hovered?.setStyle(vertexAppearance(context.style, false));
    marker?.setStyle(vertexAppearance(context.style, true));
    hovered = marker;
  };

  const hitTest = (event: PointerEvent): VertexHit | null =>
    editing() && onMapSurface(map, event.target)
      ? vertexAt(context, map, map.mouseEventToContainerPoint(event), event)
      : null;

  const onHover = (event: PointerEvent): void => {
    if (endDrag || event.pointerType === 'touch') return;
    reveal(hitTest(event)?.marker ?? null);
  };

  const onLeave = (): void => {
    if (!endDrag) reveal(null);
  };

  const onPress = (event: PointerEvent): void => {
    if (endDrag || !event.isPrimary || event.button !== 0) return;
    const hit = hitTest(event);
    if (!hit) return;

    // Suppresses the compatibility mouse events, so neither Leaflet nor the
    // freehand handler sees a mouse press. Touch events still fire, so the
    // freehand handler also checks `draggingVertex`.
    event.preventDefault();
    context.draggingVertex = true;
    // Map panning would fight with the vertex drag.
    map.dragging.disable();
    reveal(hit.marker);
    endDrag = startDrag(event, hit);
  };

  function startDrag(
    event: PointerEvent,
    { polygon, marker, markers }: VertexHit,
  ): () => void {
    const { pointerId } = event;
    const pressed = map.mouseEventToContainerPoint(event);
    // Grabbing a vertex off-centre shouldn't make it jump under the pointer.
    const offset = map
      .latLngToContainerPoint(marker.getLatLng())
      .subtract(pressed);
    let moved = false;

    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return;
      const point = map.mouseEventToContainerPoint(moveEvent);
      if (!moved && point.distanceTo(pressed) < dragThreshold) return;
      moved = true;
      marker.setLatLng(map.containerPointToLatLng(point.add(offset)));
      polygon.setLatLngs(markers.map((vertex) => vertex.getLatLng()));
    };

    // Without this, touch drags in `CREATE | EDIT` mode, where Leaflet allows
    // native panning, get cancelled by the browser.
    const preventScroll = (touchEvent: TouchEvent): void => {
      touchEvent.preventDefault();
    };

    const finish = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      container.removeEventListener('touchmove', preventScroll);
      endDrag = null;
      context.draggingVertex = false;

      if (
        !hasMode(layer.getMode(), Mode.CREATE) &&
        map.options.dragging !== false
      ) {
        map.dragging.enable();
      }
      if (moved) commitEdit(context, map, polygon);
    };

    const end = (endEvent: PointerEvent): void => {
      if (endEvent.pointerId !== pointerId) return;
      finish();
      // The click ending the gesture would otherwise delete the polygon or
      // append a vertex to it in `DELETE` or `APPEND` mode.
      swallowClicks();
      // The polygon may have been re-created, so find the handle under the
      // pointer again.
      onHover(endEvent);
    };

    try {
      // Keeps the events coming when the pointer leaves the map.
      container.setPointerCapture(pointerId);
    } catch {
      // The pointer is gone already, or the event was synthetic.
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    container.addEventListener('touchmove', preventScroll, { passive: false });
    return finish;
  }

  /** Swallows the clicks of the gesture that just ended, until the next press. */
  function swallowClicks(): void {
    releaseClicks?.();
    const swallow = (event: Event): void => {
      event.stopPropagation();
      event.preventDefault();
    };
    const release = (): void => {
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('dblclick', swallow, true);
      window.removeEventListener('pointerdown', release, true);
      clearTimeout(timeout);
      releaseClicks = null;
    };
    window.addEventListener('click', swallow, true);
    window.addEventListener('dblclick', swallow, true);
    window.addEventListener('pointerdown', release, true);
    // A touch drag ends without a click, so don't wait forever for one.
    const timeout = setTimeout(release, 500);
    releaseClicks = release;
  }

  // Capture, so the press is seen before Leaflet's own handlers on the container.
  container.addEventListener('pointerdown', onPress, true);
  container.addEventListener('pointermove', onHover);
  container.addEventListener('pointerleave', onLeave);

  return {
    dispose: () => {
      endDrag?.();
      releaseClicks?.();
      reveal(null);
      container.removeEventListener('pointerdown', onPress, true);
      container.removeEventListener('pointermove', onHover);
      container.removeEventListener('pointerleave', onLeave);
    },
  };
}

/** The handle nearest to `point`, if one is close enough to grab. */
function vertexAt(
  context: DrawContext,
  map: Map,
  point: Point,
  { pointerType }: PointerEvent,
): VertexHit | null {
  const { radius = 0, weight = 0 } = context.style.vertex;
  let nearest = Math.max(
    radius + weight / 2,
    pointerType === 'touch' ? minGrabRadius.touch : minGrabRadius.mouse,
  );
  let hit: VertexHit | null = null;

  for (const polygon of polygonsOf(context.layer)) {
    const markers = context.vertices.get(polygon) ?? [];
    for (const marker of markers) {
      const distance = map
        .latLngToContainerPoint(marker.getLatLng())
        .distanceTo(point);
      // `<=` so that on a tie the polygon drawn on top wins.
      if (distance <= nearest) {
        nearest = distance;
        hit = { polygon, marker, markers };
      }
    }
  }
  return hit;
}

/** Whether `target` is the map or a shape on it, not a control, marker or popup. */
function onMapSurface(map: Map, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  if (target === map.getContainer()) return true;
  return (
    !!map.getPane('mapPane')?.contains(target) &&
    !['markerPane', 'tooltipPane', 'popupPane'].some((pane) =>
      map.getPane(pane)?.contains(target),
    )
  );
}

function commitEdit(context: DrawContext, map: Map, polygon: Polygon): void {
  const { layer } = context;
  const { options } = layer;
  context.commit(
    'shapes:edit',
    () => {
      // Re-create the polygon so self-intersections introduced by the drag
      // get split into simple polygons.
      const latLngs = outerRing(polygon);
      layer.removeLayer(polygon);
      const result = createPolygons(context, map, latLngs, options, true);

      // Two passes give better results when one merge creates a new overlap.
      if (options.mergePolygons) {
        result.push(...mergePolygons(context, map, options));
        result.push(...mergePolygons(context, map, options));
      }
      return result.filter((shape) => layer.hasLayer(shape));
    },
    options.notifyAfterEditExit,
  );
}
