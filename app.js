const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText = (v) => { try { return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)); } catch { return ''; } };
let hostsCache = [];
let isAdmin = false;

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json', ...(options.headers || {})},
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}
function empty(message) { return `<div class="empty">${esc(message)}</div>`; }

async function loadHosts() {
  const data = await api('hosts');
  hostsCache = data.hosts || [];
  $('#host-grid').innerHTML = hostsCache.length ? hostsCache.map(h => `
    <article class="host-card">
      <div class="host-photo">${h.image_url ? `<img src="${esc(h.image_url)}" alt="${esc(h.name)} 프로필" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="placeholder">${esc((h.name||'V').slice(0,1))}</span>`}<span class="host-tag">${esc(h.color || 'VELVET')}</span></div>
      <div class="host-info"><h3 class="host-name">${esc(h.name)}</h3><div class="host-meta">${h.age ? `${esc(h.age)} YEARS` : 'HOST'}${h.height ? ` · ${esc(h.height)} CM` : ''}</div>
      ${h.tagline ? `<p class="host-tagline">${esc(h.tagline)}</p>` : ''}${h.bio ? `<p class="host-bio">${esc(h.bio)}</p>` : ''}</div>
    </article>`).join('') : empty('아직 등록된 호스트가 없습니다.');
  const options = hostsCache.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('');
  $('#attendance-host').innerHTML = options; $('#points-host').innerHTML = options;
}
async function loadRanking() {
  const data = await api('ranking');
  $('#ranking-list').innerHTML = data.ranking.length ? data.ranking.map((h,i) => `
    <div class="rank-row"><div class="rank-num">${String(i+1).padStart(2,'0')}</div><div><div class="rank-name">${esc(h.name)}</div><div class="rank-sub">${esc(h.color || 'VELVET HOST')}</div></div><div class="rank-points">${Number(h.points||0).toLocaleString()}<small>ACTIVITY PTS</small></div></div>`).join('') : empty('포인트 기록이 쌓이면 랭킹이 표시됩니다.');
}
async function loadAttendance() {
  const data = await api('attendance');
  const labels = {on:'ON DUTY',off:'OFF DUTY','休':'DAY OFF'};
  $('#attendance-list').innerHTML = data.attendance.length ? data.attendance.map(a => `
    <div class="attendance-card"><div><div class="attendance-name">${esc(a.name)}</div><div class="attendance-note">${esc(a.note || (a.status === 'on' ? '오늘 출근합니다.' : ''))}</div></div><span class="status ${a.status === 'on' ? 'on' : ''}">${labels[a.status] || 'OFF DUTY'}</span></div>`).join('') : empty('오늘의 출근 정보가 없습니다.');
}
async function loadPosts() {
  const data = await api('posts');
  $('#post-list').innerHTML = data.posts.length ? data.posts.map(p => `
    <article class="post-card"><div class="post-meta">${p.pinned ? '✦ PINNED · ' : ''}${dateText(p.created_at)}</div><h4>${esc(p.title)}</h4><p>${esc(p.body)}</p>
    <div class="comments" data-post="${p.id}"><div class="comment-items"></div><form class="comment-form"><input name="nickname" maxlength="30" required placeholder="닉네임"><input name="body" maxlength="500" required placeholder="댓글을 남겨주세요"><button class="outline-btn" type="submit">등록</button></form></div></article>`).join('') : empty('등록된 공지사항이 없습니다.');
  for (const p of data.posts) loadComments(p.id);
}
async function loadComments(postId) {
  try {
    const data = await api(`comments?post_id=${encodeURIComponent(postId)}`);
    const holder = document.querySelector(`.comments[data-post="${postId}"] .comment-items`);
    if (!holder) return;
    holder.innerHTML = data.comments.map(c => `<div class="comment-line"><strong>${esc(c.nickname)}</strong> <span>${esc(c.body)}</span></div>`).join('');
  } catch {}
}
async function loadGuestbook() {
  const data = await api('guestbook');
  $('#guestbook-list').innerHTML = data.entries.length ? data.entries.map(e => `<div class="guest-item"><strong>${esc(e.nickname)}</strong><p>${esc(e.message)}</p><small>${dateText(e.created_at)}</small></div>`).join('') : '<p class="muted">첫 번째 메시지를 남겨주세요.</p>';
}
async function refreshAll() {
  try { await Promise.all([loadHosts(), loadRanking(), loadAttendance(), loadPosts(), loadGuestbook()]); }
  catch (e) { toast(e.message); }
}
function showAdmin() { $('#admin-dialog').showModal(); }
function setAdmin(value) {
  isAdmin = value; $('#login-view').hidden = value; $('#admin-view').hidden = !value;
  $('#admin-status').textContent = value ? '관리자 로그인 상태' : '';
}
$('#admin-open').addEventListener('click', async () => {
  showAdmin();
  try { const r = await api('auth'); setAdmin(!!r.admin); } catch { setAdmin(false); }
});
$('#admin-close').addEventListener('click', () => $('#admin-dialog').close());
$('#admin-dialog').addEventListener('click', e => { if (e.target === $('#admin-dialog')) $('#admin-dialog').close(); });
$$('.admin-tabs button').forEach(btn => btn.addEventListener('click', () => {
  $$('.admin-tabs button').forEach(b => b.classList.toggle('active', b === btn));
  $$('.admin-panel').forEach(p => p.hidden = p.dataset.panel !== btn.dataset.tab);
}));
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-error').textContent = '';
  try { await api('login', {method:'POST', body:{password:new FormData(e.currentTarget).get('password')}}); setAdmin(true); e.currentTarget.reset(); toast('관리자 로그인 성공'); }
  catch (err) { $('#login-error').textContent = err.message; }
});
$('#logout-btn').addEventListener('click', async () => {
  try { await api('logout', {method:'POST', body:{}}); setAdmin(false); toast('로그아웃했습니다.'); }
  catch (e) { toast(e.message); }
});
$('#host-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  for (const k of ['age','height']) body[k] = body[k] ? Number(body[k]) : null;
  try { await api('hosts', {method:'POST', body}); e.currentTarget.reset(); await refreshAll(); toast('호스트를 등록했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#post-form').addEventListener('submit', async e => {
  e.preventDefault(); const fd = new FormData(e.currentTarget);
  const body = {title:fd.get('title'), body:fd.get('body'), pinned:fd.get('pinned') === 'on'};
  try { await api('posts', {method:'POST', body}); e.currentTarget.reset(); await loadPosts(); toast('공지사항을 등록했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#attendance-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  try { await api('attendance', {method:'POST', body}); await loadAttendance(); toast('출근부를 업데이트했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#points-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries()); body.points = Number(body.points);
  try { await api('points', {method:'POST', body}); e.currentTarget.reset(); await loadRanking(); toast('포인트를 반영했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#guestbook-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  try { await api('guestbook', {method:'POST', body}); e.currentTarget.reset(); await loadGuestbook(); toast('방명록을 남겼습니다.'); }
  catch (err) { toast(err.message); }
});
$('#post-list').addEventListener('submit', async e => {
  if (!e.target.matches('.comment-form')) return;
  e.preventDefault(); const form = e.target; const postId = form.closest('.comments').dataset.post;
  const fd = new FormData(form);
  try { await api('comments', {method:'POST', body:{post_id:Number(postId), nickname:fd.get('nickname'), body:fd.get('body')}}); form.reset(); await loadComments(postId); toast('댓글을 등록했습니다.'); }
  catch (err) { toast(err.message); }
});
refreshAll();
