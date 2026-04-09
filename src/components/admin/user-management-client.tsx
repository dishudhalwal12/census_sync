"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/types/domain";

export function UserManagementClient({
  users
}: {
  users: UserProfile[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");

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
      setRole("employee");
      const createdUid = payload.uid;
      if (createdUid) {
        setRows((current) => [
          {
            uid: createdUid,
            orgId: current[0]?.orgId ?? "org-demo-censussync",
            name,
            email,
            role: role as UserProfile["role"],
            status: "invited",
            assignmentLabel: role === "admin" ? "Organization admin" : "Field employee",
            scopes: district && block ? [{ district, block }] : [],
            assignedTemplateVersion: "template-unassigned",
            createdAt: new Date().toISOString()
          },
          ...current
        ]);
      }
      toast.success("User invited successfully.");
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
            onChange={(event) => setRole(event.target.value as "employee" | "admin")}
            className="h-11 rounded-2xl border border-white/70 bg-white px-4 text-sm"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          <Input placeholder="District" value={district} onChange={(event) => setDistrict(event.target.value)} />
          <Input placeholder="Block" value={block} onChange={(event) => setBlock(event.target.value)} />
          <Button onClick={addUser}>Invite workspace user</Button>
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
                <th className="pb-3">Assignment</th>
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
                  <td className="py-4">{user.assignmentLabel ?? "Workspace user"}</td>
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
