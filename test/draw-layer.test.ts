import { Marker, Point, Polygon, type LatLng } from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import DefaultExport, {
  ALL,
  APPEND,
  CREATE,
  DELETE,
  DrawLayer,
  EDIT,
  NONE,
  defaultOptions,
  drawLayer,
  type ModeEvent,
} from '../src';
import {
  circlePoints,
  setup,
  square,
  strokeWithMouse,
  strokeWithTouch,
} from './helpers';

const vertexMarkers = (layer: DrawLayer): Marker[] => {
  const markers: Marker[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reach the map's layers
  layer['_map'].eachLayer((l: any) => {
    if (l instanceof Marker) markers.push(l);
  });
  return markers;
};

describe('DrawLayer', () => {
  describe('construction', () => {
    it('merges options with the defaults', () => {
      const layer = new DrawLayer({ maximumPolygons: 2 });
      expect(layer.options).toMatchObject({
        ...defaultOptions,
        maximumPolygons: 2,
      });
    });

    it('exposes a factory and a default export', () => {
      expect(drawLayer()).toBeInstanceOf(DrawLayer);
      expect(DefaultExport).toBe(DrawLayer);
    });

    it('is a no-op before being added to a map', () => {
      const layer = new DrawLayer();
      expect(
        layer.create([
          [0, 0],
          [1, 1],
          [0, 1],
        ]),
      ).toEqual([]);
      expect(layer.size()).toBe(0);
      expect(layer.all()).toEqual([]);
      expect(() => {
        layer.clear();
        layer.cancel();
      }).not.toThrow();
    });
  });

  describe('create()', () => {
    it('adds a polygon and fires a closed ring', () => {
      const { map, layer, events } = setup();
      const created = layer.create(square(map, 400, 300));

      expect(created).toHaveLength(1);
      expect(created[0]).toBeInstanceOf(Polygon);
      expect(layer.size()).toBe(1);
      expect(layer.all()).toEqual(created);

      expect(events).toHaveLength(1);
      const [event] = events;
      expect(event!.eventType).toBe('create');
      const ring = event!.latLngs[0]!;
      expect(ring).toHaveLength(5);
      expect(ring[0]).toBe(ring.at(-1));
    });

    it('accepts [lat, lng] tuples', () => {
      const { map, layer } = setup();
      const tuples = square(map, 400, 300).map(
        ({ lat, lng }) => [lat, lng] as [number, number],
      );
      expect(layer.create(tuples)).toHaveLength(1);
    });

    it('applies Leaflet path options to the polygon', () => {
      const { map, layer } = setup({ color: 'red', className: 'mine' });
      const [polygon] = layer.create(square(map, 400, 300));

      expect(polygon!.options.color).toBe('red');
      expect(polygon!.getElement()?.getAttribute('class')).toContain(
        'leaflet-polygon mine',
      );
    });

    it('makes polygons available through the FeatureGroup API', () => {
      const { map, layer } = setup();
      layer.create(square(map, 400, 300));

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

      expect(layer.create(bowtie)).toHaveLength(2);
    });

    it('merges overlapping polygons', () => {
      const { map, layer } = setup();
      const [first] = layer.create(square(map, 300, 300));
      const merged = layer.create(square(map, 350, 300));

      expect(layer.size()).toBe(1);
      expect(merged).toHaveLength(1);
      expect(layer.all()).toEqual(merged);
      expect(layer.hasLayer(first!)).toBe(false);
    });

    it('returns the new polygon when it does not overlap anything', () => {
      const { map, layer } = setup();
      layer.create(square(map, 200, 300));
      const created = layer.create(square(map, 600, 300));

      expect(layer.size()).toBe(2);
      expect(created).toHaveLength(1);
    });

    it('keeps overlapping polygons apart when merging is disabled', () => {
      const { map, layer } = setup({ mergePolygons: false });
      layer.create(square(map, 300, 300));
      layer.create(square(map, 350, 300));
      expect(layer.size()).toBe(2);
    });

    it('respects maximumPolygons', () => {
      const { map, layer } = setup({ maximumPolygons: 2 });
      layer.create(square(map, 100, 100));
      layer.create(square(map, 300, 100));
      expect(layer.create(square(map, 500, 100))).toEqual([]);
      expect(layer.size()).toBe(2);
    });

    it('respects maximumPolygons when a shape splits into several', () => {
      const { map, layer } = setup({ maximumPolygons: 1 });
      const bowtie = [
        [300, 200],
        [500, 400],
        [500, 200],
        [300, 400],
      ].map(([x, y]) => map.containerPointToLatLng(new Point(x!, y!)));

      expect(layer.create(bowtie)).toHaveLength(1);
      expect(layer.size()).toBe(1);
    });

    it('adds a vertex marker per polygon corner', () => {
      const { map, layer } = setup();
      layer.create(square(map, 400, 300));
      expect(vertexMarkers(layer)).toHaveLength(4);
    });
  });

  describe('removePolygon() and clear()', () => {
    it('removes a polygon with its vertices', () => {
      const { map, layer, events } = setup();
      const [polygon] = layer.create(square(map, 400, 300));
      layer.removePolygon(polygon!);

      expect(layer.size()).toBe(0);
      expect(vertexMarkers(layer)).toHaveLength(0);
      expect(events.at(-1)?.eventType).toBe('remove');
    });

    it('clears every polygon', () => {
      const { map, layer, events } = setup();
      layer.create(square(map, 200, 300));
      layer.create(square(map, 600, 300));
      layer.clear();

      expect(layer.size()).toBe(0);
      expect(vertexMarkers(layer)).toHaveLength(0);
      expect(events.at(-1)).toMatchObject({ eventType: 'clear', latLngs: [] });
    });
  });

  describe('modes', () => {
    it('defaults to ALL', () => {
      expect(new DrawLayer().mode()).toBe(ALL);
    });

    it('can be set before the layer is added to a map', () => {
      const layer = new DrawLayer();
      expect(layer.mode(EDIT)).toBe(EDIT);
      expect(layer.mode()).toBe(EDIT);
    });

    it('fires a mode event', () => {
      const { layer } = setup();
      const listener = vi.fn<(event: ModeEvent) => void>();
      layer.on('mode', listener);
      layer.mode(DELETE);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ mode: DELETE }),
      );
    });

    it('reflects the mode in container classes', () => {
      const { map, layer } = setup({ mode: CREATE | DELETE });
      const { classList } = map.getContainer();
      expect(classList.contains('mode-create')).toBe(true);
      expect(classList.contains('mode-delete')).toBe(true);
      expect(classList.contains('mode-edit')).toBe(false);

      layer.mode(NONE);
      expect(classList.contains('mode-create')).toBe(false);
      expect(classList.contains('mode-none')).toBe(true);
    });

    it('disables map dragging in CREATE mode', () => {
      const { map, layer } = setup({ mode: CREATE });
      expect(map.dragging.enabled()).toBe(false);
      layer.mode(EDIT);
      expect(map.dragging.enabled()).toBe(true);
    });

    it('does not enable dragging on maps created without it', () => {
      const { map, layer } = setup({ mode: CREATE }, { dragging: false });
      layer.mode(EDIT);
      expect(map.dragging.enabled()).toBe(false);
    });

    it('disables vertices outside EDIT mode', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.create(square(map, 400, 300));
      const isDisabled = () =>
        vertexMarkers(layer).map((marker) =>
          marker.getElement()?.classList.contains('disabled'),
        );

      expect(isDisabled()).toEqual([false, false, false, false]);
      layer.mode(CREATE);
      expect(isDisabled()).toEqual([true, true, true, true]);
    });
  });

  describe('freehand drawing', () => {
    it('creates a polygon from a mouse stroke', () => {
      const { map, layer, events } = setup({ mode: CREATE });
      strokeWithMouse(map, circlePoints(400, 300, 100));

      expect(layer.size()).toBe(1);
      expect(events.at(-1)?.eventType).toBe('create');
    });

    it('creates a polygon from a touch stroke', () => {
      const { map, layer } = setup({ mode: CREATE });
      strokeWithTouch(map, circlePoints(400, 300, 100));
      expect(layer.size()).toBe(1);
    });

    it('draws the stroke on an SVG overlay and clears it afterwards', () => {
      const { map } = setup({ mode: CREATE, strokeWidth: 5 });
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
        'svg.leaflet-draw-shapes path.leaflet-line',
      );
      expect(path?.getAttribute('stroke-width')).toBe('5');
      expect(path?.getAttribute('d')).toMatch(/^M500 300L/);

      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(container.querySelector('path.leaflet-line')).toBeNull();
    });

    it('ignores strokes outside CREATE mode', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      strokeWithMouse(map, circlePoints(400, 300, 100));
      expect(layer.size()).toBe(0);
      expect(events).toHaveLength(0);
    });

    it('ignores clicks without movement', () => {
      const { map, layer, events } = setup({ mode: CREATE });
      strokeWithMouse(map, [new Point(400, 300)]);
      expect(layer.size()).toBe(0);
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
      expect(layer.size()).toBe(0);
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
      layer.cancel();
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(layer.size()).toBe(0);
      expect(container.querySelector('path.leaflet-line')).toBeNull();
    });

    it('leaves CREATE mode after a stroke when leaveModeAfterCreate is set', () => {
      const { map, layer } = setup({
        mode: CREATE | DELETE,
        leaveModeAfterCreate: true,
      });
      strokeWithMouse(map, circlePoints(400, 300, 100));
      expect(layer.mode()).toBe(DELETE);
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
      const [polygon] = layer.create(square(map, 400, 300));
      clickAt(polygon!, map, new Point(400, 300));

      expect(layer.size()).toBe(0);
      expect(events.at(-1)?.eventType).toBe('remove');
    });

    it('appends a vertex on the nearest edge in APPEND mode', () => {
      const { map, layer, events } = setup({ mode: APPEND });
      const [polygon] = layer.create(square(map, 400, 300));
      clickAt(polygon!, map, new Point(400, 252));

      const ring = polygon!.getLatLngs()[0] as LatLng[];
      expect(ring).toHaveLength(5);
      expect(vertexMarkers(layer)).toHaveLength(5);
      expect(events.at(-1)?.eventType).toBe('append');
    });

    it('with DELETE and APPEND, appends near an edge and deletes elsewhere', () => {
      const { map, layer, events } = setup({ mode: DELETE | APPEND });
      const [polygon] = layer.create(square(map, 400, 300));

      clickAt(polygon!, map, new Point(400, 255));
      expect(layer.size()).toBe(1);
      expect(events.at(-1)?.eventType).toBe('append');

      clickAt(polygon!, map, new Point(400, 300));
      expect(layer.size()).toBe(0);
      expect(events.at(-1)?.eventType).toBe('remove');
    });

    it('does nothing without DELETE or APPEND', () => {
      const { map, layer } = setup({ mode: EDIT });
      const [polygon] = layer.create(square(map, 400, 300));
      clickAt(polygon!, map, new Point(400, 300));
      expect(layer.size()).toBe(1);
    });
  });

  describe('editing vertices', () => {
    const drag = (layer: DrawLayer, marker: Marker, to: Point) => {
      const map = layer['_map'];
      marker.fire('mousedown');
      map.fire('mousemove', { latlng: map.containerPointToLatLng(to) });
      map.fire('mouseup');
    };

    it('moves a vertex and fires an edit event', () => {
      const { map, layer, events } = setup({ mode: EDIT });
      layer.create(square(map, 400, 300));
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));

      expect(layer.size()).toBe(1);
      const ring = (layer.all()[0]!.getLatLngs()[0] as LatLng[]).map((latLng) =>
        map.latLngToContainerPoint(latLng).round(),
      );
      expect(ring).toContainEqual(new Point(300, 200));
      expect(events.at(-1)?.eventType).toBe('edit');
    });

    it('stops tracking the mouse after the drag ends', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.create(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      drag(layer, marker, new Point(300, 200));

      const before = layer.all()[0]!.getLatLngs();
      map.fire('mousemove', {
        latlng: map.containerPointToLatLng(new Point(10, 10)),
      });
      expect(layer.all()[0]!.getLatLngs()).toEqual(before);
    });

    it('is ignored outside EDIT mode', () => {
      const { map, layer, events } = setup({ mode: DELETE });
      layer.create(square(map, 400, 300));
      const before = layer.all()[0]!.getLatLngs();
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));

      expect(layer.all()[0]!.getLatLngs()).toEqual(before);
      expect(events.at(-1)?.eventType).toBe('create');
    });

    it('defers the edit event until the mode changes with notifyAfterEditExit', () => {
      const { map, layer, events } = setup({
        mode: EDIT,
        notifyAfterEditExit: true,
      });
      layer.create(square(map, 400, 300));
      drag(layer, vertexMarkers(layer)[0]!, new Point(300, 200));
      expect(events.at(-1)?.eventType).toBe('create');

      layer.mode(NONE);
      expect(events.at(-1)?.eventType).toBe('edit');
    });

    it('re-enables map dragging after the drag unless in CREATE mode', () => {
      const { map, layer } = setup({ mode: EDIT });
      layer.create(square(map, 400, 300));
      const marker = vertexMarkers(layer)[0]!;
      marker.fire('mousedown');
      expect(map.dragging.enabled()).toBe(false);
      map.fire('mouseup');
      expect(map.dragging.enabled()).toBe(true);
    });

    it('does not start a freehand stroke when grabbing a vertex in CREATE | EDIT mode', () => {
      const { map, layer, events } = setup({ mode: CREATE | EDIT });
      layer.create(square(map, 400, 300));
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

      expect(container.querySelector('path.leaflet-line')).toBeNull();
      container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(events.map((event) => event.eventType)).toEqual([
        'create',
        'edit',
      ]);
    });
  });

  describe('removal from the map', () => {
    it('removes polygons, vertices, overlay and mode classes', () => {
      const { map, layer } = setup();
      layer.create(square(map, 400, 300));
      layer.remove();

      const container = map.getContainer();
      expect(container.querySelector('svg.leaflet-draw-shapes')).toBeNull();
      expect(container.querySelector('.leaflet-polygon')).toBeNull();
      expect(container.querySelector('.leaflet-edge')).toBeNull();
      expect(container.className).not.toMatch(/mode-/);
      expect(layer.size()).toBe(0);
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
      expect(layer.size()).toBe(1);
    });
  });

  it('supports independent layers on one map', () => {
    const { map, layer } = setup({ mode: CREATE });
    const other = new DrawLayer({ mode: NONE }).addTo(map);
    strokeWithMouse(map, circlePoints(400, 300, 100));

    expect(layer.size()).toBe(1);
    expect(other.size()).toBe(0);
  });
});
