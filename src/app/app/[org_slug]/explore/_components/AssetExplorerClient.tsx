"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Globe,
  Loader2,
  RefreshCcw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Telescope,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";

type BooleanFilter = "" | "true" | "false";

type AssetExplorerClientProps = {
  org: {
    id: string;
    slug: string;
    name: string;
  };
  initialDnsState: string;
  initialCertState: string;
  initialTlsProfile: string;
  initialTlsMatch: string;
  initialSelfSigned: string;
  initialSignatureAlgorithm: string;
  initialPort: string;
  initialCertExpiry: string;
  initialTimeoutOnly: string;
  initialNoTls: string;
  initialCipher: string;
  initialKeySize: string;
  initialTls: string;
  initialPqcSupported: string;
  initialPqcNegotiated: string;
  initialKexAlgorithms: string[];
  initialKexGroups: string[];
  initialPage: number;
  initialPageSize: number;
};

type FilterOptions = {
  ciphers: string[];
  keySizes: string[];
  tlsVersions: string[];
  ports: string[];
  kexAlgorithms: string[];
  kexGroups: string[];
  signatureAlgorithms: string[];
};

type SelectOption = {
  value: string;
  label: string;
};

type ResultSummaryProps = {
  usesEndpointMatching: boolean;
  totalMatch: number;
  matchingEndpointCount: number;
  assetCount: number;
};

type FilterControlsProps = {
  search: string;
  setSearch: (value: string) => void;
  dnsState: string;
  setDnsState: (value: string) => void;
  tls: string;
  setTls: (value: string) => void;
  keySize: string;
  setKeySize: (value: string) => void;
  signatureAlgorithm: string;
  setSignatureAlgorithm: (value: string) => void;
  port: string;
  setPort: (value: string) => void;
  certExpiry: string;
  setCertExpiry: (value: string) => void;
  cipher: string;
  setCipher: (value: string) => void;
  timeoutOnly: BooleanFilter;
  setTimeoutOnly: (value: BooleanFilter) => void;
  noTlsOnly: BooleanFilter;
  setNoTlsOnly: (value: BooleanFilter) => void;
  pqcSupportedOnly: BooleanFilter;
  setPqcSupportedOnly: (value: BooleanFilter) => void;
  pqcNegotiatedOnly: BooleanFilter;
  setPqcNegotiatedOnly: (value: BooleanFilter) => void;
  kexAlgorithms: string[];
  setKexAlgorithms: (value: string[]) => void;
  kexGroups: string[];
  setKexGroups: (value: string[]) => void;
  filterOptions: FilterOptions;
  dnsOptions: SelectOption[];
  tlsVersionOptions: SelectOption[];
  keySizeOptions: SelectOption[];
  portOptions: SelectOption[];
  certExpiryOptions: SelectOption[];
  signatureAlgorithmOptions: SelectOption[];
  cipherOptions: SelectOption[];
  scanResultOptions: SelectOption[];
  tlsPresenceOptions: SelectOption[];
  kyberSupportOptions: SelectOption[];
  kyberNegotiationOptions: SelectOption[];
  activeAdvancedFilterCount: number;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean | ((current: boolean) => boolean)) => void;
  toggleSelection: (value: string, selected: string[], setter: (values: string[]) => void) => void;
  variant?: "inline" | "modal";
};

const ALL_FILTER_VALUE = "__all__";
const FILTER_QUERY_KEYS = [
  "filter",
  "search",
  "dnsState",
  "certState",
  "tlsProfile",
  "tlsMatch",
  "selfSigned",
  "signatureAlgorithm",
  "port",
  "certExpiry",
  "timeoutOnly",
  "noTls",
  "cipher",
  "keySize",
  "tls",
  "pqcSupported",
  "pqcNegotiated",
  "kexAlgos",
  "kexGroups",
  "page",
  "pageSize",
];

const expandTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

const miniNavTopOffset = 96;
const pageSizeOptions = [10, 25, 50, 100];

function normalizeBooleanFilter(value: string): BooleanFilter {
  return value === "true" ? "true" : value === "false" ? "false" : "";
}

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
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
            port.protocol === "udp"
              ? "bg-violet-500/10 text-violet-700"
              : "bg-emerald-500/10 text-emerald-700"
          )}
        >
          {port.number}/{port.protocol.toUpperCase()}
        </span>
      ))}
      {remainingCount > 0 ? (
        <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
          +{remainingCount}
        </span>
      ) : null}
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
      <TooltipContent>Run ports and IP scan to see the resolved IP.</TooltipContent>
    </Tooltip>
  );
}

function buildFilterQueryParams({
  dnsState,
  certState,
  tlsProfile,
  tlsMatch,
  selfSigned,
  signatureAlgorithm,
  port,
  certExpiry,
  timeoutOnly,
  noTlsOnly,
  cipher,
  keySize,
  tls,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  kexAlgorithms,
  kexGroups,
  page,
  pageSize,
}: {
  dnsState: string;
  certState: string;
  tlsProfile: string;
  tlsMatch: string;
  selfSigned: string;
  signatureAlgorithm: string;
  port: string;
  certExpiry: string;
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  cipher: string;
  keySize: string;
  tls: string;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  kexAlgorithms: string[];
  kexGroups: string[];
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (dnsState) params.set("dnsState", dnsState);
  if (certState) params.set("certState", certState);
  if (tlsProfile) params.set("tlsProfile", tlsProfile);
  if (tlsMatch) params.set("tlsMatch", tlsMatch);
  if (selfSigned) params.set("selfSigned", selfSigned);
  if (signatureAlgorithm) params.set("signatureAlgorithm", signatureAlgorithm);
  if (port) params.set("port", port);
  if (certExpiry) params.set("certExpiry", certExpiry);
  if (timeoutOnly) params.set("timeoutOnly", timeoutOnly);
  if (noTlsOnly) params.set("noTls", noTlsOnly);
  if (cipher) params.set("cipher", cipher);
  if (keySize) params.set("keySize", keySize);
  if (tls) params.set("tls", tls);
  if (pqcSupportedOnly) params.set("pqcSupported", pqcSupportedOnly);
  if (pqcNegotiatedOnly) params.set("pqcNegotiated", pqcNegotiatedOnly);
  if (kexAlgorithms.length > 0) params.set("kexAlgos", kexAlgorithms.join(","));
  if (kexGroups.length > 0) params.set("kexGroups", kexGroups.join(","));
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 25) params.set("pageSize", String(pageSize));

  return params;
}

