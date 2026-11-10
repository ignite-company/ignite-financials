// Use integer cents for accurate revenue averages and per-payment splits.
export function summarizePayments(payments = []) {
  let totalCents=0, count=0;
  for(const p of payments){
    if(p?.type!=="income" || p.category==="Transfer") continue;
    const amount=Number(p.amount);
    if(!Number.isFinite(amount)||amount<=0) continue;
    totalCents+=Math.round(amount*100); count++;
  }
  return {total:totalCents/100,count,average:count?Math.round(totalCents/count)/100:0};
}
export function getMostRecentPayment(payments=[]){
  return payments.reduce((latest,p)=>{
    if(!latest)return p;
    return String(p.created_at||p.date||"")>String(latest.created_at||latest.date||"")?p:latest;
  },null);
}
// Persisted snapshots win over current rules; neither is an actual bank balance.
export function splitPayment(payment,buckets=[],allocations=[]){
  if(!payment)return [];
  const totalCents=Math.round(Number(payment.amount)*100);
  if(!Number.isFinite(totalCents)||totalCents<=0)return [];
  const sorted=[...buckets].sort((a,b)=>a.sort_order-b.sort_order);
  const snapshots=allocations.filter(a=>a.transaction_id===payment.id);
  if(snapshots.length){
    const saved=new Map(snapshots.map(a=>[a.bucket_id,Math.round(Number(a.amount)*100)]));
    return sorted.map(bucket=>{
      const cents=saved.get(bucket.id)||0;
      return {...bucket,amount:cents/100,displayPercentage:Math.round(cents/totalCents*1000)/10};
    });
  }
  let remaining=totalCents;
  const eligible=sorted.filter(b=>Number(b.percentage)>0);
  const preview=new Map();
  eligible.forEach((b,i)=>{
    const cents=i===eligible.length-1?remaining:Math.round(totalCents*Number(b.percentage)/100);
    preview.set(b.id,cents);remaining-=cents;
  });
  return sorted.map(b=>({...b,amount:(preview.get(b.id)||0)/100,displayPercentage:Number(b.percentage)}));
}
