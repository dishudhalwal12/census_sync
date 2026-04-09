import {
  calculateDistanceMeters,
  createMissionDedupeKey
} from "@/lib/missions/utils";
import { formatNumber } from "@/lib/utils";
import type {
  AlertEvent,
  Assignment,
  CoverageGap,
  CoverageTarget,
  DuplicateCandidate,
  EnumeratorScorecard,
  HouseholdSubmission,
  MissionAssignmentPackage,
  MissionSubmission,
  PredictionSnapshot,
  ReviewCase,
  ReviewCaseStatus,
  RevisitReason,
  RiskLevel,
  RoutePlan,
  RoutePlanStop,
  Scope,
  SubmissionReviewStatus,
  SubmissionValidationStatus
} from "@/types/domain";

interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  riskSignals: string[];
  duplicateCandidates: DuplicateCandidate[];
}

function normalizeText(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scopeKey(scope: Scope) {
  return `${scope.district}::${scope.block}::${scope.cluster ?? "all"}`;
}

function addSignal(signals: string[], score: { value: number }, signal: string, weight: number) {
  if (!signals.includes(signal)) {
    signals.push(signal);
    score.value += weight;
  }
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 65) {
    return "high";
  }

  if (score >= 30) {
    return "medium";
  }

  return "low";
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) {
    return undefined;
  }

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return undefined;
  }

  return Math.max(0, Math.round((endMs - startMs) / 60_000));
}

export function evaluateHouseholdRisk(
  submission: HouseholdSubmission,
  existing: HouseholdSubmission[]
): RiskAssessment {
  const score = { value: 0 };
  const signals: string[] = [];
  const duplicates: DuplicateCandidate[] = [];
  const address = normalizeText(
    `${submission.addressLine1} ${submission.addressLine2 ?? ""}`
  );

  existing.forEach((candidate) => {
    if (candidate.submissionId === submission.submissionId) {
      return;
    }

    const reasons: string[] = [];
    let duplicateScore = 0;

    if (candidate.projectId === submission.projectId && candidate.householdId === submission.householdId) {
      reasons.push("same_household_id");
      duplicateScore += 60;
      addSignal(signals, score, "duplicate_household_id", 45);
    }

    if (
      submission.phone &&
      candidate.phone &&
      submission.phone === candidate.phone &&
      candidate.projectId === submission.projectId
    ) {
      reasons.push("same_phone_number");
      duplicateScore += 24;
      addSignal(signals, score, "same_phone_reused", 18);
    }

    const candidateAddress = normalizeText(
      `${candidate.addressLine1} ${candidate.addressLine2 ?? ""}`
    );
    if (
      address &&
      candidateAddress &&
      address === candidateAddress &&
      normalizeText(candidate.headOfHousehold) === normalizeText(submission.headOfHousehold)
    ) {
      reasons.push("same_address_and_head");
      duplicateScore += 34;
      addSignal(signals, score, "fuzzy_address_match", 24);
    }

    if (submission.geo && candidate.geo) {
      const distance = calculateDistanceMeters(submission.geo, candidate.geo);
      if (distance <= 15) {
        reasons.push("same_geo_cluster");
        duplicateScore += 12;
        addSignal(signals, score, "same_geo_reused", 10);
      }
    }

    if (duplicateScore > 0) {
      duplicates.push({
        submissionId: submission.submissionId,
        matchedSubmissionId: candidate.submissionId,
        confidence: duplicateScore >= 60 ? "high" : duplicateScore >= 30 ? "medium" : "low",
        reasons
      });
    }
  });

  if (submission.members.length >= 8) {
    addSignal(signals, score, "abnormal_member_count", 8);
  }

  const completionMinutes = minutesBetween(submission.startedAt, submission.capturedAt);
  if (completionMinutes !== undefined && completionMinutes <= 2) {
    addSignal(signals, score, "suspicious_completion_speed", 12);
  }

  if (submission.sourceDeviceId) {
    const sameDeviceRecentCount = existing.filter(
      (candidate) =>
        candidate.sourceDeviceId === submission.sourceDeviceId &&
        candidate.enumeratorId === submission.enumeratorId
    ).length;
    if (sameDeviceRecentCount >= 5) {
      addSignal(signals, score, "repeated_device_activity", 8);
    }
  }

  const rapidRecentSubmissions = existing.filter((candidate) => {
    if (candidate.enumeratorId !== submission.enumeratorId) {
      return false;
    }

    const delta = minutesBetween(candidate.capturedAt, submission.capturedAt);
    return delta !== undefined && delta <= 15;
  });
  if (rapidRecentSubmissions.length >= 3) {
    addSignal(signals, score, "rapid_submission_burst", 10);
  }

  if (submission.visitOutcome && submission.visitOutcome !== "survey_completed") {
    addSignal(signals, score, "visit_requires_follow_up", 10);
  }

  return {
    riskScore: score.value,
    riskLevel: riskLevelFromScore(score.value),
    riskSignals: signals,
    duplicateCandidates: duplicates.sort((left, right) =>
      right.confidence.localeCompare(left.confidence)
    )
  };
}

