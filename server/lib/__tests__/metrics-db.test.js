import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('../logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

let testDbPath
let metricsDb

async function loadModule() {
  vi.resetModules()
  vi.doMock('../logger.js', () => ({
    logger: {
      child: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }))

  testDbPath = path.join(os.tmpdir(), `test-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
  process.env.METRICS_DB_PATH = testDbPath
  metricsDb = await import('../metrics-db.js')
}

describe('Metrics Database', () => {
  beforeEach(async () => {
    await loadModule()
  })

  afterEach(() => {
    try { metricsDb.closeDb() } catch { /* may already be closed */ }
    try { fs.unlinkSync(testDbPath) } catch { /* may not exist */ }
    try { fs.unlinkSync(testDbPath + '-wal') } catch { /* WAL file */ }
    try { fs.unlinkSync(testDbPath + '-shm') } catch { /* SHM file */ }
    delete process.env.METRICS_DB_PATH
  })

  describe('database initialization', () => {
    it('auto-creates database on first getDb() call', () => {
      expect(fs.existsSync(testDbPath)).toBe(false)
      const db = metricsDb.getDb()
      expect(db).toBeTruthy()
      expect(fs.existsSync(testDbPath)).toBe(true)
    })

    it('creates required tables on init', () => {
      const db = metricsDb.getDb()
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all().map(r => r.name)
      expect(tables).toContain('metrics_snapshots')
      expect(tables).toContain('daily_summaries')
      expect(tables).toContain('schema_version')
    })

    it('sets WAL journal mode', () => {
      const db = metricsDb.getDb()
      const mode = db.pragma('journal_mode', { simple: true })
      expect(mode).toBe('wal')
    })

    it('records schema version', () => {
      const db = metricsDb.getDb()
      const row = db.prepare('SELECT version FROM schema_version').get()
      expect(row.version).toBe(2)
    })

    it('returns same instance on subsequent getDb() calls', () => {
      const db1 = metricsDb.getDb()
      const db2 = metricsDb.getDb()
      expect(db1).toBe(db2)
    })
  })

  describe('insertSnapshot / querySnapshots', () => {
    it('inserts and queries a snapshot', () => {
      const data = { open: 5, closed: 10 }
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', data, 'abc123')
      const results = metricsDb.querySnapshots('issues')
      expect(results).toHaveLength(1)
      expect(results[0].channel).toBe('issues')
      expect(results[0].data).toEqual(data)
      expect(results[0].timestamp).toBe('2026-03-13T10:00:00.000Z')
    })

    it('inserts multiple snapshots', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { open: 5 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:05:00.000Z', { open: 6 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:10:00.000Z', { open: 7 })
      const results = metricsDb.querySnapshots('issues')
      expect(results).toHaveLength(3)
      expect(results[0].data.open).toBe(5)
      expect(results[2].data.open).toBe(7)
    })

    it('filters by channel', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { count: 5 })
      metricsDb.insertSnapshot('agents', '2026-03-13T10:00:00.000Z', { count: 3 })
      const issues = metricsDb.querySnapshots('issues')
      const agents = metricsDb.querySnapshots('agents')
      expect(issues).toHaveLength(1)
      expect(agents).toHaveLength(1)
      expect(issues[0].data.count).toBe(5)
      expect(agents[0].data.count).toBe(3)
    })

    it('filters by time range (from)', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T08:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 2 })
      metricsDb.insertSnapshot('issues', '2026-03-13T12:00:00.000Z', { v: 3 })
      const results = metricsDb.querySnapshots('issues', '2026-03-13T09:00:00.000Z')
      expect(results).toHaveLength(2)
      expect(results[0].data.v).toBe(2)
    })

    it('filters by time range (from and to)', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T08:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 2 })
      metricsDb.insertSnapshot('issues', '2026-03-13T12:00:00.000Z', { v: 3 })
      metricsDb.insertSnapshot('issues', '2026-03-13T14:00:00.000Z', { v: 4 })
      const results = metricsDb.querySnapshots('issues', '2026-03-13T09:00:00.000Z', '2026-03-13T13:00:00.000Z')
      expect(results).toHaveLength(2)
      expect(results[0].data.v).toBe(2)
      expect(results[1].data.v).toBe(3)
    })

    it('returns empty array for empty database', () => {
      metricsDb.getDb()
      const results = metricsDb.querySnapshots('issues')
      expect(results).toEqual([])
    })

    it('returns empty array for non-existent channel', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { count: 5 })
      const results = metricsDb.querySnapshots('nonexistent')
      expect(results).toEqual([])
    })

    it('returns results ordered by timestamp ASC', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T12:00:00.000Z', { v: 3 })
      metricsDb.insertSnapshot('issues', '2026-03-13T08:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 2 })
      const results = metricsDb.querySnapshots('issues')
      expect(results[0].data.v).toBe(1)
      expect(results[1].data.v).toBe(2)
      expect(results[2].data.v).toBe(3)
    })
  })

  describe('aggregation by interval', () => {
    it('returns raw data for 5m interval (default)', () => {
      for (let i = 0; i < 5; i++) {
        metricsDb.insertSnapshot('issues', `2026-03-13T10:0${i}:00.000Z`, { v: i })
      }
      const results = metricsDb.querySnapshots('issues', null, null, '5m')
      expect(results).toHaveLength(5)
    })

    it('aggregates into 1h buckets', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:30:00.000Z', { v: 2 })
      metricsDb.insertSnapshot('issues', '2026-03-13T11:00:00.000Z', { v: 3 })
      metricsDb.insertSnapshot('issues', '2026-03-13T11:45:00.000Z', { v: 4 })
      metricsDb.insertSnapshot('issues', '2026-03-13T12:30:00.000Z', { v: 5 })
      const results = metricsDb.querySnapshots('issues', null, null, '1h')
      expect(results).toHaveLength(3)
      expect(results[0].data.v).toBe(2)
      expect(results[1].data.v).toBe(4)
      expect(results[2].data.v).toBe(5)
    })

    it('aggregates into 1d buckets', () => {
      metricsDb.insertSnapshot('issues', '2026-03-12T10:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-12T20:00:00.000Z', { v: 2 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 3 })
      metricsDb.insertSnapshot('issues', '2026-03-13T22:00:00.000Z', { v: 4 })
      const results = metricsDb.querySnapshots('issues', null, null, '1d')
      expect(results).toHaveLength(2)
      expect(results[0].data.v).toBe(2)
      expect(results[1].data.v).toBe(4)
    })

    it('returns raw data for invalid interval string', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('issues', '2026-03-13T10:05:00.000Z', { v: 2 })
      const results = metricsDb.querySnapshots('issues', null, null, 'invalid')
      expect(results).toHaveLength(2)
    })
  })

  describe('getLatestSnapshotHash', () => {
    it('returns null when no snapshots exist', () => {
      metricsDb.getDb()
      const hash = metricsDb.getLatestSnapshotHash('issues')
      expect(hash).toBeNull()
    })

    it('returns hash of latest snapshot', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 }, 'hash-old')
      metricsDb.insertSnapshot('issues', '2026-03-13T11:00:00.000Z', { v: 2 }, 'hash-new')
      const hash = metricsDb.getLatestSnapshotHash('issues')
      expect(hash).toBe('hash-new')
    })

    it('scopes hash lookup by channel', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 }, 'issues-hash')
      metricsDb.insertSnapshot('agents', '2026-03-13T10:00:00.000Z', { v: 2 }, 'agents-hash')
      expect(metricsDb.getLatestSnapshotHash('issues')).toBe('issues-hash')
      expect(metricsDb.getLatestSnapshotHash('agents')).toBe('agents-hash')
    })

    it('returns null when hash was not stored', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 })
      const hash = metricsDb.getLatestSnapshotHash('issues')
      expect(hash).toBeNull()
    })
  })

  describe('daily summaries', () => {
    it('inserts and retrieves daily summary', () => {
      const summary = { snapshotCount: 10, avgOpen: 5 }
      metricsDb.upsertDailySummary('2026-03-13', 'issues', summary)
      const result = metricsDb.getDailySummary('2026-03-13')
      expect(result.date).toBe('2026-03-13')
      expect(result.channels.issues).toEqual(summary)
    })

    it('upserts (updates on conflict)', () => {
      metricsDb.upsertDailySummary('2026-03-13', 'issues', { v: 1 })
      metricsDb.upsertDailySummary('2026-03-13', 'issues', { v: 2 })
      const result = metricsDb.getDailySummary('2026-03-13')
      expect(result.channels.issues).toEqual({ v: 2 })
    })

    it('stores multiple channels for same date', () => {
      metricsDb.upsertDailySummary('2026-03-13', 'issues', { count: 5 })
      metricsDb.upsertDailySummary('2026-03-13', 'agents', { count: 3 })
      const result = metricsDb.getDailySummary('2026-03-13')
      expect(result.channels.issues).toEqual({ count: 5 })
      expect(result.channels.agents).toEqual({ count: 3 })
    })

    it('returns empty channels for non-existent date', () => {
      metricsDb.getDb()
      const result = metricsDb.getDailySummary('2099-01-01')
      expect(result.date).toBe('2099-01-01')
      expect(result.channels).toEqual({})
    })
  })

  describe('queryAgentSnapshots', () => {
    it('queries agent channel snapshots', () => {
      metricsDb.insertSnapshot('agents', '2026-03-13T10:00:00.000Z', { ripley: { status: 'idle' } })
      metricsDb.insertSnapshot('agents', '2026-03-13T11:00:00.000Z', { ripley: { status: 'working' } })
      const results = metricsDb.queryAgentSnapshots()
      expect(results).toHaveLength(2)
      expect(results[0].agents.ripley.status).toBe('idle')
      expect(results[1].agents.ripley.status).toBe('working')
    })

    it('filters agent snapshots by time range', () => {
      metricsDb.insertSnapshot('agents', '2026-03-13T08:00:00.000Z', { v: 1 })
      metricsDb.insertSnapshot('agents', '2026-03-13T10:00:00.000Z', { v: 2 })
      metricsDb.insertSnapshot('agents', '2026-03-13T12:00:00.000Z', { v: 3 })
      const results = metricsDb.queryAgentSnapshots('2026-03-13T09:00:00.000Z', '2026-03-13T11:00:00.000Z')
      expect(results).toHaveLength(1)
      expect(results[0].agents.v).toBe(2)
    })

    it('returns empty array when no agent snapshots', () => {
      metricsDb.getDb()
      const results = metricsDb.queryAgentSnapshots()
      expect(results).toEqual([])
    })
  })

  describe('retention policy', () => {
    it('prunes snapshots older than retention period', () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
      const recentDate = new Date().toISOString()
      metricsDb.insertSnapshot('issues', oldDate, { v: 'old' })
      metricsDb.insertSnapshot('issues', recentDate, { v: 'new' })
      const deleted = metricsDb.pruneOldSnapshots()
      expect(deleted).toBe(1)
      const remaining = metricsDb.querySnapshots('issues')
      expect(remaining).toHaveLength(1)
      expect(remaining[0].data.v).toBe('new')
    })

    it('returns 0 when nothing to prune', () => {
      metricsDb.insertSnapshot('issues', new Date().toISOString(), { v: 1 })
      const deleted = metricsDb.pruneOldSnapshots()
      expect(deleted).toBe(0)
    })

    it('returns 0 on empty database', () => {
      metricsDb.getDb()
      const deleted = metricsDb.pruneOldSnapshots()
      expect(deleted).toBe(0)
    })
  })

  describe('getDbStats', () => {
    it('returns database statistics', () => {
      metricsDb.insertSnapshot('issues', '2026-03-13T10:00:00.000Z', { v: 1 })
      metricsDb.upsertDailySummary('2026-03-13', 'issues', { v: 1 })
      const stats = metricsDb.getDbStats()
      expect(stats.snapshots).toBe(1)
      expect(stats.summaries).toBe(1)
      expect(stats.retentionDays).toBe(30)
      expect(stats.sizeBytes).toBeGreaterThan(0)
      expect(stats.sizeMB).toBeGreaterThanOrEqual(0)
      expect(stats.path).toBeTruthy()
    })

    it('returns zeros for empty database', () => {
      metricsDb.getDb()
      const stats = metricsDb.getDbStats()
      expect(stats.snapshots).toBe(0)
      expect(stats.summaries).toBe(0)
    })
  })

  describe('closeDb', () => {
    it('closes the database', () => {
      metricsDb.getDb()
      expect(() => metricsDb.closeDb()).not.toThrow()
    })

    it('allows re-opening after close', () => {
      metricsDb.getDb()
      metricsDb.closeDb()
      const db = metricsDb.getDb()
      expect(db).toBeTruthy()
    })

    it('is safe to call when no database is open', () => {
      expect(() => metricsDb.closeDb()).not.toThrow()
    })
  })
})
