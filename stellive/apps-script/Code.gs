/* ══════════════════════════════════════════════════════════
   스텔라이브 아카이브 — 서버 역할을 하는 Apps Script
   README 의 "3. Apps Script" 순서대로 붙여넣고 배포한다.
   ══════════════════════════════════════════════════════════ */

/* ① config.js 의 googleClientId 와 같은 값 */
const CLIENT_ID = '';

/* ② 관리자 구글 계정 — 여기 있는 사람만 관리자 페이지에서 저장·삭제할 수 있다 */
const ADMIN_EMAILS = [
  // 'me@gmail.com',
];

/* ③ 사이트 주소 — 처음 setup 할 때 site.json 을 여기서 받아온다 */
const SITE_URL = 'https://hoje-hoje.github.io/stellive/';

/* 아래는 고칠 필요 없음 ─────────────────────────────────── */

const ROOT_NAME   = '스텔라이브 아카이브';
const GROUP_DIR   = '단체';
const DUO_DIR     = '합방';
const ALL_DIR     = '전체';
const SYS_DIR     = '_사이트';
const KINDS = { cover: '커버곡', original: '오리곡', album: '앨범', clip: '클립', fanart: '팬아트', meme: '짤' };
const GROUP_KINDS = ['cover', 'original', 'album', 'clip'];
const CACHE_TTL = 600; // 드라이브 목록 캐시 (초)

const props = PropertiesService.getScriptProperties();

/* ─── 처음 한 번 실행 ─── */
function setup() {
  let root;
  if (props.getProperty('ROOT_ID')) root = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  else {
    root = DriveApp.createFolder(ROOT_NAME);
    props.setProperty('ROOT_ID', root.getId());
  }
  root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  if (!props.getProperty('SHEET_ID')) {
    const ss = SpreadsheetApp.create('스텔라이브 아카이브 데이터');
    ss.getSheets()[0].setName('links').appendRow(['id', 'kind', 'title', 'url', 'members', 'group', 'byEmail', 'byName', 'at']);
    ss.insertSheet('favorites').appendRow(['email', 'ids', 'at']);
    DriveApp.getFileById(ss.getId()).moveTo(sysFolder_());
    props.setProperty('SHEET_ID', ss.getId());
  }

  if (!props.getProperty('SITE_FILE_ID')) {
    let json = '{}';
    try { json = UrlFetchApp.fetch(SITE_URL + 'data/site.json').getContentText(); } catch (e) {}
    const f = sysFolder_().createFile('site.json', json, 'application/json');
    props.setProperty('SITE_FILE_ID', f.getId());
  }
  ensureFolders_(readSite_());
  Logger.log('완료: ' + root.getUrl());
}

/* ─── 요청 받기 ─── */
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'bootstrap';
  try {
    if (action === 'bootstrap') return out_({ ok: true, site: readSite_(), items: allItems_() });
    return out_({ ok: false, error: '모르는 요청' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: '잘못된 요청' }); }
  try {
    const user = verify_(body.idToken);
    const fn = ACTIONS[body.action];
    if (!fn) return out_({ ok: false, error: '모르는 요청' });
    return out_(Object.assign({ ok: true }, fn(body, user)));
  } catch (err) { return out_({ ok: false, error: err.message || String(err) }); }
}

