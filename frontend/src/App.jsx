import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BrainCircuit,
  Building2, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, ClipboardCheck, Clock3, Download, Filter, FlaskConical, HeartPulse, Languages,
  LayoutDashboard, Menu, MoreHorizontal, Package, Plus, Search, Settings, ShieldAlert,
  Stethoscope, Truck, Users, X, Zap, MessageSquare, ClipboardList
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'


const ROLE_ADMIN = 'District Administrator'
const ROLE_MANAGER = 'Facility Manager'
const ROLE_PHARMACY = 'Pharmacist / Storekeeper'
const ROLE_OPERATIONS = 'Clinical / Operations Staff'
const apiFetch = (url, options={}) => fetch(url, {...options, headers:{...(options.headers||{}), ...(localStorage.getItem('swasthyagrid_token') ? {Authorization:`Bearer ${localStorage.getItem('swasthyagrid_token')}`} : {})}})

// Never let an HTML fallback page masquerade as a JSON API response. This gives
// the user a useful routing hint instead of the opaque `Unexpected token '<'`.
async function readApiJson(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await response.text()
    const preview = body.trim().slice(0, 80).replace(/\s+/g, ' ')
    throw new Error(`API returned ${response.status} ${response.url} as non-JSON (${contentType || 'unknown content type'}). Start the integrated server with npm run dev; if using the separate Vite server, ensure /api is proxied to localhost:3000. Response: ${preview}`)
  }
  return response.json()
}

const navItems = [
  { label:'Overview', icon:LayoutDashboard, group:'WORKSPACE' },
  { label:'Medicine inventory', icon:Package, group:'WORKSPACE' },
  { label:'Facility operations', icon:Building2, group:'WORKSPACE' },
  { label:'AI insights', icon:BrainCircuit, group:'INTELLIGENCE' },
  { label:'Redistribution', icon:Truck, group:'INTELLIGENCE' },
  { label:'Interventions', icon:ClipboardCheck, group:'MANAGEMENT' },
  { label:'Workflow inbox', icon:MessageSquare, group:'MANAGEMENT' }
]
const cx = (...xs) => xs.filter(Boolean).join(' ')
const fmt = n => new Intl.NumberFormat('en-IN').format(n)
const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
const riskClass = v => ({Critical:'critical',High:'high',Medium:'medium',Low:'low',Healthy:'healthy','Low stock':'low','Needs attention':'medium'})[v] || 'neutral'

