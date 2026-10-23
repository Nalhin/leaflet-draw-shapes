import type { LayerOptions } from 'leaflet';
import { Mode } from './modes';
import type { DrawLayerStyle } from './style';

/** Options accepted by {@link DrawLayer}. Every option is optional. */
export interface DrawLayerOptions extends LayerOptions {
  /**
   * Initial interaction mode.
   * @default Mode.ALL
   */
  mode?: Mode;

  /**
   * Distance in pixels from an edge within which a click appends a vertex
   * instead of deleting the polygon (when both `DELETE` and `APPEND` are active).
   * @default 10
   */
  appendTolerance?: number;

  /**
   * Distance in pixels used to drop near-duplicate vertices from drawn shapes.
   * @default 1.1
   */
  simplifyFactor?: number;

  /**
   * Merge polygons that overlap into a single polygon.
   * @default true
   */
  mergePolygons?: boolean;

  /**
   * Run a concave hull over freehand strokes to tidy them up.
   * @default true
   */
  concaveHull?: boolean;

  /**
   * Maximum number of polygons the layer will hold. With `mergePolygons`, a
   * shape that merges into an existing one is still allowed at the limit.
   * @default Infinity
   */
  maxPolygons?: number;

  /**
   * Hold back `shapes:edit` and `shapes:change` for vertex drags until the
   * mode changes or the layer is removed.
   * @default false
   */
  notifyAfterEditExit?: boolean;

  /**
   * Leave `CREATE` mode after each drawn polygon.
   * @default false
   */
  leaveModeAfterCreate?: boolean;

  /**
   * How polygons, vertex handles and the freehand line look.
   * @see DrawLayerStyle
   */
  style?: DrawLayerStyle;
}

/** Options with the defaults filled in, as found on `layer.options`. */
export type ResolvedOptions = DrawLayerOptions &
  Required<Omit<DrawLayerOptions, keyof LayerOptions>>;

/** Options that {@link DrawLayer.addPolygon} can override for one call. */
export type AddPolygonOptions = Pick<
  DrawLayerOptions,
  'concaveHull' | 'mergePolygons' | 'simplifyFactor' | 'maxPolygons'
>;

/** Lives on `DrawLayer.prototype.options`, so `DrawLayer.mergeOptions()` can change it. */
export const defaultOptions: Omit<ResolvedOptions, 'style'> = {
  mode: Mode.ALL,
  appendTolerance: 10,
  simplifyFactor: 1.1,
  mergePolygons: true,
  concaveHull: true,
  maxPolygons: Infinity,
  notifyAfterEditExit: false,
  leaveModeAfterCreate: false,
};
