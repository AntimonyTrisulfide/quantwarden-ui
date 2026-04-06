import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import type { OrgScanActivityPayload, ScanActivityBatch, ScanActivityItem, ScanEngine } from "@/lib/scan-activity-types";
import {
  cancelScanBatch,
  claimNextPendingScan,
  getOrgScanActivity,
  MAX_OPENSSL_SCAN_CONCURRENCY,
  MAX_PORT_DISCOVERY_SCAN_CONCURRENCY,
} from "@/lib/scan-batch-server";
import {
  isOpenSSLRequestTimeoutError,
  isOpenSSLServiceUnavailableError,
  runOpenSSLScanItem,
} from "@/lib/openssl-scan-runner";
import {
  isPortDiscoveryRequestTimeoutError,
  isPortDiscoveryServiceUnavailableError,
  runPortDiscoveryItem,
} from "@/lib/port-discovery-runner";

const ACTIVE_TICK_MS = 1500;
const IDLE_TICK_MS = 10000;
const HEARTBEAT_MS = 10000;
const SERVICE_UNAVAILABLE_EVENT_THROTTLE_MS = 15000;
const SERVICE_UNAVAILABLE_RETRY_COOLDOWN_MS = 12000;
const SERVICE_UNAVAILABLE_SHUTDOWN_MS = 30000;
const SERVICE_UNAVAILABLE_COUNTDOWN_TICK_MS = 1000;

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function engineLabel(engine: ScanEngine | null) {
  return engine === "portDiscovery" ? "Nmap API" : "OpenSSL";
}

function activityBatches(activity: OrgScanActivityPayload) {
  const batches = [...activity.activeBatches];
  if (activity.latestCompletedBatch && !batches.some((batch) => batch.id === activity.latestCompletedBatch?.id)) {
    batches.push(activity.latestCompletedBatch);
  }
  return batches;
}

function hasBatchChanged(previous: ScanActivityBatch | undefined, next: ScanActivityBatch) {
  if (!previous) return true;

  return (
    previous.status !== next.status ||
    previous.totalAssets !== next.totalAssets ||
    previous.completedAssets !== next.completedAssets ||
    previous.failedAssets !== next.failedAssets ||
    previous.pendingAssets !== next.pendingAssets ||
    previous.runningAssets !== next.runningAssets ||
    previous.percentComplete !== next.percentComplete ||
    previous.completedAt !== next.completedAt ||
    previous.startedAt !== next.startedAt
  );
}

