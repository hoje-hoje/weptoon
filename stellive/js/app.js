/* 보는 사람용 화면 — #/ 주소로 페이지를 바꾼다
   #/              홈 (배너 · 캘린더 · 멤버 카드)
   #/m/유니id/탭    멤버 페이지
   #/group/기수id/탭 단체 · 합방
   #/listen        노래 듣기
   #/calendar      캘린더
   #/stars         별표 */

const view = $('#view');
const state = { calMonth: null, calPick: null, listenKinds: new Set(['cover', 'original', 'album']), groupMembers: new Set(), search: '' };

/* ─── 공통 조각 ─── */
const memberNames = it => it.members.map(id => Data.member(id)?.name).filter(Boolean);
const canDelete = it => Auth.user && it.byEmail && Auth.user.email === it.byEmail;

function linkBtns(m) {
  const L = m.links || {};
  const one = (k, title) => L[k]
    ? `<a class="lk lk-${k}" href="${esc(L[k])}" target="_blank" rel="noopener" title="${title}">${ICON[k]}</a>`
    : `<span class="lk lk-${k} off" title="${title} 링크 없음">${ICON[k]}</span>`;
  return one('chzzk', '치지직') + one('x', 'X') + one('youtube', '유튜브');
}

function starBtn(it) {
  const on = Favs.has(it.id);
  return `<button class="star ${on ? 'on' : ''}" data-fav="${esc(it.id)}" title="별표">${on ? ICON.star : ICON.starO}</button>`;
}

function emptyBox(text, kind, members, group) {
  return `<div class="empty">
    <div class="empty-star">${ICON.sparkle}</div>
    <p>${text}</p>
    <button class="btn ghost sm" data-upload='${esc(JSON.stringify({ kind, members, group }))}'>＋ 처음으로 올리기</button>
  </div>`;
}

/* 노래 목록 */
function songList(items, label) {
  if (!items.length) return '';
  return `<ol class="songs" data-label="${esc(label || '')}">${items.map((it, i) => `
    <li class="song ${Player.current()?.id === it.id ? 'now' : ''}" data-play="${esc(it.id)}">
      <span class="s-n">${i + 1}</span>
      <span class="s-th" style="background-image:url('${esc(it.thumb || '')}')">${it.playable ? `<i>${ICON.play}</i>` : ''}</span>
      <span class="s-t"><b>${esc(it.title)}</b><small>${esc(memberNames(it).join(' · '))}${it.group && Data.group(it.group) ? ` · ${esc(Data.group(it.group).label)} 단체` : it.group === 'all' ? ' · 전체' : ''}</small></span>
      <span class="s-k">${KIND[it.kind]?.name || ''}</span>
      <span class="s-x">
        ${starBtn(it)}
        <a class="icon-btn sm" href="${esc(it.open)}" target="_blank" rel="noopener" title="원본 열기" onclick="event.stopPropagation()">${ICON.ext}</a>
        ${canDelete(it) ? `<button class="icon-btn sm" data-del="${esc(it.id)}" title="지우기">${ICON.trash}</button>` : ''}
      </span>
    </li>`).join('')}</ol>`;
}

/* 클립 카드 */
function clipGrid(items) {
  return `<div class="clips">${items.map(it => `
    <article class="clip" data-view-item="${esc(it.id)}">
      <div class="c-th" style="${it.thumb ? `background-image:url('${esc(it.thumb)}')` : ''}">
        ${it.thumb ? '' : `<span class="c-src">${it.link?.type === 'chzzk' ? ICON.chzzk : it.link?.type === 'x' ? ICON.x : ICON.video}</span>`}
        <i class="c-play">${ICON.play}</i>
      </div>
      <div class="c-meta">
        <b>${esc(it.title || '클립')}</b>
        <small>${esc(memberNames(it).join(' · '))}</small>
      </div>
      <div class="c-x">${starBtn(it)}${canDelete(it) ? `<button class="icon-btn sm" data-del="${esc(it.id)}">${ICON.trash}</button>` : ''}</div>
    </article>`).join('')}</div>`;
}

/* 팬아트 · 짤 */
function imageGrid(items) {
  return `<div class="masonry">${items.map(it => `
    <figure class="art" data-view-item="${esc(it.id)}">
      ${it.thumb
        ? `<img src="${esc(it.thumb)}" alt="${esc(it.title)}" loading="lazy">`
        : `<div class="art-link">${it.link?.type === 'x' ? ICON.x : ICON.ext}<span>${esc(it.title || '링크로 보기')}</span></div>`}
      <figcaption><span>${esc(it.title)}</span>${starBtn(it)}${canDelete(it) ? `<button class="icon-btn sm" data-del="${esc(it.id)}">${ICON.trash}</button>` : ''}</figcaption>
    </figure>`).join('')}</div>`;
}

