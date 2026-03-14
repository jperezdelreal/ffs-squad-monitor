// Lightweight CSV serializer with proper escaping
// UTF-8 BOM for Excel compatibility

const BOM = '\uFEFF'

function escapeField(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(rows, columns) {
  const header = columns.map(c => escapeField(c.label || c.key)).join(',')
  const lines = rows.map(row =>
    columns.map(c => {
      const val = typeof c.value === 'function' ? c.value(row) : row[c.key]
      return escapeField(val)
    }).join(',')
  )
  return BOM + header + '\n' + lines.join('\n') + '\n'
}

export function setDownloadHeaders(res, filename, format) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
  }
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}