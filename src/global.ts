// Entry point of the script-tag build. Registers the plugin on Leaflet's
// global `L` as `L.DrawLayer` and `L.drawLayer`, like other Leaflet plugins.
import { DrawLayer, drawLayer } from './index';

export * from './index';

const { L } = globalThis as unknown as { L: Record<string, unknown> };
Object.assign(L, { DrawLayer, drawLayer });