function itemsBlock(kind, items, label, emptyCtx) {
  if (!items.length) return emptyBox(`아직 ${KIND[kind]?.name || ''}이(가) 없어요`, kind, emptyCtx?.members, emptyCtx?.group);
  if (KIND[kind]?.music) return `
    <div class="list-head">
      <span>${items.length}곡</span>
      <span class="grow"></span>
      <button class="btn sm" data-playall data-shuffle="1">${ICON.shuffle} 랜덤</button>
      <button class="btn primary sm" data-playall>${ICON.play} 전부 듣기</button>
    </div>` + songList(items, label);
  if (KIND[kind]?.image) return imageGrid(items);
  return clipGrid(items);
}

function tabs(baseHash, current, counts) {
  return `<nav class="tabs">${KINDS.filter(k => counts[k.id] !== undefined).map(k => `
    <a href="${baseHash}/${k.id}" class="${current === k.id ? 'on' : ''}">${k.name}<small>${counts[k.id] || ''}</small></a>`).join('')}</nav>`;
}

/* ─── 홈 ─── */
function renderHome() {
  const s = Data.site;
  const b = s.banner || {};
  const bimg = imgUrl(b.image, 1600);
  view.innerHTML = `
    <section class="hero ${bimg ? 'has-img' : ''}" ${bimg ? `style="background-image:url('${esc(bimg)}')"` : ''}>
      <div class="hero-in">
        ${bimg ? '' : `<img class="hero-logo" src="assets/logo.svg" alt="">`}
        <div>
          <h1>${esc(b.title || 'STELLIVE')}</h1>
          <p>${esc(b.subtitle || '')}</p>
        </div>
      </div>
      <div class="hero-stats">
        <span><b>${s.members.length}</b>멤버</span>
        <span><b>${Data.items.filter(i => KIND[i.kind]?.music).length}</b>노래</span>
        <span><b>${Data.items.filter(i => i.kind === 'clip').length}</b>클립</span>
        <span><b>${Data.items.filter(i => KIND[i.kind]?.image).length}</b>팬아트 · 짤</span>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-t">CALENDAR<i>${ICON.sparkle}</i></h2>
      <div class="cal-wrap">${calendarHtml()}</div>
    </section>

    <div class="groups">
      ${s.groups.map(g => {
        const ms = Data.membersOf(g.id);
        if (!ms.length) return '';
        return `<section class="panel group ${ms.length <= 2 ? 'narrow' : ''}" style="--g:${esc(g.color)}">
          <h2 class="panel-t"><span>${esc(g.name)}</span><em>${esc(g.label)}</em><i>${ICON.sparkle}</i></h2>
          <div class="cards">${ms.map(memberCard).join('')}</div>
        </section>`;
      }).join('')}
    </div>
    ${newestStrip()}`;
}

