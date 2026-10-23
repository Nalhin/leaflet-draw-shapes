import {
  CircleMarker,
  Control,
  FeatureGroup,
  Handler,
  Marker,
  Point,
  Polygon,
  type LatLng,
} from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import {
  DrawLayer,
  Mode,
  drawLayer,
  type ModeChangeEvent,
  type ShapesEvent,
} from '../src';
import {
  circlePoints,
  createMap,
  setup,
  square,
  strokeWithMouse,
  strokeWithTouch,
  types,
} from './helpers';

const { NONE, CREATE, EDIT, DELETE, APPEND, ALL } = Mode;

const vertexMarkers = (layer: DrawLayer): CircleMarker[] => {
  const markers: CircleMarker[] = [];
  layer['_map'].eachLayer((l) => {
    if (l instanceof CircleMarker) markers.push(l);
  });
  return markers;
};

const polygons = (layer: DrawLayer): Polygon[] =>
  layer.getLayers().filter((l): l is Polygon => l instanceof Polygon);

describe('DrawLayer', () => {
  describe('construction', () => {
    it('reads defaults from the prototype', () => {
      const layer = new DrawLayer({ maxPolygons: 2 });
      expect(layer.options).toMatchObject({
        mode: ALL,
        appendTolerance: 10,
        mergePolygons: true,
        concaveHull: true,
        maxPolygons: 2,
      });
      expect(Object.hasOwn(layer.options, 'appendTolerance')).toBe(false);
    });

    it('exposes a factory', () => {
      expect(drawLayer()).toBeInstanceOf(DrawLayer);
    });

    it('is safe to use before being added to a map', () => {
      const layer = new DrawLayer();
      expect(() => {
        layer.clearLayers();
        layer.cancel();
      }).not.toThrow();
    });
  });

  describe('Leaflet class conventions', () => {
    it('mergeOptions() changes the defaults of DrawLayer only', () => {
      const Sub = DrawLayer.extend({}) as typeof DrawLayer;
      Sub.mergeOptions({ appendTolerance: 99 });
      expect(new Sub().options.appendTolerance).toBe(99);
      expect(new DrawLayer().options.appendTolerance).toBe(10);
      expect('appendTolerance' in new FeatureGroup().options).toBe(false);
    });

    it('addInitHook() runs for DrawLayer only, after initialisation', () => {
      const Sub = DrawLayer.extend({}) as typeof DrawLayer;
      const hook = vi.fn(function (this: DrawLayer) {
        expect(this.getMode()).toBe(EDIT);
      });
      Sub.addInitHook(hook);

      new Sub({ mode: EDIT });
      new FeatureGroup();
      new DrawLayer();
      expect(hook).toHaveBeenCalledOnce();
    });

    it('supports Leaflet-style subclasses with extend()', () => {
      const Sub = DrawLayer.extend({
        greet() {
          return 'hi';
        },
      }) as new (
        ...args: ConstructorParameters<typeof DrawLayer>
      ) => DrawLayer & { greet(): string };
      const layer = new Sub({ mode: EDIT });
      const map = createMap();
      layer.addTo(map);

      expect(layer).toBeInstanceOf(DrawLayer);
      expect(layer.greet()).toBe('hi');
      expect(layer.getMode()).toBe(EDIT);
      expect(layer.addPolygon(square(map, 400, 300))).toHaveLength(1);
    });

    it('supports ES subclasses', () => {
      class Sub extends DrawLayer {}
      const map = createMap();
      const layer = new Sub({ mode: EDIT }).addTo(map);
      expect(layer.getMode()).toBe(EDIT);
      expect(layer.addPolygon(square(map, 400, 300))).toHaveLength(1);
    });
  });

  describe('style', () => {
    /** Starts and releases a stroke, reading an attribute of its SVG path. */
    const sketchAttribute = (map: DrawLayer['_map'], name: string) => {
      const container = map.getContainer();
      container.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 10,
          clientY: 10,
        }),
      );
      const value = container
        .querySelector('path.leaflet-draw-shapes-sketch')
        ?.getAttribute(name);
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return value;
    };

    it('works without any configuration or CSS', () => {
      const { map, layer } = setup({ mode: ALL });
      layer.addPolygon(square(map, 400, 300));

      expect(polygons(layer)[0]!.options).toMatchObject({
        color: '#3388ff',
        smoothFactor: 0.3,
      });
      expect(vertexMarkers(layer)[0]!.options).toMatchObject({
        color: '#3388ff',
        fillColor: '#fff',
        radius: 5,
      });
      expect(document.querySelectorAll('style, link')).toHaveLength(0);
    });

    it('themes polygons, vertices and the sketch with one colour', () => {
      const { map, layer } = setup({ style: { color: 'tomato' } });
      layer.addPolygon(square(map, 400, 300));

      expect(polygons(layer)[0]!.options.color).toBe('tomato');
      expect(vertexMarkers(layer)[0]!.options.color).toBe('tomato');
      expect(sketchAttribute(map, 'stroke')).toBe('tomato');
    });

    it('takes polygon path options at the top level, and per-part overrides', () => {
      const { map, layer } = setup({
        style: {
          color: 'tomato',
          fillOpacity: 0.5,
          smoothFactor: 1,
          className: 'mine',
          vertex: { color: 'navy', radius: 8 },
          sketch: { color: 'lime', width: 4, dashArray: '4 4' },
        },
      });
      const [polygon] = layer.addPolygon(square(map, 400, 300));

      expect(polygon!.options).toMatchObject({
        color: 'tomato',
        fillOpacity: 0.5,
        smoothFactor: 1,
      });
      expect(polygon!.getElement()?.getAttribute('class')).toContain(
        'leaflet-draw-shapes-polygon mine',
      );
      expect(vertexMarkers(layer)[0]!.options).toMatchObject({
        color: 'navy',
        radius: 8,
      });
      expect(sketchAttribute(map, 'stroke')).toBe('lime');
      expect(sketchAttribute(map, 'stroke-width')).toBe('4');
      expect(sketchAttribute(map, 'stroke-dasharray')).toBe('4 4');
    });

    it('setStyle() updates existing and new polygons and vertices', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 200, 300));
      expect(layer.setStyle({ color: 'gold', vertex: { radius: 9 } })).toBe(
        layer,
      );
      layer.addPolygon(square(map, 600, 300));

      for (const polygon of polygons(layer)) {
        expect(polygon.options.color).toBe('gold');
      }
      for (const marker of vertexMarkers(layer)) {
        expect(marker.getRadius()).toBe(9);
        expect(marker.options.color).toBe('gold');
      }
      expect(layer.getStyle().color).toBe('gold');
      // Earlier settings are kept.
      expect(layer.getStyle().vertex?.fillColor).toBe('#fff');
    });

    it('setStyle() keeps the polygon class', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 400, 300));
      layer.setStyle({ className: 'other' });
      layer.remove().addTo(map);

      expect(
        map.getContainer().querySelector('.leaflet-draw-shapes-polygon'),
      ).not.toBeNull();
    });

    it('keeps vertex handles invisible until hovered or dragged', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      const visible = () => marker.options.opacity !== 0;

      expect(vertexMarkers(layer)).toHaveLength(4);
      expect(visible()).toBe(false);
      expect(marker.options.fillOpacity).toBe(0);

      marker.fire('mouseover');
      expect(visible()).toBe(true);
      expect(marker.options.fillOpacity).toBe(1);

      marker.fire('mouseout');
      expect(visible()).toBe(false);

      // Stays visible while dragged, even when the pointer outruns it.
      marker.fire('mouseover');
      marker.fire('mousedown');
      marker.fire('mouseout');
      expect(visible()).toBe(true);
    });

    it("shows vertex handles permanently with showVertices: 'always'", () => {
      const { map, layer } = setup({
        mode: EDIT,
        style: { showVertices: 'always' },
      });
      layer.addPolygon(square(map, 400, 300));
      expect(vertexMarkers(layer)[0]!.options).toMatchObject({
        opacity: 1,
        fillOpacity: 1,
      });
    });

    it('setStyle() keeps hidden handles hidden', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      layer.setStyle({ color: 'gold' });
      expect(vertexMarkers(layer)[0]!.options).toMatchObject({
        color: 'gold',
        opacity: 0,
      });
    });

    it('ignores undefined values instead of clearing defaults', () => {
      const layer = new DrawLayer({ style: { sketch: { width: undefined } } });
      expect(layer.getStyle().sketch?.width).toBe(2);
    });
  });

  describe('addPolygon()', () => {
    it('adds a polygon and fires shapes:change', () => {
      const { map, layer, events } = setup();
      const created = layer.addPolygon(square(map, 400, 300));

      expect(created).toHaveLength(1);
      expect(created[0]).toBeInstanceOf(Polygon);
      expect(layer.getLayers()).toEqual(created);
      expect(types(events)).toEqual(['shapes:change']);
      expect(events[0]!.layers).toEqual(created);
    });

    it('accepts [lat, lng] tuples', () => {
      const { map, layer } = setup();
      const tuples = square(map, 400, 300).map(
        ({ lat, lng }) => [lat, lng] as [number, number],
      );
      expect(layer.addPolygon(tuples)).toHaveLength(1);
    });

    it('makes polygons available through the FeatureGroup API', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 400, 300));

      const geoJSON = layer.toGeoJSON() as GeoJSON.FeatureCollection;
      expect(geoJSON.features).toHaveLength(1);
      expect(geoJSON.features[0]!.geometry.type).toBe('Polygon');
      expect(layer.getBounds().isValid()).toBe(true);
    });

    it('splits self-intersecting shapes into several polygons', () => {
      const { map, layer } = setup();
      const bowtie = [
        [300, 200],
        [500, 400],
        [500, 200],
        [300, 400],
      ].map(([x, y]) => map.containerPointToLatLng(new Point(x!, y!)));

      expect(layer.addPolygon(bowtie)).toHaveLength(2);
    });

    it('merges overlapping polygons', () => {
      const { map, layer } = setup();
      const [first] = layer.addPolygon(square(map, 300, 300));
      const merged = layer.addPolygon(square(map, 350, 300));

      expect(merged).toHaveLength(1);
      expect(layer.getLayers()).toEqual(merged);
      expect(layer.hasLayer(first!)).toBe(false);
    });

    it('fires one shapes:change for a merge', () => {
      const { map, layer, events } = setup();
      layer.addPolygon(square(map, 300, 300));
      layer.addPolygon(square(map, 350, 300));
      expect(types(events)).toEqual(['shapes:change', 'shapes:change']);
      expect(events[1]!.layers).toHaveLength(1);
    });

    it('returns the new polygon when it does not overlap anything', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 200, 300));
      const created = layer.addPolygon(square(map, 600, 300));

      expect(layer.getLayers()).toHaveLength(2);
      expect(created).toHaveLength(1);
    });

    it('keeps overlapping polygons apart when merging is disabled', () => {
      const { map, layer } = setup({ mergePolygons: false });
      layer.addPolygon(square(map, 300, 300));
      layer.addPolygon(square(map, 350, 300));
      expect(layer.getLayers()).toHaveLength(2);
    });

    it('takes per-call options without losing the concave hull default', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 300, 300));
      layer.addPolygon(square(map, 350, 300), { mergePolygons: false });
      expect(layer.getLayers()).toHaveLength(2);

      // The concave hull would turn this L shape into something else.
      const lShape = [
        [100, 100],
        [300, 100],
        [300, 150],
        [150, 150],
        [150, 300],
        [100, 300],
      ].map(([x, y]) => map.containerPointToLatLng(new Point(x!, y!)));
      const [polygon] = layer.addPolygon(lShape, { maxPolygons: 10 });
      expect(polygon!.getLatLngs()[0]).toHaveLength(6);
    });

    it('respects maxPolygons', () => {
      const { map, layer } = setup({ maxPolygons: 2 });
      layer.addPolygon(square(map, 100, 100));
      layer.addPolygon(square(map, 300, 100));
      expect(layer.addPolygon(square(map, 500, 100))).toEqual([]);
      expect(layer.getLayers()).toHaveLength(2);
    });

    it('respects maxPolygons when a shape splits into several', () => {
      const { map, layer } = setup({ maxPolygons: 1 });
      const bowtie = [
        [300, 200],
        [500, 400],
        [500, 200],
        [300, 400],
      ].map(([x, y]) => map.containerPointToLatLng(new Point(x!, y!)));

      expect(layer.addPolygon(bowtie)).toHaveLength(1);
      expect(layer.getLayers()).toHaveLength(1);
    });

    it('adds a vertex marker per polygon corner', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 400, 300));
      expect(vertexMarkers(layer)).toHaveLength(4);
    });

    it('queues shapes added before the layer is on a map', () => {
      const map = createMap();
      const layer = new DrawLayer();
      const listener = vi.fn<(event: ShapesEvent) => void>();
      layer.on('shapes:change', listener);

      expect(layer.addPolygon(square(map, 300, 300))).toEqual([]);
      layer.addPolygon(square(map, 350, 300));
      expect(layer.getLayers()).toHaveLength(0);

      layer.addTo(map);
      expect(layer.getLayers()).toHaveLength(1);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('addData()', () => {
    const feature = (
      coordinates: number[][][],
    ): GeoJSON.Feature<GeoJSON.Polygon> => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates },
    });
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];

    it('adds polygons exactly as given, before the layer is on a map', () => {
      const layer = new DrawLayer();
      layer.addData({
        type: 'FeatureCollection',
        features: [
          feature([ring]),
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiPolygon',
              coordinates: [[ring], [ring.map(([x, y]) => [x! + 5, y!])]],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      });

      expect(layer.getLayers()).toHaveLength(3);
      const [first] = polygons(layer);
      expect(first!.getLatLngs()[0]).toHaveLength(3);
      expect(layer.toGeoJSON()).toMatchObject({
        features: [{ geometry: { coordinates: [ring] } }, {}, {}],
      });
    });

    it('ignores holes', () => {
      const layer = new DrawLayer().addData(
        feature([ring, ring.map(([x, y]) => [x! / 2, y! / 2])]),
      );
      expect(polygons(layer)[0]!.getLatLngs()).toHaveLength(1);
    });

    it('makes the polygons editable once on a map', () => {
      const map = createMap();
      const layer = new DrawLayer({ mode: EDIT }).addData(feature([ring]));
      layer.addTo(map);
      expect(vertexMarkers(layer)).toHaveLength(3);
    });

    it('respects maxPolygons and fires one shapes:change', () => {
      const { layer, events } = setup({ maxPolygons: 1 });
      layer.addData([feature([ring]), feature([ring])]);
      expect(layer.getLayers()).toHaveLength(1);
      expect(types(events)).toEqual(['shapes:change']);
    });
  });

  describe('FeatureGroup methods', () => {
    it('removeLayer() removes a polygon with its vertices', () => {
      const { map, layer, events } = setup();
      const [polygon] = layer.addPolygon(square(map, 400, 300));
      layer.removeLayer(polygon!);

      expect(layer.getLayers()).toHaveLength(0);
      expect(vertexMarkers(layer)).toHaveLength(0);
      expect(events.at(-1)).toMatchObject({
        type: 'shapes:change',
        layers: [],
      });
    });

    it('removeLayer() accepts a layer id', () => {
      const { map, layer } = setup();
      const [polygon] = layer.addPolygon(square(map, 400, 300));
      layer.removeLayer(layer.getLayerId(polygon!));
      expect(vertexMarkers(layer)).toHaveLength(0);
    });

    it('clearLayers() removes every polygon and vertex with one event', () => {
      const { map, layer, events } = setup();
      layer.addPolygon(square(map, 200, 300));
      layer.addPolygon(square(map, 600, 300));
      events.length = 0;
      layer.clearLayers();

      expect(layer.getLayers()).toHaveLength(0);
      expect(vertexMarkers(layer)).toHaveLength(0);
      expect(events).toMatchObject([{ type: 'shapes:change', layers: [] }]);
    });

    it('addLayer() makes a polygon editable and keeps its style', () => {
      const { map, layer, events } = setup({ mode: EDIT | DELETE });
      const polygon = new Polygon(square(map, 400, 300), { color: 'red' });
      layer.addLayer(polygon);

      expect(vertexMarkers(layer)).toHaveLength(4);
      expect(polygon.options.color).toBe('red');
      expect(polygon.getElement()?.classList).toContain(
        'leaflet-draw-shapes-polygon',
      );
      expect(types(events)).toEqual(['shapes:change']);

      polygon.fire('click', {
        containerPoint: new Point(400, 300),
        latlng: map.containerPointToLatLng(new Point(400, 300)),
      });
      expect(layer.hasLayer(polygon)).toBe(false);
    });

    it('addLayer() leaves other layers alone', () => {
      const { map, layer, events } = setup();
      layer.addLayer(new Marker(map.getCenter()));
      expect(layer.getLayers()).toHaveLength(1);
      expect(events).toHaveLength(0);
    });
  });

  describe('modes', () => {
    it('defaults to ALL', () => {
      expect(new DrawLayer().getMode()).toBe(ALL);
    });

    it('can be set before the layer is added to a map', () => {
      const layer = new DrawLayer();
      expect(layer.setMode(EDIT)).toBe(layer);
      expect(layer.getMode()).toBe(EDIT);
      expect(layer.options.mode).toBe(EDIT);
    });

    it('fires shapes:modechange on the layer and the map', () => {
      const { map, layer } = setup();
      const onLayer = vi.fn<(event: ModeChangeEvent) => void>();
      const onMap = vi.fn<(event: ModeChangeEvent) => void>();
      layer.on('shapes:modechange', onLayer);
      map.on('shapes:modechange', onMap);

      layer.setMode(DELETE);
      layer.setMode(DELETE);
      expect(onLayer).toHaveBeenCalledOnce();
      expect(onLayer).toHaveBeenCalledWith(
        expect.objectContaining({ mode: DELETE, target: layer }),
      );
      expect(onMap).toHaveBeenCalledWith(
        expect.objectContaining({ mode: DELETE, sourceTarget: layer }),
      );
    });

    it('exposes each flag as a Leaflet handler', () => {
      const layer = new DrawLayer({ mode: NONE });
      expect(layer.editing).toBeInstanceOf(Handler);

      layer.editing.enable();
      layer.deleting.enable();
      expect(layer.getMode()).toBe(EDIT | DELETE);
      expect(layer.editing.enabled()).toBe(true);
      expect(layer.drawing.enabled()).toBe(false);

      layer.editing.disable();
      expect(layer.getMode()).toBe(DELETE);
      expect(layer.editing.enabled()).toBe(false);
      expect(layer.appending.enabled()).toBe(false);
    });

    it('reflects the mode in prefixed container classes', () => {
      const { map, layer } = setup({ mode: CREATE | DELETE });
      const { classList } = map.getContainer();
      expect(classList.contains('leaflet-draw-shapes-mode-create')).toBe(true);
      expect(classList.contains('leaflet-draw-shapes-mode-delete')).toBe(true);
      expect(classList.contains('leaflet-draw-shapes-mode-edit')).toBe(false);

      layer.setMode(NONE);
      expect(classList.contains('leaflet-draw-shapes-mode-create')).toBe(false);
      expect(classList.contains('leaflet-draw-shapes-mode-none')).toBe(true);
    });

    it('disables map dragging in CREATE mode', () => {
      const { map, layer } = setup({ mode: CREATE });
      expect(map.dragging.enabled()).toBe(false);
      layer.setMode(EDIT);
      expect(map.dragging.enabled()).toBe(true);
    });

    it('does not enable dragging on maps created without it', () => {
      const { map, layer } = setup({ mode: CREATE }, { dragging: false });
      layer.setMode(EDIT);
      expect(map.dragging.enabled()).toBe(false);
    });

    it('shows vertices only in EDIT mode', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      expect(vertexMarkers(layer)).toHaveLength(4);

      layer.setMode(CREATE);
      expect(vertexMarkers(layer)).toHaveLength(0);

      layer.setMode(EDIT);
      expect(vertexMarkers(layer)).toHaveLength(4);
    });

    it('uses a crosshair cursor in CREATE mode', () => {
      const { map, layer } = setup({ mode: CREATE });
      const { classList } = map.getContainer();
      expect(classList.contains('leaflet-crosshair')).toBe(true);
      layer.setMode(EDIT);
      expect(classList.contains('leaflet-crosshair')).toBe(false);
    });
  });

  describe('freehand drawing', () => {
    it('creates a polygon from a mouse stroke', () => {
      const { map, layer, events } = setup({ mode: CREATE });
      strokeWithMouse(map, circlePoints(400, 300, 100));

      expect(layer.getLayers()).toHaveLength(1);
      expect(types(events)).toEqual(['shapes:create', 'shapes:change']);
      expect(events[0]!.layers).toEqual(layer.getLayers());
    });

    it('fires shapes events on the map too', () => {
      const { map, layer } = setup({ mode: CREATE });
      const listener = vi.fn<(event: ShapesEvent) => void>();
      map.on('shapes:create', listener);
      strokeWithMouse(map, circlePoints(400, 300, 100));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          target: map,
          sourceTarget: layer,
          layers: layer.getLayers(),
        }),
      );
    });

    it('creates a polygon from a touch stroke', () => {
      const { map, layer } = setup({ mode: CREATE });
      strokeWithTouch(map, circlePoints(400, 300, 100));
      expect(layer.getLayers()).toHaveLength(1);
    });

    it('draws the sketch on an SVG overlay and clears it afterwards', () => {
      const { map } = setup({ mode: CREATE, style: { sketch: { width: 5 } } });
      const container = map.getContainer();
      const points = circlePoints(400, 300, 100);

      container.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 500,
          clientY: 300,
        }),
      );
      container.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: points[1]!.x,
          clientY: points[1]!.y,
        }),
      );
      const path = container.querySelector(
        'svg.leaflet-draw-shapes path.leaflet-draw-shapes-sketch',
      );
      expect(path?.getAttribute('stroke-width')).toBe('5');
      expect(path?.getAttribute('d')).toMatch(/^M500 300L/);

      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(
        container.querySelector('path.leaflet-draw-shapes-sketch'),
      ).toBeNull();
    });

    it('ignores strokes outside CREATE mode', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      strokeWithMouse(map, circlePoints(400, 300, 100));
      expect(layer.getLayers()).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    it('ignores clicks without movement', () => {
      const { map, layer, events } = setup({ mode: CREATE });
      strokeWithMouse(map, [new Point(400, 300)]);
      expect(layer.getLayers()).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    it('ignores non-primary mouse buttons', () => {
      const { map, layer } = setup({ mode: CREATE });
      const container = map.getContainer();
      container.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 2 }),
      );
      container.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 10,
          clientY: 10,
        }),
      );
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(layer.getLayers()).toHaveLength(0);
    });

    it('cancel() abandons the stroke in progress', () => {
      const { map, layer } = setup({ mode: CREATE });
      const container = map.getContainer();
      const [first, ...rest] = circlePoints(400, 300, 100);

      container.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: first!.x,
          clientY: first!.y,
        }),
      );
      rest.forEach(({ x, y }) =>
        container.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            clientX: x,
            clientY: y,
          }),
        ),
      );
      expect(layer.cancel()).toBe(layer);
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(layer.getLayers()).toHaveLength(0);
      expect(
        container.querySelector('path.leaflet-draw-shapes-sketch'),
      ).toBeNull();
    });

    it('leaves CREATE mode after a stroke when leaveModeAfterCreate is set', () => {
      const { map, layer } = setup({
        mode: CREATE | DELETE,
        leaveModeAfterCreate: true,
      });
      strokeWithMouse(map, circlePoints(400, 300, 100));
      expect(layer.getMode()).toBe(DELETE);
    });
  });

  describe('clicking polygons', () => {
    const clickAt = (
      polygon: Polygon,
      map: DrawLayer['_map'],
      point: Point,
    ) => {
      polygon.fire('click', {
        containerPoint: point,
        latlng: map.containerPointToLatLng(point),
      });
    };

    it('deletes in DELETE mode', () => {
      const { map, layer, events } = setup({ mode: DELETE });
      const [polygon] = layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      clickAt(polygon!, map, new Point(400, 300));

      expect(layer.getLayers()).toHaveLength(0);
      expect(events).toMatchObject([
        { type: 'shapes:remove', layers: [polygon] },
        { type: 'shapes:change', layers: [] },
      ]);
    });

    it('appends a vertex on the nearest edge in APPEND mode', () => {
      const { map, layer, events } = setup({ mode: EDIT | APPEND });
      const [polygon] = layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      clickAt(polygon!, map, new Point(400, 252));

      const ring = polygon!.getLatLngs()[0] as LatLng[];
      expect(ring).toHaveLength(5);
      expect(vertexMarkers(layer)).toHaveLength(5);
      expect(events).toMatchObject([
        { type: 'shapes:edit', layers: [polygon] },
        { type: 'shapes:change' },
      ]);
    });

    it('with DELETE and APPEND, appends near an edge and deletes elsewhere', () => {
      const { map, layer, events } = setup({ mode: DELETE | APPEND });
      const [polygon] = layer.addPolygon(square(map, 400, 300));

      clickAt(polygon!, map, new Point(400, 255));
      expect(layer.getLayers()).toHaveLength(1);
      expect(events.at(-2)?.type).toBe('shapes:edit');

      clickAt(polygon!, map, new Point(400, 300));
      expect(layer.getLayers()).toHaveLength(0);
      expect(events.at(-2)?.type).toBe('shapes:remove');
    });

    it('does nothing without DELETE or APPEND', () => {
      const { map, layer } = setup({ mode: EDIT });
      const [polygon] = layer.addPolygon(square(map, 400, 300));
      clickAt(polygon!, map, new Point(400, 300));
      expect(layer.getLayers()).toHaveLength(1);
    });
  });

  describe('editing vertices', () => {
    const drag = (layer: DrawLayer, marker: CircleMarker, to: Point) => {
      const map = layer['_map'];
      marker.fire('mousedown');
      map.fire('mousemove', { latlng: map.containerPointToLatLng(to) });
      map.fire('mouseup');
    };

    it('moves a vertex and fires shapes:edit', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));

      expect(layer.getLayers()).toHaveLength(1);
      const ring = (polygons(layer)[0]!.getLatLngs()[0] as LatLng[]).map(
        (latLng) => map.latLngToContainerPoint(latLng).round(),
      );
      expect(ring).toContainEqual(new Point(300, 200));
      expect(events).toMatchObject([
        { type: 'shapes:edit', layers: layer.getLayers() },
        { type: 'shapes:change' },
      ]);
    });

    it('stops tracking the mouse after the drag ends', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      drag(layer, marker, new Point(300, 200));

      const before = polygons(layer)[0]!.getLatLngs();
      map.fire('mousemove', {
        latlng: map.containerPointToLatLng(new Point(10, 10)),
      });
      expect(polygons(layer)[0]!.getLatLngs()).toEqual(before);
    });

    it('is ignored outside EDIT mode', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      layer.setMode(DELETE);
      const before = polygons(layer)[0]!.getLatLngs();
      events.length = 0;
      drag(layer, marker, new Point(300, 200));

      expect(polygons(layer)[0]!.getLatLngs()).toEqual(before);
      expect(events).toHaveLength(0);
    });

    it('defers the edit events until the mode changes with notifyAfterEditExit', () => {
      const { map, layer, events } = setup({
        mode: EDIT,
        notifyAfterEditExit: true,
      });
      layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));
      drag(layer, vertexMarkers(layer)[1]!, new Point(500, 200));
      expect(events).toHaveLength(0);

      layer.setMode(NONE);
      expect(events).toMatchObject([
        { type: 'shapes:edit', layers: layer.getLayers() },
        { type: 'shapes:change' },
      ]);
    });

    it('fires deferred edit events when the layer is removed', () => {
      const { map, layer, events } = setup({
        mode: EDIT,
        notifyAfterEditExit: true,
      });
      layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));
      layer.remove();
      expect(types(events)).toEqual(['shapes:edit', 'shapes:change']);
    });

    it('re-enables map dragging after the drag unless in CREATE mode', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      marker.fire('mousedown');
      expect(map.dragging.enabled()).toBe(false);
      map.fire('mouseup');
      expect(map.dragging.enabled()).toBe(true);
    });

    it('does not start a freehand stroke when grabbing a vertex in CREATE | EDIT mode', () => {
      const { map, layer, events } = setup({ mode: CREATE | EDIT });
      layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      const icon = vertexMarkers(layer)[0]!.getElement()!;

      const container = map.getContainer();
      icon.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 350,
          clientY: 250,
        }),
      );
      container.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 300,
          clientY: 200,
        }),
      );

      expect(
        container.querySelector('path.leaflet-draw-shapes-sketch'),
      ).toBeNull();
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(types(events)).toEqual(['shapes:edit', 'shapes:change']);
    });
  });

  describe('removal from the map', () => {
    it('takes polygons, vertices, overlay and mode classes off the map', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 400, 300));
      layer.remove();

      const container = map.getContainer();
      expect(container.querySelector('svg.leaflet-draw-shapes')).toBeNull();
      expect(
        container.querySelector('.leaflet-draw-shapes-polygon'),
      ).toBeNull();
      expect(container.querySelector('.leaflet-draw-shapes-vertex')).toBeNull();
      expect(container.className).not.toMatch(/leaflet-draw-shapes-mode/);
    });

    it('keeps its polygons, like any FeatureGroup', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      layer.addPolygon(square(map, 400, 300));
      events.length = 0;
      layer.remove();
      expect(layer.getLayers()).toHaveLength(1);
      expect(events).toHaveLength(0);

      layer.addTo(map);
      expect(
        map.getContainer().querySelectorAll('.leaflet-draw-shapes-polygon'),
      ).toHaveLength(1);
      expect(vertexMarkers(layer)).toHaveLength(4);
    });

    it('survives being toggled from a layers control', () => {
      const { map, layer } = setup();
      layer.addPolygon(square(map, 400, 300));
      new Control.Layers({}, { Shapes: layer }).addTo(map);

      map.removeLayer(layer);
      map.addLayer(layer);
      expect(layer.getLayers()).toHaveLength(1);
    });

    it('restores map dragging', () => {
      const { map, layer } = setup({ mode: CREATE });
      layer.remove();
      expect(map.dragging.enabled()).toBe(true);
    });

    it('stops listening for strokes', () => {
      const { map, layer, events } = setup({ mode: CREATE });
      layer.remove();
      strokeWithMouse(map, circlePoints(400, 300, 100));

      expect(events).toHaveLength(0);
      expect(layer.getLayers()).toHaveLength(0);
    });

    it('can be added again', () => {
      const { map, layer } = setup({ mode: CREATE });
      layer.remove();
      layer.addTo(map);
      strokeWithMouse(map, circlePoints(400, 300, 100));
      expect(layer.getLayers()).toHaveLength(1);
    });
  });

  it('supports independent layers on one map', () => {
    const { map, layer } = setup({ mode: CREATE });
    const other = new DrawLayer({ mode: NONE }).addTo(map);
    strokeWithMouse(map, circlePoints(400, 300, 100));

    expect(layer.getLayers()).toHaveLength(1);
    expect(other.getLayers()).toHaveLength(0);
  });
});