function countActiveFilters({
  dnsState,
  certState,
  tlsProfile,
  tlsMatch,
  selfSigned,
  signatureAlgorithm,
  port,
  certExpiry,
  timeoutOnly,
  noTlsOnly,
  cipher,
  keySize,
  tls,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  kexAlgorithms,
  kexGroups,
}: {
  dnsState: string;
  certState: string;
  tlsProfile: string;
  tlsMatch: string;
  selfSigned: string;
  signatureAlgorithm: string;
  port: string;
  certExpiry: string;
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  cipher: string;
  keySize: string;
  tls: string;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  kexAlgorithms: string[];
  kexGroups: string[];
}) {
  return [
    dnsState,
    certState,
    tlsProfile,
    tlsMatch,
    selfSigned,
    signatureAlgorithm,
    port,
    certExpiry,
    timeoutOnly,
    noTlsOnly,
    cipher,
    keySize,
    tls,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    ...kexAlgorithms,
    ...kexGroups,
  ].filter(Boolean).length;
}

function countAdvancedFilters({
  timeoutOnly,
  noTlsOnly,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  kexAlgorithms,
  kexGroups,
}: {
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  kexAlgorithms: string[];
  kexGroups: string[];
}) {
  return [
    timeoutOnly,
    noTlsOnly,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    ...kexAlgorithms,
    ...kexGroups,
  ].filter(Boolean).length;
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
  labelClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  allLabel: string;
  className?: string;
  labelClassName?: string;
}) {
  const isFiltered = Boolean(value);

  return (
    <div className={cn("space-y-2", className)}>
      <p className={cn("text-sm font-bold text-[#7a1f1f]", labelClassName)}>
        {label}
      </p>
      <Select
        value={value || ALL_FILTER_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === ALL_FILTER_VALUE ? "" : nextValue)}
      >
        <SelectTrigger
          className={cn(
            "h-12 w-full rounded-2xl px-4 text-left text-sm font-semibold shadow-none transition-colors",
            isFiltered
              ? "border-[#163b73]/40 bg-[#163b73]/92 text-white [&_svg]:!text-white/80"
              : "border-white/60 bg-white/80 text-[#3d200a] [&_svg]:!text-[#8a5d33]/70"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER_VALUE}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function assetMatchesClientSearch(asset: any, normalizedSearch: string) {
  if (!normalizedSearch) return true;

  const portTokens = normalizeAssetOpenPorts(asset.openPorts).flatMap((port) => [
    String(port.number),
    `${port.number}/${port.protocol}`,
    `${port.number}/${port.protocol.toUpperCase()}`,
  ]);
  const endpointTokens = (asset.matchingEndpoints || []).flatMap((endpoint: any) => [
    endpoint.portLabel,
    endpoint.portProtocol,
    endpoint.summary?.issue,
    endpoint.summary?.tls,
    endpoint.summary?.keySize,
    endpoint.summary?.cipher,
    ...(endpoint.summary?.discoveredCiphers || []),
  ]);
  const haystack = [
    asset.name,
    asset.type,
    asset.resolvedIp,
    asset.scanStatus,
    asset.selectedEndpointLabel,
    asset.summary?.issue,
    asset.summary?.tls,
    asset.summary?.keySize,
    asset.summary?.cipher,
    ...(asset.summary?.discoveredCiphers || []),
    ...(asset.matchingEndpointLabels || []),
    ...portTokens,
    ...endpointTokens,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function MultiSelectFilter({
  label,
  helper,
  values,
  options,
  onToggle,
  onClear,
  emptyLabel,
  labelClassName,
}: {
  label: string;
  helper: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  emptyLabel: string;
  labelClassName?: string;
}) {
  const summary =
    values.length === 0
      ? emptyLabel
      : values.length === 1
        ? values[0]
        : `${values.length} selected`;
  const isFiltered = values.length > 0;

  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-bold text-[#7a1f1f]", labelClassName)}>
        {label}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-16 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold shadow-none transition-colors",
              isFiltered
                ? "border-[#163b73]/40 bg-[#163b73]/92 text-white hover:border-[#163b73]/60"
                : "border-white/60 bg-white/80 text-[#3d200a] hover:border-[#8B0000]/25"
            )}
          >
            <div className="min-w-0">
              <p className="truncate">{summary}</p>
              <p className={cn("truncate text-xs font-medium", isFiltered ? "text-white/72" : "text-[#8a5d33]/70")}>
                {helper}
              </p>
            </div>
            <ChevronDown className={cn("h-4 w-4 shrink-0", isFiltered ? "text-white/80" : "text-[#8a5d33]/70")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[240] w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-2">
          <div className="flex items-start justify-between gap-3 px-2 py-1">
            <div>
              <DropdownMenuLabel className="px-0 py-0 normal-case tracking-normal text-[#3d200a]">
                {label}
              </DropdownMenuLabel>
              <p className="mt-1 text-xs font-medium text-[#8a5d33]/80">{helper}</p>
            </div>
            {values.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-bold text-[#8B0000] transition-colors hover:text-[#730000]"
              >
                Clear
              </button>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto pr-1">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-sm font-medium text-[#8a5d33]/75">No values discovered yet.</p>
            ) : (
              options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={values.includes(option)}
                  onCheckedChange={() => onToggle(option)}
                >
                  <span className="truncate">{option}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ResultsSummary({
  usesEndpointMatching,
  totalMatch,
  matchingEndpointCount,
  assetCount,
}: ResultSummaryProps) {
  if (usesEndpointMatching) {
    return (
      <p className="mb-4 px-2 text-sm font-bold text-[#6d3f1d]">
        Found <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{totalMatch}</span> matching
        asset{totalMatch === 1 ? "" : "s"} across{" "}
        <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{matchingEndpointCount}</span> matching
        TLS endpoint{matchingEndpointCount === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <p className="mb-4 px-2 text-sm font-bold text-[#6d3f1d]">
      Found <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{assetCount}</span> matching
      asset{assetCount === 1 ? "" : "s"}
    </p>
  );
}

function FilterControls({
  search,
  setSearch,
  dnsState,
  setDnsState,
  tls,
  setTls,
  keySize,
  setKeySize,
  signatureAlgorithm,
  setSignatureAlgorithm,
  port,
  setPort,
  certExpiry,
  setCertExpiry,
  cipher,
  setCipher,
  timeoutOnly,
  setTimeoutOnly,
  noTlsOnly,
  setNoTlsOnly,
  pqcSupportedOnly,
  setPqcSupportedOnly,
  pqcNegotiatedOnly,
  setPqcNegotiatedOnly,
  kexAlgorithms,
  setKexAlgorithms,
  kexGroups,
  setKexGroups,
  filterOptions,
  dnsOptions,
  tlsVersionOptions,
  keySizeOptions,
  portOptions,
  certExpiryOptions,
  signatureAlgorithmOptions,
  cipherOptions,
  scanResultOptions,
  tlsPresenceOptions,
  kyberSupportOptions,
  kyberNegotiationOptions,
  activeAdvancedFilterCount,
  showAdvancedFilters,
  setShowAdvancedFilters,
  toggleSelection,
  variant = "inline",
}: FilterControlsProps) {
  const isModal = variant === "modal";

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-2 xl:col-span-6">
          <p className="text-sm font-bold text-[#7a1f1f]">Search</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a5d33]/55" />
            <input
              type="text"
              placeholder="Search domains, IP addresses, or known TLS details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 pl-11 pr-4 text-sm font-semibold text-[#3d200a] placeholder:text-[#8a5d33]/55 outline-none transition-all focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10"
            />
          </div>
        </div>

        <LabeledSelect
          label="DNS status"
          value={dnsState}
          onChange={setDnsState}
          options={dnsOptions}
          allLabel="Any DNS status"
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Latest TLS version"
          value={tls}
          onChange={setTls}
          options={tlsVersionOptions}
          allLabel="Any latest TLS version"
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Key size"
          value={keySize}
          onChange={setKeySize}
          options={keySizeOptions}
          allLabel="Any certificate key size"
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Certificate validity"
          value={certExpiry}
          onChange={setCertExpiry}
          options={certExpiryOptions}
          allLabel="Any validity window"
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Signature algorithm"
          value={signatureAlgorithm}
          onChange={setSignatureAlgorithm}
          options={signatureAlgorithmOptions}
          allLabel="Any signature algorithm"
          className="xl:col-span-4"
        />

        <LabeledSelect
          label="Cipher suite"
          value={cipher}
          onChange={setCipher}
          options={cipherOptions}
          allLabel="Any cipher suite"
          className="xl:col-span-3"
        />

        <LabeledSelect
          label="Port"
          value={port}
          onChange={setPort}
          options={portOptions}
          allLabel="Any TLS port"
          className="xl:col-span-2"
        />

        <div className="space-y-2 xl:col-span-4">
          <p className="text-sm font-bold text-[#7a1f1f]">Advanced</p>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
              showAdvancedFilters
                ? "border-[#7a1f1f]/70 bg-[#7a1f1f] text-white"
                : "border-white/60 bg-white/80 text-[#3d200a] hover:border-[#8B0000]/25"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  showAdvancedFilters ? "bg-white/16 text-white" : "bg-[#8B0000]/8 text-[#8B0000]"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">PQC, scan outcomes, and key exchange filters</span>
                <span
                  className={cn(
                    "block truncate text-xs font-medium",
                    showAdvancedFilters ? "text-white/78" : "text-[#8a5d33]/70"
                  )}
                >
                  {activeAdvancedFilterCount === 0
                    ? "Optional filters for deeper TLS analysis"
                    : `${activeAdvancedFilterCount} advanced filter${activeAdvancedFilterCount === 1 ? "" : "s"} active`}
                </span>
              </span>
            </span>
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-white/85" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-[#8a5d33]/75" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showAdvancedFilters ? (
          <motion.div
            key={`advanced-filters-${variant}`}
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={expandTransition}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "rounded-[26px] border border-[#7a1f1f]/55 bg-[#7a1f1f] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:18px_18px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                isModal ? "mt-1" : ""
              )}
            >
              <div className="grid gap-3 xl:grid-cols-4">
                <LabeledSelect
                  label="Scan result"
                  value={timeoutOnly}
                  onChange={(value) => setTimeoutOnly(normalizeBooleanFilter(value))}
                  options={scanResultOptions}
                  allLabel="Any scan result"
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="TLS presence"
                  value={noTlsOnly}
                  onChange={(value) => setNoTlsOnly(normalizeBooleanFilter(value))}
                  options={tlsPresenceOptions}
                  allLabel="Any TLS presence"
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="Kyber support"
                  value={pqcSupportedOnly}
                  onChange={(value) => setPqcSupportedOnly(normalizeBooleanFilter(value))}
                  options={kyberSupportOptions}
                  allLabel="Any Kyber support"
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="Kyber negotiation"
                  value={pqcNegotiatedOnly}
                  onChange={(value) => setPqcNegotiatedOnly(normalizeBooleanFilter(value))}
                  options={kyberNegotiationOptions}
                  allLabel="Any Kyber negotiation"
                  labelClassName="text-white/92"
                />
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <MultiSelectFilter
                  label="Key exchange methods"
                  helper="Select one or more algorithms seen in the handshake."
                  values={kexAlgorithms}
                  options={filterOptions.kexAlgorithms}
                  onToggle={(value) => toggleSelection(value, kexAlgorithms, setKexAlgorithms)}
                  onClear={() => setKexAlgorithms([])}
                  emptyLabel="All key exchange methods"
                  labelClassName="text-white/92"
                />

                <MultiSelectFilter
                  label="Negotiated groups"
                  helper="Select the negotiated curves or hybrid groups to match."
                  values={kexGroups}
                  options={filterOptions.kexGroups}
                  onToggle={(value) => toggleSelection(value, kexGroups, setKexGroups)}
                  onClear={() => setKexGroups([])}
                  emptyLabel="All negotiated groups"
                  labelClassName="text-white/92"
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export default function AssetExplorerClient({
  org,
  initialDnsState,
  initialCertState,
  initialTlsProfile,
  initialTlsMatch,
  initialSelfSigned,
  initialSignatureAlgorithm,
  initialPort,
  initialCertExpiry,
  initialTimeoutOnly,
  initialNoTls,
  initialCipher,
  initialKeySize,
  initialTls,
  initialPqcSupported,
  initialPqcNegotiated,
  initialKexAlgorithms,
  initialKexGroups,
  initialPage,
  initialPageSize,
}: AssetExplorerClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const capsuleSearchInputRef = useRef<HTMLInputElement | null>(null);

  const [dnsState, setDnsState] = useState(initialDnsState || "");
  const [certState, setCertState] = useState(initialCertState || "");
  const [tlsProfile, setTlsProfile] = useState(initialTlsProfile || "");
  const [tlsMatch, setTlsMatch] = useState(initialTlsMatch === "exact_latest" ? "exact_latest" : "");
  const [selfSigned, setSelfSigned] = useState(initialSelfSigned === "true" ? "true" : "");
  const [signatureAlgorithm, setSignatureAlgorithm] = useState(initialSignatureAlgorithm || "");
  const [port, setPort] = useState(initialPort || "");
  const [certExpiry, setCertExpiry] = useState(initialCertExpiry || "");
  const [timeoutOnly, setTimeoutOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialTimeoutOnly));
  const [noTlsOnly, setNoTlsOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialNoTls));
  const [cipher, setCipher] = useState(initialCipher || "");
  const [keySize, setKeySize] = useState(initialKeySize || "");
  const [tls, setTls] = useState(initialTls || "");
  const [pqcSupportedOnly, setPqcSupportedOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialPqcSupported));
  const [pqcNegotiatedOnly, setPqcNegotiatedOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialPqcNegotiated));
  const [kexAlgorithms, setKexAlgorithms] = useState<string[]>(initialKexAlgorithms || []);
  const [kexGroups, setKexGroups] = useState<string[]>(initialKexGroups || []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(Math.max(1, initialPage || 1));
  const [pageSize, setPageSize] = useState(pageSizeOptions.includes(initialPageSize) ? initialPageSize : 25);
  const [pageInputValue, setPageInputValue] = useState(String(Math.max(1, initialPage || 1)));
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [usesEndpointMatching, setUsesEndpointMatching] = useState(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});
  const [showScrollCapsules, setShowScrollCapsules] = useState(false);
  const [isCapsuleSearchOpen, setIsCapsuleSearchOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    countAdvancedFilters({
      timeoutOnly: normalizeBooleanFilter(initialTimeoutOnly),
      noTlsOnly: normalizeBooleanFilter(initialNoTls),
      pqcSupportedOnly: normalizeBooleanFilter(initialPqcSupported),
      pqcNegotiatedOnly: normalizeBooleanFilter(initialPqcNegotiated),
      kexAlgorithms: initialKexAlgorithms || [],
      kexGroups: initialKexGroups || [],
    }) > 0
  );
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    ciphers: [],
    keySizes: [],
    tlsVersions: [],
    ports: [],
    kexAlgorithms: [],
    kexGroups: [],
    signatureAlgorithms: [],
  });
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch]);
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        dnsState,
        certState,
        tlsProfile,
        tlsMatch,
        selfSigned,
        signatureAlgorithm,
        port,
        certExpiry,
        timeoutOnly,
        noTlsOnly,
        cipher,
        keySize,
        tls,
        pqcSupportedOnly,
        pqcNegotiatedOnly,
        kexAlgorithms,
        kexGroups,
      }),
    [
      cipher,
      certState,
      certExpiry,
      dnsState,
      keySize,
      kexAlgorithms,
      kexGroups,
      noTlsOnly,
      port,
      pqcNegotiatedOnly,
      pqcSupportedOnly,
      selfSigned,
      signatureAlgorithm,
      tlsMatch,
      tlsProfile,
      timeoutOnly,
      tls,
    ]
  );
  const previousFilterSignatureRef = useRef<string | null>(null);
  const previousSearchValueRef = useRef<string | null>(null);

  useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

  useEffect(() => {
    if (previousFilterSignatureRef.current === null) {
      previousFilterSignatureRef.current = filterSignature;
      return;
    }

    if (previousFilterSignatureRef.current !== filterSignature) {
      previousFilterSignatureRef.current = filterSignature;
      setPage(1);
    }
  }, [filterSignature]);

  useEffect(() => {
    if (previousSearchValueRef.current === null) {
      previousSearchValueRef.current = normalizedSearch;
      return;
    }

    if (previousSearchValueRef.current !== normalizedSearch) {
      previousSearchValueRef.current = normalizedSearch;
      setPage(1);
    }
  }, [normalizedSearch]);

  useEffect(() => {
    const updateCapsuleVisibility = () => {
      const filterPanel = filterPanelRef.current;
      if (!filterPanel) {
        setShowScrollCapsules(false);
        return;
      }

      const rect = filterPanel.getBoundingClientRect();
      setShowScrollCapsules(rect.bottom <= miniNavTopOffset);
    };

    updateCapsuleVisibility();
    window.addEventListener("scroll", updateCapsuleVisibility, { passive: true });
    window.addEventListener("resize", updateCapsuleVisibility);

    return () => {
      window.removeEventListener("scroll", updateCapsuleVisibility);
      window.removeEventListener("resize", updateCapsuleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!showScrollCapsules) {
      setIsCapsuleSearchOpen(false);
    }
  }, [showScrollCapsules]);

  useEffect(() => {
    if (!isCapsuleSearchOpen) return;

    const focusTimer = window.setTimeout(() => {
      capsuleSearchInputRef.current?.focus();
      capsuleSearchInputRef.current?.select();
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isCapsuleSearchOpen]);

  useEffect(() => {
    if (!isFilterModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFilterModalOpen]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const filterParams = buildFilterQueryParams({
      dnsState,
      certState,
      tlsProfile,
      tlsMatch,
      selfSigned,
      signatureAlgorithm,
      port,
      certExpiry,
      timeoutOnly,
      noTlsOnly,
      cipher,
      keySize,
      tls,
      pqcSupportedOnly,
      pqcNegotiatedOnly,
      kexAlgorithms,
      kexGroups,
      page,
      pageSize,
    });

    for (const key of FILTER_QUERY_KEYS) {
      nextParams.delete(key);
    }

    filterParams.forEach((value, key) => {
      nextParams.set(key, value);
    });

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [
    cipher,
    certState,
    certExpiry,
    dnsState,
    kexAlgorithms,
    kexGroups,
    keySize,
    noTlsOnly,
    pathname,
    port,
    pqcNegotiatedOnly,
    pqcSupportedOnly,
    selfSigned,
    signatureAlgorithm,
    tlsMatch,
    tlsProfile,
    page,
    pageSize,
    router,
    searchParams,
    timeoutOnly,
    tls,
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchAssets = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        query.append("orgId", org.id);
        if (dnsState) query.append("dnsState", dnsState);
        if (certState) query.append("certState", certState);
        if (tlsProfile) query.append("tlsProfile", tlsProfile);
        if (tlsMatch) query.append("tlsMatch", tlsMatch);
        if (selfSigned) query.append("selfSigned", selfSigned);
        if (signatureAlgorithm) query.append("signatureAlgorithm", signatureAlgorithm);
        if (port) query.append("port", port);
        if (certExpiry) query.append("certExpiry", certExpiry);
        if (timeoutOnly) query.append("timeoutOnly", timeoutOnly);
        if (noTlsOnly) query.append("noTls", noTlsOnly);
        if (cipher) query.append("cipher", cipher);
        if (keySize) query.append("keySize", keySize);
        if (tls) query.append("tls", tls);
        if (pqcSupportedOnly) query.append("pqcSupported", pqcSupportedOnly);
        if (pqcNegotiatedOnly) query.append("pqcNegotiated", pqcNegotiatedOnly);
        if (kexAlgorithms.length > 0) query.append("kexAlgos", kexAlgorithms.join(","));
        if (kexGroups.length > 0) query.append("kexGroups", kexGroups.join(","));
        query.append("paginate", "false");

        const res = await fetch(`/api/orgs/explore?${query.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();

        if (mounted) {
          setAssets(json.assets || []);
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

    return () => {
      mounted = false;
    };
  }, [
    cipher,
    certState,
    certExpiry,
    dnsState,
    kexAlgorithms,
    kexGroups,
    keySize,
    noTlsOnly,
    org.id,
    port,
    pqcNegotiatedOnly,
    pqcSupportedOnly,
    selfSigned,
    signatureAlgorithm,
    tlsMatch,
    tlsProfile,
    timeoutOnly,
    tls,
  ]);

  const activeFilterCount = countActiveFilters({
    dnsState,
    certState,
    tlsProfile,
    tlsMatch,
    selfSigned,
    signatureAlgorithm,
    port,
    certExpiry,
    timeoutOnly,
    noTlsOnly,
    cipher,
    keySize,
    tls,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    kexAlgorithms,
    kexGroups,
  });
  const hasSearch = Boolean(search.trim());

  const activeAdvancedFilterCount = countAdvancedFilters({
    timeoutOnly,
    noTlsOnly,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    kexAlgorithms,
    kexGroups,
  });

  const dnsOptions: SelectOption[] = [
    { value: "found", label: "Resolved in DNS" },
    { value: "not_found", label: "Missing from DNS" },
  ];

  const scanResultOptions: SelectOption[] = [
    { value: "false", label: "Successful scan" },
    { value: "true", label: "Timed out" },
  ];

  const tlsPresenceOptions: SelectOption[] = [
    { value: "false", label: "TLS detected" },
    { value: "true", label: "No TLS detected" },
  ];

  const kyberSupportOptions: SelectOption[] = [
    { value: "true", label: "Kyber supported" },
    { value: "false", label: "Kyber not supported" },
  ];

  const kyberNegotiationOptions: SelectOption[] = [
    { value: "true", label: "Kyber negotiated" },
    { value: "false", label: "Kyber not negotiated" },
  ];

  const tlsVersionOptions = filterOptions.tlsVersions.map((option) => ({
    value: option,
    label: option,
  }));

  const keySizeOptions = filterOptions.keySizes.map((option) => ({
    value: option,
    label: option,
  }));

  const portOptions = filterOptions.ports.map((option) => ({
    value: option,
    label: option,
  }));

  const certExpiryOptions: SelectOption[] = [
    { value: "expired", label: "Expired" },
    { value: "in_30_days", label: "In 30 days" },
    { value: "in_90_days", label: "In 90 days" },
    { value: "over_90_days", label: "> 90 days" },
  ];

  const signatureAlgorithmOptions = filterOptions.signatureAlgorithms.map((option) => ({
    value: option,
    label: option,
  }));

  const cipherOptions = filterOptions.ciphers.map((option) => ({
    value: option,
    label: option,
  }));

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

  const searchedAssets = useMemo(
    () => assets.filter((asset) => assetMatchesClientSearch(asset, normalizedSearch)),
    [assets, normalizedSearch]
  );
  const totalMatch = searchedAssets.length;
  const matchingEndpointCount = searchedAssets.reduce(
    (sum, asset) => sum + Math.max(asset.matchingEndpointCount || 0, 0),
    0
  );
  const totalPages = Math.max(1, Math.ceil(totalMatch / pageSize));
  const paginatedAssets = searchedAssets.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setDnsState("");
    setCertState("");
    setTlsProfile("");
    setTlsMatch("");
    setSelfSigned("");
    setSignatureAlgorithm("");
    setPort("");
    setCertExpiry("");
    setTimeoutOnly("");
    setNoTlsOnly("");
    setCipher("");
    setKeySize("");
    setTls("");
    setPqcSupportedOnly("");
    setPqcNegotiatedOnly("");
    setKexAlgorithms([]);
    setKexGroups([]);
    setPage(1);
    setShowAdvancedFilters(false);
  };

  const commitPageInput = () => {
    const parsedPage = Number.parseInt(pageInputValue, 10);
    const nextPage = Number.isFinite(parsedPage) ? Math.min(Math.max(parsedPage, 1), totalPages) : page;
    setPageInputValue(String(nextPage));
    if (nextPage !== page) {
      setPage(nextPage);
    }
  };

  const canGoToPreviousPage = page > 1;
  const canGoToNextPage = page < totalPages;
  const pageStart = totalMatch === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalMatch);

  return (
    <TooltipProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-275 flex-col px-6 py-8 sm:px-8">
        <AnimatePresence>
          {showScrollCapsules ? (
            <motion.div
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center sm:top-24"
            >
              <div className="pointer-events-auto flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/app/${org.slug}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/80 text-[#7a1f1f] shadow-lg shadow-amber-950/10 backdrop-blur-xl transition hover:bg-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Back to dashboard</TooltipContent>
                </Tooltip>

                <motion.div
                  layout
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  animate={{ width: isCapsuleSearchOpen ? 44 : 172 }}
                  className="flex h-11 items-center gap-2 overflow-hidden rounded-full border border-white/75 bg-white/80 px-3 text-sm font-bold text-[#3d200a] shadow-lg shadow-amber-950/10 backdrop-blur-xl"
                >
                  <Telescope className="h-4 w-4 shrink-0 text-[#7a1f1f]" />
                  <motion.span
                    animate={{
                      opacity: isCapsuleSearchOpen ? 0 : 1,
                      x: isCapsuleSearchOpen ? -8 : 0,
                      maxWidth: isCapsuleSearchOpen ? 0 : 120,
                    }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Asset Explorer
                  </motion.span>
                </motion.div>

                <AnimatePresence mode="popLayout" initial={false}>
                  {isCapsuleSearchOpen ? (
                    <motion.div
                      key="capsule-search-open"
                      layout
                      initial={{ opacity: 0, width: 44 }}
                      animate={{ opacity: 1, width: 320 }}
                      exit={{ opacity: 0, width: 44 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-11 items-center gap-2 rounded-full border border-white/75 bg-white/88 px-3 text-[#3d200a] shadow-lg shadow-amber-950/10 backdrop-blur-xl"
                    >
                      <Search className="h-4 w-4 shrink-0 text-[#7a1f1f]" />
                      <input
                        ref={capsuleSearchInputRef}
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search assets"
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#3d200a] outline-none placeholder:text-[#8a5d33]/65"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCapsuleSearchOpen(false)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8B0000]/8 text-[#7a1f1f] transition hover:bg-[#8B0000]/14"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <Tooltip key="capsule-search-closed">
                      <TooltipTrigger asChild>
                        <motion.button
                          layout
                          type="button"
                          onClick={() => setIsCapsuleSearchOpen(true)}
                          initial={{ opacity: 0, width: 44 }}
                          animate={{ opacity: 1, width: 44 }}
                          exit={{ opacity: 0, width: 44 }}
                          transition={{ duration: 0.2 }}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/80 text-[#7a1f1f] shadow-lg shadow-amber-950/10 backdrop-blur-xl transition hover:bg-white"
                        >
                          <Search className="h-4 w-4" />
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent>Quick search</TooltipContent>
                    </Tooltip>
                  )}
                </AnimatePresence>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsFilterModalOpen(true)}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border shadow-lg shadow-amber-950/10 backdrop-blur-xl transition",
                        activeFilterCount > 0
                          ? "border-[#163b73]/55 bg-[#163b73]/92 text-white hover:bg-[#163b73]"
                          : "border-white/75 bg-white/80 text-[#7a1f1f] hover:bg-white"
                      )}
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                      : "Open filters"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isFilterModalOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-start justify-center bg-[#2a1202]/28 px-4 py-6 backdrop-blur-sm sm:items-center sm:p-6"
              onClick={() => setIsFilterModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.985 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-[rgba(255,248,228,0.92)] shadow-2xl shadow-amber-950/20 backdrop-blur-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-amber-500/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-sm font-bold text-[#7a1f1f]">Filters</p>
                    <h3 className="mt-1 text-xl font-bold text-[#3d200a]">Adjust the explorer without losing your place</h3>
                    <p className="mt-1 text-sm font-medium text-[#6d3f1d]/85">
                      Filter changes stay shareable through the URL. Search refines the current results instantly on this page.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-4 text-sm font-bold text-[#8B0000] transition hover:bg-white"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Reset
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsFilterModalOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/75 bg-white/85 text-[#7a1f1f] transition hover:bg-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
                  <FilterControls
                    search={search}
                    setSearch={setSearch}
                    dnsState={dnsState}
                    setDnsState={setDnsState}
                    tls={tls}
                    setTls={setTls}
                    keySize={keySize}
                    setKeySize={setKeySize}
                    signatureAlgorithm={signatureAlgorithm}
                    setSignatureAlgorithm={setSignatureAlgorithm}
                    port={port}
                    setPort={setPort}
                    certExpiry={certExpiry}
                    setCertExpiry={setCertExpiry}
                    cipher={cipher}
                    setCipher={setCipher}
                    timeoutOnly={timeoutOnly}
                    setTimeoutOnly={setTimeoutOnly}
                    noTlsOnly={noTlsOnly}
                    setNoTlsOnly={setNoTlsOnly}
                    pqcSupportedOnly={pqcSupportedOnly}
                    setPqcSupportedOnly={setPqcSupportedOnly}
                    pqcNegotiatedOnly={pqcNegotiatedOnly}
                    setPqcNegotiatedOnly={setPqcNegotiatedOnly}
                    kexAlgorithms={kexAlgorithms}
                    setKexAlgorithms={setKexAlgorithms}
                    kexGroups={kexGroups}
                    setKexGroups={setKexGroups}
                    filterOptions={filterOptions}
                    dnsOptions={dnsOptions}
                    tlsVersionOptions={tlsVersionOptions}
                    keySizeOptions={keySizeOptions}
                    portOptions={portOptions}
                    certExpiryOptions={certExpiryOptions}
                    signatureAlgorithmOptions={signatureAlgorithmOptions}
                    cipherOptions={cipherOptions}
                    scanResultOptions={scanResultOptions}
                    tlsPresenceOptions={tlsPresenceOptions}
                    kyberSupportOptions={kyberSupportOptions}
                    kyberNegotiationOptions={kyberNegotiationOptions}
                    activeAdvancedFilterCount={activeAdvancedFilterCount}
                    showAdvancedFilters={showAdvancedFilters}
                    setShowAdvancedFilters={setShowAdvancedFilters}
                    toggleSelection={toggleSelection}
                    variant="modal"
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/app/${org.slug}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/85 transition-colors hover:text-[#5b3416]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="flex items-center gap-3 truncate text-3xl font-extrabold tracking-tight text-[#3d200a]">
            <Globe className="h-8 w-8 text-[#8B0000]" />
            Asset Explorer
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#6d3f1d]">
            Deep search and filter all tracked infrastructure variants in real-time.
          </p>
        </div>

        <div ref={filterPanelRef} className="mb-8 rounded-[30px] border border-white/55 bg-white/45 p-4 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-bold text-[#7a1f1f]">
                  Find and filter
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#3d200a]">
                  Search by asset name, TLS posture, and post-quantum handshake details.
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6d3f1d]/85">
                  Filters stay shareable through the URL. Search narrows the current results instantly on this page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-white/75 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#8a5d33]">
                  {activeFilterCount === 0
                    ? hasSearch
                      ? "Live search active"
                      : "Showing all assets"
                    : hasSearch
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"} + search`
                      : `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
                </div>
                {activeFilterCount > 0 || hasSearch ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/75 px-4 py-2 text-sm font-bold text-[#8B0000] transition-colors hover:border-[#8B0000]/30 hover:bg-white"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reset filters
                  </button>
                ) : null}
              </div>
            </div>

            <FilterControls
              search={search}
              setSearch={setSearch}
              dnsState={dnsState}
              setDnsState={setDnsState}
              tls={tls}
              setTls={setTls}
              keySize={keySize}
              setKeySize={setKeySize}
              signatureAlgorithm={signatureAlgorithm}
              setSignatureAlgorithm={setSignatureAlgorithm}
              port={port}
              setPort={setPort}
              certExpiry={certExpiry}
              setCertExpiry={setCertExpiry}
              cipher={cipher}
              setCipher={setCipher}
              timeoutOnly={timeoutOnly}
              setTimeoutOnly={setTimeoutOnly}
              noTlsOnly={noTlsOnly}
              setNoTlsOnly={setNoTlsOnly}
              pqcSupportedOnly={pqcSupportedOnly}
              setPqcSupportedOnly={setPqcSupportedOnly}
              pqcNegotiatedOnly={pqcNegotiatedOnly}
              setPqcNegotiatedOnly={setPqcNegotiatedOnly}
              kexAlgorithms={kexAlgorithms}
              setKexAlgorithms={setKexAlgorithms}
              kexGroups={kexGroups}
              setKexGroups={setKexGroups}
              filterOptions={filterOptions}
              dnsOptions={dnsOptions}
              tlsVersionOptions={tlsVersionOptions}
              keySizeOptions={keySizeOptions}
              portOptions={portOptions}
              certExpiryOptions={certExpiryOptions}
              signatureAlgorithmOptions={signatureAlgorithmOptions}
              cipherOptions={cipherOptions}
              scanResultOptions={scanResultOptions}
              tlsPresenceOptions={tlsPresenceOptions}
              kyberSupportOptions={kyberSupportOptions}
              kyberNegotiationOptions={kyberNegotiationOptions}
              activeAdvancedFilterCount={activeAdvancedFilterCount}
              showAdvancedFilters={showAdvancedFilters}
              setShowAdvancedFilters={setShowAdvancedFilters}
              toggleSelection={toggleSelection}
            />
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#8B0000]" />
              <p className="font-mono text-sm font-semibold text-[#6d3f1d]">Querying infrastructure...</p>
            </div>
          ) : totalMatch === 0 ? (
            <div className="flex flex-col items-center justify-center pb-32 pt-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/55 bg-white/45 backdrop-blur-md">
                <Search className="h-8 w-8 text-[#8B0000]" />
              </div>
              <p className="text-lg font-bold text-[#3d200a]">
                {hasSearch ? "No assets match this search." : "No correlated assets found."}
              </p>
              <p className="mt-1 max-w-sm text-sm font-medium text-[#6d3f1d]">
                {hasSearch
                  ? "Try a broader search term, or clear the search to return to the filtered result set."
                  : "Try broadening the filters, relaxing an advanced TLS condition, or clearing the current setup."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-28 sm:pb-32">
              <ResultsSummary
                usesEndpointMatching={usesEndpointMatching}
                totalMatch={totalMatch}
                matchingEndpointCount={matchingEndpointCount}
                assetCount={totalMatch}
              />
              {paginatedAssets.map((asset) => {
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
                    <div
                      className={cn(
                        "rounded-2xl border bg-white/45 px-5 py-4 shadow-sm backdrop-blur-md transition-all duration-200",
                        asset.summary?.issue
                          ? "border-red-500/20 hover:border-red-500/40 hover:bg-white/95"
                          : "border-amber-500/20 hover:border-amber-500/40 hover:bg-white/95"
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={canExpandMatches ? () => toggleAssetExpansion(asset.id) : undefined}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-4 text-left",
                            canExpandMatches ? "cursor-pointer" : "cursor-default"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              asset.summary?.issue ? "bg-red-100" : "bg-amber-100"
                            )}
                          >
                            {asset.type === "ip" ? (
                              <Server className={cn("h-5 w-5", asset.summary?.issue ? "text-red-600" : "text-amber-600")} />
                            ) : (
                              <Globe className={cn("h-5 w-5", asset.summary?.issue ? "text-red-600" : "text-amber-600")} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 truncate pr-4">
                            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                              <p className={cn("truncate text-sm font-bold transition-colors sm:text-base", nameTone)}>
                                {asset.name}
                              </p>
                              {canExpandMatches ? (
                                <span className="inline-flex items-center justify-center rounded-full bg-white/70 p-1 text-[#8B0000]">
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </span>
                              ) : null}
                              <RenderResolvedIpChip value={asset.name} type={asset.type} resolvedIp={asset.resolvedIp} />
                              {isDnsExpired ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      <AlertTriangle className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>The domain was not found in DNS.</TooltipContent>
                                </Tooltip>
                              ) : null}
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest",
                                  asset.isRoot ? "bg-[#3d200a]/10 text-[#3d200a]" : "bg-[#8B0000]/10 text-[#8B0000]"
                                )}
                              >
                                {asset.isRoot ? "Root" : "Leaf"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              {asset.summary?.issue ? (
                                <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  {asset.summary.issue}
                                </div>
                              ) : asset.summary?.timedOut ? (
                                <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Scan timeout
                                </div>
                              ) : asset.summary?.valid ? (
                                <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                                  <ShieldCheck className="h-3 w-3" />
                                  Secured
                                </div>
                              ) : (
                                <p className="text-[11px] font-bold uppercase tracking-widest text-[#6d3f1d]">
                                  No scan data
                                </p>
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

                        <div className="flex shrink-0 items-center gap-6 pl-14 sm:pl-0">
                          <div className="hidden items-center gap-6 md:flex">
                            {asset.summary?.daysRemaining !== undefined && asset.summary?.daysRemaining !== null ? (
                              <div className="flex flex-col items-end">
                                <p className="text-[10px] font-bold uppercase text-[#6d3f1d]">Expiry</p>
                                <p
                                  className={cn(
                                    "text-xs font-bold",
                                    asset.summary.daysRemaining <= 30 ? "text-red-600" : "text-emerald-700"
                                  )}
                                >
                                  {asset.summary.daysRemaining} days left
                                </p>
                              </div>
                            ) : null}

                            {asset.summary?.tls ? (
                              <div className="flex w-24 flex-col items-end">
                                <p className="text-[10px] font-bold uppercase text-[#6d3f1d]">Protocol</p>
                                <p className="truncate text-xs font-bold text-[#8B0000]">{asset.summary.tls}</p>
                              </div>
                            ) : null}
                          </div>

                          <Link
                            href={`/app/${org.slug}/asset/${asset.id}`}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                              asset.summary?.issue ? "bg-red-50 hover:bg-red-100" : "bg-amber-50 hover:bg-amber-100"
                            )}
                          >
                            <ChevronRight
                              className={cn("h-4 w-4", asset.summary?.issue ? "text-red-500" : "text-amber-600")}
                            />
                          </Link>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {canExpandMatches && isExpanded ? (
                          <motion.div
                            key={`expanded-${asset.id}`}
                            initial={{ height: 0, opacity: 0, y: -6 }}
                            animate={{ height: "auto", opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -6 }}
                            transition={expandTransition}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 border-t border-amber-500/10 pt-4">
                              <div className="space-y-2">
                                {asset.matchingEndpoints.map((endpoint: any) => (
                                  <motion.div
                                    key={`${asset.id}-${endpoint.portQueryValue}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.18 }}
                                  >
                                    <Link
                                      href={`/app/${org.slug}/asset/${asset.id}?port=${endpoint.portQueryValue}`}
                                      className="block rounded-xl border border-amber-500/15 bg-white/70 px-4 py-3 transition duration-200 hover:border-amber-500/30 hover:bg-white"
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
                                                Scan timeout
                                              </span>
                                            ) : endpoint.summary?.valid ? (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                <ShieldCheck className="h-3 w-3" />
                                                Secured
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                                No scan data
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
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {!loading && totalMatch > 0 ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/75 bg-[rgba(255,248,228,0.82)] px-2.5 py-2 shadow-xl shadow-amber-950/15 backdrop-blur-xl">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden h-9 items-center rounded-full border border-amber-500/15 bg-white/75 px-3 text-xs font-bold text-[#6d3f1d] sm:flex">
                    <span className="text-[#7a1f1f]">{pageStart}</span>
                    <span className="mx-1 text-[#8a5d33]/60">-</span>
                    <span className="text-[#7a1f1f]">{pageEnd}</span>
                    <span className="mx-1.5 text-[#8a5d33]/60">of</span>
                    <span className="text-[#7a1f1f]">{totalMatch}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Visible range</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => canGoToPreviousPage && setPage((current) => Math.max(1, current - 1))}
                    disabled={!canGoToPreviousPage}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-lg shadow-amber-950/10 transition",
                      canGoToPreviousPage
                        ? "border-[#7a1f1f]/50 bg-[#7a1f1f] text-white hover:bg-[#671818]"
                        : "border-white/75 bg-white/80 text-[#7a1f1f] opacity-45"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Previous page</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-9 items-center gap-2 rounded-full border border-[#163b73]/35 bg-[#163b73]/92 px-3 text-xs font-bold text-white shadow-lg shadow-amber-950/10">
                    <span className="whitespace-nowrap text-white/82">Page</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pageInputValue}
                      onChange={(event) => setPageInputValue(event.target.value.replace(/\D+/g, ""))}
                      onFocus={(event) => event.target.select()}
                      onBlur={commitPageInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitPageInput();
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-6 w-12 rounded-full bg-white/14 px-2 text-center text-xs font-bold text-white outline-none ring-1 ring-white/18 placeholder:text-white/60 focus:bg-white/18 focus:ring-white/30"
                      aria-label="Current page number"
                    />
                    <span className="whitespace-nowrap text-white/82">/ {totalPages}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Jump to page</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => canGoToNextPage && setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={!canGoToNextPage}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-lg shadow-amber-950/10 transition",
                      canGoToNextPage
                        ? "border-[#7a1f1f]/50 bg-[#7a1f1f] text-white hover:bg-[#671818]"
                        : "border-white/75 bg-white/80 text-[#7a1f1f] opacity-45"
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Next page</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => {
                        const nextPageSize = Number.parseInt(value, 10);
                        if (!pageSizeOptions.includes(nextPageSize)) return;
                        setPageSize(nextPageSize);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 min-w-[132px] rounded-full border-amber-500/20 bg-white/85 px-3 text-xs font-bold shadow-lg shadow-amber-950/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pageSizeOptions.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option} per page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Assets per page</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
