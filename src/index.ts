import {
  FeatureGroup,
  Point,
  Map,
  SVG,
  LatLng,
  Polygon,
  LeafletMouseEvent, LatLngLiteral,
} from 'leaflet';
import { select } from 'd3-selection';
import { line, curveMonotoneX } from 'd3-shape';
import { updateFor } from './helpers/layer';
import { createFor, removeFor, clearFor } from './helpers/polygon';
import {
  CREATE,
  EDIT,
  DELETE,
  APPEND,
  EDIT_APPEND,
  NONE,
  ALL,
  modeFor,
} from './helpers/flags';
import simplifyPolygon from './helpers/simplify';

/**
 * @constant polygons
 * @type {WeakMap}
 */
export const polygons = new WeakMap();

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
 * @constant defaultOptions
 * @type {Object}
 */
export const defaultOptions: DrawLayerOptions = {
  mode: ALL,
  smoothFactor: 0.3,
  elbowDistance: 10,
  simplifyFactor: 1.1,
  mergePolygons: true,
  concavePolygon: true,
  maximumPolygons: Infinity,
  notifyAfterEditExit: false,
  leaveModeAfterCreate: false,
  strokeWidth: 2,
};

/**
 * @constant instanceKey
 * @type {Symbol}
 */
export const instanceKey = Symbol('draw-shapes/instance');

/**
 * @constant modesKey
 * @type {Symbol}
 */
export const modesKey = Symbol('draw-shapes/modes');

/**
 * @constant notifyDeferredKey
 * @type {Symbol}
 */
export const notifyDeferredKey = Symbol('draw-shapes/notify-deferred');

/**
 * @constant edgesKey
 * @type {Symbol}
 */
export const edgesKey = Symbol('draw-shapes/edges');

/**
 * @constant cancelKey
 * @type {Symbol}
 */
const cancelKey = Symbol('draw-shapes/cancel');

export default class DrawLayer extends FeatureGroup {

  private readonly options: DrawLayerOptions;
  private map: Map | null = null;
  private svg: SVG | null = null;