function memberCard(m) {
  const img = imgUrl(m.avatar, 500);
  return `<a class="mcard" href="#/m/${esc(m.id)}" style="--c:${esc(m.color)}">
    <div class="mc-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="mc-ph">${esc(m.name.slice(0, 1))}</span>`}</div>
    <div class="mc-name">${esc(m.name)}</div>
    <div class="mc-links" onclick="event.stopPropagation()">${linkBtns(m)}</div>
  </a>`;
}

function newestStrip() {
  const recent = Data.items.slice(0, 8);
  if (!recent.length) return '';
  return `<section class="panel">
    <h2 class="panel-t">NEW<i>${ICON.sparkle}</i></h2>
    ${songList(recent.filter(i => KIND[i.kind]?.music), '새로 올라온 노래')}
    ${clipGrid(recent.filter(i => !KIND[i.kind]?.music && !KIND[i.kind]?.image))}
    ${imageGrid(recent.filter(i => KIND[i.kind]?.image))}
  </section>`;
}

/* ─── 캘린더 ─── */
function eventsOn(y, mo, d) {
  const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const md = iso.slice(5);
  const out = [];
  for (const m of Data.site.members) {
    if (m.birthday && m.birthday.slice(-5) === md) out.push({ type: 'birthday', title: `${m.name} 생일`, color: m.color, member: m.id });
    if (m.debut && m.debut.slice(5) === md && +m.debut.slice(0, 4) < y)
      out.push({ type: 'debut', title: `${m.name} 데뷔 ${y - +m.debut.slice(0, 4)}주년`, color: m.color, member: m.id });
  }
  for (const e of Data.site.events) {
    const end = e.end || e.date;
    if (e.date <= iso && iso <= end) {
      const m = Data.member(e.members?.[0]);
      out.push({ type: e.type || 'event', title: e.title, color: m?.color || '#9fb4ff', url: e.url, members: e.members || [] });
    }
  }
  return out;
}

const EVENT_TYPES = { birthday: '생일', debut: '데뷔', event: '이벤트', broadcast: '방송', release: '발매', etc: '기타' };

function calendarHtml() {
  const now = new Date();
  const [y, mo] = state.calMonth || [now.getFullYear(), now.getMonth()];
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="cd blank"></div>';
  for (let d = 1; d <= days; d++) {
    const ev = eventsOn(y, mo, d);
    const pick = state.calPick === `${y}-${mo}-${d}`;
    cells += `<button class="cd ${todayKey === `${y}-${mo}-${d}` ? 'today' : ''} ${pick ? 'pick' : ''} ${ev.length ? 'has' : ''}" data-day="${y}-${mo}-${d}">
      <span class="cd-n">${d}</span>
      ${ev.slice(0, 3).map(e => `<span class="ev ev-${e.type}" style="--c:${esc(e.color)}">${e.type === 'birthday' ? '🎂 ' : ''}${esc(e.title)}</span>`).join('')}
      ${ev.length > 3 ? `<span class="ev more">+${ev.length - 3}</span>` : ''}
    </button>`;
  }

  // 아래 목록: 고른 날 / 아니면 앞으로 45일
  let list = [];
  if (state.calPick) {
    const [py, pm, pd] = state.calPick.split('-').map(Number);
    list = eventsOn(py, pm, pd).map(e => ({ ...e, d: new Date(py, pm, pd) }));
  } else {
    for (let i = 0; i < 45; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      eventsOn(dt.getFullYear(), dt.getMonth(), dt.getDate()).forEach(e => list.push({ ...e, d: dt }));
    }
  }
  const dday = d => {
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    return diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
  };

  return `
    <div class="cal">
      <div class="cal-head">
        <button class="icon-btn" data-cal="-1">${ICON.chevL}</button>
        <b>${y}. ${String(mo + 1).padStart(2, '0')}</b>
        <button class="icon-btn" data-cal="1">${ICON.chevR}</button>
        <button class="btn ghost sm" data-cal="0">오늘</button>
      </div>
      <div class="cal-dow">${['일', '월', '화', '수', '목', '금', '토'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div class="upcoming">
      <h3>${state.calPick ? `${state.calPick.split('-')[1] * 1 + 1}월 ${state.calPick.split('-')[2]}일` : '다가오는 일정'}</h3>
      ${list.length ? `<ul>${list.map(e => `
        <li style="--c:${esc(e.color)}">
          <span class="u-d">${state.calPick ? '' : `<b>${dday(e.d)}</b>`}${e.d.getMonth() + 1}/${e.d.getDate()}</span>
          <span class="u-t"><em>${EVENT_TYPES[e.type] || '일정'}</em>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}</span>
        </li>`).join('')}</ul>` : '<p class="muted">일정이 없어요</p>'}
    </div>`;
}

/* ─── 멤버 페이지 (X 프로필처럼) ─── */
function renderMember(id, tab) {
  const m = Data.member(id);
  if (!m) return renderNotFound();
  const g = Data.group(m.group);
  const counts = {};
  KINDS.forEach(k => (counts[k.id] = Data.forMember(id, k.id).length));
  tab = KIND[tab] ? tab : 'cover';
  const items = Data.forMember(id, tab);
  const banner = imgUrl(m.banner, 1600);
  const bd = m.birthday ? m.birthday.slice(-5).split('-').map(Number) : null;

  view.innerHTML = `
    <article class="profile" style="--c:${esc(m.color)}">
      <div class="pf-banner" ${banner ? `style="background-image:url('${esc(banner)}')"` : ''}></div>
      <div class="pf-head">
        ${avatarHtml(m, 'pf-av')}
        <div class="pf-actions">
          <div class="pf-links">${linkBtns(m)}</div>
          <button class="btn primary sm" data-playmember="${esc(m.id)}">${ICON.play} 노래 전부 듣기</button>
        </div>
      </div>
      <div class="pf-info">
        <h1>${esc(m.name)}${g ? `<span class="badge" style="--c:${esc(g.color)}">${esc(g.label)} · ${esc(g.name)}</span>` : ''}</h1>
        ${m.fullName ? `<p class="pf-handle">${esc(m.fullName)}</p>` : ''}
        ${m.bio ? `<p class="pf-bio">${esc(m.bio)}</p>` : ''}
        <p class="pf-meta">
          ${bd ? `<span>🎂 ${bd[0]}월 ${bd[1]}일</span>` : ''}
          ${m.debut ? `<span>✦ ${fmtDate(m.debut)} 데뷔</span>` : ''}
          <span><b>${counts.cover + counts.original + counts.album}</b> 노래</span>
          <span><b>${counts.clip}</b> 클립</span>
          <span><b>${counts.fanart + counts.meme}</b> 팬아트 · 짤</span>
        </p>
      </div>
      ${tabs(`#/m/${m.id}`, tab, counts)}
      <div class="pf-body">
        <div class="list-tools">
          <button class="btn ghost sm" data-upload='${esc(JSON.stringify({ kind: tab, members: [m.id] }))}'>＋ ${KIND[tab].name} 올리기</button>
        </div>
        ${itemsBlock(tab, items, `${m.name} ${KIND[tab].name}`, { members: [m.id] })}
      </div>
    </article>`;
}

/* ─── 단체 · 합방 ─── */
function renderGroup(gid, tab) {
  tab = GROUP_KINDS.includes(tab) ? tab : 'cover';
  gid = gid || 'all';
  const groups = Data.site.groups.filter(g => Data.membersOf(g.id).length > 1);
  let pool = Data.items.filter(i => Data.isGroupItem(i));
  if (gid === 'duo') pool = pool.filter(i => !i.group && i.members.length >= 2);
  else if (gid !== 'all') {
    // 기수 단체곡 + 그 기수 멤버끼리만 한 것
    const ids = Data.membersOf(gid).map(m => m.id);
    pool = pool.filter(i => i.group === gid || (!i.group && i.members.length >= 2 && i.members.every(x => ids.includes(x))));
  }
  const sel = [...state.groupMembers];
  if (sel.length) pool = pool.filter(i => sel.every(x => i.members.includes(x)));
  const counts = {};
  GROUP_KINDS.forEach(k => (counts[k] = pool.filter(i => i.kind === k).length));
  const items = pool.filter(i => i.kind === tab);
  const chipMembers = gid === 'all' || gid === 'duo' ? Data.site.members : Data.membersOf(gid);
  const g = Data.group(gid);

  view.innerHTML = `
    <section class="page-head">
      <h1>단체 · 합방</h1>
      <p class="muted">기수 단체곡, 그리고 멤버 두 명 이상이 함께한 것들</p>
    </section>
    <nav class="pills">
      <a href="#/group/all/${tab}" class="${gid === 'all' ? 'on' : ''}">전부</a>
      ${groups.map(x => `<a href="#/group/${x.id}/${tab}" class="${gid === x.id ? 'on' : ''}" style="--c:${esc(x.color)}">${esc(x.label)} <small>${esc(x.name)}</small></a>`).join('')}
      <a href="#/group/duo/${tab}" class="${gid === 'duo' ? 'on' : ''}">합방</a>
    </nav>
    <div class="chips filter">
      <span class="muted sm">같이 나온 멤버로 거르기</span>
      ${chipMembers.map(m => `<button class="chip ${state.groupMembers.has(m.id) ? 'on' : ''}" data-gm="${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av xs')}${esc(m.name)}</button>`).join('')}
      ${sel.length ? `<button class="chip clear" data-gm="">지우기</button>` : ''}
    </div>
    ${tabs(`#/group/${gid}`, tab, counts)}
    <div class="pf-body">
      <div class="list-tools">
        <button class="btn ghost sm" data-upload='${esc(JSON.stringify({ kind: tab, group: g ? g.id : gid === 'all' ? 'all' : '', members: sel }))}'>＋ ${KIND[tab].name} 올리기</button>
      </div>
      ${itemsBlock(tab, items, `${g ? g.label : gid === 'duo' ? '합방' : '단체'} ${KIND[tab].name}`, { group: g?.id, members: sel })}
    </div>`;
}

/* ─── 노래 듣기 ─── */
function renderListen() {
  const kinds = state.listenKinds;
  const music = Data.items.filter(i => kinds.has(i.kind) && i.playable);
  const q = state.search.trim().toLowerCase();
  const shown = q ? music.filter(i => (i.title + ' ' + memberNames(i).join(' ')).toLowerCase().includes(q)) : music;
  const favs = music.filter(i => Favs.has(i.id));

  view.innerHTML = `
    <section class="page-head">
      <h1>노래 듣기</h1>
      <p class="muted">고르면 아래 플레이어에서 끝날 때마다 다음 곡으로 넘어가요</p>
    </section>
    <div class="chips filter">
      ${KINDS.filter(k => k.music).map(k => `<button class="chip ${kinds.has(k.id) ? 'on' : ''}" data-lk="${k.id}">${k.name}</button>`).join('')}
    </div>
    <div class="modes">
      <button class="mode" data-mode="random"><i>${ICON.shuffle}</i><b>전체 랜덤</b><small>${music.length}곡</small></button>
      <button class="mode" data-mode="stars"><i>${ICON.star}</i><b>별표한 노래</b><small>${favs.length}곡 · ${Auth.user ? '구글 계정' : '이 기기'}</small></button>
      <button class="mode" data-mode="newest"><i>${ICON.sparkle}</i><b>최신순</b><small>새로 올라온 것부터</small></button>
    </div>
    <h3 class="sub-h">멤버별</h3>
    <div class="mgrid">
      ${Data.site.members.map(m => {
        const n = music.filter(i => i.members.includes(m.id)).length;
        return `<button class="mpick" data-playmember="${esc(m.id)}" style="--c:${esc(m.color)}" ${n ? '' : 'disabled'}>${avatarHtml(m, 'av md')}<b>${esc(m.name)}</b><small>${n}곡</small></button>`;
      }).join('')}
    </div>
    <h3 class="sub-h">기수별</h3>
    <div class="mgrid">
      ${Data.site.groups.map(g => {
        const ids = Data.membersOf(g.id).map(m => m.id);
        const n = music.filter(i => i.group === g.id || i.members.some(x => ids.includes(x))).length;
        return `<button class="mpick grp" data-playgroup="${esc(g.id)}" style="--c:${esc(g.color)}" ${n ? '' : 'disabled'}><b>${esc(g.label)}</b><small>${esc(g.name)} · ${n}곡</small></button>`;
      }).join('')}
    </div>
    <div class="list-head search">
      <input id="songSearch" placeholder="제목이나 멤버로 찾기" value="${esc(state.search)}">
    </div>
    ${shown.length ? songList(shown, '전체') : emptyBox('아직 노래가 없어요', 'cover', [])}`;
  const inp = $('#songSearch');
  inp.addEventListener('input', () => {
    state.search = inp.value;
    const pos = inp.selectionStart;
    renderListen();
    const again = $('#songSearch');
    again.focus();
    again.setSelectionRange(pos, pos);
  });
}

/* ─── 별표 ─── */
function renderStars() {
  const items = Data.items.filter(i => Favs.has(i.id));
  const music = items.filter(i => KIND[i.kind]?.music);
  const clips = items.filter(i => i.kind === 'clip');
  const arts = items.filter(i => KIND[i.kind]?.image);
  view.innerHTML = `
    <section class="page-head">
      <h1>별표</h1>
      <p class="muted">${Auth.user ? `${esc(Auth.user.name)} 계정에 저장돼요` : '이 기기에만 저장돼요. 로그인하면 계정에 합쳐져요'}</p>
    </section>
    ${items.length ? '' : '<div class="empty"><div class="empty-star">' + ICON.sparkle + '</div><p>☆ 를 눌러서 모아보세요</p></div>'}
    ${music.length ? `<h3 class="sub-h">노래</h3>${itemsBlock('cover', music, '별표')}` : ''}
    ${clips.length ? `<h3 class="sub-h">클립</h3>${clipGrid(clips)}` : ''}
    ${arts.length ? `<h3 class="sub-h">팬아트 · 짤</h3>${imageGrid(arts)}` : ''}`;
}

function renderCalendarPage() {
  view.innerHTML = `
    <section class="page-head"><h1>캘린더</h1><p class="muted">생일 · 데뷔 기념일 · 이벤트</p></section>
    <section class="panel"><div class="cal-wrap big">${calendarHtml()}</div></section>`;
}

function renderNotFound() {
  view.innerHTML = `<div class="empty"><div class="empty-star">${ICON.sparkle}</div><p>여긴 아무것도 없는 우주예요</p><a class="btn" href="#/">홈으로</a></div>`;
}

/* ─── 목차 ─── */
function renderSide() {
  $('#sideMembers').innerHTML = Data.site.groups.map(g => {
    const ms = Data.membersOf(g.id);
    if (!ms.length) return '';
    return `<div class="side-g" style="--c:${esc(g.color)}">
      <div class="side-gt">${esc(g.label)} <small>${esc(g.name)}</small></div>
      ${ms.map(m => `<a href="#/m/${esc(m.id)}" data-nav="m-${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av xs')}<span>${esc(m.name)}</span></a>`).join('')}
    </div>`;
  }).join('');
  markNav();
}

function markNav() {
  const [, page, id] = location.hash.split('/');
  const key = page === 'm' ? 'm-' + id : page || 'home';
  $$('#side [data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === key));
}

/* ─── 주소 바뀔 때 ─── */
function route(keepScroll) {
  if (!Data.site) return;
  const [, page, a, b] = location.hash.split('/');
  if (!page) renderHome();
  else if (page === 'm') renderMember(decodeURIComponent(a || ''), b);
  else if (page === 'group') { if (state._g !== a) state.groupMembers.clear(); state._g = a; renderGroup(a, b); }
  else if (page === 'listen') renderListen();
  else if (page === 'calendar') renderCalendarPage();
  else if (page === 'stars') renderStars();
  else renderNotFound();
  markNav();
  document.body.classList.remove('side-open');
  if (!keepScroll) window.scrollTo(0, 0);
}

/* ─── 클릭 처리 (한 군데서) ─── */
document.addEventListener('click', e => {
  const t = e.target;
  let el;

  if ((el = t.closest('[data-fav]'))) { e.stopPropagation(); Favs.toggle(el.dataset.fav); return; }
  if ((el = t.closest('[data-del]'))) { e.stopPropagation(); deleteItem(el.dataset.del); return; }
  if ((el = t.closest('[data-upload]'))) { openUpload(JSON.parse(el.dataset.upload || '{}')); return; }

  if ((el = t.closest('[data-play]'))) {
    if (t.closest('a')) return;
    const list = el.closest('.songs');
    const ids = $$('[data-play]', list).map(x => x.dataset.play);
    const items = ids.map(id => Data.item(id)).filter(Boolean);
    const it = Data.item(el.dataset.play);
    if (!it.playable) { openViewer(it); return; }
    Player.play(items, it.id, list.dataset.label);
    return;
  }
  if ((el = t.closest('[data-playall]'))) {
    const list = el.closest('.list-head').nextElementSibling;
    const items = $$('[data-play]', list).map(x => Data.item(x.dataset.play)).filter(Boolean);
    if (el.dataset.shuffle) { Player.shuffle = true; Player.paintModes(); }
    Player.play(items, null, list.dataset.label);
    return;
  }
  if ((el = t.closest('[data-playmember]'))) {
    const m = Data.member(el.dataset.playmember);
    const kinds = location.hash.startsWith('#/listen') ? state.listenKinds : new Set(['cover', 'original', 'album']);
    Player.play(Data.items.filter(i => kinds.has(i.kind) && i.members.includes(m.id)), null, `${m.name} 노래`);
    return;
  }
  if ((el = t.closest('[data-playgroup]'))) {
    const g = Data.group(el.dataset.playgroup);
    const ids = Data.membersOf(g.id).map(m => m.id);
    Player.play(Data.items.filter(i => state.listenKinds.has(i.kind) && (i.group === g.id || i.members.some(x => ids.includes(x)))), null, `${g.label} 노래`);
    return;
  }
  if ((el = t.closest('[data-mode]'))) {
    const music = Data.items.filter(i => state.listenKinds.has(i.kind) && i.playable);
    const mode = el.dataset.mode;
    if (mode === 'random') { Player.shuffle = true; Player.paintModes(); Player.play(music, null, '전체 랜덤'); }
    if (mode === 'stars') {
      const favs = music.filter(i => Favs.has(i.id));
      if (!favs.length) return toast('별표한 노래가 없어요');
      Player.play(favs, null, '별표한 노래');
    }
    if (mode === 'newest') { Player.shuffle = false; Player.paintModes(); Player.play(music, null, '최신순'); }
    return;
  }
  if ((el = t.closest('[data-lk]'))) {
    const k = el.dataset.lk;
    state.listenKinds.has(k) ? state.listenKinds.delete(k) : state.listenKinds.add(k);
    if (!state.listenKinds.size) state.listenKinds.add(k);
    renderListen();
    return;
  }
  if ((el = t.closest('[data-gm]'))) {
    const id = el.dataset.gm;
    if (!id) state.groupMembers.clear();
    else state.groupMembers.has(id) ? state.groupMembers.delete(id) : state.groupMembers.add(id);
    route(true);
    return;
  }
  if ((el = t.closest('[data-view-item]'))) { openViewer(Data.item(el.dataset.viewItem)); return; }

  if ((el = t.closest('[data-cal]'))) {
    const now = new Date();
    const [y, mo] = state.calMonth || [now.getFullYear(), now.getMonth()];
    const d = +el.dataset.cal;
    state.calMonth = d ? [new Date(y, mo + d).getFullYear(), new Date(y, mo + d).getMonth()] : null;
    state.calPick = null;
    $$('.cal-wrap').forEach(w => (w.innerHTML = calendarHtml()));
    return;
  }
  if ((el = t.closest('[data-day]'))) {
    state.calPick = state.calPick === el.dataset.day ? null : el.dataset.day;
    $$('.cal-wrap').forEach(w => (w.innerHTML = calendarHtml()));
    return;
  }
  if (t.closest('[data-close]') || t.classList.contains('modal')) { closeModals(); return; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals();
  if (e.key === ' ' && !Player.bar.hidden && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) {
    e.preventDefault(); Player.toggle();
  }
});

/* ─── 보기 창 ─── */
function openViewer(it) {
  if (!it) return;
  const body = $('#viewer .viewer-body');
  let html = '';
  if (it.ytId) html = `<div class="ratio"><iframe src="https://www.youtube.com/embed/${it.ytId}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  else if (it.link?.type === 'chzzk') html = `<div class="ratio"><iframe src="https://chzzk.naver.com/embed/clip/${esc(it.link.id)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
  else if (it.isImage && it.driveId) html = `<img class="big-img" src="https://drive.google.com/thumbnail?id=${it.driveId}&sz=w2000" alt="">`;
  else if (it.isImage) html = `<img class="big-img" src="${esc(it.url)}" alt="">`;
  else if (it.driveId && it.media && CFG.driveApiKey) html = `<video class="big-vid" controls autoplay playsinline src="https://www.googleapis.com/drive/v3/files/${it.driveId}?alt=media&key=${CFG.driveApiKey}"></video>`;
  else if (it.driveId) html = `<div class="ratio"><iframe src="https://drive.google.com/file/d/${it.driveId}/preview" allow="autoplay" allowfullscreen></iframe></div>`;
  else if (it.directUrl) html = `<video class="big-vid" controls autoplay playsinline src="${esc(it.directUrl)}"></video>`;
  else if (it.link?.type === 'x') html = `<div class="x-embed"><blockquote class="twitter-tweet" data-theme="dark" data-lang="ko"><a href="${esc(it.url.replace('//x.com', '//twitter.com'))}"></a></blockquote></div>`;
  else html = `<div class="empty"><p>여기서는 바로 못 보여줘요</p></div>`;
  body.innerHTML = html;
  $('#viewer .viewer-foot').innerHTML = `
    <div><b>${esc(it.title)}</b><small>${esc(memberNames(it).join(' · '))}${it.by ? ` · 올린 사람 ${esc(it.by)}` : ''}</small></div>
    <span class="grow"></span>${starBtn(it)}
    <a class="btn sm" href="${esc(it.open)}" target="_blank" rel="noopener">${ICON.ext} 원본</a>`;
  $('#viewer').hidden = false;
  if (it.link?.type === 'x') loadX().then(() => window.twttr?.widgets?.load(body));
  if (Player.playing && (it.ytId || it.media || it.link?.type === 'chzzk')) Player.toggle(false);
}
function loadX() {
  if (loadX.p) return loadX.p;
  return (loadX.p = new Promise(ok => {
    const s = document.createElement('script');
    s.src = 'https://platform.twitter.com/widgets.js';
    s.onload = ok; s.onerror = ok;
    document.head.append(s);
  }));
}
function closeModals() {
  $$('.modal').forEach(m => (m.hidden = true));
  $('#viewer .viewer-body').innerHTML = '';
  $('#queue').classList.remove('open');
}

