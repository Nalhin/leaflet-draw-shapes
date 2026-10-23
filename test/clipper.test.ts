import { describe, expect, it } from 'vitest';
import {
  intersects,
  simplify,
  toLatLngs,
  toPath,
  union,
  type Path,
} from '../src/geometry/clipper';
import { createMap } from './helpers';

const rect = (x: number, y: number, w: number, h: number): Path => [
  { X: x, Y: y },
  { X: x + w, Y: y },
  { X: x + w, Y: y + h },
  { X: x, Y: y + h },
];

describe('clipper helpers', () => {
  it('round-trips lat/lngs through layer points to the nearest pixel', () => {
    const map = createMap();
    const latLngs = [map.getCenter(), map.getBounds().getNorthEast()];
    const result = toLatLngs(map, toPath(map, latLngs));
    result.forEach((latLng, i) => {
      const distance = map
        .latLngToContainerPoint(latLng)
        .distanceTo(map.latLngToContainerPoint(latLngs[i]!));
      expect(distance).toBeLessThanOrEqual(1);
    });
  });

  it('splits a figure-eight into two polygons', () => {
    const figureEight: Path = [
      { X: 0, Y: 0 },
      { X: 100, Y: 100 },
      { X: 100, Y: 0 },
      { X: 0, Y: 100 },
    ];
    expect(simplify(figureEight, 1.1)).toHaveLength(2);
  });

  it('drops near-duplicate vertices', () => {
    const path: Path = [...rect(0, 0, 100, 100), { X: 0.5, Y: 100 }];
    expect(simplify(path, 1.1)[0]).toHaveLength(4);
  });

  it('detects overlap by area only', () => {
    expect(intersects(rect(0, 0, 100, 100), rect(50, 50, 100, 100))).toBe(true);
    expect(intersects(rect(0, 0, 100, 100), rect(200, 0, 100, 100))).toBe(
      false,
    );
    expect(intersects(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(
      false,
    );
  });

  it('unions overlapping paths and keeps disjoint ones', () => {
    expect(union([rect(0, 0, 100, 100), rect(50, 50, 100, 100)])).toHaveLength(
      1,
    );
    expect(union([rect(0, 0, 100, 100), rect(200, 0, 100, 100)])).toHaveLength(
      2,
    );
  });
});