export function evaluateMissionRisk(
  submission: MissionSubmission,
  existing: MissionSubmission[]
): RiskAssessment {
  const score = { value: 0 };
  const signals: string[] = [];
  const duplicates: DuplicateCandidate[] = [];

  existing.forEach((candidate) => {
    if (candidate.submissionId === submission.submissionId) {
      return;
    }

    const reasons: string[] = [];
    let duplicateScore = 0;

    if (
      candidate.evidence.fingerprint &&
      submission.evidence.fingerprint &&
      candidate.evidence.fingerprint === submission.evidence.fingerprint
    ) {
      reasons.push("same_proof_fingerprint");
      duplicateScore += 60;
      addSignal(signals, score, "repeated_proof_fingerprint", 45);
    }

    if (
      candidate.dedupeKey === createMissionDedupeKey(submission.assignmentId, submission.enumeratorId)
    ) {
      reasons.push("same_assignment_repeat");
      duplicateScore += 24;
      addSignal(signals, score, "repeat_assignment_submission", 20);
    }

    if (duplicateScore > 0) {
      duplicates.push({
        submissionId: submission.submissionId,
        matchedSubmissionId: candidate.submissionId,
        confidence: duplicateScore >= 60 ? "high" : "medium",
        reasons
      });
    }
  });

  if (!submission.geoCheckAtStart.withinRange || !submission.geoCheckAtSubmit.withinRange) {
    addSignal(signals, score, "geofence_failure", 50);
  }

  if (submission.geoCheckAtSubmit.distanceMeters > 200) {
    addSignal(signals, score, "high_submit_distance", 14);
  }

  const completionMinutes = minutesBetween(submission.startedAt, submission.capturedAt);
  if (completionMinutes !== undefined && completionMinutes <= 2) {
    addSignal(signals, score, "suspicious_completion_speed", 12);
  }

  if (submission.sourceDeviceId) {
    const sameDeviceRecentCount = existing.filter(
      (candidate) =>
        candidate.sourceDeviceId === submission.sourceDeviceId &&
        candidate.enumeratorId === submission.enumeratorId
    ).length;
    if (sameDeviceRecentCount >= 3) {
      addSignal(signals, score, "repeated_device_activity", 8);
    }
  }

  return {
    riskScore: score.value,
    riskLevel: riskLevelFromScore(score.value),
    riskSignals: signals,
    duplicateCandidates: duplicates
  };
}

