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

const SCHEMA_VERSION = 1

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

// --- Lifecycle ---

export function closeDb() {
  if (db) {
    db.close()
    db = null
    logger.info('Metrics database closed')
  }
}
