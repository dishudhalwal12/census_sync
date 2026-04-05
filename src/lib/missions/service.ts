"use client";

import {
  censusSyncDb,
  type MissionAssignmentRecord,
  type MissionDraftRecord,
  type MissionSyncQueueItem,
  type QueuedMediaItem
} from "@/lib/offline/db";
import {
  createMissionDedupeKey,
  createMissionSubmissionId,
  fingerprintBlob,
  getMissionRequiredCounts,
  sanitizeStorageName
} from "@/lib/missions/utils";
import type {
  MissionAssignmentPackage,
  MissionGeoCheck,
  MissionSubmission,
  SubmissionSyncStatus
} from "@/types/domain";
import type { AuthSession } from "@/types/session";

export async function cacheMissionPackage(
  pkg: MissionAssignmentPackage,
  ownerUid: string
) {
  const record: MissionAssignmentRecord = {
    id: pkg.assignment.id,
    ownerUid,
    assignmentId: pkg.assignment.id,
    shareCode: pkg.assignment.shareCode ?? "",
    updatedAt: new Date().toISOString(),
    data: pkg
  };

  await censusSyncDb.missionAssignments.put(record);
  return record;
}

export async function listCachedMissionPackages(ownerUid: string) {
  const rows = await censusSyncDb.missionAssignments
    .where("ownerUid")
    .equals(ownerUid)
    .sortBy("updatedAt");

  return rows.reverse();
}

export async function getCachedMissionPackageByAssignmentId(
  assignmentId: string,
  ownerUid: string
) {
  const row = await censusSyncDb.missionAssignments.get(assignmentId);
  return row?.ownerUid === ownerUid ? row : undefined;
}

export async function getCachedMissionPackageByShareCode(
  shareCode: string,
  ownerUid: string
) {
  const rows = await censusSyncDb.missionAssignments
    .where("ownerUid")
    .equals(ownerUid)
    .toArray();

  return rows.find((row) => row.shareCode === shareCode);
}

export async function saveMissionDraft(
  params: {
    assignmentId: string;
    answers: Record<string, unknown>;
    geoCheckAtStart?: MissionGeoCheck;
    progressStep?: number;
  },
  ownerUid: string
) {
  const record: MissionDraftRecord = {
    id: params.assignmentId,
    ownerUid,
    assignmentId: params.assignmentId,
    updatedAt: new Date().toISOString(),
    answers: params.answers,
    geoCheckAtStart: params.geoCheckAtStart,
    progressStep: params.progressStep
  };

  await censusSyncDb.missionDrafts.put(record);
  return record;
}

export async function getMissionDraft(assignmentId: string, ownerUid: string) {
  const draft = await censusSyncDb.missionDrafts.get(assignmentId);
  return draft?.ownerUid === ownerUid ? draft : undefined;
}

export async function deleteMissionDraft(assignmentId: string, ownerUid: string) {
  const draft = await getMissionDraft(assignmentId, ownerUid);
  if (!draft) {
    return;
  }

  await censusSyncDb.missionDrafts.delete(assignmentId);
}

export async function updateCachedMissionStatus(
  assignmentId: string,
  ownerUid: string,
  status: NonNullable<MissionAssignmentPackage["assignment"]["activationStatus"]>,
  completedCounts?: { requiredResponses: number; completedResponses: number }
) {
  const existing = await getCachedMissionPackageByAssignmentId(assignmentId, ownerUid);
  if (!existing) {
    return null;
  }

  const updated: MissionAssignmentRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    data: {
      ...existing.data,
      assignment: {
        ...existing.data.assignment,
        activationStatus: status,
        startedAt:
          status === "in_progress"
            ? existing.data.assignment.startedAt ?? new Date().toISOString()
            : existing.data.assignment.startedAt,
        completedAt:
          status === "completed" ? new Date().toISOString() : existing.data.assignment.completedAt,
        progress: completedCounts
      }
    }
  };

  await censusSyncDb.missionAssignments.put(updated);
  return updated;
}

export async function compressImageForMission(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / imageBitmap.width);

  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      file.type === "image/png" ? "image/png" : "image/jpeg",
      0.82
    );
  });
}

