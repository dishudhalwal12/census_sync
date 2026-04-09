import type {
  CoordinatePoint,
  Scope,
  SubmissionSyncStatus,
  SubmissionValidationStatus
} from "@/types/domain";

export type CampaignCollectionMode = "employee_only" | "public_only" | "hybrid";
export type CampaignStatus = "draft" | "published" | "paused" | "archived";
export type CampaignVersionStatus = "draft" | "published" | "archived";
export type CampaignLinkType = "employee" | "public";
export type CampaignLinkStatus = "active" | "revoked";
export type CampaignAssignmentStatus = "active" | "paused" | "completed";
export type CampaignChannel = "employee" | "public";
export type CampaignQuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "date"
  | "rating";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignQuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface CampaignQuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

export interface CampaignQuestion {
  id: string;
  key: string;
  prompt: string;
  description?: string;
  type: CampaignQuestionType;
  required: boolean;
  options?: CampaignQuestionOption[];
  validation?: CampaignQuestionValidation;
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
}

export interface CampaignSection {
  id: string;
  title: string;
  description?: string;
  questions: CampaignQuestion[];
}

export interface Campaign {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  purpose: string;
  description?: string;
  targetAudience: string;
  status: CampaignStatus;
  collectionMode: CampaignCollectionMode;
  geofenceCenter?: CoordinatePoint;
  geofenceRadiusMeters?: number;
  locationScope?: Scope;
  activeVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignVersion {
  id: string;
  orgId: string;
  campaignId: string;
  versionLabel: string;
  status: CampaignVersionStatus;
  sections: CampaignSection[];
  source: "manual" | "ai";
  aiContext?: {
    prompt: string;
    summary?: string;
  };
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
}

export interface CampaignLink {
  id: string;
  orgId: string;
  campaignId: string;
  campaignVersionId: string;
  assignmentId?: string;
  type: CampaignLinkType;
  tokenHash: string;
  tokenPreview: string;
  status: CampaignLinkStatus;
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
}

export interface CampaignAssignment {
  id: string;
  orgId: string;
  campaignId: string;
  campaignVersionId: string;
  employeeId: string;
  employeeName: string;
  label: string;
  scope?: Scope;
  geofenceCenter?: CoordinatePoint;
  geofenceRadiusMeters?: number;
  targetResponses?: number;
  status: CampaignAssignmentStatus;
  employeeLinkId?: string;
  activeFrom: string;
  activeTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseGeoCheck extends CoordinatePoint {
  capturedAt: string;
  accuracy?: number;
  distanceMeters?: number;
  withinRange?: boolean;
}

export interface ResponsePhotoEvidence {
  fileName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  storagePath?: string;
  downloadUrl?: string;
  fingerprint?: string;
}

export interface ResponseVerification {
  unlockedAt?: ResponseGeoCheck;
  submittedAt?: ResponseGeoCheck;
  respondentPhoto?: ResponsePhotoEvidence;
}

export interface CampaignSubmissionContext {
  submitGeo?: ResponseGeoCheck;
  userAgent?: string;
  locale?: string;
  timezone?: string;
}

export interface CampaignResponse {
  id: string;
  orgId: string;
  campaignId: string;
  campaignVersionId: string;
  linkId: string;
  assignmentId?: string;
  channel: CampaignChannel;
  employeeId?: string;
  employeeName?: string;
  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  answers: Record<string, unknown>;
  verification?: ResponseVerification;
  submissionContext?: CampaignSubmissionContext;
  syncStatus: SubmissionSyncStatus;
  validationStatus: SubmissionValidationStatus;
  validationMessage?: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignFieldPackage {
  campaign: Campaign;
  version: CampaignVersion;
  assignment: CampaignAssignment;
  link: CampaignLink;
}

export interface PublicCampaignPackage {
  campaign: Campaign;
  version: CampaignVersion;
  link: CampaignLink;
}

export interface CampaignAnalyticsSummary {
  totalResponses: number;
  employeeResponses: number;
  publicResponses: number;
  completionRate: number;
  activeCampaigns: number;
  verifiedResponses: number;
}

export interface CampaignAnalyticsPoint {
  label: string;
  responses: number;
}

export interface CampaignQuestionBreakdown {
  questionId: string;
  questionPrompt: string;
  type: CampaignQuestionType;
  totalAnswered: number;
  values: Array<{ label: string; value: number }>;
  textResponses?: Array<{
    responseId: string;
    respondentLabel: string;
    answer: string;
    submittedAt: string;
  }>;
}

export interface CampaignGeoPoint {
  responseId: string;
  campaignName: string;
  channel: CampaignChannel;
  participantLabel: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  submittedAt: string;
}

export interface CampaignRecentResponse {
  responseId: string;
  campaignName: string;
  channel: CampaignChannel;
  respondentLabel: string;
  respondentEmail?: string;
  respondentPhone?: string;
  locationAnswer?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  submittedAt: string;
}

export interface CampaignAnalyticsPayload {
  summary: CampaignAnalyticsSummary;
  responsesOverTime: CampaignAnalyticsPoint[];
  channelSplit: Array<{ label: string; value: number }>;
  completionFunnel: Array<{ label: string; value: number }>;
  employeeActivity: Array<{ label: string; value: number }>;
  questionBreakdowns: CampaignQuestionBreakdown[];
  geoPoints: CampaignGeoPoint[];
  recentResponses: CampaignRecentResponse[];
}
