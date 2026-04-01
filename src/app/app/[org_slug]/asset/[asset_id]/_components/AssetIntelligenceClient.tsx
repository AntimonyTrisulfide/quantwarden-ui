"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Globe, ShieldAlert, Cpu, Activity, Clock, Trash2, ShieldCheck,
  Calendar, CheckCircle2, AlertTriangle, KeyRound, Lock, Search, RefreshCw, Loader2, Network, Server
} from "lucide-react";

export default function AssetIntelligenceClient({ org, asset, initialScans, isAdmin }: any) {
  const router = useRouter();
  const [scans, setScans] = useState(initialScans || []);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const latestScan = scans.length > 0 ? scans[0] : null;
  const parsed = latestScan?.resultData ? 
    (typeof latestScan.resultData === 'string' ? JSON.parse(latestScan.resultData) : latestScan.resultData) 
    : null;

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await fetch(`/api/orgs/scans/pyssl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, assets: [asset] })
      });
      router.refresh();
      // Wait a sec for the server to send the fresh props
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      await fetch("/api/orgs/scans/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, assets: [asset] })
      });
      // Return to dashboard when done
      router.push(`/app/${org.slug}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${asset.value}?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/orgs/assets?id=${asset.id}&orgId=${org.id}`, { method: 'DELETE' });
      router.push(`/app/${org.slug}`);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  const Item = ({ label, icon: Icon, value, colorClass, title, children }: any) => (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2 group relative">
        <Icon className={`w-5 h-5 ${colorClass}`} />
        <div className="text-sm font-bold text-[#3d200a] truncate flex-1" title={title}>
          {value}
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-275 w-full mx-auto px-6 sm:px-8 py-8 flex flex-col min-h-screen">
      
      {/* Navigation Header */}
      <div className="mb-6">
        <Link href={`/app/${org.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/60 hover:text-[#8a5d33] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Organization
        </Link>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-[#3d200a] tracking-tight truncate">{asset.value}</h1>
            <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${asset.isRoot ? "bg-amber-100 text-amber-700" : "bg-[#8B0000]/10 text-[#8B0000]"}`}>
              {asset.isRoot ? "ROOT" : "LEAF"}
            </span>
            <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-white/60 border border-white/50 text-[#3d200a] uppercase tracking-widest">
              {asset.type}
            </span>
          </div>
          <p className="text-sm font-semibold text-[#8a5d33]/70">
            Added on {new Date(asset.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button 
              onClick={handleDiscover}
              disabled={isDiscovering || isScanning} 
              className="px-4 py-2.5 bg-white/45 backdrop-blur-md border border-white/55 text-[#8B0000] text-sm font-bold rounded-xl hover:bg-white/60 hover:border-[#8B0000]/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
              Deep Discover
            </button>
            <button 
              onClick={handleScan}
              disabled={isDiscovering || isScanning} 
              className="px-4 py-2.5 bg-linear-to-r from-[#8B0000] to-[rgb(110,0,0)] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Re-Scan SSL
            </button>
            <button 
              onClick={handleDelete}
              disabled={isDeleting} 
              className="p-2.5 bg-white/45 backdrop-blur-md text-red-700 rounded-xl hover:bg-red-50/80 transition-colors border border-red-200/80"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Intelligence Grid */}
      <div className="flex-1 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-sm ring-1 ring-amber-500/10 mb-8">
        <h2 className="text-xl font-bold text-[#3d200a] mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#8B0000]" />
          Live Security Intelligence
        </h2>
        
        {!parsed ? (
          <div className="h-48 flex items-center justify-center border-2 border-dashed border-amber-500/20 rounded-2xl bg-amber-50/50">
             <p className="text-sm font-bold text-[#8a5d33]/50">No scan completed yet. Click Re-Scan SSL to execute pipeline.</p>
          </div>
        ) : parsed.error ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-700">{parsed.error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Item 
                label="Certificate Validity" 
                icon={parsed.security_analysis?.certificate_valid === false ? AlertTriangle : CheckCircle2} 
                colorClass={parsed.security_analysis?.certificate_valid === false ? "text-red-500" : "text-emerald-500"} 
                value={parsed.security_analysis?.certificate_valid === false ? "Invalid" : "Valid"} 
              />
              <Item 
                label="TLS Protocol" 
                icon={Lock} 
                colorClass="text-[#8B0000]" 
                value={parsed.connection_info?.protocol?.version || "Unknown"} 
              />
              <Item 
                label="Expiry" 
                icon={Calendar} 
                colorClass={parsed.certificate?.validity?.days_remaining && parsed.certificate.validity.days_remaining > 30 ? "text-emerald-500" : "text-amber-500"} 
                value={parsed.certificate?.validity?.days_remaining ? `${parsed.certificate.validity.days_remaining} days` : "Unknown"} 
              />
              <Item 
                label="Cipher Suite" 
                icon={ShieldCheck} 
                colorClass={parsed.security_analysis?.strong_cipher ? "text-emerald-500" : "text-amber-500"} 
                title={parsed.connection_info?.protocol?.cipher_suite?.name}
                value={parsed.connection_info?.protocol?.cipher_suite?.name || "Unknown"} 
              />
            </div>
            
            <div className="h-px w-full bg-[#8a5d33]/10"></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Item 
                label="Subject (Common Name)" 
                icon={Globe} 
                colorClass="text-[#8B0000]" 
                title={parsed.certificate?.subject?.common_name}
                value={parsed.certificate?.subject?.common_name || "Unknown"} 
              />
              <Item 
                label="Issuer Authority" 
                icon={Server} 
                colorClass="text-[#8B0000]" 
                title={parsed.certificate?.issuer?.common_name}
                value={parsed.certificate?.issuer?.common_name || "Unknown"} 
              />
              <Item 
                label="Subject Alt Names" 
                icon={Globe} 
                colorClass="text-amber-700" 
                value={`${parsed.certificate?.extensions?.subject_alternative_names?.length || 0} domains`}
              />
              <Item 
                label="Trust Level" 
                icon={ShieldCheck} 
                colorClass={parsed.security_analysis?.self_signed_cert ? "text-red-500" : "text-emerald-500"} 
                value={parsed.security_analysis?.self_signed_cert ? "Self-Signed" : "Trusted CA"} 
              />
            </div>

            <div className="h-px w-full bg-[#8a5d33]/10"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Item 
                label="Public Key Size" 
                icon={CheckCircle2} 
                colorClass={parsed.security_analysis?.key_size_adequate ? "text-emerald-500" : "text-amber-500"} 
                value={`${parsed.certificate?.public_key?.algorithm} (${parsed.certificate?.public_key?.size} bits)`} 
              />
              <Item 
                label="Signature Algorithm" 
                icon={Activity} 
                colorClass="text-[#8B0000]" 
                value={parsed.certificate?.signature_algorithm?.name || "Unknown"} 
              />
              <Item 
                label="Strong Cipher" 
                icon={CheckCircle2} 
                colorClass={parsed.security_analysis?.strong_cipher ? "text-emerald-500" : "text-amber-500"} 
                value={parsed.security_analysis?.strong_cipher ? "Yes" : "Weak"} 
              />
              <Item 
                label="TLS Downgrade Safe" 
                icon={parsed.security_analysis?.tls_version_secure === false ? AlertTriangle : CheckCircle2} 
                colorClass={parsed.security_analysis?.tls_version_secure === false ? "text-red-500" : "text-emerald-500"} 
                value={parsed.security_analysis?.tls_version_secure === false ? "Vulnerable" : "Yes"} 
              />
            </div>
            
            {parsed.security_analysis?.warnings && parsed.security_analysis.warnings.length > 0 && (
              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest mb-3">Analysis Warnings</p>
                <ul className="space-y-2">
                  {parsed.security_analysis.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-sm font-semibold text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
