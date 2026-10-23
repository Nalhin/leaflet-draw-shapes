import { defineConfig, type UserConfig } from 'tsdown';

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  copy: [{ from: 'src/style.css', to: 'dist' }],
  outputOptions: { exports: 'named' },
  publint: true,
  // CSS isn't a JS entry point, so attw can't resolve it.
  attw: {
    profile: 'node16',
    level: 'error',
    excludeEntrypoints: ['./style.css'],
  },
});

export default config;
