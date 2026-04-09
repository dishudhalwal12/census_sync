export type WorkspaceRole = "employee" | "admin";
export type UserRole = WorkspaceRole | "enumerator" | "supervisor";
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
  | "under_review"
  | "revisit_requested"
  | "approved"
  | "rejected"
  | "escalated";
export type ExportFormat = "csv" | "pdf";
export type RiskLevel = "low" | "medium" | "high";
export type DuplicateConfidence = "low" | "medium" | "high";
export type ReviewCaseStatus =
  | "open"
  | "under_review"
  | "revisit_requested"
  | "approved"
  | "rejected"
  | "escalated";
export type RevisitReason =
  | "retake_geo"
  | "retake_photo"
  | "address_mismatch"
  | "member_count_mismatch"
  | "duplicate_check"
  | "missing_fields";
export type VisitOutcome =
  | "survey_completed"
  | "house_locked"
  | "respondent_unavailable"
  | "invalid_address"
  | "duplicate_household"
  | "revisit_needed"
  | "refused";
export type AppLanguage = "en" | "hi";
export type ConsentMode =
  | "verbal"
  | "written"
  | "signature"
  | "photo_acknowledged";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged";
export type ReportPackType =
  | "district_summary"
  | "enumerator_productivity"
  | "anomaly_report"
  | "pending_review"
  | "revisit_backlog"
  | "coverage_completion";
export type SyncConflictStatus = "pending_merge" | "resolved";
export type PredictionConfidence = "stable" | "watch" | "critical";
export type TemplateRuleOperator =
  | "equals"
  | "not_equals"
  | "includes"
  | "greater_than"
  | "less_than"
  | "is_true"
  | "is_false";

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
  orgId?: string;
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

export interface UserPrivateSettings {
  id: string;
  uid: string;
  geminiApiKey?: string;
  geminiModel?: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  orgId?: string;
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
  orgId?: string;
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

export interface TemplateFieldRule {
  fieldKey: string;
  operator: TemplateRuleOperator;
  value?: string | number | boolean;
}

export interface TemplateFieldTranslation {
  label?: string;
  helperText?: string;
  placeholder?: string;
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
  translations?: Partial<Record<AppLanguage, TemplateFieldTranslation>>;
  visibilityRules?: TemplateFieldRule[];
  requiredRules?: TemplateFieldRule[];
  computedFieldConfig?: {
    sourceFieldKeys: string[];
    operation: "sum" | "count_selected" | "copy";
    label?: string;
  };
}

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  fields: TemplateField[];
  translations?: Partial<
    Record<
      AppLanguage,
      {
        title?: string;
        description?: string;
      }
    >
  >;
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
  orgId?: string;
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
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskSignals?: string[];
  reviewCaseId?: string;
  visitOutcome?: VisitOutcome;
  language?: AppLanguage;
  consent?: SubmissionConsent;
  sourceDeviceId?: string;
  revisionGroupId?: string;
  revisionNumber?: number;
  startedAt?: string;
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
  orgId?: string;
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
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskSignals?: string[];
  reviewCaseId?: string;
  visitOutcome?: VisitOutcome;
  language?: AppLanguage;
  consent?: SubmissionConsent;
  sourceDeviceId?: string;
  revisionGroupId?: string;
  revisionNumber?: number;
  startedAt?: string;
  revisitOfSubmissionId?: string;
  audit: {
    createdBy: string;
    createdAt: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
  };
}

export interface SubmissionConsent {
  mode: ConsentMode;
  capturedAt: string;
  collectorName: string;
  acknowledged: boolean;
  signatureLabel?: string;
}

export interface DuplicateCandidate {
  submissionId: string;
  matchedSubmissionId: string;
  confidence: DuplicateConfidence;
  reasons: string[];
}

export interface ReviewCaseComment {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | "system";
  message: string;
  createdAt: string;
}

export interface ReviewCaseEvent {
  id: string;
  type:
    | "created"
    | "status_changed"
    | "revisit_requested"
    | "comment_added"
    | "resolved";
  actorId: string;
  actorName: string;
  actorRole: UserRole | "system";
  createdAt: string;
  detail: string;
}

export interface RevisitTask {
  id: string;
  submissionId: string;
  reviewCaseId: string;
  enumeratorId: string;
  reasons: RevisitReason[];
  status: "open" | "completed";
  requestedAt: string;
  requestedBy: string;
  requestedByName: string;
  notes?: string;
}

export interface ReviewCase {
  id: string;
  orgId?: string;
  submissionId: string;
  projectId: string;
  scope: Scope;
  enumeratorId: string;
  householdId?: string;
  missionAssignmentId?: string;
  status: ReviewCaseStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  riskSignals: string[];
  duplicateCandidates: DuplicateCandidate[];
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  currentSubmissionId: string;
  latestActionAt: string;
  createdAt: string;
  updatedAt: string;
  comments: ReviewCaseComment[];
  timeline: ReviewCaseEvent[];
  revisitTask?: RevisitTask;
}

export interface AuditLogEvent {
  id: string;
  orgId?: string;
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
  orgId?: string;
  projectId?: string;
  projectType?: ProjectType;
  requesterId: string;
  requesterName: string;
  scope: Scope[];
  format: ExportFormat;
  packType?: ReportPackType;
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
  layer?: "approved" | "flagged" | "revisit" | "geo_anomaly";
  riskLevel?: RiskLevel;
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
  layer?: "approved" | "flagged" | "revisit" | "geo_anomaly";
  riskLevel?: RiskLevel;
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

export interface AlertEvent {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  audience: "employee" | "enumerator" | "supervisor" | "admin" | "all";
  projectId?: string;
  scope?: Scope;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  acknowledgedAt?: string;
}

export interface CoverageTarget {
  id: string;
  projectId: string;
  scope: Scope;
  expectedHouseholds: number;
  expectedPopulation?: number;
  deadline?: string;
}

export interface CoverageGap {
  id: string;
  projectId: string;
  scope: Scope;
  targetCount: number;
  approvedCount: number;
  flaggedCount: number;
  revisitBacklog: number;
  completionRate: number;
  riskLevel: RiskLevel;
}

export interface EnumeratorScorecard {
  enumeratorId: string;
  enumeratorName: string;
  submissionsCompleted: number;
  approvedCount: number;
  flaggedCount: number;
  revisitCount: number;
  unresolvedBacklog: number;
  geoComplianceRate: number;
  proofComplianceRate: number;
  approvalRate: number;
  averageSyncDelayMinutes: number;
  averageCompletionMinutes: number;
}

export interface SyncConflict {
  id: string;
  projectId: string;
  submissionIds: string[];
  householdId?: string;
  status: SyncConflictStatus;
  createdAt: string;
  resolvedAt?: string;
  summary: string;
}

export interface SubmissionRevision {
  id: string;
  revisionGroupId: string;
  submissionId: string;
  revisionNumber: number;
  projectId: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  summary: string;
}

export interface RoutePlanStop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  order: number;
  reason: "coverage_gap" | "revisit_task" | "mission" | "recent_submission";
}

export interface RoutePlan {
  id: string;
  enumeratorId: string;
  projectId: string;
  createdAt: string;
  totalDistanceMeters: number;
  stops: RoutePlanStop[];
}

export interface PredictionSnapshot {
  id: string;
  projectId: string;
  scope: Scope;
  requiredEnumerators: number;
  projectedFinishDate?: string;
  confidence: PredictionConfidence;
  createdAt: string;
}
