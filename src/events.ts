import type { LatLng, LeafletEvent } from 'leaflet';
import type { Mode } from './modes';

/** What caused a `markers` event. */
export type MarkersEventType =
  'create' | 'edit' | 'append' | 'remove' | 'clear';

/** Fired whenever the set of polygons changes. */
export interface MarkersEvent extends LeafletEvent {
  /** Every polygon on the layer as a closed ring (first vertex repeated last). */
  latLngs: LatLng[][];
  eventType: MarkersEventType;
}

/** Fired whenever the interaction mode changes. */
export interface ModeEvent extends LeafletEvent {
  mode: Mode;
}

export interface DrawLayerEventMap {
  markers: MarkersEvent;
  mode: ModeEvent;
}
