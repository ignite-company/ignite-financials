import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LayoutDashboard, ArrowLeftRight, Wallet, ChartNoAxesCombined, Settings2, Plus, Search, Upload, LogOut, ChevronDown, X, ArrowUpRight, ArrowDownRight, CreditCard, ShieldCheck, Landmark, Pencil, Trash2, Check, CircleHelp, TrendingUp, ReceiptText, Menu, Download, LockKeyhole, CalendarDays, AlertCircle } from "lucide-react";

const ready = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const db = ready ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
const money = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n)||0);
const shortMoney = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(Number(n)||0);
const dstr = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
const defaults = {
  business:[["Taxes",25,"#171717"],["Operations",25,"#e53935"],["Owner pay",35,"#8b8f9a"],["Cash reserves",15,"#d9a441"]],
  personal:[["Essentials",50,"#171717"],["Lifestyle",25,"#e53935"],["Savings",15,"#8b8f9a"],["Buffer",10,"#d9a441"]]
};
const suggestedCategory = (description,type) => {
 const v=(description||"").toLowerCase();
 if(type==="income")return "Client payment";
 const rules=[
  ["Advertising",/meta ads|facebook ads|google ads|adwords|tiktok ads|instagram ads|advertis|marketing/],
  ["Software",/vercel|supabase|github|openai|chatgpt|anthropic|claude|instantly|smartlead|apollo|ghl|gohighlevel|leadconnector|retell|cal\.com|zoom|notion|software|subscription|stripe fee/],
  ["Contractors",/subcontract|freelancer|upwork|fiverr|contractor/],
  ["Rent",/landlord|apartment rent|rent payment|lease/],
  ["Utilities",/at&t|verizon|t-mobile|optimum|electric|internet|utility|comcast/],
  ["Transportation",/uber|lyft|shell|exxon|bp gas|fuel|parking|toll/],
  ["Meals",/starbucks|doordash|ubereats|restaurant|mcdonald|dunkin/],
  ["Insurance",/insurance|geico|progressive/],
  ["Taxes",/irs|tax payment|treasury/],
  ["Equipment",/best buy|apple store|hardware|laptop/],
 ];
 return rules.find(([,rx])=>rx.test(v))?.[0]||"Other";
};
const cats = {expense:["Advertising","Software","Contractors","Payroll","Rent","Utilities","Transportation","Meals","Insurance","Taxes","Equipment","Office","Personal","Owner draw","Transfer","Other"],income:["Client payment","Retainer","Project revenue","Other income","Transfer"]};
const isRevenue = t => t.type === "income" && t.category !== "Transfer";
const isOperatingExpense = t => t.type === "expense" && t.category !== "Transfer" && t.category !== "Owner draw";
const tabs = [{id:"overview",name:"Overview",icon:LayoutDashboard},{id:"transactions",name:"Transactions",icon:ArrowLeftRight},{id:"income",name:"Payments & revenue",icon:Wallet},{id:"allocations",name:"Allocations",icon:Landmark},{id:"reports",name:"Reports",icon:ChartNoAxesCombined},{id:"settings",name:"Settings",icon:Settings2}];
const uid = () => Math.random().toString(36).slice(2);
const toDate = s => new Date(s+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const parseCSV = (raw) => {
 let rows=[],line=[],field="",quote=false;
 for(let i=0;i<raw.length;i++){let c=raw[i];if(c==='"'){if(quote&&raw[i+1]==='"'){field+='"';i++;}else quote=!quote;}else if(c===","&&!quote){line.push(field);field="";}else if((c==="\n"||c==="\r")&&!quote){if(c==="\r"&&raw[i+1]==="\n")i++;line.push(field);if(line.some(v=>v.trim()))rows.push(line);line=[];field="";}else field+=c;}
 line.push(field);if(line.some(v=>v.trim()))rows.push(line);
 let header=(rows.shift()||[]).map(s=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,""));
 return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,(r[i]||"").trim()])));
};
const fromCSVDate = (value) => {
 const s=String(value||"").trim();
 let y,m,d;
 const iso=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:$|[T\s])/);
 const us=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
 if(iso){y=+iso[1];m=+iso[2];d=+iso[3];}
 else if(us){m=+us[1];d=+us[2];y=+us[3];if(y<100)y+=y>=70?1900:2000;}
 else return null;
 const test=new Date(Date.UTC(y,m-1,d));
 if(test.getUTCFullYear()!==y||test.getUTCMonth()!==m-1||test.getUTCDate()!==d)return null;
 return [y,String(m).padStart(2,"0"),String(d).padStart(2,"0")].join("-");
};

