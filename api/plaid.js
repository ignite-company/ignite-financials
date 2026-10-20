import {authenticate,serverDb,plaid,configured,encryptAccess,decryptAccess,syncOwnedItems,verifyScope,respondError} from "./_bank.js";

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
 try{
  const user=await authenticate(req);
  const db=serverDb(),body=req.body||{},action=body.action;
  if(action==="status"){
   const [i,a,c]=await Promise.all([
    db.from("finance_bank_items").select("id,scope,institution_name,institution_id,status,last_synced_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
    db.from("finance_bank_accounts").select("id,bank_item_id,plaid_account_id,scope,name,mask,type,subtype").eq("user_id",user.id),
    db.from("finance_spend_categories").select("id,scope,name").eq("user_id",user.id).order("created_at",{ascending:true})
   ]);
   if(i.error||a.error||c.error)throw i.error||a.error||c.error;
   let transactions=[];
   for(let offset=0;offset<6000;offset+=1000){
    const r=await db.from("finance_bank_transactions").select("id,bank_item_id,plaid_account_id,scope,date,description,merchant_name,amount,category_primary,category_detailed,category_override,spend_category_id,exclude_from_spending,tags,bucket_id,pending,is_removed").eq("user_id",user.id).eq("is_removed",false).order("date",{ascending:false}).range(offset,offset+999);
    if(r.error)throw r.error;
    transactions.push(...r.data);
    if(r.data.length<1000)break;
   }
   return res.json({configured:configured(),environment:process.env.PLAID_ENV==="production"?"production":"sandbox",items:i.data,accounts:a.data,categories:c.data,transactions});
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
   if(process.env.PLAID_ENV==="production")payload.redirect_uri=process.env.PLAID_REDIRECT_URI||"https://ignite-financials.vercel.app/";
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

  if(action==="category-create"||action==="category-rename"||action==="category-delete"){
   if(!verifyScope(body.scope))return res.status(400).json({error:"Invalid workspace."});
   if(action==="category-create"){
    const name=String(body.name||"").trim().replace(/\s+/g," ");
    if(name.length<1||name.length>40)return res.status(400).json({error:"Category names must have 1–40 characters."});
    const {data:added,error}=await db.from("finance_spend_categories").insert({user_id:user.id,scope:body.scope,name}).select("id,scope,name").single();
    if(error){if(error.code==="23505")return res.status(409).json({error:"That category already exists."});throw error;}
    return res.json({category:added});
   }
   if(typeof body.category_id!=="string")return res.status(400).json({error:"Choose a category."});
   const {data:current,error:findError}=await db.from("finance_spend_categories").select("id,name").eq("id",body.category_id).eq("user_id",user.id).eq("scope",body.scope).maybeSingle();
   if(findError)throw findError;
   if(!current)return res.status(404).json({error:"Category no longer exists."});
   if(action==="category-delete"){
    const {error}=await db.from("finance_spend_categories").delete().eq("id",current.id).eq("user_id",user.id).eq("scope",body.scope);
    if(error)throw error;
    return res.json({deleted:true});
   }
   const name=String(body.name||"").trim().replace(/\s+/g," ");
   if(name.length<1||name.length>40)return res.status(400).json({error:"Category names must have 1–40 characters."});
   const {data:changed,error}=await db.from("finance_spend_categories").update({name,updated_at:new Date().toISOString()}).eq("id",current.id).eq("user_id",user.id).eq("scope",body.scope).select("id,scope,name").single();
   if(error){if(error.code==="23505")return res.status(409).json({error:"That category already exists."});throw error;}
   return res.json({category:changed});
  }
  if(action==="transaction-category"||action==="transaction-exclude"){
   const {data:t,error}=await db.from("finance_bank_transactions").select("id,scope").eq("id",body.transaction_id).eq("user_id",user.id).maybeSingle();
   if(error)throw error;
   if(!t)return res.status(404).json({error:"Transaction not found."});
   if(action==="transaction-category"){
    const categoryId=body.category_id||null;
    if(categoryId){
     const {data:c,error:ce}=await db.from("finance_spend_categories").select("id").eq("id",categoryId).eq("scope",t.scope).eq("user_id",user.id).maybeSingle();
     if(ce)throw ce;
     if(!c)return res.status(400).json({error:"Create or select a category in this workspace."});
    }
    const {data:saved,error:writeError}=await db.from("finance_bank_transactions")
     .update({spend_category_id:categoryId,updated_at:new Date().toISOString()})
     .eq("id",t.id).eq("user_id",user.id)
     .select("id,spend_category_id,pending,exclude_from_spending").single();
    if(writeError)throw writeError;
    if(saved.spend_category_id!==categoryId)throw new Error("Category could not be confirmed.");
    return res.json({saved:true,transaction:saved});
   }
   if(typeof body.exclude!=="boolean")return res.status(400).json({error:"Invalid transaction setting."});
   const {error:writeError}=await db.from("finance_bank_transactions").update({exclude_from_spending:body.exclude,updated_at:new Date().toISOString()}).eq("id",t.id).eq("user_id",user.id);
   if(writeError)throw writeError;
   return res.json({saved:true});
  }
  if(action==="label"){
   const {data:t,error}=await db.from("finance_bank_transactions").select("id,scope").eq("id",body.transaction_id).eq("user_id",user.id).single();
   if(error||!t)return res.status(404).json({error:"Transaction not found."});
   const tagArray=Array.isArray(body.tags)?body.tags.map(x=>String(x).trim().slice(0,40)).filter(Boolean).slice(0,12):[];
   const categoryId=body.category_id||null;
   if(categoryId){
    const {data:category,error:categoryError}=await db.from("finance_spend_categories").select("id").eq("id",categoryId).eq("scope",t.scope).eq("user_id",user.id).maybeSingle();
    if(categoryError)throw categoryError;
    if(!category)return res.status(400).json({error:"Invalid spending category."});
   }
   const bucket=body.bucket_id||null;
   if(bucket){
    const {data:b}=await db.from("finance_buckets").select("id").eq("id",bucket).eq("user_id",user.id).eq("scope",t.scope).maybeSingle();
    if(!b)return res.status(400).json({error:"Invalid allocation bucket."});
   }
   const {error:saveError}=await db.from("finance_bank_transactions").update({tags:[...new Set(tagArray)],spend_category_id:categoryId,bucket_id:bucket,updated_at:new Date().toISOString()}).eq("id",t.id).eq("user_id",user.id);
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
