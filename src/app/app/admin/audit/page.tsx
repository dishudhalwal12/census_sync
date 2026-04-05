import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAuditLogs } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function AuditPage() {
  const session = await requireSession(["admin"]);
  const auditLogs = await getAuditLogs(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit logs"
        title="Searchable activity for login, sync, export, and admin actions"
        description="Every important event is time-stamped with actor context so district operations keep a clear accountability trail."
      />
      <Card>
        <CardContent className="overflow-x-auto p-6">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-3">Action</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((event) => (
                <tr key={event.id} className="border-t border-black/5">
                  <td className="py-4 capitalize">{event.action.replaceAll("_", " ")}</td>
                  <td className="py-4">{event.actorName}</td>
                  <td className="py-4">{event.targetType} / {event.targetId}</td>
                  <td className="py-4">{new Date(event.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
