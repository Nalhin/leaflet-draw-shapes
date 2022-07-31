import {
  FeatureGroup,
  Point,
  Map,
  Polygon,
  LatLngLiteral,
  DomEvent,
} from 'leaflet';
import { select, Selection } from 'd3-selection';
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

export const polygons = new WeakMap();

/**
 * Option object accepted by the Index constructor
 */
export interface DrawLayerOptions {
  /**
   * Modifies the default mode.
   * @default ALL
   */
  mode: number;

  /**
   * By how much to smooth the polygons.
   * @default 0.3
   */
  smoothFactor: number;

  /**
   * Factor to determine when to delete or when to append an edge.
   * @default 10
   */
  elbowDistance: number;

  /**
   * By how much to simplify the polygon.
   * @default 1.1
   */
  simplifyFactor: number;

  /**
   * Whether to attempt merging of polygons that intersect.
   * @default true
   */
  mergePolygons: boolean;

  /**
   * Whether to apply the concaving algorithm to the polygons.
   * @default true
   */
  concavePolygon: boolean;

  /**
   * Maximum number of polygons to be added to the map layer.
   * @default Infinity
   */
  maximumPolygons: number;

  /**
   * Whether to defer markers event until after exiting EDIT mode.
   * @default false
   */
  notifyAfterEditExit: boolean;

  /**
   * Whether to exit CREATE mode after each polygon creation.
   * @default false
   */
  leaveModeAfterCreate: boolean;

  /**
   * Size of the stroke when drawing.
   * @default 2
   */
  strokeWidth: number;
}

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

export const instanceKey = Symbol('draw-shapes/instance');
export const modesKey = Symbol('draw-shapes/modes');
export const notifyDeferredKey = Symbol('draw-shapes/notify-deferred');
export const edgesKey = Symbol('draw-shapes/edges');

const cancelKey = Symbol('draw-shapes/cancel');

export default class DrawLayer extends FeatureGroup {
  private readonly options: DrawLayerOptions;
  private map: Map | null = null;
  private svg: Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  constructor(options: Partial<DrawLayerOptions> = defaultOptions) {
    super();
    this.options = { ...defaultOptions, ...options };
  }

  public onAdd(map: Map) {
    this.map = map;

    // Attach the cancel function and the instance to the map.
    //@ts-ignore
    map[cancelKey] = () => {};
    //@ts-ignore
    map[instanceKey] = this;
    //@ts-ignore
    map[notifyDeferredKey] = () => {};

    // Setup the dependency injection for simplifying the polygon.
    //@ts-ignore
    map.simplifyPolygon = simplifyPolygon;

    // Add the item to the map.
    polygons.set(map, new Set());

    modeFor(map, this.options.mode ?? ALL, this.options);

    this.svg = select(map.getContainer())
      .append('svg')
      .classed('leaflet-draw-shapes', true)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('pointer-events', 'none')
      .style('z-index', '1001')
      .style('position', 'relative');

    this.listenForEvents(map, this.svg, this.options);

    return this;
  }

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

  public create(
    polygon: ReadonlyArray<LatLngLiteral>,
    options = { concavePolygon: false },
  ) {
    if (!this.map) {
      return;
    }
    const created = createFor(this.map, polygon as any[], {
      ...this.options,
      ...options,
    });
    updateFor(this.map, 'create');
    return created;
  }

  public remove() {
    super.remove();

    if (!this.map) {
      return this;
    }

    updateFor(this.map, 'remove');

    return this;
  }

  public removePolygon(polygon: Polygon) {
    if (!this.map) {
      return;
    }
    removeFor(this.map, polygon);
    updateFor(this.map, 'remove');
  }

  public clear() {
    if (!this.map) {
      return;
    }
    clearFor(this.map);
    updateFor(this.map, 'clear');
  }

  public mode(mode: number | null = null) {
    if (!this.map) {
      return;
    }
    // Set mode when passed `mode` is numeric, and then yield the current mode.
    typeof mode === 'number' && modeFor(this.map, mode, this.options);
    //@ts-ignore
    return this.map[modesKey];
  }


  public size() {
    if (!this.map) {
      return 0;
    }
    return polygons.get(this.map).size;
  }


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

  private listenForEvents(
    map: Map,
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    options: DrawLayerOptions,
  ) {

    const mouseDown = (event: any) => {
      //@ts-ignore
      if (!(map[modesKey] & CREATE)) {
        // Polygons can only be created when the mode includes create.
        return;
      }

      const linePoints = new Set();

      const e = (event.touches ? event.touches[0] : event) as MouseEvent;
      const point = map.mouseEventToLatLng(e);

      // Create the line iterator and move it to its first `yield` point, passing in the start point
      // from the mouse down event.
      const lineIterator = this.createPath(
        svg,
        map.latLngToContainerPoint(point),
        options.strokeWidth,
      );

      const mouseMove = (event: any) => {
        // Resolve the pixel point to the latitudinal and longitudinal equivalent.
        const e = (event.touches ? event.touches[0] : event) as MouseEvent;
        const point = map.mouseEventToContainerPoint(e);

        // Push each lat/lng value into the points set.
        linePoints.add(map.containerPointToLatLng(point));

        // Invoke the generator by passing in the starting point for the path.
        lineIterator(new Point(point.x, point.y));
      };

      // Create the path when the user moves their cursor.

      DomEvent.on(
        map.getContainer(),
        { mousemove: mouseMove, touchmove: mouseMove },
        this,
      );

      const mouseUp = (_: any, create = true) => {
        // Remove the ability to invoke `cancel`.
        //@ts-ignore
        map[cancelKey] = () => {};

        // Stop listening to the events.

        DomEvent.off(
          map.getContainer(),
          {
            mousemove: mouseMove,
            mouseup: mouseUp,
            touchmove: mouseMove,
            touchend: mouseUp,
          },
          this,
        );

        'body' in document &&
          document.body.removeEventListener('mouseleave', mouseUp);

        // Clear the SVG canvas.

        svg.selectAll('*').remove();

        if (create) {
          // ...And finally if we have any lat/lngs in our set then we can attempt to
          // create the polygon.
          linePoints.size && createFor(map, Array.from(linePoints), options);

          // Finally invoke the callback for the polygon regions.
          updateFor(map, 'create');

          // Exit the `CREATE` mode if the options permit it.

          //@ts-ignore
          options.leaveModeAfterCreate && this.mode(this.mode() ^ CREATE);
        }
      };

      // Clear up the events when the user releases the mouse.
      DomEvent.on(
        map.getContainer(),
        {
          mouseup: mouseUp,
          touchend: mouseUp,
        },
        this,
      );

      'body' in document &&
        document.body.addEventListener('mouseleave', mouseUp);

      // Setup the function to invoke when `cancel` has been invoked.

      //@ts-ignore
      map[cancelKey] = () => mouseUp({}, false);
    };

    DomEvent.on(
      map.getContainer(),
      { mousedown: mouseDown, touchstart: mouseDown },
      this,
    );
  }

  private createPath(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    fromPoint: Point,
    strokeWidth: number,
  ) {
    let lastPoint = fromPoint;

    const lineFunction = line<Point>()
      .curve(curveMonotoneX)
      .x((d) => d.x)
      .y((d) => d.y);

    return (toPoint: Point) => {
      const lineData = [lastPoint, toPoint];
      lastPoint = toPoint;

      // Draw SVG line based on the last movement of the mouse's position.
      svg
        .append('path')
        .classed('leaflet-line', true)
        .attr('d', lineFunction(lineData))
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', strokeWidth);
    };
  }
}

export function drawLayer(options?: Partial<DrawLayerOptions>) {
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
