import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  ComposedChart, Area
} from "recharts";

const KRW = 1450;
const fk = (v) => { if (v >= 100000000) return `${(v/100000000).toFixed(1)}억`; if (v >= 10000) return `${Math.round(v/10000)}만원`; return `${Math.round(v).toLocaleString()}원`; };
const fkf = (v) => `₩${Math.round(v).toLocaleString()}`;

const S3C = [
  { name:"S3 Standard", sp:0.023, rp:0, color:"#3B82F6", short:"Standard" },
  { name:"Intelligent-Tiering", sp:0.023, rp:0, color:"#8B5CF6", short:"Intelligent" },
  { name:"S3 Standard-IA", sp:0.0125, rp:0.01, color:"#0891B2", short:"Std-IA" },
  { name:"S3 One Zone-IA", sp:0.01, rp:0.01, color:"#059669", short:"1Z-IA" },
  { name:"Glacier Instant", sp:0.004, rp:0.03, color:"#D97706", short:"Glacier Inst" },
  { name:"Glacier Flexible", sp:0.0036, rp:0.01, color:"#DC2626", short:"Glacier Flex" },
  { name:"Glacier Deep Archive", sp:0.00099, rp:0.02, color:"#6B7280", short:"Deep Archive" },
];

const VIEWS = [3, 20, 50];
const DLVR = [
  { name:"원본 전송", mb:20, desc:"20MB 그대로 스트리밍", color:"#EF4444", icon:"📹" },
  { name:"압축 전송", mb:5, desc:"H.265 등 트랜스코딩 (5MB)", color:"#3B82F6", icon:"🗜️" },
  { name:"썸네일+온디맨드", mb:2, desc:"목록은 썸네일, 재생 시 저화질 (2MB)", color:"#10B981", icon:"🖼️" },
];

const IK = ["ecs","alb","aurora","aio","cf","misc"];
const IL = { ecs:"ECS Fargate", alb:"ALB", aurora:"Aurora MySQL", aio:"Aurora IO", cf:"CloudFront", misc:"기타" };
const IC = { ecs:"#3B82F6", alb:"#8B5CF6", aurora:"#F59E0B", aio:"#F97316", cf:"#10B981", misc:"#94A3B8" };

function buildModel(vpd, mb) {
  const tc=[2,2,2,3,3,3,4,4,4,4];
  let cu=0, cs=0;
  return Array.from({length:10},(_,i)=>{
    cu+=200; cs+=120;
    const tf=cu*vpd*22*mb/1000;
    const ecs=tc[i]*(0.04048+2*0.004445)*730;
    const alb=0.0225*730+(i+1)*1.5;
    const aurora=0.26*730;
    const aio=(i+1)*20*0.5*0.10+(i+1)*5;
    const cf=tf*0.085;
    const misc=20+(i+1)*2;
    const inf=ecs+alb+aurora+aio+cf+misc;
    const s3=S3C.map(c=>({ total:cs*c.sp+tf*c.rp, store:cs*c.sp, retrieve:tf*c.rp }));
    return { m:i+1, month:`M${i+1}`, cu, cs, tf, ecs, alb, aurora, aio, cf, misc, inf, s3 };
  });
}