export function deriveSubmissionStatuses(params: {
  visitOutcome?: string;
  riskLevel: RiskLevel;
  hasDuplicates: boolean;
}): {
  validationStatus: SubmissionValidationStatus;
  reviewStatus: SubmissionReviewStatus;
  syncStatus: "synced" | "flagged";
  validationMessage: string;
} {
  if (params.visitOutcome && params.visitOutcome !== "survey_completed") {
    return {
      validationStatus: "flagged",
      reviewStatus: "revisit_requested",
      syncStatus: "flagged",
      validationMessage: "Visit outcome requires supervisor follow-up."
    };
  }

  if (params.hasDuplicates || params.riskLevel === "high") {
    return {
      validationStatus: "flagged",
      reviewStatus: "pending_review",
      syncStatus: "flagged",
      validationMessage: "Submission needs supervisor review because of trust-risk signals."
    };
  }

  if (params.riskLevel === "medium") {
    return {
      validationStatus: "flagged",
      reviewStatus: "pending_review",
      syncStatus: "flagged",
      validationMessage: "Submission synced with medium-risk signals and is waiting for review."
    };
  }

  return {
    validationStatus: "approved",
    reviewStatus: "not_required",
    syncStatus: "synced",
    validationMessage: "Submission synced successfully."
  };
}

export function buildReviewCase(params: {
  submissionId: string;
  currentSubmissionId: string;
  projectId: string;
  scope: Scope;
  enumeratorId: string;
  householdId?: string;
  missionAssignmentId?: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskSignals: string[];
  duplicateCandidates: DuplicateCandidate[];
  actorId: string;
  actorName: string;
  actorRole: "enumerator" | "supervisor" | "admin" | "system";
  revisitReasons?: RevisitReason[];
  notes?: string;
}): ReviewCase {
  const now = new Date().toISOString();
  const status: ReviewCaseStatus = params.revisitReasons?.length
    ? "revisit_requested"
    : "open";
  const reviewCaseId = `review-${params.submissionId}`;

  return {
    id: reviewCaseId,
    submissionId: params.submissionId,
    currentSubmissionId: params.currentSubmissionId,
    projectId: params.projectId,
    scope: params.scope,
    enumeratorId: params.enumeratorId,
    householdId: params.householdId,
    missionAssignmentId: params.missionAssignmentId,
    status,
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    riskSignals: params.riskSignals,
    duplicateCandidates: params.duplicateCandidates,
    latestActionAt: now,
    createdAt: now,
    updatedAt: now,
    comments: params.notes
      ? [
          {
            id: `${reviewCaseId}-comment-1`,
            actorId: params.actorId,
            actorName: params.actorName,
            actorRole: params.actorRole,
            message: params.notes,
            createdAt: now
          }
        ]
      : [],
    timeline: [
      {
        id: `${reviewCaseId}-event-1`,
        type: "created",
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        createdAt: now,
        detail: params.notes ?? "Review case created from trust-risk intake."
      }
    ],
    revisitTask: params.revisitReasons?.length
      ? {
          id: `${reviewCaseId}-revisit`,
          submissionId: params.submissionId,
          reviewCaseId,
          enumeratorId: params.enumeratorId,
          reasons: params.revisitReasons,
          status: "open",
          requestedAt: now,
          requestedBy: params.actorId,
          requestedByName: params.actorName,
          notes: params.notes
        }
      : undefined
  };
}

export function buildCoverageTargets(assignments: Assignment[]): CoverageTarget[] {
  return assignments.map((assignment) => ({
    id: `target-${assignment.id}`,
    projectId: assignment.projectId,
    scope: assignment.scope,
    expectedHouseholds: assignment.targetCount ?? 0
  }));
}