const ACTIONS = {
  whoami(b, u) { return { user: u }; },

  upload(b, u) {
    if (!KINDS[b.kind]) throw new Error('종류가 이상하다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    if (!members.length && !b.group) throw new Error('멤버를 하나 이상 골라야 한다');
    const folder = targetFolder_(site, b.kind, members, b.group);
    const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mimeType || 'application/octet-stream', b.filename || 'file');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const meta = { title: (b.title || '').trim(), members: members, group: b.group || '', byEmail: u.email, byName: u.name };
    file.setDescription(JSON.stringify(meta));
    clearCache_();
    return { item: fileItem_(file, b.kind, meta, site) };
  },

  addLink(b, u) {
    if (!KINDS[b.kind]) throw new Error('종류가 이상하다');
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//.test(url)) throw new Error('링크가 이상하다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    if (!members.length && !b.group) throw new Error('멤버를 하나 이상 골라야 한다');
    const id = 'l_' + Utilities.getUuid().slice(0, 12);
    const at = new Date().toISOString();
    sheet_('links').appendRow([id, b.kind, (b.title || '').trim(), url, JSON.stringify(members), b.group || '', u.email, u.name, at]);
    clearCache_();
    return { item: linkItem_([id, b.kind, b.title, url, JSON.stringify(members), b.group || '', u.email, u.name, at]) };
  },

  remove(b, u) {
    const admin = isAdmin_(u);
    if (String(b.id).indexOf('l_') === 0) {
      const sh = sheet_('links');
      const rows = sh.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] !== b.id) continue;
        if (!admin && rows[i][6] !== u.email) throw new Error('자기가 올린 것만 지울 수 있다');
        sh.deleteRow(i + 1);
      }
    } else {
      const file = DriveApp.getFileById(b.id);
      const meta = parseMeta_(file.getDescription());
      if (!admin && meta.byEmail !== u.email) throw new Error('자기가 올린 것만 지울 수 있다');
      file.setTrashed(true);
    }
    clearCache_();
    return {};
  },

  getFavorites(b, u) {
    const row = favRow_(u.email);
    return { ids: row ? JSON.parse(row.values[1] || '[]') : [] };
  },

  setFavorites(b, u) {
    const ids = (b.ids || []).map(String).slice(0, 5000);
    const sh = sheet_('favorites');
    const row = favRow_(u.email);
    const vals = [u.email, JSON.stringify(ids), new Date().toISOString()];
    if (row) sh.getRange(row.index, 1, 1, 3).setValues([vals]);
    else sh.appendRow(vals);
    return {};
  },

  /* ── 관리자 ── */
  saveSite(b, u) {
    needAdmin_(u);
    const site = b.site;
    if (!site || !Array.isArray(site.members) || !Array.isArray(site.groups)) throw new Error('사이트 데이터가 이상하다');
    DriveApp.getFileById(props.getProperty('SITE_FILE_ID')).setContent(JSON.stringify(site, null, 2));
    ensureFolders_(site);
    clearCache_();
    return { site: site };
  },

  uploadImage(b, u) {
    needAdmin_(u);
    const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mimeType || 'image/png', b.filename || 'image');
    const file = subFolder_(sysFolder_(), '이미지').createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { id: file.getId() };
  },

  refresh(b, u) { needAdmin_(u); clearCache_(); return { items: allItems_() }; },
};

/* ─── 로그인 확인 ─── */
function verify_(token) {
  if (!token) throw new Error('로그인이 필요하다');
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('로그인이 만료됐다. 다시 로그인해 주세요');
  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('다른 사이트의 로그인이다');
  const user = { email: info.email, name: info.name || info.email.split('@')[0], picture: info.picture || '' };
  user.admin = isAdmin_(user);
  const ttl = Math.max(60, Math.min(3000, Number(info.exp) - Math.floor(Date.now() / 1000) - 60));
  cache.put(key, JSON.stringify(user), ttl);
  return user;
}
function isAdmin_(u) { return ADMIN_EMAILS.map(s => s.toLowerCase()).indexOf(String(u.email).toLowerCase()) >= 0; }
function needAdmin_(u) { if (!isAdmin_(u)) throw new Error('관리자만 할 수 있다'); }

/* ─── 사이트 데이터 ─── */
function readSite_() {
  return JSON.parse(DriveApp.getFileById(props.getProperty('SITE_FILE_ID')).getBlob().getDataAsString() || '{}');
}

/* ─── 폴더 ─── */
function root_() { return DriveApp.getFolderById(props.getProperty('ROOT_ID')); }
function sysFolder_() { return subFolder_(root_(), SYS_DIR); }
function subFolder_(parent, name, tag) {
  // tag(멤버 id 등)를 폴더 설명에 적어두면, 이름이 바뀌어도 같은 폴더를 찾아 이름만 고친다
  if (tag) {
    const it = parent.getFolders();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getDescription() === tag) { if (f.getName() !== name) f.setName(name); return f; }
    }
  }
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) { const f = it.next(); if (tag) f.setDescription(tag); return f; }
  const f = parent.createFolder(name);
  if (tag) f.setDescription(tag);
  return f;
}
function ensureFolders_(site) {
  const root = root_();
  (site.members || []).forEach(m => {
    const mf = subFolder_(root, m.name, 'member:' + m.id);
    Object.keys(KINDS).forEach(k => subFolder_(mf, KINDS[k]));
  });
  const gf = subFolder_(root, GROUP_DIR);
  const dirs = [[ALL_DIR, 'group:all'], [DUO_DIR, 'group:duo']].concat((site.groups || []).map(g => [g.label, 'group:' + g.id]));
  dirs.forEach(d => {
    const f = subFolder_(gf, d[0], d[1]);
    GROUP_KINDS.forEach(k => subFolder_(f, KINDS[k]));
  });
}
function targetFolder_(site, kind, members, group) {
  const root = root_();
  if (group || members.length >= 2) {
    const g = (site.groups || []).filter(x => x.id === group)[0];
    const dir = group === 'all' ? [ALL_DIR, 'group:all'] : g ? [g.label, 'group:' + g.id] : [DUO_DIR, 'group:duo'];
    return subFolder_(subFolder_(subFolder_(root, GROUP_DIR), dir[0], dir[1]), KINDS[kind]);
  }
  const m = site.members.filter(x => x.id === members[0])[0];
  return subFolder_(subFolder_(root, m.name, 'member:' + m.id), KINDS[kind]);
}
function cleanMembers_(list, site) {
  const ids = (site.members || []).map(m => m.id);
  return (list || []).filter(id => ids.indexOf(id) >= 0);
}

