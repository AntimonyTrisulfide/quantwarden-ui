"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Search, Filter, ShieldAlert, KeyRound, Key, Lock,
  Globe, Server, ChevronRight, Loader2, Calendar, AlertTriangle, ShieldCheck
} from "lucide-react";

export default function AssetExplorerClient({ org, isAdmin, initialFilter, initialCipher, initialKeySize, initialTls }: any) {
  const [filter, setFilter] = useState(initialFilter || "");
  const [cipher, setCipher] = useState(initialCipher || "");
  const [keySize, setKeySize] = useState(initialKeySize || "");
  const [tls, setTls] = useState(initialTls || "");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ ciphers: string[], keySizes: string[], tlsVersions: string[] }>({ ciphers: [], keySizes: [], tlsVersions: [] });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        q.append("orgId", org.id);
        if (filter) q.append("filter", filter);
        if (cipher) q.append("cipher", cipher);
        if (keySize) q.append("keySize", keySize);
        if (tls) q.append("tls", tls);
        if (debouncedSearch) q.append("search", debouncedSearch);

        const res = await fetch(`/api/orgs/explore?${q.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (mounted) {
          setAssets(json.assets || []);
          if (json.filterOptions) setFilterOptions(json.filterOptions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAssets();
    return () => { mounted = false; };
  }, [filter, cipher, keySize, tls, debouncedSearch, org.id]);

  return (
    <div className="max-w-275 w-full mx-auto px-6 sm:px-8 py-8 flex flex-col min-h-screen">
      
      {/* Navigation Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/app/${org.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/85 hover:text-[#5b3416] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Hero Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#3d200a] tracking-tight truncate flex items-center gap-3">
          <Globe className="w-8 h-8 text-[#8B0000]" />
          Asset Explorer
        </h1>
        <p className="text-sm font-semibold text-[#6d3f1d] mt-1">
          Deep search and filter all tracked infrastructure variants in real-time.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-4 mb-8 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-5 shadow-sm ring-1 ring-amber-500/10 shrink-0">
        
        {/* Row 1: Search + Health */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a5d33]/50" />
            <input 
              type="text" 
              placeholder="Search domains or IP addresses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/70 border border-[#8B0000]/20 rounded-xl text-sm font-bold text-[#3d200a] placeholder:text-[#8a5d33]/70 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/25 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/55 shrink-0">
            <Filter className="w-4 h-4 text-[#8B0000] shrink-0" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer border-none ring-0 w-full"
            >
              <option value="">All Health States</option>
              <option value="attention">Immediate Attention</option>
            </select>
          </div>
        </div>

        {/* Row 2: Cipher, Key Size, TLS dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-white/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/55 flex-1 min-w-0">
            <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={cipher}
              onChange={(e) => setCipher(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer border-none ring-0 w-full truncate"
            >
              <option value="">Any Cipher Suite</option>
              {filterOptions.ciphers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/55 shrink-0">
            <Key className="w-4 h-4 text-[#8B0000] shrink-0" />
            <select
              value={keySize}
              onChange={(e) => setKeySize(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer border-none ring-0 w-full"
            >
              <option value="">Any Key Size</option>
              {filterOptions.keySizes.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/55 shrink-0">
            <Lock className="w-4 h-4 text-[#8B0000] shrink-0" />
            <select
              value={tls}
              onChange={(e) => setTls(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer border-none ring-0 w-full"
            >
              <option value="">Any TLS Version</option>
              {filterOptions.tlsVersions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Results List */}
      <div className="flex-1">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
             <Loader2 className="w-8 h-8 animate-spin text-[#8B0000] mb-4" />
             <p className="text-sm font-semibold text-[#6d3f1d] font-mono">Querying Infrastructure...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center pb-32">
             <div className="w-16 h-16 rounded-2xl bg-white/45 backdrop-blur-md border border-white/55 flex items-center justify-center mb-4">
               <Search className="w-8 h-8 text-[#8B0000]" />
             </div>
             <p className="text-lg font-bold text-[#3d200a]">No correlated assets found.</p>
             <p className="text-sm font-medium text-[#6d3f1d] mt-1 max-w-sm">
               Try adjusting your search query or loosening your exact cipher filters.
             </p>
          </div>
        ) : (
          <div className="space-y-3 pb-10">
            <p className="text-xs font-bold text-[#6d3f1d] uppercase tracking-widest px-2 mb-4">
              Found {assets.length} Matching Entities
            </p>
            {assets.map((asset) => (
              <Link href={`/app/${org.slug}/asset/${asset.id}`} key={asset.id} className="block group">
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-white/45 backdrop-blur-md px-5 py-4 transition-all shadow-sm
                  ${asset.summary?.issue ? "border-red-500/20 hover:bg-red-500/5 hover:border-red-500/40" : "border-amber-500/20 hover:bg-amber-500/5 hover:border-amber-500/40"}
                `}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                      ${asset.summary?.issue ? "bg-red-100" : "bg-amber-100"}
                    `}>
                      {asset.type === 'ip' ? (
                        <Server className={`w-5 h-5 ${asset.summary?.issue ? "text-red-600" : "text-amber-600"}`} />
                      ) : (
                        <Globe className={`w-5 h-5 ${asset.summary?.issue ? "text-red-600" : "text-amber-600"}`} />
                      )}
                    </div>
                    <div className="truncate pr-4 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm sm:text-base font-bold truncate transition-colors ${asset.summary?.issue ? "text-[#8B0000] group-hover:text-red-700" : "text-[#3d200a] group-hover:text-amber-900"}`}>
                          {asset.name}
                        </p>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${asset.isRoot ? "bg-[#3d200a]/10 text-[#3d200a]" : "bg-[#8B0000]/10 text-[#8B0000]"}`}>
                          {asset.isRoot ? "ROOT" : "LEAF"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {asset.summary?.issue ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                             <AlertTriangle className="w-3 h-3" />
                             {asset.summary.issue}
                          </div>
                        ) : asset.summary?.valid ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                             <ShieldCheck className="w-3 h-3" />
                             Secured
                          </div>
                        ) : (
                          <p className="text-[11px] font-bold text-[#6d3f1d] uppercase tracking-widest">No Scan Data</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 pl-14 sm:pl-0">
                    <div className="hidden md:flex items-center gap-6">
                      {asset.summary?.daysRemaining !== undefined && asset.summary?.daysRemaining !== null ? (
                        <div className="flex flex-col items-end">
                           <p className="text-[10px] uppercase font-bold text-[#6d3f1d]">Expiry</p>
                           <p className={`text-xs font-bold ${asset.summary.daysRemaining <= 30 ? "text-red-600" : "text-emerald-700"}`}>{asset.summary.daysRemaining} days left</p>
                        </div>
                      ) : null}
                      
                      {asset.summary?.tls ? (
                        <div className="flex flex-col items-end w-24">
                           <p className="text-[10px] uppercase font-bold text-[#6d3f1d]">Protocol</p>
                           <p className="text-xs font-bold text-[#8B0000] truncate">{asset.summary.tls}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                      ${asset.summary?.issue ? "bg-red-50 group-hover:bg-red-100" : "bg-amber-50 group-hover:bg-amber-100"}
                    `}>
                      <ChevronRight className={`w-4 h-4 ${asset.summary?.issue ? "text-red-500" : "text-amber-600"}`} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