export function buildCoverageGaps(
  submissions: HouseholdSubmission[],
  reviewCases: ReviewCase[],
  targets: CoverageTarget[]
): CoverageGap[] {
  return targets.map((target) => {
    const scoped = submissions.filter(
      (submission) =>
        submission.projectId === target.projectId &&
        scopeKey(submission.scope) === scopeKey(target.scope)
    );
    const approvedCount = scoped.filter((submission) => submission.validationStatus === "approved").length;
    const flaggedCount = scoped.filter((submission) => submission.validationStatus === "flagged").length;
    const revisitBacklog = reviewCases.filter(
      (reviewCase) =>
        reviewCase.projectId === target.projectId &&
        scopeKey(reviewCase.scope) === scopeKey(target.scope) &&
        reviewCase.status === "revisit_requested"
    ).length;
    const targetCount = target.expectedHouseholds;
    const completionRate =
      targetCount > 0 ? Math.round((approvedCount / targetCount) * 100) : 100;
    const riskLevel: RiskLevel =
      completionRate < 70 || (scoped.length > 0 && revisitBacklog / scoped.length > 0.15)
        ? "high"
        : completionRate < 90 || flaggedCount > 0
          ? "medium"
          : "low";

    return {
      id: `gap-${target.id}`,
      projectId: target.projectId,
      scope: target.scope,
      targetCount,
      approvedCount,
      flaggedCount,
      revisitBacklog,
      completionRate,
      riskLevel
    };
  });
}

