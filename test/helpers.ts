import { Map, Point, type LatLngLiteral } from 'leaflet';
import { DrawLayer, type DrawLayerOptions, type MarkersEvent } from '../src';

export function createMap(options: { dragging?: boolean } = {}): Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new Map(container, options).setView([51.505, -0.09], 13);
}

export function setup(
  options: Partial<DrawLayerOptions> = {},
  mapOptions: { dragging?: boolean } = {},
): { map: Map; layer: DrawLayer; events: MarkersEvent[] } {
  const map = createMap(mapOptions);
  const layer = new DrawLayer(options).addTo(map);
  const events: MarkersEvent[] = [];
  layer.on('markers', (event) => events.push(event));
  return { map, layer, events };
}

/** A square of `size` pixels centred on container point (`x`, `y`), as lat/lngs. */
export function square(
  map: Map,
  x: number,
  y: number,
  size = 100,
): LatLngLiteral[] {
  const half = size / 2;
  return [
    [x - half, y - half],
    [x + half, y - half],
    [x + half, y + half],
    [x - half, y + half],
  ].map(([px, py]) => map.containerPointToLatLng(new Point(px!, py!)));
}

/** Container points around a circle, like a hand-drawn loop. */
export function circlePoints(
  cx: number,
  cy: number,
  radius: number,
  steps = 48,
): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    return new Point(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    );
  });
}

function mouse(type: string, point: Point, target: EventTarget): void {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: point.x,
      clientY: point.y,
    }),
  );
}

/** Simulates a freehand mouse stroke through `points` on the map. */
export function strokeWithMouse(map: Map, points: Point[]): void {
  const container = map.getContainer();
  const [first, ...rest] = points;
  mouse('mousedown', first!, container);
  rest.forEach((point) => mouse('mousemove', point, container));
  mouse('mouseup', rest.at(-1) ?? first!, container);
}

/** Simulates a freehand touch stroke through `points` on the map. */
export function strokeWithTouch(map: Map, points: Point[]): void {
  const container = map.getContainer();
  const touch = (type: string, point?: Point) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'touches', {
      value: point ? [{ clientX: point.x, clientY: point.y }] : [],
    });
    container.dispatchEvent(event);
  };
  const [first, ...rest] = points;
  touch('touchstart', first);
  rest.forEach((point) => touch('touchmove', point));
  touch('touchend');
}
