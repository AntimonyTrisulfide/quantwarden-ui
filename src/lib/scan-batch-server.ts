import { prisma } from "@/lib/prisma";
import type {
  OrgScanActivityPayload,
  ScanActivityBatch,
  ScanActivityItem,
  ScanBatchStatus,
  ScanBatchType,
  ScanFailureEntry,
  ScanHistoryEntry,
} from "@/lib/scan-activity-types";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";

export const MAX_OPENSSL_SCAN_CONCURRENCY = 5;

interface BatchRow {
  id: string;
  organizationId: string;
  type: ScanBatchType;
  status: ScanBatchStatus;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  initiatedById: string | null;
  initiatedByName: string | null;
  initiatedByEmail: string | null;
}

interface ScanRow {
  id: string;
  batchId: string | null;
  assetId: string;
  assetValue: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  resultData: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ClaimedScanItem {
  scanId: string;
  batchId: string;
  assetId: string;
  assetValue: string;
  batchType: ScanBatchType;
}

function extractError(resultData: string | null) {
  if (!resultData) return null;

  try {
    const parsed = JSON.parse(resultData);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.error === "string") return parsed.error;
    return null;
  } catch {
    return null;
  }
}

function toPercentComplete(completedAssets: number, failedAssets: number, totalAssets: number) {
  if (totalAssets <= 0) return 0;
  return Math.min(100, Math.round(((completedAssets + failedAssets) / totalAssets) * 100));
}

function toBatch(batch: BatchRow, scans: ScanRow[]): ScanActivityBatch {
  const items: ScanActivityItem[] = scans.map((scan) => ({
    id: scan.id,
    assetId: scan.assetId,
    assetValue: scan.assetValue,
    status: scan.status,
    createdAt: scan.createdAt.toISOString(),
    completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
    error: scan.status === "failed" ? extractError(scan.resultData) : null,
  }));

  const pendingAssets = items.filter((item) => item.status === "pending").length;
  const runningAssets = items.filter((item) => item.status === "running").length;
  const completedAssets = items.filter((item) => item.status === "completed").length;
  const failedAssets = items.filter((item) => item.status === "failed").length;
  const totalAssets = batch.totalAssets || items.length;

  return {
    id: batch.id,
    organizationId: batch.organizationId,
    type: batch.type,
    status: batch.status,
    totalAssets,
    completedAssets,
    failedAssets,
    pendingAssets,
    runningAssets,
    percentComplete: toPercentComplete(completedAssets, failedAssets, totalAssets),
    createdAt: batch.createdAt.toISOString(),
    startedAt: batch.startedAt ? batch.startedAt.toISOString() : null,
    completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
    initiatedBy: batch.initiatedById
      ? {
          id: batch.initiatedById,
          name: batch.initiatedByName,
          email: batch.initiatedByEmail,
        }
      : null,
    items,
  };
}

