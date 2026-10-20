import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    // gleiche Aliasse wie die Web-Oberfläche (für Tests der Browser-Datenschicht)
    alias: {
      '@core': `${root}src/core`,
      '@agents': `${root}src/agents`,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
