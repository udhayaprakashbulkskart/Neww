import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Component modules use the automatic JSX runtime (tsconfig keeps jsx=preserve for Next.js).
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests share one database, so run files sequentially.
    fileParallelism: false,
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
});