function Login({onError}) {
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[mode,setMode]=useState("password"),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const submit=async(e)=>{
  e.preventDefault();setBusy(true);setError("");
  const result=mode==="password"
   ? await db.auth.signInWithPassword({email:email.trim(),password})
   : await db.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}});
  setBusy(false);
  if(result.error){
   const message=result.error.message?.toLowerCase().includes("rate limit")
    ? "Email delivery is temporarily limited. Use password sign-in or try later."
    : result.error.message;
   setError(message);return;
  }
  if(mode==="magic")setSent(true);
 };
 return <div className="auth-page"><div className="auth-art"><div className="auth-orb"/><div className="auth-brand"><span className="brand-icon">I<span>.</span></span> IGNITE <b>FINANCIALS</b></div><div className="auth-headline">Clarity for<br/>every dollar<span>.</span></div><div className="auth-sub">Your income, expenses, payments, and allocations. One private command center.</div><div className="auth-bottom"><ShieldCheck size={17}/> Encrypted connection and protected personal records</div></div><div className="auth-form-side"><div className="login-card"><div className="login-mark">I<span>.</span></div><h1>{sent?"Check your inbox":"Your money, organized."}</h1><p>{sent?"Check "+email+" for your secure sign-in link.":mode==="password"?"Sign in to your private financial workspace with your email and password.":"Receive a secure sign-in link. Email sending is limited by the provider."}</p>{!sent?<><div className="login-methods"><button className={mode==="password"?"selected":""} type="button" onClick={()=>{setMode("password");setError("");}}>Password</button><button className={mode==="magic"?"selected":""} type="button" onClick={()=>{setMode("magic");setError("");}}>Email link</button></div><form onSubmit={submit}><label>Email address</label><input type="email" autoComplete="email" placeholder="you@company.com" required value={email} onChange={e=>setEmail(e.target.value)}/>{mode==="password"&&<><label>Password</label><input type="password" autoComplete="current-password" required minLength={6} placeholder="Your account password" value={password} onChange={e=>setPassword(e.target.value)}/></>}{error&&<div className="error"><AlertCircle size={15}/>{error}</div>}<button className="primary full" disabled={busy}>{busy?"Please wait...":mode==="password"?"Sign in":"Email me a sign-in link"} <ArrowUpRight size={17}/></button></form>{mode==="password"&&<p className="login-helper">No password yet? Create a confirmed user with a password in Supabase Authentication → Users, or use an email link once the email limit resets.</p>}</>:<button className="button full" onClick={()=>setSent(false)}>Back to sign in</button>}<small><LockKeyhole size={13}/> Private dashboard. Bank transfers are disabled.</small></div></div></div>;
}

function Stat({label,value,sub,icon:Icon,positive,negative}) {return <div className="stat"><div className="stat-top"><span>{label}</span><span className="stat-ico"><Icon size={19}/></span></div><div className="stat-value">{value}</div><div className={"stat-sub "+(positive?"good":negative?"bad":"")}>{sub}</div></div>}
function Empty({icon:Icon,title,body,action,onAction}){return <div className="empty"><div className="empty-icon"><Icon size={24}/></div><strong>{title}</strong><p>{body}</p>{onAction&&<button className="small-red" onClick={onAction}><Plus size={14}/>{action}</button>}</div>}

