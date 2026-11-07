import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration tests run against a dedicated database (never the development or production database).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://binarypro:localdev@localhost:5432/binarypro_test?schema=public',
      DIRECT_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://binarypro:localdev@localhost:5432/binarypro_test?schema=public',
      PAYMENT_PROVIDER: 'mock',
      SMS_PROVIDER: 'console',
      APP_URL: 'http://localhost:3000',
    },
  },
});
