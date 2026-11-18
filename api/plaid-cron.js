import {serverDb,syncItem,configured,respondError} from "./_bank.js";

// Vercel Cron calls this once every day (see vercel.json). The secret is server-only.
export const config={maxDuration:60};

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const expected=process.env.CRON_SECRET;
 if(!expected||req.headers.authorization!=="Bearer "+expected)return res.status(401).json({error:"Unauthorized"});
 if(!configured())return res.status(503).json({error:"Plaid is not configured"});
 try{
  const db=serverDb();
  // Sort by last ATTEMPT, not last successful sync, so a failing connection
  // cannot keep healthier connections out of the next daily batch.
  const {data:items,error}=await db.from("finance_bank_items")
   .select("*").order("last_sync_attempt_at",{ascending:true,nullsFirst:true}).limit(25);
  if(error)throw error;
  let success=0,failed=0;
  const selected=items||[];
  // Parallelize a few independent Plaid Items within the scheduled function window.
  for(let index=0;index<selected.length;index+=3){
   await Promise.all(selected.slice(index,index+3).map(async item=>{
    try{await syncItem(db,item);success++;}
    catch(e){
     failed++;
     console.error("Bank sync failed for Item",item.id,e.plaid_code||e.message);
     const {error:recordError}=await db.from("finance_bank_items").update({
      status:"error",last_sync_attempt_at:new Date().toISOString(),
      last_sync_error_code:String(e.plaid_code||"SYNC_FAILED").slice(0,100)
     }).eq("id",item.id).eq("user_id",item.user_id);
     if(recordError)console.error("Could not record failed bank sync:",recordError.message);
    }
   }));
  }
  return res.json({success,failed,checked:selected.length});
 }catch(e){return respondError(res,e)}
}
