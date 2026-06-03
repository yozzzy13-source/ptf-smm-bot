export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function shortText(value, max = 260) {
  const s = String(value || '').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}