/* ─── 올리기 ─── */
const up = { kind: 'cover', members: new Set(), mode: 'link' };

function openUpload(pre = {}) {
  up.kind = pre.kind || up.kind;
  up.members = new Set(pre.members || []);
  if (!up.members.size) {
    const [, page, id] = location.hash.split('/');
    if (page === 'm') up.members.add(id);
  }
  $('#upKind').innerHTML = KINDS.map(k => `<button type="button" class="chip ${k.id === up.kind ? 'on' : ''}" data-uk="${k.id}">${k.name}</button>`).join('');
  $('#upMembers').innerHTML = Data.site.members.map(m => `<button type="button" class="chip ${up.members.has(m.id) ? 'on' : ''}" data-um="${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av xs')}${esc(m.name)}</button>`).join('');
  $('#upGroup').innerHTML = `<option value="">아니요</option><option value="all">전체 단체곡</option>` +
    Data.site.groups.map(g => `<option value="${esc(g.id)}">${esc(g.label)} ${esc(g.name)}</option>`).join('');
  $('#upGroup').value = pre.group || '';
  $('#upTitle').value = '';
  $('#upUrl').value = '';
  $('#upFile').value = '';
  $('.drop-txt').textContent = '여기에 끌어다 놓거나 눌러서 고르기';
  $('#upStatus').textContent = '';
  $('#upHint').innerHTML = !LIVE
    ? '지금은 <b>미리보기 모드</b>라 링크만 이 브라우저에 저장돼요. 서버를 연결하면 모두에게 보여요.'
    : Auth.user ? `<b>${esc(Auth.user.name)}</b> 이름으로 올라가요. 파일은 공유 드라이브의 멤버 폴더에 들어가요.` : '올리려면 먼저 왼쪽 아래에서 구글 로그인을 해 주세요.';
  setUpMode(up.mode);
  $('#upload').hidden = false;
}

