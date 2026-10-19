import {serverDb,syncItem,configured,respondError} from "./_bank.js";
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const expected=process.env.CRON_SECRET;
 if(!expected||req.headers.authorization!=="Bearer "+expected)return res.status(401).json({error:"Unauthorized"});
 if(!configured())return res.status(503).json({error:"Plaid is not configured"});
 try{
  const db=serverDb();
  const {data:items,error}=await db.from("finance_bank_items").select("*").order("last_synced_at",{ascending:true,nullsFirst:true}).limit(25);
  if(error)throw error;
  let success=0,failed=0;
  for(const item of items||[]){
   try{await syncItem(db,item);success++;}
   catch(e){failed++;console.error("Bank sync failed for Item",item.id,e.plaid_code||e.message);}
  }
  return res.json({success,failed,checked:items?.length||0});
 }catch(e){return respondError(res,e)}
}
