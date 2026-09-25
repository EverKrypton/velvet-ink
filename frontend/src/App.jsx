import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Heart, MessageCircle, Eye, EyeOff, Plus, Search, Users, BookOpen, Trophy, ShieldCheck, Flag, X, Send, ChevronLeft, Sparkles, Feather } from 'lucide-react';
import clsx from 'clsx';
import { api, avatarColor, initials } from './api.js';

const INTENSITY = {
  suave: { label: 'Suave', color: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  ardiente: { label: 'Ardiente', color: 'text-orange-300 border-orange-400/30 bg-orange-400/10' },
  explicito: { label: 'Explícito 18+', color: 'text-rose-300 border-rose-400/40 bg-rose-500/10' }
};

function useToast() {
  const [msg, setMsg] = useState(null);
  const toast = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3200); };
  return { msg, toast };
}

function AgeGate({ onOk }) {
  return (
    <div className="min-h-dvh velvet-bg flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card max-w-md w-full rounded-3xl p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-2xl font-display" style={{ background: 'linear-gradient(135deg,#ff4d6d,#7f1d3a)' }}>V</div>
        <h1 className="font-display text-4xl mt-4 italic">Velvet Ink</h1>
        <p className="text-sm text-white/60 mt-2">Red social anónima de relatos íntimos.<br />Solo ficción adulta consensuada.</p>
        <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-left text-sm">
          <p className="font-semibold text-rose-200">Zona +18</p>
          <p className="text-white/70 mt-1">Prohibido menores, contenido no consensuado, violencia real o cualquier delito. La moderación (automática + comunidad + humana) elimina y bloquea.</p>
        </div>
        <button onClick={onOk} className="mt-6 w-full rounded-2xl py-3.5 font-semibold text-[#1a0f14]" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}>
          Tengo 18+ y quiero entrar
        </button>
        <a href="https://www.google.com" className="block mt-3 text-xs text-white/40 underline">Soy menor / no quiero entrar</a>
      </motion.div>
    </div>
  );
}

function Avatar({ seed, handle, size = 40 }) {
  return (
    <div className="rounded-full grid place-items-center font-bold shrink-0" style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.36 }}>
      {initials(handle)}
    </div>
  );
}

