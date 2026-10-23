import * as clippingNamespace from 'polygon-clipping';
import {
  Point,
  type LatLng,
  type LatLngExpression,
  type Map as LeafletMap,
} from 'leaflet';

// `polygon-clipping` ships CommonJS as its main entry. Bundlers expose its
// members on the namespace, while Node's ESM loader only exposes `default`.
const { intersection, union: unionAll } =
  (clippingNamespace as { default?: typeof clippingNamespace }).default ??
  clippingNamespace;

type Vec = [number, number];

/** A ring of [x, y] layer points, not closed (first point isn't repeated). */
export type Path = Vec[];

/** Projects lat/lngs into layer pixel space, where all geometry work happens. */
export function toPath(
  map: LeafletMap,
  latLngs: readonly LatLngExpression[],
): Path {
  return latLngs.map((latLng) => {
    const { x, y } = map.latLngToLayerPoint(latLng);
    return [x, y];
  });
}

export function toLatLngs(map: LeafletMap, path: Path): LatLng[] {
  return path.map(([x, y]) => map.layerPointToLatLng(new Point(x, y)));
}

function distanceSq([ax, ay]: Vec, [bx, by]: Vec): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

/** Squared distance from `p` to the segment `a`–`b`. */
function segmentDistanceSq(p: Vec, a: Vec, b: Vec): number {
  const length = distanceSq(a, b);
  if (length === 0) return distanceSq(p, a);
  const t =
    ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length;
  const clamped = Math.max(0, Math.min(1, t));
  return distanceSq(p, [
    a[0] + clamped * (b[0] - a[0]),
    a[1] + clamped * (b[1] - a[1]),
  ]);
}

/**
 * Drops vertices within `distance` of a neighbour or of the line through their
 * neighbours (near-duplicates and near-collinear points).
 *
 * @returns The cleaned ring, or `[]` if fewer than three vertices remain.
 */
export function clean(path: Path, distance: number): Path {
  const limit = distance * distance;
  const points = [...path];

  let changed = true;
  while (changed && points.length >= 3) {
    changed = false;
    for (let i = 0; i < points.length && points.length >= 3;) {
      const n = points.length;
      const previous = points[(i + n - 1) % n]!;
      const current = points[i]!;
      const next = points[(i + 1) % n]!;
      if (
        distanceSq(current, previous) <= limit ||
        segmentDistanceSq(current, previous, next) < limit
      ) {
        points.splice(i, 1);
        changed = true;
      } else {
        i++;
      }
    }
  }

  return points.length >= 3 ? points : [];
}

/** Outer rings of a clipping result, without the closing point. */
function outerRings(result: Vec[][][]): Path[] {
  return result.flatMap(([outer]) => (outer ? [outer.slice(0, -1)] : []));
}

/**
 * Cleans a ring and splits it into simple polygons wherever it crosses itself
 * (non-zero rule, so a figure-eight becomes two polygons).
 */
export function simplify(path: Path, distance: number): Path[] {
  const cleaned = clean(path, distance);
  return cleaned.length ? outerRings(unionAll([cleaned])) : [];
}

/** Unions any overlapping paths; disjoint paths are returned separately. */
export function union(paths: Path[]): Path[] {
  const [first, ...rest] = paths;
  if (!first) return [];
  return outerRings(unionAll([first], ...rest.map((path) => [path])));
}

/** Whether two polygons overlap by a non-zero area. */
export function intersects(subject: Path, clip: Path): boolean {
  return intersection([subject], [clip]).length > 0;
}
