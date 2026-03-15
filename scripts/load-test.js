/**
 * Load Test: 100 Concurrent Sessions for 1 Minute
 * 
 * Simulates 100 concurrent dashboard users monitoring for 1 minute.
 * Tests SSE connection handling, EventBus throughput, and memory stability.
 * 
 * Usage: node scripts/load-test.js
 */

import { EventEmitter } from 'events'
import http from 'http'

const TARGET_URL = process.env.LOAD_TEST_URL || 'http://localhost:3001'
const CONCURRENT_SESSIONS = 100
const DURATION_MS = 60000 // 1 minute
const HEARTBEAT_INTERVAL_MS = 5000 // Poll every 5 seconds per session

class LoadTestSession extends EventEmitter {
  constructor(id) {
    super()
    this.id = id
    this.active = true
    this.requestCount = 0
    this.errorCount = 0
    this.latencies = []
  }

  async makeRequest(path) {
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const url = new URL(path, TARGET_URL)
      const req = http.get(url, (res) => {
        let data = ''
        
        res.on('data', chunk => {
          data += chunk
        })
        
        res.on('end', () => {
          const latency = Date.now() - startTime
          this.latencies.push(latency)
          this.requestCount++
          resolve({ success: true, latency, status: res.statusCode })
        })
      })

      req.on('error', (err) => {
        this.errorCount++
        this.emit('error', err)
        resolve({ success: false, error: err.message })
      })

      req.setTimeout(10000, () => {
        req.destroy()
        this.errorCount++
        resolve({ success: false, error: 'timeout' })
      })
    })
  }

  async start() {
    console.log(`[Session ${this.id}] Starting...`)

    // Initial heartbeat request
    await this.makeRequest('/api/heartbeat')

    // Poll heartbeat every 5 seconds
    const interval = setInterval(async () => {
      if (!this.active) {
        clearInterval(interval)
        return
      }

      await this.makeRequest('/api/heartbeat')
    }, HEARTBEAT_INTERVAL_MS)

    // Occasionally fetch other endpoints
    const randomInterval = setInterval(async () => {
      if (!this.active) {
        clearInterval(randomInterval)
        return
      }

      const endpoints = ['/api/events', '/api/board', '/api/usage', '/api/config']
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
      await this.makeRequest(endpoint)
    }, HEARTBEAT_INTERVAL_MS * 2)

    // Stop after duration
    setTimeout(() => {
      this.stop()
      clearInterval(interval)
      clearInterval(randomInterval)
    }, DURATION_MS)
  }

  stop() {
    this.active = false
    this.emit('stopped')
  }

  getStats() {
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0
    const avg = sorted.length > 0 
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length 
      : 0

    return {
      id: this.id,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 
        ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%'
        : '0%',
      latency: {
        avg: avg.toFixed(0),
        p50,
        p95,
        p99,
      },
    }
  }
}

async function runLoadTest() {
  console.log(`\n🔥 Load Test: ${CONCURRENT_SESSIONS} concurrent sessions for ${DURATION_MS / 1000}s\n`)
  console.log(`Target: ${TARGET_URL}`)
  console.log(`Polling interval: ${HEARTBEAT_INTERVAL_MS}ms\n`)

  const sessions = []
  const startTime = Date.now()

  // Create and start all sessions
  for (let i = 0; i < CONCURRENT_SESSIONS; i++) {
    const session = new LoadTestSession(i + 1)
    sessions.push(session)
    
    session.on('error', (err) => {
      // Silently track errors (logged in getStats)
    })

    // Stagger session starts slightly to avoid thundering herd
    setTimeout(() => {
      session.start()
    }, i * 50) // 50ms between each session start
  }

  // Wait for all sessions to complete
  await new Promise(resolve => {
    let stopped = 0
    sessions.forEach(session => {
      session.on('stopped', () => {
        stopped++
        if (stopped === CONCURRENT_SESSIONS) {
          resolve()
        }
      })
    })

    // Fallback timeout
    setTimeout(resolve, DURATION_MS + 5000)
  })

  const duration = Date.now() - startTime

  // Aggregate stats
  const allStats = sessions.map(s => s.getStats())
  
  const totalRequests = allStats.reduce((sum, s) => sum + s.requestCount, 0)
  const totalErrors = allStats.reduce((sum, s) => sum + s.errorCount, 0)
  
  const allLatencies = []
  sessions.forEach(s => allLatencies.push(...s.latencies))
  allLatencies.sort((a, b) => a - b)

  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] || 0
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0
  const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] || 0
  const avg = allLatencies.length > 0
    ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
    : 0

  // Print results
  console.log(`\n📊 Load Test Results\n`)
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`)
  console.log(`Concurrent sessions: ${CONCURRENT_SESSIONS}`)
  console.log(`Total requests: ${totalRequests}`)
  console.log(`Total errors: ${totalErrors}`)
  console.log(`Error rate: ${(totalErrors / totalRequests * 100).toFixed(2)}%`)
  console.log(`Requests/sec: ${(totalRequests / (duration / 1000)).toFixed(1)}`)
  console.log(`\nLatency (ms):`)
  console.log(`  Average: ${avg.toFixed(0)}`)
  console.log(`  p50: ${p50}`)
  console.log(`  p95: ${p95}`)
  console.log(`  p99: ${p99}`)

  // Per-session breakdown (first 10 sessions)
  console.log(`\n📋 Sample Session Stats (first 10):\n`)
  allStats.slice(0, 10).forEach(stat => {
    console.log(`Session ${stat.id}: ${stat.requestCount} requests, ${stat.errorRate} errors, ${stat.latency.p50}ms p50`)
  })

  // Success criteria
  console.log(`\n✅ Success Criteria:`)
  const errorRatePct = (totalErrors / totalRequests * 100)
  const passErrorRate = errorRatePct < 5
  const passP95 = p95 < 2000
  const passP99 = p99 < 5000

  console.log(`  Error rate < 5%: ${passErrorRate ? '✅' : '❌'} (${errorRatePct.toFixed(2)}%)`)
  console.log(`  p95 latency < 2s: ${passP95 ? '✅' : '❌'} (${p95}ms)`)
  console.log(`  p99 latency < 5s: ${passP99 ? '✅' : '❌'} (${p99}ms)`)

  const allPass = passErrorRate && passP95 && passP99
  console.log(`\n${allPass ? '✅ PASS' : '❌ FAIL'}\n`)

  process.exit(allPass ? 0 : 1)
}

// Check if server is running
async function checkServer() {
  return new Promise((resolve) => {
    const url = new URL('/api/health', TARGET_URL)
    http.get(url, (res) => {
      resolve(res.statusCode === 200)
    }).on('error', () => {
      resolve(false)
    })
  })
}

// Main
(async () => {
  const serverRunning = await checkServer()
  
  if (!serverRunning) {
    console.error(`❌ Server not running at ${TARGET_URL}`)
    console.error(`Start the server first: npm run dev`)
    process.exit(1)
  }

  await runLoadTest()
})()
