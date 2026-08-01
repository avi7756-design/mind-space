import { defineConfig } from 'vitest/config';

// Test config is kept separate from vite.config.ts so that build settings
// (base, manualChunks) and test settings never interfere with each other.
export default defineConfig({
  test: {
    // All tests in this suite target pure functions — no DOM environment needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**'],
      reporter: ['text', 'html'],
    },
  },
});
