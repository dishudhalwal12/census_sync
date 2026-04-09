import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { env } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { readReviewCollection } from "@/lib/review-store/server";
import {
  buildAlerts,
  buildCoverageGaps,
  buildCoverageTargets,
  buildEnumeratorScorecards,
  buildPredictionSnapshots,
  buildRoutePlans
} from "@/lib/trust/engine";
import { formatNumber } from "@/lib/utils";
import type { AuthSession } from "@/types/session";
import type {
  Assignment,
  AlertEvent,
  AuditLogEvent,
  CoveragePoint,
  CoverageGap,
  CoverageTarget,
  DashboardKpi,
  EnumeratorScorecard,
  ExportRequest,
  HouseholdSubmission,
  MissionAssignmentPackage,
  MissionCoveragePoint,
  MissionOperationsSnapshot,
  MissionSubmission,
  PredictionSnapshot,
  Project,
  ReviewCase,
  RoutePlan,
  Scope,
  TemplateVersion,
  UserProfile
} from "@/types/domain";

function serializeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)])
    );
  }

  return value;
}

function scopeMatches(scopes: Scope[], candidate?: Scope) {
  if (!candidate || !scopes.length) {
    return false;
  }

  return scopes.some((scope) => {
    const districtMatches =
      scope.district === "All Districts" || scope.district === candidate.district;
    const blockMatches =
      scope.block === "All Blocks" || scope.block === candidate.block;
    const clusterMatches =
      !scope.cluster || scope.cluster === candidate.cluster;

    return districtMatches && blockMatches && clusterMatches;
  });
}

function sortByDateDescending<T>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftValue =
      (left as { updatedAt?: string; createdAt?: string; timestamp?: string }).updatedAt ??
      (left as { updatedAt?: string; createdAt?: string; timestamp?: string }).createdAt ??
      (left as { updatedAt?: string; createdAt?: string; timestamp?: string }).timestamp ??
      "";
    const rightValue =
      (right as { updatedAt?: string; createdAt?: string; timestamp?: string }).updatedAt ??
      (right as { updatedAt?: string; createdAt?: string; timestamp?: string }).createdAt ??
      (right as { updatedAt?: string; createdAt?: string; timestamp?: string }).timestamp ??
      "";
    return rightValue.localeCompare(leftValue);
  });
}

async function readCollection<T>(name: string) {
  const db = getAdminDb();

  if (!db) {
    return readReviewCollection<T>(name as Parameters<typeof readReviewCollection>[0]);
  }

  const snapshot = await db.collection(name).get();

  return snapshot.docs.map((doc) =>
    serializeFirestoreValue({
      id: doc.id,
      ...doc.data()
    }) as T
  );
}

function missionAssignmentMatches(assignment: Assignment) {
  return Boolean(assignment.shareCode || assignment.templateVersionId);
}

function isMissionOpened(status?: Assignment["activationStatus"]) {
  return status === "opened" || status === "in_progress" || status === "completed";
}

function computeMissionSnapshot(
  assignments: Assignment[],
  submissions: MissionSubmission[],
  projects: Project[]
): MissionOperationsSnapshot {
  const missionAssignments = assignments.filter(missionAssignmentMatches);
  const uniqueProjectIds = new Set(missionAssignments.map((assignment) => assignment.projectId));
  const capacityLimit = Array.from(uniqueProjectIds).reduce((sum, projectId) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    return sum + (project?.capacityLimit ?? project?.targetSubmissions ?? 0);
  }, 0);
  const proofCompliant = submissions.filter((submission) => submission.evidence.storagePath).length;
  const failedGeoChecks = submissions.filter((submission) =>
    submission.anomalyFlags.some((flag) => flag.includes("geo"))
  ).length;
  const overdue = missionAssignments.filter((assignment) => {
    if (!assignment.activeTo || assignment.activationStatus === "completed") {
      return false;
    }

    return assignment.activeTo < new Date().toISOString();
  }).length;

  return {
    sent: missionAssignments.length,
    opened: missionAssignments.filter((assignment) =>
      isMissionOpened(assignment.activationStatus)
    ).length,
    inProgress: missionAssignments.filter(
      (assignment) => assignment.activationStatus === "in_progress"
    ).length,
    completed: missionAssignments.filter(
      (assignment) => assignment.activationStatus === "completed"
    ).length,
    proofCompliant,
    failedGeoChecks,
    overdue,
    capacityLimit
  };
}

