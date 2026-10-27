/* 사이트와 관리자 페이지가 같이 쓰는 것들: 데이터, 서버 요청, 로그인, 별표 */

const CFG = window.CONFIG || {};
const LIVE = !!CFG.scriptUrl;

const KINDS = [
  { id: 'cover',    name: '커버곡', music: true  },
  { id: 'original', name: '오리곡', music: true  },
  { id: 'album',    name: '앨범',   music: true  },
  { id: 'clip',     name: '클립',   music: false },
  { id: 'fanart',   name: '팬아트', music: false, image: true },
  { id: 'meme',     name: '짤',     music: false, image: true },
];
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
const GROUP_KINDS = ['cover', 'original', 'album', 'clip'];

/* ─── 작은 도구 ─── */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('stl.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('stl.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('stl.' + k); } catch {} },
};

function toast(msg, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = msg;
  t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), 2600);
}

/* ─── 이미지·영상 주소 ─── */
const driveId = s => {
  if (!s) return '';
  const m = String(s).match(/(?:\/d\/|[?&]id=|\/folders\/)([\w-]{20,})/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(s) ? s : '';
};
// 관리자가 넣은 이미지: 드라이브 id 이거나 일반 주소
const imgUrl = (s, w = 800) => {
  if (!s) return '';
  const id = driveId(s);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${w}` : s;
};

function parseLink(url) {
  const u = String(url || '');
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/)))
    return { type: 'youtube', id: m[1] };
  if ((m = u.match(/chzzk\.naver\.com\/(?:embed\/)?clips?\/([\w-]+)/))) return { type: 'chzzk', id: m[1] };
  if ((m = u.match(/chzzk\.naver\.com\/video\/(\d+)/))) return { type: 'chzzkVideo', id: m[1] };
  if (/(?:x|twitter)\.com\//.test(u)) return { type: 'x' };
  if ((m = driveId(u)) && /drive\.google|docs\.google/.test(u)) return { type: 'drive', id: m };
  if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u)) return { type: 'image' };
  if (/\.(mp4|webm|mp3|m4a|ogg)(\?|$)/i.test(u)) return { type: 'media' };
  return { type: 'link' };
}

// 아이템 하나를 화면에서 쓰기 좋게 풀어둔다
function enrich(it) {
  if (it._ok) return it;
  if (it.src === 'drive') {
    it.driveId = it.id;
    it.media = /^(video|audio)\//.test(it.mime || '') ? (it.mime.startsWith('audio') ? 'audio' : 'video') : '';
    it.isImage = /^image\//.test(it.mime || '');
    it.thumb = `https://drive.google.com/thumbnail?id=${it.id}&sz=w640`;
    it.open = `https://drive.google.com/file/d/${it.id}/view`;
  } else {
    const p = parseLink(it.url);
    it.link = p;
    it.open = it.url;
    if (p.type === 'youtube') { it.ytId = p.id; it.thumb = `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`; }
    if (p.type === 'drive') { it.driveId = p.id; it.thumb = `https://drive.google.com/thumbnail?id=${p.id}&sz=w640`; it.media = KIND[it.kind]?.music || it.kind === 'clip' ? 'video' : ''; it.isImage = KIND[it.kind]?.image; }
    if (p.type === 'image') { it.isImage = true; it.thumb = it.url; }
    if (p.type === 'media') { it.media = /\.(mp3|m4a|ogg)/i.test(it.url) ? 'audio' : 'video'; it.directUrl = it.url; }
  }
  it.playable = !!(it.ytId || it.media);
  it._ok = true;
  return it;
}

/* ─── 데이터 ─── */
const Data = {
  site: null,
  items: [],
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },

  async load() {
    // 1) 지난번 받아둔 것 → 바로 그림  2) 서버(없으면 site.json) → 다시 그림
    const cached = store.get('cache');
    if (cached && LIVE) { this.set(cached.site, cached.items); }
    try {
      if (LIVE) {
        const res = await fetch(CFG.scriptUrl + '?action=bootstrap').then(r => r.json());
        if (!res.ok) throw new Error(res.error);
        this.set(res.site, res.items);
        store.set('cache', { site: res.site, items: res.items });
      } else {
        const site = await fetch('data/site.json', { cache: 'no-cache' }).then(r => r.json());
        this.set(site, store.get('demoItems', []));
      }
    } catch (e) {
      console.error(e);
      if (!this.site) {
        const site = await fetch('data/site.json').then(r => r.json()).catch(() => ({ groups: [], members: [], events: [] }));
        this.set(site, []);
      }
      toast('서버에서 목록을 못 받아왔어요', true);
    }
  },

  set(site, items) {
    site.groups ||= []; site.members ||= []; site.events ||= []; site.banner ||= {};
    this.site = site;
    this.items = (items || []).map(enrich);
    this.emit();
  },

  member(id) { return this.site.members.find(m => m.id === id); },
  group(id) { return this.site.groups.find(g => g.id === id); },
  membersOf(gid) { return this.site.members.filter(m => m.group === gid); },
  item(id) { return this.items.find(i => i.id === id); },

  // 멤버 페이지: 그 멤버가 들어간 것 전부 (단체 것 포함)
  forMember(mid, kind) {
    return this.items.filter(i => (!kind || i.kind === kind) && i.members.includes(mid));
  },
  // 단체: 기수 단체곡이거나, 멤버가 두 명 이상인 것
  isGroupItem(i) { return !!i.group || i.members.length >= 2; },
};

