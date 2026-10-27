/* ScholarHub - single page frontend (vanilla JS). Talks to the Express API in /api */
const S = { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null') };

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fd = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const badge = (s) => `<span class="badge b-${String(s).toLowerCase().replace(/\s+/g, '-')}">${esc(s)}</span>`;
const val = (id) => document.getElementById(id)?.value;
const chk = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const GENDERS = ['Male', 'Female', 'Other'];
const COURSES = ['B.Tech', 'M.Tech', 'B.Sc', 'M.Sc', 'BA', 'B.Com', 'MBBS', 'BBA', 'Other'];
const TYPES = ['Merit', 'Need', 'Minority', 'Women', 'Disability', 'General'];

function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 't ' + type; t.textContent = msg;
  $('#toast').appendChild(t); setTimeout(() => t.remove(), 4200);
}
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { App.logout(); throw new Error(d.error || 'Session expired'); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
const run = async (fn) => { try { await fn(); } catch (e) { toast(e.message, 'err'); } };
const bars = (rows, lab, v, fmt = (x) => x) => {
  const m = Math.max(1, ...rows.map((r) => Number(r[v])));
  return '<div>' + rows.map((r) => `<div class="bar-row"><span class="bar-l" title="${esc(r[lab])}">${esc(r[lab])}</span><div class="bar-t"><div class="bar-f" style="width:${(Number(r[v]) / m) * 100}%"></div></div><span class="bar-v">${fmt(r[v])}</span></div>`).join('') + '</div>';
};
const empty = (t) => `<div class="empty">${t}</div>`;

// ---------- navigation ----------
const MENU = {
  student: [['dashboard', '🏠 Dashboard'], ['scholarships', '🔎 Scholarships'], ['eligibility', '✅ My Eligibility'], ['applications', '📄 My Applications'], ['notifications', '🔔 Notifications'], ['profile', '👤 My Profile']],
  verifier: [['queue', '📋 Review Queue'], ['awards', '💰 Awards'], ['reports', '📊 Reports'], ['students', '🎓 Students']],
  admin: [['manage', '🛠 Manage Scholarships'], ['reports', '📊 Reports'], ['students', '🎓 Students'], ['scholarships', '🔎 Browse']],
  sysadmin: [['reports', '📊 Reports'], ['users', '👥 Users'], ['health', '🩺 Database Health'], ['logs', '🗂 Activity Log'], ['manage', '🛠 Scholarships'], ['students', '🎓 Students']],
};
const pages = {};

function shell() {
  const items = MENU[S.user.role];
  const cur = location.hash.slice(1) || items[0][0];
  $('#root').innerHTML = `<div class="shell">
    <aside class="side"><div class="brand">🎓 ScholarHub<small>Scholarship Management System</small></div>
      <nav class="nav">${items.map(([k, l]) => `<a class="${k === cur ? 'active' : ''}" href="#${k}">${l}</a>`).join('')}</nav>
      <div class="me"><b>${esc(S.user.name)}</b>${esc(S.user.role.toUpperCase())}<br><a href="#" onclick="App.logout();return false" style="color:#fca5a5">Logout</a></div></aside>
    <main class="main" id="page"><div class="empty">Loading…</div></main></div>`;
  return cur;
}
async function route() {
  if (!S.user) return authView();
  const cur = shell();
  const fn = pages[cur] || pages[MENU[S.user.role][0][0]];
  run(async () => { $('#page').innerHTML = await fn(); });
}
window.addEventListener('hashchange', route);

// ---------- auth ----------
function authView(tab = 'login') {
  $('#root').innerHTML = `<div class="auth"><div class="hero"><h1>Find every scholarship you deserve.</h1>
    <p>One centralized database of Indian scholarships. Your academic, financial and demographic profile is matched against eligibility rules using SQL - no guesswork.</p>
    <ul><li>Instant SQL-based eligibility checking</li><li>Gap analysis: see exactly what you're missing</li><li>Track applications, documents and awards</li></ul></div>
    <div class="authbox"><div class="card"><div class="tabs"><button class="${tab === 'login' ? 'on' : ''}" onclick="authView('login')">Login</button><button class="${tab === 'register' ? 'on' : ''}" onclick="authView('register')">Student Sign-up</button></div>
    ${tab === 'login' ? `<div class="form" style="grid-template-columns:1fr"><div class="f"><label>Email</label><input id="l_email" value="ganikhasri@student.in"></div><div class="f"><label>Password</label><input id="l_pass" type="password" value="password123"></div><button class="btn" onclick="App.login()">Login</button></div>
    <div class="demo"><b>Demo accounts</b> (password: <code>password123</code>)<br>Student: ganikhasri@student.in · diya@student.in · rahul@student.in<br>Verification Officer: verifier@scholar.in<br>Administrator: admin@scholar.in<br>System Administrator: sysadmin@scholar.in</div>` : registerForm()}
    </div></div></div>`;
}
window.authView = authView;
const opt = (arr, sel) => arr.map((o) => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
function profileFields(p = {}) {
  return `<div class="f"><label>Full name</label><input id="p_name" value="${esc(p.full_name)}"></div>
  <div class="f"><label>Date of birth</label><input id="p_dob" type="date" value="${esc((p.dob || '').slice(0, 10))}"></div>
  <div class="f"><label>Gender</label><select id="p_gender">${opt(GENDERS, p.gender)}</select></div>
  <div class="f"><label>Category</label><select id="p_cat">${opt(CATEGORIES, p.category)}</select></div>
  <div class="f"><label>State</label><input id="p_state" value="${esc(p.state)}" placeholder="e.g. Tamil Nadu"></div>
  <div class="f"><label>Course</label><select id="p_course">${opt(COURSES, p.course)}</select></div>
  <div class="f"><label>Year of study</label><input id="p_year" type="number" min="1" max="6" value="${p.year_of_study ?? 1}"></div>
  <div class="f"><label>CGPA (0-10)</label><input id="p_cgpa" type="number" step="0.01" min="0" max="10" value="${p.cgpa ?? ''}"></div>
  <div class="f"><label>Annual family income (₹)</label><input id="p_inc" type="number" min="0" value="${p.annual_income ?? ''}"></div>
  <div class="f"><label>&nbsp;</label><label class="chk"><input type="checkbox" id="p_dis" ${p.is_disabled ? 'checked' : ''}> Person with disability</label>
     <label class="chk"><input type="checkbox" id="p_min" ${p.is_minority ? 'checked' : ''}> Minority community</label></div>`;
}
const readProfile = () => ({ full_name: val('p_name'), dob: val('p_dob'), gender: val('p_gender'), category: val('p_cat'), state: val('p_state'), course: val('p_course'), year_of_study: +val('p_year'), cgpa: +val('p_cgpa'), annual_income: +val('p_inc'), is_disabled: $('#p_dis').checked, is_minority: $('#p_min').checked });
const registerForm = () => `<div class="form"><div class="f"><label>Email</label><input id="r_email"></div><div class="f"><label>Password</label><input id="r_pass" type="password"></div>${profileFields()}</div><button class="btn mt" onclick="App.register()">Create account</button>`;

// ---------- STUDENT pages ----------
const schCard = (s) => `<div class="card sch" onclick="App.detail(${s.scholarship_id})">
  <div class="row between">${badge(s.deadline_status)}<span class="tag">${esc(s.scholarship_type)}</span></div>
  <h3 style="margin-top:10px">${esc(s.name)}</h3><div class="prov">${esc(s.provider_name)} · ${esc(s.provider_type)}</div>
  <div class="amt">${inr(s.amount)}</div>
  <div class="small muted mt">Deadline: ${fd(s.deadline)} ${s.deadline_status === 'Upcoming' ? '(opens ' + fd(s.application_start) + ')' : '(' + s.days_left + ' days left)'}</div></div>`;

pages.dashboard = async () => {
  const [el, apps] = await Promise.all([api('/eligibility/me'), api('/applications/me')]);
  const soon = el.eligible.filter((e) => e.deadline_status === 'Expiring Soon' && !e.already_applied);
  return `<h2>Welcome, ${esc(S.user.name)} 👋</h2><p class="sub">Here's what the database found for your profile.</p>
  <div class="grid g4 mb">
   <div class="card stat"><span class="n">${el.eligible.length}</span><span class="l">Scholarships you're eligible for</span></div>
   <div class="card stat"><span class="n">${inr(el.potential_amount)}</span><span class="l">Potential funding still open to you</span></div>
   <div class="card stat"><span class="n">${apps.length}</span><span class="l">Applications submitted</span></div>
   <div class="card stat"><span class="n">${apps.filter((a) => a.status === 'Approved').length}</span><span class="l">Approved</span></div></div>
  ${soon.length ? `<div class="card mb" style="border-color:#fca5a5;background:#fff7f7"><h3>⏰ Closing soon - apply now</h3>${soon.map((s) => `<div class="row between" style="padding:6px 0"><span><b>${esc(s.scholarship_name)}</b> · ${inr(s.amount)} · ${s.days_left} days left</span><button class="btn sm" onclick="App.apply(${s.scholarship_id})">Apply</button></div>`).join('')}</div>` : ''}
  <div class="grid g2"><div class="card"><h3>🏆 Top matches for you <span class="novel">PRIORITY RANKED</span></h3>
   ${el.eligible.filter((e) => !e.already_applied).slice(0, 4).map((e) => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span>${esc(e.scholarship_name)}<br><span class="small muted">${esc(e.provider_name)} · ${e.days_left} days left</span></span><b>${inr(e.amount)}</b></div>`).join('') || empty('No open matches right now')}
   <a href="#eligibility" class="small">See all →</a></div>
  <div class="card"><h3>📄 Recent applications</h3>${apps.slice(0, 4).map((a) => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span>${esc(a.scholarship_name)}</span>${badge(a.status)}</div>`).join('') || empty('You have not applied yet')}<a href="#applications" class="small">Manage →</a></div></div>`;
};

pages.scholarships = async () => {
  setTimeout(() => App.filter(), 0);
  const isS = S.user.role === 'student';
  return `<h2>Search Scholarships</h2><p class="sub">Filter by course, state, category, income, deadline status and more.</p>
  <div class="filters"><input id="f_q" placeholder="Search name / provider…" oninput="App.filter()">
   <select id="f_course" onchange="App.filter()"><option value="">Any course</option>${opt(COURSES)}</select>
   <input id="f_state" placeholder="State (e.g. Kerala)" oninput="App.filter()">
   <select id="f_cat" onchange="App.filter()"><option value="">Any category</option>${opt(CATEGORIES)}</select>
   <select id="f_gender" onchange="App.filter()"><option value="">Any gender</option>${opt(GENDERS)}</select>
   <input id="f_inc" type="number" placeholder="My family income ₹" oninput="App.filter()">
   <select id="f_type" onchange="App.filter()"><option value="">Any type</option>${opt(TYPES)}</select>
   <select id="f_status" onchange="App.filter()"><option value="">Open (default)</option><option>Active</option><option>Expiring Soon</option><option>Upcoming</option><option>Closed</option></select></div>
  <div id="sch-list" class="grid g3"></div>`;
};

pages.eligibility = async () => {
  const [el, docs] = await Promise.all([api('/eligibility/me'), api('/eligibility/me/checklist')]);
  return `<h2>My Eligibility</h2><p class="sub">Computed live by a SQL function that joins your profile with each scholarship's criteria.</p>
  <h3>✅ You are eligible for (${el.eligible.length}) <span class="novel">PRIORITY SCORE</span></h3>
  <p class="small muted">Ranked by amount vs. urgency, so high-value, soon-to-close scholarships come first.</p>
  <div class="grid g2 mb">${el.eligible.map((e) => `<div class="card"><div class="row between">${badge(e.deadline_status)}<span class="small muted">Priority score ${e.priority_score}</span></div>
     <h3 style="margin-top:8px">${esc(e.scholarship_name)}</h3><div class="muted small">${esc(e.provider_name)} · ${esc(e.scholarship_type)}</div>
     <div class="row between mt"><b style="font-size:20px;color:var(--primary)">${inr(e.amount)}</b><span class="small muted">${e.deadline_status === 'Upcoming' ? 'Opens ' + fd(e.application_start) : fd(e.deadline) + ' · ' + e.days_left + 'd left'}</span></div>
     <div class="row mt"><button class="btn sm sec" onclick="App.detail(${e.scholarship_id})">Details</button>
     ${e.already_applied ? '<span class="badge b-approved">Already applied</span>' : e.deadline_status === 'Upcoming' ? '<span class="badge b-upcoming">Not open yet</span>' : `<button class="btn sm" onclick="App.apply(${e.scholarship_id})">Apply now</button>`}</div></div>`).join('') || empty('No matches yet - update your profile.')}</div>
  <h3>🧭 Almost eligible - one criterion away <span class="novel">GAP ANALYSIS</span></h3>
  <div class="grid g2 mb">${el.almost_eligible.map((e) => `<div class="card"><b>${esc(e.scholarship_name)}</b> <span class="muted">· ${inr(e.amount)}</span><div class="gap">⚠ ${esc(e.failed_reasons[0])}</div></div>`).join('') || empty('Nothing within reach right now')}</div>
  <h3>📎 Your consolidated document checklist <span class="novel">SMART CHECKLIST</span></h3>
  <p class="small muted">Prepare these once - they cover every scholarship you can still apply to.</p>
  <div class="card tw">${docs.length ? `<table><tr><th>Document</th><th>Needed for</th><th>Scholarships</th></tr>${docs.map((d) => `<tr><td><b>${esc(d.doc_name)}</b><br><span class="small muted">${esc(d.description)}</span></td><td>${d.needed_for}</td><td class="small">${d.scholarships.map(esc).join(', ')}</td></tr>`).join('')}</table>` : empty('No pending applications to prepare for')}</div>
  <h3 class="mt">❌ Not eligible (${el.not_eligible.length})</h3>
  <div class="card tw"><table>${el.not_eligible.map((e) => `<tr><td><b>${esc(e.scholarship_name)}</b></td><td class="small muted">${e.failed_reasons.map(esc).join(' · ')}</td></tr>`).join('')}</table></div>`;
};

pages.applications = async () => {
  const apps = await api('/applications/me');
  const stage = (a) => {
    const order = ['Submitted', 'Under Review', 'Approved'];
    const idx = a.status === 'Rejected' ? 1 : order.indexOf(a.status);
    return `<div class="steps">${['Submitted', 'Under Review', a.status === 'Rejected' ? 'Rejected' : 'Approved'].map((l, i) => `<div class="${l === 'Rejected' && i === 2 ? 'badx' : i < idx || (i === idx && l === 'Approved') ? 'good' : i === idx ? 'on' : ''}">${l}</div>`).join('')}</div>`;
  };
  return `<h2>My Applications</h2><p class="sub">Upload your documents and track every stage.</p>
  ${apps.map((a) => `<div class="card mb"><div class="row between"><div><h3 style="margin:0">${esc(a.scholarship_name)}</h3><span class="muted small">${esc(a.provider_name)} · ${inr(a.amount)} · applied ${fd(a.applied_on)}</span></div>${badge(a.status)}</div>
    ${stage(a)}${a.remarks ? `<div class="small muted">Officer remarks: ${esc(a.remarks)}</div>` : ''}
    <div class="tw mt"><table><tr><th>Document</th><th>File</th><th>Status</th><th></th></tr>${a.documents.map((d) => `<tr><td>${esc(d.doc_name)}</td><td class="small">${esc(d.file_name || '—')}</td><td>${badge(d.status)}</td>
      <td>${['Submitted', 'Under Review'].includes(a.status) && d.status !== 'Verified' ? `<label class="btn sm sec" style="display:inline-block;margin:0;cursor:pointer">${d.file_name ? 'Re-upload' : 'Upload'}<input type="file" hidden onchange="App.upload(${d.app_doc_id},this)"></label>` : ''}</td></tr>`).join('')}</table></div>
    ${a.award_id ? `<div class="gap" style="background:#f0fdf4;border-color:#16a34a">💰 Award <b>${inr(a.award_amount)}</b> via ${esc(a.payment_mode)} · ${badge(a.payment_status)} ${a.payment_date ? 'on ' + fd(a.payment_date) : ''} · Ref <code>${esc(a.transaction_ref)}</code></div>` : ''}
    <div class="row mt"><button class="btn sm sec" onclick="App.timeline(${a.application_id})">View timeline</button><button class="btn sm sec" onclick="App.reviewForm(${a.scholarship_id})">⭐ Rate this scholarship</button></div></div>`).join('') || empty('No applications yet. Visit <a href="#eligibility">My Eligibility</a> to get started.')}`;
};

pages.notifications = async () => {
  const n = await api('/notifications');
  return `<div class="row between"><div><h2>Notifications</h2><p class="sub">Stored in MongoDB.</p></div><button class="btn sm sec" onclick="App.readAll()">Mark all read</button></div>
  <div class="grid">${n.map((x) => `<div class="card" style="${x.read ? 'opacity:.65' : 'border-left:4px solid var(--primary)'}"><b>${esc(x.title)}</b> <span class="small muted">· ${fd(x.createdAt)}</span><div>${esc(x.message)}</div></div>`).join('') || empty('No notifications')}</div>`;
};

pages.profile = async () => {
  const p = await api('/students/me');
  return `<h2>My Profile</h2><p class="sub">Keep this updated - eligibility results change instantly when your CGPA, income or year changes.</p>
  <div class="card"><div class="form">${profileFields(p)}</div><button class="btn mt" onclick="App.saveProfile()">Save changes</button></div>`;
};

// ---------- STAFF pages ----------
pages.students = async () => {
  const r = await api('/students');
  return `<h2>Students</h2><p class="sub">${r.length} registered students</p><div class="card tw"><table><tr><th>Name</th><th>Email</th><th>Course</th><th>Year</th><th>CGPA</th><th>Income</th><th>Category</th><th>State</th><th>Apps</th></tr>
  ${r.map((s) => `<tr><td><b>${esc(s.full_name)}</b></td><td>${esc(s.email)}</td><td>${esc(s.course)}</td><td>${s.year_of_study}</td><td>${s.cgpa}</td><td>${inr(s.annual_income)}</td><td>${s.category}</td><td>${esc(s.state)}</td><td>${s.applications}</td></tr>`).join('')}</table></div>`;
};

pages.queue = async () => {
  const q = await api('/verifier/queue?status=all');
  return `<h2>Application Review Queue</h2><p class="sub">Verify documents, then approve or reject. Approval is blocked by a database trigger until every document is verified.</p>
  <div class="card tw"><table><tr><th>#</th><th>Student</th><th>Scholarship</th><th>Docs</th><th>Status</th><th></th></tr>
  ${q.map((a) => `<tr><td>${a.application_id}</td><td><b>${esc(a.full_name)}</b><br><span class="small muted">${esc(a.course)} · CGPA ${a.cgpa} · ${inr(a.annual_income)}</span></td><td>${esc(a.scholarship_name)}<br><span class="small muted">${inr(a.amount)}</span></td>
   <td>${a.verified_docs}/${a.total_docs} verified${a.pending_docs ? `<br><span class="small muted">${a.pending_docs} awaiting check</span>` : ''}</td><td>${badge(a.status)}</td><td><button class="btn sm" onclick="App.reviewModal(${a.application_id})">${['Approved', 'Rejected'].includes(a.status) ? 'View' : 'Review'}</button></td></tr>`).join('')}</table></div>`;
};

pages.awards = async () => {
  const a = await api('/verifier/awards');
  return `<h2>Award Management</h2><p class="sub">Approved scholarship amounts and payment details.</p><div class="card tw"><table><tr><th>Ref</th><th>Student</th><th>Scholarship</th><th>Amount</th><th>Mode</th><th>Status</th><th></th></tr>
  ${a.map((x) => `<tr><td><code>${esc(x.transaction_ref)}</code></td><td>${esc(x.full_name)}</td><td>${esc(x.scholarship_name)}</td><td><b>${inr(x.amount)}</b></td><td>${esc(x.payment_mode)}</td><td>${badge(x.payment_status)} ${x.payment_date ? '<span class="small muted">' + fd(x.payment_date) + '</span>' : ''}</td>
  <td>${x.payment_status === 'Pending' && S.user.role !== 'sysadmin' ? `<button class="btn sm ok" onclick="App.pay(${x.award_id})">Mark paid</button>` : ''}</td></tr>`).join('')}</table></div>`;
};

pages.reports = async () => {
  const get = (p) => api('/reports/' + p);
  const [sum, stats, status, course, prov, cat, type, month, dl] = await Promise.all(['summary', 'application-stats', 'status-breakdown', 'avg-by-course', 'provider-distribution', 'category-distribution', 'type-distribution', 'monthly-applications', 'deadlines'].map(get));
  return `<h2>Reports & Analytics</h2><p class="sub">Every figure below comes from SQL views, aggregate functions and joins.</p>
  <div class="grid g4 mb">${[['Students', sum.students], ['Active scholarships', sum.scholarships], ['Applications', sum.applications], ['Pending review', sum.pending], ['Awards given', sum.awards], ['Total awarded', inr(sum.total_awarded)], ['Approval rate', sum.approval_rate + '%']].map(([l, n]) => `<div class="card stat"><span class="n">${n}</span><span class="l">${l}</span></div>`).join('')}</div>
  <div class="grid g2 mb">
   <div class="card"><h3>Applications by status</h3>${bars(status, 'status', 'count')}</div>
   <div class="card"><h3>Applications per month</h3>${bars(month, 'month', 'applications')}</div>
   <div class="card"><h3>Average CGPA by course</h3>${bars(course, 'course', 'avg_cgpa')}<div class="tw mt"><table><tr><th>Course</th><th>Students</th><th>Avg CGPA</th><th>Avg income</th></tr>${course.map((c) => `<tr><td>${esc(c.course)}</td><td>${c.students}</td><td>${c.avg_cgpa}</td><td>${inr(c.avg_income)}</td></tr>`).join('')}</table></div></div>
   <div class="card"><h3>Amount awarded by provider</h3>${bars(prov, 'provider_name', 'total_awarded', inr)}</div>
   <div class="card"><h3>Awards by student category</h3>${bars(cat, 'category', 'total_awarded', inr)}</div>
   <div class="card"><h3>Awards by scholarship type</h3>${bars(type, 'scholarship_type', 'total_awarded', inr)}</div></div>
  <div class="card tw mb"><h3>Approval rate per scholarship</h3><table><tr><th>Scholarship</th><th>Provider</th><th>Total</th><th>Submitted</th><th>Review</th><th>Approved</th><th>Rejected</th><th>Approval %</th></tr>
   ${stats.map((s) => `<tr><td><b>${esc(s.scholarship_name)}</b></td><td class="small">${esc(s.provider_name)}</td><td>${s.total_applications}</td><td>${s.submitted}</td><td>${s.under_review}</td><td>${s.approved}</td><td>${s.rejected}</td><td>${s.approval_rate ?? '—'}</td></tr>`).join('')}</table></div>
  <div class="card tw"><h3>Deadline tracking</h3><table><tr><th>Scholarship</th><th>Provider</th><th>Deadline</th><th>Days left</th><th>Status</th><th>Applications</th></tr>
   ${dl.map((d) => `<tr><td><b>${esc(d.name)}</b></td><td class="small">${esc(d.provider_name)}</td><td>${fd(d.deadline)}</td><td>${d.days_left}</td><td>${badge(d.deadline_status)}</td><td>${d.applications}</td></tr>`).join('')}</table></div>`;
};

pages.manage = async () => {
  const rows = await api('/admin/scholarships'); window._sch = rows;
  return `<div class="row between"><div><h2>Manage Scholarships</h2><p class="sub">Create scholarships, set eligibility criteria, required documents and deadlines.</p></div><button class="btn" onclick="App.schForm()">+ New scholarship</button></div>
  <div class="card tw"><table><tr><th>Scholarship</th><th>Amount</th><th>Window</th><th>Min CGPA</th><th>Max income</th><th>Apps</th><th>Active</th><th></th></tr>
  ${rows.map((s) => `<tr><td><b>${esc(s.name)}</b><br><span class="small muted">${esc(s.provider_name)} · ${s.scholarship_type}</span></td><td>${inr(s.amount)}</td><td class="small">${fd(s.application_start)} → ${fd(s.deadline)}</td><td>${s.min_cgpa}</td><td>${s.max_income ? inr(s.max_income) : 'None'}</td><td>${s.applications}</td>
  <td>${s.is_active ? badge('Active') : badge('Closed')}</td><td class="row"><button class="btn sm sec" onclick="App.schForm(${s.scholarship_id})">Edit</button><button class="btn sm ${s.is_active ? 'bad' : 'ok'}" onclick="App.toggle(${s.scholarship_id},${!s.is_active})">${s.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}</table></div>`;
};

pages.users = async () => {
  const u = await api('/admin/users');
  return `<div class="row between"><div><h2>User Management</h2><p class="sub">Create staff accounts and manage access.</p></div></div>
  <div class="card mb"><h3>Create staff user</h3><div class="form"><div class="f"><label>Email</label><input id="u_email"></div><div class="f"><label>Password</label><input id="u_pass" type="password"></div><div class="f"><label>Role</label><select id="u_role"><option>verifier</option><option>admin</option><option>sysadmin</option></select></div><div class="f"><label>&nbsp;</label><button class="btn" onclick="App.addUser()">Create</button></div></div></div>
  <div class="card tw"><table><tr><th>ID</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr>${u.map((x) => `<tr><td>${x.user_id}</td><td>${esc(x.email)}</td><td><span class="tag">${x.role}</span></td><td>${fd(x.created_at)}</td><td>${x.user_id === S.user.id ? '' : `<button class="btn sm bad" onclick="App.delUser(${x.user_id})">Delete</button>`}</td></tr>`).join('')}</table></div>`;
};

pages.health = async () => {
  const h = await api('/admin/system-health');
  const box = (o) => Object.entries(o).map(([k, v]) => `<div class="bar-row" style="grid-template-columns:1fr 60px"><span>${k}</span><b style="text-align:right">${v}</b></div>`).join('');
  return `<h2>Database Health</h2><p class="sub">Row / document counts across both databases.</p>
  <div class="grid g2"><div class="card"><h3>🐘 PostgreSQL (relational)</h3>${box(h.postgres)}<div class="gap" style="background:#f0fdf4;border-color:#16a34a">Orphan applications: <b>${h.orphan_applications}</b> (integrity OK when 0)</div></div>
  <div class="card"><h3>🍃 MongoDB (NoSQL)</h3>${box(h.mongo)}</div></div>`;
};

pages.logs = async () => {
  const l = await api('/admin/logs?limit=150');
  return `<h2>Activity Log</h2><p class="sub">Append-only audit trail stored in MongoDB.</p><div class="card tw"><table><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Details</th></tr>
  ${l.map((x) => `<tr><td class="small">${new Date(x.createdAt).toLocaleString('en-IN')}</td><td>${x.userId ?? '—'}</td><td>${esc(x.role)}</td><td><span class="tag">${esc(x.action)}</span></td><td>${esc(x.entity || '')} ${x.entityId ?? ''}</td><td class="small muted">${esc(JSON.stringify(x.details || {}))}</td></tr>`).join('') || '<tr><td colspan="6">No activity yet</td></tr>'}</table></div>`;
};

// ---------- actions ----------
const App = {
  closeModal() { $('#modal').classList.add('hidden'); },
  modal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); },
  logout() { localStorage.clear(); S.token = null; S.user = null; location.hash = ''; authView(); },

  login: () => run(async () => {
    const d = await api('/auth/login', 'POST', { email: val('l_email'), password: val('l_pass') });
    App.start(d);
  }),
  register: () => run(async () => {
    const d = await api('/auth/register', 'POST', { email: val('r_email'), password: val('r_pass'), ...readProfile() });
    App.start(d);
  }),
  start(d) {
    S.token = d.token; S.user = d.user; localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
    location.hash = MENU[d.user.role][0][0]; route();
  },

  filter: () => run(async () => {
    const q = new URLSearchParams();
    [['q', 'f_q'], ['course', 'f_course'], ['state', 'f_state'], ['category', 'f_cat'], ['gender', 'f_gender'], ['income', 'f_inc'], ['type', 'f_type'], ['status', 'f_status']].forEach(([k, id]) => { const v = val(id); if (v) q.set(k, v); });
    const r = await api('/scholarships?' + q);
    const el = $('#sch-list'); if (el) el.innerHTML = r.map(schCard).join('') || empty('No scholarships match these filters');
  }),

  detail: (id) => run(async () => {
    const s = await api('/scholarships/' + id); const c = s.criteria || {}; const x = s.extra || {};
    const crit = [`Min CGPA: <b>${c.min_cgpa}</b>`, c.max_income ? `Max family income: <b>${inr(c.max_income)}</b>` : 'No income limit', `Years: ${c.min_year}-${c.max_year}`,
      c.allowed_categories ? `Categories: <b>${c.allowed_categories.join(', ')}</b>` : 'All categories', c.allowed_genders ? `Gender: <b>${c.allowed_genders.join(', ')}</b>` : 'All genders',
      c.allowed_states ? `States: <b>${c.allowed_states.join(', ')}</b>` : 'All states', c.allowed_courses ? `Courses: <b>${c.allowed_courses.join(', ')}</b>` : 'All courses',
      c.disability_required ? 'Disability certificate required' : '', c.minority_required ? 'Minority community only' : ''].filter(Boolean);
    App.modal(`<div class="row">${badge(s.deadline_status)}<span class="tag">${s.scholarship_type}</span>${(x.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>
    <h2 style="margin-top:8px">${esc(s.name)}</h2><div class="muted">${esc(s.provider_name)} · ${esc(s.provider_type)}</div>
    <p>${esc(s.description)}</p><div class="row between"><b style="font-size:26px;color:var(--primary)">${inr(s.amount)}</b><span class="muted">${fd(s.application_start)} → ${fd(s.deadline)} (${s.days_left} days left)</span></div>
    <h3 class="mt">Eligibility criteria</h3><ul>${crit.map((i) => `<li>${i}</li>`).join('')}</ul>
    <h3>Required documents</h3><div>${s.documents.map((d) => `<span class="tag">${esc(d.doc_name)}</span>`).join('')}</div>
    ${x.howToApply?.length ? `<h3 class="mt">How to apply <span class="small muted">(MongoDB)</span></h3><ol>${x.howToApply.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}
    ${x.faqs?.length ? `<h3>FAQs</h3>${x.faqs.map((f) => `<p><b>${esc(f.q)}</b><br>${esc(f.a)}</p>`).join('')}` : ''}
    ${x.tips?.length ? `<div class="gap">💡 ${x.tips.map(esc).join(' ')}</div>` : ''}
    <h3 class="mt">Student reviews ${s.avg_rating ? `· ⭐ ${s.avg_rating}` : ''}</h3>${s.reviews.map((r) => `<p class="small"><b>${esc(r.studentName)}</b> ${'⭐'.repeat(r.rating)}<br>${esc(r.comment)}</p>`).join('') || '<p class="small muted">No reviews yet.</p>'}
    ${S.user.role === 'student' && s.deadline_status !== 'Upcoming' ? `<button class="btn mt" onclick="App.apply(${s.scholarship_id})">Apply for this scholarship</button>` : ''}`);
  }),

  apply: (id) => run(async () => {
    if (!confirm('Apply for this scholarship? Eligibility will be re-verified by the database.')) return;
    await api('/applications', 'POST', { scholarship_id: id });
    App.closeModal(); toast('Application submitted! Now upload your documents.', 'ok'); location.hash = 'applications';
  }),
  upload: (appDocId, input) => run(async () => {
    if (!input.files[0]) return;
    await api('/applications/documents/' + appDocId, 'POST', { file_name: input.files[0].name });
    toast('Document submitted for verification', 'ok'); route();
  }),
  timeline: (id) => run(async () => {
    const t = await api(`/applications/${id}/timeline`);
    App.modal(`<h2>Application #${id} timeline</h2><p class="sub">Status history is written automatically by a PostgreSQL trigger; actions come from MongoDB.</p>
      <h3>Status changes</h3><div class="tl">${t.status_history.map((h) => `<div>${h.old_status ? badge(h.old_status) + ' → ' : ''}${badge(h.new_status)}<br><span class="small muted">${new Date(h.changed_at).toLocaleString('en-IN')}</span></div>`).join('')}</div>
      <h3>Activity (MongoDB)</h3><div class="tl">${t.activity.map((a) => `<div><b>${esc(a.action)}</b><br><span class="small muted">${new Date(a.createdAt).toLocaleString('en-IN')}</span></div>`).join('') || '<div class="muted small">No logged activity</div>'}</div>`);
  }),
  reviewForm(id) {
    App.modal(`<h2>Rate this scholarship</h2><div class="form" style="grid-template-columns:1fr"><div class="f"><label>Rating</label><select id="rv_r"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></div>
      <div class="f"><label>Comment</label><textarea id="rv_c" rows="3"></textarea></div><button class="btn" onclick="App.saveReview(${id})">Submit review</button></div>`);
  },
  saveReview: (id) => run(async () => { await api(`/scholarships/${id}/reviews`, 'POST', { rating: +val('rv_r'), comment: val('rv_c') }); App.closeModal(); toast('Thanks for your review!', 'ok'); }),
  saveProfile: () => run(async () => { await api('/students/me', 'PUT', readProfile()); toast('Profile updated - eligibility recalculated', 'ok'); }),
  readAll: () => run(async () => { await api('/notifications/read-all', 'PATCH'); route(); }),

  // verifier
  reviewModal: (id) => run(async () => {
    const a = await api('/verifier/applications/' + id); const final = ['Approved', 'Rejected'].includes(a.status);
    const canAct = S.user.role === 'verifier' || S.user.role === 'admin';
    App.modal(`<h2>Application #${id}</h2><div class="row">${badge(a.status)}<b>${esc(a.scholarship_name)}</b><span class="muted">${inr(a.amount)}</span></div>
      <div class="card mt"><b>${esc(a.full_name)}</b><div class="small muted">${esc(a.course)} · Year ${a.year_of_study} · CGPA ${a.cgpa} · Income ${inr(a.annual_income)} · ${a.category} · ${esc(a.state)}</div></div>
      <h3 class="mt">Documents</h3><table>${a.documents.map((d) => `<tr><td>${esc(d.doc_name)}</td><td class="small">${esc(d.file_name || 'not submitted')}</td><td>${badge(d.verification_status)}</td>
        <td>${canAct && !final && d.file_name ? `<button class="btn sm ok" onclick="App.docVerify(${d.app_doc_id},'Verified',${id})">Verify</button> <button class="btn sm bad" onclick="App.docVerify(${d.app_doc_id},'Rejected',${id})">Reject</button>` : ''}</td></tr>`).join('')}</table>
      ${a.remarks ? `<p class="small muted">Remarks: ${esc(a.remarks)}</p>` : ''}
      ${canAct && !final ? `<div class="form mt"><div class="f"><label>Remarks</label><input id="rm" placeholder="Optional note to the student"></div><div class="f"><label>Payment mode (if approved)</label><select id="pm"><option>DBT</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option></select></div></div>
      <div class="row mt"><button class="btn warn" onclick="App.decide(${id},'Under Review')">Mark under review</button><button class="btn ok" onclick="App.decide(${id},'Approved')">Approve</button><button class="btn bad" onclick="App.decide(${id},'Rejected')">Reject</button></div>` : ''}`);
  }),
  docVerify: (docId, status, appId) => run(async () => { await api('/verifier/documents/' + docId, 'PATCH', { status }); App.reviewModal(appId); }),
  decide: (id, status) => run(async () => {
    await api(`/verifier/applications/${id}/review`, 'POST', { status, remarks: val('rm'), payment_mode: val('pm') });
    App.closeModal(); toast('Application marked ' + status, 'ok'); route();
  }),
  pay: (id) => run(async () => { await api(`/verifier/awards/${id}/pay`, 'PATCH'); toast('Marked as paid', 'ok'); route(); }),

  // admin
  toggle: (id, on) => run(async () => { await api(`/admin/scholarships/${id}/active`, 'PATCH', { is_active: on }); route(); }),
  schForm: (id) => run(async () => {
    const [prov, docs] = await Promise.all([api('/admin/providers'), api('/admin/document-types')]);
    const s = id ? window._sch.find((x) => x.scholarship_id === id) : { min_cgpa: 0, min_year: 1, max_year: 6, document_ids: [3, 4, 5], scholarship_type: 'Merit' };
    const cb = (name, arr, sel) => arr.map((o) => `<label class="chk"><input type="checkbox" name="${name}" value="${o}" ${sel?.includes(o) ? 'checked' : ''}>${o}</label>`).join('');
    App.modal(`<h2>${id ? 'Edit' : 'New'} scholarship</h2><div class="form">
      <div class="f"><label>Name</label><input id="s_name" value="${esc(s.name)}"></div>
      <div class="f"><label>Provider</label><select id="s_prov">${prov.map((p) => `<option value="${p.provider_id}" ${p.provider_id === s.provider_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="f"><label>Amount (₹)</label><input id="s_amt" type="number" value="${s.amount ?? ''}"></div>
      <div class="f"><label>Type</label><select id="s_type">${opt(TYPES, s.scholarship_type)}</select></div>
      <div class="f"><label>Applications open</label><input id="s_start" type="date" value="${s.application_start ?? ''}"></div>
      <div class="f"><label>Deadline</label><input id="s_dead" type="date" value="${s.deadline ?? ''}"></div></div>
      <div class="f mt"><label>Description</label><textarea id="s_desc" rows="2">${esc(s.description)}</textarea></div>
      <h3 class="mt">Eligibility criteria <span class="small muted">(leave blank / unticked = no restriction)</span></h3><div class="form">
      <div class="f"><label>Min CGPA</label><input id="c_cgpa" type="number" step="0.1" value="${s.min_cgpa ?? 0}"></div>
      <div class="f"><label>Max family income (₹)</label><input id="c_inc" type="number" value="${s.max_income ?? ''}"></div>
      <div class="f"><label>Min year</label><input id="c_miny" type="number" value="${s.min_year ?? 1}"></div>
      <div class="f"><label>Max year</label><input id="c_maxy" type="number" value="${s.max_year ?? 6}"></div>
      <div class="f"><label>Allowed states (comma separated)</label><input id="c_states" value="${esc((s.allowed_states || []).join(', '))}"></div>
      <div class="f"><label>Allowed courses (comma separated)</label><input id="c_courses" value="${esc((s.allowed_courses || []).join(', '))}"></div></div>
      <div class="mt"><label>Categories</label><div class="chips">${cb('c_cat', CATEGORIES, s.allowed_categories)}</div></div>
      <div class="mt"><label>Genders</label><div class="chips">${cb('c_gen', GENDERS, s.allowed_genders)}</div></div>
      <div class="chips mt"><label class="chk"><input type="checkbox" id="c_dis" ${s.disability_required ? 'checked' : ''}> Disability required</label><label class="chk"><input type="checkbox" id="c_minr" ${s.minority_required ? 'checked' : ''}> Minority only</label></div>
      <div class="mt"><label>Required documents</label><div class="chips">${docs.map((d) => `<label class="chk"><input type="checkbox" name="s_docs" value="${d.doc_type_id}" ${(s.document_ids || []).includes(d.doc_type_id) ? 'checked' : ''}>${esc(d.doc_name)}</label>`).join('')}</div></div>
      <button class="btn mt" onclick="App.saveSch(${id || 'null'})">Save scholarship</button>`);
  }),
  saveSch: (id) => run(async () => {
    const body = { name: val('s_name'), provider_id: +val('s_prov'), amount: +val('s_amt'), scholarship_type: val('s_type'), application_start: val('s_start'), deadline: val('s_dead'), description: val('s_desc'),
      document_ids: chk('s_docs').map(Number),
      criteria: { min_cgpa: +val('c_cgpa'), max_income: val('c_inc') || null, min_year: +val('c_miny'), max_year: +val('c_maxy'), allowed_states: list(val('c_states')), allowed_courses: list(val('c_courses')),
        allowed_categories: chk('c_cat'), allowed_genders: chk('c_gen'), disability_required: $('#c_dis').checked, minority_required: $('#c_minr').checked } };
    await api(id ? '/admin/scholarships/' + id : '/admin/scholarships', id ? 'PUT' : 'POST', body);
    App.closeModal(); toast('Scholarship saved', 'ok'); route();
  }),

  // sysadmin
  addUser: () => run(async () => { await api('/admin/users', 'POST', { email: val('u_email'), password: val('u_pass'), role: val('u_role') }); toast('User created', 'ok'); route(); }),
  delUser: (id) => run(async () => { if (confirm('Delete this user?')) { await api('/admin/users/' + id, 'DELETE'); route(); } }),
};
window.App = App;
route();
