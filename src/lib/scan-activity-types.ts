export type ScanBatchType = "single" | "group" | "full";
export type ScanBatchStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ScanItemStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type ScanHistoryCategory = "passed" | "timeout" | "dnsExpired" | "failed";

export interface ScanInitiator {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ScanActivityItem {
  id: string;
  assetId: string;
  assetValue: string;
  status: ScanItemStatus;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface ScanActivityBatch {
  id: string;
  organizationId: string;
  type: ScanBatchType;
  status: ScanBatchStatus;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  pendingAssets: number;
  runningAssets: number;
  percentComplete: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  initiatedBy: ScanInitiator | null;
  items: ScanActivityItem[];
}

export interface ScanLockState {
  active: boolean;
  batchId: string | null;
  type: ScanBatchType | null;
  status: ScanBatchStatus | null;
  message: string | null;
  initiatedAt: string | null;
  initiatedBy: ScanInitiator | null;
  percentComplete: number;
}

export interface ScanHistoryEntry {
  batchId: string;
  type: ScanBatchType;
  status: ScanBatchStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalAssets: number;
  passedAssets: number;
  timeoutAssets: number;
  failedAssets: number;
  dnsExpiredAssets: number;
  durationSeconds: number | null;
  items: Array<{
    scanId: string;
    assetId: string;
    assetValue: string;
    category: ScanHistoryCategory;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  failures: Array<{
    scanId: string;
    assetId: string;
    assetValue: string;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface ScanFailureEntry {
  scanId: string;
  batchId: string;
  batchType: ScanBatchType;
  batchStatus: ScanBatchStatus;
  assetId: string;
  assetValue: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface OrgScanActivityPayload {
  orgId: string;
  canScan: boolean;
  activeBatches: ScanActivityBatch[];
  latestCompletedBatch: ScanActivityBatch | null;
  latestBatch: ScanActivityBatch | null;
  recentHistoryBatches: ScanActivityBatch[];
  recentHistory: ScanHistoryEntry[];
  allFailures: ScanFailureEntry[];
  lock: ScanLockState;
}
