import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';

const config: UserConfig = defineConfig({
  // Relative asset URLs so the build works under any GitHub Pages path.
  base: './',
  resolve: {
    alias: {
      'leaflet-draw-shapes': fileURLToPath(
        new URL('../src/index.ts', import.meta.url),
      ),
    },
  },
});

export default config;
