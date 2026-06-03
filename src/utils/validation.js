export function isAdminUser(userId, adminIds) {
  if (!adminIds?.length) return true;
  return adminIds.includes(String(userId));
}

export function normalizeText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function truncate(text = '', max = 3500) {
  const str = String(text || '');
  return str.length > max ? `${str.slice(0, max - 20)}…[truncated]` : str;
}
