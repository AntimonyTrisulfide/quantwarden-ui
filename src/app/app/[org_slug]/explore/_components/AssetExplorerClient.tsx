"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Search, KeyRound, Key, Lock,
  Globe, Server, ChevronRight, ChevronDown, ChevronUp, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, Radio
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizeAssetOpenPorts, type AssetPort } from "@/lib/port-discovery";

function renderPortChips(ports: unknown) {
  const normalizedPorts = Array.from(
    new Map(
      normalizeAssetOpenPorts(ports)
        .filter((port) => Number.isFinite(port.number))
        .sort((left, right) => left.number - right.number)
        .map((port) => [`${port.number}-${port.protocol}`, port])
    ).values()
  );
  const visiblePorts = normalizedPorts.slice(0, 4);
  const remainingCount = Math.max(0, normalizedPorts.length - visiblePorts.length);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a5d33]/45">
        Ports:
      </span>
      {visiblePorts.map((port) => (
        <span
          key={`${port.number}-${port.protocol}`}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
            port.protocol === "udp"
              ? "bg-violet-500/10 text-violet-700"
              : "bg-emerald-500/10 text-emerald-700"
          }`}
        >
          {port.number}/{port.protocol.toUpperCase()}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}

function RenderResolvedIpChip({
  value,
  type,
  resolvedIp,
}: {
  value: string;
  type: "domain" | "ip" | "unknown";
  resolvedIp?: string | null;
}) {
  const displayIp = type === "ip" ? value : resolvedIp;

  if (displayIp) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[#1d4ed8]/10 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
        IP {displayIp}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-[#1d4ed8]/10 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
          <span className="mr-1 inline-flex items-center">
            <AlertTriangle className="h-3 w-3" />
          </span>
          IP
        </span>
      </TooltipTrigger>
      <TooltipContent>run ports &amp; IP scan to see IP</TooltipContent>
    </Tooltip>
  );
}

export default function AssetExplorerClient({
  org,
  isAdmin,
  initialFilter,
  initialCipher,
  initialKeySize,
  initialTls,
  initialPqcSupported,
  initialPqcNegotiated,
}: any) {
  const [dnsState, setDnsState] = useState("");
  const [timeoutOnly, setTimeoutOnly] = useState(false);
  const [cipher, setCipher] = useState(initialCipher || "");
  const [keySize, setKeySize] = useState(initialKeySize || "");
  const [tls, setTls] = useState(initialTls || "");
  const [pqcSupportedOnly, setPqcSupportedOnly] = useState(initialPqcSupported === "true");
  const [pqcNegotiatedOnly, setPqcNegotiatedOnly] = useState(initialPqcNegotiated === "true");
  const [kexAlgorithms, setKexAlgorithms] = useState<string[]>([]);
  const [kexGroups, setKexGroups] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [totalMatch, setTotalMatch] = useState(0);
  const [matchingEndpointCount, setMatchingEndpointCount] = useState(0);
  const [usesEndpointMatching, setUsesEndpointMatching] = useState(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});
  const [filterOptions, setFilterOptions] = useState<{
    ciphers: string[];
    keySizes: string[];
    tlsVersions: string[];
    kexAlgorithms: string[];
    kexGroups: string[];
  }>({ ciphers: [], keySizes: [], tlsVersions: [], kexAlgorithms: [], kexGroups: [] });

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
        if (dnsState) q.append("dnsState", dnsState);
        if (timeoutOnly) q.append("timeoutOnly", "true");
        if (cipher) q.append("cipher", cipher);
        if (keySize) q.append("keySize", keySize);
        if (tls) q.append("tls", tls);
        if (pqcSupportedOnly) q.append("pqcSupported", "true");
        if (pqcNegotiatedOnly) q.append("pqcNegotiated", "true");
        if (kexAlgorithms.length > 0) q.append("kexAlgos", kexAlgorithms.join(","));
        if (kexGroups.length > 0) q.append("kexGroups", kexGroups.join(","));
        if (debouncedSearch) q.append("search", debouncedSearch);

        const res = await fetch(`/api/orgs/explore?${q.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (mounted) {
          setAssets(json.assets || []);
          setTotalMatch(json.totalMatch || 0);
          setMatchingEndpointCount(json.matchingEndpointCount || 0);
          setUsesEndpointMatching(Boolean(json.usesEndpointMatching));
          setExpandedAssetIds({});
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
  }, [
    dnsState,
    timeoutOnly,
    cipher,
    keySize,
    tls,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    kexAlgorithms,
    kexGroups,
    debouncedSearch,
    org.id,
  ]);

  const toggleSelection = (value: string, selected: string[], setter: (values: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value));
      return;
    }
    setter([...selected, value]);
  };

  const toggleAssetExpansion = (assetId: string) => {
    setExpandedAssetIds((current) => ({
      ...current,
      [assetId]: !current[assetId],
    }));
  };

  return (
    <TooltipProvider>
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
        
        {/* Row 1: Search + DNS */}
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
            <Radio className="w-4 h-4 text-[#8B0000] shrink-0" />
            <select 
              value={dnsState}
              onChange={(e) => setDnsState(e.target.value)}
              className="bg-transparent text-sm font-bold text-[#3d200a] outline-none cursor-pointer border-none ring-0 w-full"
            >
              <option value="">Any DNS State</option>
              <option value="found">DNS Found</option>
              <option value="not_found">DNS Not Found</option>
            </select>
          </div>
        </div>

        {/* Row 2: Cipher, Key Size, TLS + Timeout */}
        <div className="flex flex-col lg:flex-row gap-3">
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

          <button
            type="button"
            onClick={() => setTimeoutOnly((value) => !value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
              timeoutOnly
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-white/55 bg-white/45 text-[#6d3f1d]"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Scan Timeouted
          </button>

          <button
            type="button"
            onClick={() => setPqcSupportedOnly((value) => !value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
              pqcSupportedOnly
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-white/55 bg-white/45 text-[#6d3f1d]"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Kyber Supported
          </button>

          <button
            type="button"
            onClick={() => setPqcNegotiatedOnly((value) => !value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
              pqcNegotiatedOnly
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-white/55 bg-white/45 text-[#6d3f1d]"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Kyber Negotiated
          </button>
        </div>

        {/* Row 3: Key exchange tick lists */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/55 bg-white/45 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#6d3f1d]">Key Exchange Algorithms</p>
              <span className="text-[11px] font-bold text-[#8a5d33]">{kexAlgorithms.length} selected</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {filterOptions.kexAlgorithms.length === 0 ? (
                <p className="text-xs font-semibold text-[#8a5d33]/70">No discovered algorithms yet.</p>
              ) : (
                filterOptions.kexAlgorithms.map((algo) => (
                  <label key={algo} className="flex items-center gap-2 text-sm font-semibold text-[#3d200a]">
                    <input
                      type="checkbox"
                      checked={kexAlgorithms.includes(algo)}
                      onChange={() => toggleSelection(algo, kexAlgorithms, setKexAlgorithms)}
                      className="h-3.5 w-3.5 rounded border-[#8B0000]/35 text-[#8B0000] focus:ring-[#8B0000]/30"
                    />
                    <span className="truncate">{algo}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/55 bg-white/45 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#6d3f1d]">Negotiated Groups</p>
              <span className="text-[11px] font-bold text-[#8a5d33]">{kexGroups.length} selected</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {filterOptions.kexGroups.length === 0 ? (
                <p className="text-xs font-semibold text-[#8a5d33]/70">No discovered groups yet.</p>
              ) : (
                filterOptions.kexGroups.map((group) => (
                  <label key={group} className="flex items-center gap-2 text-sm font-semibold text-[#3d200a]">
                    <input
                      type="checkbox"
                      checked={kexGroups.includes(group)}
                      onChange={() => toggleSelection(group, kexGroups, setKexGroups)}
                      className="h-3.5 w-3.5 rounded border-[#8B0000]/35 text-[#8B0000] focus:ring-[#8B0000]/30"
                    />
                    <span className="truncate">{group}</span>
                  </label>
                ))
              )}
            </div>
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
              {usesEndpointMatching
                ? `Found ${totalMatch} matching asset${totalMatch === 1 ? "" : "s"} across ${matchingEndpointCount} matching TLS endpoint${matchingEndpointCount === 1 ? "" : "s"}`
                : `Found ${assets.length} Matching Entities`}
            </p>
            {assets.map((asset) => {
              const isDnsExpired = asset.summary?.dnsMissing || asset.summary?.issue === "DNS Expired";
              const canExpandMatches = usesEndpointMatching && asset.matchingEndpointCount > 0;
              const isExpanded = Boolean(expandedAssetIds[asset.id]);
              const nameTone = isDnsExpired
                ? "text-red-700 group-hover:text-red-800"
                : asset.summary?.issue
                  ? "text-[#8B0000] group-hover:text-red-700"
                  : "text-[#3d200a] group-hover:text-amber-900";

              return (
              <div key={asset.id} className="group">
                <div className={`rounded-2xl border bg-white/45 backdrop-blur-md px-5 py-4 transition-all shadow-sm
                  ${asset.summary?.issue ? "border-red-500/20 hover:bg-red-500/5 hover:border-red-500/40" : "border-amber-500/20 hover:bg-amber-500/5 hover:border-amber-500/40"}
                `}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={canExpandMatches ? () => toggleAssetExpansion(asset.id) : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-4 text-left ${canExpandMatches ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                        ${asset.summary?.issue ? "bg-red-100" : "bg-amber-100"}
                      `}>
                        {asset.type === 'ip' ? (
                          <Server className={`w-5 h-5 ${asset.summary?.issue ? "text-red-600" : "text-amber-600"}`} />
                        ) : (
                          <Globe className={`w-5 h-5 ${asset.summary?.issue ? "text-red-600" : "text-amber-600"}`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 truncate pr-4">
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                          <p className={`text-sm sm:text-base font-bold truncate transition-colors ${nameTone}`}>
                            {asset.name}
                          </p>
                          {canExpandMatches ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-white/70 p-1 text-[#8B0000]">
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </span>
                          ) : null}
                          <RenderResolvedIpChip value={asset.name} type={asset.type} resolvedIp={asset.resolvedIp} />
                          {isDnsExpired && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  <AlertTriangle className="h-3 w-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>The domain was not found in DNS.</TooltipContent>
                            </Tooltip>
                          )}
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${asset.isRoot ? "bg-[#3d200a]/10 text-[#3d200a]" : "bg-[#8B0000]/10 text-[#8B0000]"}`}>
                            {asset.isRoot ? "ROOT" : "LEAF"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {asset.summary?.issue ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                               <AlertTriangle className="w-3 h-3" />
                               {asset.summary.issue}
                            </div>
                          ) : asset.summary?.timedOut ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                               <AlertTriangle className="w-3 h-3" />
                               Scan Timeout
                            </div>
                          ) : asset.summary?.valid ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                               <ShieldCheck className="w-3 h-3" />
                               Secured
                            </div>
                          ) : (
                            <p className="text-[11px] font-bold text-[#6d3f1d] uppercase tracking-widest">No Scan Data</p>
                          )}
                          {renderPortChips(asset.openPorts)}
                          {canExpandMatches ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a5d33]/45">
                                Matched:
                              </span>
                              {asset.matchingEndpointLabels?.slice(0, 3).map((label: string) => (
                                <span
                                  key={`${asset.id}-${label}`}
                                  className="inline-flex items-center rounded-full bg-[#8B0000]/10 px-2 py-0.5 text-[10px] font-bold text-[#8B0000]"
                                >
                                  {label}
                                </span>
                              ))}
                              {asset.matchingEndpointCount > 3 ? (
                                <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
                                  +{asset.matchingEndpointCount - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>

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

                      <Link
                        href={`/app/${org.slug}/asset/${asset.id}`}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                          ${asset.summary?.issue ? "bg-red-50 hover:bg-red-100" : "bg-amber-50 hover:bg-amber-100"}
                        `}
                      >
                        <ChevronRight className={`w-4 h-4 ${asset.summary?.issue ? "text-red-500" : "text-amber-600"}`} />
                      </Link>
                    </div>
                  </div>

                  {canExpandMatches && isExpanded ? (
                    <div className="mt-4 border-t border-amber-500/10 pt-4">
                      <div className="space-y-2">
                        {asset.matchingEndpoints.map((endpoint: any) => (
                          <Link
                            key={`${asset.id}-${endpoint.portQueryValue}`}
                            href={`/app/${org.slug}/asset/${asset.id}?port=${endpoint.portQueryValue}`}
                            className="block rounded-xl border border-amber-500/15 bg-white/60 px-4 py-3 transition hover:border-amber-500/30 hover:bg-white/80"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-[#8B0000]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#8B0000]">
                                    {endpoint.portLabel}
                                  </span>
                                  {endpoint.summary?.issue ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      <AlertTriangle className="h-3 w-3" />
                                      {endpoint.summary.issue}
                                    </span>
                                  ) : endpoint.summary?.timedOut ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      <AlertTriangle className="h-3 w-3" />
                                      Scan Timeout
                                    </span>
                                  ) : endpoint.summary?.valid ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                      <ShieldCheck className="h-3 w-3" />
                                      Secured
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      No Scan Data
                                    </span>
                                  )}
                                  {endpoint.isPreview ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                      Preview
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#8a5d33]">
                                  {endpoint.summary?.tls ? <span>TLS {endpoint.summary.tls}</span> : null}
                                  {endpoint.summary?.daysRemaining !== undefined && endpoint.summary?.daysRemaining !== null ? (
                                    <span>{endpoint.summary.daysRemaining} days left</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[#8a5d33]">
                                <span className="text-[11px] font-bold uppercase tracking-widest">Open Port</span>
                                <ChevronRight className="h-4 w-4" />
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

    </div>
    </TooltipProvider>
  );
}
