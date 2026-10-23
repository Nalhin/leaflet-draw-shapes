import {
  FeatureGroup,
  LayerGroup,
  latLng,
  Polygon,
  type Handler,
  type LatLng,
  type LatLngExpression,
  type Layer,
  type LayerOptions,
  type LeafletEvent,
  type Map,
} from 'leaflet';
import { classNames, modeClassNames } from './class-names';
import { polygonsOf, type ActionEventType, type DrawContext } from './context';
import type { DrawLayerEventMap } from './events';
import { enableFreehand, type FreehandHandle } from './freehand';
import { outerRingsOf } from './geojson';
import { ModeHandler } from './handlers';
import { hasMode, Mode } from './modes';
import {
  defaultOptions,
  type AddPolygonOptions,
  type DrawLayerOptions,
  type ResolvedOptions,
} from './options';
import {
  attachPolygon,
  createPolygons,
  detachPolygon,
  newPolygon,
} from './polygons';
import {
  defaultStyle,
  defined,
  mergeStyle,
  resolveStyle,
  type DrawLayerStyle,
} from './style';
import {
  enableVertexDragging,
  syncVertexVisibility,
  vertexAppearance,
  type VertexDraggingHandle,
} from './vertices';

interface QueuedPolygon {
  latLngs: LatLng[];
  options: ResolvedOptions;
}

/** Leaflet internals that `DrawLayer` builds on, missing from its typings. */
interface LeafletClassInternals {
  initialize(layers: Layer[], options?: LayerOptions): void;
  callInitHooks(): void;
  _initHooks: (() => void)[];
  _initHooksCalled?: boolean;
}

const internals = (prototype: object) =>
  prototype as unknown as LeafletClassInternals;

/**
 * A Leaflet layer for drawing freehand polygons with mouse or touch.
 *
 * Drawn polygons are children of this `FeatureGroup`, so `getLayers()`,
 * `addLayer()`, `removeLayer()`, `clearLayers()`, `getBounds()` and
 * `toGeoJSON()` work as usual.
 *
 * @fires shapes:create {@link ShapesEvent} after the user draws a shape.
 * @fires shapes:edit {@link ShapesEvent} after the user moves or adds a vertex.
 * @fires shapes:remove {@link ShapesEvent} after the user deletes a shape.
 * @fires shapes:change {@link ShapesEvent} after any change to the shapes.
 * @fires shapes:modechange {@link ModeChangeEvent} when the mode changes.
 */
export class DrawLayer extends FeatureGroup {
  /** The mode flags, for script-tag users: `L.DrawLayer.Mode.CREATE`. */
  static readonly Mode: typeof Mode = Mode;

  declare options: ResolvedOptions;

  /** Freehand drawing (`Mode.CREATE`), as a Leaflet handler. */
  declare drawing: Handler;
  /** Dragging vertices (`Mode.EDIT`), as a Leaflet handler. */
  declare editing: Handler;
  /** Deleting shapes with a click (`Mode.DELETE`), as a Leaflet handler. */
  declare deleting: Handler;
  /** Adding vertices with a click (`Mode.APPEND`), as a Leaflet handler. */
  declare appending: Handler;

  // State is set up in `initialize()` rather than in field initialisers, which
  // `DrawLayer.extend()` subclasses would skip.
  declare private _context: DrawContext;
  declare private _freehand: FreehandHandle | null;
  declare private _vertexDragging: VertexDraggingHandle | null;
  declare private _queue: QueuedPolygon[];
  declare private _batchDepth: number;
  declare private _changed: boolean;
  declare private _deferredEdits: Set<Polygon>;

  constructor(options?: DrawLayerOptions) {
    // Leaflet's class constructor passes its arguments on to `initialize()`.
    super(options as unknown as Layer[]);
  }

  /** Called by Leaflet's constructor, also for `DrawLayer.extend()` subclasses. */
  initialize(options?: DrawLayerOptions): void {
    internals(LayerGroup.prototype).initialize.call(this, [], options);
    this.options.style = mergeStyle(defaultStyle, this.options.style);

    this._context = {
      layer: this,
      map: null,
      vertexLayer: new LayerGroup(),
      vertices: new WeakMap(),
      style: resolveStyle(this.options.style),
      draggingVertex: false,
      commit: (type, change, defer) => this._commit(type, change, defer),
    };
    this._freehand = null;
    this._vertexDragging = null;
    this._queue = [];
    this._batchDepth = 0;
    this._changed = false;
    this._deferredEdits = new Set();

    this.drawing = new ModeHandler(this, Mode.CREATE);
    this.editing = new ModeHandler(this, Mode.EDIT);
    this.deleting = new ModeHandler(this, Mode.DELETE);
    this.appending = new ModeHandler(this, Mode.APPEND);
  }