function computeMissionKpis(snapshot: MissionOperationsSnapshot): DashboardKpi[] {
  return [
    {
      id: "missions-sent",
      label: "Assignments sent",
      value: formatNumber(snapshot.sent),
      trend: `${formatNumber(snapshot.opened)} opened by assigned field staff`,
      tone: "lavender"
    },
    {
      id: "missions-progress",
      label: "Completed missions",
      value: formatNumber(snapshot.completed),
      trend: `${formatNumber(snapshot.inProgress)} mission(s) still in progress`,
      tone: "peach"
    },
    {
      id: "missions-proof",
      label: "Proof compliant",
      value: formatNumber(snapshot.proofCompliant),
      trend: snapshot.failedGeoChecks
        ? `${formatNumber(snapshot.failedGeoChecks)} geo anomaly flag(s) detected`
        : "No geo anomaly flags detected",
      tone: "mint"
    }
  ];
}

function computeEnumeratorKpis(
  assignments: Assignment[],
  submissions: HouseholdSubmission[]
): DashboardKpi[] {
  const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
  const targetCount = activeAssignments.reduce(
    (sum, assignment) => sum + (assignment.targetCount ?? 0),
    0
  );
  const flaggedCount = submissions.filter(
    (submission) => submission.validationStatus === "flagged"
  ).length;

  return [
    {
      id: "target",
      label: "Assignment target",
      value: formatNumber(targetCount),
      trend: `${activeAssignments.length} active field assignment(s)`,
      tone: "lavender"
    },
    {
      id: "submitted",
      label: "Submitted records",
      value: formatNumber(submissions.length),
      trend: "Live count from your synced field records",
      tone: "peach"
    },
    {
      id: "review",
      label: "Needs review",
      value: formatNumber(flaggedCount),
      trend: flaggedCount ? "Supervisor review still pending" : "No flagged records right now",
      tone: "yellow"
    }
  ];
}

function computeSupervisorKpis(submissions: HouseholdSubmission[]): DashboardKpi[] {
  const flagged = submissions.filter(
    (submission) =>
      submission.reviewStatus === "pending_review" ||
      submission.reviewStatus === "under_review" ||
      submission.reviewStatus === "revisit_requested" ||
      submission.reviewStatus === "escalated"
  ).length;
  const enumerators = new Set(submissions.map((submission) => submission.enumeratorId)).size;
  const geoTagged = submissions.filter((submission) => submission.geo).length;

  return [
    {
      id: "records",
      label: "Records in scope",
      value: formatNumber(submissions.length),
      trend: "Live records across your current project scope",
      tone: "peach"
    },
    {
      id: "flagged",
      label: "Pending review",
      value: formatNumber(flagged),
      trend: flagged ? "Flagged records need supervisor action" : "Validation queue is clear",
      tone: "yellow"
    },
    {
      id: "enumerators",
      label: "Active enumerators",
      value: formatNumber(enumerators),
      trend: `${formatNumber(geoTagged)} geo-tagged record(s) captured`,
      tone: "lavender"
    }
  ];
}

function computeAdminKpis(
  users: UserProfile[],
  projects: Project[],
  submissions: HouseholdSubmission[],
  exports: ExportRequest[]
): DashboardKpi[] {
  const activeUsers = users.filter((user) => user.status === "active").length;
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const flagged = submissions.filter(
    (submission) =>
      submission.reviewStatus === "pending_review" ||
      submission.reviewStatus === "under_review" ||
      submission.reviewStatus === "revisit_requested" ||
      submission.reviewStatus === "escalated"
  ).length;

  return [
    {
      id: "users",
      label: "Active field users",
      value: formatNumber(activeUsers),
      trend: "Provisioned through Firebase Auth and Firestore",
      tone: "lavender"
    },
    {
      id: "projects",
      label: "Active projects",
      value: formatNumber(activeProjects),
      trend: "Reusable survey campaigns and census drives",
      tone: "peach"
    },
    {
      id: "flagged",
      label: "Flagged records",
      value: formatNumber(flagged),
      trend: `${formatNumber(exports.length)} export job(s) generated`,
      tone: "yellow"
    }
  ];
}

