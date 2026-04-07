"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface OrgOverviewProps {
  org: any;
  isAdmin: boolean;
}

type CountDatum = {
  name: string;
  value: number;
};

type PieDatum = {
  name: string;
  value: number;
};

function isPreferredOverviewCipher(cipher: string) {
  const normalized = cipher.toUpperCase();
  return (
    normalized.includes("CHACHA20_POLY1305") ||
    normalized.includes("AES_256") ||
    normalized.includes("AES-256") ||
    normalized.includes("AES256")
  );
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function RankedTable({
  rows,
  emptyLabel,
  rowHref,
  highlightName,
}: {
  rows: CountDatum[];
  emptyLabel: string;
  rowHref?: (name: string) => string;
  highlightName?: (name: string) => boolean;
}) {
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-amber-500/20 bg-white/40 p-5 text-center">
        <p className="text-sm font-semibold text-[#8a5d33]/55">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const content = (
          <div
            className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${
              rowHref
                ? "border-[#8a5d33]/10 bg-white/55 hover:border-[#8B0000]/20 hover:bg-[#8B0000]/5"
                : "border-[#8a5d33]/10 bg-white/55"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/60 bg-white text-sm font-extrabold text-[#8B0000]">
                {index + 1}
              </span>
              <span
                className={`truncate text-sm font-bold ${
                  highlightName?.(row.name) ? "font-extrabold text-emerald-700" : "text-[#3d200a]"
                }`}
              >
                {row.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs font-bold text-[#8a5d33]">{row.value}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
                {formatPercent(row.value, total)}
              </span>
            </div>
          </div>
        );

        if (!rowHref) {
          return <div key={row.name}>{content}</div>;
        }

        return (
          <Link key={row.name} href={rowHref(row.name)} className="block">
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function PieStatusCard({
  data,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
}: {
  data: PieDatum[];
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const colors: Record<string, string> = {
    Yes: "#16a34a",
    No: "#cbd5e1",
  };

  return (
    <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#3d200a]">{title}</h3>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">{subtitle}</p>
        </div>
        <Link
          href={ctaHref}
          className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100"
        >
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-[140px_1fr] items-center gap-4">
        <div className="h-[148px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={58}
                paddingAngle={3}
                stroke="#fff7e6"
                strokeWidth={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={colors[entry.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  fontWeight: 700,
                  color: "#3d200a",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.map((entry) => (
            <div key={entry.name} className="rounded-2xl border border-[#8a5d33]/10 bg-white/55 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors[entry.name] || "#94a3b8" }}
                  />
                  <span className="text-sm font-bold text-[#3d200a]">{entry.name}</span>
                </div>
                <span className="text-sm font-extrabold text-[#3d200a]">{entry.value}</span>
              </div>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
                {formatPercent(entry.value, total)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition ${
        active
          ? "bg-[#8B0000] text-white shadow-sm"
          : "border border-[#8a5d33]/15 bg-white/65 text-[#8a5d33] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function OrgOverview({ org, isAdmin }: OrgOverviewProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tls13CipherTab, setTls13CipherTab] = useState<"negotiated" | "accepted">("negotiated");
  const [tls12CipherTab, setTls12CipherTab] = useState<"negotiated" | "accepted">("negotiated");
  const [kyberTab, setKyberTab] = useState<"supported" | "negotiated">("supported");

  useEffect(() => {
    let mounted = true;

    const fetchOverview = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/overview?orgId=${org.id}`);
        if (!res.ok) throw new Error("Failed to fetch overview");
        const json = await res.json();
        if (mounted) setData(json);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOverview();
    return () => {
      mounted = false;
    };
  }, [org.id]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-amber-600" />
        <p className="text-sm font-semibold text-[#8a5d33]/70 font-mono">Compiling Security Intelligence...</p>
      </div>
    );
  }

  if (!data) return null;

  const tls13CipherRows =
    tls13CipherTab === "negotiated" ? data.tls13CipherNegotiated || [] : data.tls13CipherAccepted || [];
  const tls12CipherRows =
    tls12CipherTab === "negotiated" ? data.tls12CipherNegotiated || [] : data.tls12CipherAccepted || [];
  const kyberData = kyberTab === "supported" ? data.kyberSupportedYesNo || [] : data.kyberNegotiatedYesNo || [];
  const kyberHref =
    kyberTab === "supported"
      ? `/app/${org.slug}/explore?pqcSupported=true`
      : `/app/${org.slug}/explore?pqcNegotiated=true`;

  return (
    <div className="custom-scrollbar flex h-full flex-col space-y-5 overflow-y-auto pb-10 pr-2 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/40 bg-white/40 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#3d200a]">Security Overview</h1>
        <p className="mt-1 text-sm font-semibold text-[#8a5d33]/70">
          Real-time intelligence from the latest OpenSSL endpoint scans across your organization.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Scanned TLS Endpoints",
            value: data.totalScanned,
            icon: Boxes,
            tone: "text-blue-700",
            bg: "from-blue-100 to-white",
            borderColor: "border-blue-200",
          },
          {
            title: "Strong Ciphers Confirmed",
            value: data.strongCipherCount,
            icon: ShieldAlert,
            tone: "text-emerald-700",
            bg: "from-emerald-100 to-white",
            borderColor: "border-emerald-200",
          },
          {
            title: "Certificates Expiring (<30d)",
            value: data.closeDeadlineCerts,
            icon: Calendar,
            tone: "text-amber-700",
            bg: "from-amber-100 to-white",
            borderColor: "border-amber-200",
          },
          {
            title: "Critical Expirations",
            value: data.expiredCerts,
            icon: AlertTriangle,
            tone: "text-red-700",
            bg: "from-red-100 to-white",
            borderColor: "border-red-200",
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.title}
              className={`rounded-3xl border ${metric.borderColor} bg-white/70 p-5 shadow-sm backdrop-blur`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#8a5d33]/70">{metric.title}</p>
                <div
                  className={`rounded-xl border ${metric.borderColor} bg-linear-to-br ${metric.bg} p-2 shadow-sm ${metric.tone}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className={`mt-4 text-3xl font-bold tracking-tight ${metric.tone}`}>{metric.value}</p>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3 items-start">
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-[#3d200a]">TLS Version Allocation</h2>
          </div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Current endpoint protocol distribution
          </p>

          <div style={{ height: Math.max(110, (data.tlsChartData?.length || 1) * 44 + 20) }}>
            {data.tlsChartData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={data.tlsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f59e0b" strokeOpacity={0.1} horizontal={false} />
                  <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={82}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="#8B0000"
                          style={{ cursor: "pointer" }}
                          onClick={() => router.push(`/app/${org.slug}/explore?tls=${encodeURIComponent(payload.value)}`)}
                          onMouseEnter={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "underline";
                          }}
                          onMouseLeave={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "none";
                          }}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(139,0,0,0.05)" }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontWeight: 700,
                      color: "#3d200a",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    fill="#8B0000"
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
              <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
                <p className="text-sm font-semibold text-[#8a5d33]/50">Complete a scan to view protocol distribution</p>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Global SSL Posture</h2>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Aggregated from latest endpoint scans
          </p>

          <div className={`mb-6 flex items-center justify-between rounded-2xl border px-6 py-5 ${data.tier.bg}`}>
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold shadow-sm ring-4 ring-white/50 ${data.tier.color}`}>
                {data.tier.grade}
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-[#3d200a]">{data.tier.tier}</p>
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
              <p className={`text-sm font-bold ${data.tlsDowngradeVulnerable > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {data.tlsDowngradeVulnerable}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                <p className="text-xs font-bold text-[#3d200a]">Self-Signed Certificates</p>
              </div>
              <p className={`text-sm font-bold ${data.selfSignedCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {data.selfSignedCount}
              </p>
            </div>
          </div>

          {data.topRiskAssets?.length > 0 && (
            <div className="mt-5 border-t border-[#8a5d33]/10 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Immediate Attention
                </h3>
                <Link
                  href={`/app/${org.slug}/explore?dnsState=not_found`}
                  className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 transition-colors hover:bg-red-500/20 hover:text-red-800"
                >
                  View Explorer
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data.topRiskAssets.map((asset: any) => (
                  <Link href={`/app/${org.slug}/asset/${asset.id}`} key={asset.id} className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-red-500/10 bg-white/50 px-3 py-2.5 transition-all hover:border-red-500/20 hover:bg-red-500/5">
                      <div className="flex min-w-0 items-center gap-3 pr-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="truncate text-xs font-bold text-[#3d200a] transition-colors group-hover:text-red-700">
                            {asset.name}
                          </p>
                          <p className="text-[10px] font-bold text-red-600">{asset.issue}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-red-500/40 transition-colors group-hover:text-red-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-[#3d200a]">NIST Kyber Key Exchange</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Post Quantum Secure Key Exchange
          </p>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <TabButton active={kyberTab === "supported"} onClick={() => setKyberTab("supported")}>
              Supported
            </TabButton>
            <TabButton active={kyberTab === "negotiated"} onClick={() => setKyberTab("negotiated")}>
              Negotiated
            </TabButton>
          </div>

          <PieStatusCard
            data={kyberData}
            title={kyberTab === "supported" ? "Kyber Support Coverage" : "Kyber Negotiation Coverage"}
            subtitle={kyberTab === "supported" ? "Yes / no by TLS endpoints" : "Negotiated MLKEM / non-MLKEM by TLS endpoints"}
            ctaHref={kyberHref}
            ctaLabel="Open Explorer"
          />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-[#3d200a]">TLSv1.3 Ciphers</h2>
            </div>
            <div className="flex items-center gap-2">
              <TabButton active={tls13CipherTab === "negotiated"} onClick={() => setTls13CipherTab("negotiated")}>
                Negotiated
              </TabButton>
              <TabButton active={tls13CipherTab === "accepted"} onClick={() => setTls13CipherTab("accepted")}>
                Accepted
              </TabButton>
            </div>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Version-specific TLS 1.3 cipher posture
          </p>
          <RankedTable
            rows={tls13CipherRows}
            emptyLabel="No TLSv1.3 cipher data captured yet."
            highlightName={isPreferredOverviewCipher}
            rowHref={(name) => `/app/${org.slug}/explore?tls=${encodeURIComponent("TLSv1.3")}&cipher=${encodeURIComponent(name)}`}
          />
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-[#3d200a]">TLSv1.2 Ciphers</h2>
            </div>
            <div className="flex items-center gap-2">
              <TabButton active={tls12CipherTab === "negotiated"} onClick={() => setTls12CipherTab("negotiated")}>
                Negotiated
              </TabButton>
              <TabButton active={tls12CipherTab === "accepted"} onClick={() => setTls12CipherTab("accepted")}>
                Accepted
              </TabButton>
            </div>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Version-specific TLS 1.2 cipher posture
          </p>
          <RankedTable
            rows={tls12CipherRows}
            emptyLabel="No TLSv1.2 cipher data captured yet."
            highlightName={isPreferredOverviewCipher}
            rowHref={(name) => `/app/${org.slug}/explore?tls=${encodeURIComponent("TLSv1.2")}&cipher=${encodeURIComponent(name)}`}
          />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-[#8B0000]" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificate Signature Algorithms</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Observed signing algorithms from endpoint certificates
          </p>
          <RankedTable
            rows={data.certificateSignatureAlgorithms || []}
            emptyLabel="No certificate signature algorithms reported yet."
          />
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificate Key Size</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Public key size distribution from current endpoint certificates
          </p>
          <RankedTable
            rows={data.certificateKeySizes || []}
            emptyLabel="No certificate key size data captured yet."
            rowHref={(name) => `/app/${org.slug}/explore?keySize=${encodeURIComponent(name)}`}
          />
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-bold text-[#3d200a]">TLSv1.3 Key Exchange</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Supported key exchange groups across TLSv1.3 endpoints
          </p>

          <div style={{ height: Math.max(180, (data.tls13KeyExchange?.length || 1) * 44 + 20) }}>
            {data.tls13KeyExchange?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.tls13KeyExchange}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f59e0b" strokeOpacity={0.1} horizontal={false} />
                  <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="#5b21b6"
                          style={{ cursor: "pointer" }}
                          onClick={() => router.push(`/app/${org.slug}/explore?kexGroups=${encodeURIComponent(payload.value)}`)}
                          onMouseEnter={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "underline";
                          }}
                          onMouseLeave={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "none";
                          }}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(139,0,0,0.05)" }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontWeight: 700,
                      color: "#3d200a",
                    }}
                    formatter={(value: number) => [value, "Endpoints"]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                    barSize={24}
                    fill="#7c3aed"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry?.name) {
                        router.push(`/app/${org.slug}/explore?kexGroups=${encodeURIComponent(entry.name)}`);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
                <p className="text-sm font-semibold text-[#8a5d33]/50">No TLSv1.3 key exchange data reported yet.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
