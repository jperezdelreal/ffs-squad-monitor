import { describe, it, expect } from 'vitest'
import { toCsv, setDownloadHeaders } from '../csv.js'

describe('toCsv', () => {
  it('generates header row and data rows', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ]
    const csv = toCsv(rows, columns)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('\uFEFFName,Age')
    expect(lines[1]).toBe('Alice,30')
    expect(lines[2]).toBe('Bob,25')
  })

  it('escapes fields with commas and quotes', () => {
    const rows = [{ val: 'has, comma' }, { val: 'has "quote"' }]
    const columns = [{ key: 'val', label: 'Value' }]
    const csv = toCsv(rows, columns)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('"has, comma"')
    expect(lines[2]).toBe('"has ""quote"""')
  })

  it('escapes fields with newlines', () => {
    const rows = [{ val: 'line1\nline2' }]
    const columns = [{ key: 'val', label: 'Value' }]
    const csv = toCsv(rows, columns)
    expect(csv).toContain('"line1\nline2"')
  })

  it('handles null and undefined values', () => {
    const rows = [{ a: null, b: undefined }]
    const columns = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ]
    const csv = toCsv(rows, columns)
    const lines = csv.split('\n')
    expect(lines[1]).toBe(',')
  })

  it('supports custom value functions', () => {
    const rows = [{ tags: ['a', 'b', 'c'] }]
    const columns = [
      { key: 'tags', label: 'Tags', value: r => r.tags.join('; ') },
    ]
    const csv = toCsv(rows, columns)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('a; b; c')
  })

  it('includes trailing newline', () => {
    const csv = toCsv([{ x: 1 }], [{ key: 'x', label: 'X' }])
    expect(csv.endsWith('\n')).toBe(true)
  })
})

describe('setDownloadHeaders', () => {
  it('sets CSV content type and disposition', () => {
    const headers = {}
    const res = { setHeader: (k, v) => { headers[k] = v } }
    setDownloadHeaders(res, 'test.csv', 'csv')
    expect(headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(headers['Content-Disposition']).toBe('attachment; filename="test.csv"')
  })

  it('sets JSON content type and disposition', () => {
    const headers = {}
    const res = { setHeader: (k, v) => { headers[k] = v } }
    setDownloadHeaders(res, 'data.json', 'json')
    expect(headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(headers['Content-Disposition']).toBe('attachment; filename="data.json"')
  })
})
