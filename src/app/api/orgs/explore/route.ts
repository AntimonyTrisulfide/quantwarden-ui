import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { hasKyberGroup } from "@/lib/pqc";

type AssetRow = {
  assetId: string;
  assetName: string;
  assetType: string;
  isRoot: boolean;
  addedAt: Date;
  resolvedIp: string | null;
  openPorts: string | null;
  scanStatus: string | null;
};

type AssetEndpointScanRow = {
  assetId: string;
  resultData: string | null;
  completedAt: Date | null;
  createdAt: Date;
  portNumber: number | null;
  portProtocol: string | null;
};

type AssetScanSummary = {
  valid: boolean;
  dnsMissing: boolean;
  timedOut: boolean;
  daysRemaining: number | null;
  cipher: string | null;
  discoveredCiphers: string[];
  tls: string | null;
  keySize: string | null;
  issue: string;
};

function formatEndpointLabel(row: Pick<AssetEndpointScanRow, "portNumber" | "portProtocol">) {
  const portNumber = row.portNumber ?? 443;
  const portProtocol = (row.portProtocol || "tcp").toUpperCase();
  return `${portNumber}/${portProtocol}`;
}

function formatEndpointQueryValue(row: Pick<AssetEndpointScanRow, "portNumber" | "portProtocol">) {
  const portNumber = row.portNumber ?? 443;
  const portProtocol = (row.portProtocol || "tcp").toLowerCase();
  return `${portNumber}-${portProtocol}`;
}

type ParsedScanEntry = {
  row: AssetEndpointScanRow;
  parsed: ReturnType<typeof parseOpenSSLScanResult>;
  completedAtTime: number;
};

function buildSummary(parsed: ReturnType<typeof parseOpenSSLScanResult>): AssetScanSummary | null {
  const derived = parsed.summary;
  const hasTimedOut = Boolean(parsed.error && /timed out/i.test(parsed.error));

  if (!derived) {
    if (!hasTimedOut) return null;
    return {
      valid: false,
      dnsMissing: false,
      timedOut: true,
      daysRemaining: null,
      cipher: null,
      discoveredCiphers: [],
      tls: null,
      keySize: null,
      issue: "Scan Timeout",
    };
  }

  const isDnsMissing = derived.dnsMissing === true;
  const isNoTls = derived.noTlsDetected === true;
  const isInvalid = derived.certificateValid === false;
  const daysLeft = derived.daysRemaining;
  const isExpiring = typeof daysLeft === "number" && daysLeft <= 30;
  const isVuln = derived.tlsVersionSecure === false;

  return {
    valid: !isDnsMissing && !isNoTls && !isInvalid,
    dnsMissing: isDnsMissing,
    timedOut: hasTimedOut,
    daysRemaining: daysLeft,
    cipher: derived.preferredCipher,
    discoveredCiphers: derived.cipherPreferenceOrder || [],
    tls: derived.primaryTlsVersion,
    keySize:
      derived.publicKeyAlgorithm && derived.publicKeyBits
        ? `${derived.publicKeyAlgorithm} ${derived.publicKeyBits}-bit`
        : null,
    issue: isDnsMissing
      ? "DNS Expired"
      : isNoTls
        ? "No TLS Detected"
        : isInvalid
          ? "Invalid Certificate"
          : isExpiring
            ? "Expiring Soon"
            : isVuln
              ? "TLS Vuln"
              : "",
  };
}

