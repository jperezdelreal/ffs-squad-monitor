import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'FFS Squad Monitor API',
      version: '0.1.0',
      description:
        'Real-time monitoring API for First Frame Studios AI squad operations. ' +
        'Provides live heartbeat data, structured logs, GitHub activity, metrics, and SSE streaming.',
      contact: {
        name: 'First Frame Studios',
        url: 'https://github.com/jperezdelreal/ffs-squad-monitor',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Heartbeat', description: 'Ralph scheduler heartbeat monitoring' },
      { name: 'Logs', description: 'Structured agent logs and streaming' },
      { name: 'Timeline', description: 'Daily round timeline and statistics' },
      { name: 'Issues', description: 'GitHub issues across all monitored repos' },
      { name: 'Pulse', description: 'Daily activity pulse (PRs, issues, agents)' },
      { name: 'Agents', description: 'Squad agent status and activity' },
      { name: 'Repos', description: 'Monitored repository information' },
      { name: 'Config', description: 'Dashboard configuration' },
      { name: 'Events', description: 'Recent GitHub events across repos' },
      { name: 'Usage', description: 'GitHub Actions CI/CD usage' },
      { name: 'Metrics', description: 'Historical metrics and snapshots' },
      { name: 'SSE', description: 'Server-Sent Events for real-time updates' },
      { name: 'Health', description: 'Service health and dependency checks' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Failed to fetch data' },
          },
          required: ['error'],
        },
        Heartbeat: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['idle', 'running', 'error', 'offline', 'unknown'], example: 'running' },
            round: { type: 'integer', nullable: true, example: 42 },
            pid: { type: 'integer', nullable: true, example: 12345 },
            interval: { type: 'integer', nullable: true, description: 'Polling interval in seconds', example: 120 },
            lastStatus: { type: 'string', nullable: true, example: 'success' },
            lastDuration: { type: 'number', nullable: true, description: 'Duration of last round in seconds', example: 45.2 },
            timestamp: { type: 'string', format: 'date-time', nullable: true },
            consecutiveFailures: { type: 'integer', default: 0 },
            mode: { type: 'string', nullable: true, example: 'normal' },
            repos: { type: 'array', items: { type: 'string' } },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '12345678' },
            type: { type: 'string', example: 'PushEvent' },
            repo: { type: 'string', example: 'jperezdelreal/flora' },
            actor: { type: 'string', example: 'oak' },
            createdAt: { type: 'string', format: 'date-time' },
            payload: { type: 'object', description: 'Event-specific payload data' },
          },
        },
        Issue: {
          type: 'object',
          properties: {
            repo: { type: 'string', example: 'flora' },
            repoLabel: { type: 'string', example: 'Flora' },
            repoEmoji: { type: 'string', example: '🌿' },
            repoGithub: { type: 'string', example: 'jperezdelreal/flora' },
            number: { type: 'integer', example: 42 },
            title: { type: 'string', example: 'Add player movement' },
            state: { type: 'string', enum: ['open', 'closed'], example: 'open' },
            url: { type: 'string', format: 'uri' },
            priority: { type: 'integer', minimum: 0, maximum: 3, description: '0=P0/critical, 3=default' },
            labels: { type: 'array', items: { type: 'string' }, example: ['squad', 'type:feature'] },
            assignees: { type: 'array', items: { type: 'string' }, example: ['oak'] },
            prStatus: { type: 'string', nullable: true, enum: ['open', 'closed', null], description: 'Linked PR state' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Usage: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['billing', 'workflow_runs'], description: 'Data source used' },
            totalMinutesUsed: { type: 'integer', example: 150 },
            includedMinutes: { type: 'integer', example: 2000 },
            paidMinutesUsed: { type: 'integer', description: 'Only present when source is billing' },
            totalRuns: { type: 'integer', description: 'Only present when source is workflow_runs' },
            percentage: { type: 'integer', minimum: 0, maximum: 100, example: 8 },
            repos: {
              type: 'array',
              description: 'Per-repo breakdown (only when source is workflow_runs)',
              items: {
                type: 'object',
                properties: {
                  repo: { type: 'string' },
                  label: { type: 'string' },
                  emoji: { type: 'string' },
                  runs: { type: 'integer' },
                  durationMinutes: { type: 'integer' },
                },
              },
            },
          },
        },
        ConfigRepo: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'flora' },
            emoji: { type: 'string', example: '🌿' },
            label: { type: 'string', example: 'Flora' },
            github: { type: 'string', example: 'jperezdelreal/flora' },
            owner: { type: 'string', example: 'jperezdelreal' },
            name: { type: 'string', example: 'flora' },
            color: { type: 'string', example: '#ef4444' },
          },
        },
        ConfigAgent: {
          type: 'object',
          properties: {
            emoji: { type: 'string', example: '🏗️' },
            role: { type: 'string', example: 'Lead / Architect' },
            color: { type: 'string', example: '#58a6ff' },
            repo: { type: 'string', example: 'FirstFrameStudios' },
          },
        },
        Repo: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'flora' },
            emoji: { type: 'string', example: '🌿' },
            label: { type: 'string', example: 'Flora' },
            github: { type: 'string', example: 'jperezdelreal/flora' },
            hasSquad: { type: 'boolean', description: 'Whether .squad/ directory exists' },
            focus: { type: 'string', nullable: true, description: 'Current focus from now.md' },
            openIssues: { type: 'integer', nullable: true },
            lastCommit: {
              type: 'object',
              nullable: true,
              properties: {
                sha: { type: 'string', example: 'abc1234' },
                message: { type: 'string' },
              },
            },
          },
        },
        Timeline: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date', example: '2026-03-13' },
            agents: { type: 'array', items: { type: 'string' }, example: ['ralph', 'solo'] },
            rounds: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agent: { type: 'string' },
                  round: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                  duration: { type: 'number', description: 'Duration in seconds' },
                  outcome: { type: 'string', enum: ['success', 'error'] },
                  exitCode: { type: 'integer' },
                  status: { type: 'string' },
                  phase: { type: 'string' },
                  consecutiveFailures: { type: 'integer' },
                  metrics: { type: 'object' },
                },
              },
            },
            heartbeat: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                round: { type: 'integer' },
                lastStatus: { type: 'string' },
              },
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                success: { type: 'integer' },
                error: { type: 'integer' },
                avgDuration: { type: 'number' },
                maxDuration: { type: 'number' },
              },
            },
          },
        },
        Pulse: {
          type: 'object',
          properties: {
            prsMergedToday: { type: 'integer', example: 3 },
            issuesClosedToday: { type: 'integer', example: 5 },
            activeAgents: { type: 'integer', example: 4 },
            totalAgents: { type: 'integer', example: 16 },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'solo' },
            emoji: { type: 'string', example: '🏗️' },
            role: { type: 'string', example: 'Lead / Architect' },
            color: { type: 'string', example: '#58a6ff' },
            repo: { type: 'string', example: 'FirstFrameStudios' },
            status: { type: 'string', enum: ['idle', 'working', 'blocked'], example: 'working' },
            lastActivity: { type: 'string', format: 'date-time', nullable: true },
            currentWork: { type: 'string', nullable: true, description: 'Current task description' },
          },
        },
        LogEntry: {
          type: 'object',
          properties: {
            _agent: { type: 'string', example: 'ralph' },
            _level: { type: 'string', enum: ['info', 'warn', 'error'] },
            round: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' },
            duration: { type: 'number' },
            exitCode: { type: 'integer' },
            status: { type: 'string' },
            phase: { type: 'string' },
            consecutiveFailures: { type: 'integer' },
            metrics: { type: 'object' },
          },
        },
        MetricsResponse: {
          type: 'object',
          properties: {
            channel: { type: 'string', enum: ['issues', 'agents', 'actions'] },
            interval: { type: 'string', enum: ['5m', '15m', '1h', '6h', '1d'] },
            from: { type: 'string', format: 'date-time', nullable: true },
            to: { type: 'string', format: 'date-time', nullable: true },
            count: { type: 'integer' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
        AgentMetricsResponse: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time', nullable: true },
            to: { type: 'string', format: 'date-time', nullable: true },
            count: { type: 'integer' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            dependencies: {
              type: 'object',
              properties: {
                github: {
                  type: 'object',
                  properties: {
                    reachable: { type: 'boolean' },
                    authenticated: { type: 'boolean' },
                    rateLimit: {
                      type: 'object',
                      properties: {
                        remaining: { type: 'integer', nullable: true },
                        limit: { type: 'integer', nullable: true },
                        resetsAt: { type: 'string', format: 'date-time', nullable: true },
                        healthy: { type: 'boolean' },
                      },
                    },
                  },
                },
                heartbeat: {
                  type: 'object',
                  properties: {
                    fileAccessible: { type: 'boolean' },
                    status: { type: 'string' },
                    lastTimestamp: { type: 'string', format: 'date-time', nullable: true },
                    healthy: { type: 'boolean' },
                  },
                },
                metricsDb: { type: 'object', nullable: true },
              },
            },
            sse: { type: 'object', description: 'SSE connection info' },
          },
        },
        SimpleHealth: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            docsUrl: { type: 'string', example: '/api/docs' },
            github: {
              type: 'object',
              properties: {
                authenticated: { type: 'boolean' },
                rateLimit: {
                  type: 'object',
                  properties: {
                    remaining: { type: 'integer', nullable: true },
                    limit: { type: 'integer', nullable: true },
                    resetsAt: { type: 'string', format: 'date-time', nullable: true },
                    lastChecked: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
            metricsDb: { type: 'object', nullable: true },
          },
        },
      },
    },
  },
  apis: ['./server/api/*.js', './server/index.js'],
}

