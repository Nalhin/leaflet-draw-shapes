import { defineConfig, type UserConfig } from 'tsdown';

const config: UserConfig[] = defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: true,
    sourcemap: true,
    clean: true,
    publint: true,
    attw: { profile: 'node16', level: 'error' },
  },
  {
    // Script-tag build for CDNs: expects Leaflet's global `L`, bundles
    // polygon-clipping and registers `L.DrawLayer` and `L.drawLayer`.
    entry: { 'leaflet-draw-shapes': 'src/global.ts' },
    format: 'iife',
    globalName: 'LeafletDrawShapes',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: true,
    clean: false,
    deps: { alwaysBundle: ['polygon-clipping'], onlyBundle: false },
    outputOptions: { globals: { leaflet: 'L' } },
  },
]);

export default config;