function toHistoryEntry(batch: ScanActivityBatch, scans: ScanRow[]): ScanHistoryEntry {
  const dnsExpiredAssets = scans.reduce((count, scan) => {
    if (scan.status !== "completed" || !scan.resultData) return count;
    const parsed = parseOpenSSLScanResult(scan.resultData);
    return parsed.summary?.dnsMissing ? count + 1 : count;
  }, 0);

  const completedAssets = batch.items.filter((item) => item.status === "completed").length;
  const failures = scans
    .filter((scan) => scan.status === "failed")
    .map((scan) => ({
      scanId: scan.id,
      assetId: scan.assetId,
      assetValue: scan.assetValue,
      error: extractError(scan.resultData),
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });
  const failedAssets = failures.length;
  const successfulAssets = Math.max(0, completedAssets - dnsExpiredAssets);

  const startedAtMs = batch.startedAt ? new Date(batch.startedAt).getTime() : null;
  const completedAtMs = batch.completedAt ? new Date(batch.completedAt).getTime() : null;
  const durationSeconds =
    startedAtMs && completedAtMs && completedAtMs >= startedAtMs
      ? Math.round((completedAtMs - startedAtMs) / 1000)
      : null;

  return {
    batchId: batch.id,
    type: batch.type,
    status: batch.status,
    createdAt: batch.createdAt,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    totalAssets: batch.totalAssets,
    successfulAssets,
    failedAssets,
    dnsExpiredAssets,
    durationSeconds,
    failures,
  };
}

export async function refreshScanBatch(batchId: string) {
  const rows = await prisma.$queryRawUnsafe<BatchRow[]>(
    `WITH stats AS (
        SELECT
          COUNT(*)::int as total,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0)::int as failed,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)::int as pending,
          COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0)::int as running
        FROM "asset_scan"
        WHERE "batchId" = $1
      )
      UPDATE "asset_scan_batch" b
      SET
        "totalAssets" = stats.total,
        "completedAssets" = stats.completed,
        "failedAssets" = stats.failed,
        status = CASE
          WHEN b.status = 'cancelled' THEN 'cancelled'
          WHEN stats.running > 0 THEN 'running'
          WHEN stats.pending > 0 AND b."startedAt" IS NOT NULL THEN 'running'
          WHEN stats.pending > 0 THEN 'queued'
          WHEN stats.failed > 0 THEN 'failed'
          ELSE 'completed'
        END,
        "completedAt" = CASE
          WHEN stats.pending = 0 AND stats.running = 0 THEN COALESCE(b."completedAt", NOW())
          ELSE NULL
        END
      FROM stats
      WHERE b.id = $1
      RETURNING
        b.id,
        b."organizationId",
        b.type,
        b.status,
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        NULL::text as "initiatedById",
        NULL::text as "initiatedByName",
        NULL::text as "initiatedByEmail"`,
    batchId
  );

  return rows[0] ?? null;
}

export async function getActiveScanLock(orgId: string) {
  const rows = await prisma.$queryRawUnsafe<BatchRow[]>(
    `SELECT
        b.id,
        b."organizationId",
        b.type,
        b.status,
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        u.id as "initiatedById",
        u.name as "initiatedByName",
        u.email as "initiatedByEmail"
      FROM "asset_scan_batch" b
      INNER JOIN "user" u ON u.id = b."initiatedByUserId"
      WHERE b."organizationId" = $1
        AND b.type IN ('group', 'full')
        AND b.status IN ('queued', 'running')
      ORDER BY b."createdAt" DESC
      LIMIT 1`,
    orgId
  );

  if (rows.length === 0) return null;
  return rows[0];
}

export async function claimNextPendingScan(orgId: string): Promise<ClaimedScanItem | null> {
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
      orgId
    );

    const runningRows = await tx.$queryRawUnsafe<{ running: number }[]>(
      `SELECT COUNT(*)::int as running
       FROM "asset_scan" s
       INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
       WHERE b."organizationId" = $1
         AND b.status IN ('queued', 'running')
         AND s.status = 'running'`,
      orgId
    );

    if ((runningRows[0]?.running || 0) >= MAX_OPENSSL_SCAN_CONCURRENCY) {
      return null;
    }

    const claimRows = await tx.$queryRawUnsafe<ClaimedScanItem[]>(
      `WITH next_scan AS (
          SELECT
            s.id as "scanId",
            s."batchId" as "batchId",
            s."assetId" as "assetId",
            a.value as "assetValue",
            b.type as "batchType"
          FROM "asset_scan" s
          INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
          INNER JOIN "asset" a ON a.id = s."assetId"
          WHERE b."organizationId" = $1
            AND b.status IN ('queued', 'running')
            AND s.status = 'pending'
          ORDER BY
            CASE b.type
              WHEN 'group' THEN 0
              WHEN 'full' THEN 1
              ELSE 2
            END,
            b."createdAt" ASC,
            s."createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "asset_scan" s
        SET status = 'running'
        FROM next_scan
        WHERE s.id = next_scan."scanId"
        RETURNING
          next_scan."scanId",
          next_scan."batchId",
          next_scan."assetId",
          next_scan."assetValue",
          next_scan."batchType"`,
      orgId
    );

    if (claimRows.length === 0) {
      return null;
    }

    const nextClaim = claimRows[0];

    await Promise.all([
      tx.$executeRawUnsafe(
        `UPDATE "asset" SET "scanStatus" = 'scanning' WHERE id = $1`,
        nextClaim.assetId
      ),
      tx.$executeRawUnsafe(
        `UPDATE "asset_scan_batch"
         SET status = 'running', "startedAt" = COALESCE("startedAt", $2)
         WHERE id = $1`,
        nextClaim.batchId,
        new Date()
      ),
    ]);

    return nextClaim;
  });

  if (claim?.batchId) {
    await refreshScanBatch(claim.batchId);
  }

  return claim;
}