export const swaggerSpec = swaggerJsdoc(options)

// Dark theme CSS to match dashboard aesthetic
const darkThemeCss = `
  html { box-sizing: border-box; overflow-y: scroll; }
  body { margin: 0; background: #0d1117 !important; }
  .swagger-ui {
    color: #c9d1d9 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
  }
  .swagger-ui .topbar { display: none !important; }
  .swagger-ui .info .title { color: #58a6ff !important; }
  .swagger-ui .info p, .swagger-ui .info li { color: #8b949e !important; }
  .swagger-ui .info a { color: #58a6ff !important; }
  .swagger-ui .scheme-container { background: #161b22 !important; box-shadow: none !important; }
  .swagger-ui .opblock-tag { color: #c9d1d9 !important; border-bottom-color: #30363d !important; }
  .swagger-ui .opblock-tag:hover { background: #161b22 !important; }
  .swagger-ui .opblock { background: #161b22 !important; border-color: #30363d !important; }
  .swagger-ui .opblock .opblock-summary { border-color: #30363d !important; }
  .swagger-ui .opblock .opblock-summary-description { color: #8b949e !important; }
  .swagger-ui .opblock.opblock-get { border-color: #1f6feb !important; background: rgba(31,111,235,0.05) !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #1f6feb !important; }
  .swagger-ui .opblock-body { background: #0d1117 !important; }
  .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #c9d1d9 !important; border-bottom-color: #30363d !important; }
  .swagger-ui .response-col_status { color: #c9d1d9 !important; }
  .swagger-ui .response-col_description { color: #8b949e !important; }
  .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #c9d1d9 !important; }
  .swagger-ui .model-title { color: #c9d1d9 !important; }
  .swagger-ui .model { color: #c9d1d9 !important; }
  .swagger-ui .model-toggle::after { background: none !important; }
  .swagger-ui section.models { border-color: #30363d !important; }
  .swagger-ui section.models h4 { color: #c9d1d9 !important; border-bottom-color: #30363d !important; }
  .swagger-ui .model-box { background: #161b22 !important; }
  .swagger-ui .parameter__name { color: #c9d1d9 !important; }
  .swagger-ui .parameter__type { color: #8b949e !important; }
  .swagger-ui input[type=text] { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; }
  .swagger-ui select { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; }
  .swagger-ui textarea { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; }
  .swagger-ui .btn { border-color: #30363d !important; color: #c9d1d9 !important; }
  .swagger-ui .btn:hover { background: #161b22 !important; }
  .swagger-ui .btn.execute { background: #238636 !important; border-color: #238636 !important; color: #fff !important; }
  .swagger-ui .btn.cancel { background: #da3633 !important; border-color: #da3633 !important; }
  .swagger-ui .highlight-code { background: #161b22 !important; }
  .swagger-ui .highlight-code .microlight { color: #c9d1d9 !important; background: #161b22 !important; }
  .swagger-ui .copy-to-clipboard { background: #161b22 !important; }
  .swagger-ui .loading-container .loading::after { color: #58a6ff !important; }
  .swagger-ui .response-control-media-type__accept-message { color: #3fb950 !important; }
  .swagger-ui .markdown p, .swagger-ui .markdown li { color: #8b949e !important; }
`

export function setupSwagger(app) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: darkThemeCss,
      customSiteTitle: 'FFS Squad Monitor — API Docs',
      customfavIcon: null,
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        tryItOutEnabled: true,
        persistAuthorization: false,
      },
    })
  )

  // Serve raw spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.json(swaggerSpec)
  })
}
