import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getRateLimitStatus } from './lib/github-client.js';
import { logger, requestLogger } from './lib/logger.js';

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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// API routes
app.get('/api/heartbeat', heartbeatRoute);
app.get('/api/logs/files', logsFilesRoute);
app.get('/api/logs/stream', logsStreamRoute);
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

// Health check with rate limit status
app.get('/health', (req, res) => {
  const rl = getRateLimitStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    github: {
      authenticated: !!config.githubToken,
      rateLimit: {
        remaining: rl.remaining,
        limit: rl.limit,
        resetsAt: rl.reset ? new Date(rl.reset * 1000).toISOString() : null,
        lastChecked: rl.lastChecked,
      },
    },
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
      '/api/repos', '/api/config', '/api/events', '/api/usage', '/api/health', '/health',
    ],
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutdown signal received', { signal: 'SIGTERM' });
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Shutdown signal received', { signal: 'SIGINT' });
  process.exit(0);
});
