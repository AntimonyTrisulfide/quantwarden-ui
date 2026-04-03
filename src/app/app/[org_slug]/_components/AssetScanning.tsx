"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Check,
  Fingerprint,
  Search,
  Loader2,
  ShieldCheck,
  Server,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Calendar,
  Square,
  Telescope,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { useScanActivity } from "@/components/scan-activity-provider";

interface AssetScanningProps {
  org: any;
  isAdmin: boolean;
  canScan: boolean;
}

interface ScanData {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  resultData: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ScandAsset {
  id: string;
  value: string;
  type: string;
  isRoot: boolean;
  parentId: string | null;
  scanStatus?: string | null;
  lastScanDate?: string | null;
  latestScan: ScanData | null;
  latestSuccessfulScan?: ScanData | null;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return format(date, "dd/MM/yyyy, HH:mm");

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMinutes > 0 ? `${diffHours}h ${remainingMinutes}m ago` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }

  return format(date, "dd/MM/yyyy, HH:mm");
}

export default function AssetScanning({ org, isAdmin, canScan }: AssetScanningProps) {
  const [assets, setAssets] = useState<ScandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "successful" | "timeout" | "dnsExpired" | "unscanned">("all");
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStoppingBatch, setIsStoppingBatch] = useState(false);
  const [stableAssetCategory, setStableAssetCategory] = useState<Record<string, "successful" | "timeout" | "dnsExpired" | "unscanned">>({});
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const activitySnapshotRef = useRef<{
    activeCount: number;
    latestCompletedBatchId: string | null;
    progressSignature: string;
  } | null>(null);
  const initialActivityCheckDoneRef = useRef(false);
  const lastReconnectAttemptAtRef = useRef(0);
  const {
    hydrated,
    connected,
    activity,
    createBatch,
    cancelBatch,
    checkForActiveScans,
    refreshActivity,
    pendingBatchType,
    cancellingBatchId,
  } = useScanActivity(org.id, {
    orgSlug: org.slug,
  });

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/scans?orgId=${org.id}`);
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

  useEffect(() => {
    if (!hydrated || initialActivityCheckDoneRef.current) return;
    initialActivityCheckDoneRef.current = true;
    void checkForActiveScans({
      showIdleToast: true,
      startStreamOnActive: true,
    });
  }, [checkForActiveScans, hydrated]);

  useEffect(() => {
    if (!hydrated || connected || !activity?.activeBatches.length) return;
    const interval = window.setInterval(() => {
      void fetchAssets();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [activity?.activeBatches.length, connected, fetchAssets, hydrated]);

  useEffect(() => {
    if (!hydrated || connected || !activity?.activeBatches.length) return;

    const now = Date.now();
    if (now - lastReconnectAttemptAtRef.current < 12000) return;
    lastReconnectAttemptAtRef.current = now;

    void checkForActiveScans({
      showIdleToast: false,
      startStreamOnActive: true,
    });
  }, [activity?.activeBatches.length, checkForActiveScans, connected, hydrated]);

  useEffect(() => {
    const container = listScrollRef.current;
    if (!container) return;

    const onScroll = () => {
      const top = container.scrollTop;
      setIsHeaderCompact((prev) => (prev ? top > 42 : top > 68));
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!hydrated || !activity) return;

    const progressSignature = (activity.activeBatches || [])
      .map((batch) => [
        batch.id,
        batch.status,
        batch.completedAssets,
        batch.failedAssets,
        batch.pendingAssets,
        batch.runningAssets,
        batch.percentComplete,
      ].join(":"))
      .join("|");

    const nextSnapshot = {
      activeCount: activity.activeBatches.length,
      latestCompletedBatchId: activity.latestCompletedBatch?.id || null,
      progressSignature,
    };
    const previousSnapshot = activitySnapshotRef.current;
    activitySnapshotRef.current = nextSnapshot;

    if (!previousSnapshot) return;

    if (
      previousSnapshot.activeCount !== nextSnapshot.activeCount ||
      previousSnapshot.latestCompletedBatchId !== nextSnapshot.latestCompletedBatchId ||
      previousSnapshot.progressSignature !== nextSnapshot.progressSignature
    ) {
      void fetchAssets();
    }
  }, [activity, fetchAssets, hydrated]);

  const handleScan = async (assetId: string) => {
    setActionError(null);
    const result = await createBatch({
      type: "single",
      assetIds: [assetId],
    });

    if (!result.ok) {
      setActionError(result.error || "Failed to queue scan.");
    } else {
      void fetchAssets();
    }
  };

  const handleScanAll = async () => {
    setActionError(null);
    const scanableAssetIds = assets
      .filter((asset) => asset.type === "domain")
      .map((asset) => asset.id);

    const result = await createBatch({
      type: "full",
      assetIds: scanableAssetIds,
    });

    if (!result.ok) {
      setActionError(result.error || "Failed to start full scan.");
    } else {
      setSelectedAssetIds([]);
      void fetchAssets();
    }
  };

  const handleGroupScan = async () => {
    setActionError(null);
    const result = await createBatch({
      type: "group",
      assetIds: selectedAssetIds,
    });

    if (!result.ok) {
      setActionError(result.error || "Failed to start group scan.");
    } else {
      setSelectedAssetIds([]);
      void fetchAssets();
    }
  };

  const handleStopBatch = async (batchId: string) => {
    setActionError(null);
    setIsStoppingBatch(true);

    try {
      const latestActivity = await refreshActivity();
      const latestActiveIds = latestActivity?.activeBatches.map((batch) => batch.id) || [];
      const targetBatchId = latestActiveIds.includes(batchId)
        ? batchId
        : (latestActiveIds[0] || null);

      if (!targetBatchId) {
        setActionError("No active scan batch found to stop.");
        return;
      }

      const result = await cancelBatch(targetBatchId);
      if (!result.ok) {
        setActionError(result.error || "Failed to stop the active scan batch.");
      } else {
        setSelectedAssetIds([]);
        void fetchAssets();
      }
    } finally {
      setIsStoppingBatch(false);
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((previous) =>
      previous.includes(assetId)
        ? previous.filter((id) => id !== assetId)
        : [...previous, assetId]
    );
  };

  const activeTaskByAsset = new Map(
    (activity?.activeBatches || [])
      .flatMap((batch) =>
        batch.items
          .filter((item) => item.status === "pending" || item.status === "running")
          .map((item) => [
            item.assetId,
            { status: item.status, batchType: batch.type, createdAt: item.createdAt },
          ] as const)
      )
  );

  const fullScan = activity?.activeBatches.find((batch) => batch.type === "full") || null;
  const groupScan = activity?.activeBatches.find((batch) => batch.type === "group") || null;
  const activeBatch = activity?.activeBatches[0] || null;
  const isFullScanActive = Boolean(fullScan);
  const isCreatingFullScan = pendingBatchType === "full";
  const isCreatingGroupScan = pendingBatchType === "group";
  const isCreatingAnyBatch = pendingBatchType !== null;
  const isStoppingActiveBatch = Boolean(activeBatch && cancellingBatchId === activeBatch.id) || isStoppingBatch;
  const orgScanLocked = Boolean(activity?.lock.active);
  const lockMessage = activity?.lock.active
    ? `${activity.lock.message} Started by ${activity.lock.initiatedBy?.name || activity.lock.initiatedBy?.email || "Unknown"} ${formatDistanceToNow(new Date(activity.lock.initiatedAt || new Date().toISOString()), { addSuffix: true })}.`
    : null;

  const domainAssets = assets.filter((a) => a.type === "domain");
  const totalDiscovered = domainAssets.length;

  useEffect(() => {
    setStableAssetCategory((previous) => {
      const next: Record<string, "successful" | "timeout" | "dnsExpired" | "unscanned"> = {};
      let changed = false;

      for (const asset of domainAssets) {
        const hasActiveTask = activeTaskByAsset.has(asset.id);
        const previousCategory = previous[asset.id];

        let terminalCategory: "successful" | "timeout" | "dnsExpired" | "unscanned" | null = null;
        if (asset.scanStatus === "expired") {
          terminalCategory = "dnsExpired";
        } else if (asset.scanStatus === "failed") {
          terminalCategory = "timeout";
        } else if (asset.scanStatus === "completed") {
          terminalCategory = "successful";
        } else if (asset.latestScan?.status === "completed") {
          terminalCategory = "successful";
        } else if (asset.latestScan?.status === "failed") {
          terminalCategory = "timeout";
        } else if (!asset.latestScan && !hasActiveTask) {
          terminalCategory = "unscanned";
        }

        // Keep prior terminal category while item is currently pending/running.
        const resolvedCategory = terminalCategory ?? previousCategory ?? "unscanned";
        next[asset.id] = resolvedCategory;

        if (previousCategory !== resolvedCategory) {
          changed = true;
        }
      }

      if (!changed) {
        const previousKeys = Object.keys(previous);
        if (previousKeys.length === Object.keys(next).length) {
          return previous;
        }
      }

      return next;
    });
  }, [activeTaskByAsset, domainAssets]);

  const unscanned = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "unscanned").length;
  const dnsExpired = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "dnsExpired").length;
  const scanTimeout = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "timeout").length;
  const scanSuccessful = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "successful").length;

  let filteredAssets = domainAssets.filter(
    (a) => a.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filterType === "successful") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "successful");
  } else if (filterType === "timeout") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "timeout");
  } else if (filterType === "dnsExpired") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "dnsExpired");
  } else if (filterType === "unscanned") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "unscanned");
  }

  const filteredAssetIdKey = filteredAssets.map((asset) => asset.id).join("|");

  useEffect(() => {
    const validIds = new Set(filteredAssets.map((asset) => asset.id));
    setSelectedAssetIds((previous) => {
      const next = previous.filter((assetId) => validIds.has(assetId));
      return next.length === previous.length && next.every((assetId, index) => assetId === previous[index])
        ? previous
        : next;
    });
  }, [filteredAssetIdKey, filteredAssets]);

  const renderScanDetails = (scan: ScanData) => {
    if (scan.status === "pending" || scan.status === "running") {
      return (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-amber-700">OpenSSL TLS scan currently running...</p>
        </div>
      );
    }

    if (scan.status === "failed") {
      let errMsg = "Timeout Possibly Port Not Open";
      if (scan.resultData) {
        try {
          const parsed = JSON.parse(scan.resultData);
          if (parsed.detail) errMsg = parsed.detail;
          else if (parsed.error) errMsg = parsed.error;
          else if (typeof parsed === "string") errMsg = parsed;
        } catch {}
      }

      return (
        <div className="p-4 bg-red-50/80 rounded-xl border border-red-200/50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700 font-mono tracking-tight">{errMsg}</p>
        </div>
      );
    }

    if (!scan.resultData) return null;

    const parsed = parseOpenSSLScanResult(scan.resultData);

    if (parsed.error) {
      return (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{parsed.error}</p>
        </div>
      );
    }

    if (!parsed.raw || !parsed.summary) {
      return <p className="text-sm text-red-500">Stored scan payload is missing OpenSSL profile data.</p>;
    }

    const payload = parsed.raw;
    const summary = parsed.summary;
    const sans = payload.certificate.san_dns || [];
    const activeProbe =
      payload.tls_versions.find(
        (probe) => probe.supported && (probe.negotiated_protocol || probe.tls_version) === summary.primaryTlsVersion
      ) ||
      payload.tls_versions.find((probe) => probe.supported) ||
      null;

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

    const chipClass = "px-2.5 py-1 rounded-full bg-white border border-amber-200 text-[11px] font-bold text-[#3d200a]";

    return (
      <div className="p-5 bg-white rounded-xl border border-[#8a5d33]/10 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Item
            label="Certificate Validity"
            icon={summary.dnsMissing || summary.certificateValid === false ? AlertTriangle : CheckCircle2}
            colorClass={summary.dnsMissing || summary.certificateValid === false ? "text-red-500" : "text-emerald-500"}
            value={
              summary.dnsMissing
                ? "Unavailable"
                : summary.certificateValid === false
                  ? "Invalid"
                  : summary.certificateValid === true
                    ? "Valid"
                    : "Unknown"
            }
          />
          <Item
            label="TLS Protocol"
            icon={Lock}
            colorClass="text-blue-500"
            value={summary.primaryTlsVersion || "Unknown"}
          />
          <Item
            label="Expiry"
            icon={Calendar}
            colorClass={summary.dnsMissing ? "text-red-500" : summary.daysRemaining !== null && summary.daysRemaining > 30 ? "text-emerald-500" : "text-amber-500"}
            value={summary.dnsMissing ? "DNS Expired" : summary.daysRemaining !== null ? `${summary.daysRemaining} days` : "Unknown"}
          />
          <Item
            label="Preferred Cipher"
            icon={ShieldCheck}
            colorClass={summary.strongCipher === false ? "text-amber-500" : "text-emerald-500"}
            title={summary.preferredCipher || undefined}
            value={summary.preferredCipher || "Unknown"}
          />
        </div>

        <div className="h-px w-full bg-[#8a5d33]/5"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Item
            label="Subject (Common Name)"
            icon={Globe}
            colorClass="text-indigo-500"
            title={summary.subjectCommonName || undefined}
            value={summary.subjectCommonName || "Unknown"}
          />
          <Item
            label="Issuer Authority"
            icon={Server}
            colorClass="text-indigo-500"
            title={summary.issuerCommonName || undefined}
            value={summary.issuerCommonName || "Unknown"}
          />
          <Item
            label="Subject Alt Names"
            icon={Globe}
            colorClass="text-blue-500"
            value={`${sans.length} domains`}
          >
            {sans.length > 0 && (
              <div className="absolute z-50 top-full left-0 mt-2 hidden group-hover:block w-72 bg-[#3d200a] text-white text-xs p-3 rounded-xl shadow-xl max-h-48 overflow-y-auto ring-1 ring-white/10 break-all leading-tight">
                {sans.map((s: string) => <div key={s} className="py-0.5 opacity-90">{s}</div>)}
              </div>
            )}
          </Item>
          <Item
            label="Negotiated Group"
            icon={Lock}
            colorClass="text-indigo-500"
            value={summary.negotiatedGroup || "Not reported"}
          />
        </div>

        <div className="h-px w-full bg-[#8a5d33]/5"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Item
            label="Public Key Size"
            icon={summary.keySizeAdequate === false ? AlertTriangle : CheckCircle2}
            colorClass={summary.keySizeAdequate === false ? "text-amber-500" : "text-emerald-500"}
            value={summary.publicKeyAlgorithm && summary.publicKeyBits ? `${summary.publicKeyAlgorithm} (${summary.publicKeyBits} bits)` : "Unknown"}
          />
          <Item
            label="Signature Algorithm"
            icon={Zap}
            colorClass="text-blue-500"
            value={summary.signatureAlgorithm || "Unknown"}
          />
          <Item
            label="Strong Cipher"
            icon={summary.strongCipher === false ? AlertTriangle : CheckCircle2}
            colorClass={summary.strongCipher === false ? "text-amber-500" : "text-emerald-500"}
            value={summary.strongCipher === false ? "No" : "Yes"}
          />
          <Item
            label="TLS Downgrade Safe"
            icon={summary.tlsVersionSecure === false ? AlertTriangle : CheckCircle2}
            colorClass={summary.tlsVersionSecure === false ? "text-amber-500" : "text-emerald-500"}
            value={summary.tlsVersionSecure === false ? "Weak TLS allowed" : "Yes"}
          />
        </div>

        <div className="h-px w-full bg-[#8a5d33]/5"></div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4 space-y-3">
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest">Supported TLS Versions</p>
            <div className="flex flex-wrap gap-2">
              {summary.supportedTlsVersions.length > 0 ? (
                summary.supportedTlsVersions.map((version) => (
                  <span key={version} className={chipClass}>{version}</span>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No supported versions reported</span>
              )}
            </div>
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest pt-2">Active Version Cipher Order</p>
            <div className="space-y-2">
              {activeProbe?.accepted_ciphers_in_client_offer_order?.length ? (
                activeProbe.accepted_ciphers_in_client_offer_order.slice(0, 6).map((cipher, index) => (
                  <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                    <span className="w-6 h-6 rounded-full bg-white border border-amber-200 flex items-center justify-center text-[11px] font-extrabold text-[#8B0000]">{index + 1}</span>
                    <span className="break-all">{cipher}</span>
                  </div>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No per-version cipher order reported</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4 space-y-3">
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest">Key Exchange & Groups</p>
            <div className="flex flex-wrap gap-2">
              {summary.keyExchangeAlgorithms.length > 0 ? (
                summary.keyExchangeAlgorithms.map((algorithm) => (
                  <span key={algorithm} className={chipClass}>{algorithm}</span>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No key exchange algorithms reported</span>
              )}
            </div>
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest pt-2">Queried Groups</p>
            <div className="flex flex-wrap gap-2">
              {summary.queriedGroups.length > 0 ? (
                summary.queriedGroups.map((group) => (
                  <span key={group} className={chipClass}>{group}</span>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No queried groups reported</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4 space-y-3">
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest">Supported Groups</p>
            <div className="flex flex-wrap gap-2">
              {summary.supportedGroups.length > 0 ? (
                summary.supportedGroups.map((group) => (
                  <span key={group} className={chipClass}>{group}</span>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No supported groups reported</span>
              )}
            </div>
            <p className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-widest pt-2">Global Cipher Preference</p>
            <div className="space-y-2">
              {summary.cipherPreferenceOrder.length > 0 ? (
                summary.cipherPreferenceOrder.slice(0, 8).map((cipher, index) => (
                  <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                    <span className="w-6 h-6 rounded-full bg-white border border-amber-200 flex items-center justify-center text-[11px] font-extrabold text-[#8B0000]">{index + 1}</span>
                    <span className="break-all">{cipher}</span>
                  </div>
                ))
              ) : (
                <span className="text-sm font-semibold text-[#8a5d33]/60">No cipher preference data reported</span>
              )}
            </div>
          </div>
        </div>

        {summary.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest mb-3">Analysis Warnings</p>
            <div className="space-y-2">
              {summary.warnings.map((warning) => (
                <div key={warning} className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.dnsMissing && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700/70">DNS Expired</p>
                <p className="mt-1 text-sm font-semibold text-red-700">
                  The domain no longer resolves in DNS. This is different from an OpenSSL request failure.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-amber-500/20">
      <div className={`${isHeaderCompact ? "px-6 py-2 sm:px-8 sm:py-2" : "p-6 sm:p-8"} bg-linear-to-br from-white/80 to-white/40 border-b border-amber-500/10 shrink-0 transition-all duration-300`}>
        <div className={`flex flex-col ${isHeaderCompact ? "gap-1" : "gap-6"} transition-all duration-300`}>
          <div className={`flex ${isHeaderCompact ? "items-center" : "items-start"} gap-4 transition-all duration-300`}>
            <div className={`${isHeaderCompact ? "w-10 h-10 rounded-xl" : "w-12 h-12 rounded-2xl"} bg-linear-to-br from-[#8B0000] to-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-900/20 transition-all duration-300`}>
              <ShieldCheck className={`${isHeaderCompact ? "w-5 h-5" : "w-6 h-6"} text-white transition-all duration-300`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className={`${isHeaderCompact ? "text-xl" : "text-2xl"} font-black text-[#3d200a] tracking-tight transition-all duration-300`}>OpenSSL TLS Scanning</h2>
                {isHeaderCompact && (
                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <Link
                        href={`/app/${org.slug}/explore`}
                        data-tip="Open Explorer"
                        className="action-tip inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300 bg-linear-to-r from-[#f5cf58] to-[#eab308] text-[#5a3500] shadow-sm transition-all hover:brightness-105"
                      >
                        <Telescope className="h-4 w-4" />
                      </Link>
                    )}
                    {canScan && activeBatch && (
                      <button
                        onClick={() => void handleStopBatch(activeBatch.id)}
                        disabled={isStoppingActiveBatch}
                        data-tip="Stop Active Scan"
                        className="action-tip inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#991b1b] text-white shadow-[0_12px_28px_rgba(127,29,29,0.28)] transition-all hover:bg-[#7f1d1d] disabled:opacity-50"
                      >
                        {isStoppingActiveBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                      </button>
                    )}
                    {canScan && (
                      <>
                        <button
                          onClick={() => void handleGroupScan()}
                          disabled={orgScanLocked || isCreatingAnyBatch || selectedAssetIds.length < 2}
                          data-tip="Scan Group"
                          className="action-tip inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#8B0000]/20 bg-white/80 text-[#8B0000] transition-all hover:bg-white disabled:opacity-50"
                        >
                          {isCreatingGroupScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => void handleScanAll()}
                          disabled={orgScanLocked || isCreatingAnyBatch}
                          data-tip={isFullScanActive ? `Full Scan Running (${(fullScan?.completedAssets ?? 0) + (fullScan?.failedAssets ?? 0)}/${fullScan?.totalAssets ?? 0})` : "Scan All Assets"}
                          className="action-tip inline-flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-[#8B0000] to-[rgb(110,0,0)] text-white transition-colors hover:from-[#9f0000] hover:to-[#7a0000] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isFullScanActive || isCreatingFullScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className={`${isHeaderCompact ? "hidden" : "text-sm"} font-medium text-[#8a5d33]/80 mt-1 max-w-xl leading-relaxed transition-all duration-300`}>
                Deep-profile your domains with OpenSSL to inspect certificates, negotiated groups, and target cipher preference order.
              </p>
              {!isHeaderCompact && (
              <div className="mt-4 flex flex-wrap gap-2">
                {isAdmin && (
                  <Link
                    href={`/app/${org.slug}/explore`}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-linear-to-r from-[#f5cf58] to-[#eab308] px-5 py-2 text-sm font-bold text-[#5a3500] shadow-sm transition-all hover:brightness-105"
                  >
                    <Telescope className="h-4 w-4" />
                    Open Explorer
                  </Link>
                )}
                {canScan && (
                  <>
                  {activeBatch && (
                    <button
                      onClick={() => void handleStopBatch(activeBatch.id)}
                      disabled={isStoppingActiveBatch}
                      className="inline-flex items-center gap-2 rounded-full bg-[#991b1b] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_34px_rgba(127,29,29,0.24)] transition-all hover:bg-[#7f1d1d] disabled:opacity-50"
                    >
                      {isStoppingActiveBatch ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      Stop Active Scan
                    </button>
                  )}
                  <div className="relative group">
                    <button
                      onClick={() => void handleGroupScan()}
                      disabled={orgScanLocked || isCreatingAnyBatch || selectedAssetIds.length < 2}
                      className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/20 bg-white/80 px-5 py-2.5 text-sm font-bold text-[#8B0000] transition-all hover:bg-white disabled:opacity-50"
                    >
                      {isCreatingGroupScan ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Fingerprint className="w-4 h-4" />
                      )}
                      {isCreatingGroupScan
                        ? "Starting Group Scan..."
                        : selectedAssetIds.length >= 2
                          ? `Scan Group (${selectedAssetIds.length})`
                          : "Scan Group"}
                    </button>
                    {selectedAssetIds.length < 2 && !isCreatingGroupScan && (
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#8B0000]/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#8B0000] shadow-md group-hover:inline-block">
                        Select at least 2 assets
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => void handleScanAll()}
                    disabled={orgScanLocked || isCreatingAnyBatch}
                    className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-[#8B0000] to-[rgb(110,0,0)] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:from-[#9f0000] hover:to-[#7a0000] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFullScanActive || isCreatingFullScan ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {isCreatingFullScan
                      ? "Starting Full Scan..."
                      : isFullScanActive
                      ? `Full Scan Running (${(fullScan?.completedAssets ?? 0) + (fullScan?.failedAssets ?? 0)}/${fullScan?.totalAssets ?? 0})`
                      : "Scan All Assets"}
                  </button>
                  </>
                )}
              </div>
              )}
              {canScan && (fullScan || groupScan) && (
                <p className={`${isHeaderCompact ? "hidden" : "mt-2 text-[11px]"} font-bold text-[#8a5d33]/65`}>
                  {fullScan
                    ? `Full scan started ${formatDistanceToNow(new Date(fullScan.createdAt), { addSuffix: true })}`
                    : groupScan
                      ? `Group scan started ${formatDistanceToNow(new Date(groupScan.createdAt), { addSuffix: true })}`
                      : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {actionError}
          </div>
        )}
        {activity?.lock.active && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {lockMessage}
          </div>
        )}
        {!canScan && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Your role does not currently have permission to launch OpenSSL scans.
          </div>
        )}
      </div>

      <div className={`${isHeaderCompact ? "px-5 py-1.5" : "px-6 py-4"} bg-white/40 border-b border-amber-500/10 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between ${isHeaderCompact ? "gap-2" : "gap-4"} transition-all duration-300`}>
        <div className={`relative w-full ${isHeaderCompact ? "max-w-[340px]" : "max-w-sm"} transition-all duration-300`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a5d33]/40" />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/50 border border-amber-500/20 rounded-xl text-sm font-medium text-[#3d200a] placeholder:text-[#8a5d33]/40 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
        </div>

        <div className={`flex items-center overflow-x-auto px-1 sm:px-0 scrollbar-hide shrink-0 ${isHeaderCompact ? "gap-0.5 sm:gap-1" : "gap-1 sm:gap-2"} transition-all duration-300`}>
          <button
            onClick={() => setFilterType("all")}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all outline-none ${filterType === "all" ? "bg-[#8B0000]/7" : "hover:bg-black/5"}`}
          >
            <span className="text-[9px] uppercase tracking-widest font-bold text-[#8a5d33]/50">Inventory</span>
            {loading ? (
              <span className="scan-stat-skeleton mt-1 h-4 w-7 rounded-md" aria-label="Loading inventory" />
            ) : (
              <span className="text-sm font-black text-[#3d200a]">{totalDiscovered}</span>
            )}
          </button>

          <div className="w-px h-6 bg-amber-500/20 hidden sm:block mx-1"></div>

          <button
            onClick={() => setFilterType("successful")}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all outline-none ${filterType === "successful" ? "bg-emerald-500/10" : "hover:bg-black/5"}`}
          >
            <span className="text-[9px] uppercase tracking-widest font-bold text-[#8a5d33]/50">Successful</span>
            {loading ? (
              <span className="scan-stat-skeleton mt-1 h-4 w-7 rounded-md" aria-label="Loading successful count" />
            ) : (
              <span className="text-sm font-black text-emerald-600">{scanSuccessful}</span>
            )}
          </button>

          <div className="w-px h-6 bg-amber-500/20 hidden sm:block mx-1"></div>

          <button
            onClick={() => setFilterType("timeout")}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all outline-none ${filterType === "timeout" ? "bg-red-500/10" : "hover:bg-black/5"}`}
          >
            <span
              className="text-[9px] uppercase tracking-widest font-bold text-[#8a5d33]/50"
              title="Timeout Possibly Port Not Open"
            >
              Timeout
            </span>
            {loading ? (
              <span className="scan-stat-skeleton mt-1 h-4 w-7 rounded-md" aria-label="Loading timeout count" />
            ) : (
              <span className="text-sm font-black text-red-600">{scanTimeout}</span>
            )}
          </button>

          <div className="w-px h-6 bg-amber-500/20 hidden sm:block mx-1"></div>

          <button
            onClick={() => setFilterType("dnsExpired")}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all outline-none ${filterType === "dnsExpired" ? "bg-red-500/10" : "hover:bg-black/5"}`}
          >
            <span className="text-[9px] uppercase tracking-widest font-bold text-[#8a5d33]/50">DNS Expired</span>
            {loading ? (
              <span className="scan-stat-skeleton mt-1 h-4 w-7 rounded-md" aria-label="Loading DNS expired count" />
            ) : (
              <span className="text-sm font-black text-red-700">{dnsExpired}</span>
            )}
          </button>

          <div className="w-px h-6 bg-amber-500/20 hidden sm:block mx-1"></div>

          <button
            onClick={() => setFilterType("unscanned")}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all outline-none ${filterType === "unscanned" ? "bg-amber-500/10" : "hover:bg-black/5"}`}
          >
            <span className="text-[9px] uppercase tracking-widest font-bold text-[#8a5d33]/50">Unscanned</span>
            {loading ? (
              <span className="scan-stat-skeleton mt-1 h-4 w-7 rounded-md" aria-label="Loading unscanned count" />
            ) : (
              <span className="text-sm font-black text-amber-600">{unscanned}</span>
            )}
          </button>
        </div>

        {canScan && (
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-[#8a5d33]">
            <span className="uppercase tracking-widest text-[#8a5d33]/55">Selected</span>
            <span className="rounded-full bg-[#8B0000]/8 px-2 py-1 text-[#8B0000]">{selectedAssetIds.length}</span>
          </div>
        )}
      </div>

      <div ref={listScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-[#8B0000] animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-[#8a5d33]/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#3d200a]">No domains found</h3>
            <p className="text-sm text-[#8a5d33]/60 mt-1">
              Add domain assets in the Asset Management tab to scan them here.
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const task = activeTaskByAsset.get(asset.id);
            const isQueued = task?.status === "pending";
            const isRunning = task?.status === "running";
            const isDnsExpired = asset.scanStatus === "expired";
            const assetCategory = stableAssetCategory[asset.id] || "unscanned";
            const statusLabel = isQueued
              ? "queued"
              : isRunning
                ? "running"
                : isDnsExpired || assetCategory === "dnsExpired"
                  ? "dns expired"
                  : assetCategory === "successful"
                    ? "success"
                    : assetCategory === "timeout"
                      ? "timeout"
                      : "not scanned yet";
            const statusTime = isQueued || isRunning
              ? task?.createdAt || null
              : (asset.lastScanDate || asset.latestScan?.completedAt || asset.latestScan?.createdAt || null);
            const isExpanded = expandedAssetId === asset.id;
            const isSelected = selectedAssetIds.includes(asset.id);

            return (
              <div key={asset.id} className="bg-white/60 rounded-xl border border-amber-500/10 transition-all hover:bg-white/80 overflow-hidden shadow-sm">
                <div
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                >
                  <div className="flex items-center gap-4">
                    {canScan && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleAssetSelection(asset.id);
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                          isSelected
                            ? "border-[#8B0000] bg-[#8B0000] text-white"
                            : "border-amber-500/20 bg-white text-transparent hover:border-[#8B0000]/40"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#3d200a] leading-tight flex items-center gap-2">
                        {asset.value}
                        {asset.isRoot ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] uppercase tracking-widest leading-none">Root</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] uppercase tracking-widest leading-none">Leaf</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {(asset.latestScan || statusTime) ? (
                          <>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isQueued ? "text-slate-500" :
                              isRunning ? "text-amber-500 animate-pulse" :
                              statusLabel === "dns expired" ? "text-red-600" :
                              statusLabel === "success" ? "text-emerald-500" :
                              statusLabel === "timeout" ? "text-red-500" : "text-[#8a5d33]/60"
                            }`}>
                              <span title={statusLabel === "timeout" ? "Timeout Possibly Port Not Open" : undefined}>
                                {statusLabel}
                              </span>
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#8a5d33]/20"></span>
                            <span className="text-[10px] font-bold text-[#8a5d33]/50">
                              {formatRelativeTime(statusTime)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-wider">
                            {isQueued ? "Queued" : isRunning ? "Running" : "Not Scanned Yet"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4 sm:mt-0">
                    <Link
                      href={`/app/${org.slug}/asset/${asset.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8B0000] bg-white border border-[#8B0000]/20 rounded-lg hover:bg-[#8B0000]/5 transition-colors"
                    >
                      Details
                    </Link>
                    {canScan && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleScan(asset.id);
                        }}
                        disabled={isQueued || isRunning || orgScanLocked || isCreatingAnyBatch}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8B0000] bg-[#8B0000]/5 border border-[#8B0000]/15 rounded-lg hover:bg-[#8B0000]/10 transition-colors disabled:opacity-50"
                      >
                        {isQueued || isRunning || isCreatingAnyBatch ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        {orgScanLocked && !isQueued && !isRunning ? "Locked" : isRunning ? "Scanning" : isQueued ? "Queued" : "Scan TLS"}
                      </button>
                    )}
                    <button className="p-1.5 text-[#8a5d33]/40 hover:text-[#8a5d33] transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-amber-500/10 mt-2 bg-linear-to-b from-transparent to-[#fdf8f0]/40">
                    <div className="pt-4">
                      {isQueued ? (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                          <Clock className="w-5 h-5 text-slate-500 shrink-0" />
                          <p className="text-sm font-semibold text-slate-700">
                            This scan is queued and will start as soon as a worker slot becomes free.
                          </p>
                        </div>
                      ) : isRunning ? (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                          <div>
                            <p className="text-sm font-semibold text-amber-700">OpenSSL TLS scan currently running...</p>
                            {asset.latestScan?.status === "completed" && (
                              <p className="mt-1 text-xs font-semibold text-amber-700/80">
                                Previous completed result remains available on the asset details page while this refresh runs.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (asset.latestSuccessfulScan || asset.latestScan) ? (
                        <div className="space-y-3">
                          {asset.latestScan?.status === "failed" && asset.latestSuccessfulScan && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                              The latest scan attempt timed out, so the most recent successful OpenSSL result is shown below.
                            </div>
                          )}
                          {renderScanDetails(asset.latestSuccessfulScan || asset.latestScan!)}
                        </div>
                      ) : (
                        <div className="p-4 bg-white rounded-xl border border-amber-200/60">
                          <p className="text-sm font-semibold text-[#8a5d33]/70">
                            No completed scan is available yet for this asset.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .scan-stat-skeleton {
          position: relative;
          overflow: hidden;
          background: rgba(138, 93, 51, 0.18);
        }

        .scan-stat-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-120%);
          background: linear-gradient(100deg, transparent 10%, rgba(255, 255, 255, 0.75) 50%, transparent 90%);
          animation: scan-stat-shimmer 1.5s ease-in-out infinite;
        }

        @keyframes scan-stat-shimmer {
          100% {
            transform: translateX(120%);
          }
        }

        .action-tip {
          position: relative;
        }

        .action-tip::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          top: calc(100% + 8px);
          transform: translateX(-50%);
          white-space: nowrap;
          border-radius: 0.6rem;
          border: 1px solid rgba(139, 0, 0, 0.22);
          background: rgba(255, 255, 255, 0.98);
          color: #6b0000;
          padding: 0.35rem 0.5rem;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.01em;
          box-shadow: 0 10px 22px rgba(61, 32, 10, 0.18);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.16s ease;
          z-index: 30;
        }

        .action-tip:hover::after,
        .action-tip:focus-visible::after {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
