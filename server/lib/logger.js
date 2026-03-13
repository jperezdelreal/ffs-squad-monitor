const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const isDev = process.env.NODE_ENV !== 'production'

// ANSI colors for pretty dev output
const COLORS = {
  debug: '\x1b[90m',  // gray
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  reset: '\x1b[0m',
}

const LEVEL_ICONS = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }

function formatPretty(level, message, context) {
  const ts = new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
  const color = COLORS[level]
  const icon = LEVEL_ICONS[level]
  const prefix = `${color}${ts} ${icon} [${level.toUpperCase()}]${COLORS.reset}`
  const ctx = context && Object.keys(context).length > 0
    ? ` ${COLORS.debug}${JSON.stringify(context)}${COLORS.reset}`
    : ''
  return `${prefix} ${message}${ctx}`
}

function formatJSON(level, message, context) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  })
}

function log(level, message, context = {}) {
  if (LEVELS[level] < LEVELS[logger.level]) return

  const output = isDev
    ? formatPretty(level, message, context)
    : formatJSON(level, message, context)

  if (level === 'error') process.stderr.write(output + '\n')
  else process.stdout.write(output + '\n')
}

export const logger = {
  level: isDev ? 'debug' : 'info',

  debug: (message, context) => log('debug', message, context),
  info:  (message, context) => log('info', message, context),
  warn:  (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),

  // Create a child logger that always includes extra context fields
  child(defaults) {
    return {
      debug: (msg, ctx) => log('debug', msg, { ...defaults, ...ctx }),
      info:  (msg, ctx) => log('info', msg, { ...defaults, ...ctx }),
      warn:  (msg, ctx) => log('warn', msg, { ...defaults, ...ctx }),
      error: (msg, ctx) => log('error', msg, { ...defaults, ...ctx }),
    }
  },
}

// Express request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info'

    logger[level]('request', {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration,
    })
  })

  next()
}
