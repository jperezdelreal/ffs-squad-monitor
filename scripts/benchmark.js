#!/usr/bin/env node
/**
 * Performance Benchmark Runner
 *
 * Orchestrates API and SSE benchmarks against a running server instance.
 * Outputs human-readable summary + JSON report.
 *
 * Usage:
 *   npm run benchmark                    # Start server, run benchmarks, stop
 *   node scripts/benchmark.js [baseUrl]  # Run against existing server
 */

import { performance } from 'node:perf_hooks'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { runApiBenchmarks } from './benchmark-api.js'
import { runSseBenchmarks } from './benchmark-sse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const DEFAULT_BASE_URL = 'http://localhost:3001'
const BENCHMARK_PORT = process.env.BENCHMARK_PORT || '3002'
const BENCHMARK_BASE_URL = `http://localhost:${BENCHMARK_PORT}`

// Baseline thresholds for pass/fail
const BASELINE = {
  api: {
    coldStart: { max: 5000 },  // 5s to first /health response
    endpoints: {
      '/health':            { p95: 100 },
      '/api/heartbeat':     { p95: 200 },
      '/api/config':        { p95: 100 },
      '/api/health':        { p95: 500 },
      '/api/issues':        { p95: 2000 },
      '/api/events':        { p95: 2000 },
      '/api/agents':        { p95: 3000 },
      '/api/repos':         { p95: 5000 },
      '/api/pulse':         { p95: 3000 },
      '/api/usage':         { p95: 3000 },
      '/api/metrics/stats': { p95: 500 },
    },
    concurrent: { maxMean: 500 },
  },
  sse: {
    timeToFirstEvent: { max: 500 },
    minConcurrent: 20,
    memPerConnectionKB: 50,
    keepaliveReliability: true,
  },
}

