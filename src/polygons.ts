import {
  LineUtil,
  Polygon,
  type LatLng,
  type LatLngLiteral,
  type LeafletMouseEvent,
  type Map,
} from 'leaflet';
import { classNames, withClass } from './class-names';
import {
  outerRing,
  polygonsOf,
  propagationEvents,
  stopMapPropagation,
  type DrawContext,
} from './context';
import {
  boundsOf,
  boxesMeet,
  intersects,
  simplify,
  toLatLngs,
  toPath,
  union,
} from './geometry/clip';
import { concaveHull } from './geometry/concave-hull';
import { hasMode, Mode } from './modes';
import type { ResolvedOptions } from './options';
import { createVertices, removeVertices } from './vertices';

/** A polygon styled like the layer's own, ready to be added to it. */
export function newPolygon(
  context: DrawContext,
  latLngs: readonly LatLngLiteral[],
): Polygon {
  return new Polygon([...latLngs], context.style.polygon);
}

/**
 * Makes a polygon that was added to the layer editable: gives it the polygon
 * class, vertex handles and click handling. Runs for every polygon, however it
 * was added.
 */
export function attachPolygon(context: DrawContext, polygon: Polygon): void {
  const element = polygon.getElement();
  if (element) {
    element.classList.add(classNames.polygon);
  } else if (
    !polygon.options.className?.split(' ').includes(classNames.polygon)
  ) {
    polygon.options.className = withClass(
      classNames.polygon,
      polygon.options.className,
    );
  }

  polygon.on(propagationEvents, stopMapPropagation);
  polygon.on('click', onPolygonClick, context);
  context.vertices.set(polygon, createVertices(context, polygon));
}

/** Undoes {@link attachPolygon} for a polygon leaving the layer. */
export function detachPolygon(context: DrawContext, polygon: Polygon): void {
  polygon.off(propagationEvents, stopMapPropagation);
  polygon.off('click', onPolygonClick, context);
  removeVertices(context, polygon);
}

/**
 * Adds polygons built from `latLngs` to the layer. Self-intersecting shapes are
 * split into multiple polygons. Unless `preventMutations` is set, the concave
 * hull is applied and overlapping polygons are merged.
 *
 * @returns The polygons on the layer that contain the new shape.
 */
export function createPolygons(
  context: DrawContext,
  map: Map,
  latLngs: readonly LatLngLiteral[],
  options: ResolvedOptions,
  preventMutations = false,
): Polygon[] {
  const { layer } = context;
  const shape =
    !preventMutations && options.concaveHull ? concaveHull(latLngs) : latLngs;

  // A shape that merges into an existing one doesn't add to the count, so when
  // merging, the limit is applied after the merge instead.
  const merging = !preventMutations && options.mergePolygons;
  const added: Polygon[] = [];
  let count = polygonsOf(layer).length;
  for (const path of simplify(toPath(map, shape), options.simplifyFactor)) {
    if (!merging && count >= options.maxPolygons) break;

    const polygon = newPolygon(context, toLatLngs(map, path));
    layer.addLayer(polygon);
    added.push(polygon);
    count++;
  }

  if (merging && added.length) {
    const merged = mergePolygons(context, map, options);
    const kept = added.filter((polygon) => layer.hasLayer(polygon));
    // Drop the new polygons that didn't merge, last first, until under the limit.
    let excess = polygonsOf(layer).length - options.maxPolygons;
    while (excess-- > 0 && kept.length) layer.removeLayer(kept.pop()!);
    return [...kept, ...merged];
  }

  return added;
}

/**
 * Replaces every polygon that overlaps another with their union.
 *
 * @returns The polygons created by the merge.
 */
export function mergePolygons(
  context: DrawContext,
  map: Map,
  options: ResolvedOptions,
): Polygon[] {
  const { layer } = context;
  const polygons = polygonsOf(layer);
  const paths = polygons.map((polygon) => toPath(map, outerRing(polygon)));
  const boxes = paths.map(boundsOf);

  // Clipping is costly, so only pairs whose bounds meet are tested, each once.
  const isOverlapping = paths.map(() => false);
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (isOverlapping[i] && isOverlapping[j]) continue;
      if (boxesMeet(boxes[i]!, boxes[j]!) && intersects(paths[i]!, paths[j]!)) {
        isOverlapping[i] = isOverlapping[j] = true;
      }
    }
  }
  const overlapping = paths.flatMap((_, index) =>
    isOverlapping[index] ? [index] : [],
  );
  if (!overlapping.length) return [];

  const merged = union(overlapping.map((index) => paths[index]!));
  overlapping.forEach((index) => layer.removeLayer(polygons[index]!));

  // A union never has more polygons than its inputs, so it can't break the
  // limit, but the layer may be over it while new shapes wait to be trimmed.
  const unlimited = Object.assign(Object.create(options) as ResolvedOptions, {
    maxPolygons: Infinity,
  });
  return merged.flatMap((path) =>
    // Prevent mutations, otherwise creating would trigger another merge.
    createPolygons(context, map, toLatLngs(map, path), unlimited, true),
  );
}

/**
 * In `DELETE` mode a click removes the polygon; in `APPEND` mode it inserts a
 * vertex on the nearest edge. With both, clicks within `appendTolerance`
 * pixels of an edge append and clicks further inside delete.
 */
function onPolygonClick(this: DrawContext, event: LeafletMouseEvent): void {
  const { map, layer } = this;
  if (!map) return;

  const polygon = event.target as Polygon;
  const mode = layer.getMode();
  const canDelete = hasMode(mode, Mode.DELETE);
  const canAppend = hasMode(mode, Mode.APPEND);
  if (!canDelete && !canAppend) return;

  const clickPoint = event.containerPoint;
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
    canAppend &&
    (!canDelete || nearest.distance <= layer.options.appendTolerance);

  if (shouldAppend && nearest.index >= 0) {
    const latLng = map.containerPointToLatLng(clickPoint);
    this.commit('shapes:edit', () => {
      appendVertex(this, polygon, nearest.index, latLng, ring);
      return [polygon];
    });
  } else if (canDelete) {
    this.commit('shapes:remove', () => {
      layer.removeLayer(polygon);
      return [polygon];
    });
  }
}

function appendVertex(
  context: DrawContext,
  polygon: Polygon,
  afterIndex: number,
  latLng: LatLng,
  ring: LatLng[],
): void {
  polygon.setLatLngs(ring.toSpliced(afterIndex + 1, 0, latLng));
  removeVertices(context, polygon);
  context.vertices.set(polygon, createVertices(context, polygon));
}
