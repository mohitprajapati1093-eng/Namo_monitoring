import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db=JSON.parse(fs.readFileSync(path.join(root, 'backend', 'data', 'db.json'),'utf8'))
assert.ok(db.facilities.length>=1)
assert.ok(db.medicines.length>=1)
for (const t of db.transfers) {
  const donor=db.medicines.find(m=>m.id===t.medicineId&&m.name===t.medicine&&m.facility===t.source)
  assert.ok(donor, `Transfer ${t.id} must map to a real seed donor inventory record`)
}
assert.equal(db.interventions.every(c=>['Open','In progress','Resolved'].includes(c.status)),true)
console.log(`Seed integrity passed: ${db.facilities.length} facilities, ${db.medicines.length} medicine records, ${db.transfers.length} transfer proposals.`)
