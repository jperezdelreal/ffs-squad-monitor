#!/usr/bin/env node
/**
 * Bundle size checker — reads Vite build output and enforces size budgets.
 * Exit code 1 if any budget is exceeded, 0 otherwise.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, '..', 'dist')

// Budget thresholds (raw sizes in KB)
const BUDGETS = {
  totalJS: { warn: 180, error: 250 },
  totalCSS: { warn: 60, error: 100 },
  total: { warn: 300, error: 400 },
}

function getFileSizes(dir, ext) {
  if (!fs.existsSync(dir)) return []
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getFileSizes(full, ext))
    } else if (entry.name.endsWith(ext)) {
      const stat = fs.statSync(full)
      results.push({ name: path.relative(DIST, full), size: stat.size })
    }
  }
  return results
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ directory not found. Run "npm run build" first.')
    process.exit(1)
  }

  const jsFiles = getFileSizes(DIST, '.js')
  const cssFiles = getFileSizes(DIST, '.css')
  const htmlFiles = getFileSizes(DIST, '.html')

  // Read index.html to determine initial vs lazy chunks
  const indexPath = path.join(DIST, 'index.html')
  const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : ''
  
  // Extract chunk filenames from index.html (modulepreload + script src)
  const initialChunkNames = new Set()
  const chunkRegex = /(?:href|src)="[^"]*\/assets\/([^"]+\.js)"/g
  let match
  while ((match = chunkRegex.exec(indexHtml)) !== null) {
    initialChunkNames.add(match[1])
  }

  const initialJS = jsFiles.filter(f => initialChunkNames.has(path.basename(f.name)))
  const lazyJS = jsFiles.filter(f => !initialChunkNames.has(path.basename(f.name)))

  const totalJS = jsFiles.reduce((sum, f) => sum + f.size, 0)
  const initialJSSize = initialJS.reduce((sum, f) => sum + f.size, 0)
  const lazyJSSize = lazyJS.reduce((sum, f) => sum + f.size, 0)
  const totalCSS = cssFiles.reduce((sum, f) => sum + f.size, 0)
  const totalHTML = htmlFiles.reduce((sum, f) => sum + f.size, 0)
  const total = totalJS + totalCSS + totalHTML
  const initialBundleSize = initialJSSize + totalCSS

  console.log('\nBundle Size Report (Code-Split)')
  console.log('='.repeat(60))

  console.log('\n📦 Initial Load JavaScript (loaded on app start):')
  initialJS.sort((a, b) => b.size - a.size)
  for (const f of initialJS) {
    console.log(`  ${f.name.padEnd(40)} ${formatSize(f.size)}`)
  }
  console.log(`  ${'INITIAL JS TOTAL'.padEnd(40)} ${formatSize(initialJSSize)}`)

  if (lazyJS.length > 0) {
    console.log('\n🔄 Lazy-Loaded JavaScript (loaded on demand):')
    lazyJS.sort((a, b) => b.size - a.size)
    for (const f of lazyJS) {
      console.log(`  ${f.name.padEnd(40)} ${formatSize(f.size)}`)
    }
    console.log(`  ${'LAZY JS TOTAL'.padEnd(40)} ${formatSize(lazyJSSize)}`)
  }

  console.log('\n🎨 CSS files:')
  cssFiles.sort((a, b) => b.size - a.size)
  for (const f of cssFiles) {
    console.log(`  ${f.name.padEnd(40)} ${formatSize(f.size)}`)
  }
  console.log(`  ${'Total CSS'.padEnd(40)} ${formatSize(totalCSS)}`)

  if (htmlFiles.length) {
    console.log('\n📄 HTML files:')
    for (const f of htmlFiles) {
      console.log(`  ${f.name.padEnd(40)} ${formatSize(f.size)}`)
    }
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`  ${'🚀 Initial Bundle (JS + CSS)'.padEnd(40)} ${formatSize(initialBundleSize)}`)
  console.log(`  ${'📊 Total Assets (incl. lazy)'.padEnd(40)} ${formatSize(total)}`)
  console.log('-'.repeat(60))

  let hasWarning = false
  let hasError = false

  const checks = [
    { label: 'Initial JS', value: initialJSSize / 1024, budget: BUDGETS.initialJS },
    { label: 'Total CSS', value: totalCSS / 1024, budget: BUDGETS.totalCSS },
    { label: 'Initial Bundle', value: initialBundleSize / 1024, budget: BUDGETS.initial },
  ]

  console.log('\n✅ Budget Check')
  for (const { label, value, budget } of checks) {
    if (value > budget.error) {
      console.log(`  ❌ FAIL ${label}: ${value.toFixed(1)} KB exceeds ${budget.error} KB limit`)
      hasError = true
    } else if (value > budget.warn) {
      console.log(`  ⚠️  WARN ${label}: ${value.toFixed(1)} KB approaching ${budget.error} KB limit (warn: ${budget.warn} KB)`)
      hasWarning = true
    } else {
      console.log(`  ✓ OK   ${label}: ${value.toFixed(1)} KB (limit: ${budget.error} KB)`)
    }
  }

  // Write JSON report for CI consumption
  const report = {
    timestamp: new Date().toISOString(),
    files: { js: jsFiles, css: cssFiles, html: htmlFiles },
    chunks: { initial: initialJS, lazy: lazyJS },
    totals: { 
      js: totalJS,
      initialJS: initialJSSize,
      lazyJS: lazyJSSize,
      css: totalCSS, 
      html: totalHTML, 
      total,
      initialBundle: initialBundleSize,
    },
    budgets: BUDGETS,
    status: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
  }

  const reportPath = path.resolve(__dirname, '..', 'bundle-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📝 Report written to bundle-report.json`)

  if (hasError) {
    console.log('\n❌ Bundle size budget exceeded!')
    process.exit(1)
  }

  if (hasWarning) {
    console.log('\n⚠️  Bundle size approaching limits.')
  } else {
    console.log('\n✅ All bundle sizes within budget.')
  }
}

main()