export async function getProjects(session?: AuthSession) {
  const [projects, assignments] = await Promise.all([
    readCollection<Project>("projects"),
    session?.role === "employee" ? readCollection<Assignment>("assignments") : Promise.resolve([])
  ]);

  if (!session || session.role === "admin") {
    return sortByDateDescending(projects);
  }

  const assignedProjectIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.enumeratorId === session.uid || assignment.assigneeUid === session.uid
      )
      .map((assignment) => assignment.projectId)
  );

  return sortByDateDescending(
    projects.filter((project) => {
      if (session.role === "employee" && assignedProjectIds.has(project.id)) {
        return true;
      }

      const projectMatches = !session.projectId || project.id === session.projectId;
      return projectMatches && scopeMatches(session.scopes, project.scope[0]);
    })
  );
}

export async function getTemplateVersions(session?: AuthSession) {
  const [templates, assignments] = await Promise.all([
    readCollection<TemplateVersion>("template_versions"),
    session?.role === "employee" ? readCollection<Assignment>("assignments") : Promise.resolve([])
  ]);
  const assignedProjectIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.enumeratorId === session?.uid || assignment.assigneeUid === session?.uid
      )
      .map((assignment) => assignment.projectId)
  );
  const filtered =
    !session || session.role === "admin"
      ? templates
      : templates.filter((template) =>
          !session.projectId
            ? true
            : template.projectId === session.projectId ||
              assignedProjectIds.has(template.projectId)
        );

  return sortByDateDescending(filtered);
}

export async function getCurrentTemplate(session?: AuthSession) {
  const [templates, projects] = await Promise.all([
    getTemplateVersions(session),
    getProjects(session)
  ]);

  const project = projects.find((candidate) => candidate.status === "active") ?? projects[0];
  if (!project) {
    return null;
  }

  return (
    templates.find(
      (template) =>
        template.projectId === project.id &&
        template.id === project.activeTemplateVersionId
    ) ??
    templates.find(
      (template) => template.projectId === project.id && template.status === "active"
    ) ??
    null
  );
}

export async function getAssignments(session?: AuthSession) {
  const assignments = await readCollection<Assignment>("assignments");

  if (!session || session.role === "admin") {
    return sortByDateDescending(assignments);
  }

  const filtered = assignments.filter((assignment) => {
    if (session.role === "employee") {
      return (
        assignment.enumeratorId === session.uid || assignment.assigneeUid === session.uid
      );
    }

    const projectMatches =
      !session.projectId || assignment.projectId === session.projectId;

    return (
      projectMatches &&
      (assignment.supervisorId === session.uid || scopeMatches(session.scopes, assignment.scope))
    );
  });

  return sortByDateDescending(filtered);
}

export async function getSubmissions(session?: AuthSession) {
  const submissions = await readCollection<HouseholdSubmission>("submissions");

  if (!session || session.role === "admin") {
    return sortByDateDescending(submissions);
  }

  const filtered = submissions.filter((submission) => {
    const projectMatches =
      !session.projectId || submission.projectId === session.projectId;

    if (!projectMatches) {
      return false;
    }

    if (session.role === "employee") {
      return submission.enumeratorId === session.uid;
    }

    return scopeMatches(session.scopes, submission.scope);
  });

  return sortByDateDescending(filtered);
}

export async function getUsers(session?: AuthSession) {
  const users = await readCollection<UserProfile>("users");

  if (!session || session.role === "admin") {
    return sortByDateDescending(users);
  }

  if (session.role === "employee") {
    return users.filter((user) => user.uid === session.uid);
  }

  return sortByDateDescending(users.filter((user) => scopeMatches(session.scopes, user.scopes[0])));
}

