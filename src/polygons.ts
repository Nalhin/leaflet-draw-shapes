import {
  LineUtil,
  Polygon,
  type LatLng,
  type LatLngLiteral,
  type LeafletMouseEvent,
  type Point,
} from 'leaflet';
import {
  notify,
  outerRing,
  polygonsOf,
  propagationEvents,
  stopMapPropagation,
  type DrawContext,
} from './context';
import {
  intersects,
  simplify,
  toLatLngs,
  toPath,
  union,
} from './geometry/clip';
import { concaveHull } from './geometry/concave-hull';
import { APPEND, DELETE, hasMode } from './modes';
import type { DrawLayerOptions } from './options';
import { createVertices, removeVertices } from './vertices';

/**
 * Adds polygons built from `latLngs` to the layer. Self-intersecting shapes are
 * split into multiple polygons. Unless `preventMutations` is set, the concave
 * hull is applied and overlapping polygons are merged.
 *
 * @returns The polygons on the layer that contain the new shape.
 */
export function createPolygons(
  context: DrawContext,
  latLngs: readonly LatLngLiteral[],
  options: DrawLayerOptions,
  preventMutations = false,
): Polygon[] {
  const { map, layer } = context;
  const shape =
    !preventMutations && options.concavePolygon
      ? concaveHull(latLngs)
      : latLngs;

  const added: Polygon[] = [];
  for (const path of simplify(toPath(map, shape), options.simplifyFactor)) {
    if (polygonsOf(context).length >= options.maximumPolygons) break;

    const style = layer.resolvedStyle().polygon;
    const polygon = new Polygon(toLatLngs(map, path), {
      ...style,
      className: ['leaflet-polygon', style.className].filter(Boolean).join(' '),
    });
    layer.addLayer(polygon);
    context.vertices.set(polygon, createVertices(context, polygon, options));

    polygon.on(propagationEvents, stopMapPropagation);
    polygon.on('click', (event: LeafletMouseEvent) => {
      handlePolygonClick(context, polygon, options, event.containerPoint);
    });

    added.push(polygon);
  }

  if (!preventMutations && options.mergePolygons && added.length) {
    const merged = mergePolygons(context, options);
    return [...added.filter((polygon) => layer.hasLayer(polygon)), ...merged];
  }

  return added;
}

export function removePolygon(context: DrawContext, polygon: Polygon): void {
  context.layer.removeLayer(polygon);
  removeVertices(context, polygon);
}

export function clearPolygons(context: DrawContext): void {
  polygonsOf(context).forEach((polygon) => removePolygon(context, polygon));
}

/**
 * Replaces every polygon that overlaps another with their union.
 *
 * @returns The polygons created by the merge.
 */
export function mergePolygons(
  context: DrawContext,
  options: DrawLayerOptions,
): Polygon[] {
  const { map } = context;
  const polygons = polygonsOf(context);
  const paths = polygons.map((polygon) => toPath(map, outerRing(polygon)));

  const overlapping = paths.flatMap((path, index) =>
    paths.some((other, j) => j !== index && intersects(path, other))
      ? [index]
      : [],
  );
  if (!overlapping.length) return [];

  const merged = union(overlapping.map((index) => paths[index]!));
  overlapping.forEach((index) => removePolygon(context, polygons[index]!));

  return merged.flatMap((path) =>
    // Prevent mutations, otherwise creating would trigger another merge.
    createPolygons(context, toLatLngs(map, path), options, true),
  );
}

/**
 * In `DELETE` mode a click removes the polygon; in `APPEND` mode it inserts a
 * vertex on the nearest edge. With both, clicks within `elbowDistance` pixels
 * of an edge append and clicks further inside delete.
 */
function handlePolygonClick(
  context: DrawContext,
  polygon: Polygon,
  options: DrawLayerOptions,
  clickPoint: Point,
): void {
  const { map, layer } = context;
  const mode = layer.mode();
  const canDelete = hasMode(mode, DELETE);
  const canAppend = hasMode(mode, APPEND);
  if (!canDelete && !canAppend) return;

  const ring = outerRing(polygon);
  const points = ring.map((latLng) => map.latLngToContainerPoint(latLng));
  const nearest = points.reduce(
    (best, start, index) => {
      const end = points[(index + 1) % points.length]!;
      const distance = LineUtil.pointToSegmentDistance(clickPoint, start, end);
      return distance < best.distance ? { distance, index } : best;
    },
    { distance: Infinity, index: -1 },
  );

  const shouldAppend =
    canAppend && (!canDelete || nearest.distance <= options.elbowDistance);

  if (shouldAppend && nearest.index >= 0) {
    appendVertex(context, polygon, options, nearest.index, {
      latLng: map.containerPointToLatLng(clickPoint),
      ring,
    });
    notify(context, 'append');
  } else if (canDelete) {
    removePolygon(context, polygon);
    notify(context, 'remove');
  }
}

function appendVertex(
  context: DrawContext,
  polygon: Polygon,
  options: DrawLayerOptions,
  afterIndex: number,
  { latLng, ring }: { latLng: LatLng; ring: LatLng[] },
): void {
  polygon.setLatLngs(ring.toSpliced(afterIndex + 1, 0, latLng));
  removeVertices(context, polygon);
  context.vertices.set(polygon, createVertices(context, polygon, options));
}
