import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const getPort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(error => error ? reject(error) : resolve(port))
  })
})

const port = await getPort()
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swasthyagrid-api-test-'))
const testDbPath = path.join(tempDir, 'db.json')
await fs.copyFile(path.join(root, 'backend', 'data', 'db.json'), testDbPath)
const child = spawn(process.execPath, ['backend/server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), SWASTHYAGRID_DB_PATH: testDbPath },
  stdio: ['ignore', 'pipe', 'pipe']
})
let logs = ''
child.stdout.on('data', chunk => { logs += chunk.toString() })
child.stderr.on('data', chunk => { logs += chunk.toString() })
const base = `http://127.0.0.1:${port}`

async function requestUntilReady(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (child.exitCode !== null) throw new Error(`API exited before becoming ready.\n${logs}`)
    try { return await fetch(url) } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  throw new Error(`API did not become ready.\n${logs}`)
}

try {
  const healthResponse = await requestUntilReady(`${base}/api/health`)
  assert.equal(healthResponse.status, 200)
  const health = await healthResponse.json()
  assert.equal(health.status, 'ok')
  assert.equal(health.persistence, 'local JSON file')
  assert.equal(health.demoMode, true)

  const unauthenticated = await fetch(`${base}/api/bootstrap`)
  assert.equal(unauthenticated.status, 401, 'protected routes reject anonymous requests')
  const loginResponse = await fetch(`${base}/api/auth/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'district.admin@demo.local',password:'Demo@12345'})})
  assert.equal(loginResponse.status, 200)
  const login = await loginResponse.json()
  assert.equal(login.user.role, 'District Administrator')
  const token = login.token
  const authedFetch = (url, options={}) => fetch(url, {...options,headers:{...(options.headers||{}),authorization:`Bearer ${token}`}})
  const operationsLoginResponse = await fetch(`${base}/api/auth/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'operations.staff@demo.local',password:'Demo@12345'})})
  assert.equal(operationsLoginResponse.status,200)
  const operationsToken = (await operationsLoginResponse.json()).token
  const operationsFetch = (url, options={}) => fetch(url, {...options,headers:{...(options.headers||{}),authorization:`Bearer ${operationsToken}`}})
  const managerLoginResponse = await fetch(`${base}/api/auth/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'facility.manager@demo.local',password:'Demo@12345'})})
  assert.equal(managerLoginResponse.status,200)
  const managerToken = (await managerLoginResponse.json()).token
  const managerFetch = (url, options={}) => fetch(url, {...options,headers:{...(options.headers||{}),authorization:`Bearer ${managerToken}`}})
  for (const route of ['/api/bootstrap', '/api/dashboard', '/api/facilities', '/api/medicines', '/api/stock-transactions', '/api/stock-requests', '/api/issue-reports', '/api/alerts', '/api/transfers', '/api/interventions']) {
    const response = await authedFetch(`${base}${route}`)
    assert.equal(response.status, 200, `${route} should return HTTP 200`)
    await response.json()
  }

  const issueCreate = await operationsFetch(`${base}/api/issue-reports`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({facilityId:'PHC-014',title:'Diagnostic service interruption',description:'Analyzer is unavailable and needs facility review.',category:'Diagnostics',priority:'High'})})
  assert.equal(issueCreate.status,201,'operations staff can report an issue in their assigned facility')
  const issue = (await issueCreate.json()).issue
  const managerIssuesResponse = await managerFetch(`${base}/api/issue-reports`)
  const managerIssues = await managerIssuesResponse.json()
  assert.equal(managerIssuesResponse.status,200)
  assert.ok(managerIssues.some(x=>x.id===issue.id),'facility manager can see issue reported by operations staff')
  const resolveIssue = await managerFetch(`${base}/api/issue-reports/${issue.id}`, {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'Resolved'})})
  assert.equal(resolveIssue.status,200,'facility manager can resolve issue in assigned facility')
  const operationsIssuesResponse = await operationsFetch(`${base}/api/issue-reports`)
  const operationsIssues = await operationsIssuesResponse.json()
  assert.equal(operationsIssues.find(x=>x.id===issue.id)?.status,'Resolved','resolution is visible to the reporting role')

  const invalidStock = await authedFetch(`${base}/api/stock-transactions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ medicineId: 'MED-001', action: 'Issue stock', quantity: 0 })
  })
  assert.equal(invalidStock.status, 400)
  assert.match((await invalidStock.json()).error, /positive whole number/i)

  const invalidMovement = await authedFetch(`${base}/api/stock-transactions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ medicineId: 'MED-001', action: 'Delete stock', quantity: 1 })
  })
  assert.equal(invalidMovement.status, 400, 'unsupported stock movement types must be rejected')
  assert.match((await invalidMovement.json()).error, /supported stock movement/i)

  const malformedJson = await authedFetch(`${base}/api/stock-transactions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken'
  })
  assert.equal(malformedJson.status, 400)
  assert.deepEqual(await malformedJson.json(), { error: 'Request body must be valid JSON' })

  const missingMedicine = await authedFetch(`${base}/api/forecast/not-a-real-medicine`)
  assert.equal(missingMedicine.status, 404)
  assert.deepEqual(await missingMedicine.json(), { error: 'Medicine not found' })

  const registerResponse = await fetch(`${base}/api/auth/register`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Pending Tester',email:`pending-${Date.now()}@example.test`,password:'Password123',role:'Clinical / Operations Staff',district:'Bhopal'})})
  assert.equal(registerResponse.status,201)
  const pending = await registerResponse.json()
  assert.equal(pending.status,'pending')
  const pendingLogin = await fetch(`${base}/api/auth/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:pending.user.email,password:'Password123'})})
  assert.equal(pendingLogin.status,403)
  console.log('API integration tests passed: health, authentication, role-scoped reads, cross-role issue visibility and resolution, validation, malformed JSON, 404, and pending approval.')
} finally {
  child.kill('SIGTERM')
  await new Promise(resolve => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', resolve)
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL') }, 1500).unref()
  })
  await fs.rm(tempDir,{recursive:true,force:true})
}
