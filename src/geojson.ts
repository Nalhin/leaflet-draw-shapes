import { latLng, type LatLng } from 'leaflet';

/**
 * The outer ring of every polygon in `data`, as lat/lngs. Holes and other
 * geometry types are skipped.
 */
export function outerRingsOf(
  data: GeoJSON.GeoJSON | readonly GeoJSON.GeoJSON[],
): LatLng[][] {
  if (isArray(data)) return data.flatMap(outerRingsOf);

  switch (data.type) {
    case 'FeatureCollection':
      return data.features.flatMap(outerRingsOf);
    case 'Feature': {
      // GeoJSON allows features without a geometry; the typings don't.
      const geometry = data.geometry as GeoJSON.Geometry | null;
      return geometry ? outerRingsOf(geometry) : [];
    }
    case 'GeometryCollection':
      return data.geometries.flatMap(outerRingsOf);
    case 'Polygon':
      return toRings([data.coordinates[0]]);
    case 'MultiPolygon':
      return toRings(data.coordinates.map(([outer]) => outer));
    default:
      return [];
  }
}

// `Array.isArray()` doesn't narrow readonly arrays.
function isArray<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}

function toRings(rings: (GeoJSON.Position[] | undefined)[]): LatLng[][] {
  return rings
    .map((ring = []) => {
      const latLngs = ring.map(([lng, lat]) => latLng(lat!, lng!));
      // GeoJSON repeats the first position at the end; Leaflet doesn't.
      const [first] = latLngs;
      if (latLngs.length > 1 && first?.equals(latLngs.at(-1)!)) latLngs.pop();
      return latLngs;
    })
    .filter((ring) => ring.length >= 3);
}