function waitForServer(baseUrl, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const check = () => {
      http.get(`${baseUrl}/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume()
          resolve(performance.now() - start)
        } else {
          res.resume()
          retry()
        }
      }).on('error', retry)
    }

    function retry() {
      if (performance.now() - start > timeoutMs) {
        reject(new Error(`Server not ready after ${timeoutMs}ms`))
        return
      }
      setTimeout(check, 200)
    }

    check()
  })
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server/index.js'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', PORT: BENCHMARK_PORT },
    })

    let started = false
    const timeout = setTimeout(() => {
      if (!started) {
        child.kill()
        reject(new Error('Server failed to start within 15s'))
      }
    }, 15_000)

    child.stdout.on('data', () => {
      // Server is writing output
    })

    child.stderr.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('EADDRINUSE')) {
        clearTimeout(timeout)
        child.kill()
        reject(new Error(`Port ${BENCHMARK_PORT} already in use`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    // Give the server a moment to bind, then verify
    setTimeout(async () => {
      try {
        await waitForServer(BENCHMARK_BASE_URL, 12_000)
        started = true
        clearTimeout(timeout)
        resolve(child)
      } catch (err) {
        child.kill()
        reject(err)
      }
    }, 1000)
  })
}

function evaluateResults(apiResults, sseResults) {
  const verdicts = []
  let hasFailure = false

  // Cold start
  if (apiResults.coldStart) {
    const pass = apiResults.coldStart.status === 'ok' &&
      apiResults.coldStart.elapsed <= BASELINE.api.coldStart.max
    verdicts.push({
      metric: 'Cold start',
      value: `${apiResults.coldStart.elapsed}ms`,
      threshold: `<${BASELINE.api.coldStart.max}ms`,
      verdict: pass ? 'PASS' : 'FAIL',
    })
    if (!pass) hasFailure = true
  }

  // Endpoint p95
  for (const ep of apiResults.endpoints) {
    if (ep.error) {
      verdicts.push({ metric: ep.endpoint, value: 'ERROR', threshold: 'N/A', verdict: 'FAIL' })
      hasFailure = true
      continue
    }
    const threshold = BASELINE.api.endpoints[ep.endpoint]
    if (threshold) {
      const pass = ep.stats.p95 <= threshold.p95
      const warn = ep.stats.p95 <= threshold.p95 * 1.5
      const verdict = pass ? 'PASS' : warn ? 'WARN' : 'FAIL'
      verdicts.push({
        metric: `${ep.endpoint} p95`,
        value: `${ep.stats.p95}ms`,
        threshold: `<${threshold.p95}ms`,
        verdict,
      })
      if (verdict === 'FAIL') hasFailure = true
    }
  }

  // Concurrent
  for (const cr of apiResults.concurrent) {
    if (cr.stats) {
      const pass = cr.stats.mean <= BASELINE.api.concurrent.maxMean
      verdicts.push({
        metric: `Concurrent ${cr.endpoint}`,
        value: `mean=${cr.stats.mean}ms`,
        threshold: `<${BASELINE.api.concurrent.maxMean}ms`,
        verdict: pass ? 'PASS' : 'FAIL',
      })
      if (!pass) hasFailure = true
    }
  }

  // SSE: time to first event
  if (sseResults.timeToFirstEvent) {
    const ttfe = sseResults.timeToFirstEvent.firstEventTime
    const pass = ttfe !== null && ttfe <= BASELINE.sse.timeToFirstEvent.max
    verdicts.push({
      metric: 'SSE time to first event',
      value: ttfe !== null ? `${ttfe}ms` : 'N/A',
      threshold: `<${BASELINE.sse.timeToFirstEvent.max}ms`,
      verdict: pass ? 'PASS' : 'WARN',
    })
  }

  // SSE: concurrent connections
  if (sseResults.concurrentConnections) {
    const cc = sseResults.concurrentConnections
    const pass = cc.successful >= BASELINE.sse.minConcurrent
    verdicts.push({
      metric: 'SSE concurrent connections',
      value: `${cc.successful}`,
      threshold: `≥${BASELINE.sse.minConcurrent}`,
      verdict: pass ? 'PASS' : 'FAIL',
    })
    if (!pass) hasFailure = true

    const memPass = cc.memPerConnectionKB <= BASELINE.sse.memPerConnectionKB
    verdicts.push({
      metric: 'SSE memory per connection',
      value: `${cc.memPerConnectionKB}KB`,
      threshold: `<${BASELINE.sse.memPerConnectionKB}KB`,
      verdict: memPass ? 'PASS' : 'WARN',
    })
  }

  // SSE: keepalive
  if (sseResults.keepalive) {
    verdicts.push({
      metric: 'SSE keepalive',
      value: `${sseResults.keepalive.keepaliveCount} keepalives`,
      threshold: `≥${sseResults.keepalive.expectedKeepalives}`,
      verdict: sseResults.keepalive.verdict,
    })
  }

  return { verdicts, hasFailure }
}

function printSummary(evaluation) {
  console.log('\n' + '═'.repeat(72))
  console.log('  BENCHMARK RESULTS SUMMARY')
  console.log('═'.repeat(72))

  for (const v of evaluation.verdicts) {
    const icon = v.verdict === 'PASS' ? '✅' : v.verdict === 'WARN' ? '⚠️' : '❌'
    const metric = v.metric.padEnd(32)
    const value = v.value.padEnd(16)
    const threshold = `(threshold: ${v.threshold})`
    console.log(`  ${icon} ${metric} ${value} ${threshold}`)
  }

  console.log('─'.repeat(72))
  const passCount = evaluation.verdicts.filter(v => v.verdict === 'PASS').length
  const warnCount = evaluation.verdicts.filter(v => v.verdict === 'WARN').length
  const failCount = evaluation.verdicts.filter(v => v.verdict === 'FAIL').length
  console.log(`  Total: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`)
  console.log('═'.repeat(72))
}

async function main() {
  const externalUrl = process.argv[2]
  const baseUrl = externalUrl || BENCHMARK_BASE_URL
  let serverProcess = null

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  FFS Squad Monitor — Performance Benchmarks             ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\nTarget: ${baseUrl}`)

  // Start server if no external URL provided
  if (!externalUrl) {
    console.log(`\nStarting server on port ${BENCHMARK_PORT}...`)
    try {
      serverProcess = await startServer()
      console.log('  Server started ✅\n')
    } catch (err) {
      // If port is in use, try connecting to existing server
      if (err.message.includes('already in use')) {
        console.log(`  Port ${BENCHMARK_PORT} in use — using existing server\n`)
      } else {
        console.error(`  Failed to start server: ${err.message}`)
        process.exit(1)
      }
    }
  }

  const totalStart = performance.now()

  try {
    // Run API benchmarks
    console.log('━'.repeat(60))
    console.log('API Response Time Benchmarks')
    console.log('━'.repeat(60))
    const apiResults = await runApiBenchmarks(baseUrl)

    // Run SSE benchmarks
    console.log('\n' + '━'.repeat(60))
    console.log('SSE Connection Benchmarks')
    console.log('━'.repeat(60))
    const sseResults = await runSseBenchmarks(baseUrl)

    const totalElapsed = performance.now() - totalStart

    // Evaluate results
    const evaluation = evaluateResults(apiResults, sseResults)
    printSummary(evaluation)

    // Build report
    const report = {
      timestamp: new Date().toISOString(),
      totalDurationMs: Math.round(totalElapsed),
      baseline: BASELINE,
      api: apiResults,
      sse: sseResults,
      summary: {
        verdicts: evaluation.verdicts,
        passed: evaluation.verdicts.filter(v => v.verdict === 'PASS').length,
        warnings: evaluation.verdicts.filter(v => v.verdict === 'WARN').length,
        failures: evaluation.verdicts.filter(v => v.verdict === 'FAIL').length,
        overall: evaluation.hasFailure ? 'FAIL' : 'PASS',
      },
    }

    // Write JSON report
    const reportPath = path.resolve(PROJECT_ROOT, 'benchmark-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nReport written to benchmark-report.json`)
    console.log(`Total benchmark duration: ${Math.round(totalElapsed)}ms`)

    // Exit code based on hard failures only (>50% over threshold)
    const hardFailCount = evaluation.verdicts.filter(v => v.verdict === 'FAIL').length
    if (hardFailCount > 0) {
      console.log(`\n${hardFailCount} metric(s) exceeded threshold by >50% — exiting with code 1`)
    }

    return hardFailCount > 0 ? 1 : 0
  } finally {
    // Stop server if we started it
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      // Give it a moment to shut down gracefully
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Benchmark runner failed:', err)
    process.exit(1)
  })
