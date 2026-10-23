import type { LayerOptions } from 'leaflet';
import { ALL, type Mode } from './modes';
import type { DrawLayerStyle } from './style';

/** Options accepted by {@link DrawLayer}. */
export interface DrawLayerOptions extends LayerOptions {
  /**
   * Initial interaction mode.
   * @default ALL
   */
  mode: Mode;

  /**
   * Distance in pixels from an edge within which a click appends a vertex
   * instead of deleting the polygon (when both `DELETE` and `APPEND` are active).
   * @default 10
   */
  elbowDistance: number;

  /**
   * Distance in pixels used to drop near-duplicate vertices from drawn shapes.
   * @default 1.1
   */
  simplifyFactor: number;

  /**
   * Merge polygons that overlap into a single polygon.
   * @default true
   */
  mergePolygons: boolean;

  /**
   * Run the concave hull algorithm over freehand shapes.
   * @default true
   */
  concavePolygon: boolean;

  /**
   * Maximum number of polygons the layer will hold.
   * @default Infinity
   */
  maximumPolygons: number;

  /**
   * Defer the `markers` event for vertex edits until the mode changes.
   * @default false
   */
  notifyAfterEditExit: boolean;

  /**
   * Leave `CREATE` mode after each drawn polygon.
   * @default false
   */
  leaveModeAfterCreate: boolean;

  /**
   * How polygons, vertex handles and the drawing stroke look.
   * @see DrawLayerStyle
   */
  style?: DrawLayerStyle;
}

export const defaultOptions: Readonly<DrawLayerOptions> = Object.freeze({
  mode: ALL,
  elbowDistance: 10,
  simplifyFactor: 1.1,
  mergePolygons: true,
  concavePolygon: true,
  maximumPolygons: Infinity,
  notifyAfterEditExit: false,
  leaveModeAfterCreate: false,
});
