import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getRateLimitStatus } from './lib/github-client.js';
import { eventBus } from './lib/event-bus.js';
import { logger, requestLogger } from './lib/logger.js';
import { startSnapshotService, stopSnapshotService } from './lib/snapshot-service.js';
import { startNotificationEvaluator, stopNotificationEvaluator } from './lib/notification-evaluator.js';
import { closeDb, getDbStats } from './lib/metrics-db.js';
import { setupSwagger } from './lib/swagger.js';
import { dataPoller } from './lib/data-poller.js';
import { startLogIngestion, stopLogIngestion } from './lib/log-ingestion.js';

// Import route handlers
import heartbeatRoute from './api/heartbeat.js';
import logsRoute, { logsFilesRoute, logsStreamRoute } from './api/logs.js';
import timelineRoute from './api/timeline.js';
import boardRoute from './api/board.js';
import pulseRoute from './api/pulse.js';
import workflowsRoute from './api/workflows.js';
import reposRoute from './api/repos.js';
import configRoute from './api/config.js';
import eventsRoute from './api/events.js';
import usageRoute from './api/usage.js';
import healthRoute from './api/health.js';
import { metricsRoute, metricsSummaryRoute, metricsAgentsRoute, metricsStatsRoute } from './api/metrics.js';
import sseRoute from './api/sse.js';
import { exportIssuesRoute, exportMetricsRoute, exportUsageRoute, exportArchiveRoute } from './api/export.js';
import searchLogsRoute from './api/search.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Swagger UI at /api/docs
setupSwagger(app);

// API routes
app.get('/api/heartbeat', heartbeatRoute);
app.get('/api/logs/files', logsFilesRoute);
app.get('/api/logs/stream', logsStreamRoute);
app.get('/api/logs/search', searchLogsRoute);
app.get('/api/logs', logsRoute);
app.get('/api/timeline', timelineRoute);
app.get('/api/issues', boardRoute);
app.get('/api/pulse', pulseRoute);
app.get('/api/agents', workflowsRoute);
app.get('/api/repos', reposRoute);
app.get('/api/config', configRoute);
app.get('/api/events', eventsRoute);
app.get('/api/usage', usageRoute);
app.get('/api/health', healthRoute);
app.get('/api/metrics', metricsRoute);
app.get('/api/metrics/summary', metricsSummaryRoute);
app.get('/api/metrics/agents', metricsAgentsRoute);
app.get('/api/metrics/stats', metricsStatsRoute);
app.get('/api/sse', sseRoute);
app.get('/api/export/issues', exportIssuesRoute);
app.get('/api/export/metrics', exportMetricsRoute);
app.get('/api/export/usage', exportUsageRoute);
app.get('/api/export/archive', exportArchiveRoute);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Simple health check
 *     description: Quick health endpoint returning server status, GitHub auth state, rate limit info, and metrics DB stats. Lighter than /api/health — no external calls.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleHealth'
 */
// Health check with rate limit status
app.get('/health', (req, res) => {
  const rl = getRateLimitStatus();
  let dbStats = null;
  try {
    dbStats = getDbStats();
  } catch { /* db may not be initialized */ }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    docsUrl: '/api/docs',
    github: {
      authenticated: !!config.githubToken,
      rateLimit: {
        remaining: rl.remaining,
        limit: rl.limit,
        resetsAt: rl.reset ? new Date(rl.reset * 1000).toISOString() : null,
        lastChecked: rl.lastChecked,
      },
    },
    metricsDb: dbStats,
    sse: eventBus.getConnectionInfo(),
  });
});

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl || req.url,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    heartbeat: config.heartbeatPath,
    logsDir: config.logsDir,
    githubAuth: !!config.githubToken,
    endpoints: [
      '/api/heartbeat', '/api/logs/files', '/api/logs/stream', '/api/logs',
      '/api/timeline', '/api/issues', '/api/pulse', '/api/agents',
      '/api/repos', '/api/config', '/api/events', '/api/usage', '/api/health',
      '/api/metrics', '/api/metrics/summary', '/api/metrics/agents', '/api/metrics/stats',
      '/api/sse', '/api/export/issues', '/api/export/metrics', '/api/export/usage', '/api/export/archive',
      '/api/docs', '/health',
    ],
  });

  // Start metrics snapshot service
  startSnapshotService();

  // Start notification evaluator
  startNotificationEvaluator();

  // Start SSE data channel pollers
  dataPoller.start();

  // Start log ingestion service
  startLogIngestion();
});

// Graceful shutdown
function shutdown(signal) {
  logger.info('Shutdown signal received', { signal });
  stopNotificationEvaluator();
  dataPoller.stop();
  stopSnapshotService();
  stopLogIngestion();
  closeDb();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