function PostCard({ p, onOpen, onLike, onFollow, onReport, discreet, revealed, onReveal }) {
  const isExplicit = p.intensity === 'explicito';
  const masked = (discreet && isExplicit && !revealed) || (isExplicit && !revealed);
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <Avatar seed={p.author?.avatar_seed} handle={p.author?.handle} />
        <div className="min-w-0 flex-1">
          <button onClick={() => onOpen({ view: 'profile', id: p.author?.id })} className="text-sm font-semibold truncate hover:underline">{p.author?.handle}</button>
          <p className="text-[11px] text-white/40">{new Date(p.created_at).toLocaleString('es')} · {p.thread_count > 0 ? `${p.thread_count + 1} capítulos` : 'Relato único'}</p>
        </div>
        <span className={clsx('text-[10px] px-2 py-1 rounded-full border', INTENSITY[p.intensity]?.color)}>{INTENSITY[p.intensity]?.label}</span>
      </div>

      <button onClick={() => onOpen({ view: 'post', id: p.id })} className="text-left w-full mt-3">
        <h3 className="font-display text-2xl leading-tight italic">{p.title}</h3>
        <div className="relative mt-2">
          <p className={clsx('text-sm text-white/70 leading-relaxed', masked && 'blur-nsfw')}>{p.excerpt}</p>
          {masked && (
            <div className="absolute inset-0 grid place-items-center">
              <span onClick={(e) => { e.stopPropagation(); onReveal(p.id); }} className="text-xs px-3 py-2 rounded-full bg-black/70 border border-white/20 flex items-center gap-2"><Eye size={14} /> Revelar 18+</span>
            </div>
          )}
        </div>
      </button>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {p.tags.map(t => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">#{t}</span>)}
      </div>

      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/10">
        <button onClick={() => onLike(p.id)} className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm', p.liked_by_me ? 'text-rose-300 bg-rose-500/15' : 'text-white/60 hover:bg-white/5')}>
          <Heart size={16} fill={p.liked_by_me ? 'currentColor' : 'none'} /> {p.likes_count}
        </button>
        <button onClick={() => onOpen({ view: 'post', id: p.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white/60 hover:bg-white/5">
          <MessageCircle size={16} /> {p.comments_count}
        </button>
        {p.thread_count > 0 && <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gold text-[#e8c476]"><BookOpen size={16} /> Hilo</span>}
        <div className="flex-1" />
        {p.author && (
          <button onClick={() => onFollow(p.author)} className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/70">
            {p.author.followed_by_me ? 'Siguiendo' : '+ Seguir'}
          </button>
        )}
        <button onClick={() => onReport(p.id)} className="p-2 text-white/30 hover:text-white/70"><Flag size={15} /></button>
      </div>
    </motion.article>
  );
}

function Composer({ open, onClose, onDone, myPosts, toast, presetThread = null }) {
  const [f, setF] = useState({ title: '', body: '', tags: '', intensity: 'ardiente', thread_of: presetThread || '' });
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) setF({ title: '', body: '', tags: '', intensity: 'ardiente', thread_of: presetThread || '' }); }, [open, presetThread]);
  if (!open) return null;
  const submit = async () => {
    if (!f.title.trim() || !f.body.trim()) return toast('Título y relato requeridos');
    setSending(true);
    try {
      const r = await api.publish({ title: f.title, body: f.body, excerpt: '', tags: f.tags.split(',').map(s => s.trim()).filter(Boolean), intensity: f.intensity, thread_of: f.thread_of || null });
      toast(r.moderation && r.moderation !== 'ok' ? r.moderation : 'Publicado en el muro');
      onDone(); onClose();
    } catch (e) { toast(e.message); }
    setSending(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card max-w-2xl mx-auto rounded-3xl p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <Feather size={18} className="text-[#e8c476]" />
          <h2 className="font-display text-2xl italic">{f.thread_of ? 'Continuar hilo' : 'Nuevo relato anónimo'}</h2>
          <div className="flex-1" /><button onClick={onClose} className="p-2 text-white/50"><X size={18} /></button>
        </div>
        <p className="text-xs text-white/50 mt-1">Se publica con tu seudónimo anónimo. Solo adultos, todo consensuado y ficticio.</p>
        <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Título que provoque… (máx 120)" className="mt-4 w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <select value={f.intensity} onChange={e => setF({ ...f, intensity: e.target.value })} className="bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm text-white">
            <option value="suave" className="text-black">Suave — sugerente</option>
            <option value="ardiente" className="text-black">Ardiente — directo</option>
            <option value="explicito" className="text-black">Explícito 18+ — con blur</option>
          </select>
          <select value={f.thread_of} onChange={e => setF({ ...f, thread_of: e.target.value })} className="bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm text-white">
            <option value="" className="text-black">Relato único</option>
            {myPosts.map(p => <option key={p.id} value={p.id} className="text-black">Cap. de: {p.title.slice(0, 30)}</option>)}
          </select>
        </div>
        <input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="etiquetas separadas por coma: hotel, lluvia, serie…" className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm" />
        <textarea value={f.body} onChange={e => setF({ ...f, body: e.target.value })} rows={10} placeholder="Escribe tu relato… Cuida el consentimiento, la tensión y el final. Nada ilegal, nada real sin consentimiento." className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm leading-relaxed" />
        <div className="flex items-center justify-between mt-2 text-xs text-white/40"><span>{f.body.length} / 20.000</span><span>Al publicar aceptas las reglas +18</span></div>
        <button disabled={sending} onClick={submit} className="mt-4 w-full rounded-2xl py-3.5 font-semibold text-[#1a0f14] disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}>
          {sending ? 'Publicando…' : 'Publicar en el muro'}
        </button>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [ageOk, setAgeOk] = useState(() => localStorage.getItem('velvet_age_ok') === '1');
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('muro');
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState('');
  const [tagF, setTagF] = useState('');
  const [intF, setIntF] = useState('');
  const [discreet, setDiscreet] = useState(() => localStorage.getItem('velvet_discreet') === '1');
  const [revealed, setRevealed] = useState({});
  const [nav, setNav] = useState({ view: 'feed' });
  const [detail, setDetail] = useState(null);
  const [profile, setProfile] = useState(null);
  const [composer, setComposer] = useState(false);
  const [threadFor, setThreadFor] = useState(null);
  const [comment, setComment] = useState('');
  const [modKey, setModKey] = useState('');
  const [queue, setQueue] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const { msg, toast } = useToast();

  const open = (n) => {
    setNav(n); window.scrollTo({ top: 0 });
    if (n.view === 'post') loadDetail(n.id);
    if (n.view === 'profile') loadProfile(n.id);
    if (n.view === 'mod') setQueue(null);
  };

  const loadFeed = async () => {
    try {
      const r = await api.feed({ tab, q, tag: tagF, intensity: intF });
      setPosts(r.posts);
    } catch (e) { toast(e.message); }
  };
  const loadDetail = async (id) => {
    try { setDetail(await api.detail(id)); } catch (e) { toast(e.message); }
  };
  const loadProfile = async (id) => {
    try { setProfile(await api.profile(id)); } catch (e) { toast(e.message); }
  };

  useEffect(() => {
    if (!ageOk) return;
    api.ensureSession().then(({ anon }) => setMe(anon)).catch(() => {});
    api.tags().then(r => setTags(r.tags)).catch(() => {});
  }, [ageOk]);
  useEffect(() => { if (ageOk) loadFeed(); }, [tab, ageOk]); // eslint-disable-line
  useEffect(() => { localStorage.setItem('velvet_discreet', discreet ? '1' : '0'); }, [discreet]);
  useEffect(() => {
    if (me) api.profile(me.id).then(r => setMyPosts(r.posts)).catch(() => {});
  }, [me, posts.length]);

  const doLike = async (id) => {
    try {
      const r = await api.like(id);
      setPosts(ps => ps.map(p => p.id === id ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count } : p));
      if (detail?.post?.id === id) setDetail(d => ({ ...d, post: { ...d.post, liked_by_me: r.liked, likes_count: r.likes_count } }));
    } catch (e) { toast(e.message); }
  };
  const doFollow = async (author) => {
    if (!author || author.id === me?.id) return;
    try {
      if (author.followed_by_me) await api.unfollow(author.id);
      else await api.follow(author.id);
      loadFeed();
      toast(author.followed_by_me ? `Dejaste de seguir a ${author.handle}` : `Ahora sigues a ${author.handle}`);
    } catch (e) { toast(e.message); }
  };
  const doReport = async (id) => {
    const reason = prompt('¿Por qué reportas? (menores / no consensuado / spam / otro)') || 'inapropiado';
    try { const r = await api.report(id, reason); toast(r.msg); } catch (e) { toast(e.message); }
  };
  const sendComment = async () => {
    if (!comment.trim() || !detail) return;
    try {
      await api.comment(detail.post.id, comment);
      setComment('');
      loadDetail(detail.post.id); loadFeed();
    } catch (e) { toast(e.message); }
  };
  const loadMod = async () => {
    try { setQueue(await api.modQueue(modKey)); } catch (e) { toast(e.message); }
  };

  if (!ageOk) return <AgeGate onOk={() => { localStorage.setItem('velvet_age_ok', '1'); setAgeOk(true); }} />;

  const filtered = useMemo(() => posts, [posts]);

  return (
    <div className="min-h-dvh velvet-bg pb-28 sm:pb-10">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0c0910]/80 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center font-display font-bold" style={{ background: 'linear-gradient(135deg,#ff4d6d,#7f1d3a)' }}>V</div>
          <div className="leading-tight">
            <p className="font-display italic text-lg">Velvet Ink</p>
            <p className="text-[10px] text-white/40 -mt-0.5">relatos anónimos · +18</p>
          </div>
          <div className="flex-1" />
          <button onClick={() => setDiscreet(d => !d)} title="Modo discreto" className={clsx('p-2 rounded-full border', discreet ? 'border-[#e8c476]/60 text-[#e8c476]' : 'border-white/15 text-white/50')}>
            {discreet ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={() => open({ view: 'mod' })} className="p-2 rounded-full border border-white/15 text-white/50"><ShieldCheck size={16} /></button>
          {me && <button onClick={() => open({ view: 'profile', id: me.id })}><Avatar seed={me.avatar_seed} handle={me.handle} size={34} /></button>}
        </div>
        {nav.view === 'feed' && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {[['muro', 'Muro'], ['siguiendo', 'Siguiendo'], ['hilos', 'Hilos'], ['top', 'Top']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={clsx('px-4 py-1.5 rounded-full text-sm whitespace-nowrap border', tab === v ? 'bg-white text-black border-white font-semibold' : 'border-white/15 text-white/60')}>{l}</button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {nav.view === 'feed' && (
          <>
            {/* Hero mobile-first */}
            <div className="card rounded-3xl p-5 overflow-hidden relative">
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,77,109,.35),transparent 70%)' }} />
              <p className="text-[11px] tracking-[0.2em] text-[#e8c476] font-semibold">MURO · COMO FACEBOOK, PERO DE TINTA</p>
              <h2 className="font-display text-3xl italic mt-1">Escribe lo<br />innombrable.</h2>
              <p className="text-sm text-white/60 mt-2">Cualquiera publica. Cada anónimo guarda su sesión, sigue a otros y arma hilos.</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setThreadFor(null); setComposer(true); }} className="flex-1 rounded-2xl py-3 font-semibold text-sm text-[#1a0f14]" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}>+ Publicar relato</button>
                <label className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3">
                  <Search size={15} className="text-white/40" />
                  <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadFeed()} placeholder="Buscar deseo…" className="bg-transparent text-sm w-full py-3" />
                </label>
              </div>
              <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
                <button onClick={() => { setTagF(''); setIntF(''); loadFeed(); }} className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 text-white/50 whitespace-nowrap">Limpiar</button>
                {tags.slice(0, 10).map(t => (
                  <button key={t.tag} onClick={() => { setTagF(tagF === t.tag ? '' : t.tag); setTimeout(loadFeed, 50); }} className={clsx('text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap', tagF === t.tag ? 'border-rose-300 text-rose-200 bg-rose-500/15' : 'border-white/10 text-white/50')}>#{t.tag} · {t.count}</button>
                ))}
                <select value={intF} onChange={e => { setIntF(e.target.value); setTimeout(loadFeed, 50); }} className="text-[11px] bg-white/5 border border-white/10 rounded-full px-2 py-1 text-white/60">
                  <option value="" className="text-black">Toda intensidad</option>
                  <option value="suave" className="text-black">Suave</option>
                  <option value="ardiente" className="text-black">Ardiente</option>
                  <option value="explicito" className="text-black">Explícito</option>
                </select>
              </div>
              {me && <p className="text-[11px] text-white/35 mt-3">Escribes como <b className="text-white/60">{me.handle}</b> · tu sesión anónima está guardada en este dispositivo</p>}
            </div>

            {filtered.length === 0 && (
              <div className="card rounded-3xl p-8 text-center text-sm text-white/50">
                <Sparkles className="mx-auto text-[#e8c476]" />
                <p className="mt-2">Aún no hay relatos aquí.<br />Sé la primera tinta del muro.</p>
                <button onClick={() => setComposer(true)} className="mt-3 text-sm px-4 py-2 rounded-full bg-white text-black font-semibold">Escribir ahora</button>
              </div>
            )}
            {filtered.map(p => (
              <PostCard key={p.id} p={p} onOpen={open} onLike={doLike} onFollow={doFollow} onReport={doReport}
                discreet={discreet} revealed={!!revealed[p.id]} onReveal={(id) => setRevealed(r => ({ ...r, [id]: true }))} />
            ))}
          </>
        )}

        {nav.view === 'post' && detail && (
          <div>
            <button onClick={() => { setNav({ view: 'feed' }); loadFeed(); }} className="flex items-center gap-1 text-sm text-white/50 mb-3"><ChevronLeft size={16} /> Volver al muro</button>
            <PostCard p={detail.post} onOpen={open} onLike={doLike} onFollow={doFollow} onReport={doReport}
              discreet={discreet} revealed onReveal={() => {}} />
            <div className="card rounded-3xl p-5 mt-3">
              {detail.post.body.split('\n').map((par, i) => <p key={i} className="text-[15px] leading-relaxed text-white/85 mb-3 font-display">{par}</p>)}
              <button onClick={() => { setThreadFor(detail.post.thread_of || detail.post.id); setComposer(true); }} className="mt-2 text-sm px-4 py-2 rounded-full border border-[#e8c476]/50 text-[#e8c476]">+ Añadir capítulo al hilo</button>
            </div>
            {detail.chapters?.length > 0 && (
              <div className="mt-3 space-y-3">
                <p className="text-xs tracking-widest text-white/40 font-semibold flex items-center gap-2"><BookOpen size={14} /> HILO · {detail.chapters.length} CAPÍTULOS</p>
                {detail.chapters.map(c => <PostCard key={c.id} p={c} onOpen={open} onLike={doLike} onFollow={doFollow} onReport={doReport} discreet={discreet} revealed={!!revealed[c.id]} onReveal={(id) => setRevealed(r => ({ ...r, [id]: true }))} />)}
              </div>
            )}
            <div className="card rounded-3xl p-5 mt-3">
              <p className="text-sm font-semibold flex items-center gap-2"><MessageCircle size={15} /> Comentarios · {detail.comments.length}</p>
              <div className="space-y-3 mt-3">
                {detail.comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar seed={c.author.avatar_seed} handle={c.author.handle} size={30} />
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-2 flex-1">
                      <p className="text-xs font-semibold">{c.author.handle}</p>
                      <p className="text-sm text-white/75">{c.body}</p>
                    </div>
                  </div>
                ))}
                {detail.comments.length === 0 && <p className="text-sm text-white/40">Sé el primer susurro.</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Susurra algo…" className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm" />
                <button onClick={sendComment} className="p-2.5 rounded-2xl text-[#1a0f14]" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}><Send size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {nav.view === 'profile' && profile && (
          <div>
            <button onClick={() => { setNav({ view: 'feed' }); loadFeed(); }} className="flex items-center gap-1 text-sm text-white/50 mb-3"><ChevronLeft size={16} /> Muro</button>
            <div className="card rounded-3xl p-6 text-center">
              <div className="mx-auto w-fit"><Avatar seed={profile.profile.avatar_seed} handle={profile.profile.handle} size={72} /></div>
              <h2 className="font-display text-3xl italic mt-3">{profile.profile.handle}</h2>
              <p className="text-sm text-white/55 mt-1">{profile.profile.bio || 'Sin bio. Solo tinta.'}</p>
              <div className="flex justify-center gap-6 mt-4 text-center">
                <div><p className="font-bold">{profile.profile.posts}</p><p className="text-[11px] text-white/45">relatos</p></div>
                <div><p className="font-bold">{profile.profile.followers}</p><p className="text-[11px] text-white/45">seguidores</p></div>
                <div><p className="font-bold">{profile.profile.following}</p><p className="text-[11px] text-white/45">siguiendo</p></div>
              </div>
              {me?.id !== profile.profile.id ? (
                <button onClick={() => doFollow({ ...profile.profile, followed_by_me: profile.profile.followed_by_me })} className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold bg-white text-black">
                  {profile.profile.followed_by_me ? 'Dejar de seguir' : '+ Seguir anónimo'}
                </button>
              ) : (
                <p className="mt-4 text-xs text-white/40">Este eres tú · tu sesión vive en este dispositivo</p>
              )}
            </div>
            <div className="space-y-4 mt-4">
              {profile.posts.map(p => <PostCard key={p.id} p={p} onOpen={open} onLike={doLike} onFollow={doFollow} onReport={doReport} discreet={discreet} revealed onReveal={() => {}} />)}
            </div>
          </div>
        )}

        {nav.view === 'mod' && (
          <div className="card rounded-3xl p-5">
            <p className="font-display text-2xl italic flex items-center gap-2"><ShieldCheck size={20} className="text-[#e8c476]" /> Moderación</p>
            <p className="text-xs text-white/50 mt-1">3 modos: <b>auto</b> (filtra al publicar) · <b>comunidad</b> (3 reportes → revisión) · <b>humana</b> (esta cola con MOD_KEY).</p>
            <div className="flex gap-2 mt-3">
              <input value={modKey} onChange={e => setModKey(e.target.value)} type="password" placeholder="MOD_KEY" className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm" />
              <button onClick={loadMod} className="px-4 py-2.5 rounded-2xl bg-white text-black text-sm font-semibold">Ver cola</button>
            </div>
            {queue && (
              <div className="mt-4 space-y-3">
                {queue.queue.length === 0 && <p className="text-sm text-white/40">Cola limpia. La tinta fluye.</p>}
                {queue.queue.map(p => (
                  <div key={p.id} className="rounded-2xl border border-white/10 p-4">
                    <p className="font-semibold text-sm">{p.title} <span className="text-white/40">· {p.status} · {p.reports_count} reportes</span></p>
                    <p className="text-xs text-white/55 line-clamp-3 mt-1">{p.excerpt}</p>
                    <div className="flex gap-2 mt-2">
                      {[['aprobar', 'Aprobar'], ['revision', 'Revisar'], ['ocultar', 'Ocultar']].map(([a, l]) => (
                        <button key={a} onClick={async () => { await api.modAct(p.id, a, modKey); loadMod(); }} className="text-xs px-3 py-1.5 rounded-full border border-white/15">{l}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 text-[11px] text-white/35 leading-relaxed border-t border-white/10 pt-3">
              Reglas: +18, ficción consensuada entre adultos. Prohibido: menores, incesto con menores, no-consentimiento sin marco consensuado explícito, violencia real, delitos, doxxing. El contenido ilegal se elimina y se bloquea al autor.
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav mobile-first */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden">
        <div className="mx-3 mb-3 rounded-3xl border border-white/10 bg-[#14101c]/95 backdrop-blur-xl px-2 py-2 flex items-center justify-around">
          <button onClick={() => { setNav({ view: 'feed' }); setTab('muro'); loadFeed(); }} className={clsx('p-2.5 rounded-2xl', nav.view === 'feed' && tab === 'muro' ? 'bg-white text-black' : 'text-white/55')}><Flame size={20} /></button>
          <button onClick={() => { setNav({ view: 'feed' }); setTab('hilos'); setTimeout(loadFeed, 50); }} className="p-2.5 rounded-2xl text-white/55"><BookOpen size={20} /></button>
          <button onClick={() => { setThreadFor(null); setComposer(true); }} className="w-12 h-12 rounded-2xl grid place-items-center text-[#1a0f14] -mt-6 border-4 border-[#0c0910]" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}><Plus size={22} /></button>
          <button onClick={() => { setNav({ view: 'feed' }); setTab('top'); setTimeout(loadFeed, 50); }} className="p-2.5 rounded-2xl text-white/55"><Trophy size={20} /></button>
          <button onClick={() => me && open({ view: 'profile', id: me.id })} className="p-2.5 rounded-2xl text-white/55"><Users size={20} /></button>
        </div>
      </nav>

      {/* Desktop side action */}
      <button onClick={() => { setThreadFor(null); setComposer(true); }} className="hidden sm:flex fixed bottom-6 right-6 items-center gap-2 px-5 py-3.5 rounded-full font-semibold text-[#1a0f14] shadow-2xl" style={{ background: 'linear-gradient(135deg,#e8c476,#ff8fa3)' }}>
        <Plus size={18} /> Publicar
      </button>

      <Composer open={composer} onClose={() => setComposer(false)} onDone={loadFeed} myPosts={myPosts} toast={toast} presetThread={threadFor} />

      <AnimatePresence>
        {msg && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-white text-black text-sm font-medium shadow-2xl max-w-[90vw] truncate">{msg}</motion.div>}
      </AnimatePresence>

      <footer className="max-w-2xl mx-auto px-4 mt-8 text-center text-[11px] text-white/30">
        Velvet Ink · +18 · ficción adulta consensuada · Nada aquí es real · Si ves algo ilegal, repórtalo: se oculta y se revisa.
      </footer>
    </div>
  );
}
