import React,{useEffect,useMemo,useRef,useState} from "react";
import {Building2,Plus,RefreshCw,Landmark,ReceiptText,ArrowDownRight,ArrowUpRight,Search,SlidersHorizontal,X,Tag,ShieldCheck,LockKeyhole,AlertCircle,Check,CalendarDays,Link2Off,Wallet,ChevronDown} from "lucide-react";

const usd=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const moneyDate=s=>{const d=new Date(s+"T12:00:00");return Number.isNaN(+d)?s:d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})};
const options=["Takeout","Groceries","Restaurants","Coffee","Shopping","Subscriptions","Transport","Housing","Utilities","Insurance","Healthcare","Entertainment","Gifts","Personal","Business","Income","Transfers","Fees","Other"];
const customCategory=t=>{
 if(t.category_override)return t.category_override;
 const primary=(t.category_primary||"").toUpperCase(),detail=(t.category_detailed||"").toUpperCase(),merchant=(t.merchant_name||t.description||"").toLowerCase();
 if(/doordash|uber eats|ubereats|grubhub|postmates|seamless|delivery\.com/.test(merchant))return "Takeout";
 if(primary.includes("FOOD")||detail.includes("FOOD")) {
  if(/COFFEE|CAFE/.test(detail))return "Coffee";
  if(/GROCER/.test(detail))return "Groceries";
  if(/FAST_FOOD|TAKEOUT|FOOD_DELIVERY/.test(detail))return "Takeout";
  return "Restaurants";
 }
 if(primary.includes("INCOME")||t.amount<0)return "Income";
 if(primary.includes("TRANSFER")||detail.includes("TRANSFER"))return "Transfers";
 if(primary.includes("GROCER"))return "Groceries";
 if(primary.includes("SHOP"))return "Shopping";
 if(primary.includes("TRANSPORT")||primary.includes("TRAVEL"))return "Transport";
 if(primary.includes("RENT")||primary.includes("HOME"))return "Housing";
 if(primary.includes("LOAN"))return "Personal";
 if(primary.includes("ENTERTAINMENT")||primary.includes("RECREATION"))return "Entertainment";
 if(primary.includes("SERVICE")||primary.includes("SUBSCRIPTION"))return "Subscriptions";
 if(primary.includes("HEALTH"))return "Healthcare";
 if(primary.includes("BANK_FEES"))return "Fees";
 return "Other";
};
async function openPlaidScript(){
 if(window.Plaid)return window.Plaid;
 await new Promise((resolve,reject)=>{
  const s=document.createElement("script");s.src="https://cdn.plaid.com/link/v2/stable/link-initialize.js";s.async=true;
  s.onload=resolve;s.onerror=()=>reject(new Error("Could not load secure Plaid bank login."));document.head.appendChild(s);
 });
 if(!window.Plaid)throw new Error("Plaid Link did not initialize.");
 return window.Plaid;
}
export default function Banking({db,scope,buckets,onNotice}){
 const [data,setData]=useState({items:[],accounts:[],transactions:[],configured:false,environment:"sandbox"});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[modal,setModal]=useState(null),[search,setSearch]=useState(""),[period,setPeriod]=useState("month"),[filter,setFilter]=useState("All categories"),[account,setAccount]=useState("all"),[tagFilter,setTagFilter]=useState("All tags"),[form,setForm]=useState({category:"",tags:"",bucket_id:""});
 const scopeRef=useRef(scope),inflight=useRef(0);
 useEffect(()=>{scopeRef.current=scope;setAccount("all");setFilter("All categories");setTagFilter("All tags");setPeriod("month");},[scope]);
 const api=async(action,payload={})=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error("Your session expired. Please sign in again.");
  const r=await fetch("/api/plaid",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,...payload}),cache:"no-store"});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body.error||"Banking request failed.");
  return body;
 };
 const refresh=async()=>{
  const n=++inflight.current;
  setLoading(true);
  try{const d=await api("status");if(n===inflight.current)setData(d);}
  catch(e){if(n===inflight.current)onNotice(e.message);}
  finally{if(n===inflight.current)setLoading(false);}
 };
 useEffect(()=>{refresh();return()=>{inflight.current++;}},[]);
 const items=data.items.filter(i=>i.scope===scope);
 const accounts=data.accounts.filter(a=>a.scope===scope);
 const transactions=data.transactions.filter(t=>t.scope===scope&&!t.is_removed);
 const startOfMonth=new Date();startOfMonth.setDate(1);startOfMonth.setHours(0,0,0,0);
 const filtered=useMemo(()=>transactions.filter(t=>{
  const dt=new Date(t.date+"T12:00:00");
  if(period==="month"&&dt<startOfMonth)return false;
  if(period==="90"&&dt<new Date(Date.now()-90*86400000))return false;
  if(account!=="all"&&t.plaid_account_id!==account)return false;
  if(filter!=="All categories"&&customCategory(t)!==filter)return false;
  if(tagFilter!=="All tags"&&!(t.tags||[]).includes(tagFilter))return false;
  return [t.description,t.merchant_name,customCategory(t),...(t.tags||[])].some(x=>String(x||"").toLowerCase().includes(search.toLowerCase()));
 }),[transactions,period,account,filter,tagFilter,search,scope]);
 const report=filtered.filter(t=>!t.pending);
 const spent=report.filter(t=>t.amount>0&&customCategory(t)!=="Transfers").reduce((n,t)=>n+Number(t.amount),0);
 const takeout=report.filter(t=>t.amount>0&&customCategory(t)==="Takeout").reduce((n,t)=>n+Number(t.amount),0);
 const partner=report.filter(t=>t.amount>0&&(t.tags||[]).some(x=>x.toLowerCase()==="girlfriend")).reduce((n,t)=>n+Number(t.amount),0);
 const received=report.filter(t=>t.amount<0&&customCategory(t)!=="Transfers").reduce((n,t)=>n-Math.abs(Number(t.amount)),0);
 const categoryData=Object.entries(report.filter(t=>t.amount>0&&customCategory(t)!=="Transfers").reduce((map,t)=>{const cat=customCategory(t);map[cat]=(map[cat]||0)+Number(t.amount);return map;},{})).sort((a,b)=>b[1]-a[1]);
 const categories=["All categories",...new Set(transactions.map(customCategory))].sort((a,b)=>a==="All categories"?-1:b==="All categories"?1:a.localeCompare(b));
 const tags=["All tags",...new Set(transactions.flatMap(t=>t.tags||[]))].sort((a,b)=>a==="All tags"?-1:b==="All tags"?1:a.localeCompare(b));
 async function connectBank(updateItem=null){
  if(!data.configured){onNotice("Add PLAID_CLIENT_ID and PLAID_SECRET to this Vercel project first.");return}
  setBusy(true);
  try{
   const ret=await api("link-token",{scope,update_item_id:updateItem?.id});
   const Plaid=await openPlaidScript();
   const handler=Plaid.create({
    token:ret.link_token,
    onSuccess:async(public_token,metadata)=>{
     setBusy(true);
     try{
      if(!updateItem){
       const institution=metadata?.institution||{};
       const linked=await api("exchange",{scope,public_token,institution_id:institution.institution_id,institution_name:institution.name});
       onNotice("Bank connected. "+(linked.account_count||0)+" account(s) imported. Transactions can take some time to appear.");
      }else{
       await api("sync",{scope});onNotice("Bank connection refreshed.");
      }
      await refresh();
     }catch(e){onNotice(e.message);}
     finally{setBusy(false);handler.destroy?.();}
    },
    onExit:(error)=>{
     setBusy(false);handler.destroy?.();
     if(error)onNotice(error.display_message||"Bank connection was cancelled.");
    }
   });
   handler.open();
  }catch(e){onNotice(e.message);setBusy(false);}
 }
 async function syncNow(){
  if(!items.length)return;setBusy(true);
  try{
   const v=await api("sync",{scope});const failed=(v.results||[]).filter(x=>!x.ok);
   onNotice(failed.length? "Sync finished with an issue: "+failed.map(x=>x.error).join(", "):"Bank transactions updated.");
   await refresh();
  }catch(e){onNotice(e.message);}finally{setBusy(false);}
 }
 async function unlink(item){
  if(!confirm("Disconnect "+item.institution_name+"? This also deletes its imported bank transactions and custom labels. Existing manual ledger entries remain untouched."))return;
  setBusy(true);
  try{await api("disconnect",{item_id:item.id});onNotice("Bank disconnected.");await refresh();}
  catch(e){onNotice(e.message);}finally{setBusy(false);}
 }
 function editLabel(t){setForm({category:t.category_override||customCategory(t),tags:(t.tags||[]).join(", "),bucket_id:t.bucket_id||""});setModal(t);}
 async function saveLabels(e){
  e.preventDefault();if(!modal)return;setBusy(true);
  try{
   await api("label",{transaction_id:modal.id,category_override:form.category,tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean),bucket_id:form.bucket_id||null});
   setModal(null);onNotice("Category, tags and virtual bucket saved.");await refresh();
  }catch(e){onNotice(e.message)}finally{setBusy(false)}
 }
 const accountById=new Map(accounts.map(a=>[a.plaid_account_id,a]));
 return <div className="bank-view">
  <div className="bank-top-panel">
   <div className="bank-top-icon"><Landmark size={22}/></div>
   <div className="bank-top-content"><b>Connected bank accounts</b><p>Read-only. Your real bank balances and money never move.</p></div>
   <div className="bank-top-buttons">{items.length>0&&<button className="button" disabled={busy} onClick={syncNow}><RefreshCw size={16} className={busy?"spin":""}/>Sync now</button>}<button className="primary" disabled={busy||!data.configured} onClick={()=>connectBank()}><Plus size={16}/>Connect bank</button></div>
  </div>
  {!data.configured&&<div className="bank-setup"><AlertCircle size={20}/><div><strong>One-time Plaid setup required</strong><p>In Vercel, add <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> under Settings → Environment Variables. Redeploy afterward. You'll first be in Sandbox for testing; switch to production only when your Plaid account is approved for live connections. Never put API secrets in GitHub or chat.</p></div></div>}
  {data.configured&&data.environment!=="production"&&<div className="bank-sandbox"><AlertCircle size={16}/> Plaid Sandbox is enabled. This connects test banks only. Live banks require Plaid production access.</div>}
  <div className="bank-accounts">
   {loading?<div className="bank-load">Loading accounts…</div>:
   !items.length?<div className="bank-empty-mini"><Building2 size={23}/><strong>No banks connected</strong><p>Connect your first bank to automatically import transactions.</p></div>:
   items.map(item=><div className="bank-institution" key={item.id}>
    <div className="bank-institution-head"><div className="bank-initial">{item.institution_name.slice(0,1).toUpperCase()}</div><div><strong>{item.institution_name}</strong><small>Last sync: {item.last_synced_at?new Date(item.last_synced_at).toLocaleString():"Waiting for first sync"}</small></div><span className={"bank-state "+(item.status==="error"?"err":"")}>{item.status==="error"?"Needs attention":"Connected"}</span></div>
    <div className="bank-accounts-list">{accounts.filter(a=>a.bank_item_id===item.id).map(a=><div key={a.id}><Wallet size={15}/><span>{a.name}{a.mask?" ····"+a.mask:""}</span><small>{a.subtype||a.type||"Account"}</small></div>)}</div>
    <div className="bank-account-actions"><button disabled={busy} onClick={()=>connectBank(item)}>Reconnect</button><button disabled={busy} onClick={()=>unlink(item)}><Link2Off size={13}/> Disconnect</button></div>
   </div>)}
  </div>
  <div className="bank-stats">
   <div><span>Total spending</span><strong>{usd(spent)}</strong><small>Posted transactions in selected filters</small></div>
   <div><span>Takeout</span><strong>{usd(takeout)}</strong><small>Food delivery and takeaway</small></div>
   <div><span>Girlfriend</span><strong>{usd(partner)}</strong><small>Purchases you've tagged</small></div>
   <div><span>Money received</span><strong>{usd(-received)}</strong><small>Deposits excluding transfers</small></div>
  </div>
  <div className="bank-grid">
   <section className="panel bank-breakdown"><div className="panel-head"><div><h2>Spending breakdown</h2><p>What you actually spent by category</p></div></div>{categoryData.length?<div className="bank-breakdown-inner">{categoryData.slice(0,8).map(([name,total])=><div className="bank-category-row" key={name}><div><strong>{name}</strong><span>{usd(total)}</span></div><div className="bank-meter"><div style={{width:(spent?total/spent*100:0)+"%"}}/></div></div>)}</div>:<div className="bank-empty-inline">Nothing to chart yet. Connect a bank or expand the date filter.</div>}</section>
   <section className="panel bank-tag-tips"><div className="panel-head"><div><h2>How spending tags work</h2><p>Personal context beyond bank categories</p></div></div><div className="bank-tip"><div className="bank-tip-ico"><Tag size={19}/></div><div><strong>Tag girlfriend spending</strong><p>Open a transaction and enter <b>Girlfriend</b>. The dashboard totals every purchase carrying that tag.</p></div></div><div className="bank-tip"><div className="bank-tip-ico"><SlidersHorizontal size={19}/></div><div><strong>Assign virtual budgets</strong><p>Choose an allocation bucket for each purchase. No actual bank transfers happen.</p></div></div><div className="bank-tip"><div className="bank-tip-ico"><ShieldCheck size={19}/></div><div><strong>No double counting</strong><p>Imported bank transactions are separate from the manual revenue and profit ledger.</p></div></div></section>
  </div>
  <section className="panel bank-table-wrap">
   <div className="panel-head"><div><h2>Bank transactions</h2><p>{filtered.length} transaction{filtered.length===1?"":"s"} shown · posted and pending</p></div><div className="bank-table-actions"><button className="button" disabled={busy||!items.length} onClick={syncNow}><RefreshCw size={15}/>Sync</button></div></div>
   <div className="bank-filters">
    <div className="searchbox"><Search size={15}/><input placeholder="Search merchant, tag or description" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <select aria-label="Period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="month">This month</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
    <select aria-label="Account" value={account} onChange={e=>setAccount(e.target.value)}><option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.plaid_account_id}>{a.name}{a.mask?" ··"+a.mask:""}</option>)}</select>
    <select aria-label="Category" value={filter} onChange={e=>setFilter(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select>
    <select aria-label="Tag" value={tagFilter} onChange={e=>setTagFilter(e.target.value)}>{tags.map(x=><option key={x}>{x}</option>)}</select>
   </div>
   <div className="table-scroll"><table className="bank-table"><thead><tr><th>Merchant / description</th><th>Date</th><th>Category & tags</th><th>Account</th><th className="right">Amount</th><th/></tr></thead><tbody>
    {filtered.map(t=><tr key={t.id}><td><div className="merchant"><div className={"merchant-icon "+(t.amount<0?"incoming":"")}><ReceiptText size={16}/></div><div><strong>{t.merchant_name||t.description}</strong><small>{t.pending?"Pending · ":""}{t.merchant_name?t.description:"Bank transaction"}</small></div></div></td><td>{moneyDate(t.date)}</td><td><span className="tag">{customCategory(t)}</span>{(t.tags||[]).slice(0,2).map(tag=><span className="bank-custom-tag" key={tag}>{tag}</span>)}</td><td>{accountById.get(t.plaid_account_id)?.name||"Bank account"}</td><td className={"right "+(t.amount<0?"amount-green":"amount-dark")}>{t.amount<0?"+":"−"}{usd(Math.abs(t.amount))}</td><td><button className="bank-edit-btn" onClick={()=>editLabel(t)}>Categorize</button></td></tr>)}
   </tbody></table></div>
   {!filtered.length&&<div className="bank-empty"><ReceiptText size={25}/><strong>No matching bank transactions</strong><p>{items.length?"Try syncing or expanding the filters. Historical activity may still be processing.":"Once you connect your bank, its transactions appear here."}</p></div>}
  </section>
  <div className="bank-disclaimer"><LockKeyhole size={15}/> Bank access is read-only. Totals exclude pending transactions and internal transfers where identified. Categories are estimates until reviewed. Daily automatic syncing runs when Plaid is configured.</div>
  {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><div className="modal-card bank-edit-modal">
   <div className="modal-heading"><div><div className="eyebrow">BANK TRANSACTION</div><h2>Organize this purchase</h2></div><button className="icon-btn" onClick={()=>setModal(null)}><X size={20}/></button></div>
   <form className="modal-form" onSubmit={saveLabels}><div className="bank-modal-summary"><strong>{modal.description}</strong><span>{moneyDate(modal.date)} · {usd(Math.abs(modal.amount))}</span></div>
   <div className="field"><label>Spending category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{[...new Set([...options,form.category])].filter(Boolean).map(x=><option key={x}>{x}</option>)}</select></div>
   <div className="field"><label>Custom tags (separate with commas)</label><input value={form.tags} placeholder="Girlfriend, Date night, Gifts" onChange={e=>setForm(f=>({...f,tags:e.target.value}))}/></div>
   <div className="field"><label>Virtual allocation bucket</label><select value={form.bucket_id} onChange={e=>setForm(f=>({...f,bucket_id:e.target.value}))}><option value="">Not assigned</option>{buckets.filter(b=>b.scope===scope).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
   <p className="bank-modal-note">Tags and buckets are only labels for your records. No money moves. Bank transactions stay separate from your manually recorded income and expenses.</p>
   <div className="modal-footer"><button type="button" className="button" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}><Check size={16}/>{busy?"Saving...":"Save categorization"}</button></div>
   </form>
  </div></div>}
 </div>;
}
