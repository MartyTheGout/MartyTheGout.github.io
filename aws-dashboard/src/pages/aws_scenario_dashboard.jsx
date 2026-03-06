import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, ComposedChart, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const KRW = 1450;
const fk = (v) => { if (v >= 100000000) return `${(v/100000000).toFixed(1)}억`; if (v >= 10000) return `${(v/10000).toFixed(0)}만원`; return `${v.toLocaleString()}원`; };
const fkf = (v) => `₩${Math.round(v).toLocaleString()}`;

const S3C = [
  { name: "S3 Standard", sp: 0.023, rp: 0, color: "#3B82F6", short: "Standard" },
  { name: "S3 Intelligent-Tiering", sp: 0.023, rp: 0, color: "#8B5CF6", short: "Intelligent" },
  { name: "S3 Standard-IA", sp: 0.0125, rp: 0.01, color: "#0891B2", short: "Std-IA" },
  { name: "S3 One Zone-IA", sp: 0.01, rp: 0.01, color: "#059669", short: "1Z-IA" },
  { name: "Glacier Instant", sp: 0.004, rp: 0.03, color: "#D97706", short: "Glacier Inst" },
  { name: "Glacier Flexible", sp: 0.0036, rp: 0.01, color: "#DC2626", short: "Glacier Flex" },
  { name: "Glacier Deep Archive", sp: 0.00099, rp: 0.02, color: "#6B7280", short: "Deep Archive" },
];

const INFRA_KEYS = ["ecs","alb","aurora","aio","cf","misc"];
const INFRA_LABELS = { ecs:"ECS Fargate", alb:"ALB", aurora:"Aurora", aio:"Aurora IO", cf:"CloudFront", misc:"기타" };
const INFRA_COLORS = { ecs:"#3B82F6", alb:"#8B5CF6", aurora:"#F59E0B", aio:"#F97316", cf:"#10B981", misc:"#94A3B8" };

function buildModel(vpd) {
  const tc = [2,2,2,3,3,3,4,4,4,4];
  let cd=0,cu=0,cs=0;
  return Array.from({length:10},(_,i)=>{
    cd+=20; cu+=200; cs+=120;
    const tf=cu*vpd*22*20/1000;
    const ecs=tc[i]*(0.04048+2*0.004445)*730;
    const alb=0.0225*730+(i+1)*1.5;
    const aurora=0.26*730;
    const aio=(i+1)*20*0.5*0.10+(i+1)*5;
    const cf=tf*0.085;
    const misc=20+(i+1)*2;
    const infraTotal=ecs+alb+aurora+aio+cf+misc;
    const s3 = S3C.map(c=>({ store:cs*c.sp, retrieve:tf*c.rp, total:cs*c.sp+tf*c.rp }));
    return { m:i+1, month:`M${i+1}`, cd, cu, cs, tf, ecs, alb, aurora, aio, cf, misc, infraTotal, s3 };
  });
}

