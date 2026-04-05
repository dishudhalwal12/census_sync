"use client";

import {
  censusSyncDb,
  type DraftRecord,
  type SyncQueueItem
} from "@/lib/offline/db";
import {
  createDedupeKey,
  type HouseholdFormValues
} from "@/lib/validators/household";
import type { AuthSession } from "@/types/session";
import type { HouseholdSubmission, SubmissionSyncStatus } from "@/types/domain";

const ACTIVE_OWNER_KEY = "active-owner-uid";

function toSubmission(
  values: HouseholdFormValues,
  session: AuthSession
): HouseholdSubmission {
  const now = new Date().toISOString();

  return {
    submissionId: values.submissionId,
    projectId: values.projectId,
    projectType: values.projectType,
    householdId: values.householdId,
    templateVersionId: values.templateVersionId,
    enumeratorId: session.uid,
    enumeratorName: session.name,
    headOfHousehold: values.headOfHousehold,
    phone: values.phone,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2,
    scope: {
      district: values.district,
      block: values.block,
      cluster: values.cluster
    },
    members: values.members,
    housing: values.housing,
    notes: values.notes,
    geo: values.geoEnabled ? values.geo : undefined,
    capturedAt: now,
    updatedAt: now,
    syncStatus: "pending_sync",
    validationStatus: "pending",
    reviewStatus: "not_required",
    flags: [],
    dedupeKey: createDedupeKey(values.householdId, values.submissionId),
    audit: {
      createdBy: session.uid,
      createdAt: now,
      lastUpdatedBy: session.uid,
      lastUpdatedAt: now
    }
  };
}

export async function setActiveOfflineOwner(ownerUid: string) {
  await censusSyncDb.deviceMeta.put({
    key: ACTIVE_OWNER_KEY,
    value: ownerUid
  });
}

export async function clearActiveOfflineOwner() {
  await censusSyncDb.deviceMeta.delete(ACTIVE_OWNER_KEY);
}

export async function saveDraft(values: HouseholdFormValues, ownerUid: string) {
  const record: DraftRecord = {
    id: values.submissionId,
    ownerUid,
    submissionId: values.submissionId,
    householdId: values.householdId,
    updatedAt: new Date().toISOString(),
    data: values
  };
  await censusSyncDb.drafts.put(record);
  return record;
}

export async function getDrafts(ownerUid: string) {
  const drafts = await censusSyncDb.drafts.where("ownerUid").equals(ownerUid).sortBy("updatedAt");
  return drafts.reverse();
}

export async function getDraft(submissionId: string, ownerUid: string) {
  const draft = await censusSyncDb.drafts.get(submissionId);
  return draft?.ownerUid === ownerUid ? draft : undefined;
}

export async function deleteDraft(submissionId: string, ownerUid: string) {
  const draft = await getDraft(submissionId, ownerUid);

  if (!draft) {
    return;
  }

  await censusSyncDb.drafts.delete(submissionId);
}

export async function queueSubmission(
  values: HouseholdFormValues,
  session: AuthSession
) {
  const payload = toSubmission(values, session);
  const queueItem: SyncQueueItem = {
    id: payload.submissionId,
    ownerUid: session.uid,
    submissionId: payload.submissionId,
    householdId: payload.householdId,
    status: "pending_sync",
    attempts: 0,
    payload
  };

  await censusSyncDb.syncQueue.put(queueItem);
  await deleteDraft(values.submissionId, session.uid);

  return queueItem;
}

export async function listQueueItems(ownerUid: string) {
  return censusSyncDb.syncQueue.where("ownerUid").equals(ownerUid).sortBy("submissionId");
}

export async function updateQueueStatus(
  submissionId: string,
  ownerUid: string,
  status: SubmissionSyncStatus,
  error?: string
) {
  const existing = await censusSyncDb.syncQueue.get(submissionId);

  if (!existing || existing.ownerUid !== ownerUid) {
    return null;
  }

  const updated: SyncQueueItem = {
    ...existing,
    status,
    error,
    attempts: existing.attempts + (status === "syncing" ? 1 : 0),
    lastAttemptAt:
      status === "syncing" || status === "failed"
        ? new Date().toISOString()
        : existing.lastAttemptAt
  };

  await censusSyncDb.syncQueue.put(updated);
  return updated;
}

export async function syncQueue(session: AuthSession) {
  const pending = await censusSyncDb.syncQueue.where("ownerUid").equals(session.uid).toArray();
  const results: Array<{ submissionId: string; status: SubmissionSyncStatus; message?: string }> = [];

  for (const item of pending) {
    await updateQueueStatus(item.submissionId, session.uid, "syncing");

    try {
      const response = await fetch("/api/submissions/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submission: item.payload
        })
      });

      const payload = (await response.json()) as {
        status?: SubmissionSyncStatus;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Sync failed. Please retry.");
      }
      const data = {
        status: payload.status ?? "synced",
        message: payload.message
      };

      await censusSyncDb.syncAttempts.add({
        ownerUid: session.uid,
        submissionId: item.submissionId,
        attemptedAt: new Date().toISOString(),
        outcome: data.status === "failed" ? "failure" : "success",
        message: data.message
      });

      if (data.status === "failed") {
        await updateQueueStatus(item.submissionId, session.uid, "failed", data.message);
      } else if (data.status === "flagged") {
        await updateQueueStatus(item.submissionId, session.uid, "flagged", data.message);
      } else {
        await censusSyncDb.syncQueue.delete(item.submissionId);
      }

      results.push({
        submissionId: item.submissionId,
        status: data.status,
        message: data.message
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sync failed. Please retry.";
      await censusSyncDb.syncAttempts.add({
        ownerUid: session.uid,
        submissionId: item.submissionId,
        attemptedAt: new Date().toISOString(),
        outcome: "failure",
        message
      });
      await updateQueueStatus(item.submissionId, session.uid, "failed", message);
      results.push({ submissionId: item.submissionId, status: "failed", message });
    }
  }

  return results;
}