export function buildEnumeratorScorecards(
  submissions: HouseholdSubmission[],
  missionSubmissions: MissionSubmission[],
  reviewCases: ReviewCase[]
): EnumeratorScorecard[] {
  const ids = Array.from(
    new Set([
      ...submissions.map((submission) => submission.enumeratorId),
      ...missionSubmissions.map((submission) => submission.enumeratorId)
    ])
  );

  return ids.map((enumeratorId) => {
    const householdRows = submissions.filter((submission) => submission.enumeratorId === enumeratorId);
    const missionRows = missionSubmissions.filter((submission) => submission.enumeratorId === enumeratorId);
    const name = householdRows[0]?.enumeratorName ?? missionRows[0]?.enumeratorName ?? "Enumerator";
    const approvedCount =
      householdRows.filter((submission) => submission.validationStatus === "approved").length +
      missionRows.filter((submission) => submission.validationStatus === "approved").length;
    const flaggedCount =
      householdRows.filter((submission) => submission.validationStatus === "flagged").length +
      missionRows.filter((submission) => submission.validationStatus === "flagged").length;
    const revisitCount = reviewCases.filter(
      (reviewCase) =>
        reviewCase.enumeratorId === enumeratorId &&
        reviewCase.status === "revisit_requested"
    ).length;
    const unresolvedBacklog = reviewCases.filter(
      (reviewCase) =>
        reviewCase.enumeratorId === enumeratorId &&
        !["approved", "rejected"].includes(reviewCase.status)
    ).length;
    const completed = householdRows.length + missionRows.length;
    const withGeo = householdRows.filter((submission) => submission.geo).length + missionRows.length;
    const proofCompliant = missionRows.filter((submission) => submission.evidence.storagePath).length;
    const averageSyncDelayMinutes = average(
      [...householdRows, ...missionRows].map((submission) =>
        minutesBetween(submission.capturedAt, submission.updatedAt) ?? 0
      )
    );
    const averageCompletionMinutes = average(
      [...householdRows, ...missionRows].map((submission) =>
        minutesBetween(submission.startedAt, submission.capturedAt) ?? 0
      )
    );

    return {
      enumeratorId,
      enumeratorName: name,
      submissionsCompleted: completed,
      approvedCount,
      flaggedCount,
      revisitCount,
      unresolvedBacklog,
      geoComplianceRate: completed ? Math.round((withGeo / completed) * 100) : 0,
      proofComplianceRate: missionRows.length
        ? Math.round((proofCompliant / missionRows.length) * 100)
        : 100,
      approvalRate: completed ? Math.round((approvedCount / completed) * 100) : 0,
      averageSyncDelayMinutes,
      averageCompletionMinutes
    };
  });
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function buildPredictionSnapshots(
  targets: CoverageTarget[],
  gaps: CoverageGap[],
  scorecards: EnumeratorScorecard[]
): PredictionSnapshot[] {
  const totalDailyProductivity = Math.max(
    1,
    scorecards.reduce((sum, scorecard) => sum + Math.max(1, scorecard.submissionsCompleted), 0)
  );

  return targets.map((target) => {
    const gap = gaps.find((candidate) => candidate.projectId === target.projectId && scopeKey(candidate.scope) === scopeKey(target.scope));
    const remaining = Math.max(0, (gap?.targetCount ?? target.expectedHouseholds) - (gap?.approvedCount ?? 0));
    const requiredEnumerators = remaining > 0 ? Math.ceil(remaining / totalDailyProductivity) : 0;
    const projectedFinishDate =
      remaining > 0 ? new Date(Date.now() + Math.ceil(remaining / totalDailyProductivity) * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString();
    const confidence =
      remaining > Math.max(10, totalDailyProductivity) ? "critical" : remaining > 0 ? "watch" : "stable";

    return {
      id: `prediction-${target.id}`,
      projectId: target.projectId,
      scope: target.scope,
      requiredEnumerators,
      projectedFinishDate,
      confidence,
      createdAt: new Date().toISOString()
    };
  });
}

export function buildRoutePlans(
  missionPackages: MissionAssignmentPackage[],
  reviewCases: ReviewCase[],
  submissions: HouseholdSubmission[]
): RoutePlan[] {
  const enumeratorIds = Array.from(
    new Set([
      ...missionPackages.map((pkg) => pkg.assignment.assigneeUid).filter(Boolean),
      ...reviewCases.map((reviewCase) => reviewCase.enumeratorId)
    ])
  ) as string[];

  return enumeratorIds.map((enumeratorId) => {
    const candidateStops: RoutePlanStop[] = [];

    missionPackages
      .filter((pkg) => pkg.assignment.assigneeUid === enumeratorId && pkg.project.siteCenter)
      .forEach((pkg) => {
        candidateStops.push({
          id: `route-stop-mission-${pkg.assignment.id}`,
          label: pkg.assignment.label,
          latitude: pkg.project.siteCenter!.latitude,
          longitude: pkg.project.siteCenter!.longitude,
          order: 0,
          reason: "mission"
        });
      });

    reviewCases
      .filter((reviewCase) => reviewCase.enumeratorId === enumeratorId && reviewCase.revisitTask?.status === "open")
      .forEach((reviewCase) => {
        const submission = submissions.find((entry) => entry.submissionId === reviewCase.currentSubmissionId && entry.geo);
        if (submission?.geo) {
          candidateStops.push({
            id: `route-stop-review-${reviewCase.id}`,
            label: `${submission.householdId} revisit`,
            latitude: submission.geo.latitude,
            longitude: submission.geo.longitude,
            order: 0,
            reason: "revisit_task"
          });
        }
      });

    const orderedStops = nearestNeighborOrder(candidateStops);
    const totalDistanceMeters = orderedStops.reduce((sum, stop, index) => {
      const next = orderedStops[index + 1];
      if (!next) {
        return sum;
      }

      return sum + calculateDistanceMeters(stop, next);
    }, 0);

    return {
      id: `route-${enumeratorId}`,
      enumeratorId,
      projectId: missionPackages.find((pkg) => pkg.assignment.assigneeUid === enumeratorId)?.project.id ?? submissions.find((submission) => submission.enumeratorId === enumeratorId)?.projectId ?? "project-unassigned",
      createdAt: new Date().toISOString(),
      totalDistanceMeters: Math.round(totalDistanceMeters),
      stops: orderedStops
    };
  });
}

function nearestNeighborOrder(stops: RoutePlanStop[]) {
  if (stops.length <= 1) {
    return stops.map((stop, index) => ({ ...stop, order: index + 1 }));
  }

  const remaining = [...stops];
  const ordered: RoutePlanStop[] = [];
  let current = remaining.shift()!;
  ordered.push({ ...current, order: 1 });

  while (remaining.length) {
    let nextIndex = 0;
    let nextDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const distance = calculateDistanceMeters(current, candidate);
      if (distance < nextDistance) {
        nextDistance = distance;
        nextIndex = index;
      }
    });

    current = remaining.splice(nextIndex, 1)[0]!;
    ordered.push({ ...current, order: ordered.length + 1 });
  }

  return ordered;
}