function setUpMode(m) {
  up.mode = m;
  $$('#upMode button').forEach(b => b.setAttribute('aria-selected', b.dataset.m === m));
  $$('#upload [data-show]').forEach(el => (el.hidden = el.dataset.show !== m));
}

$('#upload').addEventListener('click', e => {
  const k = e.target.closest('[data-uk]'), mm = e.target.closest('[data-um]'), md = e.target.closest('[data-m]');
  if (k) { up.kind = k.dataset.uk; $$('#upKind .chip').forEach(c => c.classList.toggle('on', c === k)); }
  if (mm) { const id = mm.dataset.um; up.members.has(id) ? up.members.delete(id) : up.members.add(id); mm.classList.toggle('on'); }
  if (md) setUpMode(md.dataset.m);
});
$('#upFile').addEventListener('change', () => {
  const f = $('#upFile').files[0];
  $('.drop-txt').textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)}MB` : '여기에 끌어다 놓거나 눌러서 고르기';
  if (f && !$('#upTitle').value) $('#upTitle').value = f.name.replace(/\.[^.]+$/, '');
});

$('#upload form').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('#upStatus');
  const members = [...up.members];
  const group = $('#upGroup').value;
  const title = $('#upTitle').value.trim();
  if (!members.length && !group) return (status.textContent = '멤버를 골라 주세요');
  const btn = $('#upSubmit');

  try {
    btn.disabled = true;
    let item;
    if (up.mode === 'link') {
      const url = $('#upUrl').value.trim();
      if (!/^https?:\/\//.test(url)) throw new Error('링크를 넣어 주세요');
      if (!LIVE) {
        item = { id: 'l_' + Date.now(), kind: up.kind, title: title || url, src: 'link', url, members, group, by: '나', at: new Date().toISOString() };
        store.set('demoItems', [item, ...store.get('demoItems', [])]);
      } else {
        status.textContent = '올리는 중…';
        item = (await api('addLink', { kind: up.kind, title, url, members, group })).item;
      }
    } else {
      const f = $('#upFile').files[0];
      if (!f) throw new Error('파일을 골라 주세요');
      if (f.size > (CFG.maxUploadMB || 35) * 1048576)
        throw new Error(`${CFG.maxUploadMB || 35}MB 까지만 돼요. 큰 영상은 드라이브에 직접 올리고 링크를 붙여 주세요`);
      if (!LIVE) throw new Error('파일 올리기는 서버를 연결한 뒤에 돼요');
      status.textContent = '파일 읽는 중…';
      const data = await fileToBase64(f);
      status.textContent = '드라이브에 올리는 중… (큰 파일은 1분쯤 걸려요)';
      item = (await api('upload', { kind: up.kind, title, members, group, filename: f.name, mimeType: f.type, data })).item;
    }
    Data.items.unshift(enrich(item));
    store.set('cache', { site: Data.site, items: Data.items.map(({ _ok, ...x }) => x) });
    $('#upload').hidden = true;
    toast('올렸어요 ✦');
    route(true);
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

async function deleteItem(id) {
  if (!confirm('지울까요?')) return;
  try {
    if (!LIVE) store.set('demoItems', store.get('demoItems', []).filter(x => x.id !== id));
    else await api('remove', { id });
    Data.items = Data.items.filter(i => i.id !== id);
    toast('지웠어요');
    route(true);
  } catch (e) { toast(e.message, true); }
}

/* ─── 시작 ─── */
$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
$('#uploadBtn').addEventListener('click', () => openUpload());
$('#side').addEventListener('click', e => { if (e.target === $('#side')) document.body.classList.remove('side-open'); });

function paintLogin(user) {
  const el = $('#login');
  if (user) {
    el.innerHTML = `<div class="me">${user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<span>${esc(user.name)}</span><button class="tiny" id="logout">로그아웃</button></div>`;
    $('#logout').onclick = () => Auth.logout();
  } else Auth.renderButton(el);
}

Auth.on(user => {
  paintLogin(user);
  if (user) Favs.sync();
  if (Data.site) route(true);
});
Favs.on(() => {
  $$('[data-fav]').forEach(b => {
    const on = Favs.has(b.dataset.fav);
    b.classList.toggle('on', on);
    b.innerHTML = on ? ICON.star : ICON.starO;
  });
  if (location.hash.startsWith('#/stars')) route(true);
});
Data.on(() => { renderSide(); route(true); });
addEventListener('hashchange', () => route());

starfield($('#sky'));
Player.init();
$('[data-p="shuffle"]').innerHTML = ICON.shuffle;
$('[data-p="prev"]').innerHTML = ICON.prev;
$('[data-p="next"]').innerHTML = ICON.next;
$('[data-p="repeat"]').innerHTML = ICON.repeat;
$('[data-p="hide"]').innerHTML = ICON.video;
$('[data-p="queue"]').innerHTML = ICON.menu;
$$('.close').forEach(b => (b.innerHTML = ICON.close));
Player.setPlaying(false);
Player.paintModes();
Auth.init();
Data.load();