  /** Runs `DrawLayer.addInitHook()` hooks, which Leaflet would otherwise skip. */
  callInitHooks(): void {
    if (internals(this)._initHooksCalled) return;
    internals(FeatureGroup.prototype).callInitHooks.call(this);
    for (const hook of internals(DrawLayer.prototype)._initHooks) {
      hook.call(this);
    }
  }

  override onAdd(map: Map): this {
    super.onAdd(map);

    const context = this._context;
    context.map = map;
    this._freehand = enableFreehand(context, map, (latLngs) => {
      this._onStroke(latLngs);
    });
    // Before `_applyMode()`, which adds the handles to the pane this creates.
    this._vertexDragging = enableVertexDragging(context, map);
    this._applyMode();

    const queue = this._queue.splice(0);
    if (queue.length) {
      this._batch(() => {
        for (const { latLngs, options } of queue) {
          createPolygons(context, map, latLngs, options);
        }
      });
    }
    return this;
  }

  /** Takes the shapes off the map but keeps them, like any `FeatureGroup`. */
  override onRemove(map: Map): this {
    // Finishing a drag in progress may queue an edit to flush.
    this._vertexDragging?.dispose();
    this._vertexDragging = null;
    this._flushEdits();
    this._freehand?.dispose();
    this._freehand = null;

    const context = this._context;
    context.vertexLayer.remove();
    map
      .getContainer()
      .classList.remove(
        classNames.noMode,
        crosshairClassName,
        ...modeClassNames.map(([, name]) => name),
      );
    if (hasMode(this.getMode(), Mode.CREATE)) setDragging(map, true);
    context.map = null;

    return super.onRemove(map);
  }

  /**
   * Adds a layer. Polygons become editable shapes, keeping their own style.
   * Fires `shapes:change` for polygons.
   */
  override addLayer(layer: Layer): this {
    if (this.hasLayer(layer)) return this;
    return this._batch(() => {
      if (layer instanceof Polygon) {
        attachPolygon(this._context, layer);
        this._changed = true;
      }
      return super.addLayer(layer);
    });
  }

  /** Removes a layer, and a polygon's vertex handles. Fires `shapes:change` for polygons. */
  override removeLayer(layer: number | Layer): this {
    const target = typeof layer === 'number' ? this.getLayer(layer) : layer;
    if (!target || !this.hasLayer(target)) return this;
    return this._batch(() => {
      super.removeLayer(target);
      if (target instanceof Polygon) {
        detachPolygon(this._context, target);
        this._changed = true;
      }
      return this;
    });
  }

  /** Removes every layer. Fires a single `shapes:change`. */
  override clearLayers(): this {
    return this._batch(() => super.clearLayers());
  }

  /**
   * Adds a shape the way a freehand stroke would: self-intersections are
   * split, overlapping polygons merge and `maxPolygons` applies. The concave
   * hull is skipped by default, since the vertices are given exactly.
   *
   * Before the layer is on a map, the shape is queued and added when it is.
   *
   * @returns The polygons that now contain the shape, or `[]` while queued.
   */
  addPolygon(
    latLngs: readonly LatLngExpression[],
    options?: AddPolygonOptions,
  ): Polygon[] {
    const settings = Object.assign(
      Object.create(this.options) as ResolvedOptions,
      { concaveHull: false },
      defined(options),
    );
    const points = latLngs.map((point) => latLng(point));
    const { map } = this._context;
    if (!map) {
      this._queue.push({ latLngs: points, options: settings });
      return [];
    }
    return this._batch(() =>
      createPolygons(this._context, map, points, settings),
    );
  }

  /**
   * Adds the polygons in a GeoJSON object exactly as given, up to
   * `maxPolygons`. Only outer rings are used; holes and other geometry types
   * are skipped. Works before the layer is on a map.
   */
  addData(geojson: GeoJSON.GeoJSON | readonly GeoJSON.GeoJSON[]): this {
    return this._batch(() => {
      for (const ring of outerRingsOf(geojson)) {
        if (polygonsOf(this).length >= this.options.maxPolygons) break;
        this.addLayer(newPolygon(this._context, ring));
      }
      return this;
    });
  }

  /** The current mode, a combination of {@link Mode} flags. */
  getMode(): Mode {
    return this.options.mode;
  }

  /** Sets the mode, a combination of {@link Mode} flags. */
  setMode(mode: Mode): this {
    if (mode === this.options.mode) return this;
    this.options.mode = mode;
    this._applyMode();
    this._emit('shapes:modechange', { mode });
    this._flushEdits();
    return this;
  }

  /** The current style. */
  getStyle(): DrawLayerStyle {
    return this.options.style;
  }