  /**
   * @constructor
   * @param {Object} [options = {}]
   * @return {void}
   */
  constructor(options = defaultOptions) {
    super();
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * @method onAdd
   * @param {Object} map
   * @return {this}
   */
  public onAdd(map: Map) {
    // Memorise the map instance.
    this.map = map;

    // Attach the cancel function and the instance to the map.
    //@ts-ignore
    map[cancelKey] = () => {
    };
    //@ts-ignore
    map[instanceKey] = this;
    //@ts-ignore
    map[notifyDeferredKey] = () => {
    };

    // Setup the dependency injection for simplifying the polygon.
    //@ts-ignore
    map.simplifyPolygon = simplifyPolygon;

    // Add the item to the map.
    polygons.set(map, new Set());

    // Set the initial mode.
    modeFor(map, this.options.mode ?? ALL, this.options);

    // Instantiate the SVG layer that sits on top of the map.

    const svg = (this.svg = select(map.getContainer())
      .append('svg')
      .classed('leaflet-draw-shapes', true)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('pointer-events', 'none')
      .style('z-index', '1001')
      .style('position', 'relative') as unknown as SVG);

    // Set the mouse events.

    this.listenForEvents(map, svg, this.options);

    return this;
  }

  /**
   * @method onRemove
   * @param {Object} map
   * @return {this}
   */
  public onRemove(map: Map): this {
    // Remove the item from the map.
    polygons.delete(map);

    // Remove the SVG layer.
    this.svg?.remove();

    // Remove the appendages from the map container.
    //@ts-ignore
    delete map[cancelKey];
    //@ts-ignore
    delete map[instanceKey];
    //@ts-ignore
    delete map.simplifyPolygon;
    return this;
  }

  /**
   * @method create
   * @param {LatLng[]} latLngs
   * @param {Object} [options = { concavePolygon: false }]
   * @return {Object}
   */
  public create(latLngs: ReadonlyArray<LatLngLiteral>, options = { concavePolygon: false }) {
    if (!this.map) {
      return;
    }
    const created = createFor(this.map, latLngs as any[], {
      ...this.options,
      ...options,
    });
    updateFor(this.map, 'create');
    return created;
  }

  /**
   * @method remove
   * @return {this}
   */
  public remove() {
    super.remove();
    if (this.map) {
      updateFor(this.map, 'remove');
    }
    return this;
  }

  /**
   * @method removePolygon
   * @param {Object} polygon
   * @return {void}
   */
  public removePolygon(polygon: Polygon) {
    if (this.map) {
      removeFor(this.map, polygon);
      updateFor(this.map, 'remove');
    }
  }

  /**
   * @method clear
   * @return {void}
   */
  public clear() {
    if (!this.map) {
      return;
    }
    clearFor(this.map);
    updateFor(this.map, 'clear');
  }

  /**
   * @method setMode
   * @param {Number} [mode = null]
   * @return {Number}
   */
  public mode(mode : number | null = null) {
    if (!this.map) {
      return;
    }
    // Set mode when passed `mode` is numeric, and then yield the current mode.
    typeof mode === 'number' && modeFor(this.map, mode, this.options);
    //@ts-ignore
    return this.map[modesKey];
  }

  /**
   * @method size
   * @return {Number}
   */
  public size() {
    if (!this.map) {
      return 0;
    }
    return polygons.get(this.map).size;
  }

  /**
   * @method all
   * @return {Array}
   */
  public all() {
    if (!this.map) {
      return [];
    }
    return Array.from(polygons.get(this.map));
  }

  /**
   * @method cancel
   * @return {void}
   */
  public cancel() {
    if (!this.map) {
      return;
    }
    //@ts-ignore
    this.map[cancelKey]();
  }

  /**
   * @method listenForEvents
   * @param {Object} map
   * @param {Object} svg
   * @param {Object} options
   * @return {void}
   */
  private listenForEvents(map: Map, svg: SVG, options: DrawLayerOptions) {
    /**
     * @method mouseDown
     * @param {Object} event
     * @return {void}
     */
    const mouseDown = (event: LeafletMouseEvent) => {
      //@ts-ignore
      if (!(map[modesKey] & CREATE)) {
        // Polygons can only be created when the mode includes create.
        return;
      }

      /**
       * @constant latLngs
       * @type {Set}
       */
      const latLngs = new Set();

      // Create the line iterator and move it to its first `yield` point, passing in the start point
      // from the mouse down event.
      const lineIterator = this.createPath(
        svg,
        map.latLngToContainerPoint(event.latlng),
        options.strokeWidth ?? 2,
      );

      /**
       * @method mouseMove
       * @param {Object} event
       * @return {void}
       */
      const mouseMove = (event: LeafletMouseEvent) => {
        // Resolve the pixel point to the latitudinal and longitudinal equivalent.
        const point = map.mouseEventToContainerPoint(event.originalEvent);

        // Push each lat/lng value into the points set.
        latLngs.add(map.containerPointToLatLng(point));

        // Invoke the generator by passing in the starting point for the path.
        lineIterator(new Point(point.x, point.y));
      };

      // Create the path when the user moves their cursor.
      //@ts-ignore
      map.on('mousemove touchmove', mouseMove);

      /**
       * @method mouseUp
       * @param _ ignored
       * @param {Boolean} [create = true]
       * @return {Function}
       */
      const mouseUp = (_: unknown, create = true) => {
        // Remove the ability to invoke `cancel`.
        //@ts-ignore
        map[cancelKey] = () => {
        };

        // Stop listening to the events.
        map.off('mouseup', mouseUp);
        map.off('mousemove', mouseMove);
        'body' in document &&
        document.body.removeEventListener('mouseleave', mouseUp);

        // Clear the SVG canvas.

        //@ts-ignore
        svg.selectAll('*').remove();

        if (create) {
          // ...And finally if we have any lat/lngs in our set then we can attempt to
          // create the polygon.
          latLngs.size && createFor(map, Array.from(latLngs), options);

          // Finally invoke the callback for the polygon regions.
          updateFor(map, 'create');

          // Exit the `CREATE` mode if the options permit it.

          //@ts-ignore
          options.leaveModeAfterCreate && this.mode(this.mode() ^ CREATE);
        }
      };

      // Clear up the events when the user releases the mouse.
      map.on('mouseup touchend', mouseUp);
      'body' in document &&
      document.body.addEventListener('mouseleave', mouseUp);

      // Setup the function to invoke when `cancel` has been invoked.

      //@ts-ignore
      map[cancelKey] = () => mouseUp({}, false);
    };

    //@ts-ignore
    map.on('mousedown touchstart', mouseDown);
  }

  /**
   * @method createPath
   * @param {Object} svg
   * @param {Point} fromPoint
   * @param {Number} strokeWidth
   * @return {void}
   */
  private createPath(svg: SVG, fromPoint: Point, strokeWidth: number) {
    let lastPoint = fromPoint;

    const lineFunction = line()
      .curve(curveMonotoneX)
      .x((d: any) => d.x)
      .y((d: any) => d.y);

    return (toPoint: Point) => {
      const lineData = [lastPoint, toPoint];
      lastPoint = toPoint;
      // Draw SVG line based on the last movement of the mouse's position.
      svg
        //@ts-ignore
        .append('path')
        .classed('leaflet-line', true)
        //@ts-ignore
        .attr('d', lineFunction(lineData))
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', strokeWidth);
    };
  }
}

/**
 * @method drawLayer
 * @return {Object}
 */
export function drawLayer(options: DrawLayerOptions) {
  return new DrawLayer(options);
}

export {
  CREATE,
  EDIT,
  DELETE,
  APPEND,
  EDIT_APPEND,
  NONE,
  ALL,
} from './helpers/flags';

