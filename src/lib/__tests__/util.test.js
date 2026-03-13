import { describe, it, expect, beforeEach, vi } from 'vitest';
import { escapeHtml, formatDuration, timeAgo, downloadAsFile, jsonToCSV } from '../util.js';

describe('escapeHtml', () => {
  it('escapes basic HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles strings with no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('handles multiple entities', () => {
    expect(escapeHtml('<div class="test" data-value="a&b">content</div>'))
      .toBe('&lt;div class="test" data-value="a&amp;b"&gt;content&lt;/div&gt;');
  });

  it('prevents XSS with event handlers', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('formatDuration', () => {
  it('handles null and undefined', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('formats seconds under 60', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(600)).toBe('10m');
  });

  it('formats minutes with seconds', () => {
    expect(formatDuration(61)).toBe('1m 1s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('handles large durations', () => {
    expect(formatDuration(3600)).toBe('60m');
    expect(formatDuration(3661)).toBe('61m 1s');
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  it('handles null and undefined', () => {
    expect(timeAgo(null)).toBe('—');
    expect(timeAgo(undefined)).toBe('—');
    expect(timeAgo('')).toBe('—');
  });

  it('handles future dates', () => {
    const future = new Date('2026-01-01T12:01:00Z').toISOString();
    expect(timeAgo(future)).toBe('just now');
  });

  it('shows "just now" for recent times', () => {
    const recent = new Date('2026-01-01T11:59:58Z').toISOString();
    expect(timeAgo(recent)).toBe('just now');
  });

  it('shows seconds for times under 1 minute', () => {
    const sec10 = new Date('2026-01-01T11:59:50Z').toISOString();
    expect(timeAgo(sec10)).toBe('10s ago');

    const sec45 = new Date('2026-01-01T11:59:15Z').toISOString();
    expect(timeAgo(sec45)).toBe('45s ago');
  });

  it('shows minutes for times under 1 hour', () => {
    const min1 = new Date('2026-01-01T11:59:00Z').toISOString();
    expect(timeAgo(min1)).toBe('1m ago');

    const min30 = new Date('2026-01-01T11:30:00Z').toISOString();
    expect(timeAgo(min30)).toBe('30m ago');
  });

  it('shows hours for times under 1 day', () => {
    const hour1 = new Date('2026-01-01T11:00:00Z').toISOString();
    expect(timeAgo(hour1)).toBe('1h ago');

    const hour12 = new Date('2026-01-01T00:00:00Z').toISOString();
    expect(timeAgo(hour12)).toBe('12h ago');
  });

  it('shows days for times 1+ days old', () => {
    const day1 = new Date('2025-12-31T11:00:00Z').toISOString();
    expect(timeAgo(day1)).toBe('1d ago');

    const day7 = new Date('2025-12-25T12:00:00Z').toISOString();
    expect(timeAgo(day7)).toBe('7d ago');
  });
});

describe('downloadAsFile', () => {
  beforeEach(() => {
    // Mock DOM elements
    document.body.innerHTML = '';
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('creates a download link and triggers download', () => {
    const data = 'test data';
    const filename = 'test.txt';
    const mimeType = 'text/plain';

    downloadAsFile(data, filename, mimeType);

    // Verify URL methods were called
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('handles JSON data', () => {
    const data = JSON.stringify({ test: 'value' });
    downloadAsFile(data, 'data.json', 'application/json');
    
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles CSV data', () => {
    const data = 'col1,col2\nval1,val2';
    downloadAsFile(data, 'data.csv', 'text/csv');
    
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('jsonToCSV', () => {
  it('handles empty array', () => {
    expect(jsonToCSV([])).toBe('');
  });

  it('handles null', () => {
    expect(jsonToCSV(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(jsonToCSV(undefined)).toBe('');
  });

  it('converts simple objects', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 }
    ];
    const result = jsonToCSV(data);
    expect(result).toBe('name,age\nAlice,30\nBob,25');
  });

  it('escapes commas in values', () => {
    const data = [{ name: 'Smith, John', city: 'New York' }];
    const result = jsonToCSV(data);
    expect(result).toBe('name,city\n"Smith, John",New York');
  });

  it('escapes quotes in values', () => {
    const data = [{ text: 'He said "hello"' }];
    const result = jsonToCSV(data);
    expect(result).toBe('text\n"He said ""hello"""');
  });

  it('escapes newlines in values', () => {
    const data = [{ text: 'Line1\nLine2' }];
    const result = jsonToCSV(data);
    expect(result).toBe('text\n"Line1\nLine2"');
  });

  it('handles null and undefined values', () => {
    const data = [{ a: null, b: undefined, c: 'value' }];
    const result = jsonToCSV(data);
    expect(result).toBe('a,b,c\n,,value');
  });

  it('handles mixed data types', () => {
    const data = [
      { str: 'text', num: 42, bool: true, nil: null }
    ];
    const result = jsonToCSV(data);
    expect(result).toBe('str,num,bool,nil\ntext,42,true,');
  });

  it('handles complex escaping', () => {
    const data = [{ field: 'a,b"c\nd' }];
    const result = jsonToCSV(data);
    expect(result).toBe('field\n"a,b""c\nd"');
  });
});
