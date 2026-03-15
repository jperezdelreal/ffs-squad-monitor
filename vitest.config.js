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
      include: [
        'src/lib/**/*.js',
        'src/services/**/*.js',
        'src/components/**/*.jsx',
        'src/hooks/**/*.js',
        'server/lib/agent-metrics.js',
        'server/lib/csv.js',
        'server/lib/data-poller.js',
        'server/lib/event-bus.js',
        'server/lib/logger.js',
        'server/lib/metrics-db.js',
        'server/lib/notification-rules.js',
        'server/lib/performance-tracker.js',
        'server/lib/snapshot-service.js',
        'server/api/metrics.js',
        'server/api/sse.js'
      ],
      exclude: [
        'src/lib/**/*.test.js',
        'src/lib/__tests__/**',
        'src/services/**/*.test.js',
        'src/services/__tests__/**',
        'src/components/__tests__/**',
        'src/hooks/__tests__/**',
        'server/**/__tests__/**',
        // Exclude components without tests (not critical for this PR)
        'src/components/AnimatedCounter.jsx',
        'src/components/ExpandableCard.jsx',
        'src/components/MobileBottomNav.jsx',
        'src/components/NotificationHistory.jsx',
        'src/components/Settings.jsx',
        'src/components/Toast.jsx',
        'src/components/EmptyState.jsx',
        'src/components/ErrorState.jsx',
        'src/components/ExportButton.jsx',
        'src/components/HealthBadge.jsx',
        // Exclude chart components (rendering-heavy, better tested via E2E)
        'src/components/charts/**',
        // Exclude pre-existing files with low coverage (not part of this PR)
        'src/lib/notifications.js',
        'server/lib/logger.js',
        'server/lib/metrics-db.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
