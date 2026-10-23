import { Mode } from './modes';

/** CSS classes, all prefixed with the plugin name so they can't clash. */
export const classNames = {
  /** The SVG overlay the freehand line is drawn on. */
  overlay: 'leaflet-draw-shapes',
  sketch: 'leaflet-draw-shapes-sketch',
  polygon: 'leaflet-draw-shapes-polygon',
  vertex: 'leaflet-draw-shapes-vertex',
  /** On the map container when no mode is active. */
  noMode: 'leaflet-draw-shapes-mode-none',
} as const;

/** CSS class applied to the map container for each active mode. */
export const modeClassNames: readonly (readonly [Mode, string])[] = [
  [Mode.CREATE, 'leaflet-draw-shapes-mode-create'],
  [Mode.EDIT, 'leaflet-draw-shapes-mode-edit'],
  [Mode.DELETE, 'leaflet-draw-shapes-mode-delete'],
  [Mode.APPEND, 'leaflet-draw-shapes-mode-append'],
];

/** Appends `className` to a space-separated class list. */
export function withClass(className: string, existing?: string): string {
  return [className, existing].filter(Boolean).join(' ');
}
