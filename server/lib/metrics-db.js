import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'metrics.sqlite')

const DB_PATH = process.env.METRICS_DB_PATH || DEFAULT_DB_PATH
const RETENTION_DAYS = 30

let db = null

const SCHEMA_VERSION = 2

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    channel TEXT NOT NULL,
    data TEXT NOT NULL,
    hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_channel_ts
    ON metrics_snapshots (channel, timestamp)`,
  `CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT NOT NULL,
    channel TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (date, channel)
  )`,
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  )`,
  // Log entries storage for FTS5
  `CREATE TABLE IF NOT EXISTS log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    agent TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT,
    exit_code INTEGER,
    duration_ms INTEGER,
    consecutive_failures INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries (timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_log_entries_agent ON log_entries (agent)`,
  `CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries (level)`,
  // FTS5 virtual table for full-text search
  `CREATE VIRTUAL TABLE IF NOT EXISTS log_entries_fts USING fts5(
    message,
    context,
    agent UNINDEXED,
    level UNINDEXED,
    timestamp UNINDEXED,
    content='log_entries',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 2'
  )`,
  // Triggers to keep FTS5 in sync with log_entries
  `CREATE TRIGGER IF NOT EXISTS log_entries_ai AFTER INSERT ON log_entries BEGIN
    INSERT INTO log_entries_fts(rowid, message, context, agent, level, timestamp)
    VALUES (new.id, new.message, new.context, new.agent, new.level, new.timestamp);
  END`,
  `CREATE TRIGGER IF NOT EXISTS log_entries_ad AFTER DELETE ON log_entries BEGIN
    INSERT INTO log_entries_fts(log_entries_fts, rowid, message, context, agent, level, timestamp)
    VALUES ('delete', old.id, old.message, old.context, old.agent, old.level, old.timestamp);
  END`,
  `CREATE TRIGGER IF NOT EXISTS log_entries_au AFTER UPDATE ON log_entries BEGIN
    INSERT INTO log_entries_fts(log_entries_fts, rowid, message, context, agent, level, timestamp)
    VALUES ('delete', old.id, old.message, old.context, old.agent, old.level, old.timestamp);
    INSERT INTO log_entries_fts(rowid, message, context, agent, level, timestamp)
    VALUES (new.id, new.message, new.context, new.agent, new.level, new.timestamp);
  END`,
]

export function getDb() {
  if (db) return db
  db = initDb()
  return db
}

function initDb() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const instance = new Database(DB_PATH)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  migrate(instance)

  logger.info('Metrics database initialized', { path: DB_PATH })
  return instance
}

function migrate(instance) {
  instance.transaction(() => {
    for (const sql of MIGRATIONS) {
      instance.exec(sql)
    }
    const row = instance.prepare('SELECT version FROM schema_version').get()
    if (!row) {
      instance.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
    }
  })()
}

// --- Snapshot CRUD ---

export function insertSnapshot(channel, timestamp, data, hash = null) {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO metrics_snapshots (channel, timestamp, data, hash) VALUES (?, ?, ?, ?)'
  )
  return stmt.run(channel, timestamp, JSON.stringify(data), hash)
}

export function getLatestSnapshotHash(channel) {
  const db = getDb()
  const row = db.prepare(
    'SELECT hash FROM metrics_snapshots WHERE channel = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(channel)
  return row?.hash || null
}

export function querySnapshots(channel, from, to, interval = '5m') {
  const db = getDb()

  let query = 'SELECT id, timestamp, channel, data FROM metrics_snapshots WHERE channel = ?'
  const params = [channel]

  if (from) {
    query += ' AND timestamp >= ?'
    params.push(from)
  }
  if (to) {
    query += ' AND timestamp <= ?'
    params.push(to)
  }

  query += ' ORDER BY timestamp ASC'
  const rows = db.prepare(query).all(...params)

  const parsed = rows.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    channel: r.channel,
    data: JSON.parse(r.data),
  }))

  return aggregateByInterval(parsed, interval)
}

