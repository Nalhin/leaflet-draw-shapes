import {
  CircleMarker,
  type CircleMarkerOptions,
  type LeafletMouseEvent,
  type Polygon,
} from 'leaflet';
import {
  notify,
  outerRing,
  propagationEvents,
  stopMapPropagation,
  type DrawContext,
} from './context';
import { CREATE, EDIT, hasMode, type Mode } from './modes';
import type { DrawLayerOptions } from './options';
import { createPolygons, mergePolygons, removePolygon } from './polygons';
import type { ResolvedStyle } from './style';

export const vertexClassName = 'leaflet-edge';

/** Vertices are only on the map, and so only interactive, in `EDIT` mode. */
export function syncVertexVisibility(context: DrawContext, mode: Mode): void {
  const { map, vertexLayer } = context;
  if (hasMode(mode, EDIT)) vertexLayer.addTo(map);
  else vertexLayer.remove();
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

/** Creates a draggable handle for each vertex of `polygon`. */
export function createVertices(
  context: DrawContext,
  polygon: Polygon,
  options: DrawLayerOptions,
): CircleMarker[] {
  const { map, layer } = context;
  const style = layer.resolvedStyle();
  const reveal = (marker: CircleMarker, visible: boolean): void => {
    marker.setStyle(vertexAppearance(layer.resolvedStyle(), visible));
  };

  const markers = outerRing(polygon).map((latLng) => {
    const marker = new CircleMarker(latLng, {
      ...vertexAppearance(style, false),
      className: [vertexClassName, style.vertex.className]
        .filter(Boolean)
        .join(' '),
      bubblingMouseEvents: false,
    });
    context.vertexLayer.addLayer(marker);

    marker.on(propagationEvents, stopMapPropagation);
    marker.on('mouseover', () => reveal(marker, true));
    marker.on('mouseout', () => {
      if (!context.draggingVertex) reveal(marker, false);
    });
    marker.on('mousedown', () => startDrag(marker));
    return marker;
  });

  function startDrag(marker: CircleMarker): void {
    if (!hasMode(layer.mode(), EDIT)) return;

    // Tell the freehand handler, which sees the same mousedown next, to ignore it.
    context.draggingVertex = true;
    // Map panning would fight with the vertex drag.
    map.dragging.disable();

    const onMove = (event: LeafletMouseEvent): void => {
      marker.setLatLng(event.latlng);
      polygon.setLatLngs(markers.map((vertex) => vertex.getLatLng()));
    };

    const onEnd = (): void => {
      // The mouse up can land on the map or the marker, depending on how fast
      // the vertex was moved, so listen on both and clean up both.
      map.off('mousemove', onMove);
      map.off('mouseup', onEnd);
      marker.off('mouseup', onEnd);
      context.draggingVertex = false;

      if (!hasMode(layer.mode(), CREATE) && map.options.dragging !== false) {
        map.dragging.enable();
      }

      // Re-create the polygon so self-intersections introduced by the drag get
      // split into simple polygons.
      const latLngs = outerRing(polygon);
      removePolygon(context, polygon);
      createPolygons(context, latLngs, options, true);

      // Two passes give better results when one merge creates a new overlap.
      if (options.mergePolygons) {
        mergePolygons(context, options);
        mergePolygons(context, options);
      }

      if (options.notifyAfterEditExit) {
        context.deferredNotify = () => notify(context, 'edit');
      } else {
        notify(context, 'edit');
      }
    };

    map.on('mousemove', onMove);
    map.on('mouseup', onEnd);
    marker.on('mouseup', onEnd);
  }

  return markers;
}
