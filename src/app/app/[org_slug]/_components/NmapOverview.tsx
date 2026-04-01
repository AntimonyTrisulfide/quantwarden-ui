"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Lock,
  AlertTriangle,
  Loader2,
  Clock,
  ShieldCheck,
  Radio,
  Wifi
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface NmapOverviewProps {
  org: any;
  isAdmin: boolean;
}

const PQC_COLORS: Record<string, string> = {
  high: "#dc2626",   // red-600
  medium: "#d97706", // amber-600
  low: "#16a34a",    // emerald-600
  unknown: "#9ca3af" // gray-400
};

export default function NmapOverview({ org, isAdmin }: NmapOverviewProps) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/nmap/overview?orgId=${org.id}&days=${days}`);
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-indigo-900/70 font-mono">Compiling Nmap Intelligence...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full flex flex-col space-y-5 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-10">
      
      {/* Top Header / Filter */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 shrink-0 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-5 shadow-sm ring-1 ring-indigo-500/10">
        <div>
          <h1 className="text-2xl font-bold text-[#3d200a] tracking-tight">Nmap Network Overview</h1>
          <p className="text-sm font-semibold text-[#8a5d33]/70 mt-1">Ethical network intelligence and PQC posture</p>
        </div>
        <div className="flex items-center gap-3 bg-white/60 p-1.5 rounded-xl border border-indigo-500/20 shadow-sm shrink-0">
          <Clock className="w-4 h-4 text-indigo-700 ml-2 shrink-0" />
          <select 
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer pr-2 border-none ring-0"
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
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        </div>
      )}

      {/* Top metrics grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 shrink-0">
        {[
          { title: "Network Targets", value: data.totalTargets, icon: Server, tone: "text-blue-700", bg: "from-blue-100 to-white", brdColor: "border-blue-200" },
          { title: "Scanned Targets", value: data.totalScanned, icon: Activity, tone: "text-indigo-700", bg: "from-indigo-100 to-white", brdColor: "border-indigo-200" },
          { title: "Total Open Ports", value: data.totalOpenPorts, icon: Radio, tone: "text-emerald-700", bg: "from-emerald-100 to-white", brdColor: "border-emerald-200" },
          { title: "Chain Issues Detected", value: data.issuesDetected, icon: AlertTriangle, tone: data.issuesDetected > 0 ? "text-red-700" : "text-emerald-700", bg: data.issuesDetected > 0 ? "from-red-100 to-white" : "from-emerald-100 to-white", brdColor: data.issuesDetected > 0 ? "border-red-200" : "border-emerald-200" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.title} className={`rounded-3xl border ${metric.brdColor} bg-white/70 backdrop-blur p-5 shadow-sm`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-900/60">{metric.title}</p>
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
        
        {/* Column 1: Port Exposure Matrix */}
        <article className="col-span-1 rounded-3xl border border-indigo-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Port Exposure Matrix</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-4">Most common open ports</p>
          
          <div className="flex-1 w-full min-h-0">
            {data.portExposureData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data.portExposureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#6366f1" strokeOpacity={0.1} />
                   <XAxis dataKey="port" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={700} />
                   <YAxis stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                   <Tooltip
                     cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                     contentStyle={{ background: "#ffffff", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700, color: "#3d200a" }}
                     formatter={(v: number) => [v, "Targets"]}
                     labelFormatter={(label) => `Port ${label}`}
                   />
                   <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#059669" />
                 </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-indigo-500/20 rounded-2xl">
                 <p className="text-sm font-semibold text-[#8a5d33]/50">No open ports detected</p>
              </div>
            )}
          </div>
        </article>

        {/* Column 2: PQC Safety */}
        <article className="col-span-1 rounded-3xl border border-indigo-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#3d200a]">PQC Quantum Break Risk</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-4">Post-Quantum Cryptography Readiness</p>
          
          <div className="flex-1 w-full min-h-0 flex flex-col items-center justify-center relative">
            {data.pqcRiskData?.length > 0 ? (
              <>
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip 
                        contentStyle={{ background: "#ffffff", border: "none", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700, color: "#3d200a" }}
                        formatter={(value: number) => [value, "Targets"]}
                      />
                      <Pie
                        data={data.pqcRiskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="risk"
                      >
                        {data.pqcRiskData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PQC_COLORS[entry.risk] || PQC_COLORS.unknown} />
                        ))}
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 {/* Legend */}
                 <div className="absolute bottom-0 w-full flex flex-wrap justify-center gap-4">
                    {data.pqcRiskData.map((entry: any) => (
                       <div key={entry.risk} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PQC_COLORS[entry.risk] || PQC_COLORS.unknown }} />
                          <span className="text-xs font-bold text-[#3d200a] uppercase">{entry.risk} Risk</span>
                       </div>
                    ))}
                 </div>
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-indigo-500/20 rounded-2xl">
                 <p className="text-sm font-semibold text-[#8a5d33]/50">Complete a scan for PQC analysis</p>
              </div>
            )}
          </div>
        </article>

        {/* Column 3: TLS Probes */}
        <article className="col-span-1 rounded-3xl border border-indigo-500/20 bg-white/60 backdrop-blur p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-[#3d200a]">TLS Protocol Probes</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70 mb-4">Supported TLS versions across network</p>
          
          <div className="flex-1 w-full min-h-0">
             {data.tlsVersionsData?.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={data.tlsVersionsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#6366f1" strokeOpacity={0.1} horizontal={false} />
                    <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                    <YAxis 
                      dataKey="version" type="category" tickLine={false} axisLine={false} width={60}
                      tick={{ fontSize: 11, fontWeight: 700, fill:'#1d4ed8' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(29,78,216,0.05)' }}
                      contentStyle={{ background: "#ffffff", border: "1px solid rgba(29,78,216,0.2)", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700, color: "#3d200a" }}
                      formatter={(v: number) => [v, "Targets Support"]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={26} fill="#1d4ed8" />
                  </BarChart>
               </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-indigo-500/20 rounded-2xl">
                  <p className="text-sm font-semibold text-[#8a5d33]/50">No TLS probes available</p>
                </div>
             )}
          </div>
        </article>

      </section>

    </div>
  );
}
