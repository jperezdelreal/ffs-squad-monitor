/** Escape HTML entities to prevent XSS. */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Format a duration in seconds to a human-readable string. */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Relative time string (e.g., "2m ago", "just now"). */
export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return secs <= 5 ? 'just now' : `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Download data as a file. */
export function downloadAsFile(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert array of objects to CSV string. */
export function jsonToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(h => {
      const val = obj[h];
      if (val == null) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') 
        ? `"${str.replace(/"/g, '""')}"` 
        : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