function aggregateByInterval(rows, interval) {
  if (!rows.length || interval === '5m') return rows

  const bucketMs = intervalToMs(interval)
  if (!bucketMs) return rows

  const buckets = new Map()
  for (const row of rows) {
    const ts = new Date(row.timestamp).getTime()
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, [])
    }
    buckets.get(bucketKey).push(row)
  }

  // Take last snapshot per bucket (most recent state)
  return Array.from(buckets.entries()).map(([bucketTs, items]) => {
    const last = items[items.length - 1]
    return {
      timestamp: new Date(bucketTs).toISOString(),
      channel: last.channel,
      data: last.data,
    }
  })
}

function intervalToMs(interval) {
  const match = interval.match(/^(\d+)(m|h|d)$/)
  if (!match) return null
  const [, num, unit] = match
  const n = parseInt(num, 10)
  switch (unit) {
    case 'm': return n * 60 * 1000
    case 'h': return n * 60 * 60 * 1000
    case 'd': return n * 24 * 60 * 60 * 1000
    default: return null
  }
}

// --- Daily Summaries ---

export function upsertDailySummary(date, channel, summary) {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO daily_summaries (date, channel, summary)
     VALUES (?, ?, ?)
     ON CONFLICT(date, channel)
     DO UPDATE SET summary = excluded.summary, created_at = datetime('now')`
  )
  return stmt.run(date, channel, JSON.stringify(summary))
}

export function getDailySummary(date) {
  const db = getDb()
  const rows = db.prepare(
    'SELECT date, channel, summary FROM daily_summaries WHERE date = ?'
  ).all(date)

  const result = {}
  for (const row of rows) {
    result[row.channel] = JSON.parse(row.summary)
  }
  return { date, channels: result }
}

// --- Agent Metrics ---

export function queryAgentSnapshots(from, to) {
  const db = getDb()
  let query = `SELECT timestamp, data FROM metrics_snapshots WHERE channel = 'agents'`
  const params = []

  if (from) {
    query += ' AND timestamp >= ?'
    params.push(from)
  }
  if (to) {
    query += ' AND timestamp <= ?'
    params.push(to)
  }

  query += ' ORDER BY timestamp ASC'
  return db.prepare(query).all(...params).map(r => ({
    timestamp: r.timestamp,
    agents: JSON.parse(r.data),
  }))
}

// --- Retention ---

export function pruneOldSnapshots() {
  const db = getDb()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const result = db.prepare(
    'DELETE FROM metrics_snapshots WHERE timestamp < ?'
  ).run(cutoff)

  if (result.changes > 0) {
    logger.info('Pruned old metrics snapshots', { deleted: result.changes, cutoff })
  }
  return result.changes
}

// --- Health ---

export function getDbStats() {
  const db = getDb()
  const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM metrics_snapshots').get().count
  const summaryCount = db.prepare('SELECT COUNT(*) as count FROM daily_summaries').get().count

  let sizeBytes = 0
  try {
    const stat = fs.statSync(DB_PATH)
    sizeBytes = stat.size
  } catch { /* file may not exist yet */ }

  return {
    path: DB_PATH,
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
    snapshots: snapshotCount,
    summaries: summaryCount,
    retentionDays: RETENTION_DAYS,
  }
}

// --- Log Ingestion ---

export function insertLogEntry(entry) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO log_entries (timestamp, agent, level, message, context, exit_code, duration_ms, consecutive_failures)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  return stmt.run(
    entry.timestamp,
    entry.agent,
    entry.level,
    entry.message || '',
    entry.context ? JSON.stringify(entry.context) : null,
    entry.exitCode ?? null,
    entry.durationMs ?? null,
    entry.consecutiveFailures ?? 0
  )
}

export function bulkInsertLogEntries(entries) {
  const db = getDb()
  return db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO log_entries (timestamp, agent, level, message, context, exit_code, duration_ms, consecutive_failures)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const entry of entries) {
      stmt.run(
        entry.timestamp,
        entry.agent,
        entry.level,
        entry.message || '',
        entry.context ? JSON.stringify(entry.context) : null,
        entry.exitCode ?? null,
        entry.durationMs ?? null,
        entry.consecutiveFailures ?? 0
      )
    }
  })()
}

export function getLatestLogTimestamp(agent = null) {
  const db = getDb()
  let query = 'SELECT MAX(timestamp) as latest FROM log_entries'
  const params = []
  if (agent) {
    query += ' WHERE agent = ?'
    params.push(agent)
  }
  const row = db.prepare(query).get(...params)
  return row?.latest || null
}

// --- FTS5 Search ---

export function searchLogs(options = {}) {
  const db = getDb()
  const { query, agent, level, from, to, limit = 100, offset = 0 } = options

  // Validate query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { results: [], total: 0, hasMore: false }
  }

  // Build FTS5 query with filters
  let ftsQuery = query.trim()
  let whereClause = ''
  const params = []

  // FTS5 query parameter
  params.push(ftsQuery)

  // Build filter conditions for structured data (agent, level, date range)
  const conditions = []
  if (agent) {
    conditions.push('log_entries.agent = ?')
    params.push(agent)
  }
  if (level) {
    conditions.push('log_entries.level = ?')
    params.push(level)
  }
  if (from) {
    conditions.push('log_entries.timestamp >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('log_entries.timestamp <= ?')
    params.push(to)
  }

  if (conditions.length > 0) {
    whereClause = ' AND ' + conditions.join(' AND ')
  }

  // Query with snippet() for context highlighting
  const sql = `
    SELECT
      log_entries.id,
      log_entries.timestamp,
      log_entries.agent,
      log_entries.level,
      log_entries.message,
      log_entries.context,
      log_entries.exit_code,
      log_entries.duration_ms,
      log_entries_fts.rank,
      snippet(log_entries_fts, 0, '<mark>', '</mark>', '...', 32) as message_snippet,
      snippet(log_entries_fts, 1, '<mark>', '</mark>', '...', 32) as context_snippet
    FROM log_entries_fts
    JOIN log_entries ON log_entries.id = log_entries_fts.rowid
    WHERE log_entries_fts MATCH ?${whereClause}
    ORDER BY log_entries_fts.rank, log_entries.timestamp DESC
    LIMIT ? OFFSET ?
  `

  params.push(limit + 1) // Fetch one extra to check hasMore
  params.push(offset)

  let rows = []
  try {
    rows = db.prepare(sql).all(...params)
  } catch (err) {
    // FTS5 query syntax error
    logger.error('FTS5 search query error', { query: ftsQuery, error: err.message })
    throw new Error(`Invalid search query: ${err.message}`)
  }

  // Check if there are more results
  const hasMore = rows.length > limit
  if (hasMore) {
    rows = rows.slice(0, limit)
  }

  // Get total count (without limit/offset) for pagination
  const countSql = `
    SELECT COUNT(*) as total
    FROM log_entries_fts
    JOIN log_entries ON log_entries.id = log_entries_fts.rowid
    WHERE log_entries_fts MATCH ?${whereClause}
  `
  const countParams = [ftsQuery, ...params.slice(1, params.length - 2)] // Exclude limit/offset
  const countRow = db.prepare(countSql).get(...countParams)
  const total = countRow?.total || 0

  // Format results
  const results = rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    agent: row.agent,
    level: row.level,
    message: row.message,
    messageSnippet: row.message_snippet,
    context: row.context ? JSON.parse(row.context) : null,
    contextSnippet: row.context_snippet,
    exitCode: row.exit_code,
    durationMs: row.duration_ms,
    rank: row.rank,
  }))

  return { results, total, hasMore, limit, offset }
}

// --- Lifecycle ---

export function closeDb() {
  if (db) {
    db.close()
    db = null
    logger.info('Metrics database closed')
  }
}
