import 'leaflet/dist/leaflet.css';
import './style.css';
import { map as createMap, tileLayer } from 'leaflet';
import {
  ALL,
  APPEND,
  CREATE,
  DELETE,
  EDIT,
  drawLayer,
  type DrawLayerOptions,
  type MarkersEventType,
} from 'leaflet-draw-shapes';

const map = createMap('map', { zoomControl: false }).setView(
  [52.2297, 21.0122],
  13,
);

tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const layer = drawLayer({
  mode: ALL,
  style: {
    color: '#6d5efc',
    polygon: { weight: 2, fillOpacity: 0.25 },
  },
}).addTo(map);

const $ = (selector: string): Element => document.querySelector(selector)!;
const modeButtons = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-mode]'),
];

function renderMode(mode: number): void {
  for (const button of modeButtons) {
    const flag = Number(button.dataset.mode);
    button.setAttribute('aria-pressed', String((mode & flag) === flag));
  }
}

function toggleMode(flag: number): void {
  layer.mode(layer.mode() ^ flag);
}

const icons: Record<MarkersEventType, string> = {
  create: '✏️',
  edit: '↔️',
  append: '➕',
  remove: '🗑️',
  clear: '🧹',
};

function log(eventType: MarkersEventType, count: number): void {
  const item = document.createElement('li');
  item.textContent = `${icons[eventType]} ${eventType} → ${count} shape${count === 1 ? '' : 's'}`;
  const list = $('#log');
  list.prepend(item);
  while (list.children.length > 6) list.lastElementChild?.remove();
}

layer.on('mode', ({ mode }) => renderMode(mode));
layer.on('markers', ({ latLngs, eventType }) => {
  $('#count').textContent = String(latLngs.length);
  log(eventType, latLngs.length);
});

modeButtons.forEach((button) =>
  button.addEventListener('click', () =>
    toggleMode(Number(button.dataset.mode)),
  ),
);

document.querySelectorAll<HTMLInputElement>('[data-option]').forEach((input) =>
  input.addEventListener('change', () => {
    const option = input.dataset.option as keyof DrawLayerOptions;
    Object.assign(layer.options, { [option]: input.checked });
  }),
);

$('#clear').addEventListener('click', () => layer.clear());

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(layer.toGeoJSON(), null, 2)], {
    type: 'application/geo+json',
  });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'shapes.geojson',
  });
  link.click();
  URL.revokeObjectURL(link.href);
});

const shortcuts = new Map([
  ['1', CREATE],
  ['2', EDIT],
  ['3', DELETE],
  ['4', APPEND],
]);

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'Escape') layer.cancel();
  const flag = shortcuts.get(event.key);
  if (flag) toggleMode(flag);
});

renderMode(layer.mode());