function Status({ children }) { return <span className={`status ${riskClass(children)}`}><i />{children}</span> }
function Metric({ label, value, change, trend='up', icon:Icon, tint='teal', foot }) {
  return <div className="metric-card">
    <div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tint}`}><Icon size={18}/></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-bottom"><span className={`trend ${trend}`}><ArrowUpRight size={14}/>{change}</span><span className="metric-foot">{foot}</span></div>
  </div>
}
function SectionTitle({ eyebrow, title, description, action }) {
  return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
}
function EmptySearch({ term }) { return <div className="empty-state"><Search size={22}/><b>No results found</b><span>Try another search{term ? ` for “${term}”` : ''}.</span></div> }

function AuthScreen({mode='login',setMode=()=>{},form={},setForm=()=>{},error='',onSubmit=()=>{},accounts=[],loading=false}) {
  const [showPassword,setShowPassword]=useState(false)
  return <div className="auth-shell"><div className="auth-brand"><img className="auth-brand-logo" src="/namo-monitoring-mark.svg" alt="Namo Monitoring logo"/><strong>Namo Monitoring</strong><p>Health Facility Operations &amp; Supply Chain Monitoring</p></div><div className="auth-card"><div className="eyebrow">LOCAL PROTOTYPE · DEMO AUTH</div><h1>{loading?'Checking your session…':mode==='register'?'Request access':'Welcome back'}</h1><p>{loading?'Preparing your workspace.':'Secure your workspace with an approved demo account. New accounts require district administrator approval.'}</p>{!loading&&<form onSubmit={onSubmit} className="auth-form">{mode==='register'&&<label>Full name<input required minLength="2" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></label>}<label>Email address<input required type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input required minLength="8" type={showPassword?'text':'password'} value={form.password||''} onChange={e=>setForm({...form,password:e.target.value})}/></label>{mode==='register'&&<><label>Requested role<select value={form.role||ROLE_OPERATIONS} onChange={e=>setForm({...form,role:e.target.value})}>{[ROLE_MANAGER,ROLE_PHARMACY,ROLE_OPERATIONS].map(r=><option key={r}>{r}</option>)}</select></label><label>District<input required value={form.district||'Bhopal'} onChange={e=>setForm({...form,district:e.target.value})}/></label></>}<label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label>{error&&<div className="auth-message">{error}</div>}<button className="primary-button auth-submit" type="submit">{mode==='register'?'Submit access request':'Sign in'} <ArrowRight size={16}/></button></form>}{!loading&&<div className="auth-switch">{mode==='register'?'Already approved?':'Need an account?'} <button onClick={()=>{setMode(mode==='register'?'login':'register');}}>{mode==='register'?'Sign in':'Request access'}</button></div>}</div>{!loading&&<div className="demo-accounts"><b>Local demo accounts</b><span>For prototype testing only. Password for each account: <code>Demo@12345</code></span><div className="demo-account-list">{accounts.map(a=><button key={a.email} onClick={()=>{setMode('login');setForm({...form,email:a.email,password:a.password})}}><span>{a.role}</span><b>{a.email}</b><small>Use demo account</small></button>)}</div></div>}<div className="auth-foot">Synthetic demonstration data · Not for real patient information</div></div>
}
function AccessPage({users,onDecision,onRefresh}) { return <div className="page-stack"><SectionTitle eyebrow="DISTRICT ADMINISTRATION" title="User access" description="Approve or reject access requests from users in your district." action={<button className="secondary-button" onClick={onRefresh}>Refresh</button>}/><div className="table-card"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Requested role</th><th>Facility scope</th><th>Status</th><th>Decision</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{(u.facilityIds||[]).join(', ')||'District-wide'}</td><td><Status>{u.status==='approved'?'Healthy':u.status==='pending'?'Needs attention':'Critical'}</Status><small className="access-status">{u.status}</small></td><td>{u.status==='pending'?<div className="access-actions"><button onClick={()=>onDecision(u.id,'approve')}>Approve</button><button onClick={()=>onDecision(u.id,'reject')}>Reject</button></div>:'—'}</td></tr>)}</tbody></table>{!users.length&&<div className="empty-state">No users found in your district.</div>}</div></div><p className="muted-note">Demo access is stored locally in the JSON database. This prototype is not suitable for public deployment.</p></div>}

function WorkflowInbox({ user, facilities, medicines, issueReports, stockRequests, onCreateIssue, onUpdateIssue, onCommentIssue, onCreateStockRequest, onDecideStockRequest, onRefresh }) {
  const [tab,setTab]=useState('Issues')
  const [form,setForm]=useState({facilityId:user?.facilityIds?.[0]||facilities[0]?.id||'',title:'',description:'',category:'Operations',priority:'Medium'})
  const [request,setRequest]=useState({medicineId:medicines[0]?.id||'',quantity:'',reason:'Replenishment'})
  const [comment,setComment]=useState({})
  const canReviewRequests=[ROLE_ADMIN,ROLE_MANAGER].includes(user?.role)
  const canManageIssues=[ROLE_ADMIN,ROLE_MANAGER].includes(user?.role)
  return <div className="page-stack">
    <SectionTitle eyebrow="CROSS-ROLE WORKFLOWS" title="Workflow inbox" description="Reports and requests are shared with authorized roles in the same facility or district, so another responsible role can act on them." action={<button className="btn secondary" onClick={onRefresh}>Refresh queue</button>} />
    <div className="segmented-tabs"><button className={tab==='Issues'?'active':''} onClick={()=>setTab('Issues')}>Issue reports <span>{issueReports.filter(x=>x.status!=='Resolved'&&x.status!=='Rejected').length}</span></button><button className={tab==='Stock requests'?'active':''} onClick={()=>setTab('Stock requests')}>Stock requests <span>{stockRequests.filter(x=>x.status==='Pending').length}</span></button></div>
    {tab==='Issues'&&<>
      <section className="panel">
        <div className="panel-header"><div><h3>Report an operational issue</h3><p>Visible to authorized facility managers and district administrators; inventory-related issues can also be handled by the assigned pharmacist.</p></div></div>
        <form className="workflow-form" onSubmit={async e=>{e.preventDefault();const ok=await onCreateIssue(form);if(ok)setForm({...form,title:'',description:'',category:'Operations',priority:'Medium'})}}>
          <label>Facility<select required value={form.facilityId} onChange={e=>setForm({...form,facilityId:e.target.value})}>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Inventory','Service interruption','Beds','Staffing','Diagnostics','Patient flow','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['Low','Medium','High','Critical'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Issue title<input required minLength="4" maxLength="140" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Essential medicine shortage"/></label>
          <label className="workflow-wide">Details<textarea required minLength="5" maxLength="2000" rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what happened, what is affected, and what help is needed."/></label>
          <div className="workflow-wide"><button className="btn primary" type="submit"><Plus size={15}/> Submit issue report</button></div>
        </form>
      </section>
      <section className="panel"><div className="panel-header"><div><h3>Shared issue queue</h3><p>New entries appear here for other authorized roles after refresh or reloading the inbox.</p></div><span className="status neutral">{issueReports.length} reports</span></div>
        <div className="workflow-list">{issueReports.map(item=><article className="workflow-card" key={item.id}>
          <div className="workflow-card-top"><div><b>{item.title}</b><small>{item.id} · {item.facility} · Reported by {item.reporterName||'staff'} ({item.reporterRole||'role'})</small></div><Status>{item.status}</Status></div>
          <p>{item.description}</p><div className="workflow-meta"><Status>{item.priority}</Status><span>{item.category}</span><span>{new Date(item.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span>{item.assignedTo&&<span>Assigned: {item.assignedTo}</span>}</div>
          {item.comments?.length>0&&<div className="workflow-comments">{item.comments.map(c=><p key={c.id}><b>{c.userName} · {c.role}:</b> {c.message}</p>)}</div>}
          <form className="workflow-comment-form" onSubmit={async e=>{e.preventDefault();const value=comment[item.id]||'';if(await onCommentIssue(item.id,value))setComment({...comment,[item.id]:''})}}><input value={comment[item.id]||''} onChange={e=>setComment({...comment,[item.id]:e.target.value})} placeholder="Add an update or handoff note…" maxLength="1000"/><button className="btn secondary" type="submit" disabled={(comment[item.id]||'').trim().length<2}>Add update</button></form>
          {(canManageIssues||(user?.role===ROLE_PHARMACY&&['Inventory','Diagnostics'].includes(item.category)))&&item.status!=='Resolved'&&item.status!=='Rejected'&&<div className="workflow-actions"><label>Assign to<input defaultValue={item.assignedTo||''} id={`assignee-${item.id}`} placeholder="Name or role"/></label><button className="btn secondary" onClick={()=>onUpdateIssue(item.id,{status:'In progress',assignedTo:document.getElementById(`assignee-${item.id}`)?.value||''})}>Assign / start</button><button className="btn primary" onClick={()=>onUpdateIssue(item.id,{status:'Resolved',assignedTo:document.getElementById(`assignee-${item.id}`)?.value||''})}><Check size={14}/> Resolve</button></div>}
        </article>)}{issueReports.length===0&&<div className="empty-state"><ClipboardList size={22}/><b>No issue reports yet</b><span>Submit a report above. It will be available to the relevant authorized role.</span></div>}</div>
      </section>
    </>}
    {tab==='Stock requests'&&<>
      {![ROLE_OPERATIONS].includes(user?.role)&&<section className="panel"><div className="panel-header"><div><h3>Request replenishment</h3><p>Submitting a request does not add stock; a reviewer must decide and fulfillment is tracked separately.</p></div></div><form className="workflow-form" onSubmit={async e=>{e.preventDefault();if(await onCreateStockRequest(request))setRequest({...request,quantity:'',reason:'Replenishment'})}}><label>Medicine<select value={request.medicineId} onChange={e=>setRequest({...request,medicineId:e.target.value})}>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} · {m.facility}</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" required value={request.quantity} onChange={e=>setRequest({...request,quantity:e.target.value})}/></label><label className="workflow-wide">Reason<input required value={request.reason} onChange={e=>setRequest({...request,reason:e.target.value})}/></label><div className="workflow-wide"><button className="btn primary" type="submit"><Plus size={15}/> Submit stock request</button></div></form></section>}
      <section className="panel"><div className="panel-header"><div><h3>Shared replenishment queue</h3><p>Requesters can follow decisions; managers and district administrators can review requests in their authorized scope.</p></div><span className="status neutral">{stockRequests.length} requests</span></div><div className="workflow-list">{stockRequests.map(r=><article className="workflow-card" key={r.id}><div className="workflow-card-top"><div><b>{r.medicineName}</b><small>{r.id} · {r.facility} · Requested by {r.requestedBy}</small></div><Status>{r.status}</Status></div><p>Quantity: <b>{r.quantity}</b> · {r.reason}</p>{r.reviewNote&&<p>Reviewer note: {r.reviewNote}</p>}{canReviewRequests&&r.status==='Pending'&&<div className="workflow-actions"><button className="btn primary" onClick={()=>onDecideStockRequest(r.id,'approve')}>Approve request</button><button className="btn secondary" onClick={()=>onDecideStockRequest(r.id,'reject')}>Reject request</button></div>}</article>)}{stockRequests.length===0&&<div className="empty-state"><Package size={22}/><b>No stock requests</b><span>New requests will appear here for the responsible reviewer.</span></div>}</div></section>
    </>}
  </div>
}

export default function App() {
  const [page, setPage] = useState('Overview')
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({name:'',email:'district.admin@demo.local',password:'Demo@12345',role:ROLE_OPERATIONS,district:'Bhopal'})
  const [authError, setAuthError] = useState('')
  const [demoAccounts, setDemoAccounts] = useState([])
  const [accessUsers, setAccessUsers] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [lang, setLang] = useState('EN')
  const [facilities, setFacilities] = useState([])
  const [medicines, setMedicines] = useState([])
  const [transactions, setTransactions] = useState([])
  const [issueReports, setIssueReports] = useState([])
  const [stockRequests, setStockRequests] = useState([])
  const [operationsReports, setOperationsReports] = useState([])
  const [notifications, setNotifications] = useState([])
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [alertsData, setAlertsData] = useState([])
  const [transfers, setTransfers] = useState([])
  const [cases, setCases] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [apiStatus, setApiStatus] = useState('loading')
  const [modal, setModal] = useState(null)
  const [stockForm, setStockForm] = useState({medicine:'MED-001', action:'Receive stock', quantity:'50', note:''})
  const [activeFilter, setActiveFilter] = useState('All')
  const [facilityFilter, setFacilityFilter] = useState('All facilities')
  const [dashboardPrefs, setDashboardPrefs] = useState({ hidden: [], landingPage: 'Overview' })
  const [customizeDashboard, setCustomizeDashboard] = useState(false)

  useEffect(() => {
    if (!authUser) return
    try { const saved = JSON.parse(localStorage.getItem(`swasthyagrid_dashboard_${authUser.id || authUser.email}`) || '{}'); setDashboardPrefs({ hidden: Array.isArray(saved.hidden) ? saved.hidden : [], landingPage: saved.landingPage || 'Overview' }) } catch { setDashboardPrefs({ hidden: [], landingPage: 'Overview' }) }
  }, [authUser])
  const saveDashboardPrefs = next => { setDashboardPrefs(next); if (authUser) localStorage.setItem(`swasthyagrid_dashboard_${authUser.id || authUser.email}`, JSON.stringify(next)) }

  const notify = msg => { setToast(msg); window.setTimeout(() => setToast(''), 2800) }
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const [accountsRes] = await Promise.all([fetch('/api/auth/demo-accounts')])
        const accountsData = await readApiJson(accountsRes); if (!accountsRes.ok) throw new Error(accountsData.error || `Demo accounts request failed (${accountsRes.status})`); if (!cancelled) setDemoAccounts(accountsData.accounts || [])
        const token = localStorage.getItem('swasthyagrid_token')
        if (token) { const response = await apiFetch('/api/auth/me'); if (response.ok) { const data = await readApiJson(response); if (!cancelled) setAuthUser(data.user) } else localStorage.removeItem('swasthyagrid_token') }
      } catch { /* sign-in screen remains available and explains API status */ }
      if (!cancelled) setAuthReady(true)
    }
    start(); return () => { cancelled = true }
  }, [])
  const submitAuth = async e => {
    e.preventDefault(); setAuthError('')
    try {
      const url = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(authForm)})
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.error || 'Authentication failed')
      if (authMode === 'register') { setAuthError(data.message); setAuthMode('login'); return }
      localStorage.setItem('swasthyagrid_token', data.token); setAuthUser(data.user); setPage('Overview')
    } catch (error) { setAuthError(error.message || 'Could not connect to the local API.') }
  }
  const logout = async () => { try { await apiFetch('/api/auth/logout',{method:'POST'}) } catch {} localStorage.removeItem('swasthyagrid_token'); setAuthUser(null); setAccessUsers([]); setPage('Overview') }
  const loadAccessUsers = async () => { try { const r=await apiFetch('/api/auth/users'); const d=await readApiJson(r); if(!r.ok) throw new Error(d.error); setAccessUsers(d.users||[]); setPage('User access'); setQuery(''); setMobileOpen(false) } catch(e) { notify(e.message || 'Could not load users') } }
  const decideUser = async (id,decision) => { try { const r=await apiFetch(`/api/auth/users/${id}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})}); const d=await readApiJson(r); if(!r.ok) throw new Error(d.error); setAccessUsers(prev=>prev.map(u=>u.id===id?d.user:u)); notify(`Account ${decision}d.`) } catch(e) { notify(e.message || 'Could not update account') } }
  useEffect(() => {
    if (!authUser) return
    let cancelled = false
    const load = async () => {
      if (!authUser) return
      let lastError
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const response = await apiFetch('/api/bootstrap')
          if (!response.ok) throw new Error(`API returned ${response.status}`)
          const data = await readApiJson(response)
          if (cancelled) return
          if (Array.isArray(data.facilities)) setFacilities(data.facilities)
          if (Array.isArray(data.medicines)) setMedicines(data.medicines)
          if (Array.isArray(data.transactions)) setTransactions(data.transactions)
          if (Array.isArray(data.issueReports)) setIssueReports(data.issueReports)
          if (Array.isArray(data.stockRequests)) setStockRequests(data.stockRequests)
          if (Array.isArray(data.operationsReports)) setOperationsReports(data.operationsReports)
          if (Array.isArray(data.alerts)) setAlertsData(data.alerts)
          if (Array.isArray(data.transfers)) setTransfers(data.transfers)
          if (Array.isArray(data.interventions)) setCases(data.interventions)
          if (data.dashboard) setDashboard(data.dashboard)
          setApiStatus('connected')
          return
        } catch (error) {
          lastError = error
          await new Promise(resolve => window.setTimeout(resolve, 600))
        }
      }
      if (!cancelled) setApiStatus(lastError?.message || 'API unavailable')
    }
    load()
    return () => { cancelled = true }
  }, [authUser])
  useEffect(() => {
    const onNavigate = e => navigate(e.detail)
    const onToast = e => notify(e.detail)
    window.addEventListener('prototype-navigate-request', onNavigate)
    window.addEventListener('prototype-toast', onToast)
    return () => {
      window.removeEventListener('prototype-navigate-request', onNavigate)
      window.removeEventListener('prototype-toast', onToast)
    }
  }, [])
  const navigate = label => { if (label === 'User access') { loadAccessUsers(); return } setPage(label); setQuery(''); setMobileOpen(false); setActiveFilter('All') }

  const filteredMeds = useMemo(() => medicines.filter(m => {
    const q = query.toLowerCase()
    const matches = `${m.name} ${m.facility} ${m.batch} ${m.category}`.toLowerCase().includes(q)
    const status = activeFilter === 'All' || m.status === activeFilter
    const fac = facilityFilter === 'All facilities' || m.facility.includes(facilityFilter)
    return matches && status && fac
  }), [medicines, query, activeFilter, facilityFilter])

  const updateStock = async e => {
    e.preventDefault()
    try {
      const response = await apiFetch('/api/stock-transactions', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({medicineId:stockForm.medicine,action:stockForm.action,quantity:Number(stockForm.quantity),note:stockForm.note})})
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.error || 'Stock transaction failed')
      setMedicines(data.medicines)
      if (Array.isArray(data.transactions)) setTransactions(data.transactions)
      if (Array.isArray(data.alerts)) setAlertsData(data.alerts)
      if (data.dashboard) setDashboard(data.dashboard)
      setModal(null)
      notify('Stock transaction saved to the local demo database.')
    } catch (error) { notify(error.message || 'API unavailable; no stock change was saved.') }
  }

  const transferAction = async (id, action, body={}) => {
    try {
      const url = action === 'create' ? '/api/transfers' : action === 'review' ? `/api/transfers/${id}/review` : `/api/transfers/${id}/${action}`
      const r = await apiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const d = await readApiJson(r); if(!r.ok) throw new Error(d.error || `Transfer ${action} failed`)
      if(Array.isArray(d.transfers)) setTransfers(d.transfers)
      if(d.medicines) setMedicines(d.medicines); if(d.transactions) setTransactions(d.transactions); if(d.alerts) setAlertsData(d.alerts)
      notify(({create:'Request submitted for review.',review:'Review decision saved.',dispatch:'Dispatch recorded; receipt is still required.',receive:'Receipt recorded. Check any discrepancy flag.'})[action]||'Transfer updated.')
      return true
    } catch(e) { notify(e.message || `Transfer ${action} failed`); return false }
  }
  const approveTransfer = id => transferAction(id,'review',{decision:'approve'})
  const rejectTransfer = id => transferAction(id,'review',{decision:'reject'})
  const createTransfer = form => transferAction('', 'create', form)
  const dispatchTransfer = (id,quantity,note) => transferAction(id,'dispatch',{quantity:Number(quantity),note})
  const receiveTransfer = (id,quantity,note) => transferAction(id,'receive',{quantity:Number(quantity),note})
  const resolveCase = async id => {
    const item = cases.find(c => c.id === id); if (!item) return
    if (item.status === 'Resolved') { await updateIntervention(id,{note:'Intervention reopened for follow-up.',status:'Open'}); return }
    const note=window.prompt('Progress update (required):','Corrective action completed; ready for verification.')
    if (!note) return
    const evidence=window.prompt('Closure evidence / verification note (required):','Evidence reviewed by responsible manager.')
    if (!evidence) { notify('Closure cancelled: evidence is required.'); return }
    await updateIntervention(id,{note,evidence,status:'Resolved'})
  }
  const createIntervention = async form => {
    try { const r=await apiFetch('/api/interventions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Could not create intervention');setCases(prev=>[d.intervention,...prev]);notify('Intervention created and added to the action queue.');return true }
    catch(e){notify(e.message||'Could not create intervention');return false}
  }
  const updateIntervention = async (id,body) => {
    try { const r=await apiFetch(`/api/interventions/${id}/updates`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Could not update intervention');setCases(prev=>prev.map(c=>c.id===id?d.intervention:c));notify('Progress, status and evidence saved to the audit trail.');return true }
    catch(e){notify(e.message||'Could not update intervention');return false}
  }

  const refreshWorkflowData = async () => {
    const [ir,sr] = await Promise.all([apiFetch('/api/issue-reports'),apiFetch('/api/stock-requests')])
    const [id,sd] = await Promise.all([readApiJson(ir),readApiJson(sr)])
    if(!ir.ok) throw new Error(id.error||'Could not load issue reports'); if(!sr.ok) throw new Error(sd.error||'Could not load stock requests')
    setIssueReports(id);setStockRequests(sd)
  }
  const createIssue = async form => { try { const r=await apiFetch('/api/issue-reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Issue report failed');await refreshWorkflowData();notify('Issue submitted and shared with authorized facility roles.');return true } catch(e){notify(e.message||'Could not submit issue');return false} }
  const updateIssue = async (id,body) => { try {const r=await apiFetch(`/api/issue-reports/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Issue update failed');await refreshWorkflowData();notify('Issue status updated for the shared workflow.')}catch(e){notify(e.message||'Could not update issue')} }
  const commentIssue = async (id,message) => { try {const r=await apiFetch(`/api/issue-reports/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Comment failed');await refreshWorkflowData();notify('Handoff update added.');return true}catch(e){notify(e.message||'Could not add update');return false} }
  const createStockRequest = async form => { try {const m=medicines.find(x=>x.id===form.medicineId);const r=await apiFetch('/api/stock-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({medicineId:form.medicineId,quantity:Number(form.quantity),facility:m?.facility,reason:form.reason})});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Stock request failed');await refreshWorkflowData();notify('Stock request submitted to the shared review queue.');return true}catch(e){notify(e.message||'Could not submit stock request');return false} }
  const decideStockRequest = async (id,decision) => { try {const r=await apiFetch(`/api/stock-requests/${id}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Request review failed');await refreshWorkflowData();notify(`Stock request ${decision}d. Fulfillment remains a separate step.`)}catch(e){notify(e.message||'Could not review stock request')} }

  const refreshOperationsReports = async () => {
    const response=await apiFetch('/api/operations-reports');const data=await readApiJson(response)
    if(!response.ok)throw new Error(data.error||'Could not load facility reports')
    setOperationsReports(data);return data
  }
  const submitOperationsReport = async form => {
    try {const response=await apiFetch('/api/operations-reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error||'Report submission failed');await refreshOperationsReports();const boot=await apiFetch('/api/bootstrap');const bd=await readApiJson(boot);if(boot.ok&&Array.isArray(bd.facilities))setFacilities(bd.facilities);notify('Facility report submitted and shared with the responsible reviewers.');return true}
    catch(e){notify(e.message||'Could not submit facility report');return false}
  }
  const reviewOperationsReport = async (id,decision,note='') => {
    try {const response=await apiFetch(`/api/operations-reports/${id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,note})});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error||'Report review failed');await refreshOperationsReports();notify(decision==='accept'?'Report accepted.':'Report returned for correction.');}
    catch(e){notify(e.message||'Could not review report')}
  }
  const correctOperationsReport = async report => {
    const v=report.values||{}, ask=(label,value)=>window.prompt(`Correct ${label}:`,String(value??''))
    const body={note:report.note||''};let fields=[]
    if(report.type==='footfall')fields=[['count','patient count',v.count]]
    if(report.type==='beds')fields=[['total','total beds',v.total],['occupied','occupied beds',v.occupied],['unavailable','unavailable beds',v.unavailable||0]]
    if(report.type==='attendance')fields=[['present','staff present',v.present],['expected','expected staff',v.expected]]
    if(report.type==='diagnostics')fields=[['available','available tests',v.available],['total','total tests',v.total],['unavailableNotes','unavailable details',v.unavailableNotes||'']]
    for(const [key,label,value] of fields){const next=ask(label,value);if(next===null)return;body[key]=key==='unavailableNotes'?next:Number(next)}
    const note=window.prompt('Add a correction note (optional):',report.note||'');if(note===null)return;body.note=note
    try {const response=await apiFetch(`/api/operations-reports/${report.id}/resubmit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await readApiJson(response);if(!response.ok)throw new Error(data.error||'Report resubmission failed');await refreshOperationsReports();const boot=await apiFetch('/api/bootstrap');const bd=await readApiJson(boot);if(boot.ok&&Array.isArray(bd.facilities))setFacilities(bd.facilities);notify('Corrected report resubmitted for review.')}catch(e){notify(e.message||'Could not resubmit report')}
  }
  const loadNotifications = async () => {try{const r=await apiFetch('/api/notifications');const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Could not load notifications');setNotifications(d.notifications||[]);setNotificationUnread(d.unread||0)}catch(e){notify(e.message||'Could not load notifications')}}
  const openNotifications = async () => {const next=!notificationsOpen;setNotificationsOpen(next);if(next)await loadNotifications()}
  const openNotification = async item => {try{const r=await apiFetch(`/api/notifications/${encodeURIComponent(item.id)}/read`,{method:'POST'});if(!r.ok)throw new Error('Could not mark notification read');setNotifications(prev=>prev.map(n=>n.id===item.id?{...n,read:true}:n));setNotificationUnread(prev=>Math.max(0,prev-(item.read?0:1)));setNotificationsOpen(false);navigate(item.page||'Overview')}catch(e){notify(e.message||'Could not open notification')}}

  const renderPage = () => {
    switch(page) {
      case 'User access': return <AccessPage users={accessUsers} onDecision={decideUser} onRefresh={loadAccessUsers} />
      case 'Medicine inventory': return <InventoryPage medicines={filteredMeds} transactions={transactions} query={query} setQuery={setQuery} activeFilter={activeFilter} setActiveFilter={setActiveFilter} facilityFilter={facilityFilter} setFacilityFilter={setFacilityFilter} onAdd={() => setModal('stock')} />
      case 'Facility operations': return <OperationsPage facilities={facilities} reports={operationsReports} user={authUser} query={query} setQuery={setQuery} onSubmitReport={submitOperationsReport} onReviewReport={reviewOperationsReport} onCorrectReport={correctOperationsReport} />
      case 'AI insights': return <InsightsPage medicines={medicines} onNavigate={navigate} />
      case 'Redistribution': return <RedistributionPage user={authUser} facilities={facilities} medicines={medicines} transfers={transfers} onCreate={createTransfer} onApprove={approveTransfer} onReject={rejectTransfer} onDispatch={dispatchTransfer} onReceive={receiveTransfer} />
      case 'Interventions': return <InterventionsPage cases={cases} facilities={facilities} onToggle={resolveCase} onCreate={createIntervention} onUpdate={updateIntervention} query={query} setQuery={setQuery} />
      case 'Workflow inbox': return <WorkflowInbox user={authUser} facilities={facilities} medicines={medicines} issueReports={issueReports} stockRequests={stockRequests} onCreateIssue={createIssue} onUpdateIssue={updateIssue} onCommentIssue={commentIssue} onCreateStockRequest={createStockRequest} onDecideStockRequest={decideStockRequest} onRefresh={async()=>{try{await refreshWorkflowData();notify('Workflow queue refreshed.')}catch(e){notify(e.message||'Could not refresh queue')}}} />
      default: return <RoleDashboard role={authUser?.role} facilities={facilities} medicines={medicines} alerts={alertsData} transfers={transfers} cases={cases} dashboard={dashboard} onNavigate={navigate} onOpenAlert={() => navigate('AI insights')} preferences={dashboardPrefs} onPreferencesChange={saveDashboardPrefs} customize={customizeDashboard} setCustomize={setCustomizeDashboard} />
    }
  }

  if (!authReady) return <AuthScreen loading />
  if (!authUser) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} error={authError} onSubmit={submitAuth} accounts={demoAccounts} />
  const roleNav = authUser.role === ROLE_ADMIN ? navItems : authUser.role === ROLE_MANAGER ? navItems.filter(n=>['Overview','Medicine inventory','Facility operations','AI insights','Redistribution','Interventions','Workflow inbox'].includes(n.label)) : authUser.role === ROLE_PHARMACY ? navItems.filter(n=>['Overview','Medicine inventory','AI insights','Redistribution','Workflow inbox'].includes(n.label)) : navItems.filter(n=>['Overview','Facility operations','AI insights','Workflow inbox'].includes(n.label))
  return <div className="app-shell">
    <aside className={cx('sidebar', mobileOpen && 'mobile-open')}>
      <div className="brand-row">
        <img className="sidebar-brand-logo" src="/namo-monitoring-mark.svg" alt="Namo Monitoring logo"/>
        <div className="brand-copy"><strong>Namo Monitoring</strong><small>HEALTH FACILITY OPERATIONS</small></div>
        <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button>
      </div>
      <div className="district-switcher"><div className="district-avatar"><Building2 size={17}/></div><div className="district-copy"><b>Bhopal District</b><span>Madhya Pradesh, India</span></div><ChevronDown size={15} className="muted"/></div>
      <nav className="side-nav">
        {['WORKSPACE','INTELLIGENCE','MANAGEMENT'].map(group => <div className="nav-group" key={group}>
          <div className="nav-heading">{group}</div>
          {roleNav.filter(n => n.group === group).map(item => <button key={item.label} onClick={() => navigate(item.label)} className={cx('nav-link', page === item.label && 'active')}>
            <item.icon size={18}/><span>{item.label}</span>
            {item.label === 'Interventions' && <span className="nav-count">{cases.filter(c=>c.status!=='Resolved').length}</span>}
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        {authUser.role === ROLE_ADMIN && <button className={cx('nav-link',page==='User access'&&'active')} onClick={loadAccessUsers}><Users size={18}/><span>User access</span><span className="nav-count">{accessUsers.filter(u=>u.status==='pending').length || ''}</span></button>}
        <div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><b>Help and guidance</b><span>Open quick guide</span></div><ChevronRight size={15}/></div>
        <button className="profile-row" onClick={logout}>
          <div className="avatar">{authUser.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div className="profile-copy"><b>{authUser.name}</b><span>{authUser.role} · Sign out</span></div><MoreHorizontal size={18} className="muted"/>
        </button>
      </div>
    </aside>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumbs"><span>District workspace</span><ChevronRight size={14}/><b>{page}</b></div></div>
        <div className="topbar-actions">
          <div className="data-live"><span className="live-dot"/><span>{apiStatus==='connected'?'API connected':apiStatus==='loading'?'Connecting…':'API offline'}</span></div>
          <button className="language-button" onClick={() => {setLang(lang === 'EN' ? 'हिं' : 'EN'); notify(lang === 'EN' ? 'Hindi UI preview selected; full translation is planned.' : 'English selected.')}}><Languages size={16}/>{lang}<ChevronDown size={13}/></button>
          <div className="notification-wrap"><button className="icon-button notification-button" onClick={openNotifications} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={18}/>{notificationUnread>0&&<i/>}</button>{notificationsOpen&&<section className="notification-popover"><div className="notification-popover-head"><div><b>Notifications</b><small>{notificationUnread} unread</small></div><button className="text-button" onClick={loadNotifications}>Refresh</button></div>{notifications.length?notifications.map(n=><button key={n.id} className={`notification-item ${n.read?'read':''}`} onClick={()=>openNotification(n)}><span className="notification-item-icon"><Bell size={15}/></span><span><b>{n.title}</b><small>{n.detail}</small><em>{n.kind} · {n.at?new Date(n.at).toLocaleString():''}</em></span>{!n.read&&<i/>}</button>):<div className="notification-empty">You're all caught up. Relevant workflow updates will appear here.</div>}</section>}</div>
          <div className="top-avatar">AS</div>
        </div>
      </header>
      <div className="page-content">
        <div className="demo-banner"><span><Zap size={14}/> LOCAL DEMO</span><p>{apiStatus==='connected'?'Illustrative data from the local API — not live health-system data.':apiStatus==='loading'?'Connecting to the local API…':'API connection failed. Start both services with npm run dev, then refresh.'}</p><button onClick={() => notify('Seed records are synthetic. Stock transactions and intervention updates persist in backend/data/db.json.')}>About data <ArrowRight size={13}/></button></div>
        {renderPage()}
        <footer className="footer"><span>Namo Monitoring · Local prototype</span><span><span className="live-dot"/> Sample data</span></footer>
      </div>
    </main>
    {modal === 'stock' && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal-card" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><div className="eyebrow">INVENTORY WORKFLOW</div><h3>Record stock movement</h3><p>Validated and persisted in the local demo database.</p></div><button className="icon-button" onClick={() => setModal(null)}><X size={18}/></button></div>
      <form onSubmit={updateStock} className="modal-form">
        <label>Medicine<select value={stockForm.medicine} onChange={e => setStockForm({...stockForm,medicine:e.target.value})}>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} · {m.facility}</option>)}</select></label>
        <label>Transaction type<select value={stockForm.action} onChange={e => setStockForm({...stockForm,action:e.target.value})}><option>Receive stock</option><option>Issue stock</option><option>Record wastage</option><option>Record expiry</option><option>Increase adjustment</option><option>Decrease adjustment</option></select></label>
        <label>Quantity<input type="number" min="1" required value={stockForm.quantity} onChange={e => setStockForm({...stockForm,quantity:e.target.value})}/></label>
        <label>Note (optional)<input value={stockForm.note} onChange={e => setStockForm({...stockForm,note:e.target.value})} placeholder="e.g. Delivery challan reference"/></label>
        <div className="modal-note"><AlertCircle size={15}/> Demo-only: this transaction is saved to the local JSON database. It is not connected to a live health system.</div>
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn primary"><Check size={16}/> Record movement</button></div>
      </form>
    </div></div>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>
}

const ROLE_WIDGETS = [
  { id: 'summary', label: 'Key indicators' },
  { id: 'priority', label: 'Priority items' },
  { id: 'operations', label: 'Operations snapshot' },
  { id: 'stock', label: 'Stock status' },
  { id: 'actions', label: 'Quick actions' }
]
function RoleDashboard({ role, facilities, medicines, alerts, transfers, cases, dashboard, onNavigate, onOpenAlert, preferences, onPreferencesChange, customize, setCustomize }) {
  const isDistrict = role === ROLE_ADMIN
  const isManager = role === ROLE_MANAGER
  const isPharmacy = role === ROLE_PHARMACY
  const isOperations = role === ROLE_OPERATIONS
  const hidden = preferences?.hidden || []
  const visible = id => !hidden.includes(id)
  const facilityCount = facilities.length
  const critical = medicines.filter(m => ['Critical','Low stock'].includes(m.status))
  const totalBeds = facilities.reduce((n, f) => n + Number(f.beds || 0), 0)
  const occupied = facilities.reduce((n, f) => n + Number(f.occupied || 0), 0)
  const footfall = facilities.reduce((n, f) => n + Number(f.footfall || 0), 0)
  const attendance = facilityCount ? Math.round(facilities.reduce((n, f) => n + Number(f.attendance || 0), 0) / facilityCount) : 0
  const openCases = cases.filter(c => c.status !== 'Resolved')
  const pendingTransfers = transfers.filter(t => !String(t.status || '').startsWith('Approved') && !String(t.status || '').startsWith('Rejected'))
  const title = isDistrict ? 'District command centre' : isManager ? 'Facility management' : isPharmacy ? 'Pharmacy workspace' : 'Daily operations'
  const subtitle = isDistrict ? 'District-wide visibility into supply risks, facility performance, and pending decisions.' : isManager ? 'Your facility at a glance: service capacity, shortages, and actions requiring review.' : isPharmacy ? 'A practical workspace for stock availability, expiry risk, and medicine movements.' : 'Your daily checklist for service delivery, reporting, and operational follow-up.'
  const metrics = isDistrict ? [
    {label:'Facilities in view',value:facilityCount,change:'Loaded demo facilities',icon:Building2,tint:'teal',foot:'Assigned district scope'},
    {label:'Stock risk items',value:critical.length,change:'Threshold-based',icon:Package,tint:'amber',foot:'Review before replenishing'},
    {label:'Pending transfers',value:pendingTransfers.length,change:'Awaiting next step',icon:Truck,tint:'blue',foot:'Approval is not dispatch'},
    {label:'Open interventions',value:openCases.length,change:'Not yet resolved',icon:ClipboardCheck,tint:'violet',foot:'Track owners and due dates'}
  ] : isManager ? [
    {label:'Facilities assigned',value:facilityCount,change:'Current demo scope',icon:Building2,tint:'teal',foot:'Confirm assignment in demo data'},
    {label:'Stock risk items',value:critical.length,change:'Needs local review',icon:Package,tint:'amber',foot:'Across loaded medicine records'},
    {label:'Beds available',value:Math.max(0,totalBeds-occupied),change:`${totalBeds ? Math.round(occupied/totalBeds*100) : 0}% occupied`,icon:Activity,tint:'blue',foot:'Loaded facility snapshot'},
    {label:'Reports / actions open',value:openCases.length,change:'Interventions to follow up',icon:ClipboardCheck,tint:'violet',foot:'Review local priorities'}
  ] : isPharmacy ? [
    {label:'Medicine records',value:medicines.length,change:'Loaded stock records',icon:Package,tint:'teal',foot:'Not a count of unique batches'},
    {label:'Low / critical',value:critical.length,change:'Review replenishment',icon:ShieldAlert,tint:'amber',foot:'Rule-based stock status'},
    {label:'Stock movements',value:dashboard?.transactionsTotal ?? '—',change:'Saved ledger records',icon:Activity,tint:'blue',foot:'Open inventory for full ledger'},
    {label:'Transfer proposals',value:pendingTransfers.length,change:'Pending next step',icon:Truck,tint:'violet',foot:'Follow authorized transfer steps'}
  ] : [
    {label:'Patient footfall',value:fmt(footfall),change:'Loaded report snapshot',icon:Users,tint:'teal',foot:'Submit/update via operations workflow'},
    {label:'Beds available',value:Math.max(0,totalBeds-occupied),change:`${totalBeds ? Math.round(occupied/totalBeds*100) : 0}% occupied`,icon:Activity,tint:'blue',foot:'Loaded occupancy snapshot'},
    {label:'Diagnostic tests available',value:facilities.reduce((n,f)=>n+Number(f.testsAvailable||0),0),change:'Across loaded facilities',icon:FlaskConical,tint:'violet',foot:'Confirm reporting period'},
    {label:'Open follow-ups',value:openCases.length,change:'Assigned actions to check',icon:ClipboardCheck,tint:'amber',foot:'Complete tasks within your permissions'}
  ]
  const actionItems = isDistrict ? [
    ['Review transfers','Approve/reject proposals after checking donor reserve.','Redistribution',Truck],
    ['Review stock risks','Open medicines requiring district attention.','Medicine inventory',Package],
    ['Track interventions','Review open corrective actions.','Interventions',ClipboardCheck],
    ['Approve user access','Manage requests in your district.','User access',Users]
  ] : isManager ? [
    ['Review facility reports','Inspect footfall, beds, attendance, and tests.','Facility operations',Building2],
    ['Request / review supplies','Check stock risks and replenishment needs.','Medicine inventory',Package],
    ['Monitor transfer proposals','Track pending supply movements.','Redistribution',Truck],
    ['Follow corrective actions','Review open interventions.','Interventions',ClipboardCheck]
  ] : isPharmacy ? [
    ['Record stock movement','Receive, issue, or adjust inventory.','Medicine inventory',Package],
    ['Review low stock','Check balances and reorder risks.','Medicine inventory',ShieldAlert],
    ['Check transfer proposals','Review permitted redistribution work.','Redistribution',Truck],
    ['Review stock forecast','Inspect illustrative demand and risk signals.','AI insights',BrainCircuit]
  ] : [
    ['Review daily operations','Check the loaded facility snapshot.','Facility operations',ClipboardCheck],
    ['Report a stock concern','Open medicine availability.','Medicine inventory',Package],
    ['Review service risks','Check alerts and decision support.','AI insights',ShieldAlert],
    ['Track assigned actions','Review intervention status.','Interventions',CheckCircle2]
  ]
  const priorityItems = isPharmacy ? critical.slice(0,5).map(m => ({title:m.name,detail:`${m.facility} · ${m.quantity} units · ${m.status}`,severity:m.status})) : isDistrict ? [...alerts.slice(0,4).map(a=>({title:a.title,detail:`${a.facility} · ${a.time}`,severity:a.severity})), ...pendingTransfers.slice(0,2).map(t=>({title:`Transfer ${t.id}`,detail:`${t.source} → ${t.destination}`,severity:t.urgency||'Medium'}))].slice(0,5) : isManager ? [...critical.slice(0,3).map(m=>({title:m.name,detail:`${m.facility} · ${m.quantity} units`,severity:m.status})), ...openCases.slice(0,2).map(c=>({title:c.title||c.issue||'Open intervention',detail:`${c.facility||'Facility action'} · ${c.dueDate||'Due date not set'}`,severity:'Medium'}))] : [...alerts.slice(0,3).map(a=>({title:a.title,detail:`${a.facility} · ${a.time}`,severity:a.severity})), ...openCases.slice(0,2).map(c=>({title:c.title||c.issue||'Open follow-up',detail:`${c.facility||'Operations'} · ${c.dueDate||'Due date not set'}`,severity:'Medium'}))]
  return <div className="role-dashboard">
    <SectionTitle eyebrow={todayLabel} title={title} description={subtitle} action={<button className="btn secondary" onClick={()=>setCustomize(v=>!v)}><Settings size={15}/>{customize?'Close preferences':'Customize dashboard'}</button>} />
    {customize && <section className="panel dashboard-preferences"><div className="panel-header"><div><h3>Personal dashboard preferences</h3><p>Hide optional widgets on this device. Your choices are saved per demo account.</p></div></div><div className="preference-controls">{ROLE_WIDGETS.map(w=><label key={w.id}><input type="checkbox" checked={visible(w.id)} disabled={w.id==='summary'} onChange={e=>onPreferencesChange({...preferences,hidden:e.target.checked?hidden.filter(x=>x!==w.id):[...hidden,w.id]})}/><span>{w.label}{w.id==='summary'?' (always visible)':''}</span></label>)}<button className="btn secondary" onClick={()=>onPreferencesChange({hidden:[],landingPage:'Overview'})}>Reset defaults</button></div></section>}
    {visible('summary') && <div className="metric-grid">{metrics.map(m=><Metric key={m.label} label={m.label} value={m.value} change={m.change} trend={m.tint==='amber'?'down':'up'} icon={m.icon} tint={m.tint} foot={m.foot}/>)}</div>}
    <div className="role-dashboard-grid">
      {visible('priority') && <section className="panel role-widget"><div className="panel-header"><div><h3>{isPharmacy?'Stock items to review':isDistrict?'District priorities':'Priority items'}</h3><p>{isDistrict?'Alerts and transfers requiring a decision':isPharmacy?'Low and critical medicine records':'Recent alerts and open follow-ups from the loaded demo data'}</p></div><button className="text-button" onClick={isPharmacy?()=>onNavigate('Medicine inventory'):onOpenAlert}>View all <ArrowRight size={14}/></button></div><div className="role-priority-list">{priorityItems.map((item,i)=><div className="role-priority-item" key={`${item.title}-${i}`}><span className={`role-priority-dot ${riskClass(item.severity)}`}/><span><b>{item.title}</b><small>{item.detail}</small></span><Status>{item.severity||'Medium'}</Status></div>)}{!priorityItems.length&&<div className="empty-state">No priority items in the currently loaded sample data.</div>}</div></section>}
      {visible('operations') && <section className="panel role-widget"><div className="panel-header"><div><h3>{isDistrict?'Facility network snapshot':isPharmacy?'Recent stock context':'Operations snapshot'}</h3><p>{isDistrict?'Compare current facility indicators':isPharmacy?'Stock records and recent movements':'Current figures derived from loaded facility records'}</p></div><button className="text-button" onClick={()=>onNavigate(isPharmacy?'Medicine inventory':'Facility operations')}>Open details <ArrowRight size={14}/></button></div>{isPharmacy?<div className="role-mini-stats"><div><span>Medicine records</span><b>{medicines.length}</b></div><div><span>Critical / low</span><b>{critical.length}</b></div><div><span>Transactions</span><b>{dashboard?.transactionsTotal ?? 'Not reported'}</b></div></div>:<div className="role-facility-list">{facilities.slice(0,isDistrict?6:4).map(f=><div className="role-facility-row" key={f.id}><span className="facility-icon"><Building2 size={15}/></span><span className="role-facility-name"><b>{f.name}</b><small>{f.type} · {f.updated||'Update time unavailable'}</small></span><span className="role-facility-stat"><b>{isOperations?f.footfall:isManager?`${Math.max(0,Number(f.beds||0)-Number(f.occupied||0))} beds`:Math.round(Number(f.occupied||0)/Math.max(1,Number(f.beds||0))*100)+'%'}</b><small>{isOperations?'footfall':isManager?'available':'bed occupancy'}</small></span></div>)}</div>}</section>}
    </div>
    {visible('stock') && <section className="panel role-widget"><div className="panel-header"><div><h3>{isPharmacy?'Inventory at a glance':'Medicine availability'}</h3><p>Based on currently loaded demo medicine records</p></div><button className="text-button" onClick={()=>onNavigate('Medicine inventory')}>Open inventory <ArrowRight size={14}/></button></div><div className="role-stock-grid"><div><span>Total medicine records</span><b>{medicines.length}</b></div><div><span>Healthy</span><b>{medicines.filter(m=>m.status==='Healthy').length}</b></div><div><span>Low stock</span><b>{medicines.filter(m=>m.status==='Low stock').length}</b></div><div><span>Critical</span><b>{medicines.filter(m=>m.status==='Critical').length}</b></div></div></section>}
    {visible('actions') && <section className="panel role-widget"><div className="panel-header"><div><h3>{isOperations?'Daily task shortcuts':'Quick actions'}</h3><p>{isOperations?'Open the workflow needed for today’s operational tasks':'Common next steps for your role'}</p></div></div><div className="role-quick-actions">{actionItems.filter(([label])=>!(label==='Approve user access'&& !isDistrict)).map(([label,description,page,Icon])=><button key={label} onClick={()=>onNavigate(page)}><span className="quick-icon teal"><Icon size={17}/></span><span><b>{label}</b><small>{description}</small></span><ArrowRight size={15}/></button>)}</div></section>}
    <div className="role-dashboard-note"><AlertCircle size={15}/> This dashboard uses locally loaded demonstration records. Some workflows are still being implemented; figures are not live health-system data.</div>
  </div>
}

function OverviewPage({ facilities, medicines, alerts, dashboard, onNavigate, onOpenAlert }) {
  const critical = medicines.filter(m => m.status === 'Critical' || m.status === 'Low stock').length
  const totalBeds = facilities.reduce((a,f)=>a+f.beds,0)
  const occupied = facilities.reduce((a,f)=>a+f.occupied,0)
  const trend = facilities.slice(0,7).map((f,i)=>({d:f.id?.replace(/[^0-9]/g,'').slice(-2)||`F${i+1}`,v:Number(f.footfall)||0}))
  const stockTotal = medicines.length || 1
  const stockMix = [{label:'Healthy stock',n:Math.round(medicines.filter(m=>m.status==='Healthy').length/stockTotal*100),color:'#20a47a'},{label:'Low stock',n:Math.round(medicines.filter(m=>m.status==='Low stock').length/stockTotal*100),color:'#e6a23c'},{label:'Critical',n:Math.round(medicines.filter(m=>m.status==='Critical').length/stockTotal*100),color:'#e05b5b'}]
  return <>
    <SectionTitle eyebrow={todayLabel} title="District overview" description="A snapshot of facility activity, medicine availability and items that need attention." action={<button className="btn secondary" onClick={()=>onNavigate('Facility operations')}><CalendarClock size={16}/> Daily report <ChevronDown size={14}/></button>}/>
    <div className="metric-grid">
      <Metric label="Facilities reporting" value={`${dashboard?.facilitiesReporting ?? facilities.length} / ${dashboard?.facilitiesTotal ?? 28}`} change="Demo snapshot" trend="up" icon={Building2} tint="teal" foot="Reporting facilities in seed data"/>
      <Metric label="Stock alerts" value={String(dashboard?.stockRisks ?? critical).padStart(2,'0')} change="Threshold based" trend="down" icon={Package} tint="amber" foot="Medicine entries needing review"/>
      <Metric label="Beds available" value={fmt(dashboard?.bedsAvailable ?? totalBeds-occupied)} change={`${dashboard?.occupancyRate ?? Math.round(occupied/Math.max(1,totalBeds)*100)}% occupied`} trend="up" icon={Activity} tint="blue" foot={`${dashboard?.bedsTotal ?? totalBeds} total monitored beds`}/>
      <Metric label="Staff attendance" value={`${dashboard?.attendance ?? 0}%`} change="Reported average" trend="down" icon={Users} tint="violet" foot="Across loaded facilities"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel trend-panel">
        <div className="panel-header"><div><h3>Patient footfall</h3><p>Daily visits across reporting facilities</p></div><button className="select-button" onClick={()=>onNavigate('Facility operations')}>Last 7 days <ChevronDown size={14}/></button></div>
        <div className="chart-summary"><strong>{fmt(dashboard?.footfall ?? facilities.reduce((n,f)=>n+Number(f.footfall||0),0))}</strong><span className="positive"><ArrowUpRight size={14}/> Sample</span><small>reported visits in seed snapshot</small></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{top:10,right:5,left:-20,bottom:0}}><defs><linearGradient id="footfallFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f9b8e" stopOpacity={.2}/><stop offset="95%" stopColor="#0f9b8e" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf1f4" vertical={false}/><XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#87919c'}} dy={9}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#87919c'}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e8edf0',fontSize:12}}/><Area type="monotone" dataKey="v" stroke="#0f9b8e" strokeWidth={2.5} fill="url(#footfallFill)" activeDot={{r:5}}/></AreaChart></ResponsiveContainer></div>
      </section>
      <section className="panel alerts-panel">
        <div className="panel-header"><div><h3>Needs attention</h3><p>Priority alerts from your district</p></div><button className="text-button" onClick={onOpenAlert}>View all <ArrowRight size={14}/></button></div>
        <div className="alert-list">{alerts.slice(0,4).map(a=><button className="alert-item" key={a.id} onClick={onOpenAlert}><span className={`alert-symbol ${riskClass(a.severity)}`}>{a.severity==='Critical'?<ShieldAlert size={17}/>:<AlertCircle size={17}/>}</span><span className="alert-copy"><b>{a.title}</b><small>{a.facility} · {a.time}</small></span><ChevronRight size={16} className="muted"/></button>)}</div>
      </section>
    </div>
    <section className="panel facilities-panel">
      <div className="panel-header"><div><h3>Facility status</h3><p>Operational snapshot of health centres</p></div><button className="text-button" onClick={()=>onNavigate('Facility operations')}>All facilities <ArrowRight size={14}/></button></div>
      <div className="table-wrap"><table><thead><tr><th>FACILITY</th><th>TYPE</th><th>STATUS</th><th>BED OCCUPANCY</th><th>ATTENDANCE</th><th>LAST UPDATE</th><th></th></tr></thead><tbody>{facilities.slice(0,5).map(f=><tr key={f.id}><td><div className="facility-cell"><span className="facility-icon"><Building2 size={16}/></span><span><b>{f.name}</b><small>{f.id}</small></span></div></td><td><span className="type-pill">{f.type}</span></td><td><Status>{f.status}</Status></td><td><div className="occupancy-cell"><div className="mini-progress"><span style={{width:`${f.occupied/f.beds*100}%`}}/></div><small>{Math.round(f.occupied/f.beds*100)}%</small></div></td><td><b className={f.attendance<75?'text-danger':''}>{f.attendance}%</b></td><td className="muted-text">{f.updated}</td><td><button className="icon-button small" onClick={()=>onNavigate('Facility operations')}><ChevronRight size={16}/></button></td></tr>)}</tbody></table></div>
    </section>
    <div className="bottom-grid">
      <section className="panel stock-panel"><div className="panel-header"><div><h3>Medicine stock overview</h3><p>Stock levels needing review</p></div><button className="text-button" onClick={()=>onNavigate('Medicine inventory')}>Inventory <ArrowRight size={14}/></button></div><div className="stock-bars">{stockMix.map(x=><div className="stock-bar-row" key={x.label}><div><span>{x.label}</span><b>{x.n}%</b></div><div className="stock-track"><span style={{width:`${x.n}%`,background:x.color}}/></div></div>)}</div><div className="stock-foot"><span><i className="live-dot"/> Inventory source: local demo database</span><button className="text-button" onClick={()=>onNavigate('Medicine inventory')}>Review stock</button></div></section>
      <section className="panel quick-panel"><div className="panel-header"><div><h3>Quick actions</h3><p>Common operational tasks</p></div></div><div className="quick-actions"><button onClick={()=>onNavigate('Medicine inventory')}><span className="quick-icon teal"><Plus size={18}/></span><span><b>Update medicine stock</b><small>Record receipt or issue</small></span><ArrowRight size={15}/></button><button onClick={()=>onNavigate('Facility operations')}><span className="quick-icon blue"><ClipboardCheck size={18}/></span><span><b>Review facility reports</b><small>Check daily operational data</small></span><ArrowRight size={15}/></button><button onClick={()=>onNavigate('Redistribution')}><span className="quick-icon violet"><Truck size={18}/></span><span><b>Plan stock transfer</b><small>Review redistribution options</small></span><ArrowRight size={15}/></button></div></section>
    </div>
  </>
}

function InventoryPage({ medicines, transactions=[], query, setQuery, activeFilter, setActiveFilter, facilityFilter, setFacilityFilter, onAdd }) {
  const total = medicines.reduce((s,m)=>s+m.stock,0)
  return <>
    <SectionTitle eyebrow="SUPPLY CHAIN" title="Medicine inventory" description="Monitor medicine availability, batches and expiry across health centres." action={<button className="btn primary" onClick={onAdd}><Plus size={16}/> Record stock</button>}/>
    <div className="metric-grid three">
      <Metric label="Medicine entries" value={medicines.length} change="Across facilities" trend="up" icon={Package} tint="teal" foot="Illustrative catalogue"/>
      <Metric label="Low / critical items" value={medicines.filter(m=>m.status!=='Healthy').length} change="Requires review" trend="down" icon={AlertCircle} tint="amber" foot="Threshold-based demo status"/>
      <Metric label="Units in filtered view" value={fmt(total)} change="All displayed items" trend="up" icon={Activity} tint="blue" foot="Mixed units; not a single total measure"/>
    </div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search medicine, batch, facility..." /></div><div className="toolbar-filters"><select value={facilityFilter} onChange={e=>setFacilityFilter(e.target.value)}><option>All facilities</option><option>Kolar</option><option>Berasia</option><option>Misrod</option><option>Huzur</option><option>Phanda</option></select><button className="btn secondary" onClick={()=>setActiveFilter(activeFilter==='All'?'Critical':'All')}><Filter size={15}/>{activeFilter==='All'?'Filters':'Clear filter'}</button></div></div>
      <div className="filter-chips">{['All','Critical','Low stock','Healthy'].map(f=><button key={f} className={cx('filter-chip',activeFilter===f&&'selected')} onClick={()=>setActiveFilter(f)}>{f}{f==='All'&&<span>{medicines.length}</span>}</button>)}</div>
      <div className="table-wrap"><table><thead><tr><th>MEDICINE / CATEGORY</th><th>FACILITY</th><th>STOCK ON HAND</th><th>REORDER LEVEL</th><th>EST. COVERAGE</th><th>BATCH / EXPIRY</th><th>STATUS</th><th></th></tr></thead><tbody>{medicines.map(m=><tr key={m.id}><td><div className="medicine-cell"><span className="medicine-icon"><Package size={17}/></span><span><b>{m.name}</b><small>{m.category}</small></span></div></td><td>{m.facility}</td><td><b>{fmt(m.stock)}</b> <span className="muted-text">{m.unit}</span></td><td>{fmt(m.reorder)} <span className="muted-text">{m.unit}</span></td><td><b className={m.stock/m.daily<5?'text-danger':m.stock/m.daily<8?'text-warning':''}>{(m.stock/m.daily).toFixed(1)} days</b></td><td><span>{m.batch}</span><small className="table-sub">{m.expiry}</small></td><td><Status>{m.status}</Status></td><td><button className="icon-button small" title="Record stock movement" onClick={onAdd}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>{medicines.length===0&&<EmptySearch term={query}/>}</div>
      <div className="table-pagination"><span>Showing <b>{medicines.length}</b> medicine entries <span className="muted-text">(demo data)</span></span><div><button className="icon-button small" disabled><ChevronLeft size={16}/></button><button className="page-num active">1</button><button className="icon-button small" disabled><ChevronRight size={16}/></button></div></div>
    </section>
    <section className="panel table-panel inventory-ledger"><div className="panel-header"><div><h3>Recent stock movements</h3><p>Saved transactions for your authorized facility scope</p></div><span className="status healthy">{transactions.length} records</span></div><div className="table-wrap"><table><thead><tr><th>DATE / REFERENCE</th><th>MEDICINE / BATCH</th><th>FACILITY</th><th>MOVEMENT</th><th>CHANGE</th><th>BALANCE</th><th>RECORDED NOTE</th></tr></thead><tbody>{transactions.slice(0,12).map(t=><tr key={t.id}><td><b>{new Date(t.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</b><small className="table-sub">{t.id}</small></td><td><b>{t.medicineName}</b><small className="table-sub">{t.batch||'Batch not set'}</small></td><td>{t.facility}</td><td><Status>{t.action||t.type}</Status></td><td>{['issued','wastage','expired','adjustment-out'].includes(t.type)?'−':'+'}{fmt(t.quantity)}</td><td>{fmt(t.newQuantity)}</td><td>{t.note||t.reference||'—'}</td></tr>)}</tbody></table>{transactions.length===0&&<div className="empty-state"><Package size={22}/><b>No stock movements yet</b><span>Record a receipt, issue, wastage, expiry or adjustment to start the ledger.</span></div>}</div></section>
    <div className="info-callout"><AlertCircle size={18}/><div><b>Stock coverage is illustrative</b><p>Coverage is calculated as current quantity divided by average daily use. A production implementation must account for usable batches, expiry, pending deliveries, demand uncertainty and safety stock. Adjustments and write-offs are recorded in the ledger with the actor and timestamp.</p></div></div>
  </>
}

function OperationsPage({ facilities, reports=[], user, query, setQuery, onSubmitReport=()=>false, onReviewReport=()=>{}, onCorrectReport=()=>{} }) {
  const [tab, setTab] = useState('Facilities')
  const [reportType,setReportType]=useState('footfall')
  const [reportForm,setReportForm]=useState({facilityId:user?.facilityIds?.[0]||facilities[0]?.id||'',date:new Date().toISOString().slice(0,10),count:'',total:'',occupied:'',unavailable:'0',present:'',expected:'',available:'',unavailableNotes:'',note:''})
  const [reportBusy,setReportBusy]=useState(false)
  const canSubmit=[ROLE_MANAGER,ROLE_OPERATIONS].includes(user?.role)
  const canReview=[ROLE_ADMIN,ROLE_MANAGER].includes(user?.role)
  const visibleReports=reports.filter(r=>facilities.some(f=>f.id===r.facilityId)).filter(r=>`${r.facility} ${r.type} ${r.status} ${r.id}`.toLowerCase().includes(query.toLowerCase()))
  const submitReport=async e=>{e.preventDefault();setReportBusy(true);const ok=await onSubmitReport({...reportForm,type:reportType});setReportBusy(false);if(ok)setReportForm(f=>({...f,count:'',present:'',expected:'',note:''}))}
  const filtered = facilities.filter(f=>`${f.name} ${f.id} ${f.type}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <SectionTitle eyebrow="FACILITY NETWORK" title="Facility operations" description="Review patient footfall, staffing, bed capacity and diagnostic availability." action={<button className="btn secondary" onClick={()=>window.print()}><Download size={16}/> Export view</button>}/>
    <div className="metric-grid">
      <Metric label="Patient footfall today" value={fmt(facilities.reduce((n,f)=>n+Number(f.footfall||0),0))} change="Seed snapshot" trend="up" icon={Users} tint="teal" foot="Across loaded facilities"/>
      <Metric label="Doctor attendance" value={`${facilities.length?Math.round(facilities.reduce((n,f)=>n+Number(f.attendance||0),0)/facilities.length*10)/10:0}%`} change="Reported average" trend="down" icon={Stethoscope} tint="violet" foot="Loaded facility reports"/>
      <Metric label="Beds available" value={fmt(facilities.reduce((n,f)=>n+Number(f.beds||0)-Number(f.occupied||0),0))} change="Calculated from occupancy" trend="up" icon={Activity} tint="blue" foot="Across monitored beds"/>
      <Metric label="Tests available" value={`${facilities.reduce((n,f)=>n+Number(f.testsAvailable||0),0)}/${facilities.reduce((n,f)=>n+Number(f.tests||0),0)}`} change="Available / listed" trend="down" icon={FlaskConical} tint="amber" foot="Diagnostic service snapshot"/>
    </div>
    {canSubmit&&<section className="panel operations-entry-panel"><div className="panel-header"><div><h3>Submit facility report</h3><p>Entries are shared with the facility manager and authorized district reviewers.</p></div><span className="status neutral">{user?.role===ROLE_OPERATIONS?'Operations entry':'Manager entry'}</span></div><form className="operations-report-form" onSubmit={submitReport}><label>Facility<select required value={reportForm.facilityId} onChange={e=>setReportForm({...reportForm,facilityId:e.target.value})}>{facilities.filter(f=>user?.role===ROLE_ADMIN||user?.facilityIds?.includes(f.id)).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Report type<select value={reportType} onChange={e=>setReportType(e.target.value)}><option value="footfall">Patient footfall</option><option value="beds">Beds & occupancy</option><option value="attendance">Staff attendance</option><option value="diagnostics">Diagnostic availability</option></select></label><label>Reporting date<input type="date" required value={reportForm.date} onChange={e=>setReportForm({...reportForm,date:e.target.value})}/></label>{reportType==='footfall'&&<label>Patient count<input type="number" min="0" step="1" required value={reportForm.count} onChange={e=>setReportForm({...reportForm,count:e.target.value})}/></label>}{reportType==='beds'&&<><label>Total beds<input type="number" min="0" required value={reportForm.total} onChange={e=>setReportForm({...reportForm,total:e.target.value})}/></label><label>Occupied beds<input type="number" min="0" required value={reportForm.occupied} onChange={e=>setReportForm({...reportForm,occupied:e.target.value})}/></label><label>Unavailable beds<input type="number" min="0" value={reportForm.unavailable} onChange={e=>setReportForm({...reportForm,unavailable:e.target.value})}/></label></>}{reportType==='attendance'&&<><label>Staff present<input type="number" min="0" required value={reportForm.present} onChange={e=>setReportForm({...reportForm,present:e.target.value})}/></label><label>Expected staff<input type="number" min="0" required value={reportForm.expected} onChange={e=>setReportForm({...reportForm,expected:e.target.value})}/></label></>}{reportType==='diagnostics'&&<><label>Available tests/services<input type="number" min="0" required value={reportForm.available} onChange={e=>setReportForm({...reportForm,available:e.target.value})}/></label><label>Total tests/services<input type="number" min="0" required value={reportForm.total} onChange={e=>setReportForm({...reportForm,total:e.target.value})}/></label><label>Unavailable details<input value={reportForm.unavailableNotes} onChange={e=>setReportForm({...reportForm,unavailableNotes:e.target.value})} maxLength="300"/></label></>}<label className="wide-field">Notes<input value={reportForm.note} onChange={e=>setReportForm({...reportForm,note:e.target.value})} maxLength="500" placeholder="Context or handoff notes (no patient-identifying data)"/></label><button className="btn primary" type="submit" disabled={reportBusy||!facilities.length}>{reportBusy?'Submitting…':'Submit report'}</button></form></section>}
    <section className="panel table-panel"><div className="panel-header"><div><h3>Shared operations reports</h3><p>Submissions are visible to authorized reviewers; returned reports remain in history.</p></div><span className="status neutral">{visibleReports.length} reports</span></div><div className="table-wrap"><table><thead><tr><th>REPORT</th><th>FACILITY / DATE</th><th>SUBMITTED BY</th><th>VALUE</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>{visibleReports.map(r=><tr key={r.id}><td><b>{r.type}</b><small className="table-sub">{r.id}</small></td><td>{r.facility}<small className="table-sub">{r.date}</small></td><td>{r.submittedByName}</td><td>{r.type==='footfall'?`Patients: ${r.values.count}`:r.type==='beds'?`Occupied ${r.values.occupied}/${r.values.total}; unavailable ${r.values.unavailable}`:r.type==='attendance'?`Present ${r.values.present}/${r.values.expected}`:`Available ${r.values.available}/${r.values.total}`}</td><td><Status>{r.status==='Accepted'?'Healthy':r.status==='Returned for correction'?'Critical':'Needs attention'}</Status>{r.reviewNote&&<small className="table-sub">{r.reviewNote}</small>}</td><td>{canReview&&r.status==='Submitted'?<div className="access-actions"><button onClick={()=>onReviewReport(r.id,'accept')}>Accept</button><button onClick={()=>{const note=window.prompt('Reason for returning this report?','Please verify the submitted figures.');if(note!==null)onReviewReport(r.id,'return',note)}}>Return</button></div>:r.status==='Returned for correction'&&r.submittedBy===user?.id?<button className="btn secondary small-btn" onClick={()=>onCorrectReport(r)}>Correct & resubmit</button>:'—'}</td></tr>)}</tbody></table>{!visibleReports.length&&<div className="empty-state">No operational reports in this scope yet.</div>}</div></section>
    <div className="tabs-row">{['Facilities','Beds & capacity','Staff attendance','Diagnostic tests'].map(t=><button key={t} onClick={()=>setTab(t)} className={cx('tab-button',tab===t&&'active')}>{t}</button>)}</div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h3>{tab}</h3><p>{tab==='Facilities'?'Facility-level operational summary':tab==='Beds & capacity'?'Availability and utilization by facility':tab==='Staff attendance'?'Reported attendance indicators':'Diagnostic service availability'}</p></div><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find facility..." /></div></div>
      <div className="table-wrap"><table><thead><tr><th>FACILITY</th><th>TYPE</th>{tab==='Beds & capacity'?<><th>OCCUPIED / TOTAL</th><th>AVAILABLE</th><th>UTILIZATION</th></>:tab==='Staff attendance'?<><th>ATTENDANCE</th><th>INDICATOR</th><th>LAST UPDATE</th></>:tab==='Diagnostic tests'?<><th>TESTS AVAILABLE</th><th>UNAVAILABLE</th><th>STATUS</th></>:<><th>FOOTFALL</th><th>ATTENDANCE</th><th>BED UTILIZATION</th></>}<th>DATA FRESHNESS</th></tr></thead><tbody>{filtered.map(f=><tr key={f.id}><td><div className="facility-cell"><span className="facility-icon"><Building2 size={16}/></span><span><b>{f.name}</b><small>{f.id}</small></span></div></td><td><span className="type-pill">{f.type}</span></td>{tab==='Beds & capacity'?<><td>{f.occupied} / {f.beds}</td><td><b>{f.beds-f.occupied}</b></td><td><div className="occupancy-cell"><div className="mini-progress"><span style={{width:`${f.occupied/f.beds*100}%`}}/></div><small>{Math.round(f.occupied/f.beds*100)}%</small></div></td></>:tab==='Staff attendance'?<><td><b className={f.attendance<75?'text-danger':''}>{f.attendance}%</b></td><td><Status>{f.attendance<75?'Critical':f.attendance<85?'Needs attention':'Healthy'}</Status></td><td>{f.updated}</td></>:tab==='Diagnostic tests'?<><td>{f.testsAvailable} / {f.tests}</td><td>{f.tests-f.testsAvailable}</td><td><Status>{f.testsAvailable===f.tests?'Healthy':'Needs attention'}</Status></td></>:<><td>{f.footfall}</td><td>{f.attendance}%</td><td>{Math.round(f.occupied/f.beds*100)}%</td></>}<td className="muted-text">{f.updated}</td></tr>)}</tbody></table>{filtered.length===0&&<EmptySearch term={query}/>}</div>
    </section>
    <div className="info-callout"><Clock3 size={18}/><div><b>Data freshness matters</b><p>Production workflows should display source, reporting period and last-verified timestamp. Missing reports should be marked as missing, not silently treated as zero activity.</p></div></div>
  </>
}

function InsightsPage({ medicines, onNavigate }) {
  const [horizon,setHorizon] = useState('14 days')
  const [medicineId,setMedicineId] = useState('MED-001')
  const [forecast,setForecast] = useState(null)
  const [forecastError,setForecastError] = useState('')
  const selected = medicines.find(m=>m.id===medicineId) || medicines[0]
  useEffect(()=>{
    if(!selected) return
    let cancelled=false
    apiFetch(`/api/forecast/${encodeURIComponent(selected.id)}?days=${Number.parseInt(horizon,10)}`).then(async r=>{const d=await readApiJson(r);if(!r.ok)throw new Error(d.error||'Could not load forecast');return d}).then(d=>{if(!cancelled){setForecast(d);setForecastError('')}}).catch(e=>{if(!cancelled)setForecastError(e.message)})
    return ()=>{cancelled=true}
  },[selected?.id,horizon])
  const series=(forecast?.series||[]).map((x,i)=>({...x,day:`Day ${i+1}`}))
  return <>
    <SectionTitle eyebrow="DECISION SUPPORT" title="AI insights" description="Review demand estimates and the rule-based stock risk explanation." action={<span className="status medium"><i/> Illustrative baseline</span>}/>
    <div className="insight-controls"><label>Medicine<select value={selected?.id||''} onChange={e=>setMedicineId(e.target.value)}>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} · {m.facility}</option>)}</select></label><label>Forecast horizon<select value={horizon} onChange={e=>setHorizon(e.target.value)}><option>7 days</option><option>14 days</option><option>30 days</option></select></label><div className="model-status"><span className="live-dot"/> API baseline <small>Not connected to a trained ML model</small></div></div>
    {forecastError&&<div className="info-callout"><AlertCircle size={18}/><div><b>Forecast unavailable</b><p>{forecastError}</p></div></div>}
    <div className="metric-grid three">
      <Metric label="Projected demand" value={forecast?fmt(forecast.projectedDemand):'—'} change={`${horizon} horizon`} trend="up" icon={Activity} tint="teal" foot={`${selected?.name||'Select medicine'} · illustrative units`}/>
      <Metric label="Current stock coverage" value={forecast?.coverageDays==null?'N/A':`${forecast.coverageDays} days`} change="Based on current stock / demand" trend="down" icon={Package} tint="amber" foot={`${fmt(forecast?.currentStock||0)} units in demo stock`}/>
      <Metric label="Shortage risk" value={forecast?.risk||'Loading'} change="Rule-based assessment" trend="down" icon={ShieldAlert} tint="red" foot={`Reorder point: ${fmt(forecast?.reorderPoint||0)}`}/>
    </div>
    <section className="panel forecast-panel"><div className="panel-header"><div><h3>Demand outlook</h3><p>Generated by the API from synthetic example demand history</p></div><span className="chart-legend"><i className="legend-actual"/> Sample history <i className="legend-forecast"/> Baseline</span></div><div className="forecast-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{top:10,right:12,left:-18,bottom:0}}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6477df" stopOpacity={.17}/><stop offset="95%" stopColor="#6477df" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf1f4" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#87919c'}} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#87919c'}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e8edf0',fontSize:12}}/><Area type="monotone" dataKey="forecast" stroke="#6477df" strokeWidth={2.5} strokeDasharray="5 4" fill="url(#forecastFill)"/><Area type="monotone" dataKey="actual" stroke="#0f9b8e" strokeWidth={2.5} fill="transparent" connectNulls={false}/></AreaChart></ResponsiveContainer></div><div className="forecast-foot"><span><i className="legend-actual"/> Sample demand inputs</span><span><i className="legend-forecast"/> Calculated baseline</span><span><AlertCircle size={14}/> Synthetic data; not a validated forecast.</span></div></section>
    <div className="bottom-grid">
      <section className="panel"><div className="panel-header"><div><h3>Why this risk was flagged</h3><p>Current stock assessment for {selected?.name||'selected medicine'}</p></div><span className={`status ${riskClass(forecast?.risk)}`}><i/> {forecast?.risk||'Loading'}</span></div><div className="reason-list"><div><span className="reason-number">01</span><span><b>Stock cover versus replenishment lead time</b><small>{forecast?.coverageDays==null?'Demand is not available.':`${forecast.coverageDays} days of cover against a ${forecast.leadTimeDays}-day lead time.`}</small></span></div><div><span className="reason-number">02</span><span><b>Safety stock and reorder point</b><small>Safety stock estimate: {fmt(forecast?.safetyStock||0)}; reorder point: {fmt(forecast?.reorderPoint||0)} units.</small></span></div><div><span className="reason-number">03</span><span><b>Data limitations</b><small>Forecast history is generated from a small synthetic pattern and should not guide real clinical supply decisions.</small></span></div></div></section>
      <section className="panel"><div className="panel-header"><div><h3>Recommended next steps</h3><p>Decision-support suggestions</p></div></div><div className="recommendation"><span className="recommend-icon"><Truck size={18}/></span><div><b>Review a transfer from a nearby facility</b><p>Check transferable stock and donor reserve before approval.</p><button className="text-button" onClick={()=>onNavigate('Redistribution')}>Review options <ArrowRight size={14}/></button></div></div><div className="recommendation"><span className="recommend-icon amber"><CalendarClock size={18}/></span><div><b>Review replenishment threshold</b><p>Use the reorder point as a prompt for staff review, not as an automatic order.</p><button className="text-button" onClick={()=>onNavigate('Medicine inventory')}>Open inventory <ArrowRight size={14}/></button></div></div></section>
    </div>
    <div className="info-callout"><BrainCircuit size={18}/><div><b>Forecast quality is a product requirement</b><p>Before operational use, evaluate against time-based holdout data, compare with a simple baseline, report uncertainty and document the data period/model version.</p></div></div>
  </>
}

function RedistributionPage({ user, facilities, medicines, transfers, onCreate, onApprove, onReject, onDispatch, onReceive }) {
  const [creating,setCreating]=useState(false), [step,setStep]=useState(null), [busy,setBusy]=useState(false)
  const [form,setForm]=useState({source:'',destination:'',medicineId:'',quantity:'',urgency:'Normal',note:''})
  const canCreate=[ROLE_ADMIN,ROLE_MANAGER,ROLE_PHARMACY].includes(user?.role), canReview=[ROLE_ADMIN,ROLE_MANAGER].includes(user?.role)
  const sourceMeds=medicines.filter(m=>m.facility===form.source&&Number(m.stock)>0)
  const startCreate=()=>{const source=facilities[0]?.name||'';setForm({source,destination:facilities.find(f=>f.name!==source)?.name||'',medicineId:medicines.find(m=>m.facility===source&&Number(m.stock)>0)?.id||'',quantity:'',urgency:'Normal',note:''});setCreating(true)}
  const submitCreate=async e=>{e.preventDefault();setBusy(true);const ok=await onCreate({...form,quantity:Number(form.quantity)});setBusy(false);if(ok)setCreating(false)}
  const submitStep=async e=>{e.preventDefault();setBusy(true);const ok=step.type==='dispatch'?await onDispatch(step.id,step.quantity,step.note):await onReceive(step.id,step.quantity,step.note);setBusy(false);if(ok)setStep(null)}
  const canDispatch=t=>[ROLE_ADMIN,ROLE_MANAGER,ROLE_PHARMACY].includes(user?.role)&&facilities.some(f=>f.name===t.source)&&String(t.status||'').startsWith('Approved')
  const canReceive=t=>[ROLE_ADMIN,ROLE_MANAGER,ROLE_PHARMACY].includes(user?.role)&&facilities.some(f=>f.name===t.destination)&&t.status==='Dispatched — awaiting receipt'
  return <>
    <SectionTitle eyebrow="SUPPLY NETWORK" title="Smart redistribution" description="Request, review, dispatch and confirm receipt as separate, auditable steps." action={canCreate&&<button className="btn primary" onClick={startCreate}><Plus size={16}/> New request</button>}/>
    <div className="metric-grid three"><Metric label="Open transfers" value={transfers.filter(t=>!String(t.status||'').startsWith('Completed')&&t.status!=='Rejected').length} change="Requires next step" icon={Truck} tint="teal" foot="Request through receipt"/><Metric label="Awaiting review" value={transfers.filter(t=>!t.status||['Awaiting review','Needs review'].includes(t.status)).length} change="Decision needed" icon={AlertCircle} tint="red" foot="Approval does not move stock"/><Metric label="Completed" value={transfers.filter(t=>String(t.status||'').startsWith('Completed')).length} change="Receipt recorded" icon={CheckCircle2} tint="blue" foot="Review discrepancy flags"/></div>
    <section className="panel transfer-panel"><div className="panel-header"><div><h3>Transfer queue</h3><p>Dispatch reduces source stock. Receipt adds the actual received quantity at the destination.</p></div><span className="select-button"><Filter size={14}/> {transfers.length} records</span></div><div className="transfer-list">{transfers.map(t=><div className="transfer-card" key={t.id}><div className="transfer-top"><div className="transfer-id">{t.id}<span> · {t.createdAt?new Date(t.createdAt).toLocaleDateString():'Existing request'}</span></div><Status>{t.urgency||'Normal'}</Status></div><h4>{t.medicine}</h4><div className="route-row"><div className="route-stop"><span className="route-dot donor"/><div><small>FROM · SOURCE</small><b>{t.source}</b><span>{t.available??'—'} units at request time</span></div></div><div className="route-connector"><ArrowRight size={17}/></div><div className="route-stop"><span className="route-dot recipient"/><div><small>TO · DESTINATION</small><b>{t.destination}</b><span>Requested: {t.requested} units</span></div></div></div><div className="workflow-meta"><span>Dispatched: {t.dispatchedQuantity??'—'}</span><span>Received: {t.receivedQuantity??'—'}</span></div>{t.history?.length>0&&<details className="transfer-history"><summary>History ({t.history.length})</summary>{t.history.map((h,i)=><p key={i}><b>{h.state}</b><small>{h.at?new Date(h.at).toLocaleString():''}{h.note?` · ${h.note}`:''}</small></p>)}</details>}{t.discrepancy&&<div className="modal-note"><AlertCircle size={15}/> Dispatched {t.discrepancy.dispatched}; received {t.discrepancy.received}; difference {t.discrepancy.quantityDifference}. Follow-up required.</div>}<div className="transfer-bottom"><span className={cx('status',String(t.status||'').startsWith('Completed')?'healthy':t.status==='Rejected'?'critical':String(t.status||'').startsWith('Approved')?'medium':'neutral')}><i/>{t.status||'Awaiting review'}</span><div className="transfer-actions">{canReview&&!['Rejected'].includes(t.status)&&!String(t.status||'').startsWith('Approved')&&!String(t.status||'').startsWith('Dispatched')&&!String(t.status||'').startsWith('Completed')&&<><button className="btn primary small-btn" onClick={()=>onApprove(t.id)}><Check size={14}/> Approve</button><button className="btn secondary small-btn" onClick={()=>onReject(t.id)}>Reject</button></>}{canDispatch(t)&&<button className="btn primary small-btn" onClick={()=>setStep({type:'dispatch',id:t.id,quantity:String(t.requested),note:''})}><Truck size={14}/> Dispatch</button>}{canReceive(t)&&<button className="btn primary small-btn" onClick={()=>setStep({type:'receive',id:t.id,quantity:String(t.dispatchedQuantity),note:''})}><CheckCircle2 size={14}/> Confirm receipt</button>}</div></div></div>)}{!transfers.length&&<div className="empty-state"><Truck size={22}/><b>No transfers yet</b><span>Create a request when source and destination are known.</span></div>}</div></section>
    <div className="info-callout"><ShieldAlert size={18}/><div><b>Stock integrity</b><p>Approval does not change stock. Dispatch and receipt create separate stock movements. Quantity discrepancies are recorded for follow-up. Synthetic demo data is not a clinical supply recommendation.</p></div></div>
    {creating&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-head"><div><h3>New transfer request</h3><p>Select a medicine record at the source facility.</p></div><button className="btn secondary small-btn" onClick={()=>setCreating(false)}><X size={15}/></button></div><form className="modal-form" onSubmit={submitCreate}><label>Source facility<select required value={form.source} onChange={e=>{const source=e.target.value;setForm(v=>({...v,source,medicineId:medicines.find(m=>m.facility===source&&Number(m.stock)>0)?.id||''}))}}><option value="">Choose source</option>{facilities.map(f=><option key={f.id} value={f.name}>{f.name}</option>)}</select></label><label>Destination facility<input required list="transfer-destinations" value={form.destination} onChange={e=>setForm(v=>({...v,destination:e.target.value}))} placeholder="Enter exact facility name"/><datalist id="transfer-destinations">{facilities.filter(f=>f.name!==form.source).map(f=><option key={f.id} value={f.name}/>)}</datalist></label><label>Medicine<select required value={form.medicineId} onChange={e=>setForm(v=>({...v,medicineId:e.target.value}))}><option value="">Choose medicine</option>{sourceMeds.map(m=><option key={m.id} value={m.id}>{m.name} · {m.stock} {m.unit||'units'}</option>)}</select></label><label>Quantity<input required type="number" min="1" step="1" max={sourceMeds.find(m=>m.id===form.medicineId)?.stock||undefined} value={form.quantity} onChange={e=>setForm(v=>({...v,quantity:e.target.value}))}/></label><label>Urgency<select value={form.urgency} onChange={e=>setForm(v=>({...v,urgency:e.target.value}))}><option>Normal</option><option>High</option><option>Critical</option></select></label><label>Reason / note<input maxLength="500" value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))}/></label><div className="modal-note"><ShieldAlert size={15}/> Submission does not approve or reserve stock.</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="btn primary" disabled={busy||!form.source||!form.destination||form.source===form.destination||!form.medicineId||Number(form.quantity)<=0}>{busy?'Submitting…':'Submit request'}</button></div></form></section></div>}
    {step&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setStep(null)}}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-head"><div><h3>{step.type==='dispatch'?'Dispatch transfer':'Confirm receipt'}</h3><p>{step.type==='dispatch'?'Record the quantity leaving source stock.':'Record the quantity actually received.'}</p></div><button className="btn secondary small-btn" onClick={()=>setStep(null)}><X size={15}/></button></div><form className="modal-form" onSubmit={submitStep}><label>{step.type==='dispatch'?'Quantity dispatched':'Quantity received'}<input required type="number" min={step.type==='dispatch'?1:0} step="1" max={step.type==='dispatch'?(transfers.find(t=>t.id===step.id)?.requested||undefined):(transfers.find(t=>t.id===step.id)?.dispatchedQuantity||undefined)} value={step.quantity} onChange={e=>setStep(v=>({...v,quantity:e.target.value}))}/></label><label>Note / discrepancy details<input maxLength="500" value={step.note} onChange={e=>setStep(v=>({...v,note:e.target.value}))}/></label><div className="modal-note"><AlertCircle size={15}/>{step.type==='dispatch'?'The API checks stock and reserve.':'Any mismatch is recorded for follow-up.'}</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setStep(null)}>Cancel</button><button className="btn primary" disabled={busy||!Number.isInteger(Number(step.quantity))||(step.type==='dispatch'?Number(step.quantity)<=0:Number(step.quantity)<0)}>{busy?'Saving…':step.type==='dispatch'?'Confirm dispatch':'Save receipt'}</button></div></form></section></div>}
  </>
}

function InterventionsPage({ cases, facilities=[], onToggle, onCreate, onUpdate, query, setQuery }) {
  const [creating,setCreating]=useState(false)
  const [form,setForm]=useState({facility:facilities[0]?.name||'',issue:'',severity:'High',owner:'',due:'',note:''})
  const filtered = cases.filter(c=>`${c.facility} ${c.issue} ${c.owner} ${c.id} ${c.status}`.toLowerCase().includes(query.toLowerCase()))
  const submit=async e=>{e.preventDefault();const ok=await onCreate(form);if(ok){setCreating(false);setForm({facility:facilities[0]?.name||'',issue:'',severity:'High',owner:'',due:'',note:''})}}
  const addUpdate=async c=>{const note=window.prompt(`Progress update for ${c.id}:`);if(!note)return;const evidence=window.prompt('Evidence / verification reference (optional unless resolving):','');if(evidence===null)return;const status=window.prompt('Status: Open, In progress, or Resolved',c.status);if(!status)return;await onUpdate(c.id,{note,evidence,status})}
  return <>
    <SectionTitle eyebrow="DISTRICT OVERSIGHT" title="Intervention center" description="Create corrective actions, assign accountability, record evidence and verify closure." action={<button className="btn primary" onClick={()=>setCreating(true)}><Plus size={16}/> New intervention</button>}/>
    <div className="metric-grid three"><Metric label="Open interventions" value={cases.filter(c=>c.status==='Open').length} change="Needs assignment" trend="down" icon={ShieldAlert} tint="red" foot="Awaiting action"/><Metric label="In progress" value={cases.filter(c=>c.status==='In progress').length} change="Being followed up" trend="up" icon={Activity} tint="amber" foot="Assigned actions"/><Metric label="Resolved" value={cases.filter(c=>c.status==='Resolved').length} change="Evidence recorded" trend="up" icon={CheckCircle2} tint="teal" foot="Review closure trail"/></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h3>Facility action queue</h3><p>Priority, owner, deadline and accountable progress</p></div><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search interventions..." /></div></div><div className="table-wrap"><table><thead><tr><th>CASE</th><th>FACILITY / ISSUE</th><th>SEVERITY</th><th>OWNER</th><th>DUE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td><b>{c.id}</b><div><small>{c.history?.length||0} updates · {c.evidence?.length||0} evidence</small></div></td><td><div className="case-cell"><b>{c.facility}</b><small>{c.issue}</small></div></td><td><Status>{c.severity}</Status></td><td>{c.owner}</td><td>{c.due}</td><td><Status>{c.status}</Status></td><td><div className="intervention-actions"><button className="btn secondary small-btn" onClick={()=>addUpdate(c)}>Add update</button>{c.status==='Resolved'?<button className="btn secondary small-btn" onClick={()=>onToggle(c.id)}>Reopen</button>:<button className="btn primary small-btn" onClick={()=>onToggle(c.id)}>Resolve</button>}</div>{(c.history?.length>0||c.evidence?.length>0)&&<details className="transfer-history"><summary>Audit trail</summary>{(c.history||[]).map((h,i)=><p key={h.id||i}><b>{h.status||h.type||'Update'}</b><small>{h.at?new Date(h.at).toLocaleString():''}{h.note?` · ${h.note}`:''}</small></p>)}{(c.evidence||[]).map((ev,i)=><p key={ev.id||i}><b>Evidence</b><small>{ev.description} · {ev.at?new Date(ev.at).toLocaleString():''}</small></p>)}</details>}</td></tr>)}</tbody></table>{filtered.length===0&&<EmptySearch term={query}/>}</div></section>
    <div className="info-callout"><ClipboardCheck size={18}/><div><b>Evidence-based closure</b><p>Each intervention has an owner and due date. Closing requires a progress update and evidence or a verification note; activity is recorded in the audit trail. Do not include patient-identifying information.</p></div></div>
    {creating&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-head"><div><h3>Create intervention</h3><p>Assign a corrective action to a facility.</p></div><button className="btn secondary small-btn" onClick={()=>setCreating(false)}><X size={15}/></button></div><form className="modal-form" onSubmit={submit}><label>Facility<select required value={form.facility} onChange={e=>setForm(v=>({...v,facility:e.target.value}))}><option value="">Choose facility</option>{facilities.map(f=><option key={f.id} value={f.name}>{f.name}</option>)}</select></label><label>Issue / corrective action<input required minLength={4} maxLength={300} value={form.issue} onChange={e=>setForm(v=>({...v,issue:e.target.value}))} placeholder="Describe the risk and required action"/></label><label>Severity<select value={form.severity} onChange={e=>setForm(v=>({...v,severity:e.target.value}))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label>Accountable owner / role<input required maxLength={120} value={form.owner} onChange={e=>setForm(v=>({...v,owner:e.target.value}))} placeholder="e.g. Facility pharmacist"/></label><label>Due date / deadline<input required maxLength={80} value={form.due} onChange={e=>setForm(v=>({...v,due:e.target.value}))} placeholder="e.g. 2026-10-20 17:00"/></label><label>Context / initial note<input maxLength={500} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="Optional context, no patient identifiers"/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="btn primary" disabled={!form.facility||form.issue.trim().length<4||!form.owner.trim()||!form.due.trim()}>Create intervention</button></div></form></section></div>}
  </>
}

// Allow child panels to navigate and show feedback without coupling to the shell.
window.addEventListener('navigate-prototype', e => {
  window.dispatchEvent(new CustomEvent('prototype-navigate-request', { detail: e.detail }))
})