/* ─── 서버 요청 ─── */
async function api(action, payload = {}) {
  if (!LIVE) throw new Error('아직 서버(Apps Script)가 연결되지 않았어요. README 를 봐 주세요');
  const token = Auth.token();
  if (!token) throw new Error('먼저 구글 로그인을 해 주세요');
  // text/plain 으로 보내야 Apps Script 가 CORS 사전 요청 없이 받는다
  const res = await fetch(CFG.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, idToken: token, ...payload }),
  }).then(r => r.json());
  if (!res.ok) {
    if (/로그인/.test(res.error)) Auth.logout(true);
    throw new Error(res.error);
  }
  return res;
}

function fileToBase64(file) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = bad;
    r.readAsDataURL(file);
  });
}

/* ─── 구글 로그인 ─── */
const Auth = {
  user: null,
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn(this.user)); },

  init() {
    const saved = store.get('auth');
    if (saved && saved.exp * 1000 > Date.now() + 60e3) { this.user = saved; }
    else store.del('auth');
    if (!CFG.googleClientId) { this.emit(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        callback: r => this.receive(r.credential),
        auto_select: true,
        cancel_on_tap_outside: true,
      });
      this.emit();
    };
    document.head.append(s);
    this.emit();
  },

  receive(credential) {
    const p = JSON.parse(decodeURIComponent(escape(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
    this.user = { token: credential, email: p.email, name: p.name || p.email, picture: p.picture || '', exp: p.exp };
    store.set('auth', this.user);
    this.emit();
  },

  token() {
    if (this.user && this.user.exp * 1000 < Date.now() + 30e3) this.logout(true);
    return this.user?.token || '';
  },

  renderButton(el) {
    if (!window.google?.accounts?.id) {
      el.innerHTML = `<button class="btn ghost sm" disabled title="config.js 에 googleClientId 를 넣어야 해요">구글 로그인</button>`;
      return;
    }
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin', locale: 'ko' });
  },

  logout(expired) {
    this.user = null;
    store.del('auth');
    if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    if (expired) toast('로그인이 만료됐어요. 다시 로그인해 주세요', true);
    this.emit();
  },
};

/* ─── 별표 ─── 로그인하면 구글 계정에, 아니면 이 브라우저에 */
const Favs = {
  ids: new Set(store.get('favs', [])),
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },
  has(id) { return this.ids.has(id); },
  toggle(id) {
    this.ids.has(id) ? this.ids.delete(id) : this.ids.add(id);
    this.save();
    this.emit();
    return this.ids.has(id);
  },
  save() {
    store.set('favs', [...this.ids]);
    if (!Auth.user || !LIVE) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => api('setFavorites', { ids: [...this.ids] }).catch(e => toast(e.message, true)), 800);
  },
  async sync() {
    if (!Auth.user || !LIVE) return;
    try {
      const { ids } = await api('getFavorites');
      const before = this.ids.size;
      ids.forEach(id => this.ids.add(id));
      store.set('favs', [...this.ids]);
      if (this.ids.size !== ids.length) this.save(); // 이 기기에만 있던 별표를 계정에 합친다
      if (this.ids.size !== before) this.emit();
    } catch (e) { console.warn(e); }
  },
};

/* ─── 아이콘 ─── */
const ICON = {
  chzzk: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 4h14l-8 7h7L5 20l5-7H5z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4.5v16H6zm7.5 0H18v16h-4.5z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 5v14l10-7zm11 0h3v14h-3z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 5v14L9 12zM5 5h3v14H5z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5c.5 4.8 2.7 8 9.5 9.5-6.8 1.5-9 4.7-9.5 9.5-.5-4.8-2.7-8-9.5-9.5 6.8-1.5 9-4.7 9.5-9.5z"/></svg>',
  starO: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M12 2.5c.5 4.8 2.7 8 9.5 9.5-6.8 1.5-9 4.7-9.5 9.5-.5-4.8-2.7-8-9.5-9.5 6.8-1.5 9-4.7 9.5-9.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 6h13v12H3zM16 10l5-3v10l-5-3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  chevL: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1c.6 6.3 4.7 10.4 11 11-6.3.6-10.4 4.7-11 11-.6-6.3-4.7-10.4-11-11C7.3 11.4 11.4 7.3 12 1z"/></svg>',
};

/* ─── 우주 배경 ─── */
function starfield(canvas) {
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = [], w, h, dpr;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    const n = Math.round((innerWidth * innerHeight) / 2600);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() ** 3 * 1.4 + 0.3) * dpr,
      a: Math.random() * 0.7 + 0.2,
      s: Math.random() * 0.002 + 0.0006,
      p: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.18 ? 260 : Math.random() < 0.3 ? 210 : 0,
    }));
  };
  const draw = t => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = still ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = s.hue ? `hsla(${s.hue},90%,85%,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    if (!still) requestAnimationFrame(draw);
  };
  addEventListener('resize', () => { resize(); if (still) draw(0); });
  resize();
  requestAnimationFrame(draw);
}

/* 멤버 동그라미/카드에 쓰는 그림 (이미지가 없으면 색 + 이름 첫 글자) */
function avatarHtml(m, cls = 'av') {
  if (!m) return '';
  const img = imgUrl(m.avatar, 400);
  return img
    ? `<span class="${cls}" style="--c:${esc(m.color)}"><img src="${esc(img)}" alt="" loading="lazy"></span>`
    : `<span class="${cls} ph" style="--c:${esc(m.color)}">${esc(m.name.slice(0, 1))}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
