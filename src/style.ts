import type { CircleMarkerOptions, PolylineOptions } from 'leaflet';

/** Style of the freehand line shown while drawing. */
export interface SketchStyle {
  /** Defaults to the accent `color`. */
  color?: string;
  /** Width in pixels. @default 2 */
  width?: number;
  /** @default 1 */
  opacity?: number;
  /** SVG dash pattern, e.g. `'4 4'`. */
  dashArray?: string;
}

/**
 * How the layer looks. The top level takes Leaflet polyline options for the
 * polygons, just like `Path.setStyle()`, and its `color` doubles as the accent
 * for the vertex handles and the freehand line. So `{ color: 'tomato' }` alone
 * re-themes everything. Every part is optional and merged with the defaults.
 */
export interface DrawLayerStyle extends PolylineOptions {
  /**
   * Polygon colour, and the accent for `vertex` and `sketch` unless they set
   * their own.
   * @default '#3388ff'
   */
  color?: string;
  /** Leaflet circle-marker options for the vertex handles shown in `EDIT` mode. */
  vertex?: CircleMarkerOptions;
  /**
   * When vertex handles are drawn. With `'hover'` they stay invisible, but can
   * still be grabbed, and appear only under the pointer or while dragged.
   * @default 'hover'
   */
  showVertices?: 'hover' | 'always';
  /** The freehand line shown while drawing. */
  sketch?: SketchStyle;
}

/** Concrete options for each element, after defaults and the accent are applied. */
export interface ResolvedStyle {
  polygon: PolylineOptions;
  vertex: CircleMarkerOptions;
  showVertices: 'hover' | 'always';
  sketch: Required<Omit<SketchStyle, 'dashArray'>> &
    Pick<SketchStyle, 'dashArray'>;
}

export const defaultStyle: Readonly<DrawLayerStyle> = Object.freeze({
  color: '#3388ff',
  smoothFactor: 0.3,
  showVertices: 'hover',
  vertex: { radius: 5, weight: 2, fillColor: '#fff', fillOpacity: 1 },
  sketch: { width: 2, opacity: 1 },
});

/** Drops `undefined` values so they don't overwrite defaults when spread. */
export function defined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** Merges `update` into `base` one level deep, ignoring `undefined` values. */
export function mergeStyle(
  base: DrawLayerStyle,
  update: DrawLayerStyle = {},
): DrawLayerStyle {
  return {
    ...base,
    ...defined(update),
    vertex: { ...base.vertex, ...defined(update.vertex) },
    sketch: { ...base.sketch, ...defined(update.sketch) },
  };
}

export function resolveStyle(style: DrawLayerStyle): ResolvedStyle {
  const { vertex, sketch, showVertices = 'hover', ...polygon } = style;
  const color = polygon.color ?? '#3388ff';
  return {
    polygon: { ...polygon, color },
    // Explicit opacities so a hidden handle can be fully restored.
    vertex: { color, opacity: 1, fillOpacity: 0.2, ...vertex },
    showVertices,
    sketch: { color, width: 2, opacity: 1, ...sketch },
  };
}
