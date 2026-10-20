import { createClient } from "@supabase/supabase-js";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export const serverDb = () => {
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error("Banking backend is missing Supabase service credentials.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
};
export async function authenticate(req){
 const jwt=String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt)throw Object.assign(new Error("Sign in to continue."),{status:401});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const publish=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!publish)throw new Error("Supabase authentication is not configured.");
 const db=createClient(url,publish,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(jwt);
 if(error||!data.user)throw Object.assign(new Error("Your session has expired. Sign in again."),{status:401});
 return data.user;
}
export const configured=()=>Boolean(process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET&&process.env.PLAID_TOKEN_ENCRYPTION_KEY);
const encryptionKey=()=>{
 const key=Buffer.from(process.env.PLAID_TOKEN_ENCRYPTION_KEY||"","base64");
 if(key.length!==32)throw new Error("Bank connection encryption is not configured.");
 return key;
};
export function encryptAccess(value){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv,cipher.getAuthTag(),encrypted].map(v=>v.toString("base64url")).join(".");
}
export function decryptAccess(value){
 const [iv,tag,body]=String(value).split(".").map(s=>Buffer.from(s,"base64url"));
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),iv);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(body),decipher.final()]).toString("utf8");
}
export async function plaid(path,payload){
 if(!configured())throw Object.assign(new Error("Plaid is not configured. Add the Plaid client ID and secret to Vercel."),{status:503});
 const environment=process.env.PLAID_ENV==="production"?"production":"sandbox";
 const response=await fetch("https://"+environment+".plaid.com/"+path,{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({...payload,client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error_message||"Unable to communicate with Plaid."),{status:502,plaid_code:data.error_code||"PLAID_ERROR"});
 return data;
}
export const verifyScope=s=>s==="business"||s==="personal";
export const cleanBankTransaction=(t,item)=>{
 const cat=t.personal_finance_category||{};
 return {
  user_id:item.user_id,
  bank_item_id:item.id,
  plaid_transaction_id:t.transaction_id,
  plaid_account_id:t.account_id,
  scope:item.scope,
  date:t.date,
  description:String(t.name||"Transaction").slice(0,500),
  merchant_name:t.merchant_name||null,
  amount:Number(t.amount),
  category_primary:cat.primary||null,
  category_detailed:cat.detailed||null,
  pending:!!t.pending,
  is_removed:false,
  updated_at:new Date().toISOString()
 };
};
export async function syncItem(db,item){
 if(!configured())throw new Error("Plaid is not configured.");
 const startCursor=item.sync_cursor||"";
 let added=[],modified=[],removed=[],endCursor=startCursor;
 let done=false;
 for(let attempt=0;attempt<3&&!done;attempt++){
  let cursor=startCursor,hasMore=true,page=0;
  added=[];modified=[];removed=[];
  try{
   while(hasMore){
    if(++page>40)throw new Error("Transaction history is too large for one sync. Retry later.");
    const batch=await plaid("transactions/sync",{access_token:decryptAccess(item.access_token_ciphertext),cursor,count:500,options:{personal_finance_category_version:"v2"}});
    added.push(...(batch.added||[]));modified.push(...(batch.modified||[]));removed.push(...(batch.removed||[]));
    hasMore=!!batch.has_more;cursor=batch.next_cursor;
   }
   endCursor=cursor;done=true;
  }catch(err){
   if(err.plaid_code==="TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"&&attempt<2)continue;
   throw err;
  }
 }
 if(!done)throw new Error("Transactions changed while syncing. Retry shortly.");
 // Preserve user edits (custom category, tags and bucket) by only updating Plaid-owned columns.
 for(const group of [added,modified]){
  for(let i=0;i<group.length;i+=150){
   const payload=group.slice(i,i+150).filter(t=>t.transaction_id&&t.date).map(t=>cleanBankTransaction(t,item));
   if(!payload.length)continue;
   // Preserve category, tags, exclusions and bucket when Plaid edits a transaction.
   // A posted purchase gets a new ID; pending_transaction_id points to the old pending item.
   const source=group.slice(i,i+150).filter(t=>t.transaction_id&&t.date);
   const ids=payload.map(t=>t.plaid_transaction_id);
   const pendingIds=[...new Set(source.filter(t=>!t.pending&&t.pending_transaction_id).map(t=>t.pending_transaction_id))];
   const userColumns="plaid_transaction_id,category_override,spend_category_id,exclude_from_spending,tags,bucket_id";
   const {data:existing,error:lookupError}=await db.from("finance_bank_transactions")
    .select(userColumns).eq("user_id",item.user_id).in("plaid_transaction_id",ids);
   if(lookupError)throw lookupError;
   let pendingSources=[];
   if(pendingIds.length){
    const {data,error:pendingError}=await db.from("finance_bank_transactions")
     .select(userColumns).eq("user_id",item.user_id).in("plaid_transaction_id",pendingIds);
    if(pendingError)throw pendingError;
    pendingSources=data||[];
   }
   const saved=new Map((existing||[]).map(t=>[t.plaid_transaction_id,t]));
   const savedPending=new Map(pendingSources.map(t=>[t.plaid_transaction_id,t]));
   const withUserEdits=payload.map((t,index)=>{
    const fresh=source[index];
    const prior=saved.get(t.plaid_transaction_id)||
     (fresh?.pending_transaction_id?savedPending.get(fresh.pending_transaction_id):null);
    if(!prior)return t;
    return {...t,category_override:prior.category_override,
     spend_category_id:prior.spend_category_id,
     exclude_from_spending:!!prior.exclude_from_spending,
     tags:prior.tags||[],bucket_id:prior.bucket_id};
   });
   const {error}=await db.from("finance_bank_transactions").upsert(withUserEdits,{onConflict:"plaid_transaction_id"});
   if(error)throw error;
   // Do not count the pending copy again once the posted replacement arrives.
   if(pendingIds.length){
    const {error:removePendingError}=await db.from("finance_bank_transactions")
     .update({is_removed:true,updated_at:new Date().toISOString()})
     .eq("user_id",item.user_id).eq("bank_item_id",item.id)
     .in("plaid_transaction_id",pendingIds);
    if(removePendingError)throw removePendingError;
   }
  }
 }
 for(let i=0;i<removed.length;i+=200){
  const ids=removed.slice(i,i+200).map(t=>t.transaction_id).filter(Boolean);
  if(!ids.length)continue;
  const {error}=await db.from("finance_bank_transactions").update({is_removed:true,updated_at:new Date().toISOString()}).eq("bank_item_id",item.id).in("plaid_transaction_id",ids);
  if(error)throw error;
 }
 const {error}=await db.from("finance_bank_items").update({sync_cursor:endCursor,status:"active",last_synced_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",item.user_id);
 if(error)throw error;
 return {added:added.length,modified:modified.length,removed:removed.length};
}
export async function syncOwnedItems(db,userId,scope=null){
 let query=db.from("finance_bank_items").select("*").eq("user_id",userId);
 if(scope)query=query.eq("scope",scope);
 const {data:items,error}=await query;
 if(error)throw error;
 const results=[];
 for(const item of items||[]){
  try{const detail=await syncItem(db,item);results.push({id:item.id,ok:true,...detail});}
  catch(err){
   results.push({id:item.id,ok:false,error:err.plaid_code||err.message});
   await db.from("finance_bank_items").update({status:"error"}).eq("id",item.id).eq("user_id",userId);
  }
 }
 return results;
}
export function respondError(res,error){
 const status=error.status||500;
 // Do not expose credentials or database internals.
 console.error("Ignite banking action failed:",error.plaid_code||error.message);
 return res.status(status).json({error:status===500?"Unable to complete that request. Please try again.":error.message,code:error.plaid_code||null});
}
