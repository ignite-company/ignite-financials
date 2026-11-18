// Transaction display order never depends on updated_at or a user's category edits.
// Bank posting dates sort first; within one date, first import wins a permanent place.
export function compareBankTransactions(a,b){
 const byDate=String(b.date||"").localeCompare(String(a.date||""));
 if(byDate)return byDate;
 const firstA=Date.parse(a.first_seen_at||"");
 const firstB=Date.parse(b.first_seen_at||"");
 const safeA=Number.isFinite(firstA)?firstA:0;
 const safeB=Number.isFinite(firstB)?firstB:0;
 if(safeA!==safeB)return safeB-safeA;
 return String(a.id||"").localeCompare(String(b.id||""));
}
