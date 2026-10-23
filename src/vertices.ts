import { DivIcon, Marker, type LeafletMouseEvent, type Polygon } from 'leaflet';
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

export const vertexClassName = 'leaflet-edge';
export const disabledClassName = 'disabled';

/** Toggles the `disabled` class on every vertex to match `mode`. */
export function syncVertexState(context: DrawContext, mode: Mode): void {
  context.vertexLayer.eachLayer((layer) => {
    (layer as Marker)
      .getElement()
      ?.classList.toggle(disabledClassName, !hasMode(mode, EDIT));
  });
}

export function removeVertices(context: DrawContext, polygon: Polygon): void {
  context.vertices
    .get(polygon)
    ?.forEach((marker) => context.vertexLayer.removeLayer(marker));
  context.vertices.delete(polygon);
}

/** Creates a draggable marker for each vertex of `polygon` (active in `EDIT` mode). */
export function createVertices(
  context: DrawContext,
  polygon: Polygon,
  options: DrawLayerOptions,
): Marker[] {
  const { map, layer } = context;

  const markers = outerRing(polygon).map((latLng) => {
    const enabled = hasMode(layer.mode(), EDIT);
    const icon = new DivIcon({
      className: enabled
        ? vertexClassName
        : `${vertexClassName} ${disabledClassName}`,
    });
    const marker = new Marker(latLng, { icon });
    context.vertexLayer.addLayer(marker);

    marker.on(propagationEvents, stopMapPropagation);
    marker.on('mousedown', () => startDrag(marker));
    return marker;
  });

  function startDrag(marker: Marker): void {
    if (!hasMode(layer.mode(), EDIT)) return;

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