export async function getAuditLogs(session?: AuthSession) {
  const auditLogs = await readCollection<AuditLogEvent>("audit_logs");

  if (!session || session.role === "admin") {
    return sortByDateDescending(auditLogs);
  }

  return sortByDateDescending(
    auditLogs.filter((event) => scopeMatches(session.scopes, event.scope))
  );
}

export async function getExportRequests(session?: AuthSession) {
  const exports = await readCollection<ExportRequest>("exports");

  if (!session || session.role === "admin") {
    return sortByDateDescending(exports);
  }

  return sortByDateDescending(
    exports.filter((item) => {
      if (session.role === "employee") {
        return item.requesterId === session.uid;
      }

      const projectMatches = !session.projectId || item.projectId === session.projectId;
      return projectMatches && item.scope.some((scope) => scopeMatches(session.scopes, scope));
    })
  );
}

export async function getReviewCases(session?: AuthSession) {
  const reviewCases = await readCollection<ReviewCase>("review_cases");

  if (!session || session.role === "admin") {
    return sortByDateDescending(reviewCases);
  }

  if (session.role === "employee") {
    return sortByDateDescending(
      reviewCases.filter((reviewCase) => reviewCase.enumeratorId === session.uid)
    );
  }

  return sortByDateDescending(
    reviewCases.filter((reviewCase) => {
      const projectMatches = !session.projectId || session.projectId === reviewCase.projectId;
      return projectMatches && scopeMatches(session.scopes, reviewCase.scope);
    })
  );
}

export async function getAlerts(session?: AuthSession) {
  const storedAlerts = await readCollection<AlertEvent>("alerts");
  const [submissions, missionSubmissions, reviewCases, assignments] = await Promise.all([
    getSubmissions(session),
    getMissionSubmissions(session),
    getReviewCases(session),
    getAssignments(session)
  ]);
  const gaps = buildCoverageGaps(
    submissions,
    reviewCases,
    buildCoverageTargets(assignments)
  );
  const scorecards = buildEnumeratorScorecards(submissions, missionSubmissions, reviewCases);
  const computedAlerts = buildAlerts({
    reviewCases,
    gaps,
    scorecards,
    missionSubmissions
  });
  const merged = new Map<string, AlertEvent>();
  [...storedAlerts, ...computedAlerts].forEach((alert) => {
    if (!session || session.role === "admin") {
      merged.set(alert.id, alert);
      return;
    }

    if (session.role === "employee") {
      if (alert.audience === "employee" || alert.audience === "all") {
        merged.set(alert.id, alert);
      }
      return;
    }

    if (
      alert.audience === "admin" ||
      alert.audience === "all" ||
      (alert.scope && scopeMatches(session.scopes, alert.scope))
    ) {
      merged.set(alert.id, alert);
    }
  });

  return sortByDateDescending(Array.from(merged.values()));
}

export async function getCoverageTargets(session?: AuthSession) {
  const assignments = await getAssignments(session);
  return buildCoverageTargets(assignments);
}

export async function getCoverageGaps(session?: AuthSession) {
  const [submissions, reviewCases, targets] = await Promise.all([
    getSubmissions(session),
    getReviewCases(session),
    getCoverageTargets(session)
  ]);

  return buildCoverageGaps(submissions, reviewCases, targets);
}

export async function getEnumeratorScorecards(session?: AuthSession) {
  const [submissions, missionSubmissions, reviewCases] = await Promise.all([
    getSubmissions(session),
    getMissionSubmissions(session),
    getReviewCases(session)
  ]);

  return buildEnumeratorScorecards(submissions, missionSubmissions, reviewCases);
}

export async function getPredictionSnapshots(session?: AuthSession) {
  const [targets, gaps, scorecards] = await Promise.all([
    getCoverageTargets(session),
    getCoverageGaps(session),
    getEnumeratorScorecards(session)
  ]);

  return buildPredictionSnapshots(targets, gaps, scorecards);
}

