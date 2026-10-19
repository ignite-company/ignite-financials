import {authenticate,serverDb,plaid,configured,encryptAccess,decryptAccess,syncOwnedItems,verifyScope,respondError} from "./_bank.js";

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
 try{
  const user=await authenticate(req);
  const db=serverDb(),body=req.body||{},action=body.action;
  if(action==="status"){
   const [i,a]=await Promise.all([
    db.from("finance_bank_items").select("id,scope,institution_name,institution_id,status,last_synced_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
    db.from("finance_bank_accounts").select("id,bank_item_id,plaid_account_id,scope,name,mask,type,subtype").eq("user_id",user.id)
   ]);
   if(i.error||a.error)throw i.error||a.error;
   let transactions=[];
   for(let offset=0;offset<6000;offset+=1000){
    const r=await db.from("finance_bank_transactions").select("id,bank_item_id,plaid_account_id,scope,date,description,merchant_name,amount,category_primary,category_detailed,category_override,tags,bucket_id,pending,is_removed").eq("user_id",user.id).eq("is_removed",false).order("date",{ascending:false}).range(offset,offset+999);
    if(r.error)throw r.error;
    transactions.push(...r.data);
    if(r.data.length<1000)break;
   }
   return res.json({configured:configured(),environment:process.env.PLAID_ENV==="production"?"production":"sandbox",items:i.data,accounts:a.data,transactions});
  }
  if(action==="link-token"){
   if(!configured())return res.status(503).json({error:"Plaid API credentials are not configured in Vercel yet."});
   if(!verifyScope(body.scope))return res.status(400).json({error:"Choose a valid workspace."});
   let payload={user:{client_user_id:user.id},client_name:"Ignite Financials",products:["transactions"],transactions:{days_requested:180},country_codes:["US"],language:"en"};
   if(body.update_item_id){
    const {data:item,error}=await db.from("finance_bank_items").select("*").eq("id",body.update_item_id).eq("user_id",user.id).single();
    if(error||!item)return res.status(404).json({error:"Bank connection not found."});
    payload={user:{client_user_id:user.id},client_name:"Ignite Financials",access_token:decryptAccess(item.access_token_ciphertext),country_codes:["US"],language:"en"};
   }
   const data=await plaid("link/token/create",payload);
   return res.json({link_token:data.link_token,mode:body.update_item_id?"update":"connect"});
  }
  if(action==="exchange"){
   if(!configured())return res.status(503).json({error:"Plaid API credentials are not configured in Vercel yet."});
   if(!verifyScope(body.scope)||typeof body.public_token!=="string"||!body.public_token.startsWith("public-"))return res.status(400).json({error:"Invalid connection request."});
   const result=await plaid("item/public_token/exchange",{public_token:body.public_token});
   const institution_name=String(body.institution_name||"Connected bank").slice(0,150);
   const institution_id=String(body.institution_id||"").slice(0,100)||null;
   const {data:existing}=await db.from("finance_bank_items").select("id,user_id,scope").eq("plaid_item_id",result.item_id).maybeSingle();
   if(existing && existing.user_id!==user.id)return res.status(409).json({error:"This connection belongs to another user."});
   const payload={user_id:user.id,scope:existing?.scope||body.scope,plaid_item_id:result.item_id,access_token_ciphertext:encryptAccess(result.access_token),institution_name,institution_id,status:"active"};
   const {data:record,error:writeError}=await db.from("finance_bank_items").upsert(payload,{onConflict:"plaid_item_id"}).select("id,user_id,scope").single();
   if(writeError)throw writeError;
   const info=await plaid("accounts/get",{access_token:result.access_token});
   const accounts=(info.accounts||[]).map(a=>({
    user_id:user.id,scope:record.scope,bank_item_id:record.id,plaid_account_id:a.account_id,name:a.name||"Account",
    official_name:a.official_name||null,mask:a.mask||null,type:a.type||null,subtype:a.subtype||null
   }));
   if(accounts.length){
    const {error}=await db.from("finance_bank_accounts").upsert(accounts,{onConflict:"plaid_account_id"});
    if(error)throw error;
   }
   // Transactions may initially take time to become available; still report the Item as linked.
   const synced=await syncOwnedItems(db,user.id,record.scope);
   return res.json({connected:true,account_count:accounts.length,synced});
  }
  if(action==="sync"){
   if(!configured())return res.status(503).json({error:"Plaid API credentials are not configured in Vercel yet."});
   const results=await syncOwnedItems(db,user.id,verifyScope(body.scope)?body.scope:null);
   return res.json({results});
  }
  if(action==="label"){
   const {data:t,error}=await db.from("finance_bank_transactions").select("id,scope").eq("id",body.transaction_id).eq("user_id",user.id).single();
   if(error||!t)return res.status(404).json({error:"Transaction not found."});
   const tagArray=Array.isArray(body.tags)?body.tags.map(x=>String(x).trim().slice(0,40)).filter(Boolean).slice(0,12):[];
   const category=String(body.category_override||"").trim().slice(0,90)||null;
   const bucket=body.bucket_id||null;
   if(bucket){
    const {data:b}=await db.from("finance_buckets").select("id").eq("id",bucket).eq("user_id",user.id).eq("scope",t.scope).maybeSingle();
    if(!b)return res.status(400).json({error:"Invalid allocation bucket."});
   }
   const {error:saveError}=await db.from("finance_bank_transactions").update({tags:[...new Set(tagArray)],category_override:category,bucket_id:bucket,updated_at:new Date().toISOString()}).eq("id",t.id).eq("user_id",user.id);
   if(saveError)throw saveError;
   return res.json({saved:true});
  }
  if(action==="disconnect"){
   const {data:item,error}=await db.from("finance_bank_items").select("*").eq("id",body.item_id).eq("user_id",user.id).single();
   if(error||!item)return res.status(404).json({error:"Bank connection not found."});
   const result=await plaid("item/remove",{access_token:decryptAccess(item.access_token_ciphertext)});
   if(!result.removed)return res.status(502).json({error:"Plaid could not disconnect the bank. Please retry."});
   const {error:deleteError}=await db.from("finance_bank_items").delete().eq("id",item.id).eq("user_id",user.id);
   if(deleteError)throw deleteError;
   return res.json({removed:true});
  }
  return res.status(400).json({error:"Unknown banking action."});
 }catch(error){return respondError(res,error);}
}
