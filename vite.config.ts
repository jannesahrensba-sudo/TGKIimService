import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // static: dist-static/ mit relativen Pfaden · artifact: eine Datei für das Claude-Artifact (scripts/inline-artifact.ts)
  const isArtifact = mode === 'artifact';
  const isStatic = mode === 'static' || isArtifact;
  return {
    root: 'web',
    base: isStatic ? './' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@core': `${root}src/core`,
        '@agents': `${root}src/agents`,
      },
    },
    define: {
      __STATIC__: JSON.stringify(isStatic),
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:5175' },
      fs: { allow: [root] },
    },
    build: {
      outDir: isArtifact ? `${root}dist-artifact` : isStatic ? `${root}dist-static` : `${root}dist`,
      emptyOutDir: true,
      chunkSizeWarningLimit: 6000,
      assetsInlineLimit: isArtifact ? 100_000_000 : 0,
      cssCodeSplit: !isArtifact,
      rolldownOptions: isArtifact ? { output: { codeSplitting: false } } : undefined,
    },
  };
});
