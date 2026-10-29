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
  if ($('#host-grid')) $('#host-grid').innerHTML = hostsCache.length ? hostsCache.map(h => `
    <article class="host-card">
      <div class="host-photo">${h.image_url ? `<img src="${esc(h.image_url)}" alt="${esc(h.name)} 프로필" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="placeholder">${esc((h.name||'V').slice(0,1))}</span>`}<span class="host-tag">${esc(h.color || 'CLUB SINNER')}</span></div>
      <div class="host-info"><h3 class="host-name">${esc(h.name)}</h3><div class="host-meta">${h.age ? `${esc(h.age)} 세` : 'HOST'}${h.height ? ` · ${esc(h.height)} CM` : ''}</div>
      ${h.tagline ? `<p class="host-tagline">${esc(h.tagline)}</p>` : ''}${h.bio ? `<p class="host-bio">${esc(h.bio)}</p>` : ''}</div>
    </article>`).join('') : empty('아직 등록된 호스트가 없습니다.');
  const options = hostsCache.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('');
  if ($('#attendance-host')) $('#attendance-host').innerHTML = options;
  if ($('#points-host')) $('#points-host').innerHTML = options;
}
async function loadRanking() {
  const data = await api('ranking');
  if ($('#ranking-list')) $('#ranking-list').innerHTML = data.ranking.length ? data.ranking.map((h,i) => `
    <div class="rank-row"><div class="rank-num">${String(i+1).padStart(2,'0')}</div><div><div class="rank-name">${esc(h.name)}</div><div class="rank-sub">${esc(h.color || 'CLUB SINNER 호스트')}</div></div><div class="rank-points">${Number(h.points||0).toLocaleString()}<small>활동 포인트</small></div></div>`).join('') : empty('포인트 기록이 쌓이면 랭킹이 표시됩니다.');
}
async function loadAttendance() {
  const data = await api('attendance');
  const labels = {on:'출근',off:'퇴근','休':'휴무'};
  if ($('#attendance-list')) $('#attendance-list').innerHTML = data.attendance.length ? data.attendance.map(a => `
    <div class="attendance-card"><div><div class="attendance-name">${esc(a.name)}</div><div class="attendance-note">${esc(a.note || (a.status === 'on' ? '오늘 출근합니다.' : ''))}</div></div><span class="status ${a.status === 'on' ? 'on' : ''}">${labels[a.status] || '퇴근'}</span></div>`).join('') : empty('오늘의 출근 정보가 없습니다.');
}
async function loadPosts() {
  const data = await api('posts');
  if ($('#post-list')) $('#post-list').innerHTML = data.posts.length ? data.posts.map(p => `
    <article class="post-card"><div class="post-meta">${p.pinned ? '✦ 상단 고정 · ' : ''}${dateText(p.created_at)}</div><h4>${esc(p.title)}</h4><p>${esc(p.body)}</p>
    <div class="comments" data-post="${p.id}"><div class="comment-items"></div><form class="comment-form"><input name="nickname" maxlength="30" required placeholder="닉네임"><input name="body" maxlength="500" required placeholder="댓글을 남겨주세요"><button class="outline-btn" type="submit">등록</button></form></div></article>`).join('') : empty('등록된 공지사항이 없습니다.');
  if ($('#post-list')) for (const p of data.posts) loadComments(p.id);
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
  if ($('#guestbook-list')) $('#guestbook-list').innerHTML = data.entries.length ? data.entries.map(e => `<div class="guest-item"><strong>${esc(e.nickname)}</strong><p>${esc(e.message)}</p><small>${dateText(e.created_at)}</small></div>`).join('') : '<p class="muted">첫 번째 메시지를 남겨주세요.</p>';
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
if (document.body.dataset.page === 'admin') {
$('#admin-open').addEventListener('click', async () => {
  showAdmin();
  try { const r = await api('auth'); setAdmin(!!r.admin); if(r.admin) await Promise.all([loadAdminHosts(),loadAdminPosts()]); } catch { setAdmin(false); }
});
$('#admin-close').addEventListener('click', () => $('#admin-dialog').close());
$('#admin-dialog').addEventListener('click', e => { if (e.target === $('#admin-dialog')) $('#admin-dialog').close(); });
$$('.admin-tabs button').forEach(btn => btn.addEventListener('click', () => {
  $$('.admin-tabs button').forEach(b => b.classList.toggle('active', b === btn));
  $$('.admin-panel').forEach(p => p.hidden = p.dataset.panel !== btn.dataset.tab);
}));
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-error').textContent = '';
  const form = e.currentTarget;
  try { await api('login', {method:'POST', body:{password:new FormData(form).get('password')}}); setAdmin(true); form.reset(); await Promise.all([loadAdminHosts(),loadAdminPosts()]); toast('관리자 로그인 성공'); }
  catch (err) { $('#login-error').textContent = err.message; }
});
$('#logout-btn').addEventListener('click', async () => {
  try { await api('logout', {method:'POST', body:{}}); setAdmin(false); toast('로그아웃했습니다.'); }
  catch (e) { toast(e.message); }
});

