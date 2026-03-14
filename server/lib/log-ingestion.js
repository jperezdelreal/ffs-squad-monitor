import fs from 'fs'
import path from 'path'
import { config } from '../config.js'
import { insertLogEntry, bulkInsertLogEntries, getLatestLogTimestamp } from './metrics-db.js'
import { logger } from './logger.js'

let ingestionInterval = null

// Parse log entry from JSONL and normalize format
function parseLogEntry(line, agent) {
  try {
    const entry = JSON.parse(line)
    
    // Extract message from various possible fields
    let message = ''
    if (entry.output) {
      message = entry.output
    } else if (entry.error) {
      message = entry.error
    } else if (entry.message) {
      message = entry.message
    }

    // Determine level
    let level = 'info'
    if (entry.exitCode !== undefined && entry.exitCode !== 0) {
      level = 'error'
    } else if (entry.consecutiveFailures > 0) {
      level = 'warn'
    } else if (entry.level) {
      level = entry.level.toLowerCase()
    }

    // Build context object
    const context = {}
    if (entry.task) context.task = entry.task
    if (entry.round !== undefined) context.round = entry.round
    if (entry.repo) context.repo = entry.repo
    if (entry.commit) context.commit = entry.commit
    if (entry.branch) context.branch = entry.branch
    if (entry.pr) context.pr = entry.pr

    return {
      timestamp: entry.timestamp || new Date().toISOString(),
      agent,
      level,
      message,
      context: Object.keys(context).length > 0 ? context : null,
      exitCode: entry.exitCode,
      durationMs: entry.durationMs,
      consecutiveFailures: entry.consecutiveFailures || 0,
    }
  } catch (err) {
    logger.error('Failed to parse log entry', { error: err.message, line })
    return null
  }
}

// Ingest logs from a single file
function ingestLogFile(filePath, agent) {
  try {
    if (!fs.existsSync(filePath)) return 0

    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
    if (!raw.trim()) return 0

    const lines = raw.trim().split('\n')
    const entries = []

    // Get latest timestamp already in DB for this agent
    const latestTimestamp = getLatestLogTimestamp(agent)

    for (const line of lines) {
      if (!line.trim()) continue
      
      const entry = parseLogEntry(line, agent)
      if (!entry) continue

      // Skip if already ingested (timestamp <= latest in DB)
      if (latestTimestamp && entry.timestamp <= latestTimestamp) continue

      entries.push(entry)
    }

    if (entries.length > 0) {
      bulkInsertLogEntries(entries)
      logger.info('Ingested log entries', { agent, count: entries.length, file: path.basename(filePath) })
    }

    return entries.length
  } catch (err) {
    logger.error('Failed to ingest log file', { file: filePath, error: err.message })
    return 0
  }
}

// Scan logs directory and ingest all JSONL files
export function ingestAllLogs() {
  try {
    if (!fs.existsSync(config.logsDir)) {
      logger.warn('Logs directory does not exist', { path: config.logsDir })
      return 0
    }

    const files = fs.readdirSync(config.logsDir).filter(f => f.endsWith('.jsonl'))
    let totalIngested = 0

    for (const file of files) {
      const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.jsonl$/)
      if (!match) continue

      const agent = match[1]
      const filePath = path.join(config.logsDir, file)
      const count = ingestLogFile(filePath, agent)
      totalIngested += count
    }

    if (totalIngested > 0) {
      logger.info('Log ingestion completed', { totalIngested, filesScanned: files.length })
    }

    return totalIngested
  } catch (err) {
    logger.error('Failed to ingest logs', { error: err.message })
    return 0
  }
}

// Start periodic log ingestion (runs every 5 minutes)
export function startLogIngestion() {
  if (ingestionInterval) return

  // Run initial ingestion
  ingestAllLogs()

  // Schedule periodic ingestion every 5 minutes
  ingestionInterval = setInterval(() => {
    ingestAllLogs()
  }, 5 * 60 * 1000)

  logger.info('Log ingestion service started', { intervalMinutes: 5 })
}

// Stop log ingestion
export function stopLogIngestion() {
  if (ingestionInterval) {
    clearInterval(ingestionInterval)
    ingestionInterval = null
    logger.info('Log ingestion service stopped')
  }
}
