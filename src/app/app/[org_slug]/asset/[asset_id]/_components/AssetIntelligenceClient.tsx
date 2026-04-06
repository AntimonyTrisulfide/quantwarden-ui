"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { useScanActivity } from "@/components/scan-activity-provider";

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-amber-500/15 bg-white/55 backdrop-blur-xl p-5 shadow-sm ring-1 ring-white/30">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-base font-black tracking-tight text-[#3d200a]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  toneClass,
  title,
}: {
  label: string;
  value: string;
  icon: any;
  toneClass: string;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/10 bg-white/70 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${toneClass}`} />
        <p className="truncate text-base font-black text-[#3d200a]" title={title || value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/55">{label}</p>
      <div className="text-sm font-bold text-[#3d200a] sm:max-w-[70%] sm:text-right">{value}</div>
    </div>
  );
}

function ChipList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  if (values.length === 0) {
    return <p className="text-sm font-semibold text-[#8a5d33]/60">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#3d200a]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function formatScanTimestamp(timestamp: string | null | undefined) {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
}

export default function AssetIntelligenceClient({ org, asset, initialScans, canManageAssets, canScan }: any) {
  const router = useRouter();
  const [scans, setScans] = useState(initialScans || []);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const previousAssetScanActiveRef = useRef(false);
  const { activity, createBatch, pendingBatchType } = useScanActivity(org.id, {
    orgSlug: org.slug,
  });
  const isCreatingBatch = pendingBatchType !== null;

  useEffect(() => {
    setScans(initialScans || []);
  }, [initialScans]);

  const latestScan = scans.length > 0 ? scans[0] : null;
  const latestSuccessfulScan = useMemo(
    () => scans.find((scan: any) => scan.status === "completed") || null,
    [scans]
  );
  const displayScan = latestSuccessfulScan || latestScan;
  const parsed = useMemo(() => parseOpenSSLScanResult(displayScan?.resultData), [displayScan?.resultData]);
  const payload = parsed.raw;
  const summary = parsed.summary;
  const activeProbe = useMemo(() => {
    if (!payload || !summary) return null;
    return (
      payload.tls_versions.find(
        (probe) => probe.supported && (probe.negotiated_protocol || probe.tls_version) === summary.primaryTlsVersion
      ) ||
      payload.tls_versions.find((probe) => probe.supported) ||
      null
    );
  }, [payload, summary]);
  const assetScanActive = useMemo(
    () =>
      Boolean(
        activity?.activeBatches.some((batch) =>
          batch.items.some((item) => item.assetId === asset.id && (item.status === "pending" || item.status === "running"))
        )
      ),
    [activity?.activeBatches, asset.id]
  );

  useEffect(() => {
    if (previousAssetScanActiveRef.current && !assetScanActive) {
      router.refresh();
    }

    previousAssetScanActiveRef.current = assetScanActive;
  }, [assetScanActive, router]);

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await createBatch({
        type: "single",
        assetIds: [asset.id],
      });

      if (!result.ok) {
        throw new Error(result.error || "OpenSSL scan request failed.");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setScanError(error instanceof Error ? error.message : "OpenSSL scan request failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);

    try {
      const streamUrl = `/api/orgs/discover?assetId=${encodeURIComponent(asset.id)}&orgId=${encodeURIComponent(org.id)}`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("done", () => {
        eventSource.close();
        setIsDiscovering(false);
        router.push(`/app/${org.slug}/asset`);
      });

      eventSource.addEventListener("error", () => {
        eventSource.close();
        setIsDiscovering(false);
      });
    } catch (error) {
      console.error(error);
      setIsDiscovering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${asset.value}?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/orgs/assets?id=${asset.id}&orgId=${org.id}`, { method: "DELETE" });
      router.push(`/app/${org.slug}/asset`);
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  };

  const scanStatusTone =
    asset.scanStatus === "expired"
      ? "bg-red-100 text-red-700"
      : latestScan?.status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : latestScan?.status === "failed"
        ? "bg-red-100 text-red-700"
        : latestScan?.status === "pending" || latestScan?.status === "running"
          ? "bg-amber-100 text-amber-700"
          : "bg-white/70 text-[#8a5d33]";
  const showingFallbackSuccessfulScan =
    Boolean(latestScan && latestScan.status === "failed" && latestSuccessfulScan && latestSuccessfulScan.id !== latestScan.id);
  const latestScanError = useMemo(
    () => (latestScan ? parseOpenSSLScanResult(latestScan.resultData).error : null),
    [latestScan]
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-6 py-8 sm:px-8">
      <div className="mb-6">
        <Link
          href={`/app/${org.slug}/asset`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/60 transition-colors hover:text-[#8a5d33]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Management
        </Link>
      </div>

      <div className="mb-8 rounded-[2rem] border border-white/40 bg-white/35 p-6 shadow-xl ring-1 ring-amber-500/10 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-black tracking-tight text-[#3d200a] sm:text-4xl">{asset.value}</h1>
              <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest ${asset.isRoot ? "bg-amber-100 text-amber-700" : "bg-[#8B0000]/10 text-[#8B0000]"}`}>
                {asset.isRoot ? "Root" : "Leaf"}
              </span>
              <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#3d200a]">
                {asset.type}
              </span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest ${scanStatusTone}`}>
                {asset.scanStatus === "expired" ? "dns expired" : latestScan?.status || "unscanned"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#8a5d33]/75">
              <span>Added on {new Date(asset.createdAt).toLocaleDateString()}</span>
              <span>Last scan: {formatScanTimestamp(latestScan?.completedAt || latestScan?.createdAt)}</span>
              {showingFallbackSuccessfulScan && (
                <span>Last successful result: {formatScanTimestamp(latestSuccessfulScan?.completedAt || latestSuccessfulScan?.createdAt)}</span>
              )}
              {payload?.resolved_ip && <span>Resolved IP: {payload.resolved_ip}</span>}
            </div>
          </div>

          {(canManageAssets || canScan) && (
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {activity?.lock.active && (
                <div className="basis-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 xl:max-w-[520px]">
                  {activity.lock.message} Started by {activity.lock.initiatedBy?.name || activity.lock.initiatedBy?.email || "Unknown"}.
                </div>
              )}
              {scanError && (
                <div className="basis-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 xl:max-w-[520px]">
                  {scanError}
                </div>
              )}
              {canManageAssets && (
              <button
                onClick={handleDiscover}
                disabled={isDiscovering || isScanning}
                className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm font-bold text-[#8B0000] transition-all hover:bg-white disabled:opacity-50"
              >
                {isDiscovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                Deep Discover
              </button>
              )}
              {canScan && (
              <button
                onClick={handleScan}
                disabled={isDiscovering || isScanning || isCreatingBatch || assetScanActive || activity?.lock.active}
                className="flex items-center gap-2 rounded-2xl bg-linear-to-r from-[#8B0000] to-[rgb(110,0,0)] px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
              >
                {isScanning || isCreatingBatch || assetScanActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {activity?.lock.active ? "Scan Locked" : isCreatingBatch ? "Starting Scan..." : assetScanActive ? "Scan Running" : "Re-Scan TLS"}
              </button>
              )}
              {canManageAssets && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-2xl border border-red-200/80 bg-white/55 p-3 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!displayScan ? (
        <div className="flex h-56 items-center justify-center rounded-[2rem] border-2 border-dashed border-amber-500/20 bg-amber-50/50">
          <p className="text-sm font-bold text-[#8a5d33]/50">No OpenSSL scan completed yet. Run a scan to populate the intelligence view.</p>
        </div>
      ) : latestScan?.status === "failed" && !latestSuccessfulScan ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-red-700/70">Scan Error</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{latestScanError || "The latest scan failed."}</p>
            </div>
          </div>
        </div>
      ) : parsed.error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-red-700/70">Scan Error</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{parsed.error}</p>
            </div>
          </div>
        </div>
      ) : !payload || !summary ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          The stored scan payload could not be interpreted as an OpenSSL profile.
        </div>
      ) : (
        <div className="space-y-6 pb-10">
          {showingFallbackSuccessfulScan && (
            <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-amber-800/70">Latest Attempt Failed</p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    The most recent scan attempt failed, so the intelligence below is from the last successful OpenSSL scan.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Certificate Validity"
              value={
                summary.dnsMissing
                  ? "Unavailable"
                  : summary.certificateValid === false
                    ? "Invalid"
                    : summary.certificateValid === true
                      ? "Valid"
                      : "Unknown"
              }
              icon={summary.dnsMissing || summary.certificateValid === false ? AlertTriangle : CheckCircle2}
              toneClass={summary.dnsMissing || summary.certificateValid === false ? "text-red-500" : "text-emerald-500"}
            />
            <MetricCard
              label="Primary TLS"
              value={summary.primaryTlsVersion || "Unknown"}
              icon={Lock}
              toneClass="text-[#8B0000]"
            />
            <MetricCard
              label="Expiry"
              value={summary.dnsMissing ? "DNS Expired" : summary.daysRemaining !== null ? `${summary.daysRemaining} days` : "Unknown"}
              icon={Calendar}
              toneClass={summary.dnsMissing ? "text-red-500" : summary.daysRemaining !== null && summary.daysRemaining > 30 ? "text-emerald-500" : "text-amber-500"}
            />
            <MetricCard
              label="Preferred Cipher"
              value={summary.preferredCipher || "Unknown"}
              icon={ShieldCheck}
              toneClass={summary.strongCipher === false ? "text-amber-500" : "text-emerald-500"}
              title={summary.preferredCipher || undefined}
            />
            <MetricCard
              label="Negotiated Group"
              value={summary.negotiatedGroup || "Not reported"}
              icon={KeyRound}
              toneClass="text-indigo-600"
            />
            <MetricCard
              label="Public Key"
              value={summary.publicKeyAlgorithm && summary.publicKeyBits ? `${summary.publicKeyAlgorithm} (${summary.publicKeyBits} bits)` : "Unknown"}
              icon={CheckCircle2}
              toneClass={summary.keySizeAdequate === false ? "text-amber-500" : "text-emerald-500"}
            />
            <MetricCard
              label="Signature Algorithm"
              value={summary.signatureAlgorithm || "Unknown"}
              icon={Zap}
              toneClass="text-[#8B0000]"
            />
            <MetricCard
              label="TLS Downgrade Safety"
              value={summary.tlsVersionSecure === false ? "Weak TLS allowed" : "Yes"}
              icon={summary.tlsVersionSecure === false ? AlertTriangle : CheckCircle2}
              toneClass={summary.tlsVersionSecure === false ? "text-red-500" : "text-emerald-500"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Certificate & Identity" icon={Globe}>
              <div className="divide-y divide-amber-500/10">
                <DetailRow label="Subject Common Name" value={summary.subjectCommonName || "Unknown"} />
                <DetailRow label="Issuer Authority" value={summary.issuerCommonName || "Unknown"} />
                <DetailRow label="Trust Level" value={summary.selfSignedCert ? "Self-Signed" : "Trusted CA"} />
                <DetailRow label="DNS Status" value={summary.dnsMissing ? "Removed from DNS" : "Resolvable"} />
                <DetailRow label="Valid From" value={payload.certificate.not_before || "Unknown"} />
                <DetailRow label="Valid Until" value={payload.certificate.not_after || "Unknown"} />
                <DetailRow label="SAN Coverage" value={`${summary.sanCount} domains`} />
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Subject Alternative Names</p>
                {payload.certificate.san_dns?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {payload.certificate.san_dns.slice(0, 16).map((san) => (
                      <div key={san} className="truncate rounded-xl border border-white bg-white px-3 py-2 text-sm font-semibold text-[#3d200a]" title={san}>
                        {san}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-[#8a5d33]/60">No SAN entries reported.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Negotiation Highlights" icon={Activity}>
              <div className="divide-y divide-amber-500/10">
                <DetailRow label="Preferred Cipher" value={summary.preferredCipher || "Unknown"} />
                <DetailRow label="Negotiated Cipher" value={summary.negotiatedCipher || "Unknown"} />
                <DetailRow label="Negotiated Group" value={summary.negotiatedGroup || "Not reported"} />
                <DetailRow label="Supported TLS Versions" value={summary.supportedTlsVersions.join(", ") || "None"} />
                <DetailRow label="Resolved IP" value={payload.resolved_ip || "Unknown"} />
                <DetailRow label="Scanned At" value={formatScanTimestamp(payload.scanned_at)} />
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Encryption Algorithms</p>
                  <ChipList values={summary.encryptionAlgorithms} emptyLabel="No encryption algorithms reported." />
                </div>

                <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Signature Algorithms</p>
                  <ChipList values={summary.signatureAlgorithms} emptyLabel="No signature algorithms reported." />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Cipher Preference Order" icon={ShieldCheck}>
              {summary.cipherPreferenceOrder.length > 0 ? (
                <div className="space-y-3">
                  {summary.cipherPreferenceOrder.map((cipher, index) => (
                    <div key={cipher} className="flex items-start gap-3 rounded-2xl border border-amber-200/50 bg-[#fdf8f0]/55 px-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#8B0000] ring-1 ring-amber-200">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-black text-[#3d200a]">{cipher}</p>
                        {activeProbe?.accepted_ciphers_in_client_offer_order?.includes(cipher) && (
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
                            Offered in active negotiated version
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#8a5d33]/60">No cipher preference order was reported by the target.</p>
              )}
            </SectionCard>

            <SectionCard title="Key Exchange Groups" icon={Network}>
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Key Exchange Mechanisms</p>
                  <ChipList values={summary.keyExchangeAlgorithms} emptyLabel="No key exchange mechanisms reported." />
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Queried Groups</p>
                  <ChipList values={summary.queriedGroups} emptyLabel="No queried groups reported." />
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Supported Groups</p>
                  <ChipList values={summary.supportedGroups} emptyLabel="No supported groups reported." />
                </div>
              </div>
            </SectionCard>
          </div>

          {payload.tls_versions.some((probe) => probe.supported) && (
            <SectionCard title="Per-Version OpenSSL Probes" icon={Server}>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {payload.tls_versions
                  .filter((probe) => probe.supported)
                  .map((probe) => (
                    <div key={probe.tls_version} className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-[#3d200a]">{probe.negotiated_protocol || probe.tls_version}</p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                          Supported
                        </span>
                      </div>
                      <div className="space-y-2 text-sm font-semibold text-[#3d200a]">
                        <p><span className="text-[#8a5d33]/65">Negotiated cipher:</span> {probe.negotiated_cipher || "Unknown"}</p>
                        <p><span className="text-[#8a5d33]/65">Negotiated group:</span> {probe.negotiated_group || "Not reported"}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        {probe.accepted_ciphers_in_client_offer_order?.length ? (
                          probe.accepted_ciphers_in_client_offer_order.slice(0, 8).map((cipher, index) => (
                            <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#8B0000] ring-1 ring-amber-200">
                                {index + 1}
                              </span>
                              <span className="break-all">{cipher}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm font-semibold text-[#8a5d33]/60">No accepted cipher order reported for this version.</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </SectionCard>
          )}

          {summary.warnings.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-800/60">Analysis Warnings</p>
              <div className="space-y-2">
                {summary.warnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.dnsMissing && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-red-700/70">DNS Expired</p>
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    This target no longer resolves in DNS. The OpenSSL API was reached successfully, but no certificate or TLS session could be negotiated because the domain has been removed from DNS.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
