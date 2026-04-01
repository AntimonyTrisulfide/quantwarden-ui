"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Server,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Plus,
  Trash2,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NmapScanningProps {
  org: any;
  isAdmin: boolean;
}

interface ScanData {
  id: string;
  status: "pending" | "completed" | "failed";
  resultData: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface NmapAsset {
  id: string;
  target: string;
  resolvedIp: string | null;
  scanStatus: "idle" | "scanning" | "completed" | "failed";
  lastScanDate: string | null;
  createdAt: string;
  latestScan: ScanData | null;
}

export default function NmapScanning({ org, isAdmin }: NmapScanningProps) {
  const [assets, setAssets] = useState<NmapAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [newTarget, setNewTarget] = useState("");
  const [adding, setAdding] = useState(false);

  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const [activeScans, setActiveScans] = useState<number>(0);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/nmap/scans?orgId=${org.id}`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Concurrent Execution Queue for Scans (1 at a time for Nmap)
  useEffect(() => {
    if (scanQueue.length > 0 && activeScans < 1) { 
      const nextAssetId = scanQueue[0];
      setScanQueue((q) => q.slice(1));
      setActiveScans((count) => count + 1);

      // Pre-emptively update UI
      setAssets(prev => prev.map(a => a.id === nextAssetId ? {
        ...a, scanStatus: "scanning", latestScan: { id: "temp", status: "pending", resultData: null, createdAt: new Date().toISOString(), completedAt: null }
      } : a));

      fetch("/api/orgs/nmap/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: nextAssetId, orgId: org.id }),
      })
        .then(() => fetchAssets())
        .catch(() => {})
        .finally(() => setActiveScans((count) => count - 1));
    }
  }, [scanQueue, activeScans, org.id, fetchAssets]);

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget.trim() || !isAdmin) return;
    setAdding(true);
    try {
      await fetch('/api/orgs/nmap/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, target: newTarget.trim() })
      });
      setNewTarget("");
      fetchAssets();
    } catch(err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !confirm("Remove this Nmap target?")) return;
    try {
      await fetch(`/api/orgs/nmap/assets?orgId=${org.id}&id=${id}`, { method: 'DELETE' });
      fetchAssets();
    } catch(err) {
      console.error(err);
    }
  };

  const handleScan = (assetId: string) => {
    if (!scanQueue.includes(assetId)) {
      setScanQueue((q) => [...q, assetId]);
    }
  };

  const handleScanAll = () => {
    const ids = assets
      .filter((a) => !a.latestScan || a.latestScan.status !== "pending")
      .map((a) => a.id);
    setScanQueue(prev => Array.from(new Set([...prev, ...ids])));
  };

  let filteredAssets = assets.filter(
    (a) => a.target.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (a.resolvedIp && a.resolvedIp.includes(searchTerm))
  );

  const renderScanDetails = (scan: ScanData) => {
    if (scan.status === "pending") {
      return (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-amber-700">Nmap security scan in progress...</p>
        </div>
      );
    }

    if (scan.status === "failed") {
      let errMsg = "Scan failed to execute.";
      if (scan.resultData) {
        try {
          const parsed = JSON.parse(scan.resultData);
          if (parsed.detail) errMsg = parsed.detail;
          else if (parsed.error) errMsg = parsed.error;
          else if (typeof parsed === "string") errMsg = parsed;
        } catch (e) {}
      }
      return (
        <div className="p-4 bg-red-50/80 rounded-xl border border-red-200/50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700 font-mono tracking-tight">{errMsg}</p>
        </div>
      );
    }

    if (!scan.resultData) return null;

    let parsed: any;
    try {
      parsed = JSON.parse(scan.resultData);
    } catch {
      return <p className="text-sm text-red-500">Failed to parse JSON output.</p>;
    }

    const data = parsed.data || parsed;

    const Item = ({ label, value, colorClass }: any) => (
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-widest">{label}</p>
        <div className={`text-sm font-bold ${colorClass || "text-[#3d200a]"} truncate`}>
          {value}
        </div>
      </div>
    );

    return (
      <div className="p-5 bg-white rounded-xl border border-[#8a5d33]/10 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Item 
            label="Resolved IP" 
            value={data.resolved_ip || "Unknown"} 
            colorClass="text-indigo-600"
          />
          <Item 
            label="Open Ports" 
            value={data.open_ports?.map((p:any)=>p.port).join(", ") || "None"} 
          />
          <Item 
            label="PQC Risk" 
            value={data.pqc_safety_intelligence?.quantum_break_risk?.toUpperCase() || "UNKNOWN"} 
            colorClass={data.pqc_safety_intelligence?.quantum_break_risk === 'high' ? 'text-red-600' : 'text-emerald-600'}
          />
          <Item 
            label="TLS Versions" 
            value={data.supported_tls_versions?.join(", ") || "None"} 
            colorClass="text-blue-600"
          />
        </div>
        
        {data.pqc_safety_intelligence?.recommendations?.length > 0 && (
           <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
             <p className="text-[10px] font-bold text-blue-800/60 uppercase tracking-widest mb-2">Recommendations</p>
             <ul className="list-disc list-inside text-sm font-medium text-blue-900 space-y-1">
                {data.pqc_safety_intelligence.recommendations.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
             </ul>
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-amber-500/20">
      
      {/* Header */}
      <div className="p-6 sm:p-8 bg-linear-to-br from-white/80 to-white/40 border-b border-amber-500/10 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-700 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#3d200a] tracking-tight">Nmap Network Scanning</h2>
              <p className="text-sm font-medium text-[#8a5d33]/80 mt-1 max-w-xl leading-relaxed">
                Run deep ethical intelligence scanning to identify exposed ports, cryptographic posture, and PQC safety.
              </p>
            </div>
          </div>
          
          {isAdmin && (
            <div className="flex flex-col items-end gap-2">
               <button
                  onClick={handleScanAll}
                  disabled={scanQueue.length > 0 || activeScans > 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-indigo-700 to-blue-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
               >
                  {scanQueue.length > 0 || activeScans > 0 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {scanQueue.length > 0 || activeScans > 0 ? `Scanning (${scanQueue.length + activeScans} left)` : "Scan All Targets"}
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar & Add Target */}
      <div className="px-6 py-4 bg-white/40 border-b border-amber-500/10 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a5d33]/40" />
          <input
            type="text"
            placeholder="Search targets or IPs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/50 border border-amber-500/20 rounded-xl text-sm font-medium text-[#3d200a] placeholder:text-[#8a5d33]/40 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
        </div>
        
        {isAdmin && (
          <form onSubmit={handleAddTarget} className="flex gap-2 w-full sm:max-w-md">
            <input 
              type="text"
              placeholder="example.com or 192.168.1.1"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/50 border border-amber-500/20 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              required
            />
            <button 
              type="submit" 
              disabled={adding}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Target
            </button>
          </form>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-[#8a5d33]/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#3d200a]">No Nmap targets found</h3>
            <p className="text-sm text-[#8a5d33]/60 mt-1">
              Add IP addresses or domains above to begin ethical scanning.
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const isQueued = scanQueue.includes(asset.id);
            const isRunning = asset.scanStatus === "scanning" || asset.latestScan?.status === "pending";
            const isExpanded = expandedAssetId === asset.id;

            return (
              <div key={asset.id} className="bg-white/60 rounded-xl border border-amber-500/10 transition-all hover:bg-white/80 overflow-hidden shadow-sm">
                <div 
                   className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer"
                   onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#3d200a] leading-tight flex items-center gap-2">
                         {asset.target}
                         {asset.resolvedIp && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] uppercase tracking-widest leading-none font-mono">
                               {asset.resolvedIp}
                            </span>
                         )}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {asset.latestScan ? (
                           <>
                             <span className={`text-[10px] font-bold uppercase tracking-wider ${
                               asset.latestScan.status === 'completed' ? 'text-emerald-500' :
                               asset.latestScan.status === 'pending' ? 'text-amber-500 animate-pulse' : 'text-red-500'
                             }`}>
                               {asset.latestScan.status}
                             </span>
                             <span className="w-1 h-1 rounded-full bg-[#8a5d33]/20"></span>
                             <span className="text-[10px] font-bold text-[#8a5d33]/50">
                               {formatDistanceToNow(new Date(asset.latestScan.createdAt), { addSuffix: true })}
                             </span>
                           </>
                        ) : (
                           <span className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-wider">Not Scanned Yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4 sm:mt-0">
                    {asset.latestScan && (
                      <Link
                        href={`/app/${org.slug}/nmap/${asset.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8B0000] bg-white border border-[#8B0000]/20 rounded-lg hover:bg-[#8B0000]/5 transition-colors"
                      >
                        Details
                      </Link>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleScan(asset.id); }}
                          disabled={isQueued || isRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        >
                          {isQueued || isRunning ? (
                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                             <Zap className="w-3.5 h-3.5" />
                          )}
                          {isRunning ? 'Scanning' : isQueued ? 'Queued' : 'Scan Network'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Target"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button className="p-1.5 text-[#8a5d33]/40 hover:text-[#8a5d33] transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded State */}
                {isExpanded && asset.latestScan && (
                  <div className="p-4 pt-0 border-t border-amber-500/10 mt-2 bg-linear-to-b from-transparent to-[#fdf8f0]/40">
                     <div className="pt-4">
                       {renderScanDetails(asset.latestScan)}
                     </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
