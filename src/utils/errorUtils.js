export function extractErrorDetails(err) {
  const status = err?.status || err?.code || err?.response?.status || '';
  const responseData = err?.response?.data || err?.error || err?.data || null;
  const apiMessage = responseData?.error?.message || responseData?.description || responseData?.message || err?.message || 'Unknown error';
  let raw = '';
  try {
    raw = responseData ? JSON.stringify(responseData) : '';
  } catch (_) {
    raw = String(responseData || '');
  }
  return {
    status,
    message: apiMessage,
    raw,
    short: status ? `${status}: ${apiMessage}` : apiMessage
  };
}

export function stripHtml(input = '') {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function limitText(text = '', limit = 3400) {
  const s = String(text || '');
  if (s.length <= limit) return s;
  return `${s.slice(0, Math.max(0, limit - 80))}\n\n…[message shortened]`;
}
