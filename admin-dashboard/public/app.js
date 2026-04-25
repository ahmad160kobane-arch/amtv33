/* ═══════════════════════════════════════════════════════
   MA Streaming Admin Dashboard - JavaScript
   ═══════════════════════════════════════════════════════ */

const API = 'https://amtv33-production.up.railway.app';
const CLOUD = 'http://62.171.153.204:8090';

let token = localStorage.getItem('admin_token') || '';
let currentUser = null;
let currentPage = 'overview';

// ─── API Helper ─────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (res.status === 401) { logout(); throw new Error('غير مصرح'); }
  if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');
  return data;
}

// ─── Toast ──────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Modal ──────────────────────────────────────────────
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

// ─── Auth ───────────────────────────────────────────────
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
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('admin_token', token);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
  btn.disabled = false;
}

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('admin_token');
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

// ─── Navigation ─────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = { overview:'نظرة عامة', users:'المستخدمين', agents:'الوكلاء', channels:'القنوات', iptv:'إعدادات IPTV', cloud:'السيرفر السحابي', logs:'السجلات' };
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
      case 'cloud': await renderCloud(c); break;
      case 'logs': await renderLogs(c); break;
    }
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p><button class="btn btn-primary" onclick="renderPage('${page}')">إعادة المحاولة</button></div>`;
  }
}

// ─── Overview Page ──────────────────────────────────────
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
      <div class="panel-body no-pad">
        <div class="table-wrap"><table>
          <thead><tr><th>المستخدم</th><th>الخطة</th><th>الدور</th><th>التاريخ</th></tr></thead>
          <tbody>${(stats.recentUsers || []).map(u => `
            <tr>
              <td><strong>${esc(u.username)}</strong></td>
              <td><span class="badge badge-${u.plan}">${u.plan}</span></td>
              <td><span class="badge badge-${u.role}">${roleLabel(u.role)}</span></td>
              <td>${formatDate(u.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>
  `;
}

// ─── Users Page ─────────────────────────────────────────
let _allUsers = [];
async function renderUsers(c) {
  const data = await api('/api/admin/users');
  _allUsers = data.users || [];
  c.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>المستخدمين (${_allUsers.length})</h3>
        <div class="search-box">
          <input class="form-control" id="user-search" placeholder="بحث..." oninput="filterUsers()">
        </div>
      </div>
      <div class="panel-body no-pad">
        <div class="table-wrap" id="users-table"></div>
      </div>
    </div>`;
  filterUsers();
}

function filterUsers() {
  const q = (document.getElementById('user-search')?.value || '').toLowerCase();
  const filtered = q ? _allUsers.filter(u => u.username.toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)) : _allUsers;
  document.getElementById('users-table').innerHTML = `<table>
    <thead><tr><th>المستخدم</th><th>البريد</th><th>الخطة</th><th>الدور</th><th>الحالة</th><th>إجراءات</th></tr></thead>
    <tbody>${filtered.map(u => `<tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td style="direction:ltr;text-align:right">${esc(u.email||'')}</td>
      <td><span class="badge badge-${u.plan}">${u.plan}</span></td>
      <td><span class="badge badge-${u.role||'user'}">${roleLabel(u.role)}</span></td>
      <td>${u.is_blocked ? '<span class="badge badge-blocked">محظور</span>' : '<span class="badge badge-online">نشط</span>'}</td>
      <td><div class="btn-group">
        <button class="btn btn-sm btn-outline" onclick="editUserModal('${u.id}')">تعديل</button>
        <button class="btn btn-sm ${u.is_blocked?'btn-success':'btn-danger'}" onclick="toggleBlock('${u.id}',${u.is_blocked?0:1})">${u.is_blocked?'رفع الحظر':'حظر'}</button>
        ${u.role!=='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}','${esc(u.username)}')">حذف</button>`:''}
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function editUserModal(id) {
  const u = _allUsers.find(x => x.id === id);
  if (!u) return;
  const exp = u.expires_at ? u.expires_at.substring(0, 10) : '';
  showModal('تعديل المستخدم: ' + u.username, `
    <div class="form-group"><label>الخطة</label>
      <select class="form-control" id="edit-plan"><option value="free" ${u.plan==='free'?'selected':''}>مجاني</option><option value="premium" ${u.plan==='premium'?'selected':''}>بريميوم</option></select></div>
    <div class="form-group"><label>انتهاء الاشتراك</label>
      <input type="date" class="form-control" id="edit-expires" value="${exp}"></div>
    <div class="form-group"><label>الدور</label>
      <select class="form-control" id="edit-role"><option value="user" ${u.role==='user'?'selected':''}>مستخدم</option><option value="agent" ${u.role==='agent'?'selected':''}>وكيل</option><option value="admin" ${u.role==='admin'?'selected':''}>مشرف</option></select></div>
    <div class="form-group"><label>الرصيد</label>
      <input type="number" class="form-control" id="edit-balance" value="${u.balance||0}" step="0.01"></div>
  `, `<button class="btn btn-primary" onclick="saveUser('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function saveUser(id) {
  try {
    const plan = document.getElementById('edit-plan').value;
    const expires_at = document.getElementById('edit-expires').value || null;
    const role = document.getElementById('edit-role').value;
    const balance = parseFloat(document.getElementById('edit-balance').value) || 0;
    await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ plan, expires_at, is_blocked: null, is_admin: role === 'admin' ? 1 : 0 }) });
    await api(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role, balance }) });
    toast('تم تحديث المستخدم');
    closeModal();
    renderPage('users');
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleBlock(id, block) {
  try {
    await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_blocked: block }) });
    toast(block ? 'تم حظر المستخدم' : 'تم رفع الحظر');
    renderPage('users');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
  try {
    await api(`/api/admin/users/${id}`, { method: 'DELETE' });
    toast('تم حذف المستخدم');
    renderPage('users');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Agents Page ────────────────────────────────────────
async function renderAgents(c) {
  const data = await api('/api/admin/agents');
  const agents = data.agents || [];
  c.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h3>الوكلاء (${agents.length})</h3></div>
      <div class="panel-body no-pad"><div class="table-wrap"><table>
        <thead><tr><th>الوكيل</th><th>البريد</th><th>الرصيد</th><th>أكواد (مستخدمة/كل)</th><th>إجراءات</th></tr></thead>
        <tbody>${agents.length === 0 ? '<tr><td colspan="5" class="empty-state">لا يوجد وكلاء</td></tr>' : agents.map(a => `<tr>
          <td><strong>${esc(a.username)}</strong></td>
          <td style="direction:ltr;text-align:right">${esc(a.email||'')}</td>
          <td><strong>$${(a.balance||0).toFixed(2)}</strong></td>
          <td>${a.used_codes}/${a.total_codes}</td>
          <td><button class="btn btn-sm btn-primary" onclick="agentBalanceModal('${a.id}','${esc(a.username)}',${a.balance||0})">تعديل الرصيد</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>
    </div>`;
}

function agentBalanceModal(id, name, balance) {
  showModal('تعديل رصيد: ' + name, `
    <p style="margin-bottom:12px">الرصيد الحالي: <strong>$${balance.toFixed(2)}</strong></p>
    <div class="form-row">
      <div class="form-group"><label>النوع</label><select class="form-control" id="bal-type"><option value="credit">إيداع</option><option value="debit">سحب</option></select></div>
      <div class="form-group"><label>المبلغ</label><input type="number" class="form-control" id="bal-amount" min="0" step="0.01"></div>
    </div>
    <div class="form-group"><label>ملاحظة</label><input class="form-control" id="bal-desc" placeholder="اختياري"></div>
  `, `<button class="btn btn-primary" onclick="saveAgentBalance('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function saveAgentBalance(id) {
  try {
    const type = document.getElementById('bal-type').value;
    const amount = parseFloat(document.getElementById('bal-amount').value);
    const description = document.getElementById('bal-desc').value;
    if (!amount || amount <= 0) throw new Error('المبلغ مطلوب');
    await api(`/api/admin/agents/${id}/balance`, { method: 'PUT', body: JSON.stringify({ type, amount, description }) });
    toast('تم تحديث الرصيد');
    closeModal();
    renderPage('agents');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Channels Page ──────────────────────────────────────
let _allChannels = [];
async function renderChannels(c) {
  const data = await api('/api/channels');
  _allChannels = data.channels || [];
  c.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>القنوات (${_allChannels.length})</h3>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="addChannelModal()">+ بحث IPTV</button>
          <button class="btn btn-outline" onclick="addManualChannelModal()">+ يدوي</button>
          <button class="btn btn-danger" onclick="deleteAllChannels()">حذف الكل</button>
        </div>
      </div>
      <div class="panel-body" style="padding:12px 20px">
        <div class="search-box"><input class="form-control" id="ch-search" placeholder="بحث في القنوات..." oninput="filterChannels()"></div>
      </div>
      <div class="panel-body no-pad"><div class="table-wrap" id="channels-table"></div></div>
    </div>`;
  filterChannels();
}

function filterChannels() {
  const q = (document.getElementById('ch-search')?.value || '').toLowerCase();
  const filtered = q ? _allChannels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.group_name||ch.group||'').toLowerCase().includes(q)) : _allChannels;
  document.getElementById('channels-table').innerHTML = `<table>
    <thead><tr><th>القناة</th><th>المجموعة</th><th>النوع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
    <tbody>${filtered.length === 0 ? '<tr><td colspan="5" class="empty-state">لا توجد قنوات</td></tr>' : filtered.slice(0, 100).map(ch => {
      const isDirect = ch.is_direct_passthrough === 1 || ch.is_direct_passthrough === true;
      return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">${ch.logo_url||ch.logo ? `<img src="${esc(ch.logo_url||ch.logo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover" onerror="this.style.display='none'">` : ''}<strong>${esc(ch.name)}</strong></div></td>
      <td>${esc(ch.group_name||ch.group||'عام')}</td>
      <td>${isDirect ? '<span class="badge badge-success" title="تمرير مباشر بدون إعادة بث">🚀 مباشر</span>' : '<span class="badge badge-info" title="إعادة بث عبر FFmpeg">🔄 FFmpeg</span>'}</td>
      <td>${ch.is_enabled !== 0 ? '<span class="badge badge-online">مفعلة</span>' : '<span class="badge badge-offline">معطلة</span>'}</td>
      <td><div class="btn-group">
        <button class="btn btn-sm btn-outline" onclick="editChannelModal('${ch.id}')">تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="deleteChannel('${ch.id}','${esc(ch.name)}')">حذف</button>
      </div></td>
    </tr>`;
    }).join('')}</tbody></table>`;
}

function addChannelModal() {
  showModal('إضافة قناة من اشتراك IPTV', `
    <div class="form-group">
      <label>البحث في قنوات IPTV</label>
      <div class="search-box">
        <input class="form-control" id="iptv-search-q" placeholder="ابحث مثلاً: bein, mbc, عراق..." onkeydown="if(event.key==='Enter')searchIPTVChannels()">
        <button class="btn btn-primary" onclick="searchIPTVChannels()">بحث</button>
      </div>
    </div>
    <div id="iptv-search-results" style="max-height:350px;overflow-y:auto"></div>
    <div id="iptv-selected-count" style="margin-top:8px;font-size:13px;color:var(--text2)"></div>
  `, `<button class="btn btn-primary" id="add-selected-btn" onclick="addSelectedIPTVChannels()" disabled>إضافة المحددة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

let _iptvSearchResults = [];
let _iptvSelected = new Set();

async function searchIPTVChannels() {
  const q = document.getElementById('iptv-search-q').value.trim();
  if (q.length < 2) { toast('أدخل حرفين على الأقل', 'error'); return; }
  const results = document.getElementById('iptv-search-results');
  results.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  _iptvSelected.clear();
  try {
    const data = await api(`/api/admin/iptv-search?q=${encodeURIComponent(q)}`);
    _iptvSearchResults = data.channels || [];
    if (_iptvSearchResults.length === 0) {
      results.innerHTML = '<div class="empty-state"><p>لا توجد نتائج</p></div>';
      return;
    }
    results.innerHTML = `<table><thead><tr><th style="width:30px"><input type="checkbox" onchange="toggleAllIPTV(this.checked)"></th><th>القناة</th><th>التصنيف</th></tr></thead><tbody>${_iptvSearchResults.map((ch, i) => `<tr>
      <td><input type="checkbox" class="iptv-cb" data-idx="${i}" onchange="toggleIPTVItem(${i}, this.checked)"></td>
      <td><div style="display:flex;align-items:center;gap:8px">${ch.logo ? `<img src="${esc(ch.logo)}" style="width:24px;height:24px;border-radius:3px;object-fit:cover" onerror="this.style.display='none'">` : ''}<span>${esc(ch.name)}</span></div></td>
      <td><span class="badge badge-info">${esc(ch.category)}</span></td>
    </tr>`).join('')}</tbody></table>`;
    updateSelectedCount();
  } catch (err) {
    results.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
  }
}

function toggleIPTVItem(idx, checked) {
  if (checked) _iptvSelected.add(idx); else _iptvSelected.delete(idx);
  updateSelectedCount();
}

function toggleAllIPTV(checked) {
  document.querySelectorAll('.iptv-cb').forEach((cb, i) => { cb.checked = checked; if (checked) _iptvSelected.add(i); else _iptvSelected.delete(i); });
  updateSelectedCount();
}

function updateSelectedCount() {
  const cnt = _iptvSelected.size;
  document.getElementById('iptv-selected-count').textContent = cnt > 0 ? `تم تحديد ${cnt} قناة` : '';
  const btn = document.getElementById('add-selected-btn');
  if (btn) btn.disabled = cnt === 0;
}

async function addSelectedIPTVChannels() {
  if (_iptvSelected.size === 0) return;
  const channels = [..._iptvSelected].map(i => _iptvSearchResults[i]);
  try {
    const data = await api('/api/admin/iptv-add-channels', { method: 'POST', body: JSON.stringify({ channels }) });
    toast(`تم إضافة ${data.added} قناة`);
    closeModal();
    renderPage('channels');
  } catch (err) { toast(err.message, 'error'); }
}

function addManualChannelModal() {
  showModal('إضافة قناة مباشرة يدوياً', `
    <div class="form-group"><label>اسم القناة</label><input class="form-control" id="ch-name" placeholder="مثلاً: Al Jazeera Arabic"></div>
    <div class="form-row">
      <div class="form-group">
        <label>الفئة / المجموعة</label>
        <select class="form-control" id="ch-group">
          <option value="أخبار">📰 أخبار</option>
          <option value="رياضة">⚽ رياضة</option>
          <option value="أفلام">🎬 أفلام</option>
          <option value="مسلسلات">📺 مسلسلات</option>
          <option value="أطفال">🧸 أطفال</option>
          <option value="موسيقى">🎵 موسيقى</option>
          <option value="دينية">🕌 دينية</option>
          <option value="وثائقية">📖 وثائقية</option>
          <option value="ترفيه">🎭 ترفيه</option>
          <option value="عام" selected>📡 عام</option>
        </select>
      </div>
      <div class="form-group"><label>الترتيب</label><input type="number" class="form-control" id="ch-sort" value="0"></div>
    </div>
    <div class="form-group">
      <label>رابط البث المباشر</label>
      <input class="form-control" id="ch-url" dir="ltr" placeholder="https://example.com/stream.m3u8">
      <small style="color:var(--text2);display:block;margin-top:4px">
        💡 يمكنك استخدام روابط من: IPTV-ORG, GitHub Free IPTV, أو أي مصدر مجاني
      </small>
    </div>
    <div class="form-group">
      <label>رابط الشعار (Logo)</label>
      <input class="form-control" id="ch-logo" dir="ltr" placeholder="https://example.com/logo.png (اختياري)">
    </div>
    <div class="form-group" style="background:#f8f9fa;padding:12px;border-radius:8px;border:1px solid #e0e0e0">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
        <input type="checkbox" id="ch-direct" style="width:auto" checked>
        <strong style="color:#2563eb">🚀 قناة مباشرة (Direct Passthrough)</strong>
      </label>
      <div style="margin-top:8px;padding:8px;background:white;border-radius:6px;font-size:13px;line-height:1.6">
        <div style="color:#059669;margin-bottom:6px"><strong>✓ متى تستخدم هذا الخيار:</strong></div>
        <ul style="margin:0;padding-right:20px;color:#374151">
          <li>قنوات مجانية من الإنترنت (IPTV-ORG, GitHub)</li>
          <li>روابط HLS/M3U8 مباشرة</li>
          <li>قنوات لا تحتاج إعادة بث</li>
          <li>توفير موارد السيرفر (بدون FFmpeg)</li>
        </ul>
        <div style="color:#dc2626;margin-top:8px"><strong>✗ لا تستخدمه لـ:</strong></div>
        <ul style="margin:0;padding-right:20px;color:#374151">
          <li>قنوات IPTV المدفوعة (استخدم "بحث IPTV" بدلاً من ذلك)</li>
          <li>روابط تحتاج معالجة أو ترجمة</li>
        </ul>
      </div>
    </div>
  `, `<button class="btn btn-primary" onclick="saveNewChannel()">✓ إضافة القناة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function saveNewChannel() {
  try {
    const name = document.getElementById('ch-name').value.trim();
    const stream_url = document.getElementById('ch-url').value.trim();
    if (!name || !stream_url) throw new Error('الاسم ورابط البث مطلوبان');
    const is_direct = document.getElementById('ch-direct')?.checked ? 1 : 0;
    await api('/api/admin/channels', { method: 'POST', body: JSON.stringify({
      name, stream_url,
      group_name: document.getElementById('ch-group').value || 'عام',
      logo_url: document.getElementById('ch-logo').value || '',
      sort_order: parseInt(document.getElementById('ch-sort').value) || 0,
      is_direct_passthrough: is_direct,
    })});
    toast('تم إضافة القناة');
    closeModal();
    renderPage('channels');
  } catch (err) { toast(err.message, 'error'); }
}

function editChannelModal(id) {
  const ch = _allChannels.find(x => x.id === id);
  if (!ch) return;
  const isDirect = ch.is_direct_passthrough === 1 || ch.is_direct_passthrough === true;
  const currentGroup = ch.group_name || ch.group || 'عام';
  showModal('تعديل القناة: ' + ch.name, `
    <div class="form-group"><label>اسم القناة</label><input class="form-control" id="ch-name" value="${esc(ch.name)}"></div>
    <div class="form-row">
      <div class="form-group">
        <label>الفئة / المجموعة</label>
        <select class="form-control" id="ch-group">
          <option value="أخبار" ${currentGroup==='أخبار'?'selected':''}>📰 أخبار</option>
          <option value="رياضة" ${currentGroup==='رياضة'?'selected':''}>⚽ رياضة</option>
          <option value="أفلام" ${currentGroup==='أفلام'?'selected':''}>🎬 أفلام</option>
          <option value="مسلسلات" ${currentGroup==='مسلسلات'?'selected':''}>📺 مسلسلات</option>
          <option value="أطفال" ${currentGroup==='أطفال'?'selected':''}>🧸 أطفال</option>
          <option value="موسيقى" ${currentGroup==='موسيقى'?'selected':''}>🎵 موسيقى</option>
          <option value="دينية" ${currentGroup==='دينية'?'selected':''}>🕌 دينية</option>
          <option value="وثائقية" ${currentGroup==='وثائقية'?'selected':''}>📖 وثائقية</option>
          <option value="ترفيه" ${currentGroup==='ترفيه'?'selected':''}>🎭 ترفيه</option>
          <option value="عام" ${currentGroup==='عام'?'selected':''}>📡 عام</option>
          <option value="${esc(currentGroup)}" ${!['أخبار','رياضة','أفلام','مسلسلات','أطفال','موسيقى','دينية','وثائقية','ترفيه','عام'].includes(currentGroup)?'selected':''}>${esc(currentGroup)}</option>
        </select>
      </div>
      <div class="form-group"><label>الحالة</label><select class="form-control" id="ch-enabled"><option value="1" ${ch.is_enabled!==0?'selected':''}>مفعلة</option><option value="0" ${ch.is_enabled===0?'selected':''}>معطلة</option></select></div>
    </div>
    <div class="form-group"><label>رابط البث</label><input class="form-control" id="ch-url" dir="ltr" value="${esc(ch.stream_url||'')}"></div>
    <div class="form-group"><label>رابط الشعار</label><input class="form-control" id="ch-logo" dir="ltr" value="${esc(ch.logo_url||ch.logo||'')}"></div>
    <div class="form-group" style="background:#f8f9fa;padding:12px;border-radius:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
        <input type="checkbox" id="ch-direct" style="width:auto" ${isDirect?'checked':''}>
        <strong>🚀 قناة مباشرة (Direct Passthrough)</strong>
      </label>
      <small style="color:var(--text2);display:block;margin-top:6px">
        ${isDirect ? '✓ هذه القناة تُمرر مباشرة بدون إعادة بث' : '⚠️ هذه القناة تُعاد بثها عبر FFmpeg'}
      </small>
    </div>
  `, `<button class="btn btn-primary" onclick="updateChannel('${id}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button>`);
}

async function updateChannel(id) {
  try {
    const is_direct = document.getElementById('ch-direct')?.checked ? 1 : 0;
    await api(`/api/admin/channels/${id}`, { method: 'PUT', body: JSON.stringify({
      name: document.getElementById('ch-name').value,
      group_name: document.getElementById('ch-group').value,
      stream_url: document.getElementById('ch-url').value,
      logo_url: document.getElementById('ch-logo').value,
      is_enabled: parseInt(document.getElementById('ch-enabled').value),
      is_direct_passthrough: is_direct,
    })});
    toast('تم تحديث القناة');
    closeModal();
    renderPage('channels');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteChannel(id, name) {
  if (!confirm(`حذف "${name}"؟`)) return;
  try {
    await api(`/api/admin/channels/${id}`, { method: 'DELETE' });
    toast('تم حذف القناة');
    renderPage('channels');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteAllChannels() {
  if (!confirm('هل أنت متأكد من حذف جميع القنوات؟ لا يمكن التراجع!')) return;
  try {
    await api('/api/admin/channels', { method: 'DELETE' });
    toast('تم حذف جميع القنوات');
    renderPage('channels');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── IPTV Accounts Management Page ──────────────────────
let _iptvAccounts = [];
let _cloudChannels = [];

async function cloudApi(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${CLOUD}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'خطأ في السيرفر السحابي');
  return data;
}

async function renderIPTV(c) {
  try {
    const [accData, chData, errData] = await Promise.all([
      cloudApi('/api/admin/iptv-accounts'),
      cloudApi('/api/admin/cloud-channels'),
      cloudApi('/api/admin/stream-errors?limit=50'),
    ]);
    _iptvAccounts = accData.accounts || [];
    _cloudChannels = chData.channels || [];
    const errors = errData.errors || [];
    const streamingCount = _cloudChannels.filter(ch => ch.is_streaming).length;

    c.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card primary"><div class="stat-label">حسابات IPTV</div><div class="stat-value">${_iptvAccounts.length}</div></div>
        <div class="stat-card success"><div class="stat-label">قنوات مضافة</div><div class="stat-value">${_cloudChannels.length}</div></div>
        <div class="stat-card warning"><div class="stat-label">قنوات تبث الآن</div><div class="stat-value">${streamingCount}</div></div>
        <div class="stat-card danger"><div class="stat-label">أخطاء</div><div class="stat-value">${errors.length}</div></div>
      </div>

      <!-- Add Account -->
      <div class="panel">
        <div class="panel-header">
          <h3>إضافة حساب IPTV جديد</h3>
        </div>
        <div class="panel-body">
          <div class="form-group"><label>اسم الحساب (اختياري)</label>
            <input class="form-control" id="new-acc-name" placeholder="مثلاً: حساب beIN 1"></div>
          <div class="form-group"><label>رابط السيرفر</label>
            <input class="form-control" id="new-acc-server" dir="ltr" placeholder="http://example.com:80"></div>
          <div class="form-row">
            <div class="form-group"><label>اسم المستخدم</label>
              <input class="form-control" id="new-acc-user" dir="ltr"></div>
            <div class="form-group"><label>كلمة المرور</label>
              <input class="form-control" id="new-acc-pass" dir="ltr"></div>
          </div>
          <div class="btn-group" style="margin-top:8px">
            <button class="btn btn-primary" id="add-acc-btn" onclick="addIPTVAccount()">+ إضافة الحساب</button>
            <button class="btn btn-outline" onclick="testIPTVAccount()">اختبار الاتصال</button>
          </div>
          <div id="acc-test-result" style="margin-top:8px"></div>
        </div>
      </div>

      <!-- Accounts List -->
      <div class="panel">
        <div class="panel-header"><h3>الحسابات والقنوات (${_iptvAccounts.length})</h3></div>
        <div class="panel-body no-pad" id="accounts-list">
          ${_iptvAccounts.length === 0 ? '<div class="empty-state"><div class="empty-icon">📡</div><p>لا توجد حسابات. أضف حساب IPTV للبدء</p></div>' : _iptvAccounts.map(acc => {
            const accChannels = _cloudChannels.filter(ch => ch.account_id === acc.id);
            const ch = accChannels[0]; // Each account has ONE channel
            return `<div class="iptv-account-card" id="acc-card-${acc.id}">
              <div class="acc-header">
                <div class="acc-info">
                  <strong>${esc(acc.name || 'حساب #' + acc.id)}</strong>
                  <span class="acc-meta" dir="ltr">${esc(acc.server_url)} — ${esc(acc.username)}</span>
                </div>
                <div class="btn-group">
                  ${!ch ? `<button class="btn btn-sm btn-primary" onclick="searchChannelForAccount(${acc.id})">🔍 اختيار قناة</button>` : ''}
                  <button class="btn btn-sm btn-danger" onclick="deleteIPTVAccount(${acc.id},'${esc(acc.name || 'حساب #' + acc.id)}')">حذف</button>
                </div>
              </div>
              ${ch ? `<div class="acc-channel">
                <div class="ch-info">
                  ${ch.logo ? `<img src="${esc(ch.logo)}" class="ch-logo" onerror="this.style.display='none'">` : '<div class="ch-logo-placeholder">📺</div>'}
                  <div>
                    <div class="ch-name">${esc(ch.name)}</div>
                    <div class="ch-cat">${esc(ch.category || 'عام')}</div>
                  </div>
                </div>
                <div class="ch-actions">
                  <span class="streaming-badge ${ch.is_streaming ? 'streaming-on' : 'streaming-off'}">${ch.is_streaming ? '🟢 يبث' : '🔴 متوقف'}</span>
                  <button class="btn btn-sm ${ch.is_streaming ? 'btn-danger' : 'btn-success'}" onclick="toggleStreaming('${esc(ch.id)}', ${!ch.is_streaming})" id="stream-btn-${esc(ch.id)}">
                    ${ch.is_streaming ? '⏹ إيقاف البث' : '▶ تشغيل البث'}
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="removeChannelFromAccount('${esc(ch.id)}','${esc(ch.name)}')">إزالة القناة</button>
                </div>
              </div>` : `<div class="acc-no-channel">لم يتم اختيار قناة بعد — اضغط "اختيار قناة" لإضافة قناة لهذا الحساب</div>`}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Error Log -->
      <div class="panel">
        <div class="panel-header">
          <h3>سجل الأخطاء (${errors.length})</h3>
          <div class="btn-group">
            <button class="btn btn-outline btn-sm" onclick="renderPage('iptv')">🔄 تحديث</button>
            ${errors.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="clearStreamErrors()">مسح الكل</button>` : ''}
          </div>
        </div>
        <div class="panel-body no-pad" id="error-log">
          ${errors.length === 0 ? '<div class="empty-state"><div class="empty-icon">✅</div><p>لا توجد أخطاء</p></div>' :
            errors.map(e => `<div class="log-entry">
              <span class="log-time">${formatDate(e.created_at)}</span>
              <span class="badge badge-danger">${esc(e.error_type)}</span>
              <span class="log-msg">${esc(e.channel_name ? e.channel_name + ' — ' : '')}${esc(e.message)}</span>
            </div>`).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>فشل الاتصال بالسيرفر السحابي: ${err.message}</p><button class="btn btn-primary" onclick="renderPage('iptv')">إعادة المحاولة</button></div>`;
  }
}

async function addIPTVAccount() {
  const btn = document.getElementById('add-acc-btn');
  btn.disabled = true; btn.textContent = 'جاري الإضافة...';
  try {
    const name = document.getElementById('new-acc-name').value.trim();
    const server_url = document.getElementById('new-acc-server').value.trim();
    const username = document.getElementById('new-acc-user').value.trim();
    const password = document.getElementById('new-acc-pass').value.trim();
    if (!server_url || !username || !password) throw new Error('رابط السيرفر واسم المستخدم وكلمة المرور مطلوبة');
    await cloudApi('/api/admin/iptv-accounts', { method: 'POST', body: JSON.stringify({ name, server_url, username, password }) });
    toast('تم إضافة الحساب بنجاح');
    renderPage('iptv');
  } catch (err) { toast(err.message, 'error'); }
  btn.disabled = false; btn.textContent = '+ إضافة الحساب';
}

async function testIPTVAccount() {
  const r = document.getElementById('acc-test-result');
  r.innerHTML = '<span style="color:var(--text2)">جاري الاختبار...</span>';
  try {
    const data = await cloudApi('/api/admin/iptv-test', { method: 'POST', body: JSON.stringify({
      server_url: document.getElementById('new-acc-server').value.trim(),
      username: document.getElementById('new-acc-user').value.trim(),
      password: document.getElementById('new-acc-pass').value.trim(),
    })});
    if (data.success) {
      r.innerHTML = `<span style="color:var(--success)">✅ الاتصال ناجح — ${data.categories} تصنيف، ${data.channels} قناة</span>`;
    } else {
      r.innerHTML = `<span style="color:var(--danger)">❌ فشل: ${data.error}</span>`;
    }
  } catch (err) { r.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`; }
}

async function deleteIPTVAccount(id, name) {
  if (!confirm(`حذف "${name}" وجميع القنوات المرتبطة؟`)) return;
  try {
    await cloudApi(`/api/admin/iptv-accounts/${id}`, { method: 'DELETE' });
    toast('تم حذف الحساب');
    renderPage('iptv');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Channel Search & Assign Modal ──────────────────────
let _searchAccountId = null;
let _channelSearchResults = [];

function searchChannelForAccount(accountId) {
  _searchAccountId = accountId;
  _channelSearchResults = [];
  showModal('اختيار قناة للحساب', `
    <div class="form-group">
      <label>ابحث عن قناة (مثال: bein sport, mbc, الجزيرة...)</label>
      <div style="display:flex;gap:8px">
        <input class="form-control" id="ch-search-q" placeholder="ابحث..." style="flex:1" onkeydown="if(event.key==='Enter')doChannelSearch()">
        <button class="btn btn-primary" onclick="doChannelSearch()">بحث</button>
      </div>
    </div>
    <div id="ch-search-results" style="max-height:400px;overflow-y:auto"></div>
  `);
  setTimeout(() => document.getElementById('ch-search-q')?.focus(), 200);
}

async function doChannelSearch() {
  const q = document.getElementById('ch-search-q').value.trim();
  if (q.length < 2) { toast('أدخل حرفين على الأقل', 'error'); return; }
  const results = document.getElementById('ch-search-results');
  results.innerHTML = '<div class="loading"><div class="spinner"></div><p>جاري البحث في قنوات IPTV...</p></div>';
  try {
    const data = await cloudApi(`/api/admin/iptv-search?account_id=${_searchAccountId}&q=${encodeURIComponent(q)}`);
    _channelSearchResults = data.channels || [];
    if (_channelSearchResults.length === 0) {
      results.innerHTML = '<div class="empty-state"><p>لا توجد نتائج لـ "' + esc(q) + '"</p></div>';
      return;
    }
    results.innerHTML = `<div class="ch-search-list">${_channelSearchResults.map((ch, i) => `
      <div class="ch-search-item" onclick="selectChannelForAccount(${i})">
        <div class="ch-search-info">
          ${ch.logo ? `<img src="${esc(ch.logo)}" class="ch-search-logo" onerror="this.style.display='none'">` : '<div class="ch-search-logo-ph">📺</div>'}
          <div>
            <div class="ch-search-name">${esc(ch.name)}</div>
            <div class="ch-search-cat">${esc(ch.category)} — Stream ID: ${ch.stream_id}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-success">اختيار</button>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    results.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
  }
}

async function selectChannelForAccount(idx) {
  const ch = _channelSearchResults[idx];
  if (!ch) return;
  if (!confirm(`إضافة "${ch.name}" لهذا الحساب؟`)) return;
  try {
    await cloudApi('/api/admin/iptv-add-channels', {
      method: 'POST',
      body: JSON.stringify({ account_id: _searchAccountId, channels: [ch] }),
    });
    toast(`تم إضافة "${ch.name}" بنجاح`);
    closeModal();
    renderPage('iptv');
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleStreaming(channelId, streaming) {
  const btn = document.getElementById('stream-btn-' + channelId);
  if (btn) { btn.disabled = true; btn.textContent = 'جاري...'; }
  try {
    await cloudApi(`/api/admin/channel-toggle-stream/${encodeURIComponent(channelId)}`, {
      method: 'POST',
      body: JSON.stringify({ streaming }),
    });
    toast(streaming ? 'تم تشغيل البث' : 'تم إيقاف البث');
    renderPage('iptv');
  } catch (err) {
    toast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = streaming ? '▶ تشغيل البث' : '⏹ إيقاف البث'; }
  }
}

async function removeChannelFromAccount(channelId, channelName) {
  if (!confirm(`إزالة "${channelName}" من الحساب؟`)) return;
  try {
    await cloudApi(`/api/admin/cloud-channels/${encodeURIComponent(channelId)}`, { method: 'DELETE' });
    toast('تم إزالة القناة');
    renderPage('iptv');
  } catch (err) { toast(err.message, 'error'); }
}

async function clearStreamErrors() {
  if (!confirm('مسح جميع سجلات الأخطاء؟')) return;
  try {
    await cloudApi('/api/admin/stream-errors', { method: 'DELETE' });
    toast('تم مسح سجل الأخطاء');
    renderPage('iptv');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Cloud Server Page ──────────────────────────────────
async function renderCloud(c) {
  let cloud = {};
  try { cloud = await api('/api/admin/cloud-status'); } catch {}
  const online = cloud.online;
  c.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card ${online?'success':'danger'}">
        <div class="stat-label">الحالة</div>
        <div class="stat-value">${online ? '🟢 متصل' : '🔴 غير متصل'}</div>
      </div>
      <div class="stat-card info"><div class="stat-label">وقت التشغيل</div><div class="stat-value">${cloud.uptime ? formatUptime(cloud.uptime) : '—'}</div></div>
      <div class="stat-card primary"><div class="stat-label">البث النشط</div><div class="stat-value">${cloud.activeStreams ?? '—'}</div></div>
      <div class="stat-card warning"><div class="stat-label">الذاكرة</div><div class="stat-value">${cloud.memory || '—'}</div></div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>معلومات السيرفر</h3></div>
      <div class="panel-body">
        <div class="cloud-grid">
          <div class="cloud-card"><div class="cloud-label">العنوان</div><div class="cloud-value" style="font-size:14px;direction:ltr">${esc(cloud.url || CLOUD)}</div></div>
          <div class="cloud-card"><div class="cloud-label">البورت</div><div class="cloud-value">8090</div></div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" onclick="renderPage('cloud')">🔄 تحديث</button>
        </div>
      </div>
    </div>`;
}

// ─── Logs Page ──────────────────────────────────────────
async function renderLogs(c) {
  let data = {};
  try { data = await api('/api/admin/logs?limit=200'); } catch {}
  const logs = data.logs || [];
  c.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>السجلات (${logs.length})</h3>
        <div class="btn-group">
          <button class="btn btn-outline" onclick="renderPage('logs')">🔄 تحديث</button>
          <button class="btn btn-danger" onclick="clearLogs()">مسح الكل</button>
        </div>
      </div>
      <div class="panel-body no-pad">
        ${logs.length === 0 ? '<div class="empty-state"><div class="empty-icon">📋</div><p>لا توجد سجلات</p></div>' :
          logs.map(l => `<div class="log-entry">
            <span class="log-time">${formatDate(l.timestamp)}</span>
            <span class="badge badge-${l.level}">${l.level}</span>
            <span class="log-msg">${esc(l.message)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

async function clearLogs() {
  if (!confirm('مسح جميع السجلات؟')) return;
  try {
    await api('/api/admin/logs', { method: 'DELETE' });
    toast('تم مسح السجلات');
    renderPage('logs');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Helpers ────────────────────────────────────────────
function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function roleLabel(r) { return {admin:'مشرف',agent:'وكيل',user:'مستخدم'}[r] || r || 'مستخدم'; }
function formatDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('ar-IQ', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return d; } }
function formatUptime(sec) { const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60); return h>0 ? `${h}س ${m}د` : `${m}د`; }

// ─── Init ───────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', doLogin);
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('sidebar-close').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

// Check auth on load
(async () => {
  if (await checkAuth()) showApp();
  else { document.getElementById('login-screen').classList.remove('hidden'); }
})();
