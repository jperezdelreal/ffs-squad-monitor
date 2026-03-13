import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getRateLimitStatus } from './lib/github-client.js';

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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🔧 FFS Squad Monitor API Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Heartbeat: ${config.heartbeatPath}`);
  console.log(`   Logs: ${config.logsDir}`);
  console.log(`   GitHub Auth: ${config.githubToken ? '✅ Token configured' : '⚠️  No token (unauthenticated, 60 req/hr limit)'}`);
  console.log(`\n   Endpoints:`);
  console.log(`   - GET /api/heartbeat`);
  console.log(`   - GET /api/logs/files`);
  console.log(`   - GET /api/logs/stream`);
  console.log(`   - GET /api/logs`);
  console.log(`   - GET /api/timeline`);
  console.log(`   - GET /api/issues`);
  console.log(`   - GET /api/pulse`);
  console.log(`   - GET /api/agents`);
  console.log(`   - GET /api/repos`);
  console.log(`   - GET /api/config`);
  console.log(`   - GET /api/events`);
  console.log(`   - GET /health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