export async function getRoutePlans(session?: AuthSession) {
  const [missionPackages, reviewCases, submissions] = await Promise.all([
    getMissionPackages(session),
    getReviewCases(session),
    getSubmissions(session)
  ]);

  return buildRoutePlans(missionPackages, reviewCases, submissions);
}

export async function getCoveragePoints(session?: AuthSession) {
  const submissions = await getSubmissions(session);

  return submissions
    .filter((submission) => submission.geo)
    .map(
      (submission) =>
        ({
          id: submission.submissionId,
          householdId: submission.householdId,
          enumeratorName: submission.enumeratorName,
          status: submission.validationStatus,
          latitude: submission.geo!.latitude,
          longitude: submission.geo!.longitude,
          submittedAt: submission.capturedAt,
          scope: submission.scope,
          layer:
            submission.reviewStatus === "revisit_requested"
              ? "revisit"
              : submission.validationStatus === "flagged"
                ? "flagged"
                : submission.riskSignals?.some((signal) => signal.includes("geo"))
                  ? "geo_anomaly"
                  : "approved",
          riskLevel: submission.riskLevel
        }) satisfies CoveragePoint
    );
}

export async function getMissionSubmissions(session?: AuthSession) {
  const submissions = await readCollection<MissionSubmission>("mission_submissions");

  if (!session || session.role === "admin") {
    return sortByDateDescending(submissions);
  }

  const filtered = submissions.filter((submission) => {
    if (session.role === "employee") {
      return submission.enumeratorId === session.uid;
    }

    const projectMatches = !session.projectId || submission.projectId === session.projectId;
    return projectMatches && scopeMatches(session.scopes, submission.scope);
  });

  return sortByDateDescending(filtered);
}

export async function getMissionCoveragePoints(session?: AuthSession) {
  const [submissions, projects] = await Promise.all([
    getMissionSubmissions(session),
    getProjects(session)
  ]);

  return submissions.map(
    (submission) =>
      ({
        id: submission.submissionId,
        assignmentId: submission.assignmentId,
        projectId: submission.projectId,
        projectName:
          projects.find((project) => project.id === submission.projectId)?.name ?? "Mission",
        enumeratorName: submission.enumeratorName,
        status: submission.validationStatus,
        latitude: submission.geoCheckAtSubmit.latitude,
        longitude: submission.geoCheckAtSubmit.longitude,
        distanceMeters: submission.geoCheckAtSubmit.distanceMeters,
        proofCaptured: Boolean(submission.evidence.storagePath),
        submittedAt: submission.capturedAt,
        scope: submission.scope,
        layer:
          submission.anomalyFlags.some((flag) => flag.includes("geo"))
            ? "geo_anomaly"
            : submission.validationStatus === "flagged"
              ? "flagged"
              : "approved",
        riskLevel: submission.riskLevel
      }) satisfies MissionCoveragePoint
  );
}

export async function getMissionPackages(session?: AuthSession) {
  const [assignments, projects, templates, users] = await Promise.all([
    getAssignments(session),
    getProjects(session),
    getTemplateVersions(session),
    getUsers(session?.role === "employee" ? undefined : session)
  ]);

  return assignments
    .filter(missionAssignmentMatches)
    .map((assignment): MissionAssignmentPackage | null => {
      const project = projects.find((candidate) => candidate.id === assignment.projectId);
      const template = templates.find(
        (candidate) =>
          candidate.id === assignment.templateVersionId ||
          candidate.id === project?.activeTemplateVersionId
      );

      if (!project || !template || !assignment.shareCode) {
        return null;
      }

      const assignee = assignment.assigneeUid
        ? users.find((user) => user.uid === assignment.assigneeUid)
        : undefined;

      return {
        assignment,
        project,
        template,
        assignee: assignee
          ? {
              uid: assignee.uid,
              name: assignee.name,
              email: assignee.email
            }
          : undefined,
        shareUrl: `${env.appUrl}/field/${assignment.shareCode}`
      };
    })
    .filter((value): value is MissionAssignmentPackage => Boolean(value));
}

