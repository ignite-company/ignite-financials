import React, {useEffect,useMemo,useRef,useState} from "react";
import { summarizeSpending } from "./spendingMath.js";
import { INFLOW_TYPES,INFLOW_UNCLASSIFIED,summarizeInflows } from "./inflowMath.js";
import {ArrowDownLeft,ArrowUpRight,Building2,Check,ChevronLeft,ChevronRight,CircleHelp,FolderPlus,Landmark,Link2Off,LockKeyhole,MoreHorizontal,Pencil,Plus,ReceiptText,RefreshCw,Search,Settings2,Tag,Trash2,X} from "lucide-react";

const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const day=s=>new Date(s+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
const currentMonth=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const formatMonth=s=>new Date(s+"-01T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"});
const shiftMonth=(s,n)=>{const [y,m]=s.split("-").map(Number),d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
async function openPlaid(){
 if(window.Plaid)return window.Plaid;
 await new Promise((resolve,reject)=>{
  const el=document.createElement("script");el.src="https://cdn.plaid.com/link/v2/stable/link-initialize.js";el.async=true;
  el.onload=resolve;el.onerror=()=>reject(new Error("Could not load Plaid bank login."));
  document.head.appendChild(el);
 });
 if(!window.Plaid)throw new Error("Plaid did not initialize.");
 return window.Plaid;
}
const safeArray=value=>Array.isArray(value)?value:[];

export default function Banking({db,scope,buckets,onNotice}){
 const [state,setState]=useState({items:[],accounts:[],categories:[],transactions:[],configured:false,environment:"production"});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[month,setMonth]=useState(currentMonth()),[account,setAccount]=useState("all"),[search,setSearch]=useState(""),[kind,setKind]=useState("spending"),[categoryFilter,setCategoryFilter]=useState("all");
 const [categoryPanel,setCategoryPanel]=useState(false),[newCategory,setNewCategory]=useState(""),[editingId,setEditingId]=useState(null),[editingName,setEditingName]=useState(""),[details,setDetails]=useState(null),[tagsDraft,setTagsDraft]=useState(""),[bucketDraft,setBucketDraft]=useState(""),[savingId,setSavingId]=useState(null),[lastSavedId,setLastSavedId]=useState(null);
 const inflight=useRef(0);
 const api=async(action,payload={})=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in again.");
  const res=await fetch("/api/plaid",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},cache:"no-store",body:JSON.stringify({action,...payload})});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.error||"Unable to update banking data.");
  return json;
 };
 const load=async(silent=false)=>{
  const req=++inflight.current;
  if(!silent)setLoading(true);
  try{const result=await api("status");if(req===inflight.current)setState(result);}
  catch(e){if(req===inflight.current)onNotice(e.message);}
  finally{if(req===inflight.current)setLoading(false);}
 };
 useEffect(()=>{load();return()=>{inflight.current++;}},[]);
 useEffect(()=>{setAccount("all");setKind("spending");setCategoryFilter("all");setMonth(currentMonth());},[scope]);
 const items=safeArray(state.items).filter(i=>i.scope===scope);
 const accounts=safeArray(state.accounts).filter(a=>a.scope===scope);
 const categories=safeArray(state.categories).filter(c=>c.scope===scope);
 const transactions=safeArray(state.transactions).filter(t=>t.scope===scope&&!t.is_removed);
 const categoryById=useMemo(()=>new Map(categories.map(c=>[c.id,c])),[categories]);
 const accountByPlaidId=useMemo(()=>new Map(accounts.map(a=>[a.plaid_account_id,a])),[accounts]);
 const monthAccountTransactions=useMemo(()=>transactions.filter(t=>t.date?.startsWith(month)&&(account==="all"||t.plaid_account_id===account)),[transactions,month,account]);
 const {
  purchases,spending,pendingSpending,pendingTotal,spendingTotal,postedTotal,
  excludedPurchases,excludedTotal,unassigned,categoryCards,uncategorized
 }=summarizeSpending(monthAccountTransactions,categories);
 const inflows=summarizeInflows(monthAccountTransactions);
 const unclassifiedInflow=inflows.groups.find(x=>x.id==="unclassified");
 const displayed=monthAccountTransactions.filter(t=>{
  if(kind==="spending"&&Number(t.amount)<=0)return false;
  if(kind==="income"&&Number(t.amount)>=0)return false;
  if(categoryFilter!=="all"){
   if(kind==="income"){
    if(categoryFilter==="unclassified"){if(t.inflow_type)return false;}
    else if(t.inflow_type!==categoryFilter)return false;
   }else{
    if(categoryFilter==="uncategorized"){if(t.spend_category_id&&categoryById.has(t.spend_category_id))return false;}
    else if(t.spend_category_id!==categoryFilter)return false;
   }
  }
  return [t.description,t.merchant_name,accountByPlaidId.get(t.plaid_account_id)?.name,...safeArray(t.tags)].some(x=>String(x||"").toLowerCase().includes(search.toLowerCase()));
 }).sort((a,b)=>b.date.localeCompare(a.date));
 const totalDeposits=monthAccountTransactions.filter(t=>Number(t.amount)<0&&!t.pending&&!t.exclude_from_spending).reduce((n,t)=>n+Math.abs(Number(t.amount)),0);
 const allDates=transactions.length;
 async function mutate(action,args={},message){
  setBusy(true);
  try{const v=await api(action,args);await load(true);if(message)onNotice(message);return v;}
  catch(e){onNotice(e.message);return null;}
  finally{setBusy(false);}
 }
 async function saveCategory(e){
  e.preventDefault();
  const name=newCategory.trim();
  if(!name)return;
  const result=await mutate("category-create",{scope,name},"Category created.");
  if(result){setNewCategory("");setCategoryFilter("all");}
 }
 async function renameCategory(e){
  e.preventDefault();
  if(!editingId)return;
  const result=await mutate("category-rename",{scope,category_id:editingId,name:editingName.trim()},"Category renamed everywhere.");
  if(result){setEditingId(null);setEditingName("");}
 }
 async function deleteCategory(cat){
  const affected=transactions.filter(t=>t.spend_category_id===cat.id).length;
  if(!confirm("Delete \""+cat.name+"\"? "+(affected?affected+" transaction(s) will return to Uncategorized. ":"")+"The bank transactions themselves will stay saved."))return;
  const result=await mutate("category-delete",{scope,category_id:cat.id},"Category deleted; purchases remain available.");
  if(result&&categoryFilter===cat.id)setCategoryFilter("all");
 }
 async function assign(t,id){
  setSavingId(t.id);
  setLastSavedId(null);
  const previousId=t.spend_category_id||null;
  setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,spend_category_id:id||null}:row)}));
  try{
   const result=await api("transaction-category",{transaction_id:t.id,category_id:id||null});
   if(result.transaction?.spend_category_id!==(id||null))throw new Error("The bank transaction did not confirm the category.");
   await load(true);
   setLastSavedId(t.id);
  }catch(e){
   setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,spend_category_id:previousId}:row)}));
   onNotice("Couldn't save category: "+e.message);
  }
  finally{setSavingId(null);}
 }
 async function assignInflow(t,inflowType){
  setSavingId(t.id);
  setLastSavedId(null);
  const previous=t.inflow_type||null;
  const selected=inflowType||null;
  setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,inflow_type:selected}:row)}));
  try{
   const result=await api("transaction-inflow",{transaction_id:t.id,inflow_type:selected});
   if(result.transaction?.inflow_type!==selected)throw new Error("Bank did not confirm classification.");
   await load(true);
   setLastSavedId(t.id);
  }catch(e){
   setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,inflow_type:previous}:row)}));
   onNotice("Couldn't classify credit: "+e.message);
  }finally{setSavingId(null);}
 }
 async function markExcluded(t,exclude){
  setSavingId(t.id);
  const previousValue=!!t.exclude_from_spending;
  setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,exclude_from_spending:exclude}:row)}));
  try{await api("transaction-exclude",{transaction_id:t.id,exclude});await load(true);}
  catch(e){
   setState(v=>({...v,transactions:v.transactions.map(row=>row.id===t.id?{...row,exclude_from_spending:previousValue}:row)}));
   onNotice(e.message);
  }
  finally{setSavingId(null);}
 }
 function openDetails(t){setDetails(t);setTagsDraft(safeArray(t.tags).join(", "));setBucketDraft(t.bucket_id||"");}
 async function saveDetails(e){
  e.preventDefault();
  if(!details)return;
  setBusy(true);
  try{
   await api("label",{transaction_id:details.id,category_id:state.transactions.find(t=>t.id===details.id)?.spend_category_id||null,tags:tagsDraft.split(",").map(s=>s.trim()).filter(Boolean),bucket_id:bucketDraft||null});
   setDetails(null);await load(true);onNotice("Transaction details saved.");
  }catch(e){onNotice(e.message);}
  finally{setBusy(false);}
 }
 async function sync(){
  if(!items.length)return;
  await mutate("sync",{scope},"Bank sync requested. New bank transactions can take time to become available.");
 }
 async function disconnect(item){
  if(!confirm("Disconnect "+item.institution_name+"? Imported transactions from this bank will be deleted. Your custom category names will remain."))return;
  await mutate("disconnect",{item_id:item.id},"Bank disconnected.");
 }
 const pendingKey="ignite_financials_plaid_link_session";
 const clearOAuth=()=>{
  sessionStorage.removeItem(pendingKey);
  const url=new URL(window.location.href);
  if(url.searchParams.has("oauth_state_id")){url.searchParams.delete("oauth_state_id");window.history.replaceState({},"",url.pathname+url.search+url.hash);}
 };
 async function launchLink(token,forScope,updating=null,receivedRedirectUri=null){
  const Plaid=await openPlaid();
  const handler=Plaid.create({
   token,...(receivedRedirectUri?{receivedRedirectUri}:{}),
   onSuccess:async(public_token,metadata)=>{
    setBusy(true);
    try{
     if(!updating){
      const institution=metadata?.institution||{};
      const result=await api("exchange",{scope:forScope,public_token,institution_id:institution.institution_id,institution_name:institution.name});
      onNotice("Bank connected: "+(result.account_count||0)+" account(s). Transactions may take a little time to arrive.");
     }else{await api("sync",{scope:forScope});onNotice("Bank connection refreshed.");}
     await load(true);
    }catch(e){onNotice(e.message);}
    finally{clearOAuth();setBusy(false);handler.destroy?.();}
   },
   onExit:e=>{clearOAuth();setBusy(false);handler.destroy?.();if(e)onNotice(e.display_message||"Bank authorization was cancelled.");}
  });
  handler.open();
 }
 async function connect(item=null){
  if(!state.configured){onNotice("Plaid credentials need to be configured on Vercel.");return;}
  setBusy(true);
  try{
   const resp=await api("link-token",{scope,update_item_id:item?.id});
   sessionStorage.setItem(pendingKey,JSON.stringify({token:resp.link_token,scope,updateId:item?.id||null,createdAt:Date.now()}));
   await launchLink(resp.link_token,scope,item?.id||null);
  }catch(e){onNotice(e.message);setBusy(false);}
 }
 useEffect(()=>{
  const url=new URL(window.location.href);
  if(!url.searchParams.has("oauth_state_id"))return;
  const pending=JSON.parse(sessionStorage.getItem(pendingKey)||"null");
  if(!pending||Date.now()-pending.createdAt>10800000){clearOAuth();onNotice("Bank login expired. Please reconnect.");return;}
  setBusy(true);
  launchLink(pending.token,pending.scope,pending.updateId,url.href).catch(e=>{clearOAuth();setBusy(false);onNotice(e.message)});
 },[]);
 const accountsLabel=accounts.length+" account"+(accounts.length===1?"":"s")+" connected";

 return <div className="spend-layout">
  <div className="spend-month-bar">
   <div className="spend-date-control"><button aria-label="Previous month" onClick={()=>setMonth(m=>shiftMonth(m,-1))}><ChevronLeft size={17}/></button><div><span>SPENDING FOR</span><strong>{formatMonth(month)}</strong></div><button aria-label="Next month" onClick={()=>setMonth(m=>shiftMonth(m,1))}><ChevronRight size={17}/></button><input type="month" aria-label="Choose month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></div>
   <div className="spend-toolbar">
    <select aria-label="Bank account filter" value={account} onChange={e=>setAccount(e.target.value)}>
     <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.plaid_account_id}>{a.name}{a.mask?" ••"+a.mask:""}</option>)}
    </select>
    <button className="button" onClick={()=>setCategoryPanel(true)}><Settings2 size={16}/> Categories</button>
    <button className="button" disabled={busy||!items.length} onClick={sync}><RefreshCw size={15}/>Sync</button>
    <button className="primary" disabled={busy||!state.configured} onClick={()=>connect()}><Plus size={16}/>Bank</button>
   </div>
  </div>
  <div className="spend-headline">
   {kind==="income"?<>
    <div><span>THIS MONTH'S MONEY IN</span><strong>{money(inflows.total)}</strong><p>{money(inflows.posted)} posted{inflows.pending?" + "+money(inflows.pending)+" pending":""} · Classify each credit below</p></div>
    <div className="spend-headline-side"><span>{inflows.deposits.length} incoming</span><span>{unclassifiedInflow.count} unclassified</span></div>
   </>:<>
    <div><span>THIS MONTH'S SPENDING</span><strong>{money(spendingTotal)}</strong><p>{money(postedTotal)} posted{pendingSpending.length?" + "+money(pendingTotal)+" pending":""}{excludedPurchases.length?" · "+money(excludedTotal)+" excluded":""}</p></div>
    <div className="spend-headline-side"><span>{spending.length} included purchases</span><span>{unassigned.length} uncategorized</span>{excludedPurchases.length>0&&<span>{excludedPurchases.length} excluded</span>}</div>
   </>}
  </div>
  {kind==="income"?<>
    <div className="spend-categories-head"><div><h2>Where your money came from</h2><p>Classify incoming bank credits. These are separate from the revenue you've manually recorded.</p></div></div>
    <div className="spend-category-grid spend-income-grid">
     {inflows.groups.map((c,i)=><button key={c.id} className={"spend-category-card "+(categoryFilter===c.id?"selected":"")} onClick={()=>setCategoryFilter(x=>x===c.id?"all":c.id)}>
      <span><span className="spend-category-dot" style={{background:["#db3535","#1e2635","#8f98a6","#aa8b51","#c1c7cf"][i]}}/>{c.label}</span>
      <strong>{money(c.total)}</strong><small>{c.count} transaction{c.count===1?"":"s"}{c.pendingCount?" · "+c.pendingCount+" pending":""}</small>
     </button>)}
    </div>
   </>:<>
  <div className="spend-categories-head"><div><h2>Your categories</h2><p>Every purchase you've assigned counts here, including pending and excluded purchases.</p></div><button onClick={()=>setCategoryPanel(true)}><Plus size={15}/> Manage</button></div>
  <div className="spend-category-grid">
   {categoryCards.map((c,i)=><button key={c.id} className={"spend-category-card "+(categoryFilter===c.id?"selected":"")} onClick={()=>{setKind("spending");setCategoryFilter(x=>x===c.id?"all":c.id);}}>
     <span><span className="spend-category-dot" style={{background:["#e53935","#1e2635","#7c8595","#b58d4b","#ac5b65","#637e76"][i%6]}}/>{c.name}</span>
     <strong>{money(c.total)}</strong><small>{c.count} purchase{c.count===1?"":"s"}{c.pendingCount>0?" · "+c.pendingCount+" pending":""}{c.excludedCount>0?" · "+c.excludedCount+" excluded":""}</small>
   </button>)}
   <button className={"spend-category-card "+(categoryFilter==="uncategorized"?"selected":"")} onClick={()=>{setKind("spending");setCategoryFilter(x=>x==="uncategorized"?"all":"uncategorized");}}>
    <span><span className="spend-category-dot muted"/>Uncategorized</span><strong>{money(uncategorized.total)}</strong><small>{uncategorized.count} to organize{uncategorized.pendingCount>0?" · "+uncategorized.pendingCount+" pending":""}{uncategorized.excludedCount>0?" · "+uncategorized.excludedCount+" excluded":""}</small>
   </button>
   {categories.length===0&&<button className="spend-new-category-card" onClick={()=>setCategoryPanel(true)}><FolderPlus size={22}/><strong>Create your first category</strong><small>Choose whatever names make sense to you.</small></button>}
  </div>
   </>}
  <section className="panel spend-transactions">
   <div className="spend-table-heading">
    <div><h2>Transactions</h2><p>{kind==="income"?"Mark deposits as revenue, personal income, transfers or refunds.":"Spending categories update immediately, including pending purchases."}</p></div>
    <div className="spend-switch">{[["spending","Money out"],["income","Money in"],["all","All"]].map(([id,title])=><button key={id} onClick={()=>{setKind(id);setCategoryFilter("all");}} className={kind===id?"active":""}>{title}</button>)}</div>
   </div>
   <div className="spend-filters"><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search any merchant…"/></div>{categoryFilter!=="all"&&<button className="spend-clear" onClick={()=>setCategoryFilter("all")}><X size={14}/> Clear category</button>}</div>
   <div className="table-scroll"><table className="spend-table"><thead><tr><th>Merchant</th><th>Date</th><th>{kind==="income"?"Money-in type":"Category"}</th><th>Account</th><th className="right">Amount</th><th></th></tr></thead><tbody>
    {displayed.map(t=><tr key={t.id} className={t.pending?"pending-row":""}>
     <td><div className="spend-merchant"><div className={"spend-sign "+(t.amount<0?"incoming":"")} >{t.amount<0?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</div><div><strong>{t.merchant_name||t.description}</strong><small>{t.pending?"Pending • ":""}{t.exclude_from_spending?"Excluded • ":""}{safeArray(t.tags).join(", ")|| (t.merchant_name?t.description:"Transaction")}</small></div></div></td>
     <td>{day(t.date)}</td>
     <td>{t.amount>0?<><select className="spend-assign" aria-label={"Category for "+t.description} value={categoryById.has(t.spend_category_id)?t.spend_category_id:""} disabled={savingId!==null} onChange={e=>assign(t,e.target.value)}><option value="">Uncategorized</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{savingId===t.id?<small className="spend-save-status">Saving…</small>:lastSavedId===t.id?<small className="spend-save-status confirmed"><Check size={12}/> Saved</small>:null}</>:<><select className="spend-assign" aria-label={"Money-in classification for "+t.description} value={t.inflow_type||""} disabled={savingId!==null} onChange={e=>assignInflow(t,e.target.value)}><option value="">Uncategorized</option>{INFLOW_TYPES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>{savingId===t.id?<small className="spend-save-status">Saving…</small>:lastSavedId===t.id?<small className="spend-save-status confirmed"><Check size={12}/> Saved</small>:null}</>}</td>
     <td className="spend-account-cell">{accountByPlaidId.get(t.plaid_account_id)?.name||"Bank account"}</td>
     <td className={"right spend-money "+(t.amount<0?"credit":"")}>{t.amount<0?"+":"−"}{money(Math.abs(t.amount))}</td>
     <td><button aria-label={"Edit "+t.description} className="spend-more" onClick={()=>openDetails(t)}><MoreHorizontal size={18}/></button></td>
    </tr>)}
   </tbody></table></div>
   {loading?<div className="spend-empty">Loading your transactions…</div>:displayed.length===0?<div className="spend-empty"><ReceiptText size={27}/><strong>No transactions for this view</strong><p>{allDates?"Try another month, category, or account.":"Connect a bank to start tracking your purchases automatically."}</p></div>:null}
  </section>
  <p className="spend-math-note">{kind==="income"?"Money-in classifications are labels only. Transfers and refunds do not count as revenue, and classified credits do not automatically create ledger income or allocations.":"Category cards show all categorized purchases. The monthly spending total excludes items you've marked as transfers or duplicates. Use the three-dot menu on a transaction to change its exclusion."}</p>
  <div className="spend-connected-bar">
   <span><LockKeyhole size={14}/>{accountsLabel} · Read-only · No money moves</span>
   {items.length>0&&<button onClick={()=>setCategoryPanel("banks")}><Landmark size={15}/> Manage banks</button>}
  </div>
  {categoryPanel&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCategoryPanel(false);}}><div className="modal-card spend-manage-modal">
   <div className="modal-heading"><div><div className="eyebrow">SPENDING SETTINGS</div><h2>{categoryPanel==="banks"?"Connected banks":"Your categories"}</h2></div><button className="icon-btn" onClick={()=>setCategoryPanel(false)}><X size={20}/></button></div>
   {categoryPanel==="banks"?<div className="spend-manage-body">
    <p className="spend-helper">Connected banks automatically supply transactions for this workspace.</p>
    {items.map(item=><div className="spend-category-manager-row" key={item.id}><div className="spend-manager-name"><Landmark size={17}/><strong>{item.institution_name}</strong><small>{item.last_synced_at?"Synced "+new Date(item.last_synced_at).toLocaleDateString():"Waiting to sync"}</small></div><button disabled={busy} onClick={()=>connect(item)}>Reconnect</button><button disabled={busy} className="danger" onClick={()=>disconnect(item)}><Link2Off size={15}/></button></div>)}
    <button className="primary full" disabled={busy} onClick={()=>{setCategoryPanel(false);connect();}}><Plus size={16}/> Connect another bank</button>
   </div>:<div className="spend-manage-body">
    <p className="spend-helper">You decide what categories exist. Renaming a category updates all purchases. Deleting it moves those transactions to Uncategorized.</p>
    <form className="spend-add-category" onSubmit={saveCategory}><input maxLength={40} aria-label="New category name" value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="New category name (e.g. Takeout)" required/><button className="primary" disabled={busy||!newCategory.trim()}><Plus size={16}/> Add</button></form>
    <div className="spend-category-manager">{categories.length?categories.map(cat=><div className="spend-category-manager-row" key={cat.id}>{editingId===cat.id?<form className="spend-rename" onSubmit={renameCategory}><input aria-label={"Rename "+cat.name} value={editingName} maxLength={40} autoFocus onChange={e=>setEditingName(e.target.value)}/><button type="submit" disabled={busy||!editingName.trim()}><Check size={17}/></button><button type="button" onClick={()=>setEditingId(null)}><X size={17}/></button></form>:<><div className="spend-manager-name"><strong>{cat.name}</strong><small>{transactions.filter(t=>t.spend_category_id===cat.id).length} assigned</small></div><button aria-label={"Rename "+cat.name} disabled={busy} onClick={()=>{setEditingId(cat.id);setEditingName(cat.name);}}><Pencil size={16}/></button><button aria-label={"Delete "+cat.name} className="danger" disabled={busy} onClick={()=>deleteCategory(cat)}><Trash2 size={16}/></button></>}</div>):<div className="spend-empty-categories">No preset categories. Add your own above.</div>}</div>
   </div>}
  </div></div>}
  {details&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDetails(null);}}><div className="modal-card spend-details-modal">
   <div className="modal-heading"><div><div className="eyebrow">TRANSACTION DETAILS</div><h2>{details.merchant_name||details.description}</h2></div><button className="icon-btn" onClick={()=>setDetails(null)}><X size={20}/></button></div>
   <form className="modal-form" onSubmit={saveDetails}>
    <div className="spend-transaction-summary"><strong>{money(Math.abs(details.amount))}</strong><span>{day(details.date)} · {accountByPlaidId.get(details.plaid_account_id)?.name||"Bank"}</span></div>
    <div className="field"><label>Additional tags (optional)</label><input placeholder="Girlfriend, Date night, Gifts…" value={tagsDraft} onChange={e=>setTagsDraft(e.target.value)}/></div>
    <div className="field"><label>Virtual allocation bucket (optional)</label><select value={bucketDraft} onChange={e=>setBucketDraft(e.target.value)}><option value="">None</option>{buckets.filter(b=>b.scope===scope).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
    {details.amount>0&&<label className="spend-exclude"><input type="checkbox" checked={!!state.transactions.find(t=>t.id===details.id)?.exclude_from_spending} disabled={savingId===details.id} onChange={e=>markExcluded(details,e.target.checked)}/><span>Exclude this transaction from spending totals<small>Useful for transfers, credit-card payments, or duplicates.</small></span></label>}
    <div className="modal-footer"><button type="button" className="button" onClick={()=>setDetails(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}><Check size={16}/>Save</button></div>
   </form>
  </div></div>}
 </div>;
}