function scanMatchesFilters(
  parsed: ReturnType<typeof parseOpenSSLScanResult>,
  filters: {
    dnsStateVal: string;
    timeoutOnlyVal: string;
    selectedKexAlgos: string[];
    selectedKexGroups: string[];
    pqcSupportedOnly: boolean;
    pqcNegotiatedOnly: boolean;
    cipherVal: string;
    keySizeVal: string;
    tlsVal: string;
  }
) {
  const {
    dnsStateVal,
    timeoutOnlyVal,
    selectedKexAlgos,
    selectedKexGroups,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    cipherVal,
    keySizeVal,
    tlsVal,
  } = filters;

  const summary = parsed.summary;
  const hasTimedOut = Boolean(parsed.error && /timed out/i.test(parsed.error));

  if (timeoutOnlyVal === "true" && !hasTimedOut) {
    return false;
  }

  if (!summary) {
    const hasScanSpecificFilters =
      Boolean(dnsStateVal) ||
      Boolean(cipherVal) ||
      Boolean(keySizeVal) ||
      Boolean(tlsVal) ||
      selectedKexAlgos.length > 0 ||
      selectedKexGroups.length > 0 ||
      pqcSupportedOnly ||
      pqcNegotiatedOnly;

    return !hasScanSpecificFilters && hasTimedOut;
  }

  if (dnsStateVal === "found" && summary.dnsMissing) return false;
  if (dnsStateVal === "not_found" && !summary.dnsMissing) return false;

  if (selectedKexAlgos.length > 0) {
    const rowAlgos = new Set(summary.keyExchangeAlgorithms || []);
    if (!selectedKexAlgos.some((algo) => rowAlgos.has(algo))) return false;
  }

  if (selectedKexGroups.length > 0) {
    const rowGroups = new Set(summary.negotiatedGroup ? [summary.negotiatedGroup] : []);
    if (!selectedKexGroups.some((group) => rowGroups.has(group))) return false;
  }

  if (pqcSupportedOnly && !hasKyberGroup(summary.supportedGroups)) return false;
  if (pqcNegotiatedOnly && !hasKyberGroup([summary.negotiatedGroup])) return false;

  if (cipherVal) {
    const discoveredCipherSuites = new Set<string>([
      ...(summary.cipherPreferenceOrder || []),
      ...(summary.preferredCipher ? [summary.preferredCipher] : []),
      ...(summary.negotiatedCipher ? [summary.negotiatedCipher] : []),
    ]);
    if (!discoveredCipherSuites.has(cipherVal)) return false;
  }

  if (keySizeVal) {
    const actualKey =
      summary.publicKeyAlgorithm && summary.publicKeyBits
        ? `${summary.publicKeyAlgorithm} ${summary.publicKeyBits}-bit`
        : "";
    if (actualKey !== keySizeVal) return false;
  }

  if (tlsVal) {
    const discoveredTlsVersions = new Set<string>([
      ...(summary.supportedTlsVersions || []),
      ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : []),
    ]);
    if (!discoveredTlsVersions.has(tlsVal)) return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dnsStateVal = searchParams.get("dnsState") || "";
    const timeoutOnlyVal = searchParams.get("timeoutOnly") || "";
    const selectedKexAlgos = (searchParams.get("kexAlgos") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const selectedKexGroups = (searchParams.get("kexGroups") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const pqcSupportedOnly = searchParams.get("pqcSupported") === "true";
    const pqcNegotiatedOnly = searchParams.get("pqcNegotiated") === "true";
    const cipherVal = searchParams.get("cipher") || "";
    const keySizeVal = searchParams.get("keySize") || "";
    const tlsVal = searchParams.get("tls") || "";
    const searchVal = (searchParams.get("search") || "").toLowerCase();

    const filters = {
      dnsStateVal,
      timeoutOnlyVal,
      selectedKexAlgos,
      selectedKexGroups,
      pqcSupportedOnly,
      pqcNegotiatedOnly,
      cipherVal,
      keySizeVal,
      tlsVal,
    };

    const assetRows = await prisma.$queryRawUnsafe<AssetRow[]>(
      `SELECT
          a.id as "assetId",
          a.value as "assetName",
          a.type as "assetType",
          a."isRoot" as "isRoot",
          a."createdAt" as "addedAt",
          a."resolvedIp" as "resolvedIp",
          a."openPorts" as "openPorts",
          a."scanStatus" as "scanStatus"
       FROM "asset" a
       WHERE a."organizationId" = $1
       ORDER BY a."createdAt" DESC`,
      orgId
    );

    const endpointScanRows = await prisma.$queryRawUnsafe<AssetEndpointScanRow[]>(
      `SELECT DISTINCT ON (
          s."assetId",
          COALESCE(s."portNumber", 443),
          LOWER(COALESCE(s."portProtocol", 'tcp'))
       )
          s."assetId" as "assetId",
          s."resultData" as "resultData",
          s."completedAt" as "completedAt",
          s."createdAt" as "createdAt",
          s."portNumber" as "portNumber",
          s."portProtocol" as "portProtocol"
       FROM "asset_scan" s
       INNER JOIN "asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1
         AND s.type = 'openssl'
         AND s.status IN ('completed', 'failed')
       ORDER BY
         s."assetId",
         COALESCE(s."portNumber", 443),
         LOWER(COALESCE(s."portProtocol", 'tcp')),
         s."completedAt" DESC NULLS LAST,
         s."createdAt" DESC`,
      orgId
    );

    const scansByAssetId = new Map<string, ParsedScanEntry[]>();

    const cipherOptions = new Set<string>();
    const keySizeOptions = new Set<string>();
    const tlsOptions = new Set<string>();
    const kexAlgorithmOptions = new Set<string>();
    const negotiatedGroupOptions = new Set<string>();

    for (const row of endpointScanRows) {
      const parsed = parseOpenSSLScanResult(row.resultData);
      const entry: ParsedScanEntry = {
        row,
        parsed,
        completedAtTime: new Date(row.completedAt || row.createdAt).getTime(),
      };

      const current = scansByAssetId.get(row.assetId) || [];
      current.push(entry);
      scansByAssetId.set(row.assetId, current);

      if (!parsed.summary) continue;

      if (parsed.summary.preferredCipher) cipherOptions.add(parsed.summary.preferredCipher);
      if (parsed.summary.negotiatedCipher) cipherOptions.add(parsed.summary.negotiatedCipher);
      for (const cipher of parsed.summary.cipherPreferenceOrder || []) {
        if (cipher) cipherOptions.add(cipher);
      }
      if (parsed.summary.primaryTlsVersion) tlsOptions.add(parsed.summary.primaryTlsVersion);
      for (const version of parsed.summary.supportedTlsVersions || []) {
        if (version) tlsOptions.add(version);
      }
      if (parsed.summary.publicKeyAlgorithm && parsed.summary.publicKeyBits) {
        keySizeOptions.add(`${parsed.summary.publicKeyAlgorithm} ${parsed.summary.publicKeyBits}-bit`);
      }
      for (const algorithm of parsed.summary.keyExchangeAlgorithms || []) {
        if (algorithm) kexAlgorithmOptions.add(algorithm);
      }
      if (parsed.summary.negotiatedGroup) negotiatedGroupOptions.add(parsed.summary.negotiatedGroup);
    }

    for (const assetScans of scansByAssetId.values()) {
      assetScans.sort((left, right) => right.completedAtTime - left.completedAtTime);
    }

    const filtered: Array<{
      id: string;
      name: string;
      type: string;
      isRoot: boolean;
      addedAt: Date;
      resolvedIp: string | null;
      openPorts: string | null;
      scanStatus: string | null;
      scanCompletedAt: Date | null;
      summary: AssetScanSummary | null;
      selectedEndpointLabel: string | null;
      matchingEndpointCount: number;
      matchingEndpointLabels: string[];
      matchingEndpoints: Array<{
        portNumber: number;
        portProtocol: string;
        portLabel: string;
        portQueryValue: string;
        scanCompletedAt: Date | null;
        summary: AssetScanSummary | null;
        isPreview: boolean;
      }>;
    }> = [];

    const hasScanFilters =
      Boolean(dnsStateVal) ||
      timeoutOnlyVal === "true" ||
      Boolean(cipherVal) ||
      Boolean(keySizeVal) ||
      Boolean(tlsVal) ||
      selectedKexAlgos.length > 0 ||
      selectedKexGroups.length > 0 ||
      pqcSupportedOnly ||
      pqcNegotiatedOnly;

    for (const asset of assetRows) {
      if (searchVal && !asset.assetName.toLowerCase().includes(searchVal)) {
        continue;
      }

      const assetScans = scansByAssetId.get(asset.assetId) || [];
      const matchingEntries = hasScanFilters
        ? assetScans.filter((entry) => scanMatchesFilters(entry.parsed, filters))
        : assetScans.slice(0, 1);

      let chosenEntry: ParsedScanEntry | null = null;

      if (hasScanFilters) {
        chosenEntry = matchingEntries[0] || null;
        if (!chosenEntry) {
          continue;
        }
      } else {
        chosenEntry = assetScans[0] || null;
      }

      const summary = chosenEntry ? buildSummary(chosenEntry.parsed) : null;
      const matchingEndpointLabels = Array.from(
        new Set(matchingEntries.map((entry) => formatEndpointLabel(entry.row)))
      );
      const matchingEndpoints = matchingEntries.map((entry) => ({
        portNumber: entry.row.portNumber ?? 443,
        portProtocol: (entry.row.portProtocol || "tcp").toLowerCase(),
        portLabel: formatEndpointLabel(entry.row),
        portQueryValue: formatEndpointQueryValue(entry.row),
        scanCompletedAt: entry.row.completedAt ?? null,
        summary: buildSummary(entry.parsed),
        isPreview:
          Boolean(chosenEntry) &&
          formatEndpointQueryValue(entry.row) === formatEndpointQueryValue(chosenEntry.row),
      }));

      filtered.push({
        id: asset.assetId,
        name: asset.assetName,
        type: asset.assetType,
        isRoot: asset.isRoot,
        addedAt: asset.addedAt,
        resolvedIp: asset.resolvedIp ?? null,
        openPorts: asset.openPorts ?? null,
        scanStatus: asset.scanStatus ?? null,
        scanCompletedAt: chosenEntry?.row.completedAt ?? null,
        summary,
        selectedEndpointLabel: chosenEntry ? formatEndpointLabel(chosenEntry.row) : null,
        matchingEndpointCount: matchingEntries.length,
        matchingEndpointLabels,
        matchingEndpoints,
      });
    }

    return NextResponse.json({
      assets: filtered.slice(0, 500),
      totalMatch: filtered.length,
      matchingEndpointCount: filtered.reduce(
        (sum, asset) => sum + Math.max(asset.matchingEndpointCount, 0),
        0
      ),
      usesEndpointMatching: hasScanFilters,
      filterOptions: {
        ciphers: [...cipherOptions].sort(),
        keySizes: [...keySizeOptions].sort(),
        tlsVersions: [...tlsOptions].sort(),
        kexAlgorithms: [...kexAlgorithmOptions].sort(),
        kexGroups: [...negotiatedGroupOptions].sort(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to compile exploration data" }, { status: 500 });
  }
}