function TT({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"rgba(8,12,24,0.97)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#CBD5E1", boxShadow:"0 12px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ fontWeight:700, marginBottom:6, color:"#F1F5F9", fontSize:13 }}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:20, marginBottom:2 }}>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7, height:7, borderRadius:2, background:p.color, display:"inline-block" }}/>{p.name}
          </span>
          <span style={{ fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fk(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ children, style, glow }) {
  return (
    <div style={{
      background:"rgba(22,28,45,0.7)", borderRadius:14, padding:"18px 14px",
      border:`1px solid ${glow ? glow+"20" : "rgba(255,255,255,0.04)"}`,
      ...style,
    }}>{children}</div>
  );
}

export default function App() {
  const [tab, setTab] = useState("insight");
  const [vpd, setVpd] = useState(20);
  const [dlvr, setDlvr] = useState(0);
  const [selS3, setSelS3] = useState(0);

  const md = useMemo(()=>buildModel(vpd, DLVR[dlvr].mb),[vpd, dlvr]);

  // 10-month totals per S3
  const totals10 = useMemo(()=>S3C.map((c,ci)=>{
    const inf10=md.reduce((s,m)=>s+m.inf,0)*KRW;
    const s310=md.reduce((s,m)=>s+m.s3[ci].total,0)*KRW;
    const cf10=md.reduce((s,m)=>s+m.cf,0)*KRW;
    return { ...c, inf10, s310, total:inf10+s310, cf10 };
  }).sort((a,b)=>a.total-b.total),[md]);

  // Pie: cost breakdown for M10
  const pie10 = useMemo(()=>{
    const d=md[9];
    return [
      ...IK.map(k=>({ name:IL[k], value:Math.round(d[k]*KRW), color:IC[k] })),
      { name:`S3 ${S3C[selS3].short}`, value:Math.round(d.s3[selS3].total*KRW), color:S3C[selS3].color },
    ];
  },[md, selS3]);

  // Cross comparison: all delivery methods for fixed vpd and S3
  const crossDlvr = useMemo(()=>{
    return DLVR.map((dl,di)=>{
      const m=buildModel(vpd, dl.mb);
      const inf10=m.reduce((s,r)=>s+r.inf,0)*KRW;
      const s310=m.reduce((s,r)=>s+r.s3[selS3].total,0)*KRW;
      const cf10=m.reduce((s,r)=>s+r.cf,0)*KRW;
      return { name:dl.name, mb:dl.mb, color:dl.color, total:inf10+s310, cf:cf10, s3:s310, infra:inf10-cf10 };
    });
  },[vpd, selS3]);

  // Cross comparison: all views × all delivery for selected S3
  const matrix = useMemo(()=>{
    return VIEWS.map(v=>({
      vpd:v,
      data:DLVR.map(dl=>{
        const m=buildModel(v, dl.mb);
        const inf10=m.reduce((s,r)=>s+r.inf,0)*KRW;
        const s310=m.reduce((s,r)=>s+r.s3[selS3].total,0)*KRW;
        return inf10+s310;
      })
    }));
  },[selS3]);

  // Monthly stacked bar
  const monthlyStack = useMemo(()=>md.map(d=>({
    month:d.month,
    ...Object.fromEntries(IK.map(k=>[IL[k], Math.round(d[k]*KRW)])),
    [`S3`]: Math.round(d.s3[selS3].total*KRW),
    합계: Math.round((d.inf+d.s3[selS3].total)*KRW),
  })),[md, selS3]);

  const total10 = totals10.find(t=>t.name===S3C[selS3].name)?.total||0;
  const cfPct = pie10.find(p=>p.name==="CloudFront")?.value / pie10.reduce((s,p)=>s+p.value,0)*100||0;

  const tabs = [
    { id:"insight", label:"💡 핵심 인사이트" },
    { id:"matrix", label:"📊 비용 매트릭스" },
    { id:"monthly", label:"📈 월별 상세" },
    { id:"breakdown", label:"🔍 비율 분석" },
  ];

  return (
    <div style={{ fontFamily:"'Pretendard','Noto Sans KR',-apple-system,sans-serif", background:"linear-gradient(165deg,#06080F 0%,#0E1420 40%,#080C16 100%)", color:"#E2E8F0", minHeight:"100vh", padding:"20px 16px" }}>
      <div style={{ maxWidth:1000, margin:"0 auto" }}>
        {/* Header */}
        <h1 style={{ fontSize:22, fontWeight:800, margin:0, letterSpacing:-0.5, background:"linear-gradient(135deg,#60A5FA,#34D399)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          AWS 비용 — 어디서 돈이 나가는가?
        </h1>
        <p style={{ color:"#475569", fontSize:12, margin:"4px 0 20px" }}>
          조회빈도 × 전달방식 × S3 클래스 · ₩{KRW.toLocaleString()}/USD
        </p>

        {/* Controls */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
          {/* View freq */}
          <div>
            <div style={{ fontSize:10, color:"#475569", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>조회 빈도</div>
            <div style={{ display:"flex", gap:4 }}>
              {VIEWS.map(v=>(
                <button key={v} onClick={()=>setVpd(v)} style={{
                  flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                  border:vpd===v?"2px solid #60A5FA":"1px solid rgba(255,255,255,0.06)",
                  background:vpd===v?"rgba(96,165,250,0.12)":"rgba(22,28,45,0.6)",
                  color:vpd===v?"#60A5FA":"#475569", transition:"all 0.15s",
                }}>{v}회/일</button>
              ))}
            </div>
          </div>
          {/* Delivery */}
          <div>
            <div style={{ fontSize:10, color:"#475569", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>전달 방식</div>
            <div style={{ display:"flex", gap:4 }}>
              {DLVR.map((d,i)=>(
                <button key={i} onClick={()=>setDlvr(i)} style={{
                  flex:1, padding:"8px 0", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer",
                  border:dlvr===i?`2px solid ${d.color}`:"1px solid rgba(255,255,255,0.06)",
                  background:dlvr===i?`${d.color}15`:"rgba(22,28,45,0.6)",
                  color:dlvr===i?d.color:"#475569", transition:"all 0.15s", lineHeight:1.2,
                }}>{d.icon}<br/>{d.mb}MB</button>
              ))}
            </div>
          </div>
          {/* S3 */}
          <div>
            <div style={{ fontSize:10, color:"#475569", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>S3 클래스</div>
            <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
              {S3C.map((c,i)=>(
                <button key={i} onClick={()=>setSelS3(i)} style={{
                  padding:"4px 8px", borderRadius:12, fontSize:10, fontWeight:600, cursor:"pointer",
                  border:selS3===i?`2px solid ${c.color}`:"1px solid rgba(255,255,255,0.06)",
                  background:selS3===i?`${c.color}18`:"transparent",
                  color:selS3===i?c.color:"#475569", transition:"all 0.15s",
                }}>{c.short}</button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
          {[
            { label:"10개월 총비용", value:fk(total10), sub:`월평균 ${fk(total10/10)}`, accent:"#60A5FA" },
            { label:"CloudFront 비중", value:`${cfPct.toFixed(0)}%`, sub:`전송 = 최대 비용 요인`, accent:cfPct>40?"#EF4444":"#10B981" },
            { label:"S3 비중", value:`${(pie10.find(p=>p.name.includes("S3"))?.value/(pie10.reduce((s,p)=>s+p.value,0))*100||0).toFixed(1)}%`, sub:"스토리지 클래스 영향 미미", accent:"#A78BFA" },
            { label:"M10 월 전송량", value:`${(md[9]?.tf||0).toLocaleString(undefined,{maximumFractionDigits:0})} GB`, sub:`${vpd}회 × 2000유저 × ${DLVR[dlvr].mb}MB`, accent:"#FBBF24" },
          ].map((k,i)=>(
            <div key={i} style={{ background:"rgba(22,28,45,0.7)", borderRadius:10, padding:"12px 12px", border:`1px solid ${k.accent}18`, position:"relative" }}>
              <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${k.accent},transparent)` }}/>
              <div style={{ fontSize:10, color:"#475569", marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:k.accent }}>{k.value}</div>
              <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, background:"rgba(22,28,45,0.5)", borderRadius:10, padding:3 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
              border:"none", background:tab===t.id?"rgba(96,165,250,0.1)":"transparent",
              color:tab===t.id?"#60A5FA":"#334155", transition:"all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ INSIGHT ═══ */}
        {tab==="insight" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            {/* Key message */}
            <Card glow="#FBBF24">
              <div style={{ fontSize:15, fontWeight:800, color:"#FBBF24", marginBottom:8 }}>
                🎯 S3 클래스보다 전달 방식이 10배 중요합니다
              </div>
              <div style={{ fontSize:12, color:"#94A3B8", lineHeight:1.8 }}>
                현재 시나리오에서 S3 저장 비용은 전체의 <strong style={{ color:"#F1F5F9" }}>1~3%</strong>에 불과합니다.
                비용의 <strong style={{ color:"#EF4444" }}>50~67%</strong>는 영상 데이터를 유저에게 전송하는 <strong style={{ color:"#10B981" }}>CloudFront(Egress)</strong> 비용입니다.
                이 전송 비용은 S3를 쓰든, Glacier를 쓰든, <strong style={{ color:"#F1F5F9" }}>반드시 발생</strong>합니다.
                CloudFront를 빼도 S3 직접 전송($0.09/GB)으로 오히려 더 비싸집니다.
              </div>
            </Card>

            {/* Delivery method comparison bar */}
            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:2 }}>전달 방식별 10개월 총 비용</h3>
              <p style={{ fontSize:11, color:"#475569", marginBottom:14 }}>{vpd}회/일 · {S3C[selS3].short} · 비용 구성 분해</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={crossDlvr.map(d=>({
                  name:`${d.name}\n(${d.mb}MB)`,
                  "인프라 (고정)":Math.round(d.infra),
                  "CloudFront 전송":Math.round(d.cf),
                  "S3 저장+검색":Math.round(d.s3),
                }))} margin={{ top:8,right:8,left:8,bottom:0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis type="number" tick={{ fill:"#64748B", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <YAxis type="category" dataKey="name" tick={{ fill:"#94A3B8", fontSize:11 }} width={100}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="인프라 (고정)" stackId="a" fill="#475569" radius={[0,0,0,0]}/>
                  <Bar dataKey="CloudFront 전송" stackId="a" fill="#10B981"/>
                  <Bar dataKey="S3 저장+검색" stackId="a" fill={S3C[selS3].color} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Savings callout */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {crossDlvr.map((d,i)=>{
                const save = i>0 ? crossDlvr[0].total - d.total : 0;
                const savePct = i>0 ? save/crossDlvr[0].total*100 : 0;
                return (
                  <Card key={i} glow={DLVR[i].color}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{DLVR[i].icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:DLVR[i].color }}>{DLVR[i].name}</div>
                    <div style={{ fontSize:10, color:"#475569", marginBottom:8 }}>{DLVR[i].desc}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:"#F1F5F9" }}>{fk(d.total)}</div>
                    <div style={{ fontSize:10, color:"#475569" }}>10개월 총비용</div>
                    {i>0 && (
                      <div style={{ marginTop:8, padding:"6px 10px", borderRadius:6, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.15)" }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"#34D399" }}>↓ {fk(save)} 절감</span>
                        <span style={{ fontSize:10, color:"#059669", marginLeft:6 }}>({savePct.toFixed(0)}%)</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Recommendation */}
            <Card glow="#34D399" style={{ background:"rgba(52,211,153,0.04)" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#34D399", marginBottom:8 }}>✅ 추천 전략</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:12, color:"#94A3B8", lineHeight:1.7 }}>
                <div><strong style={{ color:"#F1F5F9" }}>1. 업로드 시 자동 트랜스코딩</strong> — AWS MediaConvert로 20MB → 5MB (H.265). 업로드 파이프라인에 한 번만 추가하면 전송 비용 75% 절감.</div>
                <div><strong style={{ color:"#F1F5F9" }}>2. S3 Standard 사용</strong> — 검색비 무료. 전체 비용의 1~3%라 Glacier로 바꿔도 절감 효과 미미.</div>
                <div><strong style={{ color:"#F1F5F9" }}>3. CloudFront 캐싱</strong> — 같은 영상 반복 조회 시 캐시 히트로 S3 요청 자체가 줄어듦. 추가 비용 절감.</div>
                <div><strong style={{ color:"#F1F5F9" }}>4. 장기 아카이빙</strong> — S3 Lifecycle으로 1년 이상 미조회 영상만 Glacier로 자동 전환.</div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ MATRIX ═══ */}
        {tab==="matrix" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:14 }}>10개월 총 비용 매트릭스 ({S3C[selS3].short})</h3>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                      <th style={{ padding:"8px", color:"#475569", textAlign:"left" }}></th>
                      {DLVR.map((d,i)=>(
                        <th key={i} style={{ padding:"8px 12px", color:d.color, fontWeight:700, textAlign:"right" }}>{d.icon} {d.name}<br/><span style={{ fontWeight:400, fontSize:10 }}>({d.mb}MB/조회)</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row,ri)=>(
                      <tr key={ri} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:row.vpd===vpd?"rgba(96,165,250,0.06)":"transparent" }}>
                        <td style={{ padding:"10px 12px", fontWeight:700, color:row.vpd===vpd?"#60A5FA":"#94A3B8" }}>
                          {row.vpd}회/일 {row.vpd===vpd&&"◀"}
                        </td>
                        {row.data.map((v,ci)=>{
                          const min=Math.min(...matrix.flatMap(r=>r.data));
                          const max=Math.max(...matrix.flatMap(r=>r.data));
                          const intensity=(v-min)/(max-min);
                          return (
                            <td key={ci} style={{
                              textAlign:"right", padding:"10px 12px", fontWeight:600, fontVariantNumeric:"tabular-nums",
                              background:`rgba(239,68,68,${intensity*0.12})`,
                              color: intensity>0.5?"#FCA5A5":"#E2E8F0",
                            }}>
                              {fkf(v)}
                              <div style={{ fontSize:9, color:"#475569", fontWeight:400 }}>월 {fk(v/10)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:12, fontSize:11, color:"#475569" }}>
                🟥 빨간색이 진할수록 비용이 높음 · 현재 선택: <strong style={{ color:"#60A5FA" }}>{vpd}회 × {DLVR[dlvr].mb}MB</strong>
              </div>
            </Card>

            {/* Grouped bar: S3 classes for current setting */}
            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:2 }}>S3 클래스별 10개월 총비용</h3>
              <p style={{ fontSize:11, color:"#475569", marginBottom:14 }}>{vpd}회/일 · {DLVR[dlvr].name}({DLVR[dlvr].mb}MB)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={totals10.map(t=>({ name:t.short, "인프라":Math.round(t.inf10), "S3":Math.round(t.s310) }))} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis dataKey="name" tick={{ fill:"#94A3B8", fontSize:10 }}/>
                  <YAxis tick={{ fill:"#64748B", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="인프라" stackId="a" fill="#475569"/>
                  <Bar dataKey="S3" stackId="a" fill="#60A5FA" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ═══ MONTHLY ═══ */}
        {tab==="monthly" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:2 }}>월별 비용 구성</h3>
              <p style={{ fontSize:11, color:"#475569", marginBottom:14 }}>{vpd}회/일 · {DLVR[dlvr].name} · {S3C[selS3].short}</p>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={monthlyStack} margin={{ top:8,right:8,left:8,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis dataKey="month" tick={{ fill:"#94A3B8", fontSize:11 }}/>
                  <YAxis tick={{ fill:"#64748B", fontSize:10 }} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{ fontSize:10 }}/>
                  {IK.map(k=><Bar key={k} dataKey={IL[k]} stackId="a" fill={IC[k]}/>)}
                  <Bar dataKey="S3" stackId="a" fill={S3C[selS3].color} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:14 }}>월별 수치 테이블</h3>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                      {["월","유저","저장(GB)","전송(GB)","인프라","CloudFront","S3","합계"].map(h=>(
                        <th key={h} style={{ padding:"7px 6px", color:"#475569", fontWeight:600, textAlign:"right" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {md.map((d,i)=>(
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ textAlign:"right", padding:"6px", fontWeight:600 }}>{d.month}</td>
                        <td style={{ textAlign:"right", padding:"6px" }}>{d.cu.toLocaleString()}</td>
                        <td style={{ textAlign:"right", padding:"6px" }}>{d.cs.toLocaleString()}</td>
                        <td style={{ textAlign:"right", padding:"6px", color:"#FBBF24" }}>{Math.round(d.tf).toLocaleString()}</td>
                        <td style={{ textAlign:"right", padding:"6px" }}>{fk(Math.round((d.inf-d.cf)*KRW))}</td>
                        <td style={{ textAlign:"right", padding:"6px", color:"#10B981", fontWeight:600 }}>{fk(Math.round(d.cf*KRW))}</td>
                        <td style={{ textAlign:"right", padding:"6px", color:S3C[selS3].color }}>{fk(Math.round(d.s3[selS3].total*KRW))}</td>
                        <td style={{ textAlign:"right", padding:"6px", fontWeight:700 }}>{fk(Math.round((d.inf+d.s3[selS3].total)*KRW))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ BREAKDOWN ═══ */}
        {tab==="breakdown" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Card>
                <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:8 }}>M10 비용 비율</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pie10} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                      {pie10.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip formatter={v=>fkf(v)} contentStyle={{ background:"rgba(8,12,24,0.95)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, fontSize:11, color:"#CBD5E1" }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {pie10.sort((a,b)=>b.value-a.value).map((d,i)=>{
                    const total=pie10.reduce((s,p)=>s+p.value,0);
                    const pct=d.value/total*100;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11 }}>
                        <span style={{ width:8,height:8,borderRadius:2,background:d.color, flexShrink:0 }}/>
                        <span style={{ color:"#94A3B8", flex:1 }}>{d.name}</span>
                        <span style={{ fontWeight:600, color:"#E2E8F0", width:70, textAlign:"right" }}>{fk(d.value)}</span>
                        <span style={{ color:"#475569", width:36, textAlign:"right", fontSize:10 }}>{pct.toFixed(0)}%</span>
                        <div style={{ width:50, height:4, background:"rgba(255,255,255,0.04)", borderRadius:2 }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:d.color, borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <h3 style={{ fontSize:14, fontWeight:700, color:"#F1F5F9", marginBottom:8 }}>전달방식별 CloudFront 비중</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:16 }}>
                  {DLVR.map((dl,di)=>{
                    const m=buildModel(vpd, dl.mb);
                    const d=m[9];
                    const cfVal=d.cf*KRW;
                    const totalVal=(d.inf+d.s3[selS3].total)*KRW;
                    const pct=cfVal/totalVal*100;
                    return (
                      <div key={di}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                          <span style={{ color:dl.color, fontWeight:600 }}>{dl.icon} {dl.name} ({dl.mb}MB)</span>
                          <span style={{ color:pct>40?"#EF4444":"#10B981", fontWeight:700 }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height:20, background:"rgba(255,255,255,0.03)", borderRadius:6, overflow:"hidden", display:"flex" }}>
                          <div style={{ width:`${100-pct}%`, background:"#334155", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#94A3B8" }}>
                            인프라+S3
                          </div>
                          <div style={{ width:`${pct}%`, background:pct>40?"#DC262688":"#10B98188", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#F1F5F9", fontWeight:600 }}>
                            CF {fk(cfVal)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop:16, padding:"10px 12px", borderRadius:8, background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.12)", fontSize:11, color:"#94A3B8", lineHeight:1.6 }}>
                  <strong style={{ color:"#FBBF24" }}>핵심:</strong> 원본 전송 시 CloudFront가 <strong style={{ color:"#EF4444" }}>비용의 2/3</strong>.
                  5MB 압축만 해도 CloudFront 비중이 <strong style={{ color:"#10B981" }}>1/3로 감소</strong>.
                </div>
              </Card>
            </div>
          </div>
        )}

        <div style={{ marginTop:24, padding:"12px 0", borderTop:"1px solid rgba(255,255,255,0.03)", textAlign:"center" }}>
          <p style={{ fontSize:9, color:"#1E293B" }}>AWS 비용 시뮬레이션 · US East 기준 · 서울 리전 +10~30% · ₩{KRW.toLocaleString()}/USD</p>
        </div>
      </div>
    </div>
  );
}
