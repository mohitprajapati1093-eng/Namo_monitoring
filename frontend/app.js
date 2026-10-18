/* Namo Monitoring — plain JavaScript frontend. No React, JSX, or component framework. */
const API_BASE = String(window.NAMO_API_BASE || '').replace(/\/$/, '');
const TOKEN_KEY = 'namo_monitoring_token';
const USER_KEY = 'namo_monitoring_user';
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const state = { user:null, page:'Overview', data:null, demoAccounts:[], busy:false, toast:'' };
const roles = { admin:'District Administrator', manager:'Facility Manager', pharmacy:'Pharmacist / Storekeeper', staff:'Clinical / Operations Staff' };
const icon = { overview:'◫', inventory:'▦', operations:'⌂', insights:'✳', redistribution:'⇄', interventions:'✓', workflow:'☷', logout:'↪', alert:'!', search:'⌕' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('en-IN').format(Number(value)||0);
const date = value => value ? new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
const statusClass = value => ({Critical:'critical',High:'high',Medium:'medium',Low:'low',Healthy:'healthy',Pending:'pending',Approved:'healthy',Resolved:'healthy','In progress':'info'})[value] || 'neutral';
const token = () => localStorage.getItem(TOKEN_KEY) || '';
async function api(path, options={}) {
  const headers = { ...(options.headers||{}) };
  if (token()) headers.Authorization = 'Bearer ' + token();
  if (options.body && !headers['Content-Type']) headers['Content-Type']='application/json';
  const response = await fetch(API_BASE + path, {...options, headers});
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body && body.error ? body.error : 'Request failed ('+response.status+').');
  if (typeof body === 'string') throw new Error('API returned a page instead of JSON. Check the API URL and backend deployment.');
  return body;
}
function notify(message, error=false) {
  const old = $('.toast'); if (old) old.remove();
  const el=document.createElement('div'); el.className='toast'+(error?' toast-error':''); el.textContent=message; document.body.append(el);
  setTimeout(()=>el.remove(),4200);
}
function mark(value) { return '<span class="status '+statusClass(value)+'">'+esc(value||'Unknown')+'</span>'; }
function button(label, action, cls='button') { return '<button class="'+cls+'" data-action="'+esc(action)+'">'+label+'</button>'; }
function logo(size='') { return '<img class="brand-logo '+size+'" src="./namo-monitoring-mark.svg" alt="Namo Monitoring">'; }

