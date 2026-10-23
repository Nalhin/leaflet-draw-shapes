import type { CircleMarkerOptions, PolylineOptions } from 'leaflet';

/** Style of the freehand line shown while drawing. */
export interface StrokeStyle {
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
 * How the layer looks. Every part is optional and merged with the defaults,
 * so `{ color: 'tomato' }` alone re-themes polygons, vertices and the stroke.
 */
export interface DrawLayerStyle {
  /**
   * Accent colour used by every part unless overridden below.
   * @default '#3388ff'
   */
  color?: string;
  /**
   * Leaflet polyline options for drawn polygons (`weight`, `fillOpacity`,
   * `smoothFactor`, …).
   */
  polygon?: PolylineOptions;
  /** Leaflet circle-marker options for the vertex handles shown in `EDIT` mode. */
  vertex?: CircleMarkerOptions;
  /**
   * When vertex handles are drawn. With `'hover'` they stay invisible, but can
   * still be grabbed, and appear only under the pointer or while dragged.
   * @default 'hover'
   */
  showVertices?: 'hover' | 'always';
  /** The freehand line shown while drawing. */
  stroke?: StrokeStyle;
}

/** Concrete options for each element, after defaults and the accent are applied. */
export interface ResolvedStyle {
  polygon: PolylineOptions;
  vertex: CircleMarkerOptions;
  showVertices: 'hover' | 'always';
  stroke: Required<Omit<StrokeStyle, 'dashArray'>> &
    Pick<StrokeStyle, 'dashArray'>;
}

export const defaultStyle: Readonly<DrawLayerStyle> = Object.freeze({
  color: '#3388ff',
  showVertices: 'hover',
  polygon: { smoothFactor: 0.3 },
  vertex: { radius: 5, weight: 2, fillColor: '#fff', fillOpacity: 1 },
  stroke: { width: 2, opacity: 1 },
});

/** Drops `undefined` values so they don't overwrite defaults when spread. */
function defined<T extends object>(value: T | undefined): Partial<T> {
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
    polygon: { ...base.polygon, ...defined(update.polygon) },
    vertex: { ...base.vertex, ...defined(update.vertex) },
    stroke: { ...base.stroke, ...defined(update.stroke) },
  };
}

export function resolveStyle(style: DrawLayerStyle): ResolvedStyle {
  const { color = '#3388ff', showVertices = 'hover' } = style;
  return {
    polygon: { color, ...style.polygon },
    // Explicit opacities so a hidden handle can be fully restored.
    vertex: { color, opacity: 1, fillOpacity: 0.2, ...style.vertex },
    showVertices,
    stroke: { color, width: 2, opacity: 1, ...style.stroke },
  };
}
