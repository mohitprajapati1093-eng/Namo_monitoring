import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto'
import {createServer as createHttpServer} from 'node:http'
import {createServer as createViteServer} from 'vite'
import {assessStockRisk,computeSafetyStock,reorderPoint,getTransferFeasibility} from './src/services/inventory-intelligence.mjs'
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'..'), dbPath=process.env.SWASTHYAGRID_DB_PATH || path.join(here,'data','db.json')
const app=express(), port=Number(process.env.PORT||3000), isDev=process.argv.includes('--dev'), httpServer=createHttpServer(app)

// GitHub Pages is a separate origin from the Express API. Allow the configured
// frontend origin(s) and local development, including browser preflight requests.
const allowedOrigins = new Set([
  'https://mohitprajapati1093-eng.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.FRONTEND_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean)
])
app.use((req,res,next) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204)
  next()
})
app.use(express.json({limit:'1mb'}))
let db, writeQueue=Promise.resolve()
// Serialize JSON writes. Recover the queue after a failed write so one transient
// filesystem error does not permanently block every later save.
const save=()=>{writeQueue=writeQueue.catch(()=>{}).then(()=>fs.writeFile(dbPath,JSON.stringify(db,null,2)));return writeQueue}
const medicine=id=>db.medicines.find(m=>m.id===id)
const notFound=(res,msg='Record not found')=>res.status(404).json({error:msg})
function risk(m){const r=assessStockRisk(m,7,0);m.status=r.risk;return r}
function alerts(){return [...db.medicines.map(m=>({m,r:risk(m)})).filter(x=>x.r.risk!=='Healthy').map(({m,r})=>({id:`STOCK-${m.id}`,severity:r.risk==='Critical'?'Critical':'High',title:`${m.name} stock risk`,facility:m.facility,detail:`Estimated coverage: ${r.coverageDays??'unknown'} days; verify replenishment and data freshness.`,time:'Updated just now',kind:'Inventory'})),...db.alerts.filter(a=>a.kind!=='Inventory')]}
db=JSON.parse(await fs.readFile(dbPath,'utf8'))
db.stockRequests ||= []
db.operationsReports ||= []
db.notificationReads ||= {}
// Local-only demo identity store. Passwords are scrypt hashes; sessions are random bearer tokens
// persisted in JSON for this single-process prototype. Replace with production identity/session storage before deployment.
db.users ||= []
db.sessions ||= []
db.auditEvents ||= []
const roles=['District Administrator','Facility Manager','Pharmacist / Storekeeper','Clinical / Operations Staff']
const passwordHash=password=>scryptSync(String(password), 'swasthyagrid-local-demo-v1', 64).toString('hex')
const safeUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,district:u.district,facilityIds:u.facilityIds||[],status:u.status})
const demoAccounts=[
 {name:'District Demo Admin',email:'district.admin@demo.local',password:'Demo@12345',role:roles[0],district:'Bhopal',facilityIds:[]},
 {name:'Facility Demo Manager',email:'facility.manager@demo.local',password:'Demo@12345',role:roles[1],district:'Bhopal',facilityIds:['PHC-014']},
 {name:'Demo Pharmacist',email:'pharmacist@demo.local',password:'Demo@12345',role:roles[2],district:'Bhopal',facilityIds:['PHC-014']},
 {name:'Demo Operations Staff',email:'operations.staff@demo.local',password:'Demo@12345',role:roles[3],district:'Bhopal',facilityIds:['PHC-014']}
]
for (const d of demoAccounts) if(!db.users.some(u=>u.email===d.email)) db.users.push({id:`USR-${randomUUID().slice(0,8).toUpperCase()}`,name:d.name,email:d.email,passwordHash:passwordHash(d.password),role:d.role,district:d.district,facilityIds:d.facilityIds,status:'approved',createdAt:new Date().toISOString()})
await save()
const authTokens=new Map()
const authTokenFor=req=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7):''}
const currentUser=req=>{const token=authTokenFor(req);const session=db.sessions.find(x=>x.token===token&&Date.parse(x.expiresAt)>Date.now());return session?db.users.find(u=>u.id===session.userId&&u.status==='approved'):null}
const issueSession=async user=>{const token=randomBytes(32).toString('hex');db.sessions=db.sessions.filter(x=>Date.parse(x.expiresAt)>Date.now());db.sessions.push({token,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+12*60*60*1000).toISOString()});await save();return token}
const audit=async(user,action,details={})=>{db.auditEvents.unshift({id:`AUD-${randomUUID().slice(0,8).toUpperCase()}`,actorId:user?.id||null,action,details,createdAt:new Date().toISOString()});db.auditEvents=db.auditEvents.slice(0,1000);await save()}
app.get('/api/auth/demo-accounts',(_q,res)=>res.json({demoMode:true,accounts:demoAccounts.map(({email,password,role,name})=>({email,password,role,name}))}))
app.post('/api/auth/register',async(req,res)=>{const b=req.body||{},name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),role=String(b.role||''),district=String(b.district||'Bhopal').trim();if(name.length<2||name.length>100)return res.status(400).json({error:'Enter a name between 2 and 100 characters.'});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});if(password.length<8)return res.status(400).json({error:'Password must contain at least 8 characters.'});if(!roles.includes(role)||role===roles[0])return res.status(400).json({error:'Choose a valid non-administrator role. District administrator access must be provisioned separately.'});if(db.users.some(u=>u.email===email))return res.status(409).json({error:'An account with this email already exists.'});const user={id:`USR-${randomUUID().slice(0,8).toUpperCase()}`,name,email,passwordHash:passwordHash(password),role,district,facilityIds:Array.isArray(b.facilityIds)?b.facilityIds.filter(id=>db.facilities.some(f=>f.id===id&&f.district===district)):[],status:'pending',createdAt:new Date().toISOString()};db.users.push(user);await audit(null,'account.registration_requested',{userId:user.id,role,district});res.status(201).json({status:'pending',message:'Registration submitted. A district administrator must approve your account before you can sign in.',user:safeUser(user)})})
app.post('/api/auth/login',async(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||''),user=db.users.find(u=>u.email===email);if(!user||!timingSafeEqual(Buffer.from(user.passwordHash||''),Buffer.from(passwordHash(password))))return res.status(401).json({error:'Email or password is incorrect.'});if(user.status!=='approved')return res.status(403).json({error:user.status==='pending'?'Your account is awaiting district administrator approval.':'This account is not approved for access.'});const token=await issueSession(user);await audit(user,'auth.login');res.json({token,user:safeUser(user),expiresInSeconds:43200,demoMode:true})})
app.get('/api/auth/me',(req,res)=>{const user=currentUser(req);if(!user)return res.status(401).json({error:'Sign in to continue.'});res.json({user:safeUser(user),demoMode:true})})
app.post('/api/auth/logout',async(req,res)=>{const token=authTokenFor(req),user=currentUser(req);db.sessions=db.sessions.filter(x=>x.token!==token);if(user)await audit(user,'auth.logout');else await save();res.json({ok:true})})
app.get('/api/auth/users',(req,res)=>{const user=currentUser(req);if(!user||user.role!==roles[0])return res.status(403).json({error:'District administrator access required.'});res.json({users:db.users.filter(u=>u.district===user.district).map(safeUser)})})
app.post('/api/auth/users/:id/decision',async(req,res)=>{const actor=currentUser(req);if(!actor||actor.role!==roles[0])return res.status(403).json({error:'District administrator access required.'});const target=db.users.find(u=>u.id===req.params.id&&u.district===actor.district);if(!target)return notFound(res,'User not found in your district');if(target.id===actor.id)return res.status(400).json({error:'You cannot change your own account status.'});const decision=req.body?.decision;if(!['approve','reject'].includes(decision))return res.status(400).json({error:'decision must be approve or reject'});target.status=decision==='approve'?'approved':'rejected';if(decision==='reject')db.sessions=db.sessions.filter(x=>x.userId!==target.id);await audit(actor,`account.${decision}`,{userId:target.id});res.json({user:safeUser(target)})})
app.use('/api', (req,res,next)=>{if(req.path==='/health'||req.path.startsWith('/auth/'))return next();const user=currentUser(req);if(!user)return res.status(401).json({error:'Authentication required. Sign in with an approved demo account.'});req.user=user;next()})
const canWrite=req=>[roles[0],roles[1],roles[2]].includes(req.user?.role)
const scopedFacilities=user=>db.facilities.filter(f=>f.district===user.district&&(user.role===roles[0]||user.facilityIds?.includes(f.id)))

