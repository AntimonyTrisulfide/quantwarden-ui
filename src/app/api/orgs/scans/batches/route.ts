import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { getOrgScanActivity } from "@/lib/scan-batch-server";
import { getEnabledPortList, normalizePortDiscoveryConfig } from "@/lib/port-discovery";
import { getCurrentOpenSSLPorts } from "@/lib/openssl-port-rollup";
import type { ScanBatchType, ScanEngine } from "@/lib/scan-activity-types";

interface CreateBatchBody {
  orgId?: string;
  type?: ScanBatchType;
  engine?: ScanEngine;
  assetIds?: string[];
  configSnapshot?: unknown;
}

interface ActiveLockRow {
  id: string;
  engine: ScanEngine;
  type: ScanBatchType;
}

const VALID_TYPES = new Set<ScanBatchType>(["single", "group", "full"]);
const VALID_ENGINES = new Set<ScanEngine>(["openssl", "portDiscovery"]);

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreateBatchBody;
    try {
      const rawBody = await req.text();
      if (!rawBody.trim()) {
        return NextResponse.json({ error: "Missing batch payload." }, { status: 400 });
      }

      body = JSON.parse(rawBody) as CreateBatchBody;
    } catch {
      return NextResponse.json({ error: "Invalid batch payload." }, { status: 400 });
    }

    const orgId = body.orgId;
    const type = body.type;
    const engine = body.engine && VALID_ENGINES.has(body.engine) ? body.engine : "openssl";
    const assetIds = Array.isArray(body.assetIds) ? Array.from(new Set(body.assetIds.filter(Boolean))) : [];

    if (!orgId || !type || !VALID_TYPES.has(type) || assetIds.length === 0) {
      return NextResponse.json({ error: "Invalid batch payload." }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    const batchId = crypto.randomUUID();
    const now = new Date();
    const transactionResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        orgId
      );

      const lockRows = await tx.$queryRawUnsafe<ActiveLockRow[]>(
        `SELECT b.id, b.engine, b.type
         FROM "asset_scan_batch" b
         WHERE b."organizationId" = $1
           AND b.status IN ('queued', 'running')
         ORDER BY b."createdAt" DESC
         LIMIT 1`,
        orgId
      );

      const lock = lockRows[0] ?? null;
      if (lock) {
        return {
          ok: false as const,
          status: 409,
          payload: {
            error:
              lock.engine === "portDiscovery"
                ? lock.type === "single"
                  ? "A port discovery scan is already running for this organization."
                  : "A port discovery batch is already running for this organization."
                : lock.type === "group"
                  ? "An OpenSSL group scan is already running for this organization."
                  : lock.type === "single"
                    ? "An OpenSSL scan is already running for this organization."
                    : "An OpenSSL full scan is already running for this organization.",
            lockBatchId: lock.id,
            lockEngine: lock.engine,
            lockType: lock.type,
          },
        };
      }

      const assetTypeFilter =
        engine === "portDiscovery"
          ? `type IN ('domain', 'ip')`
          : `type = 'domain'`;

      const assetRows = await tx.$queryRawUnsafe<{ id: string; value: string; openPorts: string | null }[]>(
        `SELECT id, value, "openPorts"
         FROM "asset"
         WHERE "organizationId" = $1
           AND ${assetTypeFilter}
           AND id = ANY($2::text[])
         ORDER BY value ASC`,
        orgId,
        assetIds
      );

      if (assetRows.length === 0) {
        return {
          ok: false as const,
          status: 400,
          payload: { error: engine === "portDiscovery" ? "No scannable assets were selected." : "No scannable domain assets were selected." },
        };
      }

      const activeScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
        `SELECT DISTINCT s."assetId" as "assetId"
         FROM "asset_scan" s
         INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
         WHERE b."organizationId" = $1
           AND b.status IN ('queued', 'running')
           AND s."assetId" = ANY($2::text[])`,
        orgId,
        assetRows.map((asset) => asset.id)
      );

      const activeAssetIds = new Set(activeScanRows.map((row) => row.assetId));
      const batchAssets = assetRows.filter((asset) => !activeAssetIds.has(asset.id));

      if (batchAssets.length === 0) {
        return {
          ok: false as const,
          status: 409,
          payload: { error: "Those assets already have active scans in progress." },
        };
      }

      if (type === "single" && batchAssets.length !== 1) {
        return {
          ok: false as const,
          status: 400,
          payload: { error: "Single scan batches must contain exactly one asset." },
        };
      }

      if (type === "group" && batchAssets.length < 2) {
        return {
          ok: false as const,
          status: 400,
          payload: { error: "Group scans require at least two selected assets." },
        };
      }

      const configSnapshot =
        engine === "portDiscovery"
          ? normalizePortDiscoveryConfig(body.configSnapshot)
          : null;

      if (engine === "portDiscovery" && getEnabledPortList(configSnapshot.entries).length === 0) {
        return {
          ok: false as const,
          status: 400,
          payload: { error: "Select at least one enabled port before starting port discovery." },
        };
      }

      const scanTargets =
        engine === "openssl"
          ? batchAssets.flatMap((asset) =>
              getCurrentOpenSSLPorts(asset.openPorts).map((port) => ({
                scanId: crypto.randomUUID(),
                assetId: asset.id,
                portNumber: port.number,
                portProtocol: port.protocol,
              }))
            )
          : batchAssets.map((asset) => ({
              scanId: crypto.randomUUID(),
              assetId: asset.id,
              portNumber: null,
              portProtocol: null,
            }));

      const scanIds = scanTargets.map((target) => target.scanId);
      const scanAssetIds = scanTargets.map((target) => target.assetId);

      await tx.$executeRawUnsafe(
        `INSERT INTO "asset_scan_batch"
          (id, "organizationId", "initiatedByUserId", engine, type, status, "configSnapshot", "totalAssets", "completedAssets", "failedAssets", "createdAt")
         VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, 0, 0, $8)`,
        batchId,
        orgId,
        session.user.id,
        engine,
        type,
        configSnapshot ? JSON.stringify(configSnapshot) : null,
        scanTargets.length,
        now
      );

      if (engine === "openssl") {
        const scanPortNumbers = scanTargets.map((target) => target.portNumber);
        const scanPortProtocols = scanTargets.map((target) => target.portProtocol);

        await tx.$executeRawUnsafe(
          `INSERT INTO "asset_scan" (id, "assetId", "batchId", type, "portNumber", "portProtocol", status, "createdAt")
           SELECT scan_row.scan_id, scan_row.asset_id, $5, $6, scan_row.port_number, scan_row.port_protocol, 'pending', $7
           FROM unnest($1::text[], $2::text[], $3::int[], $4::text[]) AS scan_row(scan_id, asset_id, port_number, port_protocol)`,
          scanIds,
          scanAssetIds,
          scanPortNumbers,
          scanPortProtocols,
          batchId,
          engine,
          now
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO "asset_scan" (id, "assetId", "batchId", type, status, "createdAt")
           SELECT scan_row.scan_id, scan_row.asset_id, $3, $4, 'pending', $5
           FROM unnest($1::text[], $2::text[]) AS scan_row(scan_id, asset_id)`,
          scanIds,
          scanAssetIds,
          batchId,
          engine,
          now
        );
      }

      return {
        ok: true as const,
        queuedAssets: scanTargets.length,
      };
    }, {
      maxWait: 10_000,
      timeout: 15_000,
    });

    if (!transactionResult.ok) {
      return NextResponse.json(transactionResult.payload, { status: transactionResult.status });
    }

    const activity = await getOrgScanActivity(orgId, scanAccess.canScan);
    return NextResponse.json({
      success: true,
      batchId,
      batchType: type,
      queuedAssets: transactionResult.queuedAssets,
      activity,
    });
  } catch (error) {
    console.error("Create scan batch error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