export default function App(){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[view,setView]=useState("overview"),[scope,setScope]=useState("business"),[period,setPeriod]=useState("month");
 const [transactions,setTransactions]=useState([]),[buckets,setBuckets]=useState([]),[allocations,setAllocations]=useState([]),[accounts,setAccounts]=useState([]);
 const [loading,setLoading]=useState(true),[modal,setModal]=useState(""),[edit,setEdit]=useState(null),[form,setForm]=useState({}),[search,setSearch]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false),[sidebar,setSidebar]=useState(false),[bucketEdits,setBucketEdits]=useState({}),[fileInput,setFileInput]=useState(null);
 const fileRef=useRef(null), refreshSeq=useRef(0);
 useEffect(()=>{if(!db){setChecking(false);return;}db.auth.getSession().then(({data})=>{setUser(data.session?.user||null);setChecking(false);});const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);});return()=>subscription.unsubscribe();},[]);
 const toast=(s)=>{setNotice(s);setTimeout(()=>setNotice(""),4200);};

 async function refresh(usr=user){
  if(!usr)return;
  const run=++refreshSeq.current;
  setLoading(true);
  const initialized=await db.rpc("finance_ensure_default_buckets");
  if(run!==refreshSeq.current)return;
  if(initialized.error){
   toast("Could not load allocation rules: "+initialized.error.message);
   setLoading(false);
   return;
  }
  const [t,b,a,acc]=await Promise.all([
   db.from("finance_transactions").select("*").order("date",{ascending:false}).limit(5000),
   db.from("finance_buckets").select("*").order("sort_order"),
   db.from("finance_allocations").select("*").limit(15000),
   db.from("finance_accounts").select("*").order("created_at")
  ]);
  if(run!==refreshSeq.current)return;
  const err=t.error||b.error||a.error||acc.error;
  if(err){toast("Data could not load: "+err.message);setLoading(false);return;}
  setTransactions(t.data||[]);
  setBuckets(b.data||[]);
  setAllocations(a.data||[]);
  setAccounts(acc.data||[]);
  setLoading(false);
 }
 useEffect(()=>{
  if(user){refresh(user);}
  else{
   refreshSeq.current++;
   setTransactions([]);setBuckets([]);setAllocations([]);setAccounts([]);
   setLoading(false);
  }
 },[user?.id]);
 const tx=useMemo(()=>transactions.filter(t=>t.scope===scope),[transactions,scope]);
 const scopedBuckets=useMemo(()=>buckets.filter(b=>b.scope===scope).sort((a,b)=>a.sort_order-b.sort_order),[buckets,scope]);
 const accountList=useMemo(()=>accounts.filter(a=>a.scope===scope),[accounts,scope]);
 const selectedTx=useMemo(()=>tx.filter(t=>period==="all"|| (period==="month"?t.date.slice(0,7)===dstr().slice(0,7):new Date(t.date+"T12:00:00")>=new Date(Date.now()-90*86400000))),[tx,period]);
 const income=selectedTx.filter(isRevenue).reduce((n,t)=>n+Number(t.amount),0),expenses=selectedTx.filter(isOperatingExpense).reduce((n,t)=>n+Number(t.amount),0);
 const profit=income-expenses;
 const payments=tx.filter(isRevenue);
 const bucketBalance=(b)=>allocations.filter(a=>a.bucket_id===b.id).reduce((s,a)=>s+Number(a.amount),0)-tx.filter(t=>t.type==="expense"&&t.category!=="Transfer"&&t.bucket_id===b.id).reduce((s,t)=>s+Number(t.amount),0);
 const totalAllocated=scopedBuckets.reduce((s,b)=>s+allocations.filter(a=>a.bucket_id===b.id).reduce((n,a)=>n+Number(a.amount),0),0);
 const totalUnspent=scopedBuckets.reduce((s,b)=>s+bucketBalance(b),0);
 const trend=useMemo(()=>Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+i);const m=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");const row=tx.filter(t=>t.date.startsWith(m));return {label:d.toLocaleDateString("en-US",{month:"short"}),month:m,income:row.filter(isRevenue).reduce((s,t)=>s+Number(t.amount),0),expense:row.filter(isOperatingExpense).reduce((s,t)=>s+Number(t.amount),0)};}),[tx]);
 const maxTrend=Math.max(1,...trend.map(t=>Math.max(t.income,t.expense)));
 const currentTotal=scopedBuckets.reduce((s,b)=>s+Number(bucketEdits[b.id]??b.percentage),0);
 const openTxn=(type="expense",t=null)=>{setEdit(t);setForm(t?{...t}:{type,scope,date:dstr(),description:"",amount:"",category:type==="income"?"Client payment":"Other",payer:"",project:"",notes:"",account_id:"",bucket_id:""});setModal("transaction");};
 async function saveTxn(e){e.preventDefault();setSaving(true);
  const value={user_id:user.id,scope:form.scope||scope,type:form.type,date:form.date,description:(form.description||"").trim(),amount:Number(form.amount),category:form.category||"Other",payer:form.type==="income"?(form.payer||"").trim()||null:null,project:form.type==="income"?(form.project||"").trim()||null:null,notes:form.notes||null,account_id:form.account_id||null,bucket_id:form.type==="expense"?(form.bucket_id||null):null,source:edit?.source||"manual"};
  if(!value.description||!(value.amount>0)){toast("Enter a description and positive amount.");setSaving(false);return;}
  let q=edit?db.from("finance_transactions").update(value).eq("id",edit.id):db.from("finance_transactions").insert(value);
  const {error}=await q;setSaving(false);if(error){toast(error.message);return;}setModal("");toast(edit?"Transaction updated.":value.type==="income"&&value.category!=="Transfer"?"Payment recorded and allocated.":"Transaction recorded.");await refresh();
 }
 async function deleteTxn(t){if(!confirm("Delete this transaction? This also deletes its virtual allocation records."))return;const {error}=await db.from("finance_transactions").delete().eq("id",t.id);if(error)toast(error.message);else {toast("Transaction deleted");refresh();}}
 async function saveAccount(e){e.preventDefault();setSaving(true);const {error}=await db.from("finance_accounts").insert({user_id:user.id,scope,name:form.name.trim(),opening_balance:Number(form.opening_balance||0)});setSaving(false);if(error)toast(error.message);else {setModal("");refresh();toast("Account added");}}

 async function saveBuckets(){
  if(saving)return;
  const rules=scopedBuckets.map(b=>({id:b.id,percentage:Number(bucketEdits[b.id]??b.percentage)}));
  const sum=rules.reduce((n,r)=>n+r.percentage,0);
  if(rules.some(r=>!Number.isFinite(r.percentage)||r.percentage<0||r.percentage>100)||Math.abs(sum-100)>0.001){
   toast("Percentages must be valid and total exactly 100%.");return;
  }
  setSaving(true);
  try {
   const {error}=await db.rpc("finance_save_bucket_rules",{p_scope:scope,p_rules:rules});
   if(error)throw error;
   await refresh();
   setBucketEdits({});
   toast("Allocation rules saved. Existing allocations are unchanged.");
  }catch(error){toast("Could not save: "+error.message);}
  finally{setSaving(false);}
 }
 async function importCSV(e){const f=e.target.files?.[0];if(!f)return;setSaving(true);
   try{const content=await f.text();const rows=parseCSV(content),list=[];
    let unknownDirection=0;
    for(const r of rows){
      const rawDate=r.date||r.posteddate||r.transactiondate||r.postingdate||"";
      const date=fromCSVDate(rawDate),description=r.description||r.name||r.merchant||r.details||r.payee||"";
      const parseAmount=(v)=>{const a=String(v||"").trim().replace(/[$,\s]/g,"").replace(/^\((.*)\)$/,"-$1");return Number(a||0);};
      let val=0;
      const rawDirection=(r.transactiontype||r.type||r.direction||"").trim().toLowerCase();
      if(r.amount!==undefined){
        val=parseAmount(r.amount);
        if(/debit|withdrawal|expense|purchase|charge/.test(rawDirection))val=-Math.abs(val);
        else if(/credit|deposit|income/.test(rawDirection))val=Math.abs(val);
        else if(val>0)unknownDirection++;
      }
      else val=parseAmount(r.credit)-parseAmount(r.debit);
      if(!date||!description||!Number.isFinite(val)||val===0)continue;
      const type=val>0?"income":"expense",amount=Math.abs(val);
      list.push({user_id:user.id,scope,date,description,amount,type,category:/internal transfer|transfer between|transfer to savings|transfer from savings/i.test(description)?"Transfer":type==="income"?"Other income":suggestedCategory(description,type),source:"csv",fingerprint:scope+"|"+date+"|"+description.toLowerCase()+"|"+amount.toFixed(2)+"|"+type});
    }
    if(list.length>0 && unknownDirection>=list.length && list.length>=2){
      if(!confirm("All import amounts are positive and there is no debit/credit direction. These will be recorded as income. Continue?"))return;
    }
    if(!list.length){toast("No valid rows. Include Date, Description, Amount.");setSaving(false);e.target.value="";return;}
    const {error}=await db.from("finance_transactions").upsert(list,{onConflict:"user_id,fingerprint",ignoreDuplicates:true});
    if(error)throw error;toast("CSV processed: "+list.length+" rows. Duplicates skipped.");setModal("");await refresh();
   }catch(err){toast("Import failed: "+err.message);}finally{setSaving(false);e.target.value="";}
 }
 function exportCSV(){const columns=["date","scope","type","description","amount","category","payer","project","notes"];const lines=[columns.join(","),...tx.map(t=>columns.map(k=>'"'+String(t[k]??"").replaceAll('"','""')+'"').join(","))];const blob=new Blob([lines.join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ignite-financials-"+scope+"-"+dstr()+".csv";a.click();URL.revokeObjectURL(url);}
 if(!ready)return <div className="config-screen"><div className="login-mark">I<span>.</span></div><h1>Connect Ignite Financials</h1><p>Vercel needs the Supabase environment variables to activate secure sign-in.</p><div className="config-keys"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div><small>Set these in Vercel → Project → Settings → Environment Variables, then redeploy. Never add a service-role key.</small></div>;
 if(checking)return <div className="loading-screen">IGNITE <span>FINANCIALS</span></div>;
 if(!user)return <Login onError={toast}/>;
 const pageTitle=tabs.find(t=>t.id===view)?.name;
 const categoryTotals=Object.entries(tx.filter(t=>isOperatingExpense(t)&&(period==="all"||selectedTx.includes(t))).reduce((o,t)=>{o[t.category]=(o[t.category]||0)+Number(t.amount);return o;},{})).sort((a,b)=>b[1]-a[1]);
 return <div className="shell">
   <aside className={"sidebar "+(sidebar?"open":"")}>
     <div className="sidebar-top"><div className="logo"><span className="brand-icon">I<span>.</span></span><div>IGNITE <small>FINANCIALS</small></div></div><button className="mobile-close icon-btn" onClick={()=>setSidebar(false)}><X size={19}/></button></div>
     <div className="nav-caption">WORKSPACE</div><div className="scope-picker"><div className="scope-avatar">{scope==="business"?"IC":"P"}</div><div><strong>{scope==="business"?"Ignite Company":"Personal finances"}</strong><small>{scope==="business"?"Business workspace":"Personal workspace"}</small></div><ChevronDown size={15}/><select aria-label="Workspace" value={scope} onChange={e=>{setScope(e.target.value);setView("overview");setBucketEdits({});}}><option value="business">Ignite Company</option><option value="personal">Personal finances</option></select></div>
     <div className="nav-caption navigation-title">MAIN MENU</div><nav>{tabs.map(t=><button key={t.id} onClick={()=>{setView(t.id);setSidebar(false);}} className={"nav-link "+(view===t.id?"active":"")}><t.icon size={19}/>{t.name}{view===t.id&&<span className="nav-point"/>}</button>)}</nav>
     <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={19}/><div><strong>Private & protected</strong><small>No bank transfers enabled.</small></div></div><div className="profile"><div className="profile-icon">{(user.email||"U")[0].toUpperCase()}</div><div className="profile-label"><strong>{user.email?.split("@")[0]}</strong><small>Workspace owner</small></div><button title="Sign out" className="icon-btn" onClick={()=>db.auth.signOut()}><LogOut size={18}/></button></div></div>
   </aside>
   {sidebar&&<div className="mobile-mask" onClick={()=>setSidebar(false)}/>}
   <main className="main"><header className="topbar"><div className="top-left"><button className="icon-btn mobile-menu" onClick={()=>setSidebar(true)}><Menu size={21}/></button><span className="breadcrumb">Financials</span><span className="slash">/</span><b>{pageTitle}</b></div><div className="top-actions"><div className="today-pill"><CalendarDays size={15}/>{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div><div className="small-avatar">{(user.email||"U")[0].toUpperCase()}</div></div></header>
   <div className="page"><div className="page-heading"><div><div className="eyebrow">FINANCIAL COMMAND CENTER</div><h1>{view==="overview"?"Good to see you.":pageTitle}<span className="red-dot">.</span></h1><p>{view==="overview"?"Stay on top of every dollar that comes in and goes out.":view==="income"?"Every payment you receive, organized by client and project.":view==="allocations"?"Give every dollar a job without moving it.":view==="transactions"?"Your complete income and expense ledger.":view==="reports"?"Know exactly where your money is going.":"Configure the foundation of your money system."}</p></div><div className="header-buttons">{view!=="settings"&&<button className="button" onClick={()=>setModal("import")}><Upload size={16}/>Import CSV</button>}<button className="primary" onClick={()=>openTxn(view==="income"?"income":"expense")}><Plus size={18}/>{view==="income"?"Record payment":"New transaction"}</button></div></div>
     {loading?<div className="content-loading">Loading your financial records...</div>:<>
     {(view==="overview"||view==="reports")&&<div className="filterbar"><div className="segmented">{[["month","This month"],["90","Last 90 days"],["all","All time"]].map(([id,l])=><button key={id} className={period===id?"selected":""} onClick={()=>setPeriod(id)}>{l}</button>)}</div><span className="data-hint"><span className="red-online"/> Manual + CSV records</span></div>}
     {view==="overview"&&<>
      <div className="stats-grid"><Stat label="Revenue received" value={money(income)} sub={selectedTx.filter(isRevenue).length+" recorded payments"} icon={ArrowDownRight} positive/><Stat label="Operating expenses" value={money(expenses)} sub={selectedTx.filter(isOperatingExpense).length+" operating expenses"} icon={ArrowUpRight}/><Stat label="Net profit" value={money(profit)} sub={income?((profit/income)*100).toFixed(1)+"% profit margin":"Revenue minus recorded expenses"} icon={TrendingUp} positive={profit>0} negative={profit<0}/><Stat label="Virtual available" value={money(totalUnspent)} sub="All-time allocations less assigned expenses" icon={Wallet}/></div>
      <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-head"><div><h2>Cash flow</h2><p>Last 6 months</p></div><div className="chart-legend"><i className="legend-red"/>Revenue <i className="legend-dark"/>Expenses</div></div><div className="chart"><div className="chart-lines"><span>{shortMoney(maxTrend)}</span><span>{shortMoney(maxTrend/2)}</span><span>$0</span></div><div className="bars">{trend.map(t=><div className="bar-group" key={t.month}><div className="bar-pair"><div title={"Revenue "+money(t.income)} className="bar revenue-bar" style={{height:Math.max(t.income?3:0,t.income/maxTrend*100)+"%"}}/><div title={"Expenses "+money(t.expense)} className="bar expenses-bar" style={{height:Math.max(t.expense?3:0,t.expense/maxTrend*100)+"%"}}/></div><span>{t.label}</span></div>)}</div></div><div className="chart-summary"><div><span>Revenue, last 6 months</span><strong>{money(trend.reduce((s,t)=>s+t.income,0))}</strong></div><div><span>Expenses, last 6 months</span><strong>{money(trend.reduce((s,t)=>s+t.expense,0))}</strong></div></div></section>
       <section className="panel allocation-panel"><div className="panel-head"><div><h2>Money allocation</h2><p>Live virtual balances</p></div><button className="text-action" onClick={()=>setView("allocations")}>Manage <ArrowUpRight size={15}/></button></div><div className="allocated-total"><span>Assigned from payments</span><strong>{money(totalAllocated)}</strong></div><div className="allocation-strip">{scopedBuckets.map(b=><div key={b.id} style={{background:b.color,width:b.percentage+"%"}} title={b.name+" "+b.percentage+"%"}/>)}</div><div className="bucket-mini-list">{scopedBuckets.map(b=><div className="bucket-mini" key={b.id}><span className="swatch" style={{background:b.color}}/><div><b>{b.name}</b><small>{Number(b.percentage)}% of incoming payments</small></div><strong>{money(bucketBalance(b))}</strong></div>)}</div><div className="virtual-note"><CircleHelp size={16}/>These are tracking balances, not separate bank accounts.</div></section></div>
      <section className="panel recent"><div className="panel-head"><div><h2>Recent activity</h2><p>Your latest money movements</p></div><button className="text-action" onClick={()=>setView("transactions")}>View all <ArrowUpRight size={15}/></button></div>{tx.length?<TransactionTable rows={tx.slice(0,6)} onEdit={t=>openTxn(t.type,t)} onDelete={deleteTxn}/>:<Empty icon={ReceiptText} title="No transactions yet" body="Record your first payment or expense to see your finances come to life." action="Record a payment" onAction={()=>openTxn("income")}/>}</section>
     </>}
     {view==="transactions"&&<section className="panel table-panel"><div className="panel-head with-search"><div><h2>All transactions</h2><p>{tx.length} entries in this workspace</p></div><div className="table-tools"><div className="searchbox"><Search size={16}/><input placeholder="Search transactions..." value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="button compact" onClick={exportCSV}><Download size={16}/> Export</button></div></div>{tx.length?<TransactionTable rows={tx.filter(t=>[t.description,t.category,t.payer,t.project].some(s=>(s||"").toLowerCase().includes(search.toLowerCase())))} onEdit={t=>openTxn(t.type,t)} onDelete={deleteTxn}/>:<Empty icon={ArrowLeftRight} title="Nothing recorded yet" body="Your transactions will appear here after you add one or import a CSV." action="Add transaction" onAction={()=>openTxn("expense")}/>}</section>}
     {view==="income"&&<><div className="stats-grid income-stats"><Stat label="Total payments received" value={money(payments.reduce((s,t)=>s+Number(t.amount),0))} sub="All-time recorded revenue" icon={Wallet} positive/><Stat label="Payments this month" value={money(payments.filter(t=>t.date.startsWith(dstr().slice(0,7))).reduce((s,t)=>s+Number(t.amount),0))} sub="Current calendar month" icon={ArrowDownRight} positive/><Stat label="Number of payments" value={String(payments.length)} sub="Recorded deposits" icon={ReceiptText}/><Stat label="Average payment" value={money(payments.length?payments.reduce((s,t)=>s+Number(t.amount),0)/payments.length:0)} sub="Per received payment" icon={TrendingUp}/></div><section className="panel table-panel"><div className="panel-head"><div><h2>Payment history</h2><p>Revenue by client, service and project</p></div><button className="text-action" onClick={()=>openTxn("income")}><Plus size={16}/> Record payment</button></div>{payments.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Client / Source</th><th>Project</th><th>Type</th><th className="right">Received</th><th/></tr></thead><tbody>{payments.map(t=><tr key={t.id}><td>{toDate(t.date)}</td><td><div className="merchant"><div className="merchant-icon incoming"><ArrowDownRight size={17}/></div><div><strong>{t.payer||t.description}</strong><small>{t.payer?t.description:"Payment received"}</small></div></div></td><td>{t.project||<span className="muted">Not specified</span>}</td><td><span className="tag">{t.category}</span></td><td className="right amount-green">{money(t.amount)}</td><td className="row-actions"><button onClick={()=>openTxn("income",t)} title="Edit"><Pencil size={15}/></button></td></tr>)}</tbody></table></div>:<Empty icon={Wallet} title="Your first payment starts here" body="Record the client, amount, and project. It will automatically count toward revenue and get allocated into your virtual buckets." action="Record a payment" onAction={()=>openTxn("income")}/>}</section></>}
     {view==="allocations"&&<><div className="allocation-hero"><div><div className="eyebrow">VIRTUAL ENVELOPES</div><h2>Every dollar has a purpose.</h2><p>Money stays in your bank. We simply track what you've reserved and what you've spent.</p></div><div className="allocation-hero-number"><span>Unspent virtual allocations</span><strong>{money(totalUnspent)}</strong></div></div><div className="bucket-cards">{scopedBuckets.map(b=><div className="bucket-card" key={b.id}><div className="bucket-card-top"><div className="bucket-symbol" style={{background:b.color}}/><span>{Number(b.percentage)}% allocation</span></div><h3>{b.name}</h3><strong>{money(bucketBalance(b))}</strong><div className="bucket-progress"><div style={{background:b.color,width:Math.min(100,Math.max(0,bucketBalance(b)/Math.max(1,allocations.filter(a=>a.bucket_id===b.id).reduce((s,a)=>s+Number(a.amount),0))*100))+"%"}}/></div><div className="bucket-card-footer"><span>Assigned {money(allocations.filter(a=>a.bucket_id===b.id).reduce((s,a)=>s+Number(a.amount),0))}</span><span>Spent {money(tx.filter(t=>t.type==="expense"&&t.category!=="Transfer"&&t.bucket_id===b.id).reduce((s,t)=>s+Number(t.amount),0))}</span></div></div>)}</div>
      <section className="panel edit-buckets"><div className="panel-head"><div><h2>Allocation rules</h2><p>Adjust the split applied to your next payment. Old allocations stay unchanged.</p></div><span className={"total-pill "+(Math.abs(currentTotal-100)<.001?"balanced":"unbalanced")}>{currentTotal.toFixed(0)}% / 100%</span></div><div className="bucket-editor">{scopedBuckets.map(b=><div className="bucket-edit-row" key={b.id}><span className="swatch" style={{background:b.color}}/><strong>{b.name}</strong><input aria-label={b.name+" allocation percentage"} type="number" min="0" max="100" step=".5" value={bucketEdits[b.id]??b.percentage} onChange={e=>setBucketEdits(v=>({...v,[b.id]:e.target.value}))}/><span>%</span></div>)}</div><button className="primary" onClick={saveBuckets} disabled={saving||Math.abs(currentTotal-100)>.001}><Check size={17}/>Save allocation rules</button><p className="helper">Expenses assigned to a bucket reduce its virtual balance. This does not represent actual bank cash or tax advice.</p></section></>}
     {view==="reports"&&<><div className="stats-grid"><Stat label="Revenue" value={money(income)} sub="Excludes internal transfers" icon={ArrowDownRight} positive/><Stat label="Operating costs" value={money(expenses)} sub="Excludes draws and transfers" icon={ArrowUpRight}/><Stat label="Profit" value={money(profit)} sub="Before tax adjustments" icon={TrendingUp} positive={profit>0} negative={profit<0}/><Stat label="Profit margin" value={income?(profit/income*100).toFixed(1)+"%":"0.0%"} sub="Profit divided by revenue" icon={ChartNoAxesCombined}/></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Expense breakdown</h2><p>Where the money went</p></div></div>{categoryTotals.length?<div className="expense-list">{categoryTotals.map(([name,v],i)=><div className="expense-row" key={name}><div className="expense-row-top"><strong>{name}</strong><span>{money(v)}</span></div><div className="expense-track"><div style={{width:(v/Math.max(1,expenses)*100)+"%",background:i===0?"#e53935":"#1e2635"}}/></div></div>)}</div>:<Empty icon={ChartNoAxesCombined} title="No expense data" body="Track or import expenses to see your category breakdown."/ >}</section><section className="panel"><div className="panel-head"><div><h2>Monthly performance</h2><p>6-month financial summary</p></div></div><div className="monthly-list"><div className="monthly-row heading"><span>Month</span><span>Revenue</span><span>Expenses</span><span>Profit</span></div>{trend.slice().reverse().map(t=><div className="monthly-row" key={t.month}><strong>{t.label}</strong><span>{money(t.income)}</span><span>{money(t.expense)}</span><strong className={t.income-t.expense>=0?"amount-green":"amount-red"}>{money(t.income-t.expense)}</strong></div>)}</div></section></div><div className="report-disclaimer"><CircleHelp size={17}/>Profit is received revenue minus operating expenses. Owner draws and internal transfers are excluded. It is not tax accounting and does not include unrecorded obligations.</div></>}
     {view==="settings"&&<><div className="dashboard-grid settings-grid"><section className="panel"><div className="panel-head"><div><h2>Account labels</h2><p>Group transactions by bank or cash account</p></div><button className="text-action" onClick={()=>{setForm({name:"",opening_balance:"0"});setModal("account");}}><Plus size={16}/> Add account</button></div>{accountList.length?<div className="account-list">{accountList.map(a=><div className="account" key={a.id}><div className="merchant-icon"><CreditCard size={18}/></div><div><strong>{a.name}</strong><small>Opening balance: {money(a.opening_balance)}</small></div></div>)}</div>:<Empty icon={CreditCard} title="No labeled accounts" body="Add an account label to organize transactions. This does not connect to your bank." action="Add account" onAction={()=>{setForm({name:"",opening_balance:"0"});setModal("account");}}/>}</section><section className="panel"><div className="panel-head"><div><h2>Connections & security</h2><p>Your financial data stays private</p></div></div><div className="setting-line"><div className="setting-icon"><ShieldCheck size={18}/></div><div><strong>Secure account access</strong><small>Supabase email-link authentication and database row protection</small></div><span className="connected">Active</span></div><div className="setting-line"><div className="setting-icon"><Landmark size={18}/></div><div><strong>Read-only banking connection</strong><small>Not configured. Import CSVs or record transactions for now.</small></div><span className="unconnected">Not connected</span></div><div className="setting-line"><div className="setting-icon"><ArrowLeftRight size={18}/></div><div><strong>Automatic bank transfers</strong><small>Disabled. All allocations are virtual.</small></div><span className="unconnected">Off</span></div></section></div><section className="panel"><div className="panel-head"><div><h2>Export your records</h2><p>Download your current workspace ledger to a CSV file.</p></div><button className="button" onClick={exportCSV}><Download size={16}/> Export transactions</button></div></section></>}
     </>}
     <div className="footer"><span>© {new Date().getFullYear()} Ignite Financials</span><span><ShieldCheck size={14}/> Private records • Virtual allocations only</span></div>
   </div></main>
   {notice&&<div className="toast"><CircleHelp size={16}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
   {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal("");}}><div className="modal-card"><div className="modal-heading"><div><div className="eyebrow">IGNITE FINANCIALS</div><h2>{modal==="transaction"?(edit?"Edit transaction":form.type==="income"?"Record a payment":"New expense"):modal==="account"?"Add an account label":"Import transactions"}</h2></div><button className="icon-btn" onClick={()=>setModal("")}><X size={21}/></button></div>
    {modal==="transaction"&&<form className="modal-form" onSubmit={saveTxn}><div className="type-tabs">{[["income","Money in",ArrowDownRight],["expense","Money out",ArrowUpRight]].map(([id,label,Icon])=><button key={id} type="button" className={form.type===id?"active":""} onClick={()=>setForm(v=>({...v,type:id,category:id==="income"?"Client payment":"Other"}))}><Icon size={17}/>{label}</button>)}</div><div className="field"><label>Amount received / spent</label><div className="amount-input"><span>$</span><input type="number" min=".01" step=".01" placeholder="0.00" autoFocus value={form.amount??""} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} required/></div></div><div className="field"><label>Description</label><input placeholder={form.type==="income"?"e.g. Website development deposit":"e.g. Meta Ads"} required value={form.description||""} onChange={e=>setForm(v=>({...v,description:e.target.value,category:v.type==="expense"&&(v.category==="Other"||v.category===suggestedCategory(v.description,"expense"))?suggestedCategory(e.target.value,"expense"):v.category}))}/></div><div className="form-row"><div className="field"><label>Date</label><input type="date" value={form.date||dstr()} onChange={e=>setForm(v=>({...v,date:e.target.value}))} required/></div><div className="field"><label>Category</label><select value={form.category||"Other"} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{[...new Set([...(cats[form.type]||[]),form.category||"Other"])].map(c=><option key={c}>{c}</option>)}</select></div></div>
    {form.type==="income"&&<div className="form-row"><div className="field"><label>Client / payer</label><input placeholder="Client or company" value={form.payer||""} onChange={e=>setForm(v=>({...v,payer:e.target.value}))}/></div><div className="field"><label>Project / service</label><input placeholder="Project name" value={form.project||""} onChange={e=>setForm(v=>({...v,project:e.target.value}))}/></div></div>}
    <div className="form-row"><div className="field"><label>Account label (optional)</label><select value={form.account_id||""} onChange={e=>setForm(v=>({...v,account_id:e.target.value}))}><option value="">Not assigned</option>{accounts.filter(a=>a.scope===(form.scope||scope)).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></div>{form.type==="expense"&&<div className="field"><label>Spend from bucket</label><select value={form.bucket_id||""} onChange={e=>setForm(v=>({...v,bucket_id:e.target.value}))}><option value="">Unallocated expense</option>{buckets.filter(b=>b.scope===(form.scope||scope)).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}</div><div className="field"><label>Notes (optional)</label><textarea rows="2" placeholder="Additional details..." value={form.notes||""} onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></div><div className="modal-footer"><button className="button" type="button" onClick={()=>setModal("")}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving?"Saving...":edit?"Save changes":form.type==="income"?"Save payment":"Save expense"}<Check size={16}/></button></div></form>}
    {modal==="account"&&<form className="modal-form" onSubmit={saveAccount}><div className="field"><label>Account name</label><input placeholder="e.g. Business checking" required value={form.name||""} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></div><div className="field"><label>Opening balance (optional)</label><input type="number" step=".01" value={form.opening_balance||""} onChange={e=>setForm(v=>({...v,opening_balance:e.target.value}))}/></div><div className="modal-footer"><button className="button" type="button" onClick={()=>setModal("")}>Cancel</button><button className="primary" type="submit" disabled={saving}>Add account</button></div></form>}
    {modal==="import"&&<div className="import-body"><div className="upload-zone" onClick={()=>fileRef.current?.click()}><Upload size={25}/><strong>{saving?"Importing your transactions...":"Choose a bank statement CSV"}</strong><p>CSV with Date, Description, Amount. Positive amounts are treated as income and negative amounts as expenses.</p><span>Browse files</span></div><input ref={fileRef} type="file" accept=".csv,text/csv" hidden disabled={saving} onChange={importCSV}/><div className="import-info"><CircleHelp size={17}/><p>Imports do not move money. Duplicate matching uses date, description, type, and amount. If your bank exports positive expenses, adjust the signs first. Uploaded rows remain private to your account.</p></div></div>}
   </div></div>}
 </div>;
}
function TransactionTable({rows,onEdit,onDelete}){return <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Category</th><th>Source</th><th className="right">Amount</th><th/></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><div className="merchant"><div className={"merchant-icon "+(t.type==="income"?"incoming":"")}>{t.type==="income"?<ArrowDownRight size={17}/>:<ArrowUpRight size={17}/>}</div><div><strong>{t.description}</strong><small>{t.payer||t.project|| (t.type==="income"?"Payment received":"Expense")}</small></div></div></td><td>{toDate(t.date)}</td><td><span className="tag">{t.category}</span></td><td><span className="source">{t.source==="csv"?"CSV import":"Manual"}</span></td><td className={"right "+(t.type==="income"?"amount-green":"amount-dark")}>{t.type==="income"?"+":"−"}{money(t.amount)}</td><td className="row-actions"><button title="Edit" onClick={()=>onEdit(t)}><Pencil size={15}/></button><button title="Delete" onClick={()=>onDelete(t)}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-tiny">No matching transactions</div>}</div>}
