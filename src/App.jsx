import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Download, Home, Plus, Settings2, Trash2, Upload, WalletCards, X, List, Search, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const STORAGE_KEY = "short_term_trading_journal_v1";
const SETTINGS_KEY = "short_term_trading_settings_v1";
const defaultSettings = { initialCapital: 1000000, targetProfitPct: 3, stopLossPct: -1.5, targetWinRate: 60, maxHoldings: 5 };
const blankTrade = { date: new Date().toISOString().slice(0, 10), ticker: "", name: "", category: "フィジカルAI", entryPrice: "", exitPrice: "", shares: "", fee: "0", note: "" };

function loadJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function yen(v) { return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v || 0); }
function pct(v) { return `${(v || 0).toFixed(2)}%`; }
function signedYen(v) { return `${v >= 0 ? "+" : "−"}${yen(Math.abs(v))}`; }
function calcTrade(t) { const entry = Number(t.entryPrice)||0, exit=Number(t.exitPrice)||0, shares=Number(t.shares)||0, fee=Number(t.fee)||0; const gross=(exit-entry)*shares, net=gross-fee, invested=entry*shares; return { gross, net, invested, returnPct: invested ? net/invested*100 : 0 }; }

export default function TradingJournalApp() {
  const [trades,setTrades]=useState(()=>loadJSON(STORAGE_KEY,[]));
  const [settings,setSettings]=useState(()=>({...defaultSettings,...loadJSON(SETTINGS_KEY,{})}));
  const [form,setForm]=useState(blankTrade);
  const [screen,setScreen]=useState("home");
  const [filter,setFilter]=useState("すべて");
  const [keyword,setKeyword]=useState("");
  const [showSettings,setShowSettings]=useState(false);

  useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(trades)),[trades]);
  useEffect(()=>localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)),[settings]);

  const categories=["フィジカルAI","AI・半導体以外","その他"];
  const enriched=useMemo(()=>trades.map(t=>({...t,...calcTrade(t)})).sort((a,b)=>b.date.localeCompare(a.date)),[trades]);
  const filtered=useMemo(()=>enriched.filter(t=>(filter==="すべて"||t.category===filter)&&(!keyword||`${t.ticker} ${t.name} ${t.note}`.toLowerCase().includes(keyword.toLowerCase()))),[enriched,filter,keyword]);
  const stats=useMemo(()=>{const wins=enriched.filter(t=>t.net>0), losses=enriched.filter(t=>t.net<0), total=enriched.reduce((s,t)=>s+t.net,0); return { wins:wins.length, losses:losses.length, total, winRate:enriched.length?wins.length/enriched.length*100:0, avgWin:wins.length?wins.reduce((s,t)=>s+t.net,0)/wins.length:0, avgLoss:losses.length?losses.reduce((s,t)=>s+t.net,0)/losses.length:0, pf:losses.length?wins.reduce((s,t)=>s+t.net,0)/Math.abs(losses.reduce((s,t)=>s+t.net,0)):0 };},[enriched]);
  const currentCapital=(Number(settings.initialCapital)||0)+stats.total;
  const targetCapital=(Number(settings.initialCapital)||0)*2;
  const progress=Math.max(0,Math.min(100,(currentCapital-Number(settings.initialCapital))/(targetCapital-Number(settings.initialCapital))*100));
  const equity=useMemo(()=>{let capital=Number(settings.initialCapital)||0; const daily={}; [...enriched].sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>daily[t.date]=(daily[t.date]||0)+t.net); return Object.entries(daily).sort(([a],[b])=>a.localeCompare(b)).map(([date,pnl])=>{capital+=pnl;return {date:date.slice(5),資産:Math.round(capital)};});},[enriched,settings.initialCapital]);
  const monthly=useMemo(()=>{const m={}; enriched.forEach(t=>{const k=t.date.slice(0,7); if(!m[k])m[k]={month:k,損益:0}; m[k].損益+=t.net;}); return Object.values(m).sort((a,b)=>a.month.localeCompare(b.month));},[enriched]);
  const categoryStats=categories.map(category=>{const rows=enriched.filter(t=>t.category===category), pnl=rows.reduce((s,t)=>s+t.net,0), wins=rows.filter(t=>t.net>0).length; return {category,pnl,trades:rows.length,winRate:rows.length?wins/rows.length*100:0};});

  function addTrade(e){e.preventDefault(); if(!form.ticker||!form.entryPrice||!form.exitPrice||!form.shares)return; setTrades(prev=>[{...form,id:crypto.randomUUID(),entryPrice:Number(form.entryPrice),exitPrice:Number(form.exitPrice),shares:Number(form.shares),fee:Number(form.fee)||0},...prev]); setForm({...blankTrade,date:form.date,category:form.category}); setScreen("records");}
  function deleteTrade(id){setTrades(prev=>prev.filter(t=>t.id!==id));}
  function exportCSV(){const header=["日付","銘柄コード","銘柄名","分類","買値","売値","株数","手数料","損益","損益率","メモ"];const rows=enriched.map(t=>[t.date,t.ticker,t.name,t.category,t.entryPrice,t.exitPrice,t.shares,t.fee,t.net.toFixed(0),t.returnPct.toFixed(2),t.note]);const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`売買記録_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);}
  function importCSV(e){const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{const lines=String(reader.result).replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean); const parse=line=>line.match(/("(?:[^"]|"")*"|[^,]+)/g)?.map(v=>v.replace(/^"|"$/g,"").replaceAll('""','"'))||[]; const [, ...data]=lines; const imported=data.map(line=>{const r=parse(line);return{id:crypto.randomUUID(),date:r[0],ticker:r[1],name:r[2],category:r[3]||"その他",entryPrice:Number(r[4]),exitPrice:Number(r[5]),shares:Number(r[6]),fee:Number(r[7]||0),note:r[10]||""};}).filter(t=>t.ticker&&t.date); setTrades(prev=>[...imported,...prev]);e.target.value="";};reader.readAsText(file,"utf-8");}

  return <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-0">
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div><div className="text-[11px] text-slate-400 font-semibold tracking-wide">SHORT-TERM TRADING</div><h1 className="font-bold leading-none">売買記録</h1></div>
        <div className="flex items-center gap-1"><button onClick={()=>setShowSettings(true)} className="p-2.5 rounded-full hover:bg-slate-100" aria-label="設定"><Settings2 size={20}/></button></div>
      </div>
    </header>

    <main className="max-w-5xl mx-auto px-4 py-4 md:py-7">
      {screen==="home" && <>
        <section className="grid grid-cols-2 gap-3">
          <Card><div className="text-xs text-slate-500">現在資産</div><div className="text-2xl font-extrabold mt-1">{yen(currentCapital)}</div><div className="text-xs text-slate-400 mt-1">目標 {yen(targetCapital)}</div></Card>
          <Card><div className="text-xs text-slate-500">累計損益</div><div className={`text-2xl font-extrabold mt-1 ${stats.total>=0?'text-emerald-600':'text-rose-600'}`}>{signedYen(stats.total)}</div><div className="text-xs text-slate-400 mt-1">{enriched.length}取引</div></Card>
          <Card><div className="text-xs text-slate-500">勝率</div><div className={`text-2xl font-extrabold mt-1 ${stats.winRate>=settings.targetWinRate?'text-emerald-600':'text-slate-900'}`}>{pct(stats.winRate)}</div><div className="text-xs text-slate-400 mt-1">目標 {settings.targetWinRate}%</div></Card>
          <Card><div className="text-xs text-slate-500">Profit Factor</div><div className="text-2xl font-extrabold mt-1">{stats.pf?stats.pf.toFixed(2):"—"}</div><div className="text-xs text-slate-400 mt-1">1.0超を目標</div></Card>
        </section>

        <Card className="mt-3"><div className="flex items-end justify-between"><div><div className="font-bold">100万円 → 200万円</div><div className="text-xs text-slate-500 mt-1">現在 {yen(currentCapital)}</div></div><div className="font-extrabold">{progress.toFixed(1)}%</div></div><div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-3"><div className="h-full bg-slate-900 rounded-full" style={{width:`${progress}%`}}/></div></Card>

        <div className="grid lg:grid-cols-2 gap-3 mt-3">
          <Card><h2 className="font-bold mb-2">資産推移</h2><div className="h-56">{equity.length?<ResponsiveContainer width="100%" height="100%"><LineChart data={equity}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:11}}/><YAxis tickFormatter={v=>`${Math.round(v/10000)}万`} tick={{fontSize:11}}/><Tooltip formatter={v=>yen(v)}/><Line type="monotone" dataKey="資産" stroke="#0f172a" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer>:<Empty text="取引を入力すると表示されます"/>}</div></Card>
          <Card><h2 className="font-bold mb-2">月別損益</h2><div className="h-56">{monthly.length?<ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tickFormatter={v=>`${Math.round(v/10000)}万`} tick={{fontSize:11}}/><Tooltip formatter={v=>yen(v)}/><Bar dataKey="損益"/></BarChart></ResponsiveContainer>:<Empty text="取引を入力すると表示されます"/>}</div></Card>
        </div>

        <Card className="mt-3"><div className="flex items-center gap-2 mb-3"><BookOpen size={17}/><h2 className="font-bold">戦略別</h2></div>{categoryStats.map(s=><div key={s.category} className="flex items-center justify-between py-3 border-b last:border-0"><div><div className="font-semibold text-sm">{s.category}</div><div className="text-xs text-slate-400">{s.trades}取引・勝率 {pct(s.winRate)}</div></div><div className={`font-bold ${s.pnl>=0?'text-emerald-600':'text-rose-600'}`}>{signedYen(s.pnl)}</div></div>)}</Card>
      </>}

      {screen==="add" && <Card><div className="mb-4"><h2 className="text-xl font-bold">取引を記録</h2><p className="text-sm text-slate-500 mt-1">1回の売買を入力してください。</p></div><form onSubmit={addTrade} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="売却日"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="分類"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="銘柄コード"><input inputMode="numeric" placeholder="6506" value={form.ticker} onChange={e=>setForm({...form,ticker:e.target.value})}/></Field><Field label="銘柄名"><input placeholder="安川電機" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="買値"><input inputMode="decimal" type="number" value={form.entryPrice} onChange={e=>setForm({...form,entryPrice:e.target.value})}/></Field><Field label="売値"><input inputMode="decimal" type="number" value={form.exitPrice} onChange={e=>setForm({...form,exitPrice:e.target.value})}/></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="株数"><input inputMode="numeric" type="number" value={form.shares} onChange={e=>setForm({...form,shares:e.target.value})}/></Field><Field label="手数料等"><input inputMode="numeric" type="number" value={form.fee} onChange={e=>setForm({...form,fee:e.target.value})}/></Field></div>
        <Field label="メモ"><textarea rows="4" placeholder="買った理由・売った理由・材料・反省点" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></Field>
        {form.entryPrice&&form.exitPrice&&form.shares&&<div className={`rounded-2xl p-4 ${Number(form.exitPrice)>=Number(form.entryPrice)?'bg-emerald-50':'bg-rose-50'}`}><div className="text-xs text-slate-500">今回の概算損益</div><div className="text-2xl font-extrabold mt-1">{signedYen(calcTrade(form).net)}</div><div className="text-sm mt-1">{pct(calcTrade(form).returnPct)}</div></div>}
        <button className="w-full min-h-14 rounded-2xl bg-slate-900 text-white font-bold text-base active:scale-[0.99]">記録する</button>
      </form></Card>}

      {screen==="records" && <>
        <div className="flex gap-2 mb-3"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm" placeholder="銘柄・メモを検索" value={keyword} onChange={e=>setKeyword(e.target.value)}/></div><select className="rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={filter} onChange={e=>setFilter(e.target.value)}><option>すべて</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
        {filtered.length?filtered.map(t=><div key={t.id} className="bg-white rounded-3xl p-4 mb-3 shadow-sm ring-1 ring-slate-100"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-slate-400">{t.date} · {t.category}</div><div className="font-bold mt-1">{t.ticker} {t.name}</div></div><button onClick={()=>deleteTrade(t.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={18}/></button></div><div className="grid grid-cols-3 gap-3 mt-4 text-sm"><div><div className="text-xs text-slate-400">買値</div><div className="font-semibold">{yen(t.entryPrice)}</div></div><div><div className="text-xs text-slate-400">売値</div><div className="font-semibold">{yen(t.exitPrice)}</div></div><div><div className="text-xs text-slate-400">株数</div><div className="font-semibold">{t.shares.toLocaleString()}</div></div></div><div className="flex items-end justify-between mt-4 pt-3 border-t"><div><div className="text-xs text-slate-400">損益率</div><div className={`font-bold ${t.returnPct>=0?'text-emerald-600':'text-rose-600'}`}>{pct(t.returnPct)}</div></div><div className={`text-xl font-extrabold ${t.net>=0?'text-emerald-600':'text-rose-600'}`}>{signedYen(t.net)}</div></div>{t.note&&<div className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{t.note}</div>}</div>):<Card><Empty text="まだ売買記録がありません"/></Card>}
      </>}

      {showSettings && <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-end md:items-center justify-center"><div className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-5 max-h-[90vh] overflow-auto"><div className="flex items-center justify-between"><div><h2 className="font-bold text-lg">設定</h2><p className="text-xs text-slate-500 mt-1">投機ルールとバックアップ</p></div><button onClick={()=>setShowSettings(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button></div><div className="grid grid-cols-2 gap-3 mt-5"><Field label="初期資金"><input type="number" value={settings.initialCapital} onChange={e=>setSettings({...settings,initialCapital:Number(e.target.value)})}/></Field><Field label="利確目標 %"><input type="number" step="0.1" value={settings.targetProfitPct} onChange={e=>setSettings({...settings,targetProfitPct:Number(e.target.value)})}/></Field><Field label="損切り基準 %"><input type="number" step="0.1" value={settings.stopLossPct} onChange={e=>setSettings({...settings,stopLossPct:Number(e.target.value)})}/></Field><Field label="目標勝率 %"><input type="number" value={settings.targetWinRate} onChange={e=>setSettings({...settings,targetWinRate:Number(e.target.value)})}/></Field><Field label="最大保有銘柄数"><input type="number" min="1" value={settings.maxHoldings} onChange={e=>setSettings({...settings,maxHoldings:Number(e.target.value)})}/></Field></div><div className="rounded-2xl bg-slate-50 p-4 mt-4 text-sm"><b>現在のルール</b><div className="mt-2 text-slate-600">＋{settings.targetProfitPct}%利確 / {settings.stopLossPct}%損切り / 勝率{settings.targetWinRate}% / 最大{settings.maxHoldings}銘柄</div></div><div className="grid grid-cols-2 gap-3 mt-4"><button onClick={exportCSV} className="min-h-12 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2"><Download size={17}/> CSV保存</button><label className="min-h-12 rounded-2xl bg-slate-100 font-semibold flex items-center justify-center gap-2 cursor-pointer"><Upload size={17}/> CSV復元<input className="hidden" type="file" accept=".csv" onChange={importCSV}/></label></div></div></div>}
    </main>

    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-100 md:hidden"><div className="max-w-lg mx-auto grid grid-cols-3 h-16"><BottomTab active={screen==="home"} onClick={()=>setScreen("home")} icon={<Home size={21}/>} label="ホーム"/><BottomTab active={screen==="add"} onClick={()=>setScreen("add")} icon={<Plus size={25}/>} label="記録" primary/><BottomTab active={screen==="records"} onClick={()=>setScreen("records")} icon={<List size={21}/>} label="履歴"/></div></nav>

    <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 p-1 gap-1"><BottomTab active={screen==="home"} onClick={()=>setScreen("home")} icon={<Home size={18}/>} label="ホーム"/><BottomTab active={screen==="add"} onClick={()=>setScreen("add")} icon={<Plus size={18}/>} label="記録" primary/><BottomTab active={screen==="records"} onClick={()=>setScreen("records")} icon={<List size={18}/>} label="履歴"/></div>
  </div>;
}

function Card({children,className=""}){return <section className={`bg-white rounded-3xl p-4 md:p-5 shadow-sm ring-1 ring-slate-100 ${className}`}>{children}</section>}
function Empty({text}){return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{text}</div>}
function Field({label,children}){return <label className="block"><span className="block text-sm font-semibold mb-1.5">{label}</span>{React.cloneElement(children,{className:`w-full min-h-12 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-slate-300 ${children.props.className||""}`})}</label>}
function BottomTab({active,onClick,icon,label,primary}){return <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active?'text-slate-900':'text-slate-400'}`}><span className={`${primary?'w-11 h-11 -mt-5 mb-0 rounded-full bg-slate-900 text-white shadow-lg flex items-center justify-center':''}`}>{icon}</span><span>{label}</span></button>}
