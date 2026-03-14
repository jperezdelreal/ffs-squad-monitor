#!/usr/bin/env node
/**
 * API Response Time Benchmarks
 *
 * Measures response times (p50, p95, p99) for all API endpoints
 * and tests concurrent request handling.
 *
 * Uses perf_hooks for precise timing. No external dependencies.
 */

import { performance } from 'node:perf_hooks'
import http from 'node:http'

const DEFAULT_BASE_URL = 'http://localhost:3001'
const REQUEST_COUNT = 100
const EXTERNAL_REQUEST_COUNT = 20  // Fewer iterations for GitHub-dependent endpoints
const CONCURRENT_COUNT = 10

function httpGet(url, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const req = http.get(url, { timeout }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        resolve({
          elapsed: performance.now() - start,
          status: res.statusCode,
          size: Buffer.byteLength(body),
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request to ${url} timed out after ${timeout}ms`))
    })
  })
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function computeStats(times) {
  const sorted = [...times].sort((a, b) => a - b)
  return {
    min: sorted[0],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    mean: times.reduce((s, t) => s + t, 0) / times.length,
    count: times.length,
  }
}

function roundMs(v) {
  return Math.round(v * 100) / 100
}

// Thresholds: p95 value in milliseconds
// External endpoints (GitHub API) use fewer iterations and higher thresholds
const THRESHOLDS = {
  '/health':           { p95: 100, count: REQUEST_COUNT },
  '/api/heartbeat':    { p95: 200, count: REQUEST_COUNT },
  '/api/config':       { p95: 100, count: REQUEST_COUNT },
  '/api/health':       { p95: 500, count: REQUEST_COUNT },
  '/api/issues':       { p95: 2000, count: EXTERNAL_REQUEST_COUNT },
  '/api/events':       { p95: 2000, count: EXTERNAL_REQUEST_COUNT },
  '/api/agents':       { p95: 3000, count: EXTERNAL_REQUEST_COUNT },
  '/api/repos':        { p95: 5000, count: EXTERNAL_REQUEST_COUNT },
  '/api/pulse':        { p95: 3000, count: EXTERNAL_REQUEST_COUNT },
  '/api/usage':        { p95: 3000, count: EXTERNAL_REQUEST_COUNT },
  '/api/metrics/stats': { p95: 500, count: REQUEST_COUNT },
}

export async function measureColdStart(baseUrl) {
  const start = performance.now()
  let elapsed = 0
  let attempts = 0
  const maxWait = 15_000

  while (performance.now() - start < maxWait) {
    attempts++
    try {
      const result = await httpGet(`${baseUrl}/health`, 3000)
      if (result.status === 200) {
        elapsed = performance.now() - start
        return { elapsed: roundMs(elapsed), attempts, status: 'ok' }
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 100))
  }

  return { elapsed: roundMs(performance.now() - start), attempts, status: 'timeout' }
}

export async function benchmarkEndpoint(baseUrl, endpoint, count = REQUEST_COUNT) {
  const url = `${baseUrl}${endpoint}`
  const times = []
  const errors = []

  for (let i = 0; i < count; i++) {
    try {
      const result = await httpGet(url)
      if (result.status >= 200 && result.status < 400) {
        times.push(result.elapsed)
      } else {
        errors.push({ status: result.status, iteration: i })
      }
    } catch (err) {
      errors.push({ message: err.message, iteration: i })
    }
  }

  if (times.length === 0) {
    return { endpoint, error: 'All requests failed', errors }
  }

  const stats = computeStats(times)
  const threshold = THRESHOLDS[endpoint]
  let verdict = 'N/A'
  if (threshold) {
    if (stats.p95 <= threshold.p95) verdict = 'PASS'
    else if (stats.p95 <= threshold.p95 * 1.5) verdict = 'WARN'
    else verdict = 'FAIL'
  }

  return {
    endpoint,
    stats: {
      min: roundMs(stats.min),
      p50: roundMs(stats.p50),
      p95: roundMs(stats.p95),
      p99: roundMs(stats.p99),
      max: roundMs(stats.max),
      mean: roundMs(stats.mean),
      count: stats.count,
    },
    threshold: threshold || null,
    verdict,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function benchmarkConcurrent(baseUrl, endpoint, concurrency = CONCURRENT_COUNT) {
  const url = `${baseUrl}${endpoint}`
  const start = performance.now()

  const promises = Array.from({ length: concurrency }, () => httpGet(url))
  const results = await Promise.allSettled(promises)
  const totalElapsed = performance.now() - start

  const times = []
  const errors = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      times.push(r.value.elapsed)
    } else {
      errors.push(r.reason.message)
    }
  }

  return {
    endpoint,
    concurrency,
    totalElapsed: roundMs(totalElapsed),
    stats: times.length > 0 ? {
      min: roundMs(Math.min(...times)),
      max: roundMs(Math.max(...times)),
      mean: roundMs(times.reduce((s, t) => s + t, 0) / times.length),
      successCount: times.length,
    } : null,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function runApiBenchmarks(baseUrl = DEFAULT_BASE_URL) {
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl,
    coldStart: null,
    endpoints: [],
    concurrent: [],
  }

  // 1. Cold start (measure time to first /health response)
  console.log('  Measuring cold start (waiting for /health)...')
  results.coldStart = await measureColdStart(baseUrl)
  console.log(`    Cold start: ${results.coldStart.elapsed}ms (${results.coldStart.status})`)

  // 2. Sequential endpoint benchmarks
  const endpoints = Object.keys(THRESHOLDS)
  for (const endpoint of endpoints) {
    const count = THRESHOLDS[endpoint].count || REQUEST_COUNT
    process.stdout.write(`  Benchmarking ${endpoint} (${count} requests)...`)
    const result = await benchmarkEndpoint(baseUrl, endpoint, count)
    const icon = result.verdict === 'PASS' ? '✅' : result.verdict === 'WARN' ? '⚠️' : '❌'
    console.log(` p50=${result.stats?.p50}ms p95=${result.stats?.p95}ms ${icon}`)
    results.endpoints.push(result)
  }

  // 3. Concurrent request handling
  const concurrentEndpoints = ['/health', '/api/heartbeat', '/api/config']
  for (const endpoint of concurrentEndpoints) {
    process.stdout.write(`  Concurrent ${endpoint} (${CONCURRENT_COUNT} simultaneous)...`)
    const result = await benchmarkConcurrent(baseUrl, endpoint)
    console.log(` total=${result.totalElapsed}ms, mean=${result.stats?.mean}ms`)
    results.concurrent.push(result)
  }

  return results
}

// Direct execution
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL
  console.log(`\nAPI Benchmarks — ${baseUrl}\n`)
  runApiBenchmarks(baseUrl)
    .then(results => {
      console.log('\n' + JSON.stringify(results, null, 2))
    })
    .catch(err => {
      console.error('Benchmark failed:', err.message)
      process.exit(1)
    })
}
