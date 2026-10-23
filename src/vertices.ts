import {
  CircleMarker,
  type CircleMarkerOptions,
  type LeafletMouseEvent,
  type Map,
  type Polygon,
} from 'leaflet';
import { classNames, withClass } from './class-names';
import {
  outerRing,
  propagationEvents,
  stopMapPropagation,
  type DrawContext,
} from './context';
import { hasMode, Mode } from './modes';
import { createPolygons, mergePolygons } from './polygons';
import type { ResolvedStyle } from './style';

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

/** Creates a draggable handle for each vertex of `polygon`. */
export function createVertices(
  context: DrawContext,
  polygon: Polygon,
): CircleMarker[] {
  const { layer } = context;
  const reveal = (marker: CircleMarker, visible: boolean): void => {
    marker.setStyle(vertexAppearance(context.style, visible));
  };

  const markers = outerRing(polygon).map((latLng) => {
    const marker = new CircleMarker(latLng, {
      ...vertexAppearance(context.style, false),
      className: withClass(classNames.vertex, context.style.vertex.className),
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
    const { map } = context;
    if (!map || !hasMode(layer.getMode(), Mode.EDIT)) return;

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

      if (
        !hasMode(layer.getMode(), Mode.CREATE) &&
        map.options.dragging !== false
      ) {
        map.dragging.enable();
      }

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
    };

    map.on('mousemove', onMove);
    map.on('mouseup', onEnd);
    marker.on('mouseup', onEnd);
  }

  return markers;
}
