import { Map, Point, type LatLngLiteral } from 'leaflet';
import { DrawLayer, type DrawLayerOptions, type ShapesEvent } from '../src';

export function createMap(options: { dragging?: boolean } = {}): Map {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new Map(container, options).setView([51.505, -0.09], 13);
}

export function setup(
  options: DrawLayerOptions = {},
  mapOptions: { dragging?: boolean } = {},
): { map: Map; layer: DrawLayer; events: ShapesEvent[] } {
  const map = createMap(mapOptions);
  const layer = new DrawLayer(options).addTo(map);
  const events: ShapesEvent[] = [];
  const record = (event: ShapesEvent) => events.push(event);
  layer.on('shapes:create', record);
  layer.on('shapes:edit', record);
  layer.on('shapes:remove', record);
  layer.on('shapes:change', record);
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

/** The `type` of each recorded event, e.g. `['shapes:create', 'shapes:change']`. */
export function types(events: ShapesEvent[]): string[] {
  return events.map((event) => event.type);
}

/**
 * Dispatches a primary pointer event at container point `point`, then, like a
 * browser, the compatibility mouse or touch event unless it was prevented.
 */
export function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  point: Point,
  target: EventTarget,
  pointerType: 'mouse' | 'touch' = 'mouse',
): void {
  const position = { clientX: point.x, clientY: point.y };
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: type === 'pointermove' ? -1 : 0,
    isPrimary: true,
    pointerId: 1,
    pointerType,
    ...position,
  });
  target.dispatchEvent(event);

  if (pointerType === 'touch') {
    const touch = new Event(compatibilityEvents.touch[type], { bubbles: true });
    Object.defineProperty(touch, 'touches', {
      value: type === 'pointerup' ? [] : [position],
    });
    target.dispatchEvent(touch);
  } else if (!event.defaultPrevented) {
    target.dispatchEvent(
      new MouseEvent(compatibilityEvents.mouse[type], {
        bubbles: true,
        button: 0,
        ...position,
      }),
    );
  }
}

const compatibilityEvents = {
  mouse: {
    pointerdown: 'mousedown',
    pointermove: 'mousemove',
    pointerup: 'mouseup',
  },
  touch: {
    pointerdown: 'touchstart',
    pointermove: 'touchmove',
    pointerup: 'touchend',
  },
} as const;
