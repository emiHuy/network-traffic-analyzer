
// formats ISO timestamp to HH:MM:SS.mmm; returns '—' for missing values
export function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    });
  } catch {
    return ts;
  }
}

export function formatDay(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return ts;
  }
}

export function formatBytes(bytes) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return Math.round(bytes / 1e3) + ' KB';
  return bytes + ' B';
}

export function formatSince(isoString) {
  if (!isoString) return '—';
  const secs = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (secs < 60)   return secs + 's ago';
  if (secs < 3600) return Math.round(secs / 60) + ' min ago';
  return Math.round(secs / 3600) + 'hr ago';
}