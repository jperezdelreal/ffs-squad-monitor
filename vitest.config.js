import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./src/components/__tests__/setup.js'],
    environmentMatchGlobs: [
      ['server/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.js', 'src/services/**/*.js', 'src/components/**/*.jsx', 'src/hooks/**/*.js', 'server/lib/**/*.js', 'server/api/**/*.js'],
      exclude: ['src/lib/**/*.test.js', 'src/lib/__tests__/**', 'src/services/**/*.test.js', 'src/services/__tests__/**', 'src/components/__tests__/**', 'src/hooks/__tests__/**', 'server/**/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
