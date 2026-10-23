/**
 * Concave hull ("gift wrapping" with a maximum edge length) over lat/lngs.
 *
 * TypeScript port of https://github.com/Wildhoney/ConcaveHull
 * (MIT, Adam Timberlake & Nikolay Redko), the algorithm used by Leaflet.FreeDraw.
 */
import type { LatLngLiteral } from 'leaflet';

interface HullPoint<T extends LatLngLiteral> {
  readonly x: number;
  readonly y: number;
  readonly latLng: T;
}

const EARTH_RADIUS = 6378137;
const MAX_ITERATIONS = 1000;
const EPSILON = 1e-13;
const DEG = Math.PI / 180;

/** Great-circle distance in metres. */
function distance(a: LatLngLiteral, b: LatLngLiteral): number {
  const sinLat = Math.sin(((b.lat - a.lat) * DEG) / 2);
  const sinLng = Math.sin(((b.lng - a.lng) * DEG) / 2);
  const h =
    sinLat * sinLat +
    sinLng * sinLng * Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG);
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Mercator y for a latitude. */
function latToY(lat: number): number {
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
}

function samePosition(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return a.x === b.x && a.y === b.y;
}

function ccw(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  const dx1 = p1.x - p0.x;
  const dy1 = p1.y - p0.y;
  const dx2 = p2.x - p0.x;
  const dy2 = p2.y - p0.y;
  const d = dx1 * dy2 - dy1 * dx2;

  if (d > EPSILON) return 1;
  if (d < -EPSILON) return -1;
  if (dx1 * dx2 < -EPSILON || dy1 * dy2 < -EPSILON) return -1;
  if (dx1 * dx1 + dy1 * dy1 < dx2 * dx2 + dy2 * dy2 + EPSILON) return 1;
  return 0;
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  q1: { x: number; y: number },
  q2: { x: number; y: number },
): boolean {
  if (
    samePosition(p1, q1) ||
    samePosition(p2, q2) ||
    samePosition(p1, q2) ||
    samePosition(p2, q1)
  ) {
    return false;
  }
  return (
    ccw(p1, p2, q1) * ccw(p1, p2, q2) <= 0 &&
    ccw(q1, q2, p1) * ccw(q1, q2, p2) <= 0
  );
}

/** Whether the segment from the hull's last point to `next` crosses the hull. */
function crossesHull<T extends LatLngLiteral>(
  hull: HullPoint<T>[],
  next: HullPoint<T>,
): boolean {
  const last = hull.at(-1);
  if (!last) return false;
  for (let i = 1; i < hull.length - 1; i++) {
    if (segmentsIntersect(hull[i - 1]!, hull[i]!, last, next)) return true;
  }
  return false;
}

/** Turning angle (degrees) when moving previous → current → next. */
function turnAngle(
  current: { x: number; y: number },
  previous: { x: number; y: number },
  next: { x: number; y: number },
): number {
  if (samePosition(next, current)) return -9000;
  if (samePosition(next, previous)) return -360;

  const a = { x: current.x - previous.x, y: current.y - previous.y };
  const b = { x: next.x - current.x, y: next.y - current.y };
  const cross = a.x * b.y - b.x * a.y;
  const dot = a.x * b.x + a.y * b.y;

  let angle = 0;
  if (dot === 0) {
    if (cross > 0) angle = 90;
    if (cross < 0) angle = -90;
  } else {
    angle = (Math.atan(cross / dot) * 180) / Math.PI;
    if (dot < 0) angle += cross >= 0 ? 180 : -180;
  }
  if (angle === 360) angle = 0;

  return 180 - angle;
}

/**
 * Returns the concave hull of `latLngs` as a subset of the input objects.
 * Falls back to the input when no valid hull can be traced. The input is
 * never mutated.
 */
export function concaveHull<T extends LatLngLiteral>(
  latLngs: readonly T[],
): T[] {
  if (latLngs.length <= 3) return [...latLngs];

  // Close the ring so the walk can terminate on the start point. The closing
  // vertex must map to the same hull point, as termination relies on identity.
  const ring = [...latLngs, latLngs[0]!];
  const byLatLng = new Map<T, HullPoint<T>>();
  const points: HullPoint<T>[] = ring.map((latLng) => {
    let point = byLatLng.get(latLng);
    if (!point) {
      point = { x: latLng.lng, y: latToY(latLng.lat), latLng };
      byLatLng.set(latLng, point);
    }
    return point;
  });

  let longestEdge = 0;
  for (let i = 1; i < ring.length; i++) {
    longestEdge = Math.max(longestEdge, distance(ring[i - 1]!, ring[i]!));
  }
  const maxDistance = longestEdge + 1;
  const fallback = (): T[] => ring;

  const start = points.reduce((lowest, point) =>
    point.y < lowest.y ? point : lowest,
  );
  const hull: HullPoint<T>[] = [start];
  let current = start;
  let previous = { x: current.x, y: current.y - 1 };

  for (let count = 1; count <= MAX_ITERATIONS; count++) {
    // Only points within reach can continue the hull, so filter before
    // sorting. The sort is stable, so the order matches sorting them all.
    const from = current;
    const byAngle = points
      .filter((point) => distance(from.latLng, point.latLng) < maxDistance)
      .map((point) => ({ point, angle: turnAngle(from, previous, point) }))
      .sort((a, b) => b.angle - a.angle);
    const next = byAngle.find(({ point }) => !crossesHull(hull, point))?.point;

    // No continuation, or the walk got stuck in place.
    if (!next || next === current) return fallback();

    hull.push(next);
    if (next === start) return hull.map((point) => point.latLng);

    previous = current;
    current = next;
  }

  return fallback();
}
