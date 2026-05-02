/* ═══════════════════════════════════════════════════════
   MA Streaming Admin Dashboard v3
   ═══════════════════════════════════════════════════════ */

const API = 'https://amtv33-production.up.railway.app';
const CLOUD = 'http://62.171.153.204:8090';

let token = localStorage.getItem('admin_token') || '';
let currentUser = null;
let currentPage = 'overview';

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401) { logout(); throw new Error('غير مصرح'); }
  if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');
  return data;
}

async function cloudApi(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${CLOUD}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'خطأ في السيرفر السحابي');
  return data;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function showModal(title, bodyHtml, footerHtml = '') {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">${bodyHtml}</div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  `;
  overlay.classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

async function doLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.disabled = true; errEl.classList.add('hidden');
  try {
    const data = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: user, password: pass })
    }).then(r => r.json());
    if (!data.token) throw new Error(data.error || 'فشل تسجيل الدخول');
    if (!data.user.is_admin && data.user.role !== 'admin') throw new Error('هذا الحساب ليس مشرفاً');
    token = data.token; currentUser = data.user;
    localStorage.setItem('admin_token', token);
    showApp();
  } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  btn.disabled = false;
}

function logout() {
  token = ''; currentUser = null; localStorage.removeItem('admin_token');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

async function checkAuth() {
  if (!token) return false;
  try {
    const data = await api('/api/auth/me');
    currentUser = data.user || data;
    if (!currentUser.is_admin && currentUser.role !== 'admin') { logout(); return false; }
    return true;
  } catch { logout(); return false; }
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (currentUser) {
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-avatar').textContent = (currentUser.username || 'A')[0].toUpperCase();
  }
  navigate(currentPage);
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = { overview:'نظرة عامة', users:'المستخدمين', agents:'الوكلاء', channels:'القنوات', iptv:'حسابات IPTV', lulu:'محتوى IPTV و Lulu', cloud:'السيرفر السحابي', logs:'السجلات' };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('sidebar').classList.remove('open');
  renderPage(page);
}

async function renderPage(page) {
  const c = document.getElementById('page-content');
  c.innerHTML = '<div class="loading"><div class="spinner"></div><p>جاري التحميل...</p></div>';
  try {
    switch (page) {
      case 'overview': await renderOverview(c); break;
      case 'users': await renderUsers(c); break;
      case 'agents': await renderAgents(c); break;
      case 'channels': await renderChannels(c); break;
      case 'iptv': await renderIPTV(c); break;
      case 'lulu': await renderLuluPage(c); break;
      case 'cloud': await renderCloud(c); break;
      case 'logs': await renderLogs(c); break;
    }
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p><button class="btn btn-primary" onclick="renderPage('${page}')">إعادة المحاولة</button></div>`;
  }
}

// ─── Overview ──────────────────────────────────────
async function renderOverview(c) {
  const stats = await api('/api/admin/stats/extended');
  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card primary"><div class="stat-label">المستخدمين</div><div class="stat-value">${stats.users}</div></div>
      <div class="stat-card success"><div class="stat-label">بريميوم</div><div class="stat-value">${stats.premium}</div></div>
      <div class="stat-card info"><div class="stat-label">الوكلاء</div><div class="stat-value">${stats.agents}</div></div>
      <div class="stat-card danger"><div class="stat-label">محظورين</div><div class="stat-value">${stats.blocked}</div></div>
      <div class="stat-card warning"><div class="stat-label">القنوات</div><div class="stat-value">${stats.channels}</div></div>
      <div class="stat-card primary"><div class="stat-label">أفلام</div><div class="stat-value">${stats.movies}</div></div>
      <div class="stat-card info"><div class="stat-label">مسلسلات</div><div class="stat-value">${stats.series}</div></div>
      <div class="stat-card success"><div class="stat-label">أكواد التفعيل</div><div class="stat-value">${stats.totalCodes}</div></div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>آخر المستخدمين</h3></div>
      <div class="panel-body no-pad"><div class="table-wrap"><table>
        <thead><tr><th>المستخدم</th><th>الخطة</th><th>الدور</th><th>التاريخ</th></tr></thead>
        <tbody>${(stats.recentUsers || []).map(u => `<tr>
          <td><strong>${esc(u.username)}</strong></td>
          <td><span class="badge badge-${u.plan}">${u.plan}</span></td>
          <td><span class="badge badge-${u.role}">${roleLabel(u.role)}</span></td>
          <td>${formatDate(u.created_at)}</td></tr>`).join('')}</tbody>
      </table></div></div></div>`;
}

// ─── Users ─────────────────────────────────────────
let _allUsers = [];
async function renderUsers(c) {
  const data = await api('/api/admin/users'); _allUsers = data.users || [];
  c.innerHTML = `<div class="panel"><div class="panel-header"><h3>المستخدمين (${_allUsers.length})</h3><div class="search-box"><input class="form-control" id="user-search" placeholder="بحث..." oninput="filterUsers()"></div></div><div class="panel-body no-pad"><div class="table-wrap" id="users-table"></div></div></div>`;
  filterUsers();
}
function filterUsers() {
  const q = (document.getElementById('user-search')?.value || '').toLowerCase();
  const filtered = q ? _allUsers.filter(u => u.username.toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)) : _allUsers;
  document.getElementById('users-table').innerHTML = `<table><thead><tr><th>المستخدم</th><th>البريد</th><th>الخطة</th><th>الدور</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${filtered.map(u => `<tr>
    <td><strong>${esc(u.username)}</strong></td><td style="direction:ltr;text-align:right">${esc(u.email||'')}</td>
    <td><span class="badge badge-${u.plan}">${u.plan}</span></td><td><span class="badge badge-${u.role||'user'}">${roleLabel(u.role)}</span></td>
    <td>${u.is_blocked?'<span class="badge badge-blocked">محظور</span>':'<span class="badge badge-online">نشط</span>'}</td>
    <td><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="editUserModal('${u.id}')">تعديل</button>
    <button class="btn btn-sm ${u.is_blocked?'btn-success':'btn-danger'}" onclick="toggleBlock('${u.id}',${u.is_blocked?0:1})">${u.is_blocked?'رفع الحظر':'حظر'}</button>
    ${u.role!=='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}','${esc(u.username)}')">حذف</button>`:''}</div></td></tr>`).join('')}</tbody></table>`;
}
function editUserModal(id) {
  const u = _allUsers.find(x => x.id === id); if (!u) return;
  const exp = u.expires_at ? u.expires_at.substring(0,10) : '';
  showModal('تعديل: ' + u.username, `
    <div class="form-group"><label>الخطة</label><select class="form-control" id="edit-plan"><option value="free" ${u.plan==='free'?'selected':''}>مجاني</option><option value="premium" ${u.plan==='premium'?'selected':''}>بريميوم</option></select></div>
    <div class="form-group"><label>انتهاء الاشتراك</label><input type="date" class="form-control" id="edit-expires" value="${exp}"></div>
    <div class="form-group"><label>الدور</label><select class="form-control" id="edit-role"><option value="user" ${u.role==='user'?'selected':''}>مستخدم</option><option value="agent" ${u.role==='agent'?'selected':''}>وكيل</option><option value="admin" ${u.role==='admin'?'selected':''}>مشرف</option></select></div>
    <div class="form-group"><label>الرصيد</label><input type="number" class="form-control" id="edit-balance" value="${u.balance||0}" step="0.01"></div>
  `, `<button class="btn btn-primary" onclick="saveUser('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}
async function saveUser(id) {
  try {
    await api(`/api/admin/users/${id}`, { method:'PUT', body: JSON.stringify({ plan: document.getElementById('edit-plan').value, expires_at: document.getElementById('edit-expires').value||null, is_blocked:null, is_admin: document.getElementById('edit-role').value==='admin'?1:0 }) });
    await api(`/api/admin/users/${id}/role`, { method:'PUT', body: JSON.stringify({ role: document.getElementById('edit-role').value, balance: parseFloat(document.getElementById('edit-balance').value)||0 }) });
    toast('تم التحديث'); closeModal(); renderPage('users');
  } catch (err) { toast(err.message, 'error'); }
}
async function toggleBlock(id, block) { try { await api(`/api/admin/users/${id}`, { method:'PUT', body:JSON.stringify({is_blocked:block}) }); toast(block?'تم الحظر':'تم رفع الحظر'); renderPage('users'); } catch(e){toast(e.message,'error');} }
async function deleteUser(id, name) { if(!confirm(`حذف "${name}"؟`))return; try{await api(`/api/admin/users/${id}`,{method:'DELETE'});toast('تم الحذف');renderPage('users');}catch(e){toast(e.message,'error');} }

// ─── Agents ────────────────────────────────────────
async function renderAgents(c) {
  const data = await api('/api/admin/agents'); const agents = data.agents||[];
  c.innerHTML = `<div class="panel"><div class="panel-header"><h3>الوكلاء (${agents.length})</h3></div><div class="panel-body no-pad"><div class="table-wrap"><table>
    <thead><tr><th>الوكيل</th><th>البريد</th><th>الرصيد</th><th>أكواد</th><th>إجراءات</th></tr></thead>
    <tbody>${agents.length===0?'<tr><td colspan="5" class="empty-state">لا يوجد وكلاء</td></tr>':agents.map(a=>`<tr>
      <td><strong>${esc(a.username)}</strong></td><td style="direction:ltr;text-align:right">${esc(a.email||'')}</td>
      <td><strong>$${(a.balance||0).toFixed(2)}</strong></td><td>${a.used_codes}/${a.total_codes}</td>
      <td><button class="btn btn-sm btn-primary" onclick="agentBalanceModal('${a.id}','${esc(a.username)}',${a.balance||0})">تعديل الرصيد</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
}
function agentBalanceModal(id,name,balance) {
  showModal('تعديل رصيد: '+name, `<p style="margin-bottom:12px">الرصيد: <strong>$${balance.toFixed(2)}</strong></p>
    <div class="form-row"><div class="form-group"><label>النوع</label><select class="form-control" id="bal-type"><option value="credit">إيداع</option><option value="debit">سحب</option></select></div>
    <div class="form-group"><label>المبلغ</label><input type="number" class="form-control" id="bal-amount" min="0" step="0.01"></div></div>`,
    `<button class="btn btn-primary" onclick="saveAgentBalance('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}
async function saveAgentBalance(id) {
  try { const type=document.getElementById('bal-type').value, amount=parseFloat(document.getElementById('bal-amount').value);
    if(!amount||amount<=0)throw new Error('المبلغ مطلوب');
    await api(`/api/admin/agents/${id}/balance`,{method:'PUT',body:JSON.stringify({type,amount})});toast('تم التحديث');closeModal();renderPage('agents');
  } catch(e){toast(e.message,'error');}
}

// ─── Channels ──────────────────────────────────────
let _allChannels = [];
async function renderChannels(c) {
  const data = await api('/api/channels'); _allChannels = data.channels||[];
  c.innerHTML = `<div class="panel"><div class="panel-header"><h3>القنوات (${_allChannels.length})</h3><div class="btn-group">
    <button class="btn btn-primary" onclick="addChannelModal()">+ بحث IPTV</button><button class="btn btn-outline" onclick="addManualChannelModal()">+ يدوي</button></div></div>
    <div class="panel-body" style="padding:12px 20px"><div class="search-box"><input class="form-control" id="ch-search" placeholder="بحث..." oninput="filterChannels()"></div></div>
    <div class="panel-body no-pad"><div class="table-wrap" id="channels-table"></div></div></div>`;
  filterChannels();
}
function filterChannels() {
  const q=(document.getElementById('ch-search')?.value||'').toLowerCase();
  const filtered=q?_allChannels.filter(ch=>ch.name.toLowerCase().includes(q)||(ch.group_name||ch.group||'').toLowerCase().includes(q)):_allChannels;
  document.getElementById('channels-table').innerHTML = `<table><thead><tr><th>القناة</th><th>المجموعة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
    <tbody>${filtered.length===0?'<tr><td colspan="4" class="empty-state">لا توجد قنوات</td></tr>':filtered.slice(0,100).map(ch=>`<tr>
      <td><div style="display:flex;align-items:center;gap:8px">${ch.logo_url||ch.logo?`<img src="${esc(ch.logo_url||ch.logo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover" onerror="this.style.display='none'">`:''}<strong>${esc(ch.name)}</strong></div></td>
      <td>${esc(ch.group_name||ch.group||'عام')}</td>
      <td>${ch.is_enabled!==0?'<span class="badge badge-online">مفعلة</span>':'<span class="badge badge-offline">معطلة</span>'}</td>
      <td><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="editChannelModal('${ch.id}')">تعديل</button><button class="btn btn-sm btn-danger" onclick="deleteChannel('${ch.id}','${esc(ch.name)}')">حذف</button></div></td></tr>`).join('')}</tbody></table>`;
}
function addChannelModal() { showModal('إضافة قناة من IPTV',`<div class="form-group"><label>البحث</label><div class="search-box"><input class="form-control" id="iptv-search-q" placeholder="bein, mbc..." onkeydown="if(event.key==='Enter')searchIPTVChannels()"><button class="btn btn-primary" onclick="searchIPTVChannels()">بحث</button></div></div><div id="iptv-search-results" style="max-height:350px;overflow-y:auto"></div><div id="iptv-selected-count" style="margin-top:8px;font-size:13px;color:var(--text2)"></div>`,`<button class="btn btn-primary" id="add-selected-btn" onclick="addSelectedIPTVChannels()" disabled>إضافة المحددة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`); }
let _iptvSearchResults=[], _iptvSelected=new Set();
async function searchIPTVChannels() { const q=document.getElementById('iptv-search-q').value.trim();if(q.length<2){toast('أدخل حرفين','error');return;}const results=document.getElementById('iptv-search-results');results.innerHTML='<div class="loading"><div class="spinner"></div></div>';_iptvSelected.clear();try{const data=await api(`/api/admin/iptv-search?q=${encodeURIComponent(q)}`);_iptvSearchResults=data.channels||[];if(!_iptvSearchResults.length){results.innerHTML='<div class="empty-state"><p>لا نتائج</p></div>';return;}results.innerHTML=`<table><thead><tr><th style="width:30px"><input type="checkbox" onchange="toggleAllIPTV(this.checked)"></th><th>القناة</th><th>التصنيف</th></tr></thead><tbody>${_iptvSearchResults.map((ch,i)=>`<tr><td><input type="checkbox" class="iptv-cb" data-idx="${i}" onchange="toggleIPTVItem(${i},this.checked)"></td><td>${ch.logo?`<img src="${esc(ch.logo)}" style="width:24px;height:24px;border-radius:3px;object-fit:cover" onerror="this.style.display='none'">`:''} ${esc(ch.name)}</td><td><span class="badge badge-info">${esc(ch.category)}</span></td></tr>`).join('')}</tbody></table>`;updateSelectedCount();}catch(e){results.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`;}}
function toggleIPTVItem(i,c){if(c)_iptvSelected.add(i);else _iptvSelected.delete(i);updateSelectedCount();}
function toggleAllIPTV(c){document.querySelectorAll('.iptv-cb').forEach((cb,i)=>{cb.checked=c;if(c)_iptvSelected.add(i);else _iptvSelected.delete(i);});updateSelectedCount();}
function updateSelectedCount(){const n=_iptvSelected.size;document.getElementById('iptv-selected-count').textContent=n>0?`تم تحديد ${n} قناة`:'';const btn=document.getElementById('add-selected-btn');if(btn)btn.disabled=n===0;}
async function addSelectedIPTVChannels(){if(!_iptvSelected.size)return;const channels=[..._iptvSelected].map(i=>_iptvSearchResults[i]);try{const data=await api('/api/admin/iptv-add-channels',{method:'POST',body:JSON.stringify({channels})});toast(`تم إضافة ${data.added} قناة`);closeModal();renderPage('channels');}catch(e){toast(e.message,'error');}}
function addManualChannelModal(){showModal('إضافة قناة يدوياً',`<div class="form-group"><label>اسم القناة</label><input class="form-control" id="ch-name"></div><div class="form-row"><div class="form-group"><label>المجموعة</label><input class="form-control" id="ch-group" value="عام"></div><div class="form-group"><label>الترتيب</label><input type="number" class="form-control" id="ch-sort" value="0"></div></div><div class="form-group"><label>رابط البث</label><input class="form-control" id="ch-url" dir="ltr" placeholder="http://..."></div><div class="form-group"><label>الشعار</label><input class="form-control" id="ch-logo" dir="ltr" placeholder="اختياري"></div>`,`<button class="btn btn-primary" onclick="saveNewChannel()">إضافة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);}
async function saveNewChannel(){try{const name=document.getElementById('ch-name').value.trim(),stream_url=document.getElementById('ch-url').value.trim();if(!name||!stream_url)throw new Error('الاسم ورابط البث مطلوبان');await api('/api/admin/channels',{method:'POST',body:JSON.stringify({name,stream_url,group_name:document.getElementById('ch-group').value||'عام',logo_url:document.getElementById('ch-logo').value||'',sort_order:parseInt(document.getElementById('ch-sort').value)||0})});toast('تم الإضافة');closeModal();renderPage('channels');}catch(e){toast(e.message,'error');}}
function editChannelModal(id){const ch=_allChannels.find(x=>x.id===id);if(!ch)return;showModal('تعديل: '+ch.name,`<div class="form-group"><label>الاسم</label><input class="form-control" id="ch-name" value="${esc(ch.name)}"></div><div class="form-row"><div class="form-group"><label>المجموعة</label><input class="form-control" id="ch-group" value="${esc(ch.group_name||ch.group||'')}"></div><div class="form-group"><label>الحالة</label><select class="form-control" id="ch-enabled"><option value="1" ${ch.is_enabled!==0?'selected':''}>مفعلة</option><option value="0" ${ch.is_enabled===0?'selected':''}>معطلة</option></select></div></div><div class="form-group"><label>رابط البث</label><input class="form-control" id="ch-url" dir="ltr" value="${esc(ch.stream_url||'')}"></div><div class="form-group"><label>الشعار</label><input class="form-control" id="ch-logo" dir="ltr" value="${esc(ch.logo_url||ch.logo||'')}"></div>`,`<button class="btn btn-primary" onclick="updateChannel('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);}
async function updateChannel(id){try{await api(`/api/admin/channels/${id}`,{method:'PUT',body:JSON.stringify({name:document.getElementById('ch-name').value,group_name:document.getElementById('ch-group').value,stream_url:document.getElementById('ch-url').value,logo_url:document.getElementById('ch-logo').value,is_enabled:parseInt(document.getElementById('ch-enabled').value)})});toast('تم التحديث');closeModal();renderPage('channels');}catch(e){toast(e.message,'error');}}
async function deleteChannel(id,name){if(!confirm(`حذف "${name}"؟`))return;try{await api(`/api/admin/channels/${id}`,{method:'DELETE'});toast('تم الحذف');renderPage('channels');}catch(e){toast(e.message,'error');}}

// ─── IPTV Accounts ─────────────────────────────────
let _iptvAccounts=[], _cloudChannels=[];
async function renderIPTV(c) {
  try {
    const [accData,chData,errData]=await Promise.all([cloudApi('/api/admin/iptv-accounts'),cloudApi('/api/admin/cloud-channels'),cloudApi('/api/admin/stream-errors?limit=50')]);
    _iptvAccounts=accData.accounts||[]; _cloudChannels=chData.channels||[];
    const errors=errData.errors||[]; const streamingCount=_cloudChannels.filter(ch=>ch.is_streaming).length;
    c.innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card primary"><div class="stat-label">حسابات IPTV</div><div class="stat-value">${_iptvAccounts.length}</div></div>
        <div class="stat-card success"><div class="stat-label">قنوات مضافة</div><div class="stat-value">${_cloudChannels.length}</div></div>
        <div class="stat-card warning"><div class="stat-label">تبث الآن</div><div class="stat-value">${streamingCount}</div></div>
        <div class="stat-card danger"><div class="stat-label">أخطاء</div><div class="stat-value">${errors.length}</div></div>
      </div>
      <div class="panel"><div class="panel-header"><h3>إضافة حساب IPTV</h3></div><div class="panel-body">
        <div class="form-group"><label>اسم الحساب</label><input class="form-control" id="new-acc-name" placeholder="مثلاً: حساب beIN"></div>
        <div class="form-group"><label>رابط السيرفر</label><input class="form-control" id="new-acc-server" dir="ltr" placeholder="http://example.com:80"></div>
        <div class="form-row"><div class="form-group"><label>المستخدم</label><input class="form-control" id="new-acc-user" dir="ltr"></div><div class="form-group"><label>كلمة المرور</label><input class="form-control" id="new-acc-pass" dir="ltr"></div></div>
        <div class="btn-group"><button class="btn btn-primary" id="add-acc-btn" onclick="addIPTVAccount()">+ إضافة</button><button class="btn btn-outline" onclick="testIPTVAccount()">اختبار</button></div>
        <div id="acc-test-result" style="margin-top:8px"></div></div></div>
      <div class="panel"><div class="panel-header"><h3>الحسابات (${_iptvAccounts.length})</h3></div><div class="panel-body no-pad">
        ${_iptvAccounts.length===0?'<div class="empty-state"><div class="empty-icon">📡</div><p>لا توجد حسابات</p></div>':_iptvAccounts.map(acc=>{
          const accChs=_cloudChannels.filter(ch=>ch.account_id===acc.id);
          return `<div class="iptv-account-card"><div class="acc-header"><div class="acc-info"><strong>${esc(acc.name||'حساب #'+acc.id)}</strong><span class="acc-meta" dir="ltr">${esc(acc.server_url)} — ${esc(acc.username)} — ${accChs.length} قناة</span></div>
          <div class="btn-group"><button class="btn btn-sm btn-primary" onclick="searchChannelForAccount(${acc.id})">🔍 اختيار قناة</button>
          <button class="btn btn-sm ${accChs.some(ch=>ch.is_streaming)?'btn-danger':'btn-success'}" onclick="toggleAccountStreaming(${acc.id},${!accChs.some(ch=>ch.is_streaming)})">${accChs.some(ch=>ch.is_streaming)?'⏹ إيقاف الكل':'▶ تشغيل الكل'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteIPTVAccount(${acc.id},'${esc(acc.name||'حساب #'+acc.id)}')">حذف</button></div></div>
          ${accChs.length>0?`<div class="acc-channels-grid">${accChs.map(ch=>`<div class="acc-channel"><div class="ch-info">${ch.logo?`<img src="${esc(ch.logo)}" class="ch-logo" onerror="this.style.display='none'">`:'<div class="ch-logo-placeholder">📺</div>'}<div><div class="ch-name">${esc(ch.name)}</div><div class="ch-cat">${esc(ch.category||'عام')}</div></div></div>
          <div class="ch-actions"><span class="streaming-badge ${ch.is_streaming?'streaming-on':'streaming-off'}">${ch.is_streaming?'🟢 يبث':'🔴 متوقف'}</span>
          <button class="btn btn-sm ${ch.is_streaming?'btn-danger':'btn-success'}" onclick="toggleStreaming('${esc(ch.id)}',${!ch.is_streaming})">${ch.is_streaming?'⏹ إيقاف':'▶ تشغيل'}</button>
          <button class="btn btn-sm btn-outline" onclick="removeChannelFromAccount('${esc(ch.id)}','${esc(ch.name)}')">إزالة</button></div></div>`).join('')}</div>`:`<div class="acc-no-channel">لم يتم اختيار قناة بعد</div>`}</div>`;}).join('')}</div></div>
      <div class="panel"><div class="panel-header"><h3>سجل الأخطاء (${errors.length})</h3><div class="btn-group"><button class="btn btn-outline btn-sm" onclick="renderPage('iptv')">🔄</button>${errors.length>0?`<button class="btn btn-danger btn-sm" onclick="clearStreamErrors()">مسح</button>`:''}</div></div><div class="panel-body no-pad">
        ${errors.length===0?'<div class="empty-state"><p>لا أخطاء</p></div>':errors.map(e=>`<div class="log-entry"><span class="log-time">${formatDate(e.created_at)}</span><span class="badge badge-danger">${esc(e.error_type)}</span><span class="log-msg">${esc(e.channel_name?e.channel_name+' — ':'')}${esc(e.message)}</span></div>`).join('')}</div></div>`;
  } catch (err) { c.innerHTML=`<div class="empty-state"><p>فشل الاتصال: ${err.message}</p><button class="btn btn-primary" onclick="renderPage('iptv')">إعادة</button></div>`; }
}
async function addIPTVAccount(){const btn=document.getElementById('add-acc-btn');btn.disabled=true;btn.textContent='جاري...';try{const name=document.getElementById('new-acc-name').value.trim(),server_url=document.getElementById('new-acc-server').value.trim(),username=document.getElementById('new-acc-user').value.trim(),password=document.getElementById('new-acc-pass').value.trim();if(!server_url||!username||!password)throw new Error('البيانات مطلوبة');await cloudApi('/api/admin/iptv-accounts',{method:'POST',body:JSON.stringify({name,server_url,username,password})});toast('تم الإضافة');renderPage('iptv');}catch(e){toast(e.message,'error');}btn.disabled=false;btn.textContent='+ إضافة';}
async function testIPTVAccount(){const r=document.getElementById('acc-test-result');r.innerHTML='<span style="color:var(--text2)">جاري...</span>';try{const data=await cloudApi('/api/admin/iptv-test',{method:'POST',body:JSON.stringify({server_url:document.getElementById('new-acc-server').value.trim(),username:document.getElementById('new-acc-user').value.trim(),password:document.getElementById('new-acc-pass').value.trim()})});r.innerHTML=data.success?`<span style="color:var(--success)">✅ ${data.categories} تصنيف، ${data.channels} قناة</span>`:`<span style="color:var(--danger)">❌ ${data.error}</span>`;}catch(e){r.innerHTML=`<span style="color:var(--danger)">❌ ${e.message}</span>`;}}
async function deleteIPTVAccount(id,name){if(!confirm(`حذف "${name}"؟`))return;try{await cloudApi(`/api/admin/iptv-accounts/${id}`,{method:'DELETE'});toast('تم الحذف');renderPage('iptv');}catch(e){toast(e.message,'error');}}
async function toggleAccountStreaming(aid,streaming){try{await cloudApi(`/api/admin/account-toggle-stream/${aid}`,{method:'POST',body:JSON.stringify({streaming})});toast(streaming?'تم التشغيل':'تم الإيقاف');renderPage('iptv');}catch(e){toast(e.message,'error');}}
let _searchAccountId=null,_channelSearchResults=[];
function searchChannelForAccount(accountId){_searchAccountId=accountId;_channelSearchResults=[];showModal('اختيار قناة',`<div class="form-group"><label>ابحث</label><div style="display:flex;gap:8px"><input class="form-control" id="ch-search-q" placeholder="ابحث..." style="flex:1" onkeydown="if(event.key==='Enter')doChannelSearch()"><button class="btn btn-primary" onclick="doChannelSearch()">بحث</button></div></div><div id="ch-search-results" style="max-height:400px;overflow-y:auto"></div>`);setTimeout(()=>document.getElementById('ch-search-q')?.focus(),200);}
async function doChannelSearch(){const q=document.getElementById('ch-search-q').value.trim();if(q.length<2){toast('أدخل حرفين','error');return;}const results=document.getElementById('ch-search-results');results.innerHTML='<div class="loading"><div class="spinner"></div></div>';try{const data=await cloudApi(`/api/admin/iptv-search?account_id=${_searchAccountId}&q=${encodeURIComponent(q)}`);_channelSearchResults=data.channels||[];if(!_channelSearchResults.length){results.innerHTML='<div class="empty-state"><p>لا نتائج</p></div>';return;}results.innerHTML=`<div class="ch-search-list">${_channelSearchResults.map((ch,i)=>`<div class="ch-search-item" onclick="selectChannelForAccount(${i})"><div class="ch-search-info">${ch.logo?`<img src="${esc(ch.logo)}" class="ch-search-logo" onerror="this.style.display='none'">`:'<div class="ch-search-logo-ph">📺</div>'}<div><div class="ch-search-name">${esc(ch.name)}</div><div class="ch-search-cat">${esc(ch.category)}</div></div></div><button class="btn btn-sm btn-success">اختيار</button></div>`).join('')}</div>`;}catch(e){results.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`;}}
async function selectChannelForAccount(idx){const ch=_channelSearchResults[idx];if(!ch||!confirm(`إضافة "${ch.name}"؟`))return;try{await cloudApi('/api/admin/iptv-add-channels',{method:'POST',body:JSON.stringify({account_id:_searchAccountId,channels:[ch]})});toast(`تم إضافة "${ch.name}"`);closeModal();renderPage('iptv');}catch(e){toast(e.message,'error');}}
async function toggleStreaming(id,streaming){try{await cloudApi(`/api/admin/channel-toggle-stream/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({streaming})});toast(streaming?'تم التشغيل':'تم الإيقاف');renderPage('iptv');}catch(e){toast(e.message,'error');}}
async function removeChannelFromAccount(id,name){if(!confirm(`إزالة "${name}"؟`))return;try{await cloudApi(`/api/admin/cloud-channels/${encodeURIComponent(id)}`,{method:'DELETE'});toast('تم الإزالة');renderPage('iptv');}catch(e){toast(e.message,'error');}}
async function clearStreamErrors(){if(!confirm('مسح الأخطاء؟'))return;try{await cloudApi('/api/admin/stream-errors',{method:'DELETE'});toast('تم المسح');renderPage('iptv');}catch(e){toast(e.message,'error');}}

// ═══════════════════════════════════════════════════════
// ─── ONE Lulu Page: IPTV Content + DB + Lulu Upload ──
// ═══════════════════════════════════════════════════════

const LS = {
  luluAccounts:[], iptvAccounts:[],
  vodCats:[], seriesCats:[],
  activeCat:null, activeType:'vod',
  contentItems:[], seriesItems:[],
  inSeriesDetail:false, currentSeries:null,
  selectedIds:new Set(), currentCatName:'',
};

async function renderLuluPage(c) {
  c.innerHTML = `
  <div class="lulu-page">
    <div class="lulu-tabs">
      <button class="lulu-tab active" id="ltab-browse" onclick="luluSwitchTab('browse')">📂 تصفح IPTV</button>
      <button class="lulu-tab" id="ltab-db" onclick="luluSwitchTab('db')">🗄️ محتوى القاعدة</button>
      <button class="lulu-tab" id="ltab-uploaded" onclick="luluSwitchTab('uploaded')">💾 الملفات المرفوعة</button>
      <button class="lulu-tab" id="ltab-accounts" onclick="luluSwitchTab('accounts')">🔑 الحسابات</button>
      <button class="lulu-tab" id="ltab-jobs" onclick="luluSwitchTab('jobs')">📤 مهام الرفع</button>
    </div>

    <!-- TAB: Browse IPTV -->
    <div class="lulu-panel active" id="lpanel-browse">
      <div class="panel"><div class="panel-body" style="padding:14px">
        <div class="form-row" style="margin:0">
          <div class="form-group"><label>حساب IPTV</label><select class="form-control" id="lsel-iptv"><option value="">الافتراضي</option></select></div>
          <div class="form-group"><label>حساب Lulu</label><select class="form-control" id="lsel-lulu"><option value="">— اختر حساب —</option></select></div>
          <div class="form-group" style="max-width:150px"><label>النوع</label><select class="form-control" id="lsel-type" onchange="luluTypeChange()"><option value="vod">أفلام</option><option value="series">مسلسلات</option></select></div>
          <div style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="luluLoadCategories()">تحميل الفئات</button></div>
        </div>
      </div></div>
      <div id="lbrowse-alert"></div>
      <div id="lbrowse-main" style="display:none">
        <div class="lulu-browse-layout">
          <div class="lulu-sidebar">
            <div style="font-size:.8rem;color:var(--text2);margin-bottom:8px">الفئات <span id="lcat-count"></span></div>
            <input class="form-control" id="lcat-search" placeholder="بحث..." oninput="luluFilterCats()" style="font-size:.82rem;margin-bottom:10px">
            <div class="lulu-cat-list" id="lcat-list"></div>
          </div>
          <div class="lulu-content-area">
            <div class="lulu-content-toolbar">
              <input class="form-control" id="lcontent-search" placeholder="بحث..." oninput="luluSearchContent()" style="flex:1;min-width:160px">
              <label style="display:flex;align-items:center;gap:6px;font-size:.88rem;color:var(--text2);cursor:pointer"><input type="checkbox" id="lchk-all" onchange="luluToggleSelectAll()" style="accent-color:var(--primary);width:15px;height:15px"> تحديد الكل</label>
              <strong id="lsel-count" style="color:var(--primary)">0</strong>
            </div>
            <div class="lulu-back-btn" id="lback-btn" style="display:none" onclick="luluBackToList()">← العودة</div>
            <div id="lcontent-body" style="min-height:160px"><div class="empty-state"><p>اختر فئة لعرض المحتوى</p></div></div>
            <div class="lulu-upload-footer" id="lupload-footer" style="display:none">
              <span style="font-size:.88rem;color:var(--text2)"><strong id="lfooter-count" style="color:var(--primary)">0</strong> عنصر محدد</span>
              <button class="btn btn-success" onclick="luluUploadCategory()">🚀 رفع الفئة كاملة</button>
              <button class="btn btn-primary" onclick="luluUploadSelected()">📤 رفع المحدد فقط</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: DB Content -->
    <div class="lulu-panel" id="lpanel-db">
      <div class="panel"><div class="panel-body" style="padding:14px">
        <div class="form-row" style="margin:0">
          <div class="form-group"><label>بحث</label><input class="form-control" id="ldb-search" placeholder="بحث بالاسم..." onkeydown="if(event.key==='Enter')luluLoadDBContent()"></div>
          <div class="form-group"><label>النوع</label><select class="form-control" id="ldb-type"><option value="movie">أفلام</option><option value="series">مسلسلات</option></select></div>
          <div style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="luluLoadDBContent()">تحميل</button></div>
        </div>
      </div></div>
      <div id="ldb-body"><div class="empty-state"><p>اضغط "تحميل" لعرض المحتوى من القاعدة</p></div></div>
    </div>

    <!-- TAB: Uploaded Files (from PG) -->
    <div class="lulu-panel" id="lpanel-uploaded">
      <div class="panel"><div class="panel-body" style="padding:14px">
        <div class="form-row" style="margin:0">
          <div class="form-group"><label>بحث</label><input class="form-control" id="luf-search" placeholder="بحث بالاسم..." onkeydown="if(event.key==='Enter')luluLoadUploadedFiles()"></div>
          <div class="form-group"><label>النوع</label><select class="form-control" id="luf-type"><option value="">الكل</option><option value="movie">أفلام</option><option value="episode">حلقات</option></select></div>
          <div class="form-group"><label>الفئة</label><input class="form-control" id="luf-cat" placeholder="اسم الفئة..."></div>
          <div style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="luluLoadUploadedFiles()">بحث</button></div>
        </div>
      </div></div>
      <div id="luf-stats" style="padding:0 14px"></div>
      <div id="luf-body"><div class="empty-state"><p>اضغط "بحث" لعرض الملفات المرفوعة</p></div></div>
    </div>

    <!-- TAB: Accounts -->
    <div class="lulu-panel" id="lpanel-accounts">
      <div class="panel"><div class="panel-header"><h3>حسابات LuluStream</h3></div><div class="panel-body">
        <div id="lacc-alert"></div>
        <div class="form-row">
          <div class="form-group"><label>الاسم</label><input class="form-control" id="lacc-name" placeholder="الحساب الرئيسي"></div>
          <div class="form-group"><label>مفتاح API</label><input class="form-control" id="lacc-key" dir="ltr" placeholder="258176..."></div>
          <div class="form-group" style="max-width:160px"><label>مجلد رئيسي</label><input type="number" class="form-control" id="lacc-folder" value="0"></div>
        </div>
        <div class="btn-group"><button class="btn btn-primary" onclick="luluAddAccount()">+ إضافة</button></div>
        <p style="font-size:.8rem;color:var(--text2);margin-top:8px">💡 اترك المجلد 0 وسيُنشأ تلقائياً مجلد "محتوى عربي" في Lulu مع مجلدات فرعية لكل فئة</p>
      </div></div>
      <div class="panel"><div class="panel-header"><h3>الحسابات</h3></div><div class="panel-body no-pad"><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>الاسم</th><th>مفتاح API</th><th>المجلد</th><th>التاريخ</th><th>حذف</th></tr></thead>
        <tbody id="lacc-tbody"><tr><td colspan="6" style="text-align:center;color:var(--text2)">تحميل...</td></tr></tbody>
      </table></div></div></div>
    </div>

    <!-- TAB: Jobs -->
    <div class="lulu-panel" id="lpanel-jobs">
      <div class="panel"><div class="panel-header"><h3>مهام الرفع</h3><button class="btn btn-outline" onclick="luluLoadJobs()">🔄 تحديث</button></div>
      <div class="panel-body no-pad"><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>الحالة</th><th>النوع</th><th>التقدم</th><th>الوقت</th><th>إجراء</th></tr></thead>
        <tbody id="ljobs-tbody"><tr><td colspan="6" style="text-align:center;color:var(--text2)">تحميل...</td></tr></tbody>
      </table></div></div></div>
      <div class="panel" id="ljob-detail" style="display:none"><div class="panel-header"><h3 id="ljob-detail-title">تفاصيل</h3></div><div class="panel-body"><div id="ljob-detail-progress"></div><div id="ljob-detail-results" style="max-height:280px;overflow-y:auto;margin-top:12px"></div></div></div>
    </div>
  </div>`;

  await Promise.all([luluLoadAccounts(), luluLoadIptvAccounts()]);
  luluStartJobsRefresh();
}

function luluSwitchTab(name) {
  ['browse','db','uploaded','accounts','jobs'].forEach(t => {
    document.getElementById(`ltab-${t}`)?.classList.toggle('active', t === name);
    document.getElementById(`lpanel-${t}`)?.classList.toggle('active', t === name);
  });
  if (name==='jobs') luluLoadJobs();
  if (name==='accounts') luluRenderAccTable();
  if (name==='uploaded') luluLoadUploadedFiles();
}

function luluAlert(msg, type='info') {
  const el = document.getElementById('lbrowse-alert');
  if (!el) return;
  const cls = {success:'lulu-alert-success',error:'lulu-alert-error',info:'lulu-alert-info',warn:'lulu-alert-warn'};
  el.innerHTML = `<div class="lulu-alert ${cls[type]||'lulu-alert-info'}">${msg}</div>`;
  if (type!=='error') setTimeout(()=>{if(el)el.innerHTML='';},5000);
}

// ── Lulu Accounts ──────────────────────────────────
async function luluLoadAccounts() {
  try { const d=await cloudApi('/api/lulu-upload/accounts'); LS.luluAccounts=d.accounts||[]; luluRenderAccTable(); luluRefreshLuluDropdown(); } catch {}
}
function luluRenderAccTable() {
  const tbody=document.getElementById('lacc-tbody'); if(!tbody)return;
  if(!LS.luluAccounts.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">لا توجد حسابات</td></tr>';return;}
  tbody.innerHTML=LS.luluAccounts.map(a=>`<tr><td>${a.id}</td><td>${esc(a.name)}</td><td style="direction:ltr;font-size:.8rem">${esc(a.api_key_masked)}</td><td>${a.main_folder_id||'—'}</td><td>${formatDate(a.created_at)}</td><td><button class="btn btn-sm btn-danger" onclick="luluDeleteAccount(${a.id})">حذف</button></td></tr>`).join('');
}
function luluRefreshLuluDropdown() {
  const sel=document.getElementById('lsel-lulu'); if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— اختر حساب —</option>'+LS.luluAccounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(cur) sel.value=cur;
}
async function luluAddAccount() {
  const name=document.getElementById('lacc-name')?.value.trim(),apiKey=document.getElementById('lacc-key')?.value.trim(),folder=parseInt(document.getElementById('lacc-folder')?.value)||0;
  if(!apiKey){const a=document.getElementById('lacc-alert');a.innerHTML='<div class="lulu-alert lulu-alert-error">أدخل مفتاح API</div>';return;}
  const a=document.getElementById('lacc-alert');a.innerHTML='<div class="lulu-alert lulu-alert-info">جارٍ التحقق...</div>';
  try{const r=await fetch(`${CLOUD}/api/lulu-upload/accounts`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:name||'حساب Lulu',api_key:apiKey,main_folder_id:folder})});const d=await r.json();if(!r.ok||d.error){a.innerHTML=`<div class="lulu-alert lulu-alert-error">${d.error||'فشل'}</div>`;return;}a.innerHTML='<div class="lulu-alert lulu-alert-success">✅ تمت الإضافة</div>';document.getElementById('lacc-name').value='';document.getElementById('lacc-key').value='';await luluLoadAccounts();}catch(e){a.innerHTML=`<div class="lulu-alert lulu-alert-error">${e.message}</div>`;}
}
async function luluDeleteAccount(id){if(!confirm('حذف الحساب؟'))return;await cloudApi(`/api/lulu-upload/accounts/${id}`,{method:'DELETE'});await luluLoadAccounts();}

// ── IPTV Accounts dropdown ─────────────────────────
async function luluLoadIptvAccounts() {
  try{const d=await cloudApi('/api/lulu-upload/iptv-accounts');LS.iptvAccounts=d.accounts||[];const sel=document.getElementById('lsel-iptv');if(!sel)return;sel.innerHTML='<option value="">الافتراضي</option>'+LS.iptvAccounts.map(a=>`<option value="${a.id}">${esc(a.name||a.server_url)}</option>`).join('');}catch{}
}

// ── Browse: categories ──────────────────────────────
function luluTypeChange(){LS.activeType=document.getElementById('lsel-type')?.value||'vod';LS.activeCat=null;LS.selectedIds.clear();LS.inSeriesDetail=false;luluUpdateSelCount();document.getElementById('lcontent-body').innerHTML='<div class="empty-state"><p>اختر فئة</p></div>';document.getElementById('lback-btn').style.display='none';luluRenderCatList();}
async function luluLoadCategories(){const iptvId=document.getElementById('lsel-iptv')?.value;document.getElementById('lbrowse-alert').innerHTML='';document.getElementById('lbrowse-main').style.display='block';document.getElementById('lcat-list').innerHTML='<div class="loading"><div class="spinner"></div></div>';try{const qs=iptvId?`?iptv_id=${iptvId}`:'';const d=await cloudApi(`/api/lulu-upload/iptv/categories${qs}`);if(d.error){luluAlert(d.error,'error');return;}LS.vodCats=d.vod||[];LS.seriesCats=d.series||[];luluRenderCatList();}catch(e){luluAlert(e.message,'error');}}
function luluRenderCatList(){const cats=LS.activeType==='vod'?LS.vodCats:LS.seriesCats;const q=document.getElementById('lcat-search')?.value?.toLowerCase()||'';const filt=q?cats.filter(c=>c.name.toLowerCase().includes(q)):cats;const el=document.getElementById('lcat-list');const cnt=document.getElementById('lcat-count');if(cnt)cnt.textContent=`(${filt.length})`;if(!el)return;if(!filt.length){el.innerHTML='<div class="empty-state" style="padding:12px">لا فئات</div>';return;}el.innerHTML=filt.map(c=>`<div class="lulu-cat-item ${LS.activeCat===c.id?'active':''}" onclick="luluSelectCat(${c.id},'${c.name.replace(/'/g,"\\'")}')">${esc(c.name)}</div>`).join('');}
function luluFilterCats(){luluRenderCatList();}
async function luluSelectCat(catId,catName){LS.activeCat=catId;LS.currentCatName=catName;LS.selectedIds.clear();LS.inSeriesDetail=false;LS.currentSeries=null;luluUpdateSelCount();document.getElementById('lback-btn').style.display='none';document.getElementById('lfooter-cat')&&(document.getElementById('lfooter-cat').textContent=catName);luluRenderCatList();await luluLoadContent(catId);}
async function luluLoadContent(catId){const iptvId=document.getElementById('lsel-iptv')?.value;const type=LS.activeType;const body=document.getElementById('lcontent-body');body.innerHTML='<div class="loading"><div class="spinner"></div><p>جارٍ التحميل...</p></div>';try{let qs=`?type=${type}&cat_id=${catId}`;if(iptvId)qs+=`&iptv_id=${iptvId}`;const d=await cloudApi(`/api/lulu-upload/iptv/content${qs}`);if(d.error){body.innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${d.error}</p></div>`;return;}LS.contentItems=d.items||[];document.getElementById('lcontent-search').value='';luluRenderContent(LS.contentItems);}catch(e){body.innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`;}}
function luluSearchContent(){const q=document.getElementById('lcontent-search')?.value?.toLowerCase()||'';if(LS.inSeriesDetail)luluRenderEpisodes(q?LS.seriesItems.filter(i=>i.name.toLowerCase().includes(q)):LS.seriesItems);else luluRenderContent(q?LS.contentItems.filter(i=>i.name.toLowerCase().includes(q)):LS.contentItems);}
function luluRenderContent(items){const body=document.getElementById('lcontent-body');if(!items.length){body.innerHTML='<div class="empty-state"><p>لا محتوى</p></div>';return;}if(LS.activeType==='series'&&!LS.inSeriesDetail){body.innerHTML=`<div class="lulu-grid">${items.map(item=>`<div class="lulu-item ${LS.selectedIds.has(item.streamId)?'selected':''}" onclick="luluDrillSeries(${item.streamId},'${(item.name||'').replace(/'/g,"\\'")}')"><img src="${esc(item.poster||'')}" onerror="this.src=''" alt=""><div class="lulu-item-name">${esc(item.name)}</div><div class="lulu-drill-hint">👁 الحلقات</div></div>`).join('')}</div>`;}else{body.innerHTML=`<div class="lulu-grid">${items.map(item=>`<div class="lulu-item ${LS.selectedIds.has(item.streamId)?'selected':''}" onclick="luluToggleItem('${item.streamId}',this)"><div class="lulu-check">✓</div><img src="${esc(item.poster||item.stream_icon||'')}" onerror="this.src=''" alt=""><div class="lulu-item-name">${esc(item.name)}</div></div>`).join('')}</div>`;}luluUpdateSelCount();}
function luluToggleItem(id,el){if(LS.selectedIds.has(id)){LS.selectedIds.delete(id);el.classList.remove('selected');}else{LS.selectedIds.add(id);el.classList.add('selected');}luluUpdateSelCount();}
function luluToggleSelectAll(){const checked=document.getElementById('lchk-all')?.checked;const items=LS.inSeriesDetail?LS.seriesItems:LS.contentItems;if(checked)items.forEach(i=>LS.selectedIds.add(LS.inSeriesDetail?String(i.streamId):i.streamId));else LS.selectedIds.clear();if(LS.inSeriesDetail)luluRenderEpisodes(LS.seriesItems);else luluRenderContent(items);luluUpdateSelCount();}
function luluUpdateSelCount(){const n=LS.selectedIds.size;document.getElementById('lsel-count')&&(document.getElementById('lsel-count').textContent=n);document.getElementById('lfooter-count')&&(document.getElementById('lfooter-count').textContent=n);const footer=document.getElementById('lupload-footer');if(footer)footer.style.display=n>0?'flex':'none';const chk=document.getElementById('lchk-all');if(chk){const total=LS.inSeriesDetail?LS.seriesItems.length:LS.contentItems.length;chk.indeterminate=n>0&&n<total;chk.checked=total>0&&n===total;}}

// ── Series drill ───────────────────────────────────
async function luluDrillSeries(seriesId,seriesName){LS.inSeriesDetail=true;LS.currentSeries={id:seriesId,name:seriesName};LS.selectedIds.clear();luluUpdateSelCount();document.getElementById('lback-btn').style.display='flex';document.getElementById('lcontent-body').innerHTML='<div class="loading"><div class="spinner"></div><p>جارٍ تحميل الحلقات...</p></div>';const iptvId=document.getElementById('lsel-iptv')?.value;let qs=`?type=series&series_id=${seriesId}`;if(iptvId)qs+=`&iptv_id=${iptvId}`;try{const d=await cloudApi(`/api/lulu-upload/iptv/content${qs}`);if(d.error){document.getElementById('lcontent-body').innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${d.error}</p></div>`;return;}LS.seriesItems=(d.items||[]).map(e=>({...e,streamId:String(e.streamId),catName:LS.currentCatName,showName:seriesName}));luluRenderEpisodes(LS.seriesItems);}catch(e){document.getElementById('lcontent-body').innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`;}}
function luluBackToList(){LS.inSeriesDetail=false;LS.currentSeries=null;LS.selectedIds.clear();luluUpdateSelCount();document.getElementById('lback-btn').style.display='none';luluRenderContent(LS.contentItems);}
function luluRenderEpisodes(items){const body=document.getElementById('lcontent-body');if(!items.length){body.innerHTML='<div class="empty-state"><p>لا حلقات</p></div>';return;}body.innerHTML=`<div class="lulu-ep-list">${items.map(ep=>`<div class="lulu-ep ${LS.selectedIds.has(ep.streamId)?'selected':''}" onclick="luluToggleEp('${ep.streamId}',this)"><input type="checkbox" ${LS.selectedIds.has(ep.streamId)?'checked':''} onclick="event.stopPropagation();luluToggleEp('${ep.streamId}',this.closest('.lulu-ep'))"><span>${esc(ep.name)}</span></div>`).join('')}</div>`;luluUpdateSelCount();}
function luluToggleEp(id,el){const cb=el?.querySelector('input');if(LS.selectedIds.has(id)){LS.selectedIds.delete(id);el?.classList.remove('selected');if(cb)cb.checked=false;}else{LS.selectedIds.add(id);el?.classList.add('selected');if(cb)cb.checked=true;}luluUpdateSelCount();}

// ── Upload: Category (ALL items) or Selected ───────
async function luluUploadCategory() {
  const luluAccId = document.getElementById('lsel-lulu')?.value;
  if (!luluAccId) { luluAlert('اختر حساب Lulu أولاً','error'); return; }
  if (!LS.activeCat) { luluAlert('اختر فئة أولاً','warn'); return; }

  const allItems = LS.inSeriesDetail ? LS.seriesItems : LS.contentItems;
  if (!allItems.length) { luluAlert('لا محتوى للرفع','warn'); return; }

  const items = allItems.map(i => ({
    streamId: i.streamId, name: i.name, ext: i.ext || 'mp4',
    type: i.type || (LS.activeType==='vod'?'movie':'episode'),
    catName: LS.currentCatName, showName: i.showName || LS.currentSeries?.name || '',
    season: i.season || 1, year: i.year || '', imdbId: i.imdbId || '',
  }));

  luluAlert(`⏳ جارٍ إنشاء مهمة رفع ${items.length} عنصر (الفئة كاملة)...`,'info');
  try {
    const iptvId = document.getElementById('lsel-iptv')?.value;
    const r = await fetch(`${CLOUD}/api/lulu-upload/jobs`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body: JSON.stringify({ items, lulu_account_id: luluAccId, iptv_id: iptvId||undefined, type: LS.activeType==='vod'?'vod':'series', cat_name: LS.currentCatName }),
    });
    const d = await r.json();
    if (d.error||!d.success) { luluAlert(d.error||'فشل','error'); return; }
    toast(`✅ بدأت مهمة الرفع #${d.jobId} — ${items.length} عنصر`,'success');
    luluAlert(`✅ مهمة #${d.jobId} مضافة — سيتم إنشاء مجلدات فرعية تلقائياً في Lulu`,'success');
    LS.selectedIds.clear(); luluUpdateSelCount();
    setTimeout(() => luluSwitchTab('jobs'), 1600);
  } catch (e) { luluAlert(e.message,'error'); }
}

async function luluUploadSelected() {
  if (!LS.selectedIds.size) { luluAlert('لم تحدد أي عنصر','warn'); return; }
  const luluAccId = document.getElementById('lsel-lulu')?.value;
  if (!luluAccId) { luluAlert('اختر حساب Lulu أولاً','error'); return; }
  const allItems = LS.inSeriesDetail ? LS.seriesItems : LS.contentItems;
  const items = allItems.filter(i => LS.selectedIds.has(LS.inSeriesDetail ? String(i.streamId) : i.streamId)).map(i => ({
    streamId:i.streamId, name:i.name, ext:i.ext||'mp4',
    type:i.type||(LS.activeType==='vod'?'movie':'episode'),
    catName:LS.currentCatName, showName:i.showName||LS.currentSeries?.name||'',
    season:i.season||1, year:i.year||'', imdbId:i.imdbId||'',
  }));
  luluAlert(`⏳ جارٍ رفع ${items.length} عنصر محدد...`,'info');
  try {
    const iptvId = document.getElementById('lsel-iptv')?.value;
    const r = await fetch(`${CLOUD}/api/lulu-upload/jobs`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body: JSON.stringify({ items, lulu_account_id: luluAccId, iptv_id: iptvId||undefined, type: LS.activeType==='vod'?'vod':'series', cat_name: LS.currentCatName }),
    });
    const d = await r.json();
    if (d.error||!d.success) { luluAlert(d.error||'فشل','error'); return; }
    toast(`✅ مهمة #${d.jobId} — ${items.length} عنصر`,'success');
    LS.selectedIds.clear(); luluUpdateSelCount();
    setTimeout(() => luluSwitchTab('jobs'), 1600);
  } catch (e) { luluAlert(e.message,'error'); }
}

// ── DB Content Tab ─────────────────────────────────
let _ldbPage = 1;
async function luluLoadDBContent() {
  const search = document.getElementById('ldb-search')?.value?.trim()||'';
  const type = document.getElementById('ldb-type')?.value||'movie';
  const body = document.getElementById('ldb-body');
  body.innerHTML = '<div class="loading"><div class="spinner"></div><p>جارٍ التحميل من القاعدة...</p></div>';
  try {
    const endpoint = type==='movie' ? '/api/admin/iptv-content/vod' : '/api/admin/iptv-content/series';
    const qs = `?page=${_ldbPage}&limit=30${search?`&search=${encodeURIComponent(search)}`:''}`;
    const d = await cloudApi(endpoint + qs);
    const items = d.items || [];
    const total = d.total || 0;
    const hasMore = d.hasMore || false;
    if (!items.length) { body.innerHTML='<div class="empty-state"><p>لا محتوى في القاعدة</p></div>'; return; }
    body.innerHTML = `
      <div style="margin-bottom:12px;font-size:.88rem;color:var(--text2)">إجمالي: <strong style="color:var(--primary)">${total}</strong> — صفحة ${_ldbPage}</div>
      <div class="lulu-grid">${items.map(item=>`
        <div class="lulu-item" ${type==='series'?`onclick="luluDBSeriesDetail(${item.id},'${(item.title||'').replace(/'/g,"\\'")}')"`:''}>
          <div style="padding:8px;background:var(--bg4);border-radius:6px;min-height:60px;display:flex;align-items:center;justify-content:center">
            <span style="font-size:24px">${type==='movie'?'🎬':'📺'}</span></div>
          <div class="lulu-item-name">${esc(item.title||'بدون عنوان')}</div>
          ${item.xtream_id?'<div style="font-size:.7rem;color:var(--success)">✓ IPTV</div>':''}
          ${item.tmdb_id?'<div style="font-size:.7rem;color:var(--info)">✓ TMDb</div>':''}
          ${type==='series'&&item.episode_count?`<div style="font-size:.7rem;color:var(--text2)">${item.episode_count} حلقة</div>`:''}
        </div>`).join('')}</div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        ${_ldbPage>1?`<button class="btn btn-outline" onclick="_ldbPage=${_ldbPage-1};luluLoadDBContent()">← السابق</button>`:''}
        ${hasMore?`<button class="btn btn-primary" onclick="_ldbPage=${_ldbPage+1};luluLoadDBContent()">التالي →</button>`:''}
      </div>`;
  } catch (e) { body.innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`; }
}

async function luluDBSeriesDetail(id, title) {
  try {
    const d = await cloudApi(`/api/admin/iptv-content/series/${id}/episodes`);
    const episodes = d.episodes || [];
    showModal(`حلقات: ${title}`, `<div style="margin-bottom:8px;font-size:.88rem;color:var(--text2)">${episodes.length} حلقة</div>
      <div class="lulu-ep-list">${episodes.map(ep=>`<div class="lulu-ep"><span>${esc(ep.title||`S${ep.season||1}E${ep.episode_num||1}`)}</span>${ep.xtream_id?'<span class="badge badge-online" style="margin-right:auto">✓ IPTV</span>':''}</div>`).join('')}</div>`,
      `<button class="btn btn-outline" onclick="closeModal()">إغلاق</button>`);
  } catch (e) { toast(e.message,'error'); }
}

// ── Uploaded Files Tab (from PG) ──────────────────────
let _lufPage = 1;
async function luluLoadUploadedFiles() {
  const search = document.getElementById('luf-search')?.value?.trim()||'';
  const type = document.getElementById('luf-type')?.value||'';
  const cat = document.getElementById('luf-cat')?.value?.trim()||'';
  const body = document.getElementById('luf-body');
  const statsEl = document.getElementById('luf-stats');
  body.innerHTML = '<div class="loading"><div class="spinner"></div><p>جارٍ التحميل...</p></div>';
  try {
    const [stats, d] = await Promise.all([
      cloudApi('/api/lulu-upload/files/stats'),
      cloudApi(`/api/lulu-upload/files?page=${_lufPage}&limit=30${type?`&type=${type}`:''}${cat?`&cat_name=${encodeURIComponent(cat)}`:''}${search?`&search=${encodeURIComponent(search)}`:''}`)
    ]);
    const files = d.files || [];
    const total = d.total || 0;
    const hasMore = d.hasMore || false;
    statsEl.innerHTML = `<div class="stats-grid" style="margin-bottom:16px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
      <div class="stat-card success"><div class="stat-label">إجمالي</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat-card primary"><div class="stat-label">أفلام</div><div class="stat-value">${stats.movies}</div></div>
      <div class="stat-card info"><div class="stat-label">حلقات</div><div class="stat-value">${stats.episodes}</div></div>
      <div class="stat-card danger"><div class="stat-label">فشل</div><div class="stat-value">${stats.failed}</div></div>
    </div>`;
    if (!files.length) { body.innerHTML='<div class="empty-state"><p>لا ملفات مرفوعة</p></div>'; return; }
    body.innerHTML = `<div style="margin-bottom:12px;font-size:.88rem;color:var(--text2)">إجمالي: <strong style="color:var(--primary)">${total}</strong> — صفحة ${_lufPage}</div>
      <div class="table-wrap"><table><thead><tr><th>file_code</th><th>العنوان</th><th>النوع</th><th>الفئة</th><th>المسلسل</th><th>الحالة</th><th>التاريخ</th></tr></thead>
      <tbody>${files.map(f=>`<tr>
        <td style="direction:ltr;font-size:.78rem;color:var(--info)">${esc(f.file_code)}</td>
        <td>${esc(f.title||f.original_name)}</td>
        <td><span class="badge badge-${f.type==='movie'?'primary':'info'}">${f.type==='movie'?'فيلم':'حلقة'}</span></td>
        <td style="font-size:.85rem">${esc(f.cat_name)}</td>
        <td style="font-size:.85rem">${esc(f.show_name)}${f.season?` S${f.season}`:''}${f.episode_num?`E${f.episode_num}`:''}</td>
        <td>${f.status==='ok'?'<span class="badge badge-online">✅</span>':'<span class="badge badge-danger">❌</span>'}</td>
        <td style="font-size:.78rem">${formatDate(f.created_at)}</td>
      </tr>`).join('')}</tbody></table></div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        ${_lufPage>1?`<button class="btn btn-outline" onclick="_lufPage=${_lufPage-1};luluLoadUploadedFiles()">← السابق</button>`:''}
        ${hasMore?`<button class="btn btn-primary" onclick="_lufPage=${_lufPage+1};luluLoadUploadedFiles()">التالي →</button>`:''}
      </div>`;
  } catch (e) { body.innerHTML=`<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`; }
}

// ── Jobs Tab ───────────────────────────────────────
let _luluJobsTimer = null;
function luluStartJobsRefresh(){clearInterval(_luluJobsTimer);_luluJobsTimer=setInterval(()=>{if(document.getElementById('lpanel-jobs')?.classList.contains('active'))luluLoadJobs();},5000);}
async function luluLoadJobs(){try{const d=await cloudApi('/api/lulu-upload/jobs');luluRenderJobs(d.jobs||[]);}catch{}}
function luluRenderJobs(jobs){const tbody=document.getElementById('ljobs-tbody');if(!tbody)return;if(!jobs.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">لا مهام</td></tr>';return;}tbody.innerHTML=jobs.slice().reverse().map(j=>{const pct=j.total?Math.round((j.done/j.total)*100):0;const sl={queued:'في الانتظار',running:'جارٍ',done:'مكتمل',cancelled:'ملغى',daily_limit:'حد يومي'};return`<tr><td>${j.id}</td><td><span class="badge badge-${j.status==='done'?'online':j.status==='running'?'info':j.status==='cancelled'?'blocked':'warning'}">${sl[j.status]||j.status}</span></td><td>${j.type==='vod'?'أفلام':'مسلسلات'}</td><td><div style="font-size:.8rem;color:var(--text2);margin-bottom:3px">${j.done}/${j.total}${j.current?` · ${esc(j.current).slice(0,30)}...`:''}</div><div class="lulu-progress-wrap"><div class="lulu-progress-bar" style="width:${pct}%"></div></div></td><td style="font-size:.8rem">${formatDate(j.startedAt)}</td><td><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="luluShowJobDetail(${j.id})">تفاصيل</button>${j.status==='running'||j.status==='queued'?`<button class="btn btn-sm btn-danger" onclick="luluCancelJob(${j.id})">إلغاء</button>`:''}</div></td></tr>`;}).join('');}
async function luluShowJobDetail(id){const j=await cloudApi(`/api/lulu-upload/jobs/${id}`);const card=document.getElementById('ljob-detail');if(!card)return;card.style.display='block';document.getElementById('ljob-detail-title').textContent=`مهمة #${j.id}`;const pct=j.total?Math.round((j.done/j.total)*100):0;document.getElementById('ljob-detail-progress').innerHTML=`<div style="display:flex;gap:20px;font-size:.88rem;color:var(--text2);flex-wrap:wrap;margin-bottom:8px"><span>✅ ${j.done}</span><span>❌ ${j.failed}</span><span>📦 ${j.total}</span></div><div class="lulu-progress-wrap"><div class="lulu-progress-bar" style="width:${pct}%"></div></div>`;const results=j.results||[];document.getElementById('ljob-detail-results').innerHTML=results.length?results.slice().reverse().map(r=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:.82rem;gap:10px"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span>${r.status==='ok'?`<span class="badge badge-online">✅ ${esc(r.fileCode||'ok')}</span>`:`<span class="badge badge-danger">❌</span>`}</div>`).join(''):'<div style="color:var(--text2);font-size:.85rem">لا نتائج بعد</div>';}
async function luluCancelJob(id){if(!confirm('إلغاء المهمة؟'))return;await cloudApi(`/api/lulu-upload/jobs/${id}`,{method:'DELETE'});luluLoadJobs();}

// ─── Cloud ─────────────────────────────────────────
async function renderCloud(c) {
  let cloud={};try{cloud=await api('/api/admin/cloud-status');}catch{}const online=cloud.online;
  c.innerHTML=`<div class="stats-grid" style="margin-bottom:20px"><div class="stat-card ${online?'success':'danger'}"><div class="stat-label">الحالة</div><div class="stat-value">${online?'🟢 متصل':'🔴 غير متصل'}</div></div><div class="stat-card info"><div class="stat-label">التشغيل</div><div class="stat-value">${cloud.uptime?formatUptime(cloud.uptime):'—'}</div></div><div class="stat-card primary"><div class="stat-label">البث النشط</div><div class="stat-value">${cloud.activeStreams??'—'}</div></div><div class="stat-card warning"><div class="stat-label">الذاكرة</div><div class="stat-value">${cloud.memory||'—'}</div></div></div><div class="panel"><div class="panel-header"><h3>معلومات السيرفر</h3></div><div class="panel-body"><div class="cloud-grid"><div class="cloud-card"><div class="cloud-label">العنوان</div><div class="cloud-value" style="font-size:14px;direction:ltr">${esc(cloud.url||CLOUD)}</div></div><div class="cloud-card"><div class="cloud-label">البورت</div><div class="cloud-value">8090</div></div></div><div style="margin-top:16px"><button class="btn btn-primary" onclick="renderPage('cloud')">🔄 تحديث</button></div></div></div>`;
}

// ─── Logs ──────────────────────────────────────────
async function renderLogs(c) {
  let data={};try{data=await api('/api/admin/logs?limit=200');}catch{}const logs=data.logs||[];
  c.innerHTML=`<div class="panel"><div class="panel-header"><h3>السجلات (${logs.length})</h3><div class="btn-group"><button class="btn btn-outline" onclick="renderPage('logs')">🔄</button><button class="btn btn-danger" onclick="clearLogs()">مسح</button></div></div><div class="panel-body no-pad">${logs.length===0?'<div class="empty-state"><p>لا سجلات</p></div>':logs.map(l=>`<div class="log-entry"><span class="log-time">${formatDate(l.timestamp)}</span><span class="badge badge-${l.level}">${l.level}</span><span class="log-msg">${esc(l.message)}</span></div>`).join('')}</div></div>`;
}
async function clearLogs(){if(!confirm('مسح السجلات؟'))return;try{await api('/api/admin/logs',{method:'DELETE'});toast('تم المسح');renderPage('logs');}catch(e){toast(e.message,'error');}}

// ─── Helpers ───────────────────────────────────────
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function roleLabel(r){return{admin:'مشرف',agent:'وكيل',user:'مستخدم'}[r]||r||'مستخدم';}
function formatDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return d;}}
function formatUptime(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h>0?`${h}س ${m}د`:`${m}د`;}

// ─── Init ──────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', doLogin);
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('sidebar-close').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

(async () => {
  if (await checkAuth()) showApp();
  else { document.getElementById('login-screen').classList.remove('hidden'); }
})();
