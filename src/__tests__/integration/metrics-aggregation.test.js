/**
 * Integration Test: Metrics Aggregation Across Multiple Sessions
 * 
 * Tests the metrics collection, aggregation, and querying pipeline.
 * Simulates multiple concurrent sessions generating metrics data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../../../server/lib/event-bus'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'

describe('Integration: Metrics Aggregation Across Multiple Sessions', () => {
  let bus
  let db
  let dbPath
  let metricsCollected

  beforeEach(() => {
    vi.useFakeTimers()
    bus = new EventBus()
    metricsCollected = []

    // Create temporary database
    dbPath = path.join(os.tmpdir(), `test-metrics-${Date.now()}.db`)
    db = new Database(dbPath)

    // Create metrics schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL,
        hash TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_channel_timestamp 
        ON metrics_snapshots(channel, timestamp);
    `)

    // Mock metrics handler
    bus.on('agents', (event) => {
      metricsCollected.push({
        channel: 'agents',
        timestamp: event.timestamp,
        data: event.data,
      })

      // Insert into DB
      const hash = JSON.stringify(event.data)
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data, hash)
        VALUES (?, ?, ?, ?)
      `).run('agents', event.timestamp, JSON.stringify(event.data), hash)
    })

    bus.on('issues', (event) => {
      metricsCollected.push({
        channel: 'issues',
        timestamp: event.timestamp,
        data: event.data,
      })

      const hash = JSON.stringify(event.data)
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data, hash)
        VALUES (?, ?, ?, ?)
      `).run('issues', event.timestamp, JSON.stringify(event.data), hash)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    bus.removeAllListeners()
    db.close()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('should aggregate metrics from multiple concurrent sessions', () => {
    // Session 1: Agent metrics
    bus.publish('agents', 'snapshot', {
      sessionId: 'session-1',
      ripley: { issuesAssigned: 5, issuesClosed: 3, avgCycleTimeHours: 24 },
      dallas: { issuesAssigned: 3, issuesClosed: 2, avgCycleTimeHours: 18 },
    })

    vi.advanceTimersByTime(1100)

    // Session 2: More agent metrics
    bus.publish('agents', 'snapshot', {
      sessionId: 'session-2',
      ripley: { issuesAssigned: 6, issuesClosed: 4, avgCycleTimeHours: 20 },
      kane: { issuesAssigned: 2, issuesClosed: 1, avgCycleTimeHours: 30 },
    })

    vi.advanceTimersByTime(1100)

    // Verify both sessions recorded
    expect(metricsCollected.filter(m => m.channel === 'agents')).toHaveLength(2)

    // Query aggregated data
    const rows = db.prepare(`
      SELECT * FROM metrics_snapshots WHERE channel = 'agents' ORDER BY timestamp
    `).all()

    expect(rows).toHaveLength(2)
    const session1Data = JSON.parse(rows[0].data)
    const session2Data = JSON.parse(rows[1].data)

    expect(session1Data.ripley.issuesClosed).toBe(3)
    expect(session2Data.ripley.issuesClosed).toBe(4)
  })

  it('should aggregate issue metrics across time windows', () => {
    const baseTime = Date.now()

    // Emit metrics at different intervals
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(baseTime + i * 60000) // Every minute
      
      bus.publish('issues', 'snapshot', {
        timestamp: new Date().toISOString(),
        open: 10 + i,
        closed: 20 + i,
        blocked: 2 - Math.min(i, 2),
      })

      vi.advanceTimersByTime(1100)
    }

    // Query time-series data
    const rows = db.prepare(`
      SELECT * FROM metrics_snapshots WHERE channel = 'issues' ORDER BY timestamp
    `).all()

    expect(rows).toHaveLength(5)

    // Verify progression
    const firstSnapshot = JSON.parse(rows[0].data)
    const lastSnapshot = JSON.parse(rows[4].data)

    expect(firstSnapshot.open).toBe(10)
    expect(lastSnapshot.open).toBe(14)
    expect(firstSnapshot.blocked).toBe(2)
    expect(lastSnapshot.blocked).toBe(0)
  })

  it('should calculate aggregate statistics across multiple snapshots', () => {
    // Emit 10 snapshots with varying values
    for (let i = 0; i < 10; i++) {
      bus.publish('agents', 'snapshot', {
        ripley: {
          issuesAssigned: 5 + i,
          issuesClosed: 2 + Math.floor(i / 2),
          avgCycleTimeHours: 20 + i * 2,
        },
      })
      vi.advanceTimersByTime(1100)
    }

    // Query and calculate aggregates
    const rows = db.prepare(`
      SELECT data FROM metrics_snapshots WHERE channel = 'agents'
    `).all()

    expect(rows).toHaveLength(10)

    // Calculate average cycle time across all snapshots
    const cycleTimes = rows.map(row => {
      const data = JSON.parse(row.data)
      return data.ripley.avgCycleTimeHours
    })

    const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    expect(avgCycleTime).toBeCloseTo(29, 0) // (20+22+24+...+38) / 10 = 29

    // Calculate total issues closed
    const totalClosed = rows.reduce((sum, row) => {
      const data = JSON.parse(row.data)
      return sum + data.ripley.issuesClosed
    }, 0)

    expect(totalClosed).toBeGreaterThan(0)
  })

  it('should handle concurrent writes from multiple channels', () => {
    // Simulate concurrent metrics from different channels
    for (let i = 0; i < 5; i++) {
      bus.publish('agents', 'snapshot', { agentId: `agent-${i}` })
      bus.publish('issues', 'snapshot', { issueCount: i * 10 })
      vi.advanceTimersByTime(100)
    }

    vi.advanceTimersByTime(1000)

    // Both channels should have data
    const agentRows = db.prepare(`
      SELECT COUNT(*) as count FROM metrics_snapshots WHERE channel = 'agents'
    `).get()

    const issueRows = db.prepare(`
      SELECT COUNT(*) as count FROM metrics_snapshots WHERE channel = 'issues'
    `).get()

    expect(agentRows.count).toBeGreaterThan(0)
    expect(issueRows.count).toBeGreaterThan(0)
  })

  it('should support time-range queries for metrics', () => {
    const now = Date.now()

    // Insert metrics at different timestamps
    for (let i = 0; i < 24; i++) { // 24 hours
      const timestamp = new Date(now + i * 3600000).toISOString() // Every hour
      
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data)
        VALUES (?, ?, ?)
      `).run('agents', timestamp, JSON.stringify({ hour: i }))
    }

    // Query last 12 hours
    const cutoff = new Date(now + 12 * 3600000).toISOString()
    const recent = db.prepare(`
      SELECT * FROM metrics_snapshots 
      WHERE channel = 'agents' AND timestamp >= ?
      ORDER BY timestamp
    `).all(cutoff)

    expect(recent.length).toBeGreaterThanOrEqual(12)

    // Query first 6 hours
    const early = db.prepare(`
      SELECT * FROM metrics_snapshots 
      WHERE channel = 'agents' AND timestamp < ?
      ORDER BY timestamp
    `).all(cutoff)

    expect(early.length).toBeGreaterThanOrEqual(12)
  })

  it('should aggregate metrics by interval (hourly rollup)', () => {
    // Use a time at the start of an hour to ensure all 60 minutes are in same hour
    const baseDate = new Date()
    baseDate.setMinutes(0, 0, 0)
    const baseTime = baseDate.getTime()

    // Insert 60 minute-level snapshots (1 hour worth)
    for (let i = 0; i < 60; i++) {
      const timestamp = new Date(baseTime + i * 60000).toISOString()
      
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data)
        VALUES (?, ?, ?)
      `).run('issues', timestamp, JSON.stringify({ open: 10 + i }))
    }

    // Group by hour
    const hourly = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00', timestamp) as hour,
        AVG(json_extract(data, '$.open')) as avg_open,
        COUNT(*) as count
      FROM metrics_snapshots
      WHERE channel = 'issues'
      GROUP BY hour
      ORDER BY hour
    `).all()

    expect(hourly).toHaveLength(1) // All in same hour
    expect(hourly[0].count).toBe(60)
    expect(hourly[0].avg_open).toBeCloseTo(39.5, 1) // (10+69)/2 = 39.5
  })

  it('should handle deduplication via hash', () => {
    const duplicateData = { ripley: { issuesClosed: 5 } }
    const hash = JSON.stringify(duplicateData)

    // First insert
    db.prepare(`
      INSERT INTO metrics_snapshots (channel, timestamp, data, hash)
      VALUES (?, ?, ?, ?)
    `).run('agents', new Date().toISOString(), JSON.stringify(duplicateData), hash)

    // Check for duplicate before second insert
    const existing = db.prepare(`
      SELECT id FROM metrics_snapshots WHERE channel = ? AND hash = ?
    `).get('agents', hash)

    expect(existing).toBeTruthy()

    // If hash exists, skip insert (deduplication)
    if (!existing) {
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data, hash)
        VALUES (?, ?, ?, ?)
      `).run('agents', new Date().toISOString(), JSON.stringify(duplicateData), hash)
    }

    // Should still have only 1 row
    const count = db.prepare(`
      SELECT COUNT(*) as count FROM metrics_snapshots WHERE channel = 'agents'
    `).get()

    expect(count.count).toBe(1)
  })

  it('should support deletion of old metrics (retention policy)', () => {
    const now = Date.now()

    // Insert metrics: 20 old (>30 days) + 10 recent (<30 days)
    for (let i = 0; i < 30; i++) {
      const daysAgo = i + 20  // Days 20-49 ago (some >30)
      const timestamp = new Date(now - daysAgo * 86400000).toISOString()
      
      db.prepare(`
        INSERT INTO metrics_snapshots (channel, timestamp, data)
        VALUES (?, ?, ?)
      `).run('agents', timestamp, JSON.stringify({ day: daysAgo }))
    }

    const totalBefore = db.prepare(`
      SELECT COUNT(*) as count FROM metrics_snapshots
    `).get()

    expect(totalBefore.count).toBe(30)

    // Delete metrics older than 30 days
    const cutoff = new Date(now - 30 * 86400000).toISOString()
    db.prepare(`
      DELETE FROM metrics_snapshots WHERE timestamp < ?
    `).run(cutoff)

    const totalAfter = db.prepare(`
      SELECT COUNT(*) as count FROM metrics_snapshots
    `).get()

    // Should have deleted records from days 31-49 (19 records)
    expect(totalAfter.count).toBeLessThan(totalBefore.count)
    expect(totalAfter.count).toBeGreaterThanOrEqual(10)  // At least the recent ones remain
  })

  it('should calculate per-agent productivity trends', () => {
    const agents = ['ripley', 'dallas', 'kane']
    
    // 5 snapshots for each agent
    for (let i = 0; i < 5; i++) {
      const agentData = {}
      agents.forEach(agent => {
        agentData[agent] = {
          issuesAssigned: 5 + i,
          issuesClosed: 2 + i,
          avgCycleTimeHours: 24 - i * 2,
        }
      })

      bus.publish('agents', 'snapshot', agentData)
      vi.advanceTimersByTime(1100)
    }

    // Query per-agent trends
    const rows = db.prepare(`
      SELECT data FROM metrics_snapshots WHERE channel = 'agents' ORDER BY timestamp
    `).all()

    expect(rows).toHaveLength(5)

    // Extract ripley's trend
    const ripleyClosed = rows.map(row => JSON.parse(row.data).ripley.issuesClosed)
    
    // Should show increasing trend: [2, 3, 4, 5, 6]
    expect(ripleyClosed[0]).toBe(2)
    expect(ripleyClosed[4]).toBe(6)
    expect(ripleyClosed[4]).toBeGreaterThan(ripleyClosed[0])
  })

  it('should support metric snapshots with nested JSON data', () => {
    const complexData = {
      agents: {
        ripley: { 
          issuesClosed: 5, 
          velocity: { last7Days: 3, last30Days: 15 },
          breakdown: { bugs: 2, features: 3 },
        },
        dallas: {
          issuesClosed: 3,
          velocity: { last7Days: 2, last30Days: 10 },
          breakdown: { bugs: 1, features: 2 },
        },
      },
    }

    bus.publish('agents', 'snapshot', complexData)
    vi.advanceTimersByTime(1100)

    const row = db.prepare(`
      SELECT data FROM metrics_snapshots WHERE channel = 'agents' LIMIT 1
    `).get()

    const parsed = JSON.parse(row.data)
    expect(parsed.agents.ripley.velocity.last7Days).toBe(3)
    expect(parsed.agents.dallas.breakdown.bugs).toBe(1)
  })
})