export async function queueMissionSubmission(
  params: {
    assignmentPackage: MissionAssignmentPackage;
    answers: Record<string, unknown>;
    geoCheckAtStart: MissionGeoCheck;
    geoCheckAtSubmit: MissionGeoCheck;
    evidenceBlob: Blob;
    evidenceFileName: string;
  },
  session: AuthSession
) {
  const submissionId = createMissionSubmissionId();
  const now = new Date().toISOString();
  const fingerprint = await fingerprintBlob(params.evidenceBlob);
  const progress = getMissionRequiredCounts(params.assignmentPackage.template, params.answers);

  const payload: MissionSubmission = {
    submissionId,
    assignmentId: params.assignmentPackage.assignment.id,
    projectId: params.assignmentPackage.project.id,
    projectType: params.assignmentPackage.project.type,
    templateVersionId: params.assignmentPackage.template.id,
    enumeratorId: session.uid,
    enumeratorName: session.name,
    answers: params.answers,
    geoCheckAtStart: params.geoCheckAtStart,
    geoCheckAtSubmit: params.geoCheckAtSubmit,
    evidence: {
      fileName: sanitizeStorageName(params.evidenceFileName),
      mimeType: params.evidenceBlob.type || "image/jpeg",
      byteSize: params.evidenceBlob.size,
      capturedAt: now,
      latitude: params.geoCheckAtSubmit.latitude,
      longitude: params.geoCheckAtSubmit.longitude,
      accuracy: params.geoCheckAtSubmit.accuracy,
      fingerprint
    },
    scope: params.assignmentPackage.assignment.scope,
    syncStatus: "pending_sync",
    validationStatus: "pending",
    status: "completed",
    anomalyFlags: [],
    dedupeKey: createMissionDedupeKey(params.assignmentPackage.assignment.id, session.uid),
    capturedAt: now,
    updatedAt: now,
    audit: {
      createdBy: session.uid,
      createdAt: now,
      lastUpdatedBy: session.uid,
      lastUpdatedAt: now
    }
  };

  const mediaId = `${submissionId}-evidence`;
  const mediaRecord: QueuedMediaItem = {
    id: mediaId,
    ownerUid: session.uid,
    assignmentId: params.assignmentPackage.assignment.id,
    submissionId,
    fileName: payload.evidence.fileName,
    mimeType: payload.evidence.mimeType,
    byteSize: payload.evidence.byteSize,
    capturedAt: now,
    blob: params.evidenceBlob,
    fingerprint
  };
  const queueRecord: MissionSyncQueueItem = {
    id: submissionId,
    ownerUid: session.uid,
    assignmentId: params.assignmentPackage.assignment.id,
    submissionId,
    status: "pending_sync",
    attempts: 0,
    mediaId,
    payload
  };

  await censusSyncDb.missionMedia.put(mediaRecord);
  await censusSyncDb.missionSyncQueue.put(queueRecord);
  await deleteMissionDraft(params.assignmentPackage.assignment.id, session.uid);
  await updateCachedMissionStatus(params.assignmentPackage.assignment.id, session.uid, "completed", {
    requiredResponses: progress.required,
    completedResponses: progress.completed
  });

  return queueRecord;
}

export async function listMissionQueueItems(ownerUid: string) {
  return censusSyncDb.missionSyncQueue
    .where("ownerUid")
    .equals(ownerUid)
    .sortBy("submissionId");
}

async function updateMissionQueueStatus(
  submissionId: string,
  ownerUid: string,
  status: SubmissionSyncStatus,
  error?: string
) {
  const existing = await censusSyncDb.missionSyncQueue.get(submissionId);
  if (!existing || existing.ownerUid !== ownerUid) {
    return null;
  }

  const updated: MissionSyncQueueItem = {
    ...existing,
    status,
    error,
    attempts: existing.attempts + (status === "syncing" ? 1 : 0),
    lastAttemptAt:
      status === "syncing" || status === "failed"
        ? new Date().toISOString()
        : existing.lastAttemptAt
  };

  await censusSyncDb.missionSyncQueue.put(updated);
  return updated;
}

export async function syncMissionQueue(session: AuthSession) {
  const pending = await censusSyncDb.missionSyncQueue
    .where("ownerUid")
    .equals(session.uid)
    .toArray();
  const results: Array<{ submissionId: string; status: SubmissionSyncStatus; message?: string }> =
    [];

  for (const item of pending) {
    await updateMissionQueueStatus(item.submissionId, session.uid, "syncing");

    try {
      const media = await censusSyncDb.missionMedia.get(item.mediaId);
      if (!media) {
        throw new Error("Proof photo is missing from the offline queue.");
      }

      const formData = new FormData();
      formData.append("submission", JSON.stringify(item.payload));
      formData.append(
        "proofFile",
        media.blob,
        sanitizeStorageName(media.fileName)
      );

      const response = await fetch("/api/missions/submissions", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as {
        status?: SubmissionSyncStatus;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Mission sync failed.");
      }

      const data = {
        status: payload.status ?? "synced",
        message: payload.message
      };

      if (data.status === "failed") {
        await updateMissionQueueStatus(item.submissionId, session.uid, "failed", data.message);
      } else if (data.status === "flagged") {
        await updateMissionQueueStatus(item.submissionId, session.uid, "flagged", data.message);
      } else {
        await censusSyncDb.missionSyncQueue.delete(item.submissionId);
        await censusSyncDb.missionMedia.delete(item.mediaId);
      }

      results.push({
        submissionId: item.submissionId,
        status: data.status,
        message: data.message
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mission sync failed.";
      await updateMissionQueueStatus(item.submissionId, session.uid, "failed", message);
      results.push({
        submissionId: item.submissionId,
        status: "failed",
        message
      });
    }
  }

  return results;
}
