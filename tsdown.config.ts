import { defineConfig, type UserConfig } from 'tsdown';

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  outputOptions: { exports: 'named' },
  publint: true,
  attw: { profile: 'node16', level: 'error' },
});

export default config;
