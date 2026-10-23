import 'leaflet/dist/leaflet.css';
import './style.css';
import { map as createMap, tileLayer } from 'leaflet';
import { Mode, drawLayer, type DrawLayerOptions } from 'leaflet-draw-shapes';

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
  mode: Mode.ALL,
  style: { color: '#3388ff', weight: 2, fillOpacity: 0.2 },
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
  layer.setMode(layer.getMode() ^ flag);
}

function log(action: 'create' | 'edit' | 'remove' | 'clear'): void {
  const count = layer.getLayers().length;
  const item = document.createElement('li');
  item.textContent = `${action.padEnd(6)} → ${count} shape${count === 1 ? '' : 's'}`;
  const list = $('#log');
  list.prepend(item);
  while (list.children.length > 6) list.lastElementChild?.remove();
}

layer.on('shapes:modechange', ({ mode }) => renderMode(mode));
layer.on('shapes:change', ({ layers }) => {
  $('#count').textContent = String(layers.length);
});
for (const action of ['create', 'edit', 'remove'] as const) {
  layer.on(`shapes:${action}`, () => log(action));
}

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

// Read on every draw, so changing it applies to the next shape. Lowering it
// below the current count keeps existing shapes and blocks new ones.
const maxInput = $('#max-polygons') as HTMLInputElement;
maxInput.addEventListener('input', () => {
  const max = maxInput.valueAsNumber;
  layer.options.maxPolygons = max >= 1 ? Math.floor(max) : Infinity;
  $('#limit').textContent =
    layer.options.maxPolygons === Infinity
      ? ''
      : ` / ${layer.options.maxPolygons}`;
});

$('#clear').addEventListener('click', () => {
  layer.clearLayers();
  log('clear');
});

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
  ['1', Mode.CREATE],
  ['2', Mode.EDIT],
  ['3', Mode.DELETE],
  ['4', Mode.APPEND],
]);

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'Escape') layer.cancel();
  const flag = shortcuts.get(event.key);
  if (flag) toggleMode(flag);
});

renderMode(layer.getMode());
