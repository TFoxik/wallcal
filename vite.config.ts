import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __WALLCAL_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, strictPort: true },
  build: {
    lib: { entry: 'src/wallcal-card.ts', formats: ['es'], fileName: () => 'wallcal-card.js' },
    target: ['chrome87', 'safari14'],
  },
  test: { include: ['test/**/*.test.ts'] },
});
