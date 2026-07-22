"use client"; import { useState } from "react"; import Link from "next/link";
const API="http://localhost:8000";
const DEFAULT={title:"Order service P99 latency spike after MySQL migration",description:"After migrating order-service DB from MySQL 5.7 to 8.0, P99 latency spiked from 120ms to 2.8s. Slow query log shows 200+ SELECT queries scanning 6M rows. Connection pool showing intermittent errors. MySQL CPU steady at 85%.",service_name:"order-service",category:"database",severity:"P1",error_type:"timeout"};
export default function RetrievePage(){const[form,setForm]=useState(DEFAULT);const[result,setResult]=useState<any>(null);const[loading,setLoading]=useState(false);
const run=async()=>{setLoading(true);const res=await fetch(`${API}/api/retrieve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});setResult(await res.json());setLoading(false);};
return(<div className="animate-fade-in"><h1 className="text-2xl font-bold text-gray-900 mb-6">E2E Retrieval Pipeline</h1>
<div className="grid grid-cols-2 gap-6">
<div className="space-y-3"><div className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Current Incident</div>
{(["title","description","service_name","category","severity","error_type"]as const).map((f)=>(<div key={f}><label className="text-[10px] text-gray-500 uppercase font-medium">{f}</label>
{f==="description"?<textarea value={form[f]} onChange={(e)=>setForm({...form,[f]:e.target.value})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 h-24 resize-none focus:outline-none focus:border-indigo-300"/>:<input value={form[f]} onChange={(e)=>setForm({...form,[f]:e.target.value})} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-indigo-300"/>}</div>))}
<button onClick={run} disabled={loading} className="btn-brand w-full text-sm">{loading?"Running...":"Run Retrieval"}</button></div>
<div className="space-y-4">{result&&(<>
<div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Reranked Top-5 ({result.reranked?.length||0})</div>
{result.reranked?.map((r:any,i:number)=>(<Link key={i} href={`/incident/${r.incident_no}`} className="block bg-white border border-gray-200 hover:border-indigo-200 rounded-xl p-4 transition-all group"><div className="flex items-center gap-2 mb-1"><span className="text-indigo-600 text-xs font-bold font-mono group-hover:text-indigo-500">{r.incident_no}</span><span className="text-amber-600 text-xs font-bold">{r.rerank_score?.toFixed(1)}</span></div><p className="text-gray-700 text-xs">{r.title}</p><p className="text-gray-400 text-[10px] mt-1">{r.rerank_reason}</p></Link>))}
<div className="text-xs text-gray-400 uppercase tracking-wider font-medium mt-4">Action Plan</div>
<pre className="bg-white border border-gray-200 rounded-xl p-4 text-[10px] text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto">{result.action_plan}</pre>
<div className="text-xs text-gray-400 uppercase tracking-wider font-medium mt-4">All RRF Candidates ({result.candidates?.length||0})</div>
<div className="space-y-1 max-h-48 overflow-y-auto">{result.candidates?.map((c:any,i:number)=>(<div key={i} className="text-[10px] text-gray-500 flex gap-2"><span className="text-gray-400 w-6">{i+1}.</span><span className="text-indigo-500 w-20 font-mono">{c.incident_no}</span><span className="truncate">{c.title}</span></div>))}</div></>)}</div></div></div>);}
