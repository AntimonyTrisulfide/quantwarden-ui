"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Command,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Network,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
} from "lucide-react";

type UnknownRecord = Record<string, any>;

function safeParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toReadable(value: unknown) {
  if (value === null || value === undefined) return "Unknown";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatCipherDisplayName(cipher: string) {
  return cipher
    .replace(/^TLS_/, "")
    .replaceAll("_", " ")
    .replace(/\bAES(\d+)\b/g, "AES-$1")
    .replace(/\bSHA(\d+)\b/g, "SHA-$1");
}

function formatIssueName(issue: string) {
  return issue
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function compactText(value: unknown, maxLength = 220) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function extractMatch(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

function parseEvidenceFields(evidence: unknown) {
  const text = String(evidence ?? "").trim();
  if (!text) {
    return {
      core: [] as Array<{ label: string; value: string }>,
      sans: [] as string[],
      fingerprints: [] as Array<{ label: string; value: string }>,
      raw: "",
    };
  }

  const subject = extractMatch(text, /(?:^|\n)Subject:\s*([^\n]+)/i);
  const issuer = extractMatch(text, /(?:^|\n)Issuer:\s*([^\n]+)/i);
  const keyType = extractMatch(text, /(?:^|\n)Public Key type:\s*([^\n]+)/i);
  const keyBits = extractMatch(text, /(?:^|\n)Public Key bits:\s*([^\n]+)/i);
  const sigAlg = extractMatch(text, /(?:^|\n)Signature Algorithm:\s*([^\n]+)/i);
  const validFrom = extractMatch(text, /(?:^|\n)Not valid before:\s*([^\n]+)/i);
  const validTo = extractMatch(text, /(?:^|\n)Not valid after:\s*([^\n]+)/i);

  const sanLine = extractMatch(text, /(?:^|\n)Subject Alternative Name:\s*([^\n]+)/i);
  const sans = sanLine
    ? sanLine
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const md5 = extractMatch(text, /(?:^|\n)MD5:\s*([^\n]+)/i);
  const sha1 = extractMatch(text, /(?:^|\n)SHA-1:\s*([^\n]+)/i);
  const sha256 = extractMatch(text, /(?:^|\n)SHA-256:\s*([^\n]+)/i);

  const core = [
    subject ? { label: "Subject", value: subject } : null,
    issuer ? { label: "Issuer", value: issuer } : null,
    keyType ? { label: "Public Key Type", value: keyType } : null,
    keyBits ? { label: "Public Key Bits", value: keyBits } : null,
    sigAlg ? { label: "Signature Algorithm", value: sigAlg } : null,
    validFrom ? { label: "Valid From", value: validFrom } : null,
    validTo ? { label: "Valid To", value: validTo } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const fingerprints = [
    md5 ? { label: "MD5", value: md5 } : null,
    sha1 ? { label: "SHA-1", value: sha1 } : null,
    sha256 ? { label: "SHA-256", value: sha256 } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return { core, sans, fingerprints, raw: text };
}

function normalizeTlsVersion(value: unknown) {
  const raw = String(value ?? "").toUpperCase().replace(/\s+/g, "");
  if (raw.includes("TLSV1.0") || raw.includes("TLS1.0")) return "TLSv1.0";
  if (raw.includes("TLSV1.1") || raw.includes("TLS1.1")) return "TLSv1.1";
  if (raw.includes("TLSV1.2") || raw.includes("TLS1.2")) return "TLSv1.2";
  if (raw.includes("TLSV1.3") || raw.includes("TLS1.3")) return "TLSv1.3";
  return String(value ?? "Unknown");
}

export default function NmapAssetIntelligenceClient({
  org,
  asset,
  latestScan,
  isAdmin,
}: any) {
  const router = useRouter();
  const [isRescanning, setIsRescanning] = useState(false);

  const parsedRaw = safeParseJson(latestScan?.resultData || null);
  const payload = ((parsedRaw?.data || parsedRaw) ?? null) as UnknownRecord | null;

  const scanStatus: string = latestScan?.status || "idle";
  const openPorts: UnknownRecord[] = Array.isArray(payload?.open_ports) ? payload.open_ports : [];
  const tlsVersions: string[] = Array.isArray(payload?.supported_tls_versions)
    ? payload.supported_tls_versions
    : [];
  const tlsVersionProbes: UnknownRecord[] = Array.isArray(payload?.tls_version_probes)
    ? payload.tls_version_probes
    : [];
  const recommendations: string[] = Array.isArray(payload?.pqc_safety_intelligence?.recommendations)
    ? payload.pqc_safety_intelligence.recommendations
    : [];
  const chainIssues: UnknownRecord[] = Array.isArray(payload?.certificate_chain_issues)
    ? payload.certificate_chain_issues
    : [];
  const scanNotes: string[] = Array.isArray(payload?.scan_notes) ? payload.scan_notes : [];
  const rawCommands: string[] = Array.isArray(payload?.raw_nmap_commands)
    ? payload.raw_nmap_commands
    : [];

  const cipherSuitesByVersion: [string, unknown][] = payload?.supported_cipher_suites
    ? Object.entries(payload.supported_cipher_suites)
    : [];

  const sshIntelligence: UnknownRecord =
    payload && typeof payload.ssh_intelligence === "object" && payload.ssh_intelligence
      ? payload.ssh_intelligence
      : {};

  const failMessage = (() => {
    if (!latestScan?.resultData) return "Scan failed to execute.";
    const parsed = safeParseJson(latestScan.resultData);
    if (!parsed) return "Scan failed to execute.";
    if (parsed.detail) return String(parsed.detail);
    if (parsed.error) return String(parsed.error);
    if (typeof parsed === "string") return parsed;
    return "Scan failed to execute.";
  })();

  const handleRescan = async () => {
    if (!isAdmin || isRescanning) return;
    setIsRescanning(true);
    try {
      await fetch("/api/orgs/nmap/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, orgId: org.id }),
      });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRescanning(false);
    }
  };

  const statusClass =
    scanStatus === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : scanStatus === "pending"
      ? "bg-amber-100 text-amber-700"
      : scanStatus === "failed"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-700";

  const InfoCard = ({
    label,
    icon: Icon,
    value,
    colorClass,
  }: {
    label: string;
    icon: any;
    value: string;
    colorClass?: string;
  }) => (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${colorClass || "text-[#8B0000]"}`} />
        <p className="text-sm font-bold text-[#3d200a] break-all">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-275 w-full mx-auto px-6 sm:px-8 py-8 flex flex-col min-h-screen">
      <div className="mb-6">
        <Link
          href={`/app/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/60 hover:text-[#8a5d33] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organization
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-extrabold text-[#3d200a] tracking-tight break-all">{asset.target}</h1>
            <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${statusClass}`}>
              {scanStatus}
            </span>
            {isAdmin && (
              <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-[#8B0000]/10 text-[#8B0000] uppercase tracking-widest">
                ADMIN
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#8a5d33]/70">
            Latest Nmap ethical scan details for this asset.
          </p>
        </div>

        <div className="space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={handleRescan}
                disabled={isRescanning || scanStatus === "pending"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B0000] text-white text-xs font-extrabold uppercase tracking-wider hover:bg-[#730000] transition-colors disabled:opacity-50"
              >
                {isRescanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {scanStatus === "pending" ? "Scan Running" : "Re-Scan"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#8a5d33]/70">
          <div className="px-3 py-2 rounded-lg bg-white/60 border border-amber-500/20">
            Created: {latestScan ? new Date(latestScan.createdAt).toLocaleString() : "No scan"}
          </div>
          <div className="px-3 py-2 rounded-lg bg-white/60 border border-amber-500/20">
            Last Scan: {latestScan?.completedAt ? new Date(latestScan.completedAt).toLocaleString() : "Pending / N/A"}
          </div>
        </div>
        </div>
      </div>

      <div className="flex-1 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-sm ring-1 ring-amber-500/10 mb-8">
        <h2 className="text-xl font-bold text-[#3d200a] mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#8B0000]" />
          Full Nmap Intelligence
        </h2>

        {!latestScan ? (
          <div className="h-48 flex items-center justify-center border-2 border-dashed border-amber-500/20 rounded-2xl bg-amber-50/50">
            <p className="text-sm font-bold text-[#8a5d33]/50">
              No scan has been executed for this asset yet.
            </p>
          </div>
        ) : scanStatus === "pending" ? (
          <div className="p-5 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <p className="text-sm font-semibold text-amber-700">
              Nmap ethical scan is currently running for this target.
            </p>
          </div>
        ) : scanStatus === "failed" ? (
          <div className="p-5 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-700 break-all">{failMessage}</p>
          </div>
        ) : !payload ? (
          <div className="p-5 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-700">Failed to parse scan result payload.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <InfoCard
                label="Resolved IP"
                icon={Globe}
                value={toReadable(payload.resolved_ip || asset.resolvedIp || null)}
                colorClass="text-[#8B0000]"
              />
              <InfoCard
                label="Open Ports"
                icon={Network}
                value={openPorts.length ? openPorts.map((p) => p.port).join(", ") : "None"}
                colorClass={openPorts.length ? "text-amber-600" : "text-emerald-600"}
              />
              <InfoCard
                label="PQC Quantum Risk"
                icon={ShieldAlert}
                value={toReadable(payload.pqc_safety_intelligence?.quantum_break_risk || "unknown").toUpperCase()}
                colorClass={
                  payload.pqc_safety_intelligence?.quantum_break_risk === "high"
                    ? "text-red-600"
                    : "text-emerald-600"
                }
              />
              <InfoCard
                label="TLS Versions"
                icon={Shield}
                value={tlsVersions.length ? tlsVersions.join(", ") : "None"}
                colorClass="text-amber-700"
              />
            </div>

            <div className="h-px w-full bg-[#8a5d33]/10" />

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">Network Exposure</h3>
              {openPorts.length === 0 ? (
                <p className="text-sm text-[#8a5d33]/70">No open ports reported.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {openPorts.map((port, idx) => (
                    <div
                      key={`${port.port}-${idx}`}
                      className="p-3.5 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)]"
                    >
                      <p className="text-sm font-extrabold text-[#3d200a] tracking-tight">
                        Port {toReadable(port.port)} {port.protocol ? `(${port.protocol})` : ""}
                      </p>
                      <p className="text-xs text-[#8a5d33]/70 mt-1.5">
                        Service: {toReadable(port.service)} | Product: {toReadable(port.product)}
                      </p>
                      <p className="text-xs text-[#8a5d33]/70 mt-1">Version: {toReadable(port.version)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="h-px w-full bg-[#8a5d33]/10" />

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">TLS Analysis</h3>
              {(() => {
                const expectedVersions = ["TLSv1.0", "TLSv1.1", "TLSv1.2", "TLSv1.3"];
                const probeMap = new Map<string, UnknownRecord>();

                tlsVersionProbes.forEach((probe) => {
                  const versionKey = normalizeTlsVersion(probe.tls_version);
                  probeMap.set(versionKey, probe);
                });

                const tls13Present = !!probeMap.get("TLSv1.3")?.supported;

                const tlsCards = expectedVersions.map((version) => {
                  const probe = probeMap.get(version);
                  const supported = !!probe?.supported;
                  const evidence = probe?.evidence
                    ? String(probe.evidence)
                    : "Version not detected in probe output.";

                  if (version === "TLSv1.0" || version === "TLSv1.1") {
                    return supported
                      ? {
                          version,
                          supported,
                          badge: "UNSAFE (PRESENT)",
                          badgeClass: "bg-red-100 text-red-700",
                          title: "Legacy protocol enabled",
                          titleClass: "text-red-700",
                          icon: AlertTriangle,
                          iconClass: "text-red-600",
                          cardClass: "border-red-200/70",
                          helper: evidence,
                        }
                      : {
                          version,
                          supported,
                          badge: "SAFE (ABSENT)",
                          badgeClass: "bg-emerald-100 text-emerald-700",
                          title: "Legacy protocol disabled",
                          titleClass: "text-emerald-700",
                          icon: CheckCircle2,
                          iconClass: "text-emerald-600",
                          cardClass: "border-emerald-200/70",
                          helper: evidence,
                        };
                  }

                  if (version === "TLSv1.2") {
                    return {
                      version,
                      supported,
                      badge: supported ? "WARNING (PRESENT)" : "NEUTRAL (ABSENT)",
                      badgeClass: supported ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700",
                      title: supported
                        ? "Modern baseline supported"
                        : tls13Present
                        ? "TLS 1.2 not detected (TLS 1.3 covers modern security)"
                        : "TLS 1.2 not detected",
                      titleClass: supported ? "text-amber-700" : tls13Present ? "text-slate-700" : "text-amber-700",
                      icon: supported ? ShieldAlert : AlertTriangle,
                      iconClass: supported ? "text-amber-600" : tls13Present ? "text-slate-500" : "text-amber-600",
                      cardClass: supported ? "border-amber-200/70" : tls13Present ? "border-slate-200/70" : "border-amber-200/70",
                      helper: evidence,
                    };
                  }

                  return supported
                    ? {
                        version,
                      supported,
                        badge: tls13Present && !probeMap.get("TLSv1.2")?.supported ? "PREFERRED (PRESENT)" : "STRONG (PRESENT)",
                        badgeClass: "bg-emerald-100 text-emerald-700",
                        title: tls13Present && !probeMap.get("TLSv1.2")?.supported
                          ? "TLS 1.3 available (lean modern profile)"
                          : "TLS 1.3 available",
                        titleClass: "text-emerald-700",
                        icon: CheckCircle2,
                        iconClass: "text-emerald-600",
                        cardClass: "border-emerald-200/70",
                        helper: evidence,
                      }
                    : {
                        version,
                      supported,
                      badge: "UNSAFE (ABSENT)",
                        badgeClass: "bg-red-100 text-red-700",
                        title: "TLS 1.3 not detected",
                        titleClass: "text-red-700",
                        icon: AlertTriangle,
                        iconClass: "text-red-600",
                        cardClass: "border-red-200/70",
                        helper: evidence,
                      };
                });

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tlsCards.map((card) => {
                      const StatusIcon = card.icon;
                      return (
                        <div
                          key={card.version}
                          className={`p-3.5 rounded-2xl bg-white/35 backdrop-blur-md border ${card.cardClass} shadow-[0_10px_28px_rgba(139,0,0,0.10)]`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-extrabold text-[#3d200a] tracking-tight">{card.version}</p>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                                {card.supported ? "Present" : "Absent"}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${card.badgeClass}`}>
                              {card.badge}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${card.iconClass}`} />
                            <p className={`text-xs font-bold ${card.titleClass}`}>{card.title}</p>
                          </div>

                          <p className="text-xs text-[#8a5d33]/70 mt-1.5 wrap-break-word">{card.helper}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {cipherSuitesByVersion.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[#8a5d33]/70 uppercase tracking-wider">Cipher Suites By Version</p>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {cipherSuitesByVersion.map(([version, suites]) => (
                      <div
                        key={version}
                        className="p-3.5 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_12px_30px_rgba(139,0,0,0.12)]"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-sm font-extrabold text-[#3d200a] tracking-tight">{version}</p>
                          <span className="px-2 py-0.5 rounded-full bg-[#8B0000]/10 text-[#8B0000] text-[10px] font-extrabold uppercase tracking-wider">
                            {Array.isArray(suites) ? suites.length : 0} Ciphers
                          </span>
                        </div>
                        {Array.isArray(suites) && suites.length ? (
                          <div className="max-h-48 overflow-y-auto pr-1.5 space-y-2.5">
                            {Array.from(new Set(suites.map((suite) => String(suite).trim()).filter((suite) => suite.length > 0))).map((suite) => (
                              <div
                                key={`${version}-${suite}`}
                                className="rounded-xl border border-white/55 bg-white/45 backdrop-blur-sm px-3 py-2.5"
                              >
                                <p className="text-[12px] font-bold text-[#3d200a] wrap-break-word leading-snug">{formatCipherDisplayName(suite)}</p>
                                <p className="mt-1.5 text-[10px] font-mono text-[#8a5d33]/75 wrap-break-word">{suite}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#8a5d33]/70">No ciphers reported</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="h-px w-full bg-[#8a5d33]/10" />

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">PQC Safety Intelligence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)]">
                  <p className="text-[10px] font-extrabold text-[#8a5d33]/70 uppercase tracking-wider mb-3">Crypto Posture</p>
                  <div className="space-y-2.5 text-sm text-[#3d200a]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">Key Algorithm</span>
                      <span className="font-bold">{toReadable(payload.pqc_safety_intelligence?.certificate_key_algorithm)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">Key Size</span>
                      <span className="font-bold">{toReadable(payload.pqc_safety_intelligence?.certificate_key_size_bits)} bits</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">PFS</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${payload.pqc_safety_intelligence?.pfs_detected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {payload.pqc_safety_intelligence?.pfs_detected ? "Enabled" : "Missing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">PQC Ready</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${payload.pqc_safety_intelligence?.pqc_ready_now ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {payload.pqc_safety_intelligence?.pqc_ready_now ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)]">
                  <p className="text-xs font-bold text-[#8B0000]/80 uppercase tracking-wider mb-2">Recommendations</p>
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-[#3d200a]/80">No recommendations provided.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-[#3d200a] flex items-start gap-2.5 p-2 rounded-xl bg-white/55 border border-white/45">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#8B0000]" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <div className="h-px w-full bg-[#8a5d33]/10" />

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">Certificate Chain Intelligence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)] text-sm text-[#3d200a]">
                  <p className="text-[10px] font-extrabold text-[#8a5d33]/70 uppercase tracking-wider mb-3">Chain Summary</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">Depth</span>
                      <span className="font-bold">{toReadable(payload.certificate_chain_intelligence?.chain_depth_estimate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">Confidence</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase tracking-wider">
                        {toReadable(payload.certificate_chain_intelligence?.chain_complete_confidence)}
                      </span>
                    </div>
                    <div className="text-xs text-[#8a5d33]/80 bg-white/55 border border-white/45 rounded-xl p-2.5 wrap-break-word">
                      {toReadable(payload.certificate_chain_intelligence?.chain_complete_reason)}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide">SCT</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${payload.certificate_chain_intelligence?.sct_present ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {payload.certificate_chain_intelligence?.sct_present ? "Present" : "Missing"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)] text-sm text-[#3d200a] wrap-break-word">
                  <p className="text-[10px] font-extrabold text-[#8a5d33]/70 uppercase tracking-wider mb-3">Authority Endpoints</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide mb-1.5">OCSP URLs</p>
                      <div className="max-h-24 overflow-y-auto pr-1 space-y-1.5">
                        {(Array.isArray(payload.certificate_chain_intelligence?.ocsp_urls) && payload.certificate_chain_intelligence.ocsp_urls.length > 0
                          ? payload.certificate_chain_intelligence.ocsp_urls
                          : ["None"]).map((url: string, idx: number) => (
                          <div key={`ocsp-${idx}`} className="text-xs bg-white/55 border border-white/45 rounded-lg px-2 py-1.5 wrap-break-word">
                            {url === "None" ? (
                              <span className="text-[#3d200a]">None</span>
                            ) : (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-semibold text-[#1e3a8a] hover:text-[#1d4ed8] hover:underline"
                              >
                                <span className="wrap-break-word">{url}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#8a5d33]/70 uppercase tracking-wide mb-1.5">CA Issuers URLs</p>
                      <div className="max-h-24 overflow-y-auto pr-1 space-y-1.5">
                        {(Array.isArray(payload.certificate_chain_intelligence?.ca_issuers_urls) && payload.certificate_chain_intelligence.ca_issuers_urls.length > 0
                          ? payload.certificate_chain_intelligence.ca_issuers_urls
                          : ["None"]).map((url: string, idx: number) => (
                          <div key={`ca-${idx}`} className="text-xs bg-white/55 border border-white/45 rounded-lg px-2 py-1.5 wrap-break-word">
                            {url === "None" ? (
                              <span className="text-[#3d200a]">None</span>
                            ) : (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-semibold text-[#1e3a8a] hover:text-[#1d4ed8] hover:underline"
                              >
                                <span className="wrap-break-word">{url}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {chainIssues.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {chainIssues.map((issue, idx) => (
                    (() => {
                      const parsedEvidence = parseEvidenceFields(issue.evidence);
                      return (
                        <div
                          key={`${issue.issue}-${idx}`}
                          className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-base font-extrabold text-[#3d200a] tracking-tight">{formatIssueName(toReadable(issue.issue))}</p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                issue.detected ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {issue.detected ? "Detected" : "Clean"}
                            </span>
                          </div>

                          <p className="text-xs text-[#8a5d33]/80 mt-2">
                            {issue.detected
                              ? "Requires immediate review. Inspect parsed evidence below."
                              : "No problematic signal detected in this scan."}
                          </p>

                          <details className="mt-3 rounded-xl border border-white/45 bg-white/55 p-2.5">
                            <summary className="cursor-pointer text-[11px] font-extrabold text-[#8B0000] uppercase tracking-wider">Evidence</summary>

                            <div className="mt-3 space-y-3">
                              {parsedEvidence.core.length > 0 && (
                                <div className="grid grid-cols-1 gap-2">
                                  {parsedEvidence.core.map((row) => (
                                    <div key={`${issue.issue}-${row.label}`} className="rounded-lg border border-white/50 bg-white/65 px-2.5 py-2">
                                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8a5d33]/70">{row.label}</p>
                                      <p className="mt-1 text-[12px] font-semibold text-[#3d200a] wrap-break-word">{row.value}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {parsedEvidence.sans.length > 0 && (
                                <div className="rounded-lg border border-white/50 bg-white/65 px-2.5 py-2">
                                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8a5d33]/70">Subject Alternative Names</p>
                                  <div className="mt-1.5 max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
                                    {parsedEvidence.sans.map((san, sanIdx) => (
                                      <span key={`${issue.issue}-san-${sanIdx}`} className="px-2 py-1 rounded-full bg-amber-100/80 text-[11px] font-semibold text-[#3d200a] wrap-break-word">
                                        {san}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {parsedEvidence.fingerprints.length > 0 && (
                                <div className="rounded-lg border border-white/50 bg-white/65 px-2.5 py-2">
                                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8a5d33]/70">Fingerprints</p>
                                  <div className="mt-1.5 space-y-1.5">
                                    {parsedEvidence.fingerprints.map((fp) => (
                                      <div key={`${issue.issue}-${fp.label}`}>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a5d33]/70">{fp.label}</p>
                                        <p className="text-[11px] font-mono text-[#3d200a] wrap-break-word">{fp.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {parsedEvidence.core.length === 0 && parsedEvidence.sans.length === 0 && parsedEvidence.fingerprints.length === 0 && (
                                <div className="max-h-36 overflow-y-auto pr-1 rounded-lg border border-white/50 bg-white/65 p-2">
                                  <pre className="text-[11px] text-[#8a5d33]/80 whitespace-pre-wrap wrap-break-word leading-relaxed">
                                    {compactText(parsedEvidence.raw, 3000)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </section>

            <div className="h-px w-full bg-[#8a5d33]/10" />

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">SSH Intelligence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)] text-sm text-[#3d200a] space-y-1.5">
                  <p className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#8B0000]" />KEX Algorithms</p>
                  <p className="text-xs text-[#8a5d33]/70 wrap-break-word">{toReadable(sshIntelligence.kex_algorithms)}</p>
                  <p className="font-semibold mt-2">Host Key Algorithms</p>
                  <p className="text-xs text-[#8a5d33]/70 wrap-break-word">{toReadable(sshIntelligence.host_key_algorithms)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)] text-sm text-[#3d200a] space-y-1.5">
                  <p className="font-semibold">Encryption Algorithms</p>
                  <p className="text-xs text-[#8a5d33]/70 wrap-break-word">{toReadable(sshIntelligence.encryption_algorithms)}</p>
                  <p className="font-semibold mt-2">MAC Algorithms</p>
                  <p className="text-xs text-[#8a5d33]/70 wrap-break-word">{toReadable(sshIntelligence.mac_algorithms)}</p>
                </div>
              </div>

              {Array.isArray(sshIntelligence.host_keys) && sshIntelligence.host_keys.length > 0 && (
                <div className="p-3 rounded-xl bg-white border border-amber-500/15">
                  <p className="text-xs font-bold text-[#8a5d33]/70 uppercase tracking-wider mb-2">Host Keys</p>
                  <pre className="text-xs text-[#3d200a] overflow-x-auto whitespace-pre-wrap wrap-break-word">
                    {JSON.stringify(sshIntelligence.host_keys, null, 2)}
                  </pre>
                </div>
              )}
            </section>

            {(scanNotes.length > 0 || rawCommands.length > 0) && <div className="h-px w-full bg-[#8a5d33]/10" />}

            {scanNotes.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">Scan Notes</h3>
                <div className="space-y-2">
                  {scanNotes.map((note, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_10px_28px_rgba(139,0,0,0.10)] text-sm text-[#3d200a]">
                      {note}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {rawCommands.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider flex items-center gap-2">
                  <Command className="w-4 h-4 text-[#8B0000]" />
                  Command Provenance
                </h3>
                <div className="space-y-2">
                  {rawCommands.map((cmd, idx) => (
                    <pre
                      key={idx}
                      className="p-3 rounded-xl bg-[#2b1b11] text-[#f8e8dc] text-xs overflow-x-auto border border-[#8a5d33]/20"
                    >
                      {cmd}
                    </pre>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#3d200a] uppercase tracking-wider">Raw Scan Payload</h3>
              <details className="rounded-xl border border-amber-500/20 bg-white/70 p-3">
                <summary className="cursor-pointer text-sm font-bold text-[#3d200a] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#8B0000]" />
                  Expand JSON
                </summary>
                <pre className="mt-3 text-xs text-[#3d200a] overflow-x-auto whitespace-pre-wrap wrap-break-word">
                  {JSON.stringify(parsedRaw, null, 2)}
                </pre>
              </details>
            </section>
          </div>
        )}
      </div>

      <div className="text-xs text-[#8a5d33]/60 flex items-center gap-2 pb-4">
        <Clock3 className="w-3.5 h-3.5" />
        Target ID: {asset.id}
      </div>
    </div>
  );
}
