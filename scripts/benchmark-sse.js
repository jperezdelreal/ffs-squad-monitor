#!/usr/bin/env node
/**
 * SSE Connection Benchmarks
 *
 * Measures: time to first event, concurrent connections,
 * memory per connection, and keepalive reliability.
 *
 * Uses raw http module (no EventSource dependency needed).
 */

import { performance } from 'node:perf_hooks'
import http from 'node:http'

const DEFAULT_BASE_URL = 'http://localhost:3001'

function parseBaseUrl(baseUrl) {
  const url = new URL(baseUrl)
  return { hostname: url.hostname, port: parseInt(url.port, 10) || 80 }
}

function connectSSE(baseUrl, channels = 'heartbeat', timeout = 10_000) {
  const { hostname, port } = parseBaseUrl(baseUrl)
  const path = `/api/sse?channels=${channels}`

  return new Promise((resolve, reject) => {
    const start = performance.now()
    let firstEventTime = null
    let eventCount = 0
    let buffer = ''

    const req = http.get({ hostname, port, path, timeout }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE returned status ${res.statusCode}`))
        return
      }

      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        buffer += chunk
        // Count complete events (double newline separated)
        const events = buffer.split('\n\n')
        while (events.length > 1) {
          const event = events.shift()
          if (event.trim() && !event.startsWith(':')) {
            eventCount++
            if (!firstEventTime) {
              firstEventTime = performance.now() - start
            }
          }
        }
        buffer = events[0] || ''
      })

      // Resolve with connection handle
      resolve({
        timeToConnect: performance.now() - start,
        getFirstEventTime: () => firstEventTime,
        getEventCount: () => eventCount,
        close: () => { req.destroy(); res.destroy() },
        res,
        req,
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('SSE connection timed out'))
    })
  })
}

function roundMs(v) {
  return Math.round(v * 100) / 100
}

export async function measureTimeToFirstEvent(baseUrl) {
  const start = performance.now()
  try {
    const conn = await connectSSE(baseUrl, 'heartbeat', 10_000)
    // The `connected` event should arrive almost immediately
    const connectTime = conn.timeToConnect

    // Wait briefly for the connected event to be parsed
    await new Promise(r => setTimeout(r, 500))

    const firstEventTime = conn.getFirstEventTime()
    conn.close()

    return {
      connectTime: roundMs(connectTime),
      firstEventTime: firstEventTime !== null ? roundMs(firstEventTime) : null,
      status: firstEventTime !== null ? 'ok' : 'no_event_received',
    }
  } catch (err) {
    return {
      connectTime: roundMs(performance.now() - start),
      firstEventTime: null,
      status: 'error',
      error: err.message,
    }
  }
}

export async function measureConcurrentConnections(baseUrl, maxConnections = 50) {
  const connections = []
  const memBefore = process.memoryUsage()
  let lastSuccess = 0
  let firstFailure = null

  for (let i = 0; i < maxConnections; i++) {
    try {
      const conn = await connectSSE(baseUrl, 'heartbeat,events', 5000)
      connections.push(conn)
      lastSuccess = i + 1
    } catch (err) {
      if (!firstFailure) {
        firstFailure = { connectionNumber: i + 1, error: err.message }
      }
      break
    }
  }

  // Wait for connected events
  await new Promise(r => setTimeout(r, 1000))

  const memAfter = process.memoryUsage()
  const heapDelta = memAfter.heapUsed - memBefore.heapUsed
  const memPerConnection = lastSuccess > 0 ? heapDelta / lastSuccess : 0

  // Check how many got the connected event
  let connectedCount = 0
  for (const conn of connections) {
    if (conn.getEventCount() > 0) connectedCount++
  }

  // Clean up
  for (const conn of connections) {
    conn.close()
  }

  // Wait for cleanup
  await new Promise(r => setTimeout(r, 500))

  return {
    attempted: maxConnections,
    successful: lastSuccess,
    receivedEvents: connectedCount,
    heapDeltaBytes: heapDelta,
    memPerConnectionBytes: Math.round(memPerConnection),
    memPerConnectionKB: roundMs(memPerConnection / 1024),
    firstFailure,
    verdict: lastSuccess >= 50 ? 'PASS' : lastSuccess >= 20 ? 'WARN' : 'FAIL',
  }
}

export async function measureKeepalive(baseUrl, durationMs = 20_000) {
  let keepaliveCount = 0
  let lastDataTime = null

  try {
    const { hostname, port } = parseBaseUrl(baseUrl)
    const path = '/api/sse?channels=heartbeat'

    return await new Promise((resolve, reject) => {
      const start = performance.now()

      const req = http.get({ hostname, port, path, timeout: durationMs + 5000 }, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          lastDataTime = performance.now() - start
          // Count keepalive comments
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith(': keepalive')) keepaliveCount++
          }
        })
      })

      req.on('error', reject)

      setTimeout(() => {
        req.destroy()
        const elapsed = performance.now() - start
        // Server sends keepalive every 15s; in 20s we expect at least 1
        const expectedKeepalives = Math.floor(durationMs / 15_000)
        resolve({
          durationMs: roundMs(elapsed),
          keepaliveCount,
          expectedKeepalives,
          lastDataTimeMs: lastDataTime !== null ? roundMs(lastDataTime) : null,
          verdict: keepaliveCount >= expectedKeepalives ? 'PASS' : 'WARN',
        })
      }, durationMs)
    })
  } catch (err) {
    return {
      durationMs: 0,
      keepaliveCount,
      error: err.message,
      verdict: 'FAIL',
    }
  }
}

export async function runSseBenchmarks(baseUrl = DEFAULT_BASE_URL) {
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl,
    timeToFirstEvent: null,
    concurrentConnections: null,
    keepalive: null,
  }

  // 1. Time to first event
  console.log('  Measuring time to first SSE event...')
  results.timeToFirstEvent = await measureTimeToFirstEvent(baseUrl)
  console.log(`    Connect: ${results.timeToFirstEvent.connectTime}ms, ` +
    `First event: ${results.timeToFirstEvent.firstEventTime ?? 'N/A'}ms ` +
    `(${results.timeToFirstEvent.status})`)

  // 2. Concurrent connections
  console.log('  Measuring concurrent SSE connections (up to 50)...')
  results.concurrentConnections = await measureConcurrentConnections(baseUrl, 50)
  const cc = results.concurrentConnections
  console.log(`    Successful: ${cc.successful}/${cc.attempted}, ` +
    `Memory/conn: ${cc.memPerConnectionKB}KB ${cc.verdict === 'PASS' ? '✅' : '⚠️'}`)

  // 3. Keepalive reliability (20 seconds)
  console.log('  Measuring keepalive reliability (20s)...')
  results.keepalive = await measureKeepalive(baseUrl, 20_000)
  const ka = results.keepalive
  console.log(`    Keepalives: ${ka.keepaliveCount} (expected ≥${ka.expectedKeepalives}) ` +
    `${ka.verdict === 'PASS' ? '✅' : '⚠️'}`)

  return results
}

// Direct execution
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL
  console.log(`\nSSE Benchmarks — ${baseUrl}\n`)
  runSseBenchmarks(baseUrl)
    .then(results => {
      console.log('\n' + JSON.stringify(results, null, 2))
    })
    .catch(err => {
      console.error('Benchmark failed:', err.message)
      process.exit(1)
    })
}
