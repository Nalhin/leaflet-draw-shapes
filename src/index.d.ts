import { FeatureGroup, LatLng, Polygon, LeafletEvent } from 'leaflet';

export as namespace LeafletDrawShapes;

/**
 * Deactivate Index
 */
export const NONE: number;

/**
 * Create polygons
 */
export const CREATE: number;

/**
 * Edit existing polygons
 */
export const EDIT: number;

/**
 * Delete polygons
 */
export const DELETE: number;

/**
 * Append points to an existing polygon
 */
export const APPEND: number;

/**
 * Edit polygons and can append new points to an existing polygon
 */
export const EDIT_APPEND: number;

/**
 * Create edit delete and append polygons
 */
export const ALL: number;

/**
 * Initialize a new Index instance
 * @param options Index option for the new instance
 */
export function drawLayer(options?: DrawLayerOptions): DrawLayer;

/**
 * Index class
 */
declare class DrawLayer extends FeatureGroup {
  /**
   * Instantiate a new Index instance, don't forget to add it to leaflet with addLayer
   * @param options Instance options
   */
  constructor(options?: DrawLayerOptions);

  /**
   *
   * @param latlngs Pre-made polygon to add to the map
   * @param [options={concavePolgygons: false}] Index options, by default concavePolygons : false
   * @returns Polygon added to the Index instance
   */
  create(latlngs: ReadonlyArray<LatLng>, options?: DrawLayerOptions): Polygon;

  /**
   * Removes the layer from the map it is currently active on.
   */
  remove(): this;

  /**
   * Remove polygon from the Index instance
   * @param polygon Polygon to remove from the map
   */
  removePolygon(polygon: Polygon): void;

  /**
   * Clear all polygons from Index
   */
  clear(): void;

  /**
   * Set or retrieve the mode used by Index
   * @param mode new Mode to use, if not passed, will return the current mode
   */
  mode(mode?: number): number;

  /**
   * Cancel the current action creation in progress
   */
  cancel(): void;

  /**
   * Returns the current amount of polygons stored in Index
   */
  size(): number;

  /**
   * Array of all polygons stored in the instance
   */
  all(): Polygon[];
}

export default DrawLayer;

/**
 * Option object accepted by the Index constructor
 */
export interface DrawLayerOptions {
  /**
   * Modifies the default mode.
   * @default ALL
   */
  mode?: number | undefined;

  /**
   * By how much to smooth the polygons.
   * @default 0.3
   */
  smoothFactor?: number | undefined;

  /**
   * Factor to determine when to delete or when to append an edge.
   * @default 10
   */
  elbowDistance?: number | undefined;

  /**
   * By how much to simplify the polygon.
   * @default 1.1
   */
  simplifyFactor?: number | undefined;

  /**
   * Whether to attempt merging of polygons that intersect.
   * @default true
   */
  mergePolygons?: boolean | undefined;

  /**
   * Whether to apply the concaving algorithm to the polygons.
   * @default true
   */
  concavePolygon?: boolean | undefined;

  /**
   * Maximum number of polygons to be added to the map layer.
   * @default Infinity
   */
  maximumPolygons?: number | undefined;

  /**
   * Whether to defer markers event until after exiting EDIT mode.
   * @default false
   */
  notifyAfterEditExit?: boolean | undefined;

  /**
   * Whether to exit CREATE mode after each polygon creation.
   * @default false
   */
  leaveModeAfterCreate?: boolean | undefined;

  /**
   * Size of the stroke when drawing.
   * @default 2
   */
  strokeWidth?: number | undefined;
}

/**
 * Event payload sent by markers
 */
export interface MarkerEvent extends LeafletEvent {
  type: 'markers';

  /**
   * Polygons currently stored in the Index Instance being listened to
   */
  latLngs: LatLng[][];
}

/**
 * Handler type for the "markers" event
 */
export type MarkerEventHandler = (event: MarkerEvent) => void;

declare module 'leaflet' {
  interface Evented {
    on(type: 'markers', fn: MarkerEventHandler, context?: any): this;
    off(type: 'markers', fn?: MarkerEventHandler, context?: any): this;
  }
}

type localCreate = typeof CREATE;
type localEdit = typeof EDIT;
type localDelete = typeof DELETE;
type localAppend = typeof APPEND;
type localEditAppend = typeof EDIT_APPEND;
type localNone = typeof NONE;
type localAll = typeof ALL;

declare namespace FreeDraw {
  /**
   * Create polygons
   */
  const CREATE: localCreate;

  /**
   * Edit existing polygons
   */
  const EDIT: localEdit;

  /**
   * Delete polygons
   */
  const DELETE: localDelete;

  /**
   * Append points to an existing polygon
   */
  const APPEND: localAppend;

  /**
   * Edit polygons and can append new points to an existing polygon
   */
  const EDIT_APPEND: localEditAppend;

  /**
   * Deactivate Index
   */
  const NONE: localNone;

  /**
   * Create edit delete and append polygons
   */
  const ALL: localAll;
}

