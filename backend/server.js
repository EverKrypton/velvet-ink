/* Velvet Ink — backend 18+ | Relatos eróticos anónimos con moderación real
 * Solo ficción adulta consensuada. Cero tolerancia a contenido ilegal.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 4000;
const MOD_KEY = process.env.MOD_KEY || 'velvet-mod-2026';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- DB (SQLite nativo de Node, archivo en la VPS) ----
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS anons (
  id TEXT PRIMARY KEY, handle TEXT NOT NULL, avatar_seed TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL, bio TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, anon_id TEXT NOT NULL, title TEXT NOT NULL,
  excerpt TEXT NOT NULL, body TEXT NOT NULL, tags TEXT DEFAULT '[]',
  intensity TEXT DEFAULT 'ardiente', thread_of TEXT,
  status TEXT DEFAULT 'visible', reports_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (anon_id) REFERENCES anons(id)
);
CREATE TABLE IF NOT EXISTS likes (post_id TEXT, anon_id TEXT, UNIQUE(post_id, anon_id));
CREATE TABLE IF NOT EXISTS follows (follower_id TEXT, following_id TEXT, UNIQUE(follower_id, following_id));
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT, anon_id TEXT, body TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, post_id TEXT, reporter_id TEXT, reason TEXT, created_at TEXT);
`);

// ---- Moderación automática ----
// BLOQUEO duro: cualquier indicio de menores o abuso real → 422, no se guarda.
const BLOCKED = new RegExp([
  'menor', 'menores', 'niñ[oa]s?', 'niñe', 'niñez', 'adolescente', 'preadolescente',
  'colegio', 'escuela\\s*(primaria|secundaria)', 'instituto\\s*escolar', 'guarder',
  'loli', 'shota', '\\bteen\\b(?!\\s*(adult))', 'child', 'kid\\b', 'minor\\b',
  'hij[oa]\\s*(pequeñ|menor|de\\s*\\d)', '\\b\\d\\s*años\\b.*(colegio|escuela)',
  'snuff', 'bestial', 'zoofilia', 'necro'
].join('|'), 'i');
// REVISIÓN: fantasías límite / no-consent sin marco consensuado → pasa a cola humana.
const FLAGGED = /(forz|sin\s*consent|drog[ao]|inconsciente|desmayad|violaci[oó]n|incesto|pap[aá]\s*y\s*(hija|hijo)|herman[oa]\s*menor|no\s*dijo\s*que\s*s[ií]| CNC(?!.*consensu))/i;

const BANNED_REASONS_HINT = 'Solo ficción adulta (+18) consensuada. Está prohibido cualquier contenido con menores, incesto con menores, abuso no consensuado sin marco de fantasía consensuada explícita, violencia real, o cualquier delito.';

function moderateCheck({ title = '', body = '', excerpt = '' }) {
  const text = `${title}\n${excerpt}\n${body}`;
  if (BLOCKED.test(text)) return { verdict: 'blocked' };
  if (FLAGGED.test(text)) return { verdict: 'review' };
  return { verdict: 'ok' };
}

// ---- Helpers ----
const now = () => new Date().toISOString();
const POETIC = ['Terciopelo', 'Medianoche', 'Canela', 'Tinta', 'Seda', 'Brasa', 'Luna', 'Cuervo', 'Orquídea', 'Vino', 'Salvia', 'Niebla'];
const ANIMAL = ['Nocturno', 'Secreto', 'Velado', 'Errante', 'Íntimo', 'Dorado', 'Profundo'];
function genHandle() {
  const a = POETIC[Math.floor(Math.random() * POETIC.length)];
  const b = ANIMAL[Math.floor(Math.random() * ANIMAL.length)];
  const n = Math.floor(10 + Math.random() * 89);
  return `Anón ${a} ${b} ${n}`;
}
function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.anon = token ? db.prepare('SELECT * FROM anons WHERE token = ?').get(token) : null;
  next();
}
const requireAnon = (req, res, next) => {
  if (!req.anon) return res.status(401).json({ error: 'Sesión anónima requerida' });
  next();
};
function anonPublic(a) {
  if (!a) return null;
  const followers = db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id = ?').get(a.id).c;
  const following = db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id = ?').get(a.id).c;
  const posts = db.prepare("SELECT COUNT(*) c FROM posts WHERE anon_id = ? AND status = 'visible'").get(a.id).c;
  return { id: a.id, handle: a.handle, avatar_seed: a.avatar_seed, bio: a.bio, followers, following, posts, created_at: a.created_at };
}
function postPublic(p, viewerId) {
  const author = db.prepare('SELECT * FROM anons WHERE id = ?').get(p.anon_id);
  const liked = viewerId ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND anon_id = ?').get(p.id, viewerId) : false;
  const following = viewerId && author ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(viewerId, author.id) : false;
  let threadCount = 0;
  try { threadCount = db.prepare("SELECT COUNT(*) c FROM posts WHERE thread_of = ? AND status = 'visible'").get(p.id).c; } catch {}
  return {
    id: p.id, title: p.title, excerpt: p.excerpt, body: p.body,
    tags: JSON.parse(p.tags || '[]'), intensity: p.intensity, thread_of: p.thread_of,
    status: p.status, reports_count: p.reports_count, likes_count: p.likes_count,
    comments_count: p.comments_count, created_at: p.created_at,
    thread_count: threadCount, liked_by_me: liked,
    author: author ? { ...anonPublic(author), followed_by_me: following } : null
  };
}

// ---- Seed demo (solo si vacío) ----
function seed() {
  const c = db.prepare('SELECT COUNT(*) c FROM posts').get().c;
  if (c > 0) return;
  const mk = (handle, seedS, bio) => {
    const a = { id: uuid(), handle, avatar_seed: seedS, token: uuid(), bio, created_at: now() };
    db.prepare('INSERT INTO anons VALUES (@id,@handle,@avatar_seed,@token,@bio,@created_at)').run(a);
    return a;
  };
  const a1 = mk('Anón Tinta Nocturna 42', 'tinta-42', 'Escribo lo que no me atrevo a decir en voz alta.');
  const a2 = mk('Anón Seda Velada 17', 'seda-17', 'Romance lento, tensión larga, finales que queman.');
  const a3 = mk('Anón Brasa Errante 88', 'brasa-88', 'Micro-relatos de motel, lluvia y neón.');
  const posts = [
    [a1, 'La habitación 301', 'ardiente', ['hotel', 'tensión', 'miradas'], 'Nunca hablamos del ascensor. Solo de lo que pasó después, cuando la llave giró dos veces.', 'El ascensor subía despacio, como si también supiera lo que iba a pasar.\n\nElla sostenía la llave de la 301 entre dos dedos, sin mirarme. Yo contaba los pisos por el zumbido.\n\n—Piso tres —dijo el altavoz.\n\nNinguno se movió.\n\nLa puerta se abrió, se cerró, volvió a abrirse. Ella salió primero. Yo la seguí como se sigue una canción que ya conoces de memoria.\n\n(Continuará en hilo…)'],
    [a2, 'Manual para quedarse un poco más', 'suave', ['romance', 'lento', 'cocina'], 'Me pidió que me quedara a cenar. Yo entendí: quédate a todo lo demás también.', 'La receta decía veinte minutos. Llevábamos dos horas.\n\nEl vino respiraba, la pasta esperaba, y su mano encontraba excusas para rozar la mía: la sal, la pimienta, el borde de la copa.\n\n—No sé cocinar apurada —dijo—. Me gusta lento.\n\n—A mí también —dije—. Sobre todo los postres.'],
    [a3, 'Neón y lluvia', 'explicito', ['motel', 'lluvia', 'noche'], 'Afuera diluviaba. Adentro, el neón parpadeaba como un corazón nervioso.', 'El letrero del motel perdía una letra: M TEL. Nos reímos y entramos empapados.\n\nDejó el paraguas roto junto a la puerta, como quien deja atrás una versión anterior de la noche.\n\n—Sécame —dijo, medio en broma, medio en serio.\n\nY la noche, obediente, se volvió vapor sobre la piel.'],
    [a1, 'Lo que no se dice en voz alta', 'ardiente', ['confesión', 'deseo'], 'Hay mensajes que se escriben tres veces antes de enviarse. Este fue el cuarto.', 'Primer borrador: “¿vienes?”. Demasiado directo.\n\nSegundo: “te extraño”. Demasiado verdad.\n\nTercero: una foto del bar donde nos conocimos, sin texto.\n\nRespondió en un minuto: “pide dos copas. Voy en camino.”\n\nA veces el deseo solo necesita una excusa con hielo.'],
    [a2, 'Hilo: La casa del faro — Cap. 1', 'suave', ['serie', 'faro', 'misterio'], 'Capítulo 1 de una serie lenta: una casa, un faro, dos desconocidos y una tormenta.', 'La tormenta cortó la luz a las nueve.\n\nÉl apareció en la puerta con una vela y dos mantas, como si las tormentas fueran su especialidad.\n\n—La casa es grande —dijo—. El miedo, más.\n\nElla aceptó la manta. No el miedo.\n\nFin del capítulo 1. Sigue el hilo →']
  ];
  const ins = db.prepare(`INSERT INTO posts (id,anon_id,title,excerpt,body,tags,intensity,thread_of,status,likes_count,created_at) VALUES (?,?,?,?,?,?,?,?,?,0,?)`);
  const firstId = uuid();
  posts.forEach(([a, t, inten, tags, exc, body], i) => {
    ins.run(i === 0 ? firstId : uuid(), a.id, t, exc, body, JSON.stringify(tags), inten, null, 'visible', now());
  });
  // un capítulo-hilo del primero
  ins.run(uuid(), a2.id, 'La habitación 301 — Cap. 2', 'Ella dejó la llave sobre la mesita. Todo lo demás, sobre la cama.', 'Tocaron dos veces a la puerta y nadie abrió: éramos nosotros, desde dentro, riéndonos bajito.\n\n—Shh —dijo—. Que no sepan que estamos felices.\n\nY bajó la voz hasta convertirla en otra cosa.', JSON.stringify(['hotel', 'cap-2']), 'ardiente', firstId, 'visible', now());
  console.log('Seed demo creado.');
}
seed();

// ---- API ----
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'velvet-ink 18+', adults_only: true, moderation: ['auto', 'comunidad', 'humana'] }));

// Sesión anónima: cualquiera publica, la sesión se guarda (token en localStorage)
app.post('/api/anon/session', (req, res) => {
  const { handle, bio } = req.body || {};
  const h = (typeof handle === 'string' && handle.trim().slice(0, 40)) || genHandle();
  const a = { id: uuid(), handle: h, avatar_seed: 'seed-' + Math.random().toString(36).slice(2, 8), token: uuid(), bio: (bio || '').slice(0, 160), created_at: now() };
  db.prepare('INSERT INTO anons VALUES (@id,@handle,@avatar_seed,@token,@bio,@created_at)').run(a);
  res.json({ token: a.token, anon: anonPublic(a), disclaimer: 'Contenido adulto +18. Solo ficción consensuada entre adultos. Nada ilegal.' });
});
app.get('/api/me', auth, (req, res) => {
  if (!req.anon) return res.status(401).json({ error: 'sin sesión' });
  res.json({ anon: anonPublic(req.anon) });
});
app.patch('/api/me', auth, requireAnon, (req, res) => {
  const { handle, bio } = req.body || {};
  if (handle && typeof handle === 'string' && handle.trim()) db.prepare('UPDATE anons SET handle = ? WHERE id = ?').run(handle.trim().slice(0, 40), req.anon.id);
  if (typeof bio === 'string') db.prepare('UPDATE anons SET bio = ? WHERE id = ?').run(bio.slice(0, 160), req.anon.id);
  res.json({ anon: anonPublic(db.prepare('SELECT * FROM anons WHERE id = ?').get(req.anon.id)) });
});

// Muro / feed estilo facebook
app.get('/api/feed', auth, (req, res) => {
  const { tab = 'muro', q = '', tag = '', intensity = '', limit = '30' } = req.query;
  const lim = Math.min(parseInt(limit) || 30, 60);
  const viewer = req.anon?.id || null;
  let rows;
  if (tab === 'siguiendo' && viewer) {
    rows = db.prepare(`SELECT p.* FROM posts p JOIN follows f ON f.following_id = p.anon_id
      WHERE f.follower_id = ? AND p.status = 'visible' AND p.thread_of IS NULL ORDER BY p.created_at DESC LIMIT ?`).all(viewer, lim);
  } else if (tab === 'top') {
    rows = db.prepare(`SELECT * FROM posts WHERE status='visible' AND thread_of IS NULL ORDER BY likes_count DESC, created_at DESC LIMIT ?`).all(lim);
  } else if (tab === 'hilos') {
    rows = db.prepare(`SELECT * FROM posts WHERE status='visible' AND thread_of IS NULL AND id IN (SELECT DISTINCT thread_of FROM posts WHERE thread_of IS NOT NULL) ORDER BY created_at DESC LIMIT ?`).all(lim);
  } else {
    rows = db.prepare(`SELECT * FROM posts WHERE status='visible' AND thread_of IS NULL ORDER BY created_at DESC LIMIT 100`).all();
  }
  let out = rows;
  if (q) { const s = q.toLowerCase(); out = out.filter(p => (p.title + p.excerpt + p.body).toLowerCase().includes(s)); }
  if (tag) out = out.filter(p => JSON.parse(p.tags || '[]').includes(tag));
  if (intensity) out = out.filter(p => p.intensity === intensity);
  res.json({ posts: out.slice(0, lim).map(p => postPublic(p, viewer)) });
});

app.get('/api/tags', (_req, res) => {
  const rows = db.prepare(`SELECT tags FROM posts WHERE status='visible'`).all();
  const map = {};
  rows.forEach(r => JSON.parse(r.tags || '[]').forEach(t => map[t] = (map[t] || 0) + 1));
  res.json({ tags: Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([tag, count]) => ({ tag, count })) });
});

// Publicar relato o capítulo de hilo
app.post('/api/posts', auth, requireAnon, (req, res) => {
  const { title, excerpt, body, tags = [], intensity = 'ardiente', thread_of = null } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Título y relato requeridos' });
  if (title.length > 120) return res.status(400).json({ error: 'Título máx 120 caracteres' });
  if (body.length > 20000) return res.status(400).json({ error: 'Relato máx 20.000 caracteres' });
  if (!['suave', 'ardiente', 'explicito'].includes(intensity)) return res.status(400).json({ error: 'Intensidad inválida' });
  const check = moderateCheck({ title, body, excerpt });
  if (check.verdict === 'blocked') return res.status(422).json({ error: 'Bloqueado por moderación automática.', hint: BANNED_REASONS_HINT });
  const status = check.verdict === 'review' ? 'revision' : 'visible';
  const cleanTags = [...new Set((Array.isArray(tags) ? tags : String(tags).split(',')).map(t => String(t).trim().toLowerCase().replace(/^#/, '').slice(0, 24)).filter(Boolean))].slice(0, 6);
  const autoExcerpt = (excerpt?.trim() || body.trim().replace(/\s+/g, ' ').slice(0, 160));
  const p = { id: uuid(), anon_id: req.anon.id, title: title.trim(), excerpt: autoExcerpt, body: body.trim(), tags: JSON.stringify(cleanTags), intensity, thread_of: thread_of || null, status, created_at: now() };
  db.prepare(`INSERT INTO posts (id,anon_id,title,excerpt,body,tags,intensity,thread_of,status,created_at) VALUES (@id,@anon_id,@title,@excerpt,@body,@tags,@intensity,@thread_of,@status,@created_at)`).run(p);
  res.status(201).json({ post: postPublic(db.prepare('SELECT * FROM posts WHERE id = ?').get(p.id), req.anon.id), moderation: status === 'revision' ? 'Tu relato entró a revisión humana antes de publicarse. Gracias por escribir con cuidado.' : 'ok' });
});

app.get('/api/posts/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p || (p.status !== 'visible' && req.query.key !== MOD_KEY)) return res.status(404).json({ error: 'No encontrado' });
  const chapters = db.prepare(`SELECT * FROM posts WHERE thread_of = ? ORDER BY created_at ASC`).all(p.id);
  const comments = db.prepare(`SELECT c.*, a.handle, a.avatar_seed FROM comments c JOIN anons a ON a.id = c.anon_id WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 100`).all(p.id);
  res.json({ post: postPublic(p, req.anon?.id || null), chapters: chapters.map(c => postPublic(c, req.anon?.id || null)), comments: comments.map(c => ({ id: c.id, body: c.body, created_at: c.created_at, author: { id: c.anon_id, handle: c.handle, avatar_seed: c.avatar_seed } })) });
});

app.post('/api/posts/:id/like', auth, requireAnon, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const ex = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND anon_id = ?').get(p.id, req.anon.id);
  if (ex) { db.prepare('DELETE FROM likes WHERE post_id = ? AND anon_id = ?').run(p.id, req.anon.id); }
  else { db.prepare('INSERT INTO likes VALUES (?,?)').run(p.id, req.anon.id); }
  const n = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(p.id).c;
  db.prepare('UPDATE posts SET likes_count = ? WHERE id = ?').run(n, p.id);
  res.json({ liked: !ex, likes_count: n });
});

app.post('/api/posts/:id/comments', auth, requireAnon, (req, res) => {
  const { body } = req.body || {};
  if (!body?.trim() || body.length > 2000) return res.status(400).json({ error: 'Comentario inválido' });
  const check = moderateCheck({ body });
  if (check.verdict === 'blocked') return res.status(422).json({ error: 'Comentario bloqueado por moderación.', hint: BANNED_REASONS_HINT });
  const c = { id: uuid(), post_id: req.params.id, anon_id: req.anon.id, body: body.trim(), created_at: now() };
  db.prepare('INSERT INTO comments VALUES (@id,@post_id,@anon_id,@body,@created_at)').run(c);
  const n = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(c.post_id).c;
  db.prepare('UPDATE posts SET comments_count = ? WHERE id = ?').run(n, c.post_id);
  res.status(201).json({ ok: true, comments_count: n });
});

// Seguir / dejar de seguir a cualquier anónimo
app.post('/api/follow/:id', auth, requireAnon, (req, res) => {
  if (req.params.id === req.anon.id) return res.status(400).json({ error: 'No puedes seguirte' });
  const target = db.prepare('SELECT * FROM anons WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Anónimo no existe' });
  db.prepare('INSERT OR IGNORE INTO follows VALUES (?,?)').run(req.anon.id, target.id);
  res.json({ following: true, profile: anonPublic(target) });
});
app.delete('/api/follow/:id', auth, requireAnon, (req, res) => {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.anon.id, req.params.id);
  res.json({ following: false });
});

// Perfil anónimo público
app.get('/api/anon/:id', auth, (req, res) => {
  const a = db.prepare('SELECT * FROM anons WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'No existe' });
  const posts = db.prepare(`SELECT * FROM posts WHERE anon_id = ? AND status='visible' ORDER BY created_at DESC LIMIT 30`).all(a.id);
  const viewer = req.anon?.id || null;
  const followed = viewer ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(viewer, a.id) : false;
  res.json({ profile: { ...anonPublic(a), followed_by_me: followed }, posts: posts.map(p => postPublic(p, viewer)) });
});

// Reportar (moderación por comunidad: 3 reportes → revisión automática)
app.post('/api/posts/:id/report', auth, requireAnon, (req, res) => {
  const { reason = 'inapropiado' } = req.body || {};
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('INSERT INTO reports VALUES (?,?,?,?,?)').run(uuid(), p.id, req.anon.id, String(reason).slice(0, 120), now());
  const n = db.prepare('SELECT COUNT(*) c FROM reports WHERE post_id = ?').get(p.id).c;
  db.prepare('UPDATE posts SET reports_count = ? WHERE id = ?').run(n, p.id);
  if (n >= 3 && p.status === 'visible') db.prepare("UPDATE posts SET status = 'revision' WHERE id = ?").run(p.id);
  res.json({ ok: true, reports_count: n, msg: 'Gracias. La comunidad y el equipo de moderación lo revisarán.' });
});

// Moderación humana (3 modos: auto ya aplicado, comunidad por reportes, humana con MOD_KEY)
app.get('/api/mod/queue', (req, res) => {
  if (req.query.key !== MOD_KEY) return res.status(403).json({ error: 'Mod key requerida' });
  const rows = db.prepare(`SELECT * FROM posts WHERE status IN ('revision','oculto') OR reports_count > 0 ORDER BY reports_count DESC, created_at DESC LIMIT 50`).all();
  const reps = db.prepare(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 50`).all();
  res.json({ queue: rows.map(p => postPublic(p, null)), reports: reps });
});
app.post('/api/mod/posts/:id', (req, res) => {
  if (req.body?.key !== MOD_KEY && req.query.key !== MOD_KEY) return res.status(403).json({ error: 'Mod key requerida' });
  const { action } = req.body || {};
  if (!['aprobar', 'ocultar', 'revision'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
  const status = action === 'aprobar' ? 'visible' : action === 'ocultar' ? 'oculto' : 'revision';
  db.prepare('UPDATE posts SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true, status });
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Velvet Ink backend 18+ en :${PORT} | DB: ${DB_FILE}`);
  if (!fs.existsSync(DB_FILE)) console.log('(db creada)');
});