function TT({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"rgba(10,15,30,0.96)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#CBD5E1", backdropFilter:"blur(12px)", boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}>
      <div style={{ fontWeight:700, marginBottom:6, color:"#F1F5F9", fontSize:13 }}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:20, marginBottom:2 }}>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7,height:7,borderRadius:2,background:p.color,display:"inline-block" }}/>{p.name}
          </span>
          <span style={{ fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fk(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const SC = { A:"#3B82F6", B:"#EF4444" };

export default function App() {
  const [tab, setTab] = useState("compare");
  const [selS3, setSelS3] = useState(0);

  const mA = useMemo(()=>buildModel(3),[]);
  const mB = useMemo(()=>buildModel(50),[]);

  // 10-month S3 summaries
  const summary = useMemo(()=>S3C.map((c,ci)=>{
    const s3a = mA.reduce((s,m)=>s+m.s3[ci].total,0)*KRW;
    const s3b = mB.reduce((s,m)=>s+m.s3[ci].total,0)*KRW;
    const ia = mA.reduce((s,m)=>s+m.infraTotal,0)*KRW;
    const ib = mB.reduce((s,m)=>s+m.infraTotal,0)*KRW;
    const retA = mA.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW;
    const retB = mB.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW;
    return { name:c.name, short:c.short, color:c.color, totalA:s3a+ia, totalB:s3b+ib, s3a, s3b, retA, retB, diff:(s3b+ib)-(s3a+ia), ratio:(s3b+ib)/(s3a+ia) };
  }).sort((a,b)=>a.diff-b.diff),[mA,mB]);

  // Monthly comparison for selected S3
  const monthlyCompare = useMemo(()=>mA.map((a,i)=>{
    const b=mB[i];
    return {
      month:a.month,
      "A 인프라":Math.round(a.infraTotal*KRW),
      "A S3":Math.round(a.s3[selS3].total*KRW),
      "A 합계":Math.round((a.infraTotal+a.s3[selS3].total)*KRW),
      "B 인프라":Math.round(b.infraTotal*KRW),
      "B S3":Math.round(b.s3[selS3].total*KRW),
      "B 합계":Math.round((b.infraTotal+b.s3[selS3].total)*KRW),
    };
  }),[mA,mB,selS3]);

  // S3 class comparison bars
  const classCompare = useMemo(()=>S3C.map((c,ci)=>({
    name:c.short,
    "A (3회)":Math.round((mA.reduce((s,m)=>s+m.infraTotal+m.s3[ci].total,0))*KRW),
    "B (50회)":Math.round((mB.reduce((s,m)=>s+m.infraTotal+m.s3[ci].total,0))*KRW),
    color:c.color,
  })),[mA,mB]);

  // Retrieval cost only
  const retCompare = useMemo(()=>S3C.map((c,ci)=>({
    name:c.short,
    "A 검색비":Math.round(mA.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW),
    "B 검색비":Math.round(mB.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW),
  })),[mA,mB]);

  // Pie for M10
  const pieM10 = (model, sci) => {
    const d = model[9];
    return [
      ...INFRA_KEYS.map(k=>({ name:INFRA_LABELS[k], value:Math.round(d[k]*KRW), color:INFRA_COLORS[k] })),
      { name:`S3 ${S3C[sci].short}`, value:Math.round(d.s3[sci].total*KRW), color:S3C[sci].color },
    ];
  };

  const tabs = [
    { id:"compare", label:"A vs B 비교" },
    { id:"detail", label:"월별 상세" },
    { id:"s3deep", label:"S3 검색비 분석" },
    { id:"breakdown", label:"M10 비율" },
  ];

  return (
    <div style={{ fontFamily:"'Pretendard','Noto Sans KR',-apple-system,sans-serif", background:"linear-gradient(160deg,#0B0F1A 0%,#111827 40%,#0B0F1A 100%)", color:"#E2E8F0", minHeight:"100vh", padding:"20px 16px" }}>
      <div style={{ maxWidth:980, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5, margin:0, background:"linear-gradient(135deg,#60A5FA,#F472B6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            AWS 비용 시나리오 비교
          </h1>
          <p style={{ color:"#64748B", fontSize:12, marginTop:4 }}>
            사용 패턴에 따른 비용 변화 · 환율 ₩{KRW.toLocaleString()}/$ ·
            <span style={{ color:SC.A, fontWeight:700 }}> A: 3회/일</span> vs
            <span style={{ color:SC.B, fontWeight:700 }}> B: 50회/일</span>
          </p>
        </div>

        {/* Scenario KPI */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            { label:"Scenario A", sub:"유저당 일 3회 조회 (저빈도)", accent:SC.A, vpd:3, tf10:"2,640 GB" },
            { label:"Scenario B", sub:"유저당 일 50회 조회 (고빈도)", accent:SC.B, vpd:50, tf10:"44,000 GB" },
          ].map((s,i)=>(
            <div key={i} style={{ background:`linear-gradient(135deg,${s.accent}08,${s.accent}15)`, borderRadius:12, padding:"14px 16px", border:`1px solid ${s.accent}30`, position:"relative" }}>
              <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.accent},transparent)` }}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.accent }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{s.sub}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:"#64748B" }}>M10 월 전송량</div>
                  <div style={{ fontSize:18, fontWeight:800, color:s.accent, fontVariantNumeric:"tabular-nums" }}>{s.tf10}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* S3 selector */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#64748B", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>S3 클래스 선택 (월별 상세/비율 탭에 적용)</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {S3C.map((c,i)=>(
              <button key={i} onClick={()=>setSelS3(i)} style={{
                padding:"5px 12px", borderRadius:16, fontSize:11, fontWeight:600, cursor:"pointer",
                border:selS3===i?`2px solid ${c.color}`:"1px solid rgba(255,255,255,0.08)",
                background:selS3===i?`${c.color}20`:"rgba(30,41,59,0.5)",
                color:selS3===i?c.color:"#64748B", transition:"all 0.15s",
              }}>{c.short}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, background:"rgba(30,41,59,0.5)", borderRadius:10, padding:3 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
              border:"none", transition:"all 0.15s",
              background:tab===t.id?"rgba(96,165,250,0.12)":"transparent",
              color:tab===t.id?"#60A5FA":"#475569",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ TAB: A vs B Compare ═══ */}
        {tab==="compare" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* Grouped bar: total 10-month cost per S3 class */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:2, color:"#F1F5F9" }}>S3 클래스별 10개월 총 비용</h3>
              <p style={{ fontSize:11, color:"#64748B", marginBottom:14 }}>인프라 + S3 포함 · 파란색 A(3회) / 빨간색 B(50회)</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={classCompare} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="name" tick={{ fill:"#94A3B8", fontSize:11 }}/>
                  <YAxis tick={{ fill:"#94A3B8", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="A (3회)" fill={SC.A} radius={[4,4,0,0]} barSize={24}/>
                  <Bar dataKey="B (50회)" fill={SC.B} radius={[4,4,0,0]} barSize={24}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ranking table */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14, color:"#F1F5F9" }}>10개월 총 비용 순위 (차이 기준 정렬)</h3>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                      {["#","S3 클래스","A: 3회/일","B: 50회/일","차이 (B-A)","배율"].map(h=>(
                        <th key={h} style={{ padding:"8px 8px", color:"#64748B", fontWeight:600, textAlign:h==="#"||h==="S3 클래스"?"left":"right", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((r,i)=>(
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:i===0?"rgba(52,211,153,0.06)":i===summary.length-1?"rgba(239,68,68,0.05)":"transparent" }}>
                        <td style={{ padding:"9px 8px", fontWeight:700, color:i===0?"#34D399":"#475569", fontSize:13 }}>{i===0?"🏆":i+1}</td>
                        <td style={{ padding:"9px 8px", fontWeight:600 }}>
                          <span style={{ display:"inline-block", width:8,height:8,borderRadius:2,background:r.color,marginRight:6,verticalAlign:"middle" }}/>{r.name}
                        </td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:SC.A, fontVariantNumeric:"tabular-nums" }}>{fkf(r.totalA)}</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:SC.B, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fkf(r.totalB)}</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:"#F87171", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>+{fkf(r.diff)}</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", fontVariantNumeric:"tabular-nums" }}>{r.ratio.toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)", fontSize:12, lineHeight:1.7 }}>
                <strong style={{ color:"#FBBF24" }}>⚡ 핵심:</strong>
                <span style={{ color:"#94A3B8" }}> 50회/일 시나리오에서 </span>
                <strong style={{ color:"#EF4444" }}>Glacier Instant는 ₩{fk(summary[summary.length-1]?.diff||0)} 추가 비용</strong>
                <span style={{ color:"#94A3B8" }}>이 발생합니다. 반면 </span>
                <strong style={{ color:"#34D399" }}>S3 Standard는 검색비 무료</strong>
                <span style={{ color:"#94A3B8" }}>로 고빈도에서도 가장 경제적입니다.</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Monthly Detail ═══ */}
        {tab==="detail" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:2, color:"#F1F5F9" }}>월별 총 비용 추이: A vs B</h3>
              <p style={{ fontSize:11, color:"#64748B", marginBottom:14 }}>S3: <span style={{ color:S3C[selS3].color, fontWeight:600 }}>{S3C[selS3].name}</span></p>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthlyCompare} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="month" tick={{ fill:"#94A3B8", fontSize:11 }}/>
                  <YAxis tick={{ fill:"#94A3B8", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="A 인프라" stackId="a" fill={`${SC.A}88`} barSize={20}/>
                  <Bar dataKey="A S3" stackId="a" fill={SC.A} radius={[3,3,0,0]} barSize={20}/>
                  <Bar dataKey="B 인프라" stackId="b" fill={`${SC.B}88`} barSize={20}/>
                  <Bar dataKey="B S3" stackId="b" fill={SC.B} radius={[3,3,0,0]} barSize={20}/>
                  <Line type="monotone" dataKey="A 합계" stroke={SC.A} strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                  <Line type="monotone" dataKey="B 합계" stroke={SC.B} strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Data table */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)", overflowX:"auto" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14, color:"#F1F5F9" }}>월별 수치 비교 ({S3C[selS3].short})</h3>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ padding:"7px 6px", color:"#64748B", textAlign:"center" }}>월</th>
                    <th style={{ padding:"7px 6px", color:SC.A, textAlign:"right" }}>A 인프라</th>
                    <th style={{ padding:"7px 6px", color:SC.A, textAlign:"right" }}>A S3</th>
                    <th style={{ padding:"7px 6px", color:SC.A, textAlign:"right", fontWeight:700 }}>A 합계</th>
                    <th style={{ padding:"7px 6px", color:SC.B, textAlign:"right" }}>B 인프라</th>
                    <th style={{ padding:"7px 6px", color:SC.B, textAlign:"right" }}>B S3</th>
                    <th style={{ padding:"7px 6px", color:SC.B, textAlign:"right", fontWeight:700 }}>B 합계</th>
                    <th style={{ padding:"7px 6px", color:"#F87171", textAlign:"right" }}>차이</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyCompare.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding:"6px", textAlign:"center", fontWeight:600 }}>{r.month}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:"#93C5FD" }}>{fk(r["A 인프라"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:"#93C5FD" }}>{fk(r["A S3"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:SC.A, fontWeight:700 }}>{fk(r["A 합계"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:"#FCA5A5" }}>{fk(r["B 인프라"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:"#FCA5A5" }}>{fk(r["B S3"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:SC.B, fontWeight:700 }}>{fk(r["B 합계"])}</td>
                      <td style={{ textAlign:"right", padding:"6px", color:"#F87171", fontWeight:600 }}>+{fk(r["B 합계"]-r["A 합계"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: S3 Retrieval Deep Dive ═══ */}
        {tab==="s3deep" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:2, color:"#F1F5F9" }}>S3 검색(Retrieval) 비용만 비교</h3>
              <p style={{ fontSize:11, color:"#64748B", marginBottom:14 }}>저장 비용 제외, 순수 검색비만 · 10개월 합산</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={retCompare} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="name" tick={{ fill:"#94A3B8", fontSize:11 }}/>
                  <YAxis tick={{ fill:"#94A3B8", fontSize:10 }} tickFormatter={v=>v>=10000?`${(v/10000).toFixed(0)}만`:`${v}`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="A 검색비" fill={SC.A} radius={[4,4,0,0]} barSize={28}/>
                  <Bar dataKey="B 검색비" fill={SC.B} radius={[4,4,0,0]} barSize={28}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Retrieval cost table */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14, color:"#F1F5F9" }}>검색 비용 상세 (10개월 합산)</h3>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                    {["S3 클래스","검색단가","A 검색비","B 검색비","차이","배율"].map(h=>(
                      <th key={h} style={{ padding:"8px", color:"#64748B", fontWeight:600, textAlign:h==="S3 클래스"?"left":"right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {S3C.map((c,ci)=>{
                    const ra=mA.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW;
                    const rb=mB.reduce((s,m)=>s+m.s3[ci].retrieve,0)*KRW;
                    return (
                      <tr key={ci} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:c.rp===0?"rgba(52,211,153,0.05)":rb===Math.max(...S3C.map((_,j)=>mB.reduce((s,m)=>s+m.s3[j].retrieve,0)*KRW))?"rgba(239,68,68,0.05)":"transparent" }}>
                        <td style={{ padding:"9px 8px" }}>
                          <span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:c.color,marginRight:6,verticalAlign:"middle" }}/>{c.name}
                        </td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:"#94A3B8" }}>${c.rp}/GB</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:SC.A }}>{ra===0?"무료":fkf(ra)}</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:SC.B, fontWeight:700 }}>{rb===0?"무료":fkf(rb)}</td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:rb-ra>0?"#F87171":"#34D399", fontWeight:600 }}>
                          {rb-ra===0?"—":`+${fkf(rb-ra)}`}
                        </td>
                        <td style={{ textAlign:"right", padding:"9px 8px", color:"#94A3B8" }}>
                          {ra===0?"—":"16.7x"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:16 }}>
                <div style={{ padding:"12px 14px", borderRadius:8, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)", fontSize:11, lineHeight:1.7 }}>
                  <strong style={{ color:"#34D399" }}>✅ 검색비 무료</strong>
                  <div style={{ color:"#94A3B8", marginTop:4 }}>S3 Standard, Intelligent-Tiering은 아무리 조회해도 검색비가 0원. 고빈도 서비스에 최적.</div>
                </div>
                <div style={{ padding:"12px 14px", borderRadius:8, background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", fontSize:11, lineHeight:1.7 }}>
                  <strong style={{ color:"#EF4444" }}>🚨 Glacier Instant 주의</strong>
                  <div style={{ color:"#94A3B8", marginTop:4 }}>50회/일 시나리오에서 검색비만 10개월 ₩{fk(Math.round(mB.reduce((s,m)=>s+m.s3[4].retrieve,0)*KRW))}. 저장비 절약분을 완전히 상쇄.</div>
                </div>
              </div>
            </div>

            {/* Monthly S3 lines per class - scenario B only */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:2, color:"#F1F5F9" }}>B(50회/일): S3 클래스별 월간 비용 추이</h3>
              <p style={{ fontSize:11, color:"#64748B", marginBottom:14 }}>저장+검색 합산</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mB.map((b,i)=>{ const r={month:`M${i+1}`}; S3C.forEach((c,ci)=>{ r[c.short]=Math.round(b.s3[ci].total*KRW); }); return r; })} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="month" tick={{ fill:"#94A3B8", fontSize:11 }}/>
                  <YAxis tick={{ fill:"#94A3B8", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:10 }}/>
                  {S3C.map(c=><Line key={c.short} type="monotone" dataKey={c.short} stroke={c.color} strokeWidth={2} dot={{r:2}}/>)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ TAB: M10 Breakdown Pies ═══ */}
        {tab==="breakdown" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {[
                { label:"A: 3회/일", model:mA, accent:SC.A },
                { label:"B: 50회/일", model:mB, accent:SC.B },
              ].map((s,si)=>{
                const pd = pieM10(s.model, selS3);
                const total = pd.reduce((sum,p)=>sum+p.value,0);
                return (
                  <div key={si} style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:`1px solid ${s.accent}20` }}>
                    <h3 style={{ fontSize:14, fontWeight:700, marginBottom:2, color:s.accent }}>{s.label}</h3>
                    <p style={{ fontSize:11, color:"#64748B", marginBottom:8 }}>M10 월간: <strong style={{ color:"#F1F5F9" }}>{fkf(total)}</strong></p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pd} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                          {pd.map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fkf(v)} contentStyle={{ background:"rgba(10,15,30,0.95)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, fontSize:11, color:"#CBD5E1" }}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", flexDirection:"column", gap:3, marginTop:4 }}>
                      {pd.sort((a,b)=>b.value-a.value).map((d,i)=>(
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11 }}>
                          <span style={{ width:8,height:8,borderRadius:2,background:d.color,flexShrink:0 }}/>
                          <span style={{ color:"#94A3B8", flex:1 }}>{d.name}</span>
                          <span style={{ fontWeight:600, fontVariantNumeric:"tabular-nums", color:"#E2E8F0" }}>{fk(d.value)}</span>
                          <span style={{ color:"#475569", width:36, textAlign:"right" }}>{(d.value/total*100).toFixed(0)}%</span>
                          <div style={{ width:60, height:4, background:"rgba(255,255,255,0.04)", borderRadius:2 }}>
                            <div style={{ width:`${d.value/total*100}%`, height:"100%", background:d.color, borderRadius:2 }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Diff highlight */}
            <div style={{ background:"rgba(30,41,59,0.5)", borderRadius:14, padding:"18px 14px", border:"1px solid rgba(255,255,255,0.04)" }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14, color:"#F1F5F9" }}>A → B 전환 시 비용 변동 ({S3C[selS3].short})</h3>
              {(()=>{
                const da = mA[9]; const db = mB[9];
                const items = [
                  ...INFRA_KEYS.map(k=>({ name:INFRA_LABELS[k], a:Math.round(da[k]*KRW), b:Math.round(db[k]*KRW), color:INFRA_COLORS[k] })),
                  { name:`S3 ${S3C[selS3].short}`, a:Math.round(da.s3[selS3].total*KRW), b:Math.round(db.s3[selS3].total*KRW), color:S3C[selS3].color },
                ].map(i=>({...i, diff:i.b-i.a, pct:i.a>0?((i.b-i.a)/i.a*100):0 })).sort((a,b)=>b.diff-a.diff);
                const maxDiff = Math.max(...items.map(i=>Math.abs(i.diff)));
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {items.map((item,i)=>(
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"120px 1fr 80px 70px", alignItems:"center", gap:8, padding:"6px 0" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                          <span style={{ width:8,height:8,borderRadius:2,background:item.color }}/>
                          {item.name}
                        </span>
                        <div style={{ position:"relative", height:16, background:"rgba(255,255,255,0.03)", borderRadius:4, overflow:"hidden" }}>
                          <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"rgba(255,255,255,0.1)" }}/>
                          {item.diff > 0 && (
                            <div style={{ position:"absolute", left:"50%", top:2, bottom:2, width:`${item.diff/maxDiff*50}%`, background:SC.B, borderRadius:"0 3px 3px 0", opacity:0.7 }}/>
                          )}
                          {item.diff === 0 && (
                            <div style={{ position:"absolute", left:"50%", top:2, bottom:2, width:2, background:"#475569", borderRadius:2 }}/>
                          )}
                        </div>
                        <span style={{ textAlign:"right", fontSize:11, fontWeight:600, fontVariantNumeric:"tabular-nums", color:item.diff>0?"#F87171":item.diff===0?"#475569":"#34D399" }}>
                          {item.diff===0?"변동 없음":`+${fk(item.diff)}`}
                        </span>
                        <span style={{ textAlign:"right", fontSize:10, color:"#475569" }}>
                          {item.pct===0?"—":`+${item.pct.toFixed(0)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:28, padding:"14px 0", borderTop:"1px solid rgba(255,255,255,0.04)", textAlign:"center" }}>
          <p style={{ fontSize:10, color:"#334155" }}>
            AWS 비용 시뮬레이션 · US East 리전 기준 · 서울 리전 +10~30% · ₩{KRW.toLocaleString()}/USD · 2026.3
          </p>
        </div>
      </div>
    </div>
  );
}
