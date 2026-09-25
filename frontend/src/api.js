export const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function headers(extra = {}) {
  const token = localStorage.getItem('velvet_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}
async function req(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: headers(opts.headers) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.hint || 'Error de red');
  return data;
}
export const api = {
  health: () => req('/api/health'),
  ensureSession: async () => {
    const token = localStorage.getItem('velvet_token');
    if (token) {
      try { const me = await req('/api/me'); return me; } catch { localStorage.removeItem('velvet_token'); }
    }
    const s = await req('/api/anon/session', { method: 'POST', body: JSON.stringify({}) });
    localStorage.setItem('velvet_token', s.token);
    return { anon: s.anon };
  },
  updateMe: (patch) => req('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  feed: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/api/feed?${q}`);
  },
  tags: () => req('/api/tags'),
  publish: (payload) => req('/api/posts', { method: 'POST', body: JSON.stringify(payload) }),
  detail: (id) => req(`/api/posts/${id}`),
  like: (id) => req(`/api/posts/${id}/like`, { method: 'POST', body: JSON.stringify({}) }),
  comment: (id, body) => req(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  follow: (id) => req(`/api/follow/${id}`, { method: 'POST', body: JSON.stringify({}) }),
  unfollow: (id) => req(`/api/follow/${id}`, { method: 'DELETE' }),
  profile: (id) => req(`/api/anon/${id}`),
  report: (id, reason) => req(`/api/posts/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  modQueue: (key) => req(`/api/mod/queue?key=${encodeURIComponent(key)}`),
  modAct: (id, action, key) => req(`/api/mod/posts/${id}?key=${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ action, key }) })
};

export function avatarColor(seed = '') {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 60% 45%), hsl(${(h + 50) % 360} 70% 30%))`;
}
export function initials(handle = '?') {
  const w = handle.replace('Anón ', '').split(' ').filter(Boolean);
  return ((w[0]?.[0] || 'V') + (w[1]?.[0] || 'I')).toUpperCase();
}