export async function cancelScanBatch(orgId: string, batchId: string) {
  const now = new Date();
  const cancellationPayload = JSON.stringify({ error: "Scan batch cancelled by user." });

  const rows = await prisma.$transaction(async (tx) => {
    const batchRows = await tx.$queryRawUnsafe<BatchRow[]>(
      `SELECT
          b.id,
          b."organizationId",
          b.type,
          b.status,
          b."totalAssets",
          b."completedAssets",
          b."failedAssets",
          b."createdAt",
          b."startedAt",
          b."completedAt",
          NULL::text as "initiatedById",
          NULL::text as "initiatedByName",
          NULL::text as "initiatedByEmail"
        FROM "asset_scan_batch" b
        WHERE b.id = $1
          AND b."organizationId" = $2
        LIMIT 1`,
      batchId,
      orgId
    );

    const batch = batchRows[0];
    if (!batch || (batch.status !== "queued" && batch.status !== "running")) {
      return null;
    }

    const cancelledScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
      `UPDATE "asset_scan"
       SET
         status = 'cancelled',
         "resultData" = COALESCE("resultData", $3),
         "completedAt" = COALESCE("completedAt", $4)
       WHERE "batchId" = $1
         AND status IN ('pending', 'running')`,
      batchId,
      orgId,
      cancellationPayload,
      now
    );

    await tx.$executeRawUnsafe(
      `UPDATE "asset_scan_batch"
       SET status = 'cancelled', "completedAt" = $2
       WHERE id = $1`,
      batchId,
      now
    );

    return {
      batch,
      affectedAssetIds: Array.from(new Set(cancelledScanRows.map((row) => row.assetId))),
    };
  });

  if (!rows) return null;

  for (const assetId of rows.affectedAssetIds) {
    const previousTerminalRows = await prisma.$queryRawUnsafe<ScanRow[]>(
      `SELECT
          s.id,
          s."batchId",
          s."assetId",
          a.value as "assetValue",
          s.status,
          s."resultData",
          s."createdAt",
          s."completedAt"
        FROM "asset_scan" s
        INNER JOIN "asset" a ON a.id = s."assetId"
        INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
        WHERE s."assetId" = $1
          AND b."organizationId" = $2
          AND s.type = 'openssl'
          AND s."batchId" <> $3
          AND s.status IN ('completed', 'failed')
        ORDER BY
          COALESCE(s."completedAt", s."createdAt") DESC,
          s."createdAt" DESC
        LIMIT 1`,
      assetId,
      orgId,
      batchId
    );

    const previousTerminal = previousTerminalRows[0] || null;
    let restoredStatus: "idle" | "completed" | "failed" | "expired" = "idle";
    let restoredLastScanDate: Date | null = null;

    if (previousTerminal) {
      if (previousTerminal.status === "failed") {
        restoredStatus = "failed";
      } else {
        const parsed = parseOpenSSLScanResult(previousTerminal.resultData);
        restoredStatus = parsed.summary?.dnsMissing ? "expired" : "completed";
      }

      restoredLastScanDate = previousTerminal.completedAt || previousTerminal.createdAt;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "asset"
       SET "scanStatus" = $1, "lastScanDate" = $2
       WHERE id = $3`,
      restoredStatus,
      restoredLastScanDate,
      assetId
    );
  }

  return rows.batch;
}

export async function getOrgScanActivity(orgId: string, canScan: boolean): Promise<OrgScanActivityPayload> {
  const batchRows = await prisma.$queryRawUnsafe<BatchRow[]>(
    `SELECT
        b.id,
        b."organizationId",
        b.type,
        b.status,
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        u.id as "initiatedById",
        u.name as "initiatedByName",
        u.email as "initiatedByEmail"
      FROM "asset_scan_batch" b
      INNER JOIN "user" u ON u.id = b."initiatedByUserId"
      WHERE b."organizationId" = $1
      ORDER BY
        CASE
          WHEN b.status IN ('queued', 'running') THEN 0
          ELSE 1
        END,
        b."createdAt" DESC
      LIMIT 8`,
    orgId
  );

  const batchIds = batchRows.map((batch) => batch.id);
  const scanRows = batchIds.length > 0
    ? await prisma.$queryRawUnsafe<ScanRow[]>(
        `SELECT
            s.id,
            s."batchId",
            s."assetId",
            a.value as "assetValue",
            s.status,
            s."resultData",
            s."createdAt",
            s."completedAt"
          FROM "asset_scan" s
          INNER JOIN "asset" a ON a.id = s."assetId"
          WHERE s."batchId" = ANY($1::text[])
          ORDER BY s."createdAt" DESC`,
        batchIds
      )
    : [];

  const scansByBatch = new Map<string, ScanRow[]>();
  for (const scan of scanRows) {
    if (!scan.batchId) continue;
    const existing = scansByBatch.get(scan.batchId) || [];
    existing.push(scan);
    scansByBatch.set(scan.batchId, existing);
  }

  const hydratedBatches = batchRows.map((batch) => toBatch(batch, scansByBatch.get(batch.id) || []));
  const batchesById = new Map(hydratedBatches.map((batch) => [batch.id, batch]));
  const activeBatches = hydratedBatches.filter((batch) => batch.status === "queued" || batch.status === "running");
  const recentHistoryBatches = hydratedBatches
    .filter((batch) => batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled")
    .slice(0, 8);
  const latestCompletedBatch =
    hydratedBatches.find((batch) => batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled") || null;
  const latestBatch = activeBatches[0] || latestCompletedBatch;
  const recentHistory = recentHistoryBatches
    .map((batch) => toHistoryEntry(batch, scansByBatch.get(batch.id) || []));
  const allFailures: ScanFailureEntry[] = recentHistory.flatMap((entry) =>
    entry.failures.map((failure) => ({
      ...failure,
      batchId: entry.batchId,
      batchType: entry.type,
      batchStatus: entry.status,
    }))
  );
  const lockBatch = hydratedBatches.find(
    (batch) => (batch.type === "group" || batch.type === "full") && (batch.status === "queued" || batch.status === "running")
  ) || null;

  return {
    orgId,
    canScan,
    activeBatches,
    latestCompletedBatch,
    latestBatch,
    recentHistoryBatches,
    recentHistory,
    allFailures,
    lock: lockBatch
      ? {
          active: true,
          batchId: lockBatch.id,
          type: lockBatch.type,
          status: lockBatch.status,
          message:
            lockBatch.type === "group"
              ? "A group scan is running for this organization."
              : "A full scan is running for this organization.",
          initiatedAt: lockBatch.createdAt,
          initiatedBy: lockBatch.initiatedBy,
          percentComplete: lockBatch.percentComplete,
        }
      : {
          active: false,
          batchId: null,
          type: null,
          status: null,
          message: null,
          initiatedAt: null,
          initiatedBy: null,
          percentComplete: 0,
        },
  };
}
