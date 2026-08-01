import { defineConfig } from 'vitest/config';

// The worker is exercised by calling its fetch handler with real Request objects.
// Node 22 supplies Request/Response/FormData/File/crypto, so no workerd sandbox
// is needed for the contract tests — and no test can reach a real API.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