/* ─── 목록 ─── */
function allItems_() {
  const cached = cacheGet_('items');
  if (cached) return JSON.parse(cached);
  const site = readSite_();
  const items = driveItems_(site).concat(linkItems_());
  items.sort((a, b) => (b.at > a.at ? 1 : -1));
  cachePut_('items', JSON.stringify(items), CACHE_TTL);
  return items;
}

function driveItems_(site) {
  const out = [];
  const kindByName = {};
  Object.keys(KINDS).forEach(k => { kindByName[KINDS[k]] = k; });
  const memberByTag = {}, memberByName = {};
  (site.members || []).forEach(m => { memberByTag['member:' + m.id] = m.id; memberByName[m.name] = m.id; });
  const groupByTag = { 'group:all': 'all', 'group:duo': '' }, groupByName = { [ALL_DIR]: 'all', [DUO_DIR]: '' };
  (site.groups || []).forEach(g => { groupByTag['group:' + g.id] = g.id; groupByName[g.label] = g.id; });

  const scanKinds = (folder, base) => {
    const it = folder.getFolders();
    while (it.hasNext()) {
      const kf = it.next();
      const kind = kindByName[kf.getName()];
      if (!kind) continue;
      const files = kf.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const meta = parseMeta_(file.getDescription());
        if (!meta.members || !meta.members.length) meta.members = base.members;
        if (meta.group === undefined) meta.group = base.group;
        out.push(fileItem_(file, kind, meta, site));
      }
    }
  };

  const it = root_().getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    if (name === SYS_DIR) continue;
    if (name === GROUP_DIR) {
      const git = f.getFolders();
      while (git.hasNext()) {
        const gf = git.next();
        const gid = groupByTag[gf.getDescription()] !== undefined ? groupByTag[gf.getDescription()] : groupByName[gf.getName()];
        if (gid === undefined) continue;
        const gMembers = gid && gid !== 'all' ? site.members.filter(m => m.group === gid).map(m => m.id) : [];
        scanKinds(gf, { members: gMembers, group: gid });
      }
      continue;
    }
    const mid = memberByTag[f.getDescription()] || memberByName[name];
    if (mid) scanKinds(f, { members: [mid], group: '' });
  }
  return out;
}

function fileItem_(file, kind, meta, site) {
  const name = file.getName();
  return {
    id: file.getId(),
    kind: kind,
    title: meta.title || name.replace(/\.[^.]+$/, ''),
    src: 'drive',
    mime: file.getMimeType(),
    members: meta.members || [],
    group: meta.group || '',
    by: meta.byName || '',
    byEmail: meta.byEmail || '',
    at: file.getDateCreated().toISOString(),
  };
}

function linkItems_() {
  const rows = sheet_('links').getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(linkItem_);
}
function linkItem_(r) {
  let members = [];
  try { members = JSON.parse(r[4] || '[]'); } catch (e) {}
  return {
    id: r[0], kind: r[1], title: String(r[2] || ''), src: 'link', url: r[3],
    members: members, group: r[5] || '', by: r[7] || '', byEmail: r[6] || '',
    at: r[8] instanceof Date ? r[8].toISOString() : String(r[8] || ''),
  };
}

function favRow_(email) {
  const rows = sheet_('favorites').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === email) return { index: i + 1, values: rows[i] };
  return null;
}

/* ─── 도구 ─── */
function sheet_(name) { return SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheetByName(name); }
function parseMeta_(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// CacheService 는 값 하나에 100KB 까지라 잘라서 넣는다
function cachePut_(key, str, ttl) {
  const cache = CacheService.getScriptCache();
  const size = 90000, n = Math.ceil(str.length / size);
  if (n > 50) return;
  const map = { [key + '_n']: String(n) };
  for (let i = 0; i < n; i++) map[key + '_' + i] = str.substr(i * size, size);
  cache.putAll(map, ttl);
}
function cacheGet_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key + '_n'));
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = cache.getAll(keys);
  if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join('');
}
function clearCache_() { CacheService.getScriptCache().remove('items_n'); }
