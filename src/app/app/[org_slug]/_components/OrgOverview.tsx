"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useState, useEffect } from "react";
import {
  Activity,
  Boxes,
  ShieldAlert,
  KeyRound,
  Lock,
  AlertTriangle,
  Loader2,
  Calendar,
  LockKeyhole,
  Clock,
  ChevronRight
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface OrgOverviewProps {
  org: any;
  isAdmin: boolean;
}

export default function OrgOverview({ org, isAdmin }: OrgOverviewProps) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/overview?orgId=${org.id}&days=${days}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (mounted) setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchOverview();
    return () => { mounted = false; };
  }, [org.id, days]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-4" />
        <p className="text-sm font-semibold text-[#8a5d33]/70 font-mono">Compiling Security Intelligence...</p>
      </div>
    );
  }

  if (!data) return null;



  return (
    <div className="h-full flex flex-col space-y-5 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-10">
      
      {/* Top Header / Filter */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 shrink-0 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-5 shadow-sm ring-1 ring-amber-500/10">
        <div>
          <h1 className="text-2xl font-bold text-[#3d200a] tracking-tight">Security Overview</h1>
          <p className="text-sm font-semibold text-[#8a5d33]/70 mt-1">Real-time intelligence based on latest raw PySSL analysis</p>
        </div>
        <div className="flex items-center gap-3 bg-white/60 p-1.5 rounded-xl border border-[#8a5d33]/20 shadow-sm shrink-0">
          <Clock className="w-4 h-4 text-[#8a5d33] ml-2 shrink-0" />
          <select 
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer pr-2 border-none ring-0 placeholder-gray-400"
          >
            <option value={7}>Last 7 Days</option>
            <option value={15}>Last 15 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>All Time</option>
          </select>
        </div>
      </div>

      {loading && data && (
        <div className="absolute top-0 right-0 m-4 flex items-center justify-center bg-white/80 p-2 rounded-full shadow-md z-50">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
        </div>
      )}

      {/* Top metrics grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 shrink-0">
        {[
          { title: "Scanned TLS Assets", value: data.totalScanned, icon: Boxes, tone: "text-blue-700", bg: "from-blue-100 to-white", brdColor: "border-blue-200" },
          { title: "Strong Ciphers Confirmed", value: data.strongCipherCount, icon: ShieldAlert, tone: "text-emerald-700", bg: "from-emerald-100 to-white", brdColor: "border-emerald-200" },
          { title: "Certificates Expiring (<30d)", value: data.closeDeadlineCerts, icon: Calendar, tone: "text-amber-700", bg: "from-amber-100 to-white", brdColor: "border-amber-200" },
          { title: "Critical Expirations", value: data.expiredCerts, icon: AlertTriangle, tone: "text-red-700", bg: "from-red-100 to-white", brdColor: "border-red-200" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.title} className={`rounded-3xl border ${metric.brdColor} bg-white/70 backdrop-blur p-5 shadow-sm`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-[#8a5d33]/70">{metric.title}</p>
                <div className={`rounded-xl bg-linear-to-br ${metric.bg} p-2 shadow-sm border ${metric.brdColor} ${metric.tone}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className={`mt-4 text-3xl font-bold tracking-tight ${metric.tone}`}>{metric.value}</p>
            </article>
          );
        })}
      </section>

      {/* Main Analysis grid */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3 items-start shrink-0">
        {/* Column 1: Key Geometry + TLS Allocation stacked */}
        <div className="col-span-1 space-y-4">
          {/* Public Key Geometry */}
          <article className="rounded-3xl border border-amber-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-[#3d200a]">Public Key Geometry</h2>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-4">Distribution of Key Lengths & Algorithms</p>
            
            <div className="flex-1 flex flex-col items-center justify-center min-h-0">
             {data.keySizeChartData?.length > 0 ? (
               <>
                 <div className="w-full" style={{ height: Math.max(120, data.keySizeChartData.length * 52 + 30) }}>
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={data.keySizeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f59e0b" strokeOpacity={0.1} horizontal={false} />
                        <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                        <YAxis 
                          dataKey="name" type="category" tickLine={false} axisLine={false} width={100}
                          tick={(props: any) => {
                            const { x, y, payload } = props;
                            return (
                              <text
                                x={x} y={y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize={11}
                                fontWeight={700}
                                fill="#4f46e5"
                                style={{ cursor: "pointer" }}
                                onClick={() => router.push(`/app/${org.slug}/explore?keySize=${encodeURIComponent(payload.value)}`)}
                                onMouseEnter={(e) => { (e.target as SVGTextElement).style.textDecoration = "underline"; }}
                                onMouseLeave={(e) => { (e.target as SVGTextElement).style.textDecoration = "none"; }}
                              >
                                {payload.value}
                              </text>
                            );
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(139,0,0,0.05)' }}
                          contentStyle={{ background: "#ffffff", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700, color: "#3d200a" }}
                          formatter={(v: number) => [v, "Assets"]}
                        />
                        <Bar 
                          dataKey="value" radius={[0, 8, 8, 0]} barSize={28} fill="#4f46e5" 
                          className="cursor-pointer"
                          onClick={(entry: any) => {
                            if (entry?.name) {
                              router.push(`/app/${org.slug}/explore?keySize=${encodeURIComponent(entry.name)}`);
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
                 <p className="text-[10px] text-[#8a5d33]/50 font-bold mt-2">NIST recommends min. 2048-bit RSA or 256-bit ECC</p>
               </>
             ) : (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <LockKeyhole className="w-8 h-8 text-indigo-500/30 mb-2" />
                  <p className="text-sm font-semibold text-[#8a5d33]/50">No key geometry mapped yet</p>
                </div>
             )}
            </div>
          </article>

          {/* TLS Version Allocation */}
          <article className="rounded-3xl border border-amber-500/20 bg-white/60 backdrop-blur p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-[#3d200a]">TLS Version Allocation</h2>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-4">Protocol Distribution</p>
            
            <div style={{ height: Math.max(100, (data.tlsChartData?.length || 1) * 44 + 30) }}>
               {data.tlsChartData?.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data.tlsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f59e0b" strokeOpacity={0.1} horizontal={false} />
                      <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                      <YAxis 
                        dataKey="name" type="category" tickLine={false} axisLine={false} width={80}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          return (
                            <text
                              x={x} y={y}
                              textAnchor="end"
                              dominantBaseline="middle"
                              fontSize={11}
                              fontWeight={700}
                              fill="#8B0000"
                              style={{ cursor: "pointer" }}
                              onClick={() => router.push(`/app/${org.slug}/explore?tls=${encodeURIComponent(payload.value)}`)}
                              onMouseEnter={(e) => { (e.target as SVGTextElement).style.textDecoration = "underline"; }}
                              onMouseLeave={(e) => { (e.target as SVGTextElement).style.textDecoration = "none"; }}
                            >
                              {payload.value}
                            </text>
                          );
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(139,0,0,0.05)' }}
                        contentStyle={{ background: "#ffffff", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700, color: "#3d200a" }}
                      />
                      <Bar 
                        dataKey="value" radius={[0, 6, 6, 0]} barSize={22} fill="#8B0000"
                        className="cursor-pointer"
                        onClick={(entry: any) => {
                          if (entry?.name) {
                            router.push(`/app/${org.slug}/explore?tls=${encodeURIComponent(entry.name)}`);
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
               ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-amber-500/20 rounded-2xl">
                    <p className="text-sm font-semibold text-[#8a5d33]/50">Complete a scan to view protocol distribution</p>
                  </div>
               )}
            </div>
          </article>
        </div>

        {/* Global Posture Tier */}
        <article className="col-span-1 rounded-3xl border border-amber-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Global SSL Posture</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-6">Aggregated from raw certificates</p>
          
          <div className={`mt-auto mb-6 flex items-center justify-between rounded-2xl border ${data.tier.bg} px-6 py-5`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-3xl ${data.tier.color} bg-white shadow-sm ring-4 ring-white/50`}>
                {data.tier.grade}
              </div>
              <div>
                <p className="text-sm font-bold text-[#3d200a] tracking-tight">{data.tier.tier}</p>
                <p className={`text-base font-bold ${data.tier.color}`}>{data.tier.label}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
             <div className="flex items-center justify-between rounded-xl border border-red-500/10 bg-red-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4.5 w-4.5 text-red-600" />
                  <p className="text-xs font-bold text-[#3d200a]">TLS Downgrade Risks</p>
                </div>
                <p className={`text-sm font-bold ${data.tlsDowngradeVulnerable > 0 ? "text-red-600" : "text-emerald-600"}`}>{data.tlsDowngradeVulnerable}</p>
            </div>
             <div className="flex items-center justify-between rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                  <p className="text-xs font-bold text-[#3d200a]">Self-Signed Certificates</p>
                </div>
                <p className={`text-sm font-bold ${data.selfSignedCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>{data.selfSignedCount}</p>
            </div>
          </div>

          {/* Top Risk Assets */}
          {data.topRiskAssets && data.topRiskAssets.length > 0 && (
            <div className="mt-5 pt-5 border-t border-[#8a5d33]/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-[#8a5d33]/70 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Immediate Attention
                </h3>
                <Link href={`/app/${org.slug}/explore?filter=attention`} className="text-[10px] font-bold text-red-700 hover:text-red-800 uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 transition-colors px-2 py-0.5 rounded-full flex items-center gap-1">
                  View All
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data.topRiskAssets.map((asset: any) => (
                  <Link href={`/app/${org.slug}/asset/${asset.id}`} key={asset.id} className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-red-500/10 bg-white/50 px-3 py-2.5 hover:bg-red-500/5 hover:border-red-500/20 transition-all">
                      <div className="flex items-center gap-3 truncate pr-4">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          {asset.sortVal === -1 ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <Calendar className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="truncate min-w-0">
                          <p className="text-xs font-bold text-[#3d200a] truncate group-hover:text-red-700 transition-colors">{asset.name}</p>
                          <p className={`text-[10px] font-bold ${asset.sortVal === -1 ? 'text-red-600' : 'text-amber-600'}`}>{asset.issue}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-500/40 group-hover:text-red-600 transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Algorithm CBOM */}
        <article className="col-span-1 rounded-3xl border border-amber-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Cryptographic CBOM</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-6">Top Cipher Suites Implemented</p>
          
          <div className="flex-1 relative min-h-[320px]">
            <div className="absolute inset-0 overflow-y-auto pr-2 space-y-2 custom-scrollbar pb-2">
              {data.algoChartData?.length > 0 ? data.algoChartData.map((algo: any, i: number) => {
              const count = algo.value;
              const pct = Math.round((count / data.totalScanned) * 100) || 0;
              return (
                <Link href={`/app/${org.slug}/explore?cipher=${encodeURIComponent(algo.name)}`} key={algo.name} className="block">
                  <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-[#8a5d33]/10 bg-white/50 hover:bg-[#8B0000]/5 hover:border-red-500/20 transition-all group">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#3d200a] truncate pr-4 group-hover:text-[#8B0000] transition-colors">{algo.name}</p>
                      <p className="text-xs font-bold text-[#8a5d33]">{count}</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            }) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <LockKeyhole className="w-8 h-8 text-amber-500/30 mb-2" />
                <p className="text-sm font-semibold text-[#8a5d33]/50">No cipher suites detected yet</p>
              </div>
            )}
            </div>
          </div>
        </article>
      </section>


    </div>
  );
}
