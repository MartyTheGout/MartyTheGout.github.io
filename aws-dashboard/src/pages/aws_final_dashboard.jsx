import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Line
} from "recharts";

const KRW=1450, MC_RATE=0.015, VID_MIN=0.5;
const fk=v=>{if(v>=100000000)return`${(v/1e8).toFixed(1)}억`;if(v>=10000)return`${Math.round(v/10000)}만원`;return`${Math.round(v).toLocaleString()}원`};
const fkf=v=>`₩${Math.round(v).toLocaleString()}`;

const S3C=[
  {name:"S3 Standard",sp:0.023,rp:0,color:"#3B82F6",short:"Standard"},
  {name:"Intelligent-Tiering",sp:0.023,rp:0,color:"#8B5CF6",short:"Intelligent"},
  {name:"S3 Standard-IA",sp:0.0125,rp:0.01,color:"#0891B2",short:"Std-IA"},
  {name:"S3 One Zone-IA",sp:0.01,rp:0.01,color:"#059669",short:"1Z-IA"},
  {name:"Glacier Instant",sp:0.004,rp:0.03,color:"#D97706",short:"Glacier Inst"},
  {name:"Glacier Flexible",sp:0.0036,rp:0.01,color:"#DC2626",short:"Glacier Flex"},
  {name:"Glacier Deep Archive",sp:0.00099,rp:0.02,color:"#6B7280",short:"Deep Archive"},
];
const VIEWS=[3,20,50];
const DLVR=[
  {name:"원본 전송",mb:20,tc:false,color:"#EF4444",icon:"📹"},
  {name:"압축 전송",mb:5,tc:true,color:"#3B82F6",icon:"🗜️"},
  {name:"썸네일+온디맨드",mb:2,tc:true,color:"#10B981",icon:"🖼️"},
];
const IL={ecs:"ECS Fargate",alb:"ALB",aurora:"Aurora",aio:"Aurora IO",cf:"CloudFront",misc:"기타",mc:"MediaConvert"};
const IC={ecs:"#3B82F6",alb:"#8B5CF6",aurora:"#F59E0B",aio:"#F97316",cf:"#10B981",misc:"#94A3B8",mc:"#A855F7"};

function build(vpd,mb,tc){
  const tcs=[2,2,2,3,3,3,4,4,4,4];let cu=0,cs=0;
  return Array.from({length:10},(_,i)=>{
    cu+=200;cs+=120;const nv=6000;
    const mc=tc?nv*VID_MIN*MC_RATE:0;
    const tcSt=tc?(i+1)*nv*mb/1000:0;
    const tf=cu*vpd*22*mb/1000;
    const ts=cs+tcSt;
    const ecs=tcs[i]*(0.04048+2*0.004445)*730;
    const alb=0.0225*730+(i+1)*1.5;
    const aurora=0.26*730;
    const aio=(i+1)*20*0.5*0.10+(i+1)*5;
    const cf=tf*0.085;const misc=20+(i+1)*2;
    const inf=ecs+alb+aurora+aio+cf+misc+mc;
    const s3=S3C.map(c=>({total:ts*c.sp+tf*c.rp,store:ts*c.sp,ret:tf*c.rp}));
    return{m:i+1,month:`M${i+1}`,cu,cs,tf,ts,ecs,alb,aurora,aio,cf,misc,mc,inf,s3};
  });
}

function TT({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(<div style={{background:"rgba(6,8,16,0.97)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#CBD5E1",boxShadow:"0 12px 40px rgba(0,0,0,0.5)"}}>
    <div style={{fontWeight:700,marginBottom:6,color:"#F1F5F9",fontSize:13}}>{label}</div>
    {payload.map((p,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:2}}>
      <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:7,height:7,borderRadius:2,background:p.color,display:"inline-block"}}/>{p.name}</span>
      <span style={{fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{fk(p.value)}</span>
    </div>))}
  </div>);
}