function hasItemChanged(previous: ScanActivityItem | undefined, next: ScanActivityItem) {
  if (!previous) return true;

  return (
    previous.status !== next.status ||
    previous.error !== next.error ||
    previous.completedAt !== next.completedAt
  );
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return new NextResponse("Missing orgId", { status: 400 });
  }

  const scanAccess = await getOrgScanAccess(orgId, session.user.id);
  if (!scanAccess) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const runningJobs = new Set<Promise<void>>();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;

        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const stop = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", stop);

      let previousActivity: OrgScanActivityPayload | null = null;
      let lastHeartbeatAt = 0;
      let lastServiceUnavailableEventAt = 0;
      let serviceUnavailableUntil = 0;
      let serviceUnavailableSince: number | null = null;
      let serviceUnavailableEngine: ScanEngine | null = null;
      let serviceUnavailableShutdownAt: number | null = null;
      let lastServiceUnavailableCountdownAt = 0;
      let serviceShutdownTriggered = false;

      const emitServiceUnavailable = (now: number) => {
        if (!serviceUnavailableSince || !serviceUnavailableShutdownAt) return;
        const remainingMs = Math.max(0, serviceUnavailableShutdownAt - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        sendEvent("service_unavailable", {
          engine: serviceUnavailableEngine,
          message: `${engineLabel(serviceUnavailableEngine)} endpoint appears unavailable. Live scans will auto-stop if service does not recover.`,
          timestamp: now,
          remainingSeconds,
          shutdownAt: serviceUnavailableShutdownAt,
        });
      };

      const emitActivityChanges = (nextActivity: OrgScanActivityPayload) => {
        if (!previousActivity) {
          sendEvent("snapshot", nextActivity);
          previousActivity = nextActivity;
          return;
        }

        if (JSON.stringify(previousActivity.lock) !== JSON.stringify(nextActivity.lock)) {
          sendEvent("lock_update", {
            lock: nextActivity.lock,
            activity: nextActivity,
          });
        }

        const previousBatchMap = new Map(activityBatches(previousActivity).map((batch) => [batch.id, batch]));
        for (const batch of activityBatches(nextActivity)) {
          const previousBatch = previousBatchMap.get(batch.id);
          if (hasBatchChanged(previousBatch, batch)) {
            sendEvent("batch_update", {
              batch,
              activity: nextActivity,
            });
          }

          const previousItemMap = new Map((previousBatch?.items || []).map((item) => [item.id, item]));
          for (const item of batch.items) {
            const previousItem = previousItemMap.get(item.id);
            if (hasItemChanged(previousItem, item)) {
              sendEvent("item_update", {
                batchId: batch.id,
                item,
                activity: nextActivity,
              });
            }
          }
        }

        previousActivity = nextActivity;
      };

      try {
        while (!closed) {
          const now = Date.now();

          if (serviceUnavailableSince && serviceUnavailableShutdownAt) {
            if (now >= serviceUnavailableShutdownAt && !serviceShutdownTriggered) {
              serviceShutdownTriggered = true;
              const activityBeforeShutdown = await getOrgScanActivity(orgId, scanAccess.canScan);
              const activeBatchIds = activityBeforeShutdown.activeBatches.map((batch) => batch.id);

              for (const batchId of activeBatchIds) {
                await cancelScanBatch(orgId, batchId);
              }

              const shutdownActivity = await getOrgScanActivity(orgId, scanAccess.canScan);
              emitActivityChanges(shutdownActivity);
              sendEvent("service_shutdown", {
                engine: serviceUnavailableEngine,
                message: `${engineLabel(serviceUnavailableEngine)} endpoint was unavailable for 30 seconds. Active scans were stopped automatically.`,
                timestamp: now,
                activity: shutdownActivity,
              });
              sendEvent("stream_error", {
                message: `Live stream ended after ${engineLabel(serviceUnavailableEngine)} outage timeout. Restart once service is reachable.`,
              });
              stop();
              break;
            }

            if (now - lastServiceUnavailableCountdownAt >= SERVICE_UNAVAILABLE_COUNTDOWN_TICK_MS) {
              lastServiceUnavailableCountdownAt = now;
              emitServiceUnavailable(now);
            }
          }

          while (
            !closed &&
            runningJobs.size < MAX_OPENSSL_SCAN_CONCURRENCY + MAX_PORT_DISCOVERY_SCAN_CONCURRENCY &&
            now >= serviceUnavailableUntil
          ) {
            const claimed = await claimNextPendingScan(orgId);
            if (!claimed) break;

            const job: Promise<void> = (async () => {
              try {
                if (claimed.engine === "portDiscovery") {
                  await runPortDiscoveryItem({
                    orgId,
                    assetId: claimed.assetId,
                    scanId: claimed.scanId,
                    batchId: claimed.batchId,
                    configSnapshot: claimed.configSnapshot,
                  });
                } else {
                  await runOpenSSLScanItem({
                    orgId,
                    assetId: claimed.assetId,
                    scanId: claimed.scanId,
                    batchId: claimed.batchId,
                  });
                }

                if (serviceUnavailableSince) {
                  serviceUnavailableSince = null;
                  serviceUnavailableEngine = null;
                  serviceUnavailableShutdownAt = null;
                  serviceShutdownTriggered = false;
                  sendEvent("service_recovered", {
                    message: `${engineLabel(claimed.engine)} recovered. Live scan processing resumed.`,
                    timestamp: Date.now(),
                  });
                }
              } catch (error) {
                if (isOpenSSLRequestTimeoutError(error) || isPortDiscoveryRequestTimeoutError(error)) {
                  console.warn("SSE scan runner timeout:", (error as any)?.message || error);
                  sendEvent("scan_timeout", {
                    engine: claimed.engine,
                    message:
                      claimed.engine === "portDiscovery"
                        ? "Port discovery request timed out. Target may be slow or unreachable."
                        : "OpenSSL scan request timed out. Target may be slow or port may be unreachable.",
                    timestamp: Date.now(),
                  });
                } else if (isOpenSSLServiceUnavailableError(error) || isPortDiscoveryServiceUnavailableError(error)) {
                  console.error("SSE scan runner service unavailable:", error);
                  const now = Date.now();
                  if (!serviceUnavailableSince) {
                    serviceUnavailableSince = now;
                    serviceUnavailableEngine = claimed.engine;
                    serviceUnavailableShutdownAt = now + SERVICE_UNAVAILABLE_SHUTDOWN_MS;
                    serviceShutdownTriggered = false;
                    lastServiceUnavailableCountdownAt = 0;
                  }
                  serviceUnavailableEngine = claimed.engine;
                  serviceUnavailableUntil = Math.max(serviceUnavailableUntil, now + SERVICE_UNAVAILABLE_RETRY_COOLDOWN_MS);
                  if (now - lastServiceUnavailableEventAt >= SERVICE_UNAVAILABLE_EVENT_THROTTLE_MS) {
                    lastServiceUnavailableEventAt = now;
                    emitServiceUnavailable(now);
                  }
                } else {
                  console.error("SSE scan runner error:", error);
                }
              } finally {
                runningJobs.delete(job);
              }
            })();

            runningJobs.add(job);
          }

          const nextActivity = await getOrgScanActivity(orgId, scanAccess.canScan);
          emitActivityChanges(nextActivity);

          const heartbeatNow = Date.now();
          if (heartbeatNow - lastHeartbeatAt >= HEARTBEAT_MS) {
            sendEvent("heartbeat", { timestamp: heartbeatNow });
            lastHeartbeatAt = heartbeatNow;
          }

          const delay = nextActivity.activeBatches.length > 0 || runningJobs.size > 0
            ? ACTIVE_TICK_MS
            : IDLE_TICK_MS;

          await sleep(delay);
        }
      } catch (error) {
        console.error("Scan SSE stream error:", error);
        sendEvent("stream_error", { message: "Scan activity stream failed." });
      } finally {
        stop();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