app.get('/api/health',(_q,s)=>s.json({status:'ok',service:'Namo Monitoring API',persistence:'local JSON file',demoMode:true}))
app.get('/api/bootstrap',(q,s)=>{db.medicines.forEach(risk);const fs=scopedFacilities(q.user),ids=new Set(fs.map(f=>f.id)),meds=db.medicines.filter(m=>m.district===q.user.district||fs.some(f=>f.name===m.facility||f.id===m.facilityId));s.json({facilities:fs,medicines:meds,alerts:alerts().filter(a=>fs.some(f=>f.name===a.facility||f.id===a.facility)),transfers:db.transfers.filter(t=>fs.some(f=>f.name===t.source||f.name===t.destination)),interventions:db.interventions.filter(c=>!c.facilityId||ids.has(c.facilityId)),transactions:db.transactions.filter(t=>fs.some(f=>f.name===t.facility)),stockRequests:db.stockRequests.filter(r=>fs.some(f=>f.name===r.facility||f.name===r.requestedFrom)),operationsReports:db.operationsReports.filter(r=>q.user.role===roles[0]||fs.some(f=>f.id===r.facilityId)),dashboard:dashboardStats(fs),demoMode:true,user:safeUser(q.user)})})
function dashboardStats(facilities=db.facilities){const names=new Set(facilities.map(f=>f.name)),total=facilities.reduce((n,f)=>n+Number(f.beds||0),0),occupied=facilities.reduce((n,f)=>n+Number(f.occupied||0),0),footfall=facilities.reduce((n,f)=>n+Number(f.footfall||0),0),attendance=facilities.length?Math.round(facilities.reduce((n,f)=>n+Number(f.attendance||0),0)/facilities.length*10)/10:0;return {facilitiesReporting:facilities.length,facilitiesTotal:facilities.length,stockRisks:db.medicines.filter(m=>names.has(m.facility)&&risk(m).risk!=='Healthy').length,bedsTotal:total,bedsOccupied:occupied,bedsAvailable:total-occupied,occupancyRate:total?Math.round(occupied/total*100):0,footfall,attendance,source:'synthetic demo data'}}
app.get('/api/dashboard',(q,s)=>s.json(dashboardStats(scopedFacilities(q.user))))
app.get('/api/operations-reports',(req,res)=>{
  const facilities=scopedFacilities(req.user),ids=new Set(facilities.map(f=>f.id))
  res.json(db.operationsReports.filter(r=>req.user.role===roles[0]||ids.has(r.facilityId)))
})
app.post('/api/operations-reports',async(req,res)=>{
  const user=req.user, body=req.body||{}
  if(![roles[1],roles[3]].includes(user.role))return res.status(403).json({error:'Only facility managers and clinical/operations staff can submit facility reports.'})
  const facilityId=String(body.facilityId||''), facility=scopedFacilities(user).find(f=>f.id===facilityId)
  if(!facility)return res.status(403).json({error:'Facility is outside your assigned scope.'})
  const type=String(body.type||'')
  const allowed=['footfall','beds','attendance','diagnostics']
  if(!allowed.includes(type))return res.status(400).json({error:'Report type must be footfall, beds, attendance or diagnostics.'})
  const date=String(body.date||new Date().toISOString().slice(0,10))
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))return res.status(400).json({error:'Enter a valid reporting date.'})
  const number=(value,label,max=100000)=>{const n=Number(value);if(!Number.isInteger(n)||n<0||n>max)throw new Error(`${label} must be a whole number between 0 and ${max}.`);return n}
  let values={}
  try {
    if(type==='footfall') values={count:number(body.count,'Footfall')}
    if(type==='beds') {values={total:number(body.total,'Total beds',10000),occupied:number(body.occupied,'Occupied beds',10000),unavailable:number(body.unavailable||0,'Unavailable beds',10000)};if(values.occupied+values.unavailable>values.total)throw new Error('Occupied plus unavailable beds cannot exceed total beds.')}
    if(type==='attendance') values={present:number(body.present,'Staff present',10000),expected:number(body.expected,'Expected staff',10000)}
    if(type==='diagnostics') {values={available:number(body.available,'Available tests',10000),total:number(body.total,'Total tests',10000),unavailableNotes:String(body.unavailableNotes||'').trim().slice(0,300)};if(values.available>values.total)throw new Error('Available tests cannot exceed total tests.')}
  } catch(e){return res.status(400).json({error:e.message})}
  const report={id:`OPR-${randomUUID().slice(0,8).toUpperCase()}`,facilityId:facility.id,facility:facility.name,district:facility.district,type,date,values,note:String(body.note||'').trim().slice(0,500),status:'Submitted',submittedBy:user.id,submittedByName:user.name,submittedAt:new Date().toISOString(),reviewedBy:null,reviewedAt:null,reviewNote:''}
  db.operationsReports.unshift(report)
  if(type==='footfall')facility.footfall=values.count
  if(type==='beds'){facility.beds=values.total;facility.occupied=values.occupied;facility.unavailableBeds=values.unavailable}
  if(type==='attendance')facility.attendance=values.expected?Math.round(values.present/values.expected*100):0
  if(type==='diagnostics'){facility.tests=values.total;facility.testsAvailable=values.available;facility.diagnosticNote=values.unavailableNotes}
  facility.updated=new Date().toISOString()
  await audit(user,'facility.operations_report_submitted',{reportId:report.id,facilityId,type,date})
  res.status(201).json({report,facility})
})
app.post('/api/operations-reports/:id/resubmit',async(req,res)=>{
  const user=req.user,report=db.operationsReports.find(r=>r.id===req.params.id)
  if(!report)return notFound(res,'Operational report not found')
  if(report.submittedBy!==user.id)return res.status(403).json({error:'Only the original submitter can correct this report.'})
  if(report.status!=='Returned for correction')return res.status(409).json({error:'Only reports returned for correction can be resubmitted.'})
  if(![roles[1],roles[3]].includes(user.role)||!scopedFacilities(user).some(f=>f.id===report.facilityId))return res.status(403).json({error:'Report is outside your assigned facility scope.'})
  const body=req.body||{},number=(value,label,max=100000)=>{const n=Number(value);if(!Number.isInteger(n)||n<0||n>max)throw new Error(`${label} must be a whole number between 0 and ${max}.`);return n}
  let values={}
  try {
    if(report.type==='footfall')values={count:number(body.count,'Footfall')}
    if(report.type==='beds'){values={total:number(body.total,'Total beds',10000),occupied:number(body.occupied,'Occupied beds',10000),unavailable:number(body.unavailable||0,'Unavailable beds',10000)};if(values.occupied+values.unavailable>values.total)throw new Error('Occupied plus unavailable beds cannot exceed total beds.')}
    if(report.type==='attendance')values={present:number(body.present,'Staff present',10000),expected:number(body.expected,'Expected staff',10000)}
    if(report.type==='diagnostics'){values={available:number(body.available,'Available tests',10000),total:number(body.total,'Total tests',10000),unavailableNotes:String(body.unavailableNotes||'').trim().slice(0,300)};if(values.available>values.total)throw new Error('Available tests cannot exceed total tests.')}
  }catch(e){return res.status(400).json({error:e.message})}
  const facility=db.facilities.find(f=>f.id===report.facilityId);if(!facility)return notFound(res,'Report facility not found')
  report.values=values;report.note=String(body.note||report.note||'').trim().slice(0,500);report.status='Submitted';report.submittedAt=new Date().toISOString();report.reviewedBy=null;report.reviewedAt=null;report.reviewNote='';report.correctionCount=(report.correctionCount||0)+1
  if(report.type==='footfall')facility.footfall=values.count
  if(report.type==='beds'){facility.beds=values.total;facility.occupied=values.occupied;facility.unavailableBeds=values.unavailable}
  if(report.type==='attendance')facility.attendance=values.expected?Math.round(values.present/values.expected*100):0
  if(report.type==='diagnostics'){facility.tests=values.total;facility.testsAvailable=values.available;facility.diagnosticNote=values.unavailableNotes}
  facility.updated=new Date().toISOString()
  await audit(user,'facility.operations_report_resubmitted',{reportId:report.id,facilityId:report.facilityId,correctionCount:report.correctionCount})
  res.json({report,facility})
})
app.post('/api/operations-reports/:id/review',async(req,res)=>{
  const user=req.user
  if(![roles[0],roles[1]].includes(user.role))return res.status(403).json({error:'Only district administrators and facility managers can review operational reports.'})
  const report=db.operationsReports.find(r=>r.id===req.params.id)
  if(!report)return notFound(res,'Operational report not found')
  if(user.role!==roles[0]&&!scopedFacilities(user).some(f=>f.id===report.facilityId))return res.status(403).json({error:'Report is outside your assigned facility scope.'})
  if(report.status!=='Submitted')return res.status(409).json({error:'Only submitted reports can be reviewed.'})
  const decision=String(req.body?.decision||'')
  if(!['accept','return'].includes(decision))return res.status(400).json({error:'Decision must be accept or return.'})
  report.status=decision==='accept'?'Accepted':'Returned for correction';report.reviewedBy=user.id;report.reviewedAt=new Date().toISOString();report.reviewNote=String(req.body?.note||'').trim().slice(0,500)
  await audit(user,`facility.operations_report_${decision}`,{reportId:report.id,facilityId:report.facilityId})
  res.json({report})
})
app.get('/api/notifications',(req,res)=>{
  const user=req.user,facilities=scopedFacilities(user),ids=new Set(facilities.map(f=>f.id)),names=new Set(facilities.map(f=>f.name)),items=[]
  const add=(id,title,detail,kind,page,at)=>items.push({id,title,detail,kind,page,at:at||new Date().toISOString(),read:(db.notificationReads[user.id]||[]).includes(id)})
  for(const r of db.operationsReports){if(!ids.has(r.facilityId))continue
    if(r.status==='Submitted'&&[roles[0],roles[1]].includes(user.role))add(`report:${r.id}:submitted`,'Operations report needs review',`${r.facility} · ${r.type} · ${r.date}`,'Report','Facility operations',r.submittedAt)
    if(r.submittedBy===user.id&&r.status==='Returned for correction')add(`report:${r.id}:returned`,'Report returned for correction',`${r.facility} · ${r.reviewNote||'Please review the reviewer note.'}`,'Report','Facility operations',r.reviewedAt)
    if(r.submittedBy===user.id&&r.status==='Accepted')add(`report:${r.id}:accepted`,'Operations report accepted',`${r.facility} · ${r.type} · ${r.date}`,'Report','Facility operations',r.reviewedAt)
  }
  for(const t of db.transfers||[]){if(user.role!==roles[0]&&!names.has(t.source)&&!names.has(t.destination))continue
    if(['Pending','Needs review'].includes(t.status)&&[roles[0],roles[1]].includes(user.role))add(`transfer:${t.id}:review`,'Transfer needs review',`${t.medicine} · ${t.source} → ${t.destination}`,'Transfer','Redistribution',t.createdAt)
    if(t.status==='Approved — dispatch pending'&&names.has(t.source))add(`transfer:${t.id}:dispatch`,'Approved transfer awaiting dispatch',`${t.medicine} · ${t.requested} units from ${t.source}`,'Transfer','Redistribution',t.review?.reviewedAt)
    if(t.status==='Dispatched — awaiting receipt'&&names.has(t.destination))add(`transfer:${t.id}:receipt`,'Transfer awaiting receipt',`${t.medicine} · ${t.dispatchedQuantity||t.requested} units to ${t.destination}`,'Transfer','Redistribution',t.dispatchedAt)
    if(String(t.status).includes('discrepancy')&&(names.has(t.source)||names.has(t.destination)||user.role===roles[0]))add(`transfer:${t.id}:discrepancy`,'Transfer receipt discrepancy',`${t.medicine} · ${t.source} → ${t.destination}`,'Transfer','Redistribution',t.receivedAt)
  }
  for(const r of db.stockRequests||[]){if(user.role!==roles[0]&&!names.has(r.facility)&&!names.has(r.requestedFrom))continue
    if(r.status==='Pending'&&[roles[0],roles[1]].includes(user.role))add(`stock:${r.id}:pending`,'Stock request needs review',`${r.medicineName} · ${r.quantity} units · ${r.facility}`,'Stock request','Workflow inbox',r.requestedAt)
    if(r.requestedBy===user.id&&r.status!=='Pending')add(`stock:${r.id}:${r.status}`,'Stock request updated',`${r.medicineName} · ${r.status}`,'Stock request','Workflow inbox',r.reviewedAt||r.updatedAt)
  }
  items.sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0));res.json({notifications:items.slice(0,100),unread:items.filter(x=>!x.read).length})
})
app.post('/api/notifications/:id/read',async(req,res)=>{const id=String(req.params.id||'');const exists=(db.notificationReads[req.user.id]||[]).includes(id);if(!exists){db.notificationReads[req.user.id]||=[];db.notificationReads[req.user.id].push(id);db.notificationReads[req.user.id]=db.notificationReads[req.user.id].slice(-1000);await save()}res.json({ok:true,id})})
app.get('/api/facilities',(q,s)=>s.json(scopedFacilities(q.user)))
app.get('/api/medicines',(q,s)=>{const term=String(q.query.q||'').toLowerCase(),fs=scopedFacilities(q.user);s.json(db.medicines.filter(m=>(q.user.role===roles[0]||fs.some(f=>f.name===m.facility||f.id===m.facilityId))&&`${m.name} ${m.batch} ${m.facility} ${m.category}`.toLowerCase().includes(term)))})
app.post('/api/medicines',async(q,s)=>{if(!canWrite(q))return s.status(403).json({error:'Your role cannot add medicine records.'});const b=q.body||{};if(!String(b.name||'').trim()||!String(b.batch||'').trim()||!String(b.facility||'').trim())return s.status(400).json({error:'name, batch and facility are required'});const nums=[b.stock,b.reorder,b.daily].map(Number);if(nums.some(v=>!Number.isFinite(v)||v<0))return s.status(400).json({error:'stock, reorder and daily must be non-negative numbers'});const m={id:`MED-${randomUUID().slice(0,8).toUpperCase()}`,name:String(b.name).trim(),category:b.category||'Essential',batch:String(b.batch).trim(),facility:String(b.facility).trim(),facilityId:b.facilityId||'',stock:nums[0],unit:b.unit||'units',reorder:nums[1],daily:nums[2],expiry:b.expiry||'',status:'Healthy'};risk(m);db.medicines.push(m);await save();s.status(201).json(m)})
app.post('/api/stock-transactions',async(q,s)=>{
  if(![roles[0],roles[1],roles[2]].includes(q.user.role))return s.status(403).json({error:'Your role cannot record stock movements.'})
  const {medicineId,action,quantity,note='',reference='',expiry=''}=q.body||{},qty=Number(quantity),m=medicine(medicineId)
  if(!m)return notFound(s,'Medicine not found')
  if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.name===m.facility||f.id===m.facilityId))return s.status(403).json({error:'Medicine is outside your assigned facility scope.'})
  const deltas={'Receive stock':1,'Issue stock':-1,'Record wastage':-1,'Record expiry':-1,'Increase adjustment':1,'Decrease adjustment':-1}
  if(!Object.hasOwn(deltas,action))return s.status(400).json({error:'Choose a supported stock movement type.'})
  if(!Number.isSafeInteger(qty)||qty<=0)return s.status(400).json({error:'Quantity must be a positive whole number'})
  if(deltas[action]===-1&&qty>m.stock)return s.status(409).json({error:`Cannot record ${qty}; only ${m.stock} ${m.unit} available.`})
  if(action==='Record expiry'&&!expiry&&!m.expiry)return s.status(400).json({error:'An expiry date is required for an expiry write-off.'})
  const previousQuantity=Number(m.stock)||0
  m.stock=previousQuantity+deltas[action]*qty
  if(action==='Receive stock'&&reference)m.lastReceiptReference=String(reference).slice(0,100)
  if(action==='Record expiry'&&expiry)m.expiry=String(expiry).slice(0,10)
  const stockRisk=risk(m)
  const type=({'Receive stock':'received','Issue stock':'issued','Record wastage':'wastage','Record expiry':'expired','Increase adjustment':'adjustment-in','Decrease adjustment':'adjustment-out'})[action]
  const tx={id:`TX-${randomUUID().slice(0,8).toUpperCase()}`,medicineId,medicineName:m.name,batch:m.batch,facility:m.facility,type,action,quantity:qty,previousQuantity,newQuantity:m.stock,note:String(note).slice(0,500),reference:String(reference).slice(0,100),createdBy:q.user.id,createdAt:new Date().toISOString()}
  db.transactions.unshift(tx);await audit(q.user,'inventory.stock_movement_recorded',{transactionId:tx.id,medicineId,action,quantity:qty,facility:m.facility})
  s.status(201).json({medicine:m,transaction:tx,risk:stockRisk,medicines:db.medicines,transactions:db.transactions.filter(t=>q.user.role===roles[0]||scopedFacilities(q.user).some(f=>f.name===t.facility)),alerts:alerts(),dashboard:dashboardStats(scopedFacilities(q.user))})
})
app.get('/api/stock-requests',(q,s)=>{const fs=scopedFacilities(q.user),names=new Set(fs.map(f=>f.name));s.json(db.stockRequests.filter(r=>q.user.role===roles[0]||names.has(r.facility)||names.has(r.requestedFrom)))})
app.post('/api/stock-requests',async(q,s)=>{
  if(![roles[0],roles[1],roles[2]].includes(q.user.role))return s.status(403).json({error:'Your role cannot submit stock requests.'})
  const b=q.body||{},m=medicine(String(b.medicineId||'')),quantity=Number(b.quantity),facility=String(b.facility||m?.facility||'')
  if(!m)return notFound(s,'Medicine not found')
  if(!Number.isSafeInteger(quantity)||quantity<=0)return s.status(400).json({error:'Requested quantity must be a positive whole number'})
  if(!scopedFacilities(q.user).some(f=>f.name===facility||f.id===facility))return s.status(403).json({error:'Requested facility is outside your assigned scope.'})
  if(q.user.role===roles[2]&&m.facility!==facility)return s.status(403).json({error:'Pharmacists can request stock only for their assigned medicine facility.'})
  const request={id:`SR-${randomUUID().slice(0,8).toUpperCase()}`,medicineId:m.id,medicineName:m.name,batch:m.batch,facility,quantity,reason:String(b.reason||'Replenishment').slice(0,300),status:'Pending',requestedBy:q.user.id,requestedAt:new Date().toISOString()}
  db.stockRequests.unshift(request);await audit(q.user,'inventory.stock_request_created',{requestId:request.id,medicineId:m.id,quantity,facility});s.status(201).json({request})
})
app.post('/api/stock-requests/:id/decision',async(q,s)=>{
  if(![roles[0],roles[1]].includes(q.user.role))return s.status(403).json({error:'Only district administrators and facility managers can review stock requests.'})
  const r=db.stockRequests.find(x=>x.id===q.params.id);if(!r)return notFound(s,'Stock request not found')
  if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.name===r.facility||f.id===r.facility))return s.status(403).json({error:'Request is outside your assigned facility scope.'})
  if(r.status!=='Pending')return s.status(409).json({error:'Only pending requests can be reviewed.'})
  const decision=q.body?.decision;if(!['approve','reject'].includes(decision))return s.status(400).json({error:'decision must be approve or reject'})
  r.status=decision==='approve'?'Approved — awaiting fulfilment':'Rejected';r.reviewedBy=q.user.id;r.reviewedAt=new Date().toISOString();r.reviewNote=String(q.body?.note||'').slice(0,500);await audit(q.user,`inventory.stock_request_${decision}`,{requestId:r.id});s.json({request:r})
})
app.get('/api/stock-transactions',(q,s)=>{const fs=scopedFacilities(q.user);s.json(db.transactions.filter(t=>q.user.role===roles[0]||fs.some(f=>f.name===t.facility)))})
app.get('/api/alerts',(q,s)=>{const fs=scopedFacilities(q.user);s.json(alerts().filter(a=>q.user.role===roles[0]||fs.some(f=>f.name===a.facility)))})
app.get('/api/forecast/:id',(q,s)=>{const m=medicine(q.params.id);if(!m)return notFound(s,'Medicine not found');if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.name===m.facility||f.id===m.facilityId))return s.status(403).json({error:'Medicine is outside your assigned facility scope.'});const horizon=Math.max(1,Math.min(90,Number(q.query.days)||14)),history=[.82,.95,1.08,.91,1.14,1.03,.98].map(v=>Math.max(0,Number((m.daily*v).toFixed(2)))),lead=7,ss=computeSafetyStock(history,lead,1.65,1),dailyMean=history.reduce((a,v)=>a+v,0)/history.length;s.json({medicine:m.name,medicineId:m.id,history,dailyDemand:m.daily,leadTimeDays:lead,safetyStock:ss,reorderPoint:reorderPoint(m.daily,lead,ss),projectedDemand:Math.ceil(dailyMean*horizon),horizonDays:horizon,coverageDays:m.daily>0?Number((m.stock/m.daily).toFixed(1)):null,currentStock:m.stock,risk:risk(m).risk,series:Array.from({length:Math.min(horizon,14)},(_,i)=>({day:`D${i+1}`,actual:i<history.length?history[i]:null,forecast:Number(dailyMean.toFixed(1))})),method:'Illustrative statistical baseline',caveat:'Synthetic example history; not a trained or validated forecast.'})})
// Transfer lifecycle helpers: match legacy short facility labels to canonical facility names.
const canonicalFacilityName=value=>{const raw=String(value||'').trim().toLowerCase();const exact=db.facilities.find(f=>f.name.toLowerCase()===raw||f.id.toLowerCase()===raw);if(exact)return exact.name;const suffix=raw.replace(/^(phc|chc)\s+/,'').replace(/^(primary health centre|community health centre),?\s*/,'').trim();const found=db.facilities.find(f=>{const n=f.name.toLowerCase();return n.includes(suffix)&&suffix.length>2});return found?.name||String(value||'').trim()}
const facilityRecord=value=>db.facilities.find(f=>f.name===canonicalFacilityName(value)||f.id===value)
const transferMedicine=(transfer,facilityLabel)=>{const canonical=canonicalFacilityName(facilityLabel);return db.medicines.find(m=>m.id===transfer.medicineId&&m.name===transfer.medicine&&(canonicalFacilityName(m.facility)===canonical||m.facilityId===facilityRecord(canonical)?.id))}
const canAccessTransfer=(user,t)=>{if(user.role===roles[0])return true;const allowed=scopedFacilities(user).map(f=>f.name);return allowed.includes(canonicalFacilityName(t.source))||allowed.includes(canonicalFacilityName(t.destination))}
app.post('/api/transfers',async(q,s)=>{
  if(![roles[0],roles[1],roles[2]].includes(q.user.role))return s.status(403).json({error:'Your role cannot create transfer requests.'})
  const b=q.body||{},source=canonicalFacilityName(b.source),destination=canonicalFacilityName(b.destination),medicineId=String(b.medicineId||''),quantity=Number(b.quantity),medicine=db.medicines.find(m=>m.id===medicineId)
  if(!facilityRecord(source)||!facilityRecord(destination)||source===destination)return s.status(400).json({error:'Choose two different valid facilities.'})
  if(!Number.isSafeInteger(quantity)||quantity<=0)return s.status(400).json({error:'Transfer quantity must be a positive whole number.'})
  if(![source,destination].some(name=>scopedFacilities(q.user).some(f=>f.name===name||f.id===facilityRecord(name)?.id)))return s.status(403).json({error:'Transfer is outside your assigned facility scope.'})
  if(!medicine||canonicalFacilityName(medicine.facility)!==source)return s.status(400).json({error:'Choose a medicine record held by the source facility.'})
  const t={id:`TR-${randomUUID().slice(0,8).toUpperCase()}`,medicine:medicine.name,medicineId:medicine.id,source,destination,requested:quantity,available:Number(medicine.stock)||0,urgency:String(b.urgency||'Normal'),status:'Awaiting review',distance:'Not calculated',createdBy:q.user.id,createdAt:new Date().toISOString(),history:[{state:'Awaiting review',actorId:q.user.id,at:new Date().toISOString(),note:String(b.note||'').slice(0,500)}]}
  db.transfers.unshift(t);await audit(q.user,'transfer.request_created',{transferId:t.id,source,destination,medicineId,quantity});s.status(201).json({transfer:t,transfers:db.transfers.filter(x=>canAccessTransfer(q.user,x))})
})
app.post('/api/transfers/:id/dispatch',async(q,s)=>{
  const t=db.transfers.find(x=>x.id===q.params.id);if(!t)return notFound(s,'Transfer not found');if(!canAccessTransfer(q.user,t))return s.status(403).json({error:'Transfer is outside your assigned facility scope.'})
  if(![roles[0],roles[1],roles[2]].includes(q.user.role))return s.status(403).json({error:'Your role cannot dispatch stock.'})
  if(!String(t.status).startsWith('Approved'))return s.status(409).json({error:'Only approved transfers can be dispatched.'})
  if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.name===canonicalFacilityName(t.source)||f.id===facilityRecord(t.source)?.id))return s.status(403).json({error:'Only the source facility team can dispatch this transfer.'})
  const donor=transferMedicine(t,t.source);if(!donor)return s.status(409).json({error:'Matching source inventory record not found.'})
  const qty=Number(q.body?.quantity??t.requested);if(!Number.isSafeInteger(qty)||qty<=0||qty>Number(t.requested))return s.status(400).json({error:'Dispatch quantity must be a positive whole number no greater than the approved quantity.'})
  const reserve=Math.max(Number(donor.reorder)||0,Math.ceil((Number(donor.daily)||0)*7));if(Number(donor.stock)-qty<reserve)return s.status(409).json({error:'Dispatch would breach the donor reserve.',available:Number(donor.stock),reserve,requested:qty})
  const previous=Number(donor.stock);donor.stock=previous-qty;const tx={id:`TX-${randomUUID().slice(0,8).toUpperCase()}`,medicineId:donor.id,medicineName:donor.name,batch:donor.batch,facility:donor.facility,type:'transfer-dispatch',action:'Transfer dispatch',quantity:qty,previousQuantity:previous,newQuantity:donor.stock,note:`Dispatched for ${t.id}`,reference:t.id,createdBy:q.user.id,createdAt:new Date().toISOString()};db.transactions.unshift(tx)
  t.dispatchedQuantity=qty;t.dispatchedAt=new Date().toISOString();t.dispatchedBy=q.user.id;t.status='Dispatched — awaiting receipt';t.history||=[];t.history.push({state:t.status,actorId:q.user.id,at:t.dispatchedAt,note:String(q.body?.note||'').slice(0,500)});await audit(q.user,'transfer.dispatched',{transferId:t.id,quantity:qty,transactionId:tx.id});s.json({transfer:t,transaction:tx,transfers:db.transfers.filter(x=>canAccessTransfer(q.user,x))})
})
app.post('/api/transfers/:id/receive',async(q,s)=>{
  const t=db.transfers.find(x=>x.id===q.params.id);if(!t)return notFound(s,'Transfer not found');if(!canAccessTransfer(q.user,t))return s.status(403).json({error:'Transfer is outside your assigned facility scope.'})
  if(![roles[0],roles[1],roles[2]].includes(q.user.role))return s.status(403).json({error:'Your role cannot confirm transfer receipts.'})
  if(t.status!=='Dispatched — awaiting receipt')return s.status(409).json({error:'Only dispatched transfers awaiting receipt can be received.'})
  if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.name===canonicalFacilityName(t.destination)||f.id===facilityRecord(t.destination)?.id))return s.status(403).json({error:'Only the destination facility team can confirm receipt.'})
  const dispatched=Number(t.dispatchedQuantity)||0,received=Number(q.body?.quantity??dispatched);if(!Number.isSafeInteger(received)||received<0||received>dispatched)return s.status(400).json({error:'Received quantity must be a whole number between zero and the dispatched quantity.'})
  const destinationName=canonicalFacilityName(t.destination),destinationFacility=facilityRecord(destinationName),existing=db.medicines.find(m=>m.name===t.medicine&&canonicalFacilityName(m.facility)===destinationName)
  let recipient=existing;if(!recipient&&received>0){const source=transferMedicine(t,t.source);recipient={id:`MED-${randomUUID().slice(0,8).toUpperCase()}`,name:t.medicine,category:source?.category||'Essential',batch:source?.batch||'TRANSFER',facility:destinationName,facilityId:destinationFacility?.id||'',stock:0,unit:source?.unit||'units',reorder:source?.reorder||0,daily:source?.daily||0,expiry:source?.expiry||'',status:'Healthy'};db.medicines.push(recipient)}
  if(received>0&&recipient){const previous=Number(recipient.stock)||0;recipient.stock=previous+received;const tx={id:`TX-${randomUUID().slice(0,8).toUpperCase()}`,medicineId:recipient.id,medicineName:recipient.name,batch:recipient.batch,facility:recipient.facility,type:'transfer-receipt',action:'Transfer receipt',quantity:received,previousQuantity:previous,newQuantity:recipient.stock,note:`Received from ${t.source} for ${t.id}`,reference:t.id,createdBy:q.user.id,createdAt:new Date().toISOString()};db.transactions.unshift(tx);t.receiptTransactionId=tx.id}
  t.receivedQuantity=received;t.receivedAt=new Date().toISOString();t.receivedBy=q.user.id;t.discrepancy=received!==dispatched?{dispatched,received,quantityDifference:dispatched-received,note:String(q.body?.note||'').slice(0,500)}:null;t.status=received===dispatched?'Completed':'Completed — discrepancy recorded';t.history||=[];t.history.push({state:t.status,actorId:q.user.id,at:t.receivedAt,note:String(q.body?.note||'').slice(0,500)});await audit(q.user,'transfer.received',{transferId:t.id,dispatched,received,discrepancy:received!==dispatched});s.json({transfer:t,transfers:db.transfers.filter(x=>canAccessTransfer(q.user,x))})
})
app.get('/api/transfers',(q,s)=>{const fs=scopedFacilities(q.user);s.json(db.transfers.filter(t=>q.user.role===roles[0]||fs.some(f=>f.name===t.source||f.name===t.destination)))})
app.post('/api/transfers/:id/review',async(q,s)=>{if(q.user.role!==roles[0]&&q.user.role!==roles[1])return s.status(403).json({error:'Your role cannot review transfers.'});const t=db.transfers.find(x=>x.id===q.params.id);if(!t)return notFound(s,'Transfer not found');if(!canAccessTransfer(q.user,t))return s.status(403).json({error:'Transfer is outside your assigned facility scope.'});const decision=q.body?.decision;if(!['approve','reject','needs-review'].includes(decision))return s.status(400).json({error:'decision must be approve, reject, or needs-review'});const donor=transferMedicine(t,t.source);if(!donor)return s.status(409).json({error:'No matching donor inventory record is available. Reconcile the transfer against a medicine batch first.'});const f=getTransferFeasibility({sourceStock:donor.stock,requested:t.requested,sourceReserve:Math.max(Number(donor.reorder)||0,Math.ceil((Number(donor.daily)||0)*7)),destinationNeed:t.requested});if(decision==='approve'&&!f.feasible)return s.status(409).json({error:'Requested quantity breaches donor reserve rule.',feasibility:f});if(t.status==='Dispatched — awaiting receipt'||String(t.status).startsWith('Completed'))return s.status(409).json({error:'A dispatched or completed transfer cannot be reviewed again.'});t.status=decision==='approve'?'Approved — dispatch pending':decision==='reject'?'Rejected':'Needs review';t.history||=[];t.history.push({state:t.status,actorId:q.user.id,at:new Date().toISOString(),note:String(q.body?.note||'').slice(0,500)});t.review={decision,feasibility:f,reviewedAt:new Date().toISOString(),note:String(q.body?.note||'').slice(0,500)};await save();s.json({transfer:t,feasibility:f,transfers:db.transfers})})
const canAccessIntervention=(user,c)=>user.role===roles[0]||scopedFacilities(user).some(f=>f.id===c.facilityId||f.name===c.facility)
const canManageInterventions=user=>[roles[0],roles[1]].includes(user.role)
app.get('/api/interventions',(q,s)=>{const fs=scopedFacilities(q.user),ids=new Set(fs.map(f=>f.id)),names=new Set(fs.map(f=>f.name));s.json(db.interventions.filter(c=>q.user.role===roles[0]||(!c.facilityId&&!c.facility)||ids.has(c.facilityId)||names.has(c.facility)).map(c=>({...c,history:c.history||[],evidence:c.evidence||[]})))})
app.post('/api/interventions',async(q,s)=>{
  if(!canManageInterventions(q.user))return s.status(403).json({error:'Only district administrators and facility managers can create interventions.'})
  const b=q.body||{},facility=String(b.facility||'').trim(),facilityRecord=db.facilities.find(f=>f.id===facility||f.name===facility)
  if(!facilityRecord||facilityRecord.district!==q.user.district)return s.status(400).json({error:'Choose a valid facility in your district.'})
  if(q.user.role!==roles[0]&&!scopedFacilities(q.user).some(f=>f.id===facilityRecord.id))return s.status(403).json({error:'Facility is outside your assigned scope.'})
  const issue=String(b.issue||'').trim(),owner=String(b.owner||'').trim(),due=String(b.due||'').trim(),severity=String(b.severity||'High')
  if(issue.length<4||issue.length>300)return s.status(400).json({error:'Describe the issue in 4–300 characters.'})
  if(!['Critical','High','Medium','Low'].includes(severity))return s.status(400).json({error:'Choose a valid severity.'})
  if(!owner||owner.length>120)return s.status(400).json({error:'Enter an accountable owner or role.'})
  if(!due||due.length>80)return s.status(400).json({error:'Enter a due date or deadline.'})
  const at=new Date().toISOString(),c={id:`INT-${randomUUID().slice(0,8).toUpperCase()}`,facility:facilityRecord.name,facilityId:facilityRecord.id,issue,severity,owner,due,status:'Open',createdBy:q.user.id,createdAt:at,updatedAt:at,history:[{type:'created',status:'Open',actorId:q.user.id,at,note:String(b.note||'').slice(0,500)}],evidence:[]}
  db.interventions.unshift(c);await audit(q.user,'intervention.created',{interventionId:c.id,facilityId:c.facilityId,severity});s.status(201).json({intervention:c})
})
app.post('/api/interventions/:id/updates',async(q,s)=>{
  const c=db.interventions.find(x=>x.id===q.params.id);if(!c)return notFound(s,'Intervention not found')
  if(!canAccessIntervention(q.user,c))return s.status(403).json({error:'Intervention is outside your assigned facility scope.'})
  if(q.user.role===roles[3])return s.status(403).json({error:'Your role cannot update interventions.'})
  const b=q.body||{},note=String(b.note||'').trim(),evidence=String(b.evidence||'').trim(),status=b.status
  if(note.length<3||note.length>1000)return s.status(400).json({error:'Enter a progress update between 3 and 1000 characters.'})
  if(status&&!['Open','In progress','Resolved'].includes(status))return s.status(400).json({error:'Invalid status.'})
  if(status==='Resolved'&&!evidence)return s.status(400).json({error:'Evidence or a verification note is required before closure.'})
  const at=new Date().toISOString();c.history||=[];c.evidence||=[]
  const update={id:`UPD-${randomUUID().slice(0,8).toUpperCase()}`,actorId:q.user.id,at,note,status:status||c.status,evidence:evidence||null};c.history.push(update)
  if(evidence)c.evidence.push({id:`EVD-${randomUUID().slice(0,8).toUpperCase()}`,actorId:q.user.id,at,description:evidence,note})
  if(status)c.status=status
  if(b.owner!==undefined)c.owner=String(b.owner||'').trim().slice(0,120)
  if(b.due!==undefined)c.due=String(b.due||'').trim().slice(0,80)
  c.updatedAt=at;if(status==='Resolved'){c.resolvedAt=at;c.resolvedBy=q.user.id;c.closureEvidence=evidence}
  await audit(q.user,'intervention.updated',{interventionId:c.id,status:c.status,hasEvidence:Boolean(evidence)});s.json({intervention:c})
})
app.patch('/api/interventions/:id',async(q,s)=>{
  if(!canManageInterventions(q.user))return s.status(403).json({error:'Only district administrators and facility managers can edit interventions.'})
  const c=db.interventions.find(x=>x.id===q.params.id);if(!c)return notFound(s,'Intervention not found')
  if(!canAccessIntervention(q.user,c))return s.status(403).json({error:'Intervention is outside your assigned facility scope.'})
  const b=q.body||{};if(b.status&&!['Open','In progress','Resolved'].includes(b.status))return s.status(400).json({error:'Invalid status.'})
  if(b.status==='Resolved'&&!(c.evidence||[]).length&&!String(b.evidence||'').trim())return s.status(409).json({error:'Add a progress update with closure evidence before resolving this intervention.'})
  if(b.owner!==undefined){const owner=String(b.owner||'').trim();if(!owner||owner.length>120)return s.status(400).json({error:'Owner must be 1–120 characters.'});c.owner=owner}
  if(b.due!==undefined){const due=String(b.due||'').trim();if(!due||due.length>80)return s.status(400).json({error:'Due date must be 1–80 characters.'});c.due=due}
  if(b.status){c.status=b.status;if(b.status==='Resolved'){c.resolvedAt=new Date().toISOString();c.resolvedBy=q.user.id;c.closureEvidence=String(b.evidence||'').trim()}}
  c.updatedAt=new Date().toISOString();c.history||=[];c.history.push({type:'edited',actorId:q.user.id,at:c.updatedAt,status:c.status,note:String(b.note||'Assignment/status updated').slice(0,500)});await audit(q.user,'intervention.edited',{interventionId:c.id,status:c.status});s.json(c)
})
// Unknown API paths must return JSON, never the SPA's index.html. This prevents
// frontend JSON parsers from failing with `Unexpected token '<'` on route typos.
app.use('/api', (req, res) => res.status(404).json({error:`Unknown API endpoint: ${req.method} ${req.originalUrl}`}))