async function start() {
  $('#app').innerHTML='<main class="loading-screen">'+logo()+'<p>Connecting to the Namo Monitoring API…</p></main>';
  try {
    const health=await api('/api/health');
    state.apiStatus=health.status==='ok'?'connected':'offline';
    const savedUser=localStorage.getItem(USER_KEY);
    if(token() && savedUser) {
      try { const result=await api('/api/auth/me'); state.user=result.user; await loadWorkspace(); return; }
      catch { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
    }
    await loadDemoAccounts();
    renderLogin();
  } catch(error) {
    state.apiStatus='offline'; await loadDemoAccounts().catch(()=>{});
    renderLogin(error.message);
  }
}
async function loadDemoAccounts() {
  try { const result=await api('/api/auth/demo-accounts'); state.demoAccounts=result.accounts||[]; } catch { state.demoAccounts=[]; }
}
function renderLogin(error='') {
  $('#app').innerHTML='<section class="auth-page"><div class="auth-brand">'+logo('auth-logo')+'<h1>Namo Monitoring</h1><p>Health Facility Operations &amp; Supply Chain Monitoring</p></div><form class="auth-card" id="login-form"><div class="eyebrow">DISTRICT WORKSPACE</div><h2>Welcome back</h2><p class="muted">Sign in with an approved account to open your workspace.</p><label>Email address<input name="email" type="email" autocomplete="username" value="district.admin@demo.local" required></label><label>Password<input name="password" type="password" autocomplete="current-password" value="Demo@12345" required></label><div class="form-error" id="login-error">'+esc(error||'')+'</div><button class="button button-primary full-width" type="submit">Sign in <span>→</span></button><div class="connection-note '+(state.apiStatus==='connected'?'online':'offline')+'"><i></i>'+(state.apiStatus==='connected'?'API reachable':'API offline — start the backend or configure NAMO_API_BASE')+'</div></form>'+(state.demoAccounts.length?'<section class="demo-box"><h3>Demo accounts</h3><p>Prototype only · password for all accounts: <code>Demo@12345</code></p><div class="demo-list">'+state.demoAccounts.map(a=>'<button type="button" class="demo-item" data-email="'+esc(a.email)+'" data-password="'+esc(a.password)+'"><span>'+esc(a.role)+'</span><b>'+esc(a.email)+'</b></button>').join('')+'</div></section>':'')+'<p class="auth-disclaimer">Synthetic demo data only. Do not enter patient-identifying information.</p></section>';
}
async function loadWorkspace() {
  try { state.data=await api('/api/bootstrap'); state.user=state.data.user||state.user; state.apiStatus='connected'; renderApp(); }
  catch(error) { state.apiStatus='offline'; renderLogin(error.message); }
}
const nav = [
  ['Overview','overview','WORKSPACE'],['Medicine inventory','inventory','WORKSPACE'],['Facility operations','operations','WORKSPACE'],
  ['AI insights','insights','INTELLIGENCE'],['Redistribution','redistribution','INTELLIGENCE'],['Interventions','interventions','MANAGEMENT'],['Workflow inbox','workflow','MANAGEMENT']
];
function allowedNav() {
  if(state.user?.role===roles.pharmacy) return nav.filter(n=>['Overview','Medicine inventory','AI insights','Redistribution','Workflow inbox'].includes(n[0]));
  if(state.user?.role===roles.staff) return nav.filter(n=>['Overview','Facility operations','AI insights','Workflow inbox'].includes(n[0]));
  return nav;
}
function renderApp() {
  const user=state.user||{}, data=state.data||{};
  const facilities=data.facilities||[], medicines=data.medicines||[], alerts=data.alerts||[], transfers=data.transfers||[], interventions=data.interventions||[];
  const initials=(user.name||'NM').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  $('#app').innerHTML='<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand-row">'+logo()+'<div><b>Namo Monitoring</b><small>HEALTH FACILITY OPERATIONS</small></div><button class="icon-button sidebar-close" data-action="close-menu">×</button></div><div class="district-chip"><span class="district-icon">⌂</span><div><b>'+esc(user.district||'District workspace')+' District</b><small>Madhya Pradesh, India</small></div></div><nav class="side-nav">'+['WORKSPACE','INTELLIGENCE','MANAGEMENT'].map(group=>'<div class="nav-group"><p>'+group+'</p>'+allowedNav().filter(n=>n[2]===group).map(n=>'<button class="nav-link '+(state.page===n[0]?'active':'')+'" data-page="'+esc(n[0])+'"><span class="nav-icon">'+icon[n[1]]+'</span><span>'+esc(n[0])+'</span>'+(n[0]==='Interventions'&&interventions.length?'<i class="nav-count">'+interventions.filter(x=>x.status!=='Resolved').length+'</i>':'')+'</button>').join('')+'</div>').join('')+(user.role===roles.admin?'<button class="nav-link" data-page="User access"><span class="nav-icon">♙</span><span>User access</span></button>':'')+'</nav><div class="sidebar-bottom"><div class="safety-note"><b>Prototype environment</b><p>Records are synthetic and stored in the local JSON database.</p></div><button class="profile-row" data-action="logout"><span class="avatar">'+esc(initials)+'</span><span class="profile-text"><b>'+esc(user.name)+'</b><small>'+esc(user.role)+'</small></span><span class="logout-icon">↪</span></button></div></aside><div class="mobile-scrim" data-action="close-menu"></div><main class="main-area"><header class="topbar"><div class="crumbs"><button class="icon-button mobile-menu" data-action="open-menu">☰</button><span>District workspace</span><span>›</span><b>'+esc(state.page)+'</b></div><div class="top-actions"><span class="api-pill '+(state.apiStatus==='connected'?'online':'offline')+'"><i></i>'+(state.apiStatus==='connected'?'API connected':'API offline')+'</span><button class="button button-quiet" data-action="refresh">↻ Refresh</button><span class="avatar top-avatar">'+esc(initials)+'</span></div></header><section class="page-content"><div class="welcome-strip"><div><span class="eyebrow">HEALTH OPERATIONS · DEMO</span><h1>'+esc(pageTitle())+'</h1><p>'+esc(pageDescription())+'</p></div><span class="date-chip">'+new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})+'</span></div><div id="page-view">'+renderPageContent()+'</div><footer class="footer"><span>Namo Monitoring · Prototype</span><span>Illustrative data only</span></footer></section></main></div>';
}
function pageTitle() { return ({Overview:'District command centre','Medicine inventory':'Medicine inventory','Facility operations':'Facility operations','AI insights':'Stock intelligence','Redistribution':'Redistribution','Interventions':'Interventions','Workflow inbox':'Workflow inbox','User access':'User access'})[state.page]||state.page; }
function pageDescription() { return ({Overview:'A clear view of facility readiness, stock risk, and actions that need attention.','Medicine inventory':'Review stock balances, expiry risk, and recorded medicine movements.','Facility operations':'Review facility capacity and submit operational reports.','AI insights':'Rule-based stock risk signals and replenishment priorities.','Redistribution':'Review transfers and coordinate safe redistribution.','Interventions':'Assign owners and follow issues through verified closure.','Workflow inbox':'Review reports, requests, and operational handoffs.','User access':'Review account access requests in your district.'})[state.page]||'Operational visibility for your authorized district scope.'; }
function renderPageContent() {
  const d=state.data||{}, fs=d.facilities||[], ms=d.medicines||[], alerts=d.alerts||[], tx=d.transactions||[], transfers=d.transfers||[], interventions=d.interventions||[];
  if(state.page==='Overview') {
    const risk=ms.filter(m=>['Critical','Low stock','High'].includes(m.status)).length;
    return '<div class="metric-grid">'+metric('Facilities in view',fs.length,'Assigned district scope','teal')+metric('Medicine records',ms.length,'Loaded inventory records','blue')+metric('Stock risk items',risk,'Require review','amber')+metric('Open interventions',interventions.filter(x=>x.status!=='Resolved').length,'Not yet resolved','violet')+'</div><div class="content-grid"><section class="panel span-two"><div class="panel-head"><div><h2>Facility snapshot</h2><p>Capacity and service readiness from the demo database.</p></div>'+button('View operations','page:Facility operations','button button-quiet')+'</div>'+facilityTable(fs)+'</section><section class="panel"><div class="panel-head"><div><h2>Priority alerts</h2><p>Items to review first.</p></div></div>'+(alerts.length?'<div class="alert-list">'+alerts.slice(0,6).map(a=>'<article class="alert-item"><span class="alert-mark">'+(a.severity==='Critical'?'!':'•')+'</span><div><b>'+esc(a.title||a.detail||'Stock alert')+'</b><small>'+esc(a.facility||'Facility')+' · '+esc(a.severity||'Review')+'</small></div></article>').join('')+'</div>':'<div class="empty-state">No priority alerts in your current scope.</div>')+'</section></div>';
  }
  if(state.page==='Medicine inventory') return '<section class="panel"><div class="panel-head"><div><h2>Inventory records</h2><p>Stock quantities and thresholds from the API.</p></div><input class="search-input" id="inventory-search" placeholder="Search medicine or facility…"></div><div id="inventory-table">'+medicineTable(ms)+'</div></section><section class="panel"><div class="panel-head"><div><h2>Record stock movement</h2><p>Transactions are validated and saved by the backend.</p></div></div><form id="stock-form" class="form-grid"><label>Medicine<select name="medicineId" required>'+ms.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.facility)+'</option>').join('')+'</select></label><label>Transaction<select name="action"><option>Receive stock</option><option>Issue stock</option><option>Record wastage</option><option>Record expiry</option><option>Increase adjustment</option><option>Decrease adjustment</option></select></label><label>Quantity<input name="quantity" type="number" min="1" step="1" required></label><label>Note<input name="note" maxlength="500" placeholder="Optional reference"></label><div class="form-actions"><button class="button button-primary">Save transaction</button></div></form></section>';
  if(state.page==='Facility operations') return '<section class="panel"><div class="panel-head"><div><h2>Facilities</h2><p>Current operational snapshot.</p></div></div>'+facilityTable(fs)+'</section><section class="panel"><div class="panel-head"><div><h2>Submit operations report</h2><p>Send a facility observation for review.</p></div></div><form id="report-form" class="form-grid"><label>Facility<select name="facilityId" required>'+fs.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('')+'</select></label><label>Report type<select name="type"><option value="footfall">Patient footfall</option><option value="beds">Bed occupancy</option><option value="attendance">Staff attendance</option><option value="diagnostics">Diagnostics</option></select></label><label>Primary value<input name="value" type="number" min="0" required></label><label>Note<input name="note" maxlength="500" placeholder="Context / follow-up"></label><div class="form-actions"><button class="button button-primary">Submit report</button></div></form></section><section class="panel"><div class="panel-head"><h2>Recent reports</h2></div>'+simpleTable(d.operationsReports||[],[['facility','Facility'],['type','Type'],['status','Status'],['createdAt','Submitted']])+'</section>';
  if(state.page==='AI insights') return '<div class="metric-grid">'+metric('Critical / high risk',ms.filter(m=>['Critical','High'].includes(m.status)).length,'Based on stock rules','amber')+metric('Below reorder level',ms.filter(m=>Number(m.stock)<Number(m.reorder)).length,'Check replenishment','red')+metric('Transactions loaded',tx.length,'Visible ledger entries','blue')+'</div><section class="panel"><div class="panel-head"><div><h2>Stock risk review</h2><p>Transparent rule-based indicators; not a validated predictive model.</p></div></div>'+medicineTable(ms.filter(m=>m.status!=='Healthy'))+'</section>';
  if(state.page==='Redistribution') return '<section class="panel"><div class="panel-head"><div><h2>Transfer queue</h2><p>Approve only after checking donor reserve and destination need.</p></div></div>'+simpleTable(transfers,[['medicineName','Medicine'],['source','Source'],['destination','Destination'],['requested','Quantity'],['status','Status']])+'</section>';
  if(state.page==='Interventions') return '<section class="panel"><div class="panel-head"><div><h2>Intervention register</h2><p>Track an owner, deadline, progress, and closure evidence.</p></div></div>'+simpleTable(interventions,[['facility','Facility'],['issue','Issue'],['severity','Severity'],['owner','Owner'],['due','Due'],['status','Status']])+'</section><section class="panel"><div class="panel-head"><div><h2>Create intervention</h2><p>Available to district administrators and facility managers.</p></div></div><form id="intervention-form" class="form-grid"><label>Facility<select name="facility" required>'+fs.map(f=>'<option>'+esc(f.name)+'</option>').join('')+'</select></label><label>Severity<select name="severity"><option>High</option><option>Critical</option><option>Medium</option><option>Low</option></select></label><label>Issue<input name="issue" minlength="4" maxlength="300" required></label><label>Owner<input name="owner" maxlength="120" required></label><label>Due date / deadline<input name="due" required placeholder="e.g. 2026-10-25"></label><label>Note<input name="note" maxlength="500"></label><div class="form-actions"><button class="button button-primary">Create intervention</button></div></form></section>';
  if(state.page==='Workflow inbox') return '<div class="metric-grid">'+metric('Pending stock requests',(d.stockRequests||[]).filter(x=>x.status==='Pending').length,'Awaiting decision','amber')+metric('Operations reports',(d.operationsReports||[]).length,'Current scope','blue')+metric('Open interventions',interventions.filter(x=>x.status!=='Resolved').length,'Follow up','violet')+'</div><section class="panel"><div class="panel-head"><h2>Stock requests</h2></div>'+simpleTable(d.stockRequests||[],[['medicineName','Medicine'],['facility','Facility'],['quantity','Quantity'],['requestedBy','Requested by'],['status','Status']])+'</section><section class="panel"><div class="panel-head"><h2>Operations reports</h2></div>'+simpleTable(d.operationsReports||[],[['facility','Facility'],['type','Type'],['status','Status'],['createdAt','Submitted']])+'</section>';
  if(state.page==='User access') return '<section class="panel"><div class="panel-head"><div><h2>Pending access requests</h2><p>Only administrators can approve new accounts.</p></div></div><div id="users-table">Loading requests…</div></section>';
  return '<div class="empty-state">Choose a section from the navigation.</div>';
}
function metric(label,value,caption,tint) { return '<article class="metric-card"><div class="metric-label">'+esc(label)+'</div><div class="metric-value">'+esc(value)+'</div><div class="metric-caption"><span class="metric-dot '+tint+'"></span>'+esc(caption)+'</div></article>'; }
function facilityTable(items) { return items.length?'<div class="table-wrap"><table><thead><tr><th>Facility</th><th>District</th><th>Beds</th><th>Occupied</th><th>Footfall</th><th>Attendance</th></tr></thead><tbody>'+items.map(f=>'<tr><td><b>'+esc(f.name)+'</b><small>'+esc(f.id)+'</small></td><td>'+esc(f.district||'—')+'</td><td>'+fmt(f.beds)+'</td><td>'+fmt(f.occupied)+'</td><td>'+fmt(f.footfall)+'</td><td>'+fmt(f.attendance)+'%</td></tr>').join('')+'</tbody></table></div>':'<div class="empty-state">No facilities returned for this account.</div>'; }
function medicineTable(items) { return items.length?'<div class="table-wrap"><table><thead><tr><th>Medicine</th><th>Facility</th><th>Batch</th><th>Stock</th><th>Reorder</th><th>Expiry</th><th>Status</th></tr></thead><tbody>'+items.map(m=>'<tr data-medicine="'+esc((m.name+' '+m.facility+' '+m.batch).toLowerCase())+'"><td><b>'+esc(m.name)+'</b><small>'+esc(m.category||'Essential')+'</small></td><td>'+esc(m.facility)+'</td><td>'+esc(m.batch||'—')+'</td><td>'+fmt(m.stock)+' '+esc(m.unit||'units')+'</td><td>'+fmt(m.reorder)+'</td><td>'+esc(m.expiry||'—')+'</td><td>'+mark(m.status)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty-state">No matching medicine records.</div>'; }
function simpleTable(items,cols) { if(!items.length)return '<div class="empty-state">No records available in this scope.</div>';return '<div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'</tr></thead><tbody>'+items.map(row=>'<tr>'+cols.map(c=>'<td>'+(c[0]==='status'||c[0]==='severity'?mark(row[c[0]]):esc(c[0]==='createdAt'?date(row[c[0]]):row[c[0]]??'—'))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'; }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
async function refresh() { await loadWorkspace(); notify('Workspace refreshed.'); }
async function submitLogin(form) {
  const err=$('#login-error'); if(err)err.textContent='';
  const submit=$('button[type="submit"]',form); submit.disabled=true; submit.textContent='Signing in…';
  try { const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify(formObject(form))});localStorage.setItem(TOKEN_KEY,result.token);localStorage.setItem(USER_KEY,JSON.stringify(result.user));state.user=result.user;state.page='Overview';await loadWorkspace(); }
  catch(error) { if(err)err.textContent=error.message;submit.disabled=false;submit.innerHTML='Sign in <span>→</span>'; }
}
document.addEventListener('submit',async event=>{
  const form=event.target; if(!form.matches('form'))return;
  if(form.id==='login-form'){event.preventDefault();await submitLogin(form);return;}
  event.preventDefault();
  try {
    if(form.id==='stock-form') {
      const b=formObject(form); b.quantity=Number(b.quantity);
      await api('/api/stock-transactions',{method:'POST',body:JSON.stringify(b)}); await refresh(); notify('Stock movement saved.');
    } else if(form.id==='report-form') {
      const b=formObject(form); b.values={count:Number(b.value),total:Number(b.value),occupied:Number(b.value),present:Number(b.value),available:Number(b.value)};delete b.value;
      await api('/api/operations-reports',{method:'POST',body:JSON.stringify(b)}); await refresh(); notify('Operations report submitted.');
    } else if(form.id==='intervention-form') {
      const b=formObject(form); await api('/api/interventions',{method:'POST',body:JSON.stringify(b)}); await refresh(); notify('Intervention created.');
    }
  } catch(error) { notify(error.message,true); }
});
document.addEventListener('click',async event=>{
  const demo=event.target.closest('[data-email]'); if(demo){const form=$('#login-form');if(form){form.email.value=demo.dataset.email;form.password.value=demo.dataset.password;}return;}
  const page=event.target.closest('[data-page]');if(page){state.page=page.dataset.page;renderApp();if(state.page==='User access')loadUsers();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='logout'){try{await api('/api/auth/logout',{method:'POST'});}catch{}localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);state.user=null;state.data=null;state.page='Overview';await loadDemoAccounts();renderLogin();return;}
  if(action==='refresh'){await refresh().catch(e=>notify(e.message,true));return;}
  if(action==='open-menu'){$('#sidebar')?.classList.add('open');$('.mobile-scrim')?.classList.add('visible');return;}
  if(action==='close-menu'){$('#sidebar')?.classList.remove('open');$('.mobile-scrim')?.classList.remove('visible');return;}
  if(action?.startsWith('page:')){state.page=action.slice(5);renderApp();}
});
document.addEventListener('input',event=>{
  if(event.target.id==='inventory-search'){const q=event.target.value.toLowerCase();$$('[data-medicine]').forEach(row=>row.hidden=!row.dataset.medicine.includes(q));}
});
async function loadUsers() {
  const target=$('#users-table');if(!target)return;
  try {const users=await api('/api/auth/users');target.innerHTML=simpleTable(users,[['name','Name'],['email','Email'],['role','Role'],['status','Status']]);}
  catch(error){target.innerHTML='<div class="empty-state">'+esc(error.message)+'</div>';}
}
start();
