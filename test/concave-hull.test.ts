import type { LatLngLiteral } from 'leaflet';
import { describe, expect, it } from 'vitest';
import { concaveHull } from '../src/geometry/concave-hull';

/** A dense outline of a square, walked like a freehand stroke. */
function squareOutline(step = 0.001, size = 0.01): LatLngLiteral[] {
  const points: LatLngLiteral[] = [];
  const steps = Math.round(size / step);
  for (let i = 0; i < steps; i++)
    points.push({ lat: 51.5, lng: -0.1 + i * step });
  for (let i = 0; i < steps; i++)
    points.push({ lat: 51.5 + i * step, lng: -0.1 + size });
  for (let i = 0; i < steps; i++)
    points.push({ lat: 51.5 + size, lng: -0.1 + size - i * step });
  for (let i = 0; i < steps; i++)
    points.push({ lat: 51.5 + size - i * step, lng: -0.1 });
  return points;
}

describe('concaveHull', () => {
  it('returns a copy of inputs with three or fewer points', () => {
    const input = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
      { lat: 0, lng: 1 },
    ];
    const result = concaveHull(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('traces a closed ring made of the input points', () => {
    const input = squareOutline();
    const hull = concaveHull(input);

    expect(hull.length).toBeGreaterThan(4);
    expect(hull[0]).toBe(hull.at(-1));
    hull.forEach((point) => expect(input).toContain(point));
  });

  it('drops a stroke that doubles back inside the shape', () => {
    const outline = squareOutline();
    // Finish the stroke with a short tail pointing into the square.
    const tail = [
      { lat: 51.5005, lng: -0.0995 },
      { lat: 51.501, lng: -0.099 },
    ];
    const hull = concaveHull([...outline, ...tail]);

    tail.forEach((point) => expect(hull).not.toContain(point));
  });

  it('does not mutate the input', () => {
    const input = squareOutline();
    const snapshot = structuredClone(input);
    concaveHull(input);
    expect(input).toEqual(snapshot);
  });
});