const distPath=path.join(root,'frontend','dist')


if (isDev) {
  // Run React/Vite and the API through one HTTP server/port while retaining HMR.
  const vite=await createViteServer({
    configFile:path.join(root,'frontend','vite.config.js'),
    root:path.join(root,'frontend'),
    appType:'spa',
    server:{middlewareMode:true,hmr:{server:httpServer}}
  })
  app.use(vite.middlewares)
  app.use('*',async(req,res,next)=>{
    try {
      const template=await fs.readFile(path.join(root,'frontend','index.html'),'utf8')
      const html=await vite.transformIndexHtml(req.originalUrl,template)
      res.status(200).set({'Content-Type':'text/html'}).end(html)
    } catch(error) {
      vite.ssrFixStacktrace(error)
      next(error)
    }
  })
} else {
  try {
    await fs.access(distPath)
    app.use(express.static(distPath))
    app.get('*',(_q,s)=>s.sendFile(path.join(distPath,'index.html')))
  } catch {
    app.get('*',(_q,s)=>s.status(503).send('Frontend build not found. Run npm run build, or use npm run dev for development.'))
  }
}

app.use((err,_q,s,_next)=>{
  if (s.headersSent) return
  // Express body-parser marks malformed JSON as a SyntaxError with status 400.
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return s.status(400).json({error:'Request body must be valid JSON'})
  }
  console.error(err)
  s.status(500).json({error:'Unexpected server error'})
})
httpServer.listen(port,()=>console.log(`Namo Monitoring ${isDev?'development':'production'} server listening at http://localhost:${port}`))
