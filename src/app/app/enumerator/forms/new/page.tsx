import { PageHeader } from "@/components/layout/page-header";
import { HouseholdForm } from "@/components/forms/household-form";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentTemplate, getEnumeratorDashboardData, getSubmissions } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";
import { createEmptyHouseholdForm } from "@/lib/validators/household";

export default async function NewHouseholdPage() {
  const session = await requireSession(["employee", "admin"]);
  const [submissions, dashboardData, currentTemplate] = await Promise.all([
    getSubmissions(session),
    getEnumeratorDashboardData(session),
    getCurrentTemplate(session)
  ]);
  const activeAssignment = dashboardData.assignments.find(
    (assignment) => assignment.status === "active"
  );
  const initialValues = createEmptyHouseholdForm({
    projectId: currentTemplate?.projectId ?? session.projectId ?? "project-unassigned",
    projectType: currentTemplate?.projectType ?? "census",
    templateVersionId: currentTemplate?.id ?? "template-unassigned",
    district: activeAssignment?.scope.district ?? session.scopes[0]?.district ?? "",
    block: activeAssignment?.scope.block ?? session.scopes[0]?.block ?? "",
    cluster: activeAssignment?.scope.cluster ?? session.scopes[0]?.cluster ?? ""
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New household"
        title="Multi-step household census capture"
        description="Designed for beautiful field use: autosave, geo-tagging, local queueing, and clear progress from first answer to sync."
      />
      {!currentTemplate || !activeAssignment ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This account does not have an active project assignment yet. Ask an admin to assign a
            project, scope, and template before capturing new household records.
          </CardContent>
        </Card>
      ) : null}
      <HouseholdForm
        session={session}
        existingHouseholdIds={submissions.map((submission) => submission.householdId)}
        initialValues={initialValues}
      />
    </div>
  );
}
