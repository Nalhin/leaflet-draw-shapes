import { describe, expect, it } from 'vitest';
import {
  clean,
  intersects,
  simplify,
  toLatLngs,
  toPath,
  union,
  type Path,
} from '../src/geometry/clip';
import { createMap } from './helpers';

const rect = (x: number, y: number, w: number, h: number): Path => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

const area = (path: Path) =>
  Math.abs(
    path.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = path[(i + 1) % path.length]!;
      return sum + (x1 * y2 - x2 * y1);
    }, 0) / 2,
  );

describe('geometry', () => {
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

  describe('clean', () => {
    it('drops near-duplicate and near-collinear vertices', () => {
      const path: Path = [
        [0, 0],
        [50, 0.5], // near-collinear
        [100, 0],
        [100, 100],
        [100.5, 100], // near-duplicate
        [0, 100],
      ];
      const cleaned = clean(path, 1.1);
      expect(cleaned).toHaveLength(4);
      expect(area(cleaned)).toBeCloseTo(10000, -2);
    });

    it('returns [] when fewer than three vertices survive', () => {
      expect(
        clean(
          [
            [0, 0],
            [0.5, 0],
            [1, 0],
          ],
          1.1,
        ),
      ).toEqual([]);
    });

    it('leaves a clean ring untouched', () => {
      expect(clean(rect(0, 0, 100, 100), 1.1)).toEqual(rect(0, 0, 100, 100));
    });
  });

  describe('simplify', () => {
    it('splits a figure-eight into two polygons', () => {
      const figureEight: Path = [
        [0, 0],
        [100, 100],
        [100, 0],
        [0, 100],
      ];
      const parts = simplify(figureEight, 1.1);
      expect(parts).toHaveLength(2);
      parts.forEach((part) => expect(area(part)).toBeCloseTo(2500));
    });

    it('keeps a loop traced twice filled (non-zero rule)', () => {
      const square = rect(0, 0, 100, 100);
      const parts = simplify([...square, ...square], 1.1);
      expect(parts).toHaveLength(1);
      expect(area(parts[0]!)).toBeCloseTo(10000);
    });

    it('returns open rings (first point not repeated)', () => {
      const [ring] = simplify(rect(0, 0, 100, 100), 1.1);
      expect(ring).toHaveLength(4);
    });
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
    const merged = union([rect(0, 0, 100, 100), rect(50, 50, 100, 100)]);
    expect(merged).toHaveLength(1);
    expect(area(merged[0]!)).toBeCloseTo(17500);
    expect(union([rect(0, 0, 100, 100), rect(200, 0, 100, 100)])).toHaveLength(
      2,
    );
    expect(union([])).toEqual([]);
  });
});
