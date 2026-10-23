import {
  FeatureGroup,
  LayerGroup,
  latLng,
  type LatLngExpression,
  type LeafletEventHandlerFn,
  type LeafletEventHandlerFnMap,
  type Map,
  type Polygon,
} from 'leaflet';
import { polygonsOf, notify, type DrawContext } from './context';
import type { DrawLayerEventMap } from './events';
import { enableFreehand, type FreehandHandle } from './freehand';
import {
  CREATE,
  hasMode,
  modeClassNames,
  noModeClassName,
  type Mode,
} from './modes';
import { defaultOptions, type DrawLayerOptions } from './options';
import { clearPolygons, createPolygons, removePolygon } from './polygons';
import { syncVertexState } from './vertices';

type Listener<K extends keyof DrawLayerEventMap> = (
  event: DrawLayerEventMap[K],
) => void;

// Adds typed overloads for the layer's own events to Leaflet's `on`/`once`/`off`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DrawLayer {
  on<K extends keyof DrawLayerEventMap>(
    type: K,
    fn: Listener<K>,
    context?: unknown,
  ): this;
  on(type: string, fn: LeafletEventHandlerFn, context?: unknown): this;
  on(eventMap: LeafletEventHandlerFnMap): this;

  once<K extends keyof DrawLayerEventMap>(
    type: K,
    fn: Listener<K>,
    context?: unknown,
  ): this;
  once(type: string, fn: LeafletEventHandlerFn, context?: unknown): this;
  once(eventMap: LeafletEventHandlerFnMap): this;

  off<K extends keyof DrawLayerEventMap>(
    type: K,
    fn?: Listener<K>,
    context?: unknown,
  ): this;
  off(type?: string, fn?: LeafletEventHandlerFn, context?: unknown): this;
  off(eventMap: LeafletEventHandlerFnMap): this;
}

/**
 * A Leaflet layer for drawing freehand polygons with mouse or touch.
 *
 * Drawn polygons are children of this `FeatureGroup`, so `getLayers()`,
 * `getBounds()` and `toGeoJSON()` work as usual.
 *
 * @fires markers {@link MarkersEvent} whenever polygons change.
 * @fires mode {@link ModeEvent} whenever the mode changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DrawLayer extends FeatureGroup {
  declare options: DrawLayerOptions;

  #mode: Mode;
  #context: DrawContext | null = null;
  #freehand: FreehandHandle | null = null;

  constructor(options: Partial<DrawLayerOptions> = {}) {
    super();
    this.options = { ...defaultOptions, ...options };
    this.#mode = this.options.mode;
  }

  override onAdd(map: Map): this {
    super.onAdd(map);

    const context: DrawContext = {
      map,
      layer: this,
      vertexLayer: new LayerGroup().addTo(map),
      vertices: new WeakMap(),
      deferredNotify: null,
    };
    this.#context = context;
    this.#freehand = enableFreehand(context, (latLngs) => {
      createPolygons(context, latLngs, this.options);
      notify(context, 'create');
      if (this.options.leaveModeAfterCreate) {
        this.mode(this.#mode & ~CREATE);
      }
    });
    this.#applyMode(this.#mode);

    return this;
  }

  override onRemove(map: Map): this {
    const context = this.#context;
    if (context) {
      this.#freehand?.dispose();
      clearPolygons(context);
      context.vertexLayer.remove();
      map
        .getContainer()
        .classList.remove(
          noModeClassName,
          ...modeClassNames.map(([, name]) => name),
        );
      if (hasMode(this.#mode, CREATE)) this.#setDragging(map, true);
    }

    this.#freehand = null;
    this.#context = null;
    super.onRemove(map);
    return this;
  }

  /**
   * Adds a polygon programmatically. The concave hull is skipped by default
   * since the vertices are given exactly.
   *
   * @returns The resulting polygons, or `[]` when the layer is not on a map.
   */
  create(
    latLngs: readonly LatLngExpression[],
    options: Partial<DrawLayerOptions> = { concavePolygon: false },
  ): Polygon[] {
    const context = this.#context;
    if (!context) return [];

    const created = createPolygons(
      context,
      latLngs.map((point) => latLng(point)),
      { ...this.options, ...options },
    );
    notify(context, 'create');
    return created;
  }

  /** Removes a single polygon and its vertices. */
  removePolygon(polygon: Polygon): void {
    const context = this.#context;
    if (!context) return;

    removePolygon(context, polygon);
    notify(context, 'remove');
  }

  /** Removes every polygon. */
  clear(): void {
    const context = this.#context;
    if (!context) return;

    clearPolygons(context);
    notify(context, 'clear');
  }

  /** Returns the current mode, setting it first when `mode` is given. */
  mode(mode?: Mode | null): Mode {
    if (typeof mode === 'number') {
      this.#mode = mode;
      this.#applyMode(mode);
    }
    return this.#mode;
  }

  /** The number of polygons on the layer. */
  size(): number {
    return this.all().length;
  }

  /** Every polygon on the layer, in creation order. */
  all(): Polygon[] {
    return this.#context ? polygonsOf(this.#context) : [];
  }

  /** Abandons the freehand stroke in progress, if any. */
  cancel(): void {
    this.#freehand?.cancel();
  }

  #applyMode(mode: Mode): void {
    const context = this.#context;
    if (!context) return;

    const { map } = context;
    this.fire('mode', { mode });

    // Panning and freehand drawing share the same gesture.
    this.#setDragging(map, !hasMode(mode, CREATE));
    syncVertexState(context, mode);

    const { classList } = map.getContainer();
    for (const [flag, className] of modeClassNames) {
      classList.toggle(className, hasMode(mode, flag));
    }
    classList.toggle(noModeClassName, mode === 0);

    if (this.options.notifyAfterEditExit) context.deferredNotify?.();
    context.deferredNotify = null;
  }

  #setDragging(map: Map, enabled: boolean): void {
    if (!enabled) map.dragging.disable();
    else if (map.options.dragging !== false) map.dragging.enable();
  }
}

/** Creates a {@link DrawLayer}. */
export function drawLayer(options?: Partial<DrawLayerOptions>): DrawLayer {
  return new DrawLayer(options);
}
