// Adapted safety-stock and reorder-point concepts from MIT-licensed DemandForecast.
// See THIRD_PARTY_NOTICES.md for attribution and upstream source.
export function sampleStandardDeviation(values) {
  if (!Array.isArray(values) || values.length < 2) return 0
  const mean = values.reduce((a,v)=>a+v,0)/values.length
  return Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1))
}
export function computeSafetyStock(history, leadTimeDays, z=1.65, leadTimeStdDev=0) {
  if (!Array.isArray(history) || !history.length) throw new Error('Demand history is required')
  if (!Number.isFinite(leadTimeDays) || leadTimeDays<0) throw new Error('Lead time must be non-negative')
  if (history.some(v=>!Number.isFinite(Number(v)) || Number(v)<0)) throw new Error('Demand history must be non-negative')
  const values=history.map(Number), mean=values.reduce((a,v)=>a+v,0)/values.length
  const sd=sampleStandardDeviation(values)
  return Math.ceil(z*Math.sqrt(Math.max(0,sd**2*leadTimeDays+mean**2*leadTimeStdDev**2)))
}
export function reorderPoint(dailyDemand, leadTimeDays, safetyStockUnits) {
  if ([dailyDemand,leadTimeDays,safetyStockUnits].some(v=>!Number.isFinite(v)||v<0)) throw new Error('Reorder inputs must be non-negative numbers')
  return Math.ceil(dailyDemand*leadTimeDays+safetyStockUnits)
}
export function assessStockRisk(medicine, leadTimeDays=7, safetyStockUnits=0) {
  const daily=Math.max(0,Number(medicine.daily)||0), stock=Math.max(0,Number(medicine.stock)||0)
  const coverageDays=daily>0?stock/daily:null
  const threshold=Math.max(Number(medicine.reorder)||0,reorderPoint(daily,leadTimeDays,safetyStockUnits))
  return {coverageDays:coverageDays===null?null:Number(coverageDays.toFixed(1)),reorderPoint:threshold,risk:stock<=0||(coverageDays!==null&&coverageDays<=leadTimeDays)?'Critical':stock<threshold?'Low stock':'Healthy'}
}
export function getTransferFeasibility({sourceStock,requested,sourceReserve=0,destinationNeed=requested}) {
  const values={sourceStock,requested,sourceReserve,destinationNeed}
  for (const [k,v] of Object.entries(values)) if (!Number.isFinite(Number(v))||Number(v)<0) throw new Error(`${k} must be non-negative`)
  const transferable=Math.max(0,Number(sourceStock)-Number(sourceReserve))
  const feasibleQuantity=Math.min(transferable,Number(destinationNeed),Number(requested))
  return {feasible:feasibleQuantity>=Number(requested)&&feasibleQuantity>0,feasibleQuantity,sourceReserve:Number(sourceReserve),reason:feasibleQuantity>=Number(requested)?'Requested quantity fits the configured donor reserve rule.':feasibleQuantity>0?'Only part of the request fits the donor reserve rule.':'No transferable stock remains after the donor reserve.'}
}