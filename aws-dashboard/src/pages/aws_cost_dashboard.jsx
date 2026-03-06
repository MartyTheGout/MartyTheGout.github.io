import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from "recharts";

const KRW = 1450;

const formatKRW = (v) => {
  if (v >= 1000000) return `${(v / 10000).toFixed(0)}만원`;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만원`;
  return `${v.toLocaleString()}원`;
};

const formatKRWFull = (v) => `₩${Math.round(v).toLocaleString()}`;

// ── Raw cost data (USD) ──
const MONTHS = Array.from({ length: 10 }, (_, i) => i + 1);
const NEW_DEVICES = 20;
const VIDEOS_PER_DEVICE = 300;
const VIDEO_SIZE_MB = 20;
const ACCOUNTS_PER_DEVICE = 10;

function buildGrowthModel() {
  let cumDevices = 0, cumUsers = 0, cumStorageGB = 0, cumVideos = 0;
  return MONTHS.map((m) => {
    cumDevices += NEW_DEVICES;
    cumUsers += NEW_DEVICES * ACCOUNTS_PER_DEVICE;
    const newStorageGB = NEW_DEVICES * VIDEOS_PER_DEVICE * VIDEO_SIZE_MB / 1000;
    cumStorageGB += newStorageGB;
    cumVideos += NEW_DEVICES * VIDEOS_PER_DEVICE;
    const monthlyTransferGB = cumUsers * 3 * 22 * 20 / 1000;
    return { month: `M${m}`, m, cumDevices, cumUsers, newStorageGB, cumStorageGB, cumVideos, monthlyTransferGB };
  });
}

const S3_CLASSES = [
  { name: "S3 Standard", storage: 0.023, retrieval: 0, color: "#2563EB", shortName: "Standard" },
  { name: "S3 Intelligent-Tiering", storage: 0.023, retrieval: 0, color: "#7C3AED", shortName: "Intelligent" },
  { name: "S3 Standard-IA", storage: 0.0125, retrieval: 0.01, color: "#0891B2", shortName: "Std-IA" },
  { name: "S3 One Zone-IA", storage: 0.01, retrieval: 0.01, color: "#059669", shortName: "1Z-IA" },
  { name: "Glacier Instant", storage: 0.004, retrieval: 0.03, color: "#D97706", shortName: "Glacier Inst" },
  { name: "Glacier Flexible", storage: 0.0036, retrieval: 0.01, color: "#DC2626", shortName: "Glacier Flex" },
  { name: "Glacier Deep Archive", storage: 0.00099, retrieval: 0.02, color: "#4B5563", shortName: "Deep Archive" },
];

function computeInfraCosts(growth) {
  const taskCounts = [2, 2, 2, 3, 3, 3, 4, 4, 4, 4];
  return growth.map((g, i) => {
    const ecsFargate = taskCounts[i] * (0.04048 + 2 * 0.004445) * 730;
    const alb = 0.0225 * 730 + (i + 1) * 1.5;
    const aurora = 0.26 * 730;
    const auroraStorageIO = (i + 1) * 20 * 0.5 * 0.10 + (i + 1) * 5;
    const cloudfront = g.monthlyTransferGB * 0.085;
    const misc = 20 + (i + 1) * 2;
    const infraTotal = ecsFargate + alb + aurora + auroraStorageIO + cloudfront + misc;
    return { month: g.month, m: g.m, ecsFargate, alb, aurora, auroraStorageIO, cloudfront, misc, infraTotal };
  });
}

function computeS3Costs(growth) {
  return S3_CLASSES.map((cls) => ({
    ...cls,
    monthly: growth.map((g) => {
      const storageCost = g.cumStorageGB * cls.storage;
      const retrievalCost = g.monthlyTransferGB * cls.retrieval;
      return { month: g.month, m: g.m, storageCost, retrievalCost, total: storageCost + retrievalCost };
    }),
  }));
}

// ── Palette ──
const INFRA_COLORS = {
  ecsFargate: "#3B82F6",
  alb: "#8B5CF6",
  aurora: "#F59E0B",
  auroraStorageIO: "#F97316",
  cloudfront: "#10B981",
  misc: "#94A3B8",
};

const INFRA_LABELS = {
  ecsFargate: "ECS Fargate",
  alb: "ALB 로드밸런서",
  aurora: "Aurora MySQL",
  auroraStorageIO: "Aurora 스토리지/IO",
  cloudfront: "CloudFront CDN",
  misc: "기타 (ECR 등)",
};

// ── Custom Tooltip ──
function KRWTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#E2E8F0",
      backdropFilter: "blur(8px)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#F8FAFC", fontSize: 14 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatKRW(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──
export default function AWSCostDashboard() {
  const [selectedS3, setSelectedS3] = useState(0);
  const [tab, setTab] = useState("overview");

  const growth = useMemo(() => buildGrowthModel(), []);
  const infra = useMemo(() => computeInfraCosts(growth), [growth]);
  const s3All = useMemo(() => computeS3Costs(growth), [growth]);

  // Combined data for stacked bars
  const combinedData = useMemo(() =>
    infra.map((inf, i) => {
      const s3 = s3All[selectedS3].monthly[i];
      return {
        month: inf.month,
        ecsFargate: Math.round(inf.ecsFargate * KRW),
        alb: Math.round(inf.alb * KRW),
        aurora: Math.round(inf.aurora * KRW),
        auroraStorageIO: Math.round(inf.auroraStorageIO * KRW),
        cloudfront: Math.round(inf.cloudfront * KRW),
        misc: Math.round(inf.misc * KRW),
        s3: Math.round(s3.total * KRW),
        total: Math.round((inf.infraTotal + s3.total) * KRW),
      };
    }), [infra, s3All, selectedS3]);

  // S3 comparison line data
  const s3CompareData = useMemo(() =>
    MONTHS.map((_, i) => {
      const row = { month: `M${i + 1}` };
      S3_CLASSES.forEach((cls, ci) => {
        row[cls.shortName] = Math.round(s3All[ci].monthly[i].total * KRW);
      });
      return row;
    }), [s3All]);

  // Pie data for month 10
  const pieData = useMemo(() => {
    const inf = infra[9];
    const s3 = s3All[selectedS3].monthly[9];
    return [
      { name: "ECS Fargate", value: Math.round(inf.ecsFargate * KRW), color: INFRA_COLORS.ecsFargate },
      { name: "ALB", value: Math.round(inf.alb * KRW), color: INFRA_COLORS.alb },
      { name: "Aurora 인스턴스", value: Math.round(inf.aurora * KRW), color: INFRA_COLORS.aurora },
      { name: "Aurora 스토리지/IO", value: Math.round(inf.auroraStorageIO * KRW), color: INFRA_COLORS.auroraStorageIO },
      { name: "CloudFront", value: Math.round(inf.cloudfront * KRW), color: INFRA_COLORS.cloudfront },
      { name: "기타", value: Math.round(inf.misc * KRW), color: INFRA_COLORS.misc },
      { name: S3_CLASSES[selectedS3].shortName, value: Math.round(s3.total * KRW), color: S3_CLASSES[selectedS3].color },
    ];
  }, [infra, s3All, selectedS3]);

  // 10-month totals for summary
  const summaryData = useMemo(() =>
    S3_CLASSES.map((cls, ci) => {
      const s3Total = s3All[ci].monthly.reduce((sum, m) => sum + m.total, 0);
      const infraTotal = infra.reduce((sum, m) => sum + m.infraTotal, 0);
      return {
        name: cls.name,
        shortName: cls.shortName,
        color: cls.color,
        s3Total: Math.round(s3Total * KRW),
        infraTotal: Math.round(infraTotal * KRW),
        grandTotal: Math.round((s3Total + infraTotal) * KRW),
        s3Monthly: Math.round(s3Total / 10 * KRW),
        monthlyAvg: Math.round((s3Total + infraTotal) / 10 * KRW),
      };
    }).sort((a, b) => a.grandTotal - b.grandTotal), [s3All, infra]);

  // Cumulative area data
  const cumulativeData = useMemo(() => {
    let cumInfra = 0, cumS3 = 0;
    return infra.map((inf, i) => {
      const s3 = s3All[selectedS3].monthly[i];
      cumInfra += inf.infraTotal * KRW;
      cumS3 += s3.total * KRW;
      return { month: `M${i + 1}`, 인프라누적: Math.round(cumInfra), S3누적: Math.round(cumS3), 합계: Math.round(cumInfra + cumS3) };
    });
  }, [infra, s3All, selectedS3]);

  const totalMonth10 = combinedData[9]?.total || 0;
  const total10Months = combinedData.reduce((s, d) => s + d.total, 0);
  const infraTotal10 = infra.reduce((s, m) => s + m.infraTotal, 0) * KRW;
  const s3Total10 = s3All[selectedS3].monthly.reduce((s, m) => s + m.total, 0) * KRW;

  const tabs = [
    { id: "overview", label: "전체 요약" },
    { id: "breakdown", label: "서비스별 비용" },
    { id: "s3compare", label: "S3 클래스 비교" },
    { id: "growth", label: "성장 모델" },
  ];

  return (
    <div style={{
      fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif",
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
      color: "#E2E8F0", minHeight: "100vh", padding: "24px 20px",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: -0.5,
            background: "linear-gradient(135deg, #60A5FA, #A78BFA, #F472B6)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0
          }}>
            AWS 비용 분석 대시보드
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
            10개월 시뮬레이션 · 환율 ₩{KRW.toLocaleString()}/$ 기준 · S3 클래스별 비교
          </p>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "M10 월간 비용", value: formatKRW(totalMonth10), sub: `인프라 ${formatKRW(Math.round(infra[9].infraTotal * KRW))}`, accent: "#60A5FA" },
            { label: "10개월 총 비용", value: formatKRW(total10Months), sub: `월평균 ${formatKRW(Math.round(total10Months / 10))}`, accent: "#A78BFA" },
            { label: "S3 비중 (10개월)", value: `${(s3Total10 / (infraTotal10 + s3Total10) * 100).toFixed(1)}%`, sub: `${formatKRW(Math.round(s3Total10))}`, accent: "#F472B6" },
            { label: "M10 누적 유저", value: "2,000명", sub: "디바이스 200대 · 영상 60,000개", accent: "#34D399" },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: "rgba(30,41,59,0.8)", borderRadius: 12, padding: "16px 14px",
              border: `1px solid ${kpi.accent}22`, position: "relative", overflow: "hidden"
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${kpi.accent}, transparent)`
              }} />
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, fontWeight: 500 }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.accent, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* S3 Class Selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            S3 스토리지 클래스 선택
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {S3_CLASSES.map((cls, i) => (
              <button key={i} onClick={() => setSelectedS3(i)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: selectedS3 === i ? `2px solid ${cls.color}` : "1px solid rgba(255,255,255,0.1)",
                background: selectedS3 === i ? `${cls.color}22` : "rgba(30,41,59,0.6)",
                color: selectedS3 === i ? cls.color : "#94A3B8",
                transition: "all 0.2s",
              }}>{cls.shortName}</button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "rgba(30,41,59,0.6)", borderRadius: 10, padding: 3 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "none", transition: "all 0.2s",
              background: tab === t.id ? "rgba(96,165,250,0.15)" : "transparent",
              color: tab === t.id ? "#60A5FA" : "#64748B",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ TAB: Overview ═══ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Stacked Bar: Monthly Total Cost Breakdown */}
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>월별 서비스 비용 구성</h3>
              <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
                선택된 S3: <span style={{ color: S3_CLASSES[selectedS3].color, fontWeight: 600 }}>{S3_CLASSES[selectedS3].name}</span>
              </p>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={combinedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip content={<KRWTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="ecsFargate" name="ECS Fargate" stackId="a" fill={INFRA_COLORS.ecsFargate} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="alb" name="ALB" stackId="a" fill={INFRA_COLORS.alb} />
                  <Bar dataKey="aurora" name="Aurora" stackId="a" fill={INFRA_COLORS.aurora} />
                  <Bar dataKey="auroraStorageIO" name="Aurora IO" stackId="a" fill={INFRA_COLORS.auroraStorageIO} />
                  <Bar dataKey="cloudfront" name="CloudFront" stackId="a" fill={INFRA_COLORS.cloudfront} />
                  <Bar dataKey="misc" name="기타" stackId="a" fill={INFRA_COLORS.misc} />
                  <Bar dataKey="s3" name="S3 스토리지" stackId="a" fill={S3_CLASSES[selectedS3].color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart + Cumulative Area */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>M10 비용 비율</h3>
                <p style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>10개월차 월간 비용 구성비</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                      paddingAngle={2} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatKRWFull(v)} contentStyle={{
                      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, fontSize: 12, color: "#E2E8F0"
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center" }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94A3B8" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} {(d.value / pieData.reduce((s, p) => s + p.value, 0) * 100).toFixed(0)}%
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>누적 비용 추이</h3>
                <p style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>10개월간 비용 누적</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradInfra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradS3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F472B6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#F472B6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip content={<KRWTooltip />} />
                    <Area type="monotone" dataKey="인프라누적" name="인프라 누적" stroke="#3B82F6" fill="url(#gradInfra)" strokeWidth={2} />
                    <Area type="monotone" dataKey="S3누적" name="S3 누적" stroke="#F472B6" fill="url(#gradS3)" strokeWidth={2} />
                    <Line type="monotone" dataKey="합계" name="합계" stroke="#F8FAFC" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Breakdown ═══ */}
        {tab === "breakdown" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#F8FAFC" }}>서비스별 월간 비용 추이</h3>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={combinedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip content={<KRWTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Object.entries(INFRA_COLORS).map(([key, color]) => (
                    <Line key={key} type="monotone" dataKey={key} name={INFRA_LABELS[key]} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                  <Line type="monotone" dataKey="s3" name="S3" stroke={S3_CLASSES[selectedS3].color} strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Service cost table */}
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#F8FAFC" }}>M10 기준 서비스별 비용 상세 (원/월)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#94A3B8", fontWeight: 600 }}>서비스</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#94A3B8", fontWeight: 600 }}>월 비용</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#94A3B8", fontWeight: 600 }}>비율</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#94A3B8", fontWeight: 600, width: 160 }}>시각화</th>
                  </tr>
                </thead>
                <tbody>
                  {pieData.sort((a, b) => b.value - a.value).map((item, i) => {
                    const pct = item.value / pieData.reduce((s, p) => s + p.value, 0) * 100;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block", flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {formatKRWFull(item.value)}
                        </td>
                        <td style={{ textAlign: "right", padding: "10px 12px", color: "#94A3B8" }}>{pct.toFixed(1)}%</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: item.color, borderRadius: 3, transition: "width 0.5s" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#F8FAFC" }}>합계</td>
                    <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 800, color: "#60A5FA", fontSize: 14 }}>
                      {formatKRWFull(totalMonth10)}
                    </td>
                    <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>100%</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: S3 Compare ═══ */}
        {tab === "s3compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>S3 클래스별 월간 비용 추이 (저장+검색)</h3>
              <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>검색(retrieval) 비용 포함 — Glacier Instant가 가장 비싼 이유</p>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={s3CompareData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip content={<KRWTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {S3_CLASSES.map((cls) => (
                    <Line key={cls.shortName} type="monotone" dataKey={cls.shortName} name={cls.shortName}
                      stroke={cls.color} strokeWidth={2} dot={{ r: 2.5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* S3 Summary Ranking Table */}
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#F8FAFC" }}>10개월 총 비용 순위 (S3 포함 전체)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ textAlign: "center", padding: "8px 6px", color: "#94A3B8", width: 36 }}>#</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#94A3B8" }}>S3 클래스</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#94A3B8" }}>S3 비용 (10개월)</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#94A3B8" }}>전체 비용 (10개월)</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#94A3B8" }}>월평균</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i === 0 ? "rgba(52,211,153,0.08)" : i === summaryData.length - 1 ? "rgba(239,68,68,0.06)" : "transparent"
                    }}>
                      <td style={{ textAlign: "center", padding: "10px 6px", fontWeight: 700, color: i === 0 ? "#34D399" : "#64748B" }}>
                        {i === 0 ? "🏆" : i + 1}
                      </td>
                      <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, display: "inline-block" }} />
                        <span style={{ fontWeight: 600, color: i === 0 ? "#34D399" : "#E2E8F0" }}>{row.name}</span>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                        {formatKRWFull(row.s3Total)}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: i === 0 ? "#34D399" : "#F8FAFC" }}>
                        {formatKRWFull(row.grandTotal)}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>
                        {formatKRWFull(row.monthlyAvg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 8,
                background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", fontSize: 12, lineHeight: 1.6
              }}>
                <strong style={{ color: "#34D399" }}>💡 핵심 인사이트:</strong>
                <span style={{ color: "#94A3B8" }}> 영상을 자주 조회하는 이 시나리오에서는 </span>
                <strong style={{ color: "#F8FAFC" }}>S3 Standard가 가장 경제적</strong>
                <span style={{ color: "#94A3B8" }}>입니다. Glacier 계열은 저장 비용은 저렴하지만 검색(retrieval) 비용이 누적되어 오히려 비쌉니다. </span>
                <strong style={{ color: "#F472B6" }}>하이브리드 전략</strong>
                <span style={{ color: "#94A3B8" }}> (최근 90일 Standard → 이후 Standard-IA → 1년 후 Glacier)이 최적입니다.</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Growth ═══ */}
        {tab === "growth" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#F8FAFC" }}>누적 성장 지표</h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={growth.map(g => ({
                  ...g,
                  cumStorageTB: +(g.cumStorageGB / 1000).toFixed(2),
                  transferGB: g.monthlyTransferGB,
                }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#E2E8F0" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="cumUsers" name="누적 유저" fill="#60A5FA" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Line yAxisId="right" type="monotone" dataKey="cumStorageGB" name="누적 저장량(GB)" stroke="#F472B6" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="transferGB" name="월 전송량(GB)" stroke="#34D399" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#F8FAFC" }}>월별 상세 수치</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["월", "신규 디바이스", "누적 디바이스", "누적 유저", "신규 저장(GB)", "누적 저장(GB)", "월 전송(GB)", "누적 영상"].map(h => (
                      <th key={h} style={{ padding: "8px 6px", color: "#94A3B8", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growth.map((g, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "6px 6px", fontWeight: 600, textAlign: "right" }}>{g.month}</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#60A5FA" }}>{NEW_DEVICES}</td>
                      <td style={{ textAlign: "right", padding: "6px" }}>{g.cumDevices}</td>
                      <td style={{ textAlign: "right", padding: "6px", fontWeight: 600 }}>{g.cumUsers.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#F472B6" }}>{g.newStorageGB}</td>
                      <td style={{ textAlign: "right", padding: "6px", fontWeight: 600 }}>{g.cumStorageGB.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#34D399" }}>{g.monthlyTransferGB.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px" }}>{g.cumVideos.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#475569" }}>
            AWS 비용 시뮬레이션 · US East 리전 기준 · 서울 리전 사용 시 10~30% 추가 · 환율 ₩{KRW.toLocaleString()}/USD · {new Date().toLocaleDateString("ko-KR")} 기준
          </p>
        </div>
      </div>
    </div>
  );
}
