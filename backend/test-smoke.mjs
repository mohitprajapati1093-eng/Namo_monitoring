import assert from 'node:assert/strict'
import {assessStockRisk,computeSafetyStock,reorderPoint,getTransferFeasibility,sampleStandardDeviation} from './src/services/inventory-intelligence.mjs'
assert.equal(reorderPoint(10,7,20),90)
assert.ok(computeSafetyStock([10,12,9,15,11],7)>0)
assert.equal(sampleStandardDeviation([5,5,5]),0)
assert.equal(assessStockRisk({stock:0,daily:5,reorder:10}).risk,'Critical')
assert.equal(assessStockRisk({stock:200,daily:10,reorder:20}).risk,'Healthy')
assert.equal(getTransferFeasibility({sourceStock:100,requested:30,sourceReserve:40}).feasible,true)
assert.equal(getTransferFeasibility({sourceStock:100,requested:80,sourceReserve:40}).feasible,false)
assert.throws(()=>computeSafetyStock([],7))
assert.throws(()=>reorderPoint(-1,7,20))
console.log('Inventory intelligence smoke tests passed.')