$('#host-form').addEventListener('submit', async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const file = $('#host-image-file').files[0];

  for (const k of ['age', 'height']) {
    body[k] = body[k] ? Number(body[k]) : null;
  }

  try {
    if (file) {
      toast('사진을 업로드하는 중입니다...');

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', 'velvet_hosts');

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/xvdvihhc/image/upload',
        { method: 'POST', body: uploadData }
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || '사진 업로드 실패');
      }

      body.image_url = result.secure_url;
    }

    await api('hosts', { method: 'POST', body });
    form.reset();
    await loadHosts(); await loadAdminHosts();
    toast('호스트를 등록했습니다.');
  } catch (err) {
    toast(err.message);
  }
});

async function uploadPhoto(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) throw new Error('8MB 이하의 이미지 파일만 업로드할 수 있습니다.');
  const fd=new FormData(); fd.append('file',file); fd.append('upload_preset','velvet_hosts');
  const res=await fetch('https://api.cloudinary.com/v1_1/xvdvihhc/image/upload',{method:'POST',body:fd});
  const result=await res.json();
  if (!res.ok||!result.secure_url) throw new Error(result.error?.message||'사진 업로드 실패');
  return result.secure_url;
}
async function loadAdminHosts() {
  const holder=$('#admin-host-list'); if (!holder) return;
  const data=await api('hosts'); hostsCache=data.hosts||[];
  holder.innerHTML=hostsCache.length?hostsCache.map(h=>`<div class="manage-item"><span>${esc(h.name)} <small>${esc(h.tagline||'')}</small></span><span class="action-row"><button type="button" class="outline-btn" data-edit-host="${h.id}">수정</button><button type="button" class="danger-btn" data-delete-host="${h.id}">삭제</button></span></div>`).join(''):empty('등록된 호스트가 없습니다.');
}
async function loadAdminPosts() {
  const holder=$('#admin-post-list'); if (!holder) return;
  const data=await api('posts');
  window.adminPosts=data.posts||[];
  holder.innerHTML=window.adminPosts.length?window.adminPosts.map(p=>`<div class="manage-item"><span>${esc(p.title)}</span><span class="action-row"><button type="button" class="outline-btn" data-edit-post="${p.id}">수정</button><button type="button" class="danger-btn" data-delete-post="${p.id}">삭제</button></span></div>`).join(''):empty('등록된 공지가 없습니다.');
}
$('#admin-host-list').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-host]'), del=e.target.closest('[data-delete-host]');
 if(edit){const h=hostsCache.find(h=>h.id===Number(edit.dataset.editHost));if(!h)return;const form=$('#edit-host-form');for(const key of ['id','name','age','height','color','tagline','image_url','bio'])form.elements[key].value=h[key]??'';$('#edit-post-panel').hidden=true;$('#edit-host-panel').hidden=false;$('#edit-host-panel').scrollIntoView({behavior:'smooth',block:'nearest'});}
 if(del){const h=hostsCache.find(h=>h.id===Number(del.dataset.deleteHost));if(!confirm(`「${h?.name||'호스트'}」를 삭제할까요? 프로필은 숨겨지며 기록은 보존됩니다.`))return;try{await api(`hosts/${del.dataset.deleteHost}`,{method:'DELETE'});await loadAdminHosts();await loadHosts();toast('호스트를 삭제했습니다.');}catch(err){toast(err.message);}}
});
$('#edit-host-cancel').addEventListener('click',()=>$('#edit-host-panel').hidden=true);
$('#edit-host-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,b=Object.fromEntries(new FormData(form).entries());const id=b.id;delete b.id;
 b.age=b.age?Number(b.age):null;b.height=b.height?Number(b.height):null;
 try{const url=await uploadPhoto($('#edit-host-image-file').files[0]);if(url)b.image_url=url;await api(`hosts/${id}`,{method:'PUT',body:b});$('#edit-host-panel').hidden=true;form.reset();await loadAdminHosts();await loadHosts();toast('호스트 정보를 수정했습니다.');}catch(err){toast(err.message);}
});
$('#admin-post-list').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-post]'),del=e.target.closest('[data-delete-post]');
 if(edit){const p=(window.adminPosts||[]).find(p=>p.id===Number(edit.dataset.editPost));if(!p)return;const form=$('#edit-post-form');form.elements.id.value=p.id;form.elements.title.value=p.title;form.elements.body.value=p.body;form.elements.pinned.checked=!!p.pinned;$('#edit-host-panel').hidden=true;$('#edit-post-panel').hidden=false;$('#edit-post-panel').scrollIntoView({behavior:'smooth',block:'nearest'});}
 if(del){if(!confirm('이 공지사항과 댓글을 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;try{await api(`posts/${del.dataset.deletePost}`,{method:'DELETE'});await loadAdminPosts();toast('공지사항을 삭제했습니다.');}catch(err){toast(err.message);}}
});
$('#edit-post-cancel').addEventListener('click',()=>$('#edit-post-panel').hidden=true);
$('#edit-post-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,fd=new FormData(form),id=fd.get('id');
 try{await api(`posts/${id}`,{method:'PUT',body:{title:fd.get('title'),body:fd.get('body'),pinned:fd.get('pinned')==='on'}});$('#edit-post-panel').hidden=true;await loadAdminPosts();toast('공지사항을 수정했습니다.');}catch(err){toast(err.message);}
});
$('#post-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
  const body = {title:fd.get('title'), body:fd.get('body'), pinned:fd.get('pinned') === 'on'};
  try { await api('posts', {method:'POST', body}); form.reset(); await loadPosts(); await loadAdminPosts(); toast('공지사항을 등록했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#attendance-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  try { await api('attendance', {method:'POST', body}); await loadAttendance(); toast('출근부를 업데이트했습니다.'); }
  catch (err) { toast(err.message); }
});
$('#points-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget; const body = Object.fromEntries(new FormData(form).entries()); body.points = Number(body.points);
  try { await api('points', {method:'POST', body}); form.reset(); await loadRanking(); toast('포인트를 반영했습니다.'); }
  catch (err) { toast(err.message); }
});

}
if (document.body.dataset.page === 'lounge') {
$('#guestbook-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget; const body = Object.fromEntries(new FormData(form).entries());
  try { await api('guestbook', {method:'POST', body}); form.reset(); await loadGuestbook(); toast('방명록을 남겼습니다.'); }
  catch (err) { toast(err.message); }
});
$('#post-list').addEventListener('submit', async e => {
  if (!e.target.matches('.comment-form')) return;
  e.preventDefault(); const form = e.target; const postId = form.closest('.comments').dataset.post;
  const fd = new FormData(form);
  try { await api('comments', {method:'POST', body:{post_id:Number(postId), nickname:fd.get('nickname'), body:fd.get('body')}}); form.reset(); await loadComments(postId); toast('댓글을 등록했습니다.'); }
  catch (err) { toast(err.message); }
});
}
const currentPage = document.body.dataset.page;
const pageLoaders = {
  home: [],
  hosts: [loadHosts],
  ranking: [loadRanking],
  attendance: [loadAttendance],
  lounge: [loadPosts, loadGuestbook],
  admin: [loadHosts]
};
Promise.all((pageLoaders[currentPage] || []).map(fn => fn())).catch(e => toast(e.message));

// Public image interaction deterrents (not DRM or a download guarantee).
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('img')) event.preventDefault();
});
document.addEventListener('dragstart', (event) => {
  if (event.target.closest('img')) event.preventDefault();
});