export function buildAlerts(params: {
  reviewCases: ReviewCase[];
  gaps: CoverageGap[];
  scorecards: EnumeratorScorecard[];
  missionSubmissions: MissionSubmission[];
}): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const now = new Date().toISOString();

  params.reviewCases
    .filter((reviewCase) => reviewCase.riskLevel === "high")
    .forEach((reviewCase) => {
      alerts.push({
        id: `alert-review-${reviewCase.id}`,
        title: "High-risk review case",
        description: `Review case ${reviewCase.id} contains ${reviewCase.riskSignals.length} risk signals and needs attention.`,
        severity: "critical",
        status: "open",
        audience: "supervisor",
        projectId: reviewCase.projectId,
        scope: reviewCase.scope,
        relatedEntityType: "review_case",
        relatedEntityId: reviewCase.id,
        createdAt: now
      });
    });

  params.gaps
    .filter((gap) => gap.riskLevel !== "low")
    .forEach((gap) => {
      alerts.push({
        id: `alert-gap-${gap.id}`,
        title: "Coverage gap at risk",
        description: `${gap.scope.block} is at ${gap.completionRate}% completion with ${gap.revisitBacklog} revisit task(s).`,
        severity: gap.riskLevel === "high" ? "critical" : "warning",
        status: "open",
        audience: "supervisor",
        projectId: gap.projectId,
        scope: gap.scope,
        relatedEntityType: "coverage_gap",
        relatedEntityId: gap.id,
        createdAt: now
      });
    });

  params.scorecards
    .filter((scorecard) => scorecard.approvalRate < 70 || scorecard.unresolvedBacklog >= 2)
    .forEach((scorecard) => {
      alerts.push({
        id: `alert-scorecard-${scorecard.enumeratorId}`,
        title: "Enumerator performance watch",
        description: `${scorecard.enumeratorName} is at ${scorecard.approvalRate}% approval with ${scorecard.unresolvedBacklog} unresolved case(s).`,
        severity: scorecard.approvalRate < 50 ? "critical" : "warning",
        status: "open",
        audience: "admin",
        relatedEntityType: "enumerator_scorecard",
        relatedEntityId: scorecard.enumeratorId,
        createdAt: now
      });
    });

  const proofCompliance = params.missionSubmissions.length
    ? Math.round(
        (params.missionSubmissions.filter((submission) => submission.evidence.storagePath).length /
          params.missionSubmissions.length) *
          100
      )
    : 100;
  if (proofCompliance < 90) {
    alerts.push({
      id: "alert-proof-compliance",
      title: "Proof compliance dropped",
      description: `Mission proof compliance is ${proofCompliance}%. Review field photo capture quality.`,
      severity: proofCompliance < 70 ? "critical" : "warning",
      status: "open",
      audience: "admin",
      relatedEntityType: "mission_snapshot",
      relatedEntityId: "proof_compliance",
      createdAt: now
    });
  }

  return alerts;
}

export function summarizeReviewStatus(status: ReviewCaseStatus): SubmissionReviewStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "under_review":
      return "under_review";
    case "revisit_requested":
      return "revisit_requested";
    case "escalated":
      return "escalated";
    default:
      return "pending_review";
  }
}

export function getRiskTone(level: RiskLevel) {
  return level === "high" ? "text-rose-700" : level === "medium" ? "text-amber-700" : "text-emerald-700";
}

export function buildCoverageSummaryText(gap: CoverageGap) {
  return `${gap.scope.block}: ${gap.completionRate}% of ${formatNumber(gap.targetCount)} target with ${gap.revisitBacklog} revisit task(s)`;
}
