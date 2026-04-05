export type UserRole = "enumerator" | "supervisor" | "admin";
export type UserStatus = "active" | "disabled" | "invited";
export type ProjectType =
  | "census"
  | "community_survey"
  | "campus_outreach"
  | "social_audit";
export type ProjectStatus = "draft" | "active" | "paused" | "archived";
export type AssignmentActivationStatus =
  | "sent"
  | "opened"
  | "in_progress"
  | "completed";
export type MissionVerificationMode = "hard_lock";
export type SubmissionSyncStatus =
  | "draft"
  | "pending_sync"
  | "syncing"
  | "synced"
  | "failed"
  | "flagged";
export type SubmissionValidationStatus =
  | "pending"
  | "approved"
  | "flagged"
  | "rejected";
export type SubmissionReviewStatus =
  | "not_required"
  | "pending_review"
  | "resolved"
  | "escalated";
export type ExportFormat = "csv" | "pdf";

export interface Scope {
  district: string;
  block: string;
  cluster?: string;
}

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  projectId?: string;
  assignmentLabel?: string;
  scopes: Scope[];
  assignedTemplateVersion: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  objective?: string;
  type: ProjectType;
  status: ProjectStatus;
  activeTemplateVersionId?: string;
  targetSubmissions?: number;
  siteCenter?: CoordinatePoint;
  serviceRadiusMeters?: number;
  capacityLimit?: number;
  verificationMode?: MissionVerificationMode;
  missionSummary?: {
    sent: number;
    opened: number;
    inProgress: number;
    completed: number;
  };
  scope: Scope[];
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  projectType: ProjectType;
  templateVersionId?: string;
  enumeratorId?: string;
  supervisorId?: string;
  scope: Scope;
  label: string;
  activeScopeOwner?: string;
  targetCount?: number;
  activeFrom: string;
  activeTo?: string;
  status: "active" | "paused" | "completed";
  shareCode?: string;
  assigneeUid?: string;
  activationStatus?: AssignmentActivationStatus;
  openedAt?: string;
  startedAt?: string;
  completedAt?: string;
  progress?: {
    requiredResponses: number;
    completedResponses: number;
  };
}

export interface TemplateFieldOption {
  label: string;
  value: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "date" | "checkbox";
  kind?:
    | "text"
    | "textarea"
    | "number"
    | "single_select"
    | "multi_select"
    | "boolean"
    | "date"
    | "instruction";
  required?: boolean;
  options?: TemplateFieldOption[];
  helperText?: string;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  fields: TemplateField[];
}

export interface TemplateVersion {
  id: string;
  projectId: string;
  projectType: ProjectType;
  name: string;
  version: string;
  status: "active" | "draft" | "archived";
  sections: TemplateSection[];
  releaseNotes: string;
  publishedAt?: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say";
  occupation?: string;
  educationLevel?: string;
  disabilityStatus?: string;
}

export interface HousingDetails {
  dwellingType: string;
  ownershipStatus: string;
  rooms: number;
  drinkingWaterSource: string;
  sanitationType: string;
  electricityAvailable: boolean;
  internetAvailable: boolean;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
}

export interface MissionGeoCheck extends GeoPoint {
  distanceMeters: number;
  withinRange: boolean;
}

export interface MissionEvidence {
  fileName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  downloadUrl?: string;
  storagePath?: string;
  fingerprint?: string;
}

export interface MissionSubmission {
  submissionId: string;
  assignmentId: string;
  projectId: string;
  projectType: ProjectType;
  templateVersionId: string;
  enumeratorId: string;
  enumeratorName: string;
  answers: Record<string, unknown>;
  geoCheckAtStart: MissionGeoCheck;
  geoCheckAtSubmit: MissionGeoCheck;
  evidence: MissionEvidence;
  scope: Scope;
  syncStatus: SubmissionSyncStatus;
  validationStatus: SubmissionValidationStatus;
  validationMessage?: string;
  status: AssignmentActivationStatus;
  anomalyFlags: string[];
  dedupeKey: string;
  capturedAt: string;
  updatedAt: string;
  audit: {
    createdBy: string;
    createdAt: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
  };
}

export interface MissionAssignmentPackage {
  assignment: Assignment;
  project: Project;
  template: TemplateVersion;
  assignee?: Pick<UserProfile, "uid" | "name" | "email">;
  shareUrl: string;
}

export interface HouseholdSubmission {
  submissionId: string;
  projectId: string;
  projectType: ProjectType;
  householdId: string;
  templateVersionId: string;
  enumeratorId: string;
  enumeratorName: string;
  headOfHousehold: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  scope: Scope;
  members: HouseholdMember[];
  housing: HousingDetails;
  notes?: string;
  geo?: GeoPoint;
  capturedAt: string;
  updatedAt: string;
  syncStatus: SubmissionSyncStatus;
  validationStatus: SubmissionValidationStatus;
  validationMessage?: string;
  reviewStatus: SubmissionReviewStatus;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  flags: string[];
  dedupeKey: string;
  audit: {
    createdBy: string;
    createdAt: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
  };
}

export interface AuditLogEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | "system";
  action: string;
  targetType: string;
  targetId: string;
  scope?: Scope;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export interface ExportRequest {
  id: string;
  projectId?: string;
  projectType?: ProjectType;
  requesterId: string;
  requesterName: string;
  scope: Scope[];
  format: ExportFormat;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  downloadUrl?: string;
  filters: {
    status?: SubmissionSyncStatus | SubmissionValidationStatus;
    enumeratorId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  trend: string;
  tone?: "lavender" | "peach" | "yellow" | "mint";
}

export interface ChartDatum {
  name: string;
  value: number;
}

export interface CoveragePoint {
  id: string;
  householdId: string;
  enumeratorName: string;
  status: SubmissionValidationStatus;
  latitude: number;
  longitude: number;
  submittedAt: string;
  scope: Scope;
}

export interface MissionCoveragePoint {
  id: string;
  assignmentId: string;
  projectId: string;
  projectName: string;
  enumeratorName: string;
  status: SubmissionValidationStatus;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  proofCaptured: boolean;
  submittedAt: string;
  scope: Scope;
}

export interface MissionOperationsSnapshot {
  sent: number;
  opened: number;
  inProgress: number;
  completed: number;
  proofCompliant: number;
  failedGeoChecks: number;
  overdue: number;
  capacityLimit: number;
}
