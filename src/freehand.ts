import { DomEvent, type LatLng, type Map } from 'leaflet';
import { classNames } from './class-names';
import type { DrawContext } from './context';
import { hasMode, Mode } from './modes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface FreehandHandle {
  /** Abandons the stroke in progress without creating a polygon. */
  cancel(): void;
  /** Stops listening for strokes and removes the overlay. */
  dispose(): void;
}

interface ClientPosition {
  clientX: number;
  clientY: number;
}

function positionOf(event: Event): ClientPosition | undefined {
  return 'touches' in event
    ? (event as TouchEvent).touches[0]
    : (event as MouseEvent);
}

/**
 * Listens for mouse and touch strokes on the map while `CREATE` mode is active,
 * draws them on an SVG overlay and hands the traced lat/lngs to `onStroke`.
 */
export function enableFreehand(
  context: DrawContext,
  map: Map,
  onStroke: (latLngs: LatLng[]) => void,
): FreehandHandle {
  const { layer } = context;
  const container = map.getContainer();
  const toContainerPoint = (position: ClientPosition) =>
    map.mouseEventToContainerPoint(position as MouseEvent);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add(classNames.overlay);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  Object.assign(svg.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '1001',
    pointerEvents: 'none',
  });
  container.appendChild(svg);

  let cancelStroke: (() => void) | null = null;

  const start = (event: Event): void => {
    if (!hasMode(layer.getMode(), Mode.CREATE) || cancelStroke) return;
    if (event instanceof MouseEvent && event.button !== 0) return;
    // Dragging a vertex in `CREATE | EDIT` mode should not start a stroke.
    if (context.draggingVertex) return;

    const origin = positionOf(event);
    if (!origin) return;

    const { x, y } = toContainerPoint(origin);
    const path = document.createElementNS(SVG_NS, 'path');
    path.classList.add(classNames.sketch);
    const { sketch } = context.style;
    const attributes = {
      fill: 'none',
      stroke: sketch.color,
      'stroke-width': String(sketch.width),
      'stroke-opacity': String(sketch.opacity),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      ...(sketch.dashArray && { 'stroke-dasharray': sketch.dashArray }),
    };
    for (const [name, value] of Object.entries(attributes)) {
      path.setAttribute(name, value);
    }
    svg.appendChild(path);

    let d = `M${x} ${y}`;
    const latLngs: LatLng[] = [];

    const move = (moveEvent: Event): void => {
      const position = positionOf(moveEvent);
      if (!position) return;
      const point = toContainerPoint(position);
      latLngs.push(map.containerPointToLatLng(point));
      d += `L${point.x} ${point.y}`;
      path.setAttribute('d', d);
    };

    const finish = (commit: boolean): void => {
      DomEvent.off(container, handlers);
      document.body.removeEventListener('mouseleave', end);
      path.remove();
      cancelStroke = null;
      if (commit && latLngs.length) onStroke(latLngs);
    };

    const end = (): void => finish(true);
    const handlers = {
      mousemove: move,
      touchmove: move,
      mouseup: end,
      touchend: end,
    };

    DomEvent.on(container, handlers);
    document.body.addEventListener('mouseleave', end);
    cancelStroke = () => finish(false);
  };

  const startHandlers = { mousedown: start, touchstart: start };
  DomEvent.on(container, startHandlers);

  return {
    cancel: () => cancelStroke?.(),
    dispose: () => {
      cancelStroke?.();
      DomEvent.off(container, startHandlers);
      svg.remove();
    },
  };
}
