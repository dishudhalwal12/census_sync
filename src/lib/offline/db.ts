"use client";

import Dexie, { type Table } from "dexie";

import type {
  CampaignFieldPackage,
  CampaignResponse,
  ResponseGeoCheck
} from "@/types/campaign";
import type {
  HouseholdSubmission,
  MissionAssignmentPackage,
  MissionGeoCheck,
  MissionSubmission,
  SubmissionSyncStatus
} from "@/types/domain";
import type { HouseholdFormValues } from "@/lib/validators/household";

export interface DraftRecord {
  id: string;
  ownerUid: string;
  submissionId: string;
  householdId?: string;
  updatedAt: string;
  data: HouseholdFormValues;
}

export interface SyncQueueItem {
  id: string;
  ownerUid: string;
  submissionId: string;
  householdId: string;
  status: SubmissionSyncStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  payload: HouseholdSubmission;
}

export interface SyncAttemptRecord {
  id?: number;
  ownerUid: string;
  submissionId: string;
  attemptedAt: string;
  outcome: "success" | "failure";
  message?: string;
}

export interface DeviceMetaRecord {
  key: string;
  value: string;
}

export interface MissionAssignmentRecord {
  id: string;
  ownerUid: string;
  assignmentId: string;
  shareCode: string;
  updatedAt: string;
  data: MissionAssignmentPackage;
}

export interface MissionDraftRecord {
  id: string;
  ownerUid: string;
  assignmentId: string;
  updatedAt: string;
  answers: Record<string, unknown>;
  geoCheckAtStart?: MissionGeoCheck;
  progressStep?: number;
}

export interface QueuedMediaItem {
  id: string;
  ownerUid: string;
  assignmentId: string;
  submissionId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string;
  blob: Blob;
  fingerprint: string;
}

export interface MissionSyncQueueItem {
  id: string;
  ownerUid: string;
  assignmentId: string;
  submissionId: string;
  status: SubmissionSyncStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  mediaId: string;
  payload: MissionSubmission;
}

export interface CampaignPackageRecord {
  id: string;
  ownerUid: string;
  assignmentId: string;
  token: string;
  updatedAt: string;
  data: CampaignFieldPackage;
}

export interface CampaignDraftRecord {
  id: string;
  ownerUid: string;
  assignmentId: string;
  token: string;
  updatedAt: string;
  answers: Record<string, unknown>;
  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  unlockGeo?: ResponseGeoCheck;
}

export interface CampaignMediaItem {
  id: string;
  ownerUid: string;
  assignmentId: string;
  responseId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string;
  blob: Blob;
  fingerprint: string;
}

export interface CampaignSyncPayload {
  token: string;
  assignmentId: string;
  answers: Record<string, unknown>;
  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  unlockGeo: ResponseGeoCheck;
  submitGeo: ResponseGeoCheck;
}

export interface CampaignSyncQueueItem {
  id: string;
  ownerUid: string;
  assignmentId: string;
  responseId: string;
  status: SubmissionSyncStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  photoMediaId: string;
  payload: CampaignSyncPayload;
}

class CensusSyncDb extends Dexie {
  drafts!: Table<DraftRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncAttempts!: Table<SyncAttemptRecord, number>;
  deviceMeta!: Table<DeviceMetaRecord, string>;
  missionAssignments!: Table<MissionAssignmentRecord, string>;
  missionDrafts!: Table<MissionDraftRecord, string>;
  missionMedia!: Table<QueuedMediaItem, string>;
  missionSyncQueue!: Table<MissionSyncQueueItem, string>;
  campaignPackages!: Table<CampaignPackageRecord, string>;
  campaignDrafts!: Table<CampaignDraftRecord, string>;
  campaignMedia!: Table<CampaignMediaItem, string>;
  campaignSyncQueue!: Table<CampaignSyncQueueItem, string>;

  constructor() {
    super("censussync");
    this.version(1).stores({
      drafts: "id, submissionId, updatedAt",
      syncQueue: "id, submissionId, householdId, status, attempts, lastAttemptAt",
      syncAttempts: "++id, submissionId, attemptedAt",
      deviceMeta: "key"
    });
    this.version(2)
      .stores({
        drafts: "id, ownerUid, submissionId, updatedAt",
        syncQueue:
          "id, ownerUid, submissionId, householdId, status, attempts, lastAttemptAt",
        syncAttempts: "++id, ownerUid, submissionId, attemptedAt",
        deviceMeta: "key"
      })
      .upgrade(async (tx) => {
        await tx.table("drafts").clear();
        await tx.table("syncQueue").clear();
        await tx.table("syncAttempts").clear();
      });
    this.version(3).stores({
      drafts: "id, ownerUid, submissionId, updatedAt",
      syncQueue:
        "id, ownerUid, submissionId, householdId, status, attempts, lastAttemptAt",
      syncAttempts: "++id, ownerUid, submissionId, attemptedAt",
      deviceMeta: "key",
      missionAssignments: "id, ownerUid, assignmentId, shareCode, updatedAt",
      missionDrafts: "id, ownerUid, assignmentId, updatedAt",
      missionMedia: "id, ownerUid, assignmentId, submissionId, capturedAt",
      missionSyncQueue:
        "id, ownerUid, assignmentId, submissionId, status, attempts, lastAttemptAt"
    });
    this.version(4).stores({
      drafts: "id, ownerUid, submissionId, updatedAt",
      syncQueue:
        "id, ownerUid, submissionId, householdId, status, attempts, lastAttemptAt",
      syncAttempts: "++id, ownerUid, submissionId, attemptedAt",
      deviceMeta: "key",
      missionAssignments: "id, ownerUid, assignmentId, shareCode, updatedAt",
      missionDrafts: "id, ownerUid, assignmentId, updatedAt",
      missionMedia: "id, ownerUid, assignmentId, submissionId, capturedAt",
      missionSyncQueue:
        "id, ownerUid, assignmentId, submissionId, status, attempts, lastAttemptAt",
      campaignPackages: "id, ownerUid, assignmentId, updatedAt",
      campaignDrafts: "id, ownerUid, assignmentId, updatedAt",
      campaignMedia: "id, ownerUid, assignmentId, responseId, capturedAt",
      campaignSyncQueue:
        "id, ownerUid, assignmentId, responseId, status, attempts, lastAttemptAt"
    });
  }
}

export const censusSyncDb = new CensusSyncDb();
