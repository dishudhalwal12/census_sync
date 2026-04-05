"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Project, UserProfile } from "@/types/domain";

export function UserManagementClient({
  users,
  projects
}: {
  users: UserProfile[];
  projects: Project[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("enumerator");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [district, setDistrict] = useState(projects[0]?.scope[0]?.district ?? "");
  const [block, setBlock] = useState(projects[0]?.scope[0]?.block ?? "");
  const [targetCount, setTargetCount] = useState("0");

  useEffect(() => {
    setRows(users);
  }, [users]);

  async function addUser() {
    if (!name || !email || !password) {
      toast.error("Name, email, and password are required.");
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          projectId: projectId || null,
          targetCount: Number(targetCount || "0"),
          scopes: district && block ? [{ district, block }] : []
        })
      });

      const payload = (await response.json()) as { uid?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to provision the user.");
      }

      setName("");
      setEmail("");
      setPassword("");
      setRole("enumerator");
      setTargetCount("0");
      const createdUid = payload.uid;
      if (createdUid) {
        setRows((current) => [
          {
            uid: createdUid,
            name,
            email,
            role: role as UserProfile["role"],
            status: "active",
            projectId: projectId || undefined,
            assignmentLabel: undefined,
            scopes: district && block ? [{ district, block }] : [],
            assignedTemplateVersion:
              projects.find((project) => project.id === projectId)?.activeTemplateVersionId ??
              "template-unassigned",
            createdAt: new Date().toISOString()
          },
          ...current
        ]);
      }
      toast.success("User created and assignment saved.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to provision the user."
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold">Invite or assign a user</h3>
          <Input placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input
            placeholder="Temporary password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="h-11 rounded-2xl border border-white/70 bg-white px-4 text-sm"
          >
            <option value="enumerator">Enumerator</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={projectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              const project = projects.find((entry) => entry.id === nextProjectId);
              setProjectId(nextProjectId);
              setDistrict(project?.scope[0]?.district ?? "");
              setBlock(project?.scope[0]?.block ?? "");
            }}
            className="h-11 rounded-2xl border border-white/70 bg-white px-4 text-sm"
          >
            <option value="">No project assigned yet</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Input placeholder="District" value={district} onChange={(event) => setDistrict(event.target.value)} />
          <Input placeholder="Block" value={block} onChange={(event) => setBlock(event.target.value)} />
          <Input
            placeholder="Target submissions"
            type="number"
            value={targetCount}
            onChange={(event) => setTargetCount(event.target.value)}
          />
          <Button onClick={addUser}>Create assigned user</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-6">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-3">User</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Project</th>
                <th className="pb-3">Scope</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.uid} className="border-t border-black/5">
                  <td className="py-4">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="py-4 capitalize">{user.role}</td>
                  <td className="py-4 capitalize">{user.status}</td>
                  <td className="py-4">
                    {projects.find((project) => project.id === user.projectId)?.name ?? "Unassigned"}
                  </td>
                  <td className="py-4">{user.scopes[0]?.district} / {user.scopes[0]?.block}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
