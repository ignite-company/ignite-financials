/** Bank deposits are classified by their owner; no automatic revenue assumptions. */
export const INFLOW_TYPES = [
 {id:"business_revenue",label:"Business Revenue"},
 {id:"personal_income",label:"Personal Income"},
 {id:"transfer",label:"Transfer"},
 {id:"refund",label:"Refund"}
];
export const INFLOW_UNCLASSIFIED = {id:"unclassified",label:"Uncategorized"};
export function summarizeInflows(transactions) {
 const deposits=transactions.filter(t=>Number(t.amount)<0);
 const groups=[...INFLOW_TYPES,INFLOW_UNCLASSIFIED].map(x=>({...x,total:0,count:0,pendingCount:0}));
 const byId=new Map(groups.map(g=>[g.id,g]));
 let total=0,posted=0,pending=0;
 for(const row of deposits){
  const amount=Math.abs(Number(row.amount));
  const category=byId.get(row.inflow_type)||byId.get("unclassified");
  category.total+=amount;
  category.count++;
  if(row.pending){category.pendingCount++;pending+=amount;}
  else posted+=amount;
  total+=amount;
 }
 return {deposits,total,posted,pending,groups};
}