export async function getMissionPackageByShareCode(
  shareCode: string,
  session?: AuthSession
) {
  const packages = await getMissionPackages(session);
  return packages.find((pkg) => pkg.assignment.shareCode === shareCode) ?? null;
}

export async function getMissionPackageByAssignmentId(
  assignmentId: string,
  session?: AuthSession
) {
  const packages = await getMissionPackages(session);
  return packages.find((pkg) => pkg.assignment.id === assignmentId) ?? null;
}

export async function getMissionOperationsData(session?: AuthSession) {
  const [packages, submissions, coveragePoints, projects] = await Promise.all([
    getMissionPackages(session),
    getMissionSubmissions(session),
    getMissionCoveragePoints(session),
    getProjects(session)
  ]);
  const snapshot = computeMissionSnapshot(
    packages.map((pkg) => pkg.assignment),
    submissions,
    projects
  );

  return {
    packages,
    submissions,
    coveragePoints,
    snapshot,
    kpis: computeMissionKpis(snapshot)
  };
}

export async function getEnumeratorDashboardData(session: AuthSession) {
  const [
    assignments,
    submissions,
    projects,
    currentTemplate,
    missionPackages,
    missionSubmissions,
    reviewCases,
    routePlans
  ] =
    await Promise.all([
    getAssignments(session),
    getSubmissions(session),
    getProjects(session),
    getCurrentTemplate(session),
    getMissionPackages(session),
    getMissionSubmissions(session),
    getReviewCases(session),
    getRoutePlans(session)
  ]);

  const activeProject =
    projects.find((project) => project.id === session.projectId) ?? projects[0] ?? null;

  return {
    activeProject,
    currentTemplate,
    kpis: computeEnumeratorKpis(assignments, submissions),
    assignments,
    submissions,
    missionPackages,
    missionSubmissions,
    reviewCases,
    revisitTasks: reviewCases
      .filter((reviewCase) => reviewCase.revisitTask?.status === "open")
      .map((reviewCase) => reviewCase.revisitTask!),
    routePlan:
      routePlans.find((routePlan) => routePlan.enumeratorId === session.uid) ?? null
  };
}

export async function getSupervisorDashboardData(session: AuthSession) {
  const [submissions, auditLogs, coveragePoints, projects, missions, reviewCases, alerts, gaps, scorecards, predictions] = await Promise.all([
    getSubmissions(session),
    getAuditLogs(session),
    getCoveragePoints(session),
    getProjects(session),
    getMissionOperationsData(session),
    getReviewCases(session),
    getAlerts(session),
    getCoverageGaps(session),
    getEnumeratorScorecards(session),
    getPredictionSnapshots(session)
  ]);

  return {
    projects,
    coveragePoints,
    kpis: computeSupervisorKpis(submissions),
    submissions,
    flagged: reviewCases.filter((reviewCase) =>
      ["open", "under_review", "revisit_requested", "escalated"].includes(reviewCase.status)
    ),
    auditLogs,
    missions,
    reviewCases,
    alerts,
    coverageGaps: gaps,
    scorecards,
    predictions
  };
}

export async function getAdminDashboardData(session?: AuthSession) {
  const [users, exports, templates, auditLogs, projects, submissions, missions, reviewCases, alerts, gaps, scorecards, predictions, routePlans] =
    await Promise.all([
    getUsers(session),
    getExportRequests(session),
    getTemplateVersions(session),
    getAuditLogs(session),
    getProjects(session),
    getSubmissions(session),
    getMissionOperationsData(session),
    getReviewCases(session),
    getAlerts(session),
    getCoverageGaps(session),
    getEnumeratorScorecards(session),
    getPredictionSnapshots(session),
    getRoutePlans(session)
  ]);

  return {
    kpis: computeAdminKpis(users, projects, submissions, exports),
    users,
    exports,
    templates,
    projects,
    auditLogs,
    submissions,
    missions,
    reviewCases,
    alerts,
    coverageGaps: gaps,
    scorecards,
    predictions,
    routePlans
  };
}
