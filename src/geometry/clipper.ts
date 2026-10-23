import * as clipperNamespace from 'clipper-lib';
import { Point, type LatLng, type LatLngExpression, type Map } from 'leaflet';

// `clipper-lib` is CommonJS (`module.exports = ClipperLib`). Bundlers expose its
// members on the namespace, while Node's ESM loader only exposes `default`.
const ClipperLib: typeof clipperNamespace =
  (clipperNamespace as { default?: typeof clipperNamespace }).default ??
  clipperNamespace;

const { Clipper, ClipType, PolyFillType, PolyType } = ClipperLib;

export type Path = clipperNamespace.Path;

/** Projects lat/lngs into layer pixel space, where all geometry work happens. */
export function toPath(map: Map, latLngs: readonly LatLngExpression[]): Path {
  return latLngs.map((latLng) => {
    const { x, y } = map.latLngToLayerPoint(latLng);
    return { X: x, Y: y };
  });
}

export function toLatLngs(map: Map, path: Path): LatLng[] {
  return path.map(({ X, Y }) => map.layerPointToLatLng(new Point(X, Y)));
}

/**
 * Removes near-duplicate vertices and splits self-intersecting shapes into
 * simple polygons (e.g. a figure-eight becomes two polygons).
 */
export function simplify(path: Path, distance: number): Path[] {
  return Clipper.SimplifyPolygon(
    Clipper.CleanPolygon(path, distance),
    PolyFillType.pftNonZero,
  );
}

/** Unions any overlapping paths; disjoint paths are returned as-is. */
export function union(paths: Path[]): Path[] {
  return Clipper.SimplifyPolygons(paths, PolyFillType.pftNonZero);
}

/** Whether two polygons overlap by a non-zero area. */
export function intersects(subject: Path, clip: Path): boolean {
  const clipper = new Clipper();
  clipper.AddPath(subject, PolyType.ptSubject, true);
  clipper.AddPath(clip, PolyType.ptClip, true);

  const solution: Path[] = [];
  clipper.Execute(
    ClipType.ctIntersection,
    solution,
    PolyFillType.pftNonZero,
    PolyFillType.pftNonZero,
  );
  return solution.some((path) => Clipper.Area(path) !== 0);
}
