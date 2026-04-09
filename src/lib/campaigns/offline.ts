"use client";

import {
  censusSyncDb,
  type CampaignDraftRecord,
  type CampaignMediaItem,
  type CampaignPackageRecord,
  type CampaignSyncQueueItem
} from "@/lib/offline/db";
import { fingerprintBlob } from "@/lib/missions/utils";
import type { AuthSession } from "@/types/session";
import type {
  CampaignFieldPackage,
  ResponseGeoCheck
} from "@/types/campaign";

function createResponseId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `campaign-response-${Date.now()}`;
}

export async function cacheCampaignPackage(
  pkg: CampaignFieldPackage,
  ownerUid: string,
  token: string
) {
  const record: CampaignPackageRecord = {
    id: pkg.assignment.id,
    ownerUid,
    assignmentId: pkg.assignment.id,
    token,
    updatedAt: new Date().toISOString(),
    data: pkg
  };

  await censusSyncDb.campaignPackages.put(record);
  return record;
}

export async function listCachedCampaignPackages(ownerUid: string) {
  const rows = await censusSyncDb.campaignPackages.where("ownerUid").equals(ownerUid).sortBy("updatedAt");
  return rows.reverse();
}

export async function getCachedCampaignPackageByAssignmentId(
  assignmentId: string,
  ownerUid: string
) {
  const record = await censusSyncDb.campaignPackages.get(assignmentId);
  return record?.ownerUid === ownerUid ? record : undefined;
}

export async function saveCampaignDraft(
  params: {
    assignmentId: string;
    token: string;
    answers: Record<string, unknown>;
    respondentName?: string;
    respondentEmail?: string;
    respondentPhone?: string;
    unlockGeo?: ResponseGeoCheck;
  },
  ownerUid: string
) {
  const record: CampaignDraftRecord = {
    id: params.assignmentId,
    ownerUid,
    assignmentId: params.assignmentId,
    token: params.token,
    updatedAt: new Date().toISOString(),
    answers: params.answers,
    respondentName: params.respondentName,
    respondentEmail: params.respondentEmail,
    respondentPhone: params.respondentPhone,
    unlockGeo: params.unlockGeo
  };

  await censusSyncDb.campaignDrafts.put(record);
  return record;
}

export async function getCampaignDraft(assignmentId: string, ownerUid: string) {
  const record = await censusSyncDb.campaignDrafts.get(assignmentId);
  return record?.ownerUid === ownerUid ? record : undefined;
}

export async function deleteCampaignDraft(assignmentId: string, ownerUid: string) {
  const record = await getCampaignDraft(assignmentId, ownerUid);
  if (!record) {
    return;
  }

  await censusSyncDb.campaignDrafts.delete(assignmentId);
}

export async function compressImageForCampaign(file: File) {
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

export async function queueCampaignResponse(
  params: {
    fieldPackage: CampaignFieldPackage;
    token: string;
    answers: Record<string, unknown>;
    respondentName?: string;
    respondentEmail?: string;
    respondentPhone?: string;
    unlockGeo: ResponseGeoCheck;
    submitGeo: ResponseGeoCheck;
    photoBlob: Blob;
    photoFileName: string;
  },
  session: AuthSession
) {
  const responseId = createResponseId();
  const now = new Date().toISOString();
  const fingerprint = await fingerprintBlob(params.photoBlob);
  const mediaId = `${responseId}-photo`;
  const mediaRecord: CampaignMediaItem = {
    id: mediaId,
    ownerUid: session.uid,
    assignmentId: params.fieldPackage.assignment.id,
    responseId,
    fileName: params.photoFileName || "respondent-photo.jpg",
    mimeType: params.photoBlob.type || "image/jpeg",
    byteSize: params.photoBlob.size,
    capturedAt: now,
    blob: params.photoBlob,
    fingerprint
  };

  const queueItem: CampaignSyncQueueItem = {
    id: responseId,
    ownerUid: session.uid,
    assignmentId: params.fieldPackage.assignment.id,
    responseId,
    status: "pending_sync",
    attempts: 0,
    photoMediaId: mediaId,
    payload: {
      token: params.token,
      assignmentId: params.fieldPackage.assignment.id,
      answers: params.answers,
      respondentName: params.respondentName,
      respondentEmail: params.respondentEmail,
      respondentPhone: params.respondentPhone,
      unlockGeo: params.unlockGeo,
      submitGeo: params.submitGeo
    }
  };

  await censusSyncDb.campaignMedia.put(mediaRecord);
  await censusSyncDb.campaignSyncQueue.put(queueItem);
  await deleteCampaignDraft(params.fieldPackage.assignment.id, session.uid);

  return queueItem;
}

export async function listCampaignQueue(ownerUid: string) {
  return censusSyncDb.campaignSyncQueue.where("ownerUid").equals(ownerUid).sortBy("responseId");
}

async function updateQueueItem(
  responseId: string,
  ownerUid: string,
  updates: Partial<CampaignSyncQueueItem>
) {
  const item = await censusSyncDb.campaignSyncQueue.get(responseId);
  if (!item || item.ownerUid !== ownerUid) {
    return;
  }

  await censusSyncDb.campaignSyncQueue.put({
    ...item,
    ...updates
  });
}

export async function syncCampaignQueue(session: AuthSession) {
  const queue = await listCampaignQueue(session.uid);
  const results: Array<{ responseId: string; status: string; message?: string }> = [];

  for (const item of queue) {
    await updateQueueItem(item.responseId, session.uid, {
      status: "syncing",
      attempts: item.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
      error: undefined
    });

    const media = await censusSyncDb.campaignMedia.get(item.photoMediaId);
    if (!media) {
      await updateQueueItem(item.responseId, session.uid, {
        status: "failed",
        error: "Photo evidence is missing."
      });
      results.push({
        responseId: item.responseId,
        status: "failed",
        message: "Photo evidence is missing."
      });
      continue;
    }

    try {
      const formData = new FormData();
      formData.append("response", JSON.stringify(item.payload));
      formData.append(
        "photoFile",
        new File([media.blob], media.fileName, {
          type: media.mimeType
        })
      );

      const response = await fetch("/api/employee/responses", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to sync the campaign response.");
      }

      await censusSyncDb.campaignSyncQueue.delete(item.responseId);
      await censusSyncDb.campaignMedia.delete(media.id);
      results.push({ responseId: item.responseId, status: "synced" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync the campaign response.";
      await updateQueueItem(item.responseId, session.uid, {
        status: "failed",
        error: message
      });
      results.push({
        responseId: item.responseId,
        status: "failed",
        message
      });
    }
  }

  return results;
}