const Card=({children,glow,style})=>(
  <div style={{background:"rgba(16,20,32,0.8)",borderRadius:14,padding:"18px 14px",border:`1px solid ${glow||"rgba(255,255,255,0.04)"}`,backdropFilter:"blur(4px)",...style}}>{children}</div>
);

export default function App(){
  const[tab,setTab]=useState("roi");
  const[vpd,setVpd]=useState(20);
  const[dlvr,setDlvr]=useState(1);
  const[selS3,setSelS3]=useState(0);

  const md=useMemo(()=>build(vpd,DLVR[dlvr].mb,DLVR[dlvr].tc),[vpd,dlvr]);
  const mdOrig=useMemo(()=>build(vpd,20,false),[vpd]);

  const total10=useMemo(()=>md.reduce((s,m)=>s+m.inf+m.s3[selS3].total,0)*KRW,[md,selS3]);
  const origTotal10=useMemo(()=>mdOrig.reduce((s,m)=>s+m.inf+m.s3[selS3].total,0)*KRW,[mdOrig,selS3]);
  const mc10=useMemo(()=>md.reduce((s,m)=>s+m.mc,0)*KRW,[md]);
  const cf10=useMemo(()=>md.reduce((s,m)=>s+m.cf,0)*KRW,[md]);
  const cfOrig10=useMemo(()=>mdOrig.reduce((s,m)=>s+m.cf,0)*KRW,[mdOrig]);
  const savings=origTotal10-total10;

  // Pie M10
  const pie10=useMemo(()=>{
    const d=md[9]; const keys=["ecs","alb","aurora","aio","cf","misc","mc"];
    return[...keys.map(k=>({name:IL[k],value:Math.round(d[k]*KRW),color:IC[k]})),
      {name:`S3`,value:Math.round(d.s3[selS3].total*KRW),color:S3C[selS3].color}];
  },[md,selS3]);

  // Cross delivery comparison
  const crossDlvr=useMemo(()=>DLVR.map((dl,di)=>{
    const m=build(vpd,dl.mb,dl.tc);
    const t=m.reduce((s,r)=>s+r.inf+r.s3[selS3].total,0)*KRW;
    const cfv=m.reduce((s,r)=>s+r.cf,0)*KRW;
    const mcv=m.reduce((s,r)=>s+r.mc,0)*KRW;
    const s3v=m.reduce((s,r)=>s+r.s3[selS3].total,0)*KRW;
    const infra=t-cfv-mcv-s3v;
    return{name:dl.name,mb:dl.mb,color:dl.color,total:t,cf:cfv,mc:mcv,s3:s3v,infra,icon:dl.icon};
  }),[vpd,selS3]);

  // Monthly stacked
  const monthlyStack=useMemo(()=>md.map(d=>{
    const keys=["ecs","alb","aurora","aio","cf","misc","mc"];
    const obj={month:d.month};
    keys.forEach(k=>{obj[IL[k]]=Math.round(d[k]*KRW)});
    obj["S3"]=Math.round(d.s3[selS3].total*KRW);
    return obj;
  }),[md,selS3]);

  // Matrix
  const matrix=useMemo(()=>VIEWS.map(v=>({vpd:v,
    data:DLVR.map(dl=>{const m=build(v,dl.mb,dl.tc);return m.reduce((s,r)=>s+r.inf+r.s3[selS3].total,0)*KRW})
  })),[selS3]);

  const cfPct=useMemo(()=>{const d=md[9];const t=d.inf+d.s3[selS3].total;return t?d.cf/t*100:0},[md,selS3]);

  const tabs=[
    {id:"roi",label:"💰 ROI 분석"},
    {id:"compare",label:"📊 전달방식 비교"},
    {id:"matrix",label:"🔢 비용 매트릭스"},
    {id:"monthly",label:"📈 월별 상세"},
  ];

  return(
    <div style={{fontFamily:"'Pretendard','Noto Sans KR',-apple-system,sans-serif",background:"linear-gradient(165deg,#04060C 0%,#0A0F1C 40%,#060810 100%)",color:"#E2E8F0",minHeight:"100vh",padding:"20px 16px"}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <h1 style={{fontSize:22,fontWeight:800,margin:0,letterSpacing:-0.5,background:"linear-gradient(135deg,#A78BFA,#60A5FA,#34D399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          AWS 비용 분석 — 트랜스코딩 ROI 포함
        </h1>
        <p style={{color:"#334155",fontSize:12,margin:"4px 0 20px"}}>
          MediaConvert 투자 효과 · 조회빈도 × 전달방식 × S3 클래스 · ₩{KRW.toLocaleString()}/USD
        </p>

        {/* Controls */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
          <div>
            <div style={{fontSize:10,color:"#334155",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>조회 빈도</div>
            <div style={{display:"flex",gap:4}}>
              {VIEWS.map(v=>(
                <button key={v} onClick={()=>setVpd(v)} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",border:vpd===v?"2px solid #60A5FA":"1px solid rgba(255,255,255,0.05)",background:vpd===v?"rgba(96,165,250,0.1)":"rgba(16,20,32,0.6)",color:vpd===v?"#60A5FA":"#334155",transition:"all 0.15s"}}>{v}회/일</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:10,color:"#334155",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>전달 방식</div>
            <div style={{display:"flex",gap:4}}>
              {DLVR.map((d,i)=>(
                <button key={i} onClick={()=>setDlvr(i)} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:dlvr===i?`2px solid ${d.color}`:"1px solid rgba(255,255,255,0.05)",background:dlvr===i?`${d.color}12`:"rgba(16,20,32,0.6)",color:dlvr===i?d.color:"#334155",transition:"all 0.15s",lineHeight:1.2}}>{d.icon} {d.mb}MB</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:10,color:"#334155",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>S3 클래스</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {S3C.map((c,i)=>(
                <button key={i} onClick={()=>setSelS3(i)} style={{padding:"3px 7px",borderRadius:10,fontSize:10,fontWeight:600,cursor:"pointer",border:selS3===i?`2px solid ${c.color}`:"1px solid rgba(255,255,255,0.05)",background:selS3===i?`${c.color}15`:"transparent",color:selS3===i?c.color:"#334155",transition:"all 0.15s"}}>{c.short}</button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
          {[
            {label:"10개월 총비용",value:fk(total10),sub:`월평균 ${fk(total10/10)}`,accent:"#60A5FA"},
            {label:"원본 대비 절감",value:savings>0?`↓${fk(savings)}`:"—",sub:savings>0?`${(savings/origTotal10*100).toFixed(0)}% 절감`:"원본 전송 중",accent:savings>0?"#34D399":"#475569"},
            {label:"MC 투자 ROI",value:mc10>0?`${Math.round((cfOrig10-cf10)/mc10)}x`:"—",sub:mc10>0?`₩${Math.round(mc10/10000)}만 투자`:"트랜스코딩 미적용",accent:mc10>0?"#A78BFA":"#475569"},
            {label:"CloudFront 비중",value:`${cfPct.toFixed(0)}%`,sub:cfPct>40?"⚠️ 전송 비용 과다":"전송 비용 적정",accent:cfPct>40?"#EF4444":"#10B981"},
          ].map((k,i)=>(
            <div key={i} style={{background:"rgba(16,20,32,0.8)",borderRadius:10,padding:"12px",border:`1px solid ${k.accent}15`,position:"relative"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${k.accent}80,transparent)`}}/>
              <div style={{fontSize:10,color:"#334155",marginBottom:3}}>{k.label}</div>
              <div style={{fontSize:18,fontWeight:800,color:k.accent}}>{k.value}</div>
              <div style={{fontSize:10,color:"#1E293B",marginTop:2}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:2,marginBottom:18,background:"rgba(16,20,32,0.6)",borderRadius:10,padding:3}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:tab===t.id?"rgba(96,165,250,0.08)":"transparent",color:tab===t.id?"#60A5FA":"#1E293B",transition:"all 0.15s"}}>{t.label}</button>
          ))}
        </div>

        {/* ═══ ROI ═══ */}
        {tab==="roi"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <Card glow="rgba(168,85,247,0.3)">
              <div style={{fontSize:15,fontWeight:800,color:"#A855F7",marginBottom:10}}>🎯 트랜스코딩 투자 대비 효과 (20회/일, S3 Standard)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                {crossDlvr.map((d,i)=>{
                  const save=crossDlvr[0].total-d.total;
                  const roi=d.mc>0?(crossDlvr[0].cf-d.cf)/d.mc:0;
                  return(
                    <div key={i} style={{background:`rgba(255,255,255,0.02)`,borderRadius:12,padding:"16px",border:`1px solid ${d.color}20`,position:"relative"}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${d.color},transparent)`}}/>
                      <div style={{fontSize:22,marginBottom:4}}>{d.icon}</div>
                      <div style={{fontSize:13,fontWeight:700,color:d.color}}>{d.name}</div>
                      <div style={{fontSize:10,color:"#475569",marginBottom:10}}>{d.mb}MB/조회</div>

                      <div style={{fontSize:22,fontWeight:800,color:"#F1F5F9"}}>{fk(d.total)}</div>
                      <div style={{fontSize:10,color:"#334155",marginBottom:8}}>10개월 총비용</div>

                      {d.mc>0&&(
                        <div style={{borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8,marginTop:4}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                            <span style={{color:"#A855F7"}}>MC 투자</span>
                            <span style={{color:"#A855F7",fontWeight:600}}>{fk(d.mc)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                            <span style={{color:"#34D399"}}>절감액</span>
                            <span style={{color:"#34D399",fontWeight:700}}>↓{fk(save)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                            <span style={{color:"#FBBF24"}}>ROI</span>
                            <span style={{color:"#FBBF24",fontWeight:800,fontSize:14}}>{roi.toFixed(0)}x</span>
                          </div>
                        </div>
                      )}
                      {i===0&&(<div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.12)",fontSize:10,color:"#F87171"}}>CF 비용 67% — 최적화 필요</div>)}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Horizontal stacked bar comparison */}
            <Card>
              <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:2}}>비용 구성 비교</h3>
              <p style={{fontSize:11,color:"#334155",marginBottom:14}}>인프라(고정) + CloudFront(전송) + MediaConvert + S3</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={crossDlvr.map(d=>({name:`${d.icon} ${d.name}`,인프라:Math.round(d.infra),CloudFront:Math.round(d.cf),MediaConvert:Math.round(d.mc),S3:Math.round(d.s3)}))} layout="vertical" margin={{top:4,right:8,left:8,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis type="number" tick={{fill:"#475569",fontSize:10}} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <YAxis type="category" dataKey="name" tick={{fill:"#94A3B8",fontSize:11}} width={120}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="인프라" stackId="a" fill="#475569"/>
                  <Bar dataKey="CloudFront" stackId="a" fill="#10B981"/>
                  <Bar dataKey="MediaConvert" stackId="a" fill="#A855F7"/>
                  <Bar dataKey="S3" stackId="a" fill="#3B82F6" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card glow="rgba(52,211,153,0.2)" style={{background:"rgba(52,211,153,0.03)"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#34D399",marginBottom:8}}>✅ 추천 아키텍처</div>
              <div style={{fontSize:12,color:"#94A3B8",lineHeight:1.8}}>
                <strong style={{color:"#F1F5F9"}}>S3 Upload</strong>
                <span style={{color:"#475569"}}> → </span>
                <strong style={{color:"#A855F7"}}>EventBridge Trigger</strong>
                <span style={{color:"#475569"}}> → </span>
                <strong style={{color:"#A855F7"}}>MediaConvert (20MB→5MB)</strong>
                <span style={{color:"#475569"}}> → </span>
                <strong style={{color:"#3B82F6"}}>S3 Standard (압축본)</strong>
                <span style={{color:"#475569"}}> → </span>
                <strong style={{color:"#10B981"}}>CloudFront (서빙)</strong>
              </div>
              <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:11}}>
                <div style={{padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{color:"#A855F7",fontWeight:600}}>MediaConvert 비용</div>
                  <div style={{color:"#94A3B8",marginTop:2}}>₩65,250/월 (고정) · 영상당 약 ₩11</div>
                </div>
                <div style={{padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{color:"#34D399",fontWeight:600}}>S3 클래스 권장</div>
                  <div style={{color:"#94A3B8",marginTop:2}}>Standard (전체의 2~3%) + Lifecycle (1년 후 IA 전환)</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ COMPARE ═══ */}
        {tab==="compare"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card>
                <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:8}}>M10 비용 비율</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={pie10} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                    {pie10.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie>
                    <Tooltip formatter={v=>fkf(v)} contentStyle={{background:"rgba(6,8,16,0.95)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,fontSize:11,color:"#CBD5E1"}}/>
                  </PieChart></ResponsiveContainer>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  {pie10.sort((a,b)=>b.value-a.value).map((d,i)=>{
                    const t=pie10.reduce((s,p)=>s+p.value,0);const p=d.value/t*100;
                    return(<div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                      <span style={{width:8,height:8,borderRadius:2,background:d.color,flexShrink:0}}/>
                      <span style={{color:"#64748B",flex:1}}>{d.name}</span>
                      <span style={{fontWeight:600,color:"#E2E8F0",width:65,textAlign:"right"}}>{fk(d.value)}</span>
                      <span style={{color:"#334155",width:32,textAlign:"right",fontSize:10}}>{p.toFixed(0)}%</span>
                      <div style={{width:50,height:4,background:"rgba(255,255,255,0.03)",borderRadius:2}}>
                        <div style={{width:`${p}%`,height:"100%",background:d.color,borderRadius:2}}/></div>
                    </div>);
                  })}
                </div>
              </Card>
              <Card>
                <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:8}}>전달방식별 CF 비중</h3>
                {DLVR.map((dl,di)=>{
                  const m=build(vpd,dl.mb,dl.tc);const d=m[9];
                  const cfv=d.cf;const t=d.inf+d.s3[selS3].total;const p=t?cfv/t*100:0;
                  return(<div key={di} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:12}}>
                      <span style={{color:dl.color,fontWeight:600}}>{dl.icon} {dl.name} ({dl.mb}MB)</span>
                      <span style={{color:p>40?"#EF4444":"#10B981",fontWeight:700}}>{p.toFixed(0)}%</span>
                    </div>
                    <div style={{height:18,background:"rgba(255,255,255,0.02)",borderRadius:6,overflow:"hidden",display:"flex"}}>
                      <div style={{width:`${100-p}%`,background:"#1E293B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#475569"}}>인프라+MC+S3</div>
                      <div style={{width:`${p}%`,background:p>40?"rgba(239,68,68,0.4)":"rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#F1F5F9",fontWeight:600}}>CF {p.toFixed(0)}%</div>
                    </div>
                  </div>);
                })}
                <div style={{marginTop:8,padding:"10px",borderRadius:6,background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.1)",fontSize:11,color:"#94A3B8",lineHeight:1.6}}>
                  <strong style={{color:"#A855F7"}}>MediaConvert 효과:</strong> 5MB 압축 시 CF 비중 67%→31%. 투자 대비 14배 절감.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ MATRIX ═══ */}
        {tab==="matrix"&&(
          <Card>
            <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:2}}>비용 히트맵 ({S3C[selS3].short})</h3>
            <p style={{fontSize:11,color:"#334155",marginBottom:14}}>조회빈도 × 전달방식 · MC 비용 포함</p>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <th style={{padding:"8px",color:"#475569",textAlign:"left"}}></th>
                {DLVR.map((d,i)=>(<th key={i} style={{padding:"8px 12px",color:d.color,fontWeight:700,textAlign:"right"}}>{d.icon} {d.name}<br/><span style={{fontWeight:400,fontSize:10}}>({d.mb}MB{d.tc?" +MC":""})</span></th>))}
              </tr></thead>
              <tbody>
                {matrix.map((row,ri)=>{
                  const min=Math.min(...matrix.flatMap(r=>r.data));
                  const max=Math.max(...matrix.flatMap(r=>r.data));
                  return(<tr key={ri} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",background:row.vpd===vpd?"rgba(96,165,250,0.04)":"transparent"}}>
                    <td style={{padding:"10px",fontWeight:700,color:row.vpd===vpd?"#60A5FA":"#64748B"}}>{row.vpd}회/일{row.vpd===vpd?" ◀":""}</td>
                    {row.data.map((v,ci)=>{
                      const int=(v-min)/(max-min||1);
                      return(<td key={ci} style={{textAlign:"right",padding:"10px 12px",fontWeight:600,fontVariantNumeric:"tabular-nums",background:`rgba(239,68,68,${int*0.1})`,color:int>0.5?"#FCA5A5":"#E2E8F0"}}>
                        {fkf(v)}<div style={{fontSize:9,color:"#475569",fontWeight:400}}>월 {fk(v/10)}</div>
                      </td>);
                    })}
                  </tr>);
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* ═══ MONTHLY ═══ */}
        {tab==="monthly"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <Card>
              <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:2}}>월별 비용 구성</h3>
              <p style={{fontSize:11,color:"#334155",marginBottom:14}}>{vpd}회/일 · {DLVR[dlvr].name} · {S3C[selS3].short}</p>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={monthlyStack} margin={{top:8,right:8,left:8,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis dataKey="month" tick={{fill:"#64748B",fontSize:11}}/>
                  <YAxis tick={{fill:"#475569",fontSize:10}} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
                  <Tooltip content={<TT/>}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  {["ecs","alb","aurora","aio","cf","misc","mc"].map(k=><Bar key={k} dataKey={IL[k]} stackId="a" fill={IC[k]}/>)}
                  <Bar dataKey="S3" stackId="a" fill={S3C[selS3].color} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:14}}>월별 수치</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                    {["월","유저","저장(GB)","전송(GB)","인프라","CF","MC","S3","합계"].map(h=>(
                      <th key={h} style={{padding:"6px",color:"#334155",fontWeight:600,textAlign:"right"}}>{h}</th>))}
                  </tr></thead>
                  <tbody>{md.map((d,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <td style={{textAlign:"right",padding:"5px",fontWeight:600}}>{d.month}</td>
                      <td style={{textAlign:"right",padding:"5px"}}>{d.cu.toLocaleString()}</td>
                      <td style={{textAlign:"right",padding:"5px"}}>{Math.round(d.ts).toLocaleString()}</td>
                      <td style={{textAlign:"right",padding:"5px",color:"#FBBF24"}}>{Math.round(d.tf).toLocaleString()}</td>
                      <td style={{textAlign:"right",padding:"5px"}}>{fk(Math.round((d.inf-d.cf-d.mc)*KRW))}</td>
                      <td style={{textAlign:"right",padding:"5px",color:"#10B981"}}>{fk(Math.round(d.cf*KRW))}</td>
                      <td style={{textAlign:"right",padding:"5px",color:"#A855F7"}}>{fk(Math.round(d.mc*KRW))}</td>
                      <td style={{textAlign:"right",padding:"5px",color:S3C[selS3].color}}>{fk(Math.round(d.s3[selS3].total*KRW))}</td>
                      <td style={{textAlign:"right",padding:"5px",fontWeight:700}}>{fk(Math.round((d.inf+d.s3[selS3].total)*KRW))}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        <div style={{marginTop:24,padding:"12px 0",borderTop:"1px solid rgba(255,255,255,0.02)",textAlign:"center"}}>
          <p style={{fontSize:9,color:"#0F172A"}}>AWS 비용 시뮬레이션 · US East 기준 · 서울 리전 +10~30% · ₩{KRW.toLocaleString()}/USD · MC Basic HD $0.015/min</p>
        </div>
      </div>
    </div>
  );
}