  /**
   * Merges `style` into the current style. Shapes and vertex handles update
   * immediately, and new ones use it too.
   *
   * @example layer.setStyle({ color: 'tomato', vertex: { radius: 7 } });
   */
  override setStyle(style: DrawLayerStyle): this {
    const context = this._context;
    this.options.style = mergeStyle(this.options.style, style);
    context.style = resolveStyle(this.options.style);

    const { polygon, vertex } = context.style;
    for (const shape of polygonsOf(this)) {
      // Leaflet can't change the class of an existing path.
      shape.setStyle({ ...polygon, className: shape.options.className });
      for (const marker of context.vertices.get(shape) ?? []) {
        marker.setStyle(vertexAppearance(context.style, false));
        if (vertex.radius !== undefined) marker.setRadius(vertex.radius);
      }
    }
    return this;
  }

  /** Abandons the freehand stroke in progress, if any. */
  cancel(): this {
    this._freehand?.cancel();
    return this;
  }

  private _onStroke(latLngs: LatLng[]): void {
    const { map } = this._context;
    if (!map) return;

    this._commit('shapes:create', () =>
      createPolygons(this._context, map, latLngs, this.options),
    );
    if (this.options.leaveModeAfterCreate) {
      this.setMode(this.getMode() & ~Mode.CREATE);
    }
  }

  private _applyMode(): void {
    const context = this._context;
    const { map } = context;
    if (!map) return;

    const mode = this.getMode();
    // Panning and freehand drawing share the same gesture.
    setDragging(map, !hasMode(mode, Mode.CREATE));
    syncVertexVisibility(context, map, mode);

    const { classList } = map.getContainer();
    // Leaflet's own stylesheet turns this class into a crosshair cursor.
    classList.toggle(crosshairClassName, hasMode(mode, Mode.CREATE));
    for (const [flag, className] of modeClassNames) {
      classList.toggle(className, hasMode(mode, flag));
    }
    classList.toggle(classNames.noMode, mode === Mode.NONE);
  }

  /** Runs `change`, then fires one `shapes:change` if polygons were added or removed. */
  private _batch<T>(change: () => T): T {
    this._batchDepth++;
    try {
      return change();
    } finally {
      this._batchDepth--;
      if (!this._batchDepth && this._changed) {
        this._changed = false;
        this._emit('shapes:change', { layers: polygonsOf(this) });
      }
    }
  }

  private _commit(
    type: ActionEventType,
    change: () => Polygon[],
    defer = false,
  ): void {
    let layers: Polygon[];
    this._batchDepth++;
    try {
      layers = change();
    } finally {
      this._batchDepth--;
    }

    const changed = this._changed || layers.length > 0;
    this._changed = false;
    if (!changed) return;

    if (defer) {
      layers.forEach((layer) => this._deferredEdits.add(layer));
    } else {
      this._notify(type, layers);
    }
  }

  private _flushEdits(): void {
    const layers = [...this._deferredEdits].filter((layer) =>
      this.hasLayer(layer),
    );
    this._deferredEdits.clear();
    if (layers.length) this._notify('shapes:edit', layers);
  }

  private _notify(type: ActionEventType, layers: Polygon[]): void {
    this._emit(type, { layers });
    this._emit('shapes:change', { layers: polygonsOf(this) });
  }

  /** Fires on the layer, and on the map with the layer as `sourceTarget`. */
  private _emit<K extends keyof DrawLayerEventMap>(
    type: K,
    data: Omit<DrawLayerEventMap[K], keyof LeafletEvent>,
  ): void {
    this.fire(type, data);
    this._context.map?.fire(type, { ...data, sourceTarget: this });
  }
}

// Leaflet keeps defaults and init hooks on the prototype (see `Class.extend()`).
// Giving DrawLayer its own means `DrawLayer.mergeOptions()` and
// `DrawLayer.addInitHook()` no longer leak into every FeatureGroup.
Object.assign(DrawLayer.prototype, {
  options: Object.assign(
    Object.create(FeatureGroup.prototype.options) as object,
    defaultOptions,
  ),
  _initHooks: [],
});

// `Class.extend()` copies only a class's own statics to the subclass, so copy
// the ones DrawLayer inherits (`extend`, `include`, `mergeOptions`, …) onto it.
for (const [key, value] of Object.entries(FeatureGroup as object) as [
  string,
  unknown,
][]) {
  if (key !== '__super__') Object.assign(DrawLayer, { [key]: value });
}

const crosshairClassName = 'leaflet-crosshair';

function setDragging(map: Map, enabled: boolean): void {
  if (!enabled) map.dragging.disable();
  else if (map.options.dragging !== false) map.dragging.enable();
}

/** Creates a {@link DrawLayer}. */
export function drawLayer(options?: DrawLayerOptions): DrawLayer {
  return new DrawLayer(options);
}
