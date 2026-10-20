/**
 * Single source of truth for Ignite Financials monthly spending widgets.
 * Transaction lists and category cards intentionally have different purposes:
 * category cards summarize ALL positive purchases assigned by the owner,
 * whereas the month's reportable spending excludes user-excluded entries.
 * Data passed here must already be scoped to the selected month and account.
 */
export function summarizeSpending(monthTransactions, categories) {
 const purchases=monthTransactions.filter(t=>Number(t.amount)>0);
 const spending=purchases.filter(t=>!t.exclude_from_spending);
 const pendingSpending=spending.filter(t=>t.pending);
 const pendingTotal=pendingSpending.reduce((sum,t)=>sum+Number(t.amount),0);
 const spendingTotal=spending.reduce((sum,t)=>sum+Number(t.amount),0);
 const postedTotal=spendingTotal-pendingTotal;
 const excludedPurchases=purchases.filter(t=>t.exclude_from_spending);
 const excludedTotal=excludedPurchases.reduce((sum,t)=>sum+Number(t.amount),0);

 const categoryIds=new Set(categories.map(c=>c.id));
 const groups=new Map(categories.map(c=>[c.id,{
  id:c.id,name:c.name,total:0,count:0,pendingCount:0,excludedCount:0
 }]));
 const uncategorized={
  id:"uncategorized",name:"Uncategorized",total:0,count:0,pendingCount:0,excludedCount:0
 };
 for(const t of purchases){
  const target=(t.spend_category_id&&categoryIds.has(t.spend_category_id))
   ?groups.get(t.spend_category_id):uncategorized;
  target.total+=Number(t.amount);
  target.count++;
  if(t.pending)target.pendingCount++;
  if(t.exclude_from_spending)target.excludedCount++;
 }
 const categoryCards=[...groups.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
 const unassigned=purchases.filter(t=>!t.spend_category_id||!categoryIds.has(t.spend_category_id));
 return {
  purchases,spending,pendingSpending,pendingTotal,spendingTotal,postedTotal,
  excludedPurchases,excludedTotal,unassigned,categoryCards,uncategorized
 };
}
