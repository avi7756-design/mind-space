// Temporary config for the shareable single-file build (not part of the app).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-artifact',
    sourcemap: false,
  },
});
