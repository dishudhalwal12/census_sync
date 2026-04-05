"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Project, TemplateVersion } from "@/types/domain";

export function TemplateManagementClient({
  templates,
  projects
}: {
  templates: TemplateVersion[];
  projects: Project[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(templates);
  const [projectRows, setProjectRows] = useState(projects);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [projectType, setProjectType] = useState("census");

  useEffect(() => {
    setRows(templates);
  }, [templates]);

  useEffect(() => {
    setProjectRows(projects);
  }, [projects]);

  async function activate(templateId: string) {
    try {
      const response = await fetch("/api/admin/templates/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ templateId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to activate the template.");
      }

      setRows((current) =>
        current.map((template) => ({
          ...template,
          status:
            template.id === templateId
              ? "active"
              : template.projectId === current.find((entry) => entry.id === templateId)?.projectId
                ? "archived"
                : template.status
        }))
      );
      toast.success("Active template updated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to activate the template."
      );
    }
  }

  async function createProject() {
    if (!projectName || !district || !block) {
      toast.error("Project name, district, and block are required.");
      return;
    }

    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          type: projectType,
          district,
          block
        })
      });
      const payload = (await response.json()) as { id?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to create the project.");
      }

      const createdProjectId = payload.id;
      if (createdProjectId) {
        setProjectRows((current) => [
          {
            id: createdProjectId,
            name: projectName,
            slug: projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            description:
              projectDescription ||
              "Offline field survey workflow with assignment tracking, validation, and exports.",
            type: projectType as Project["type"],
            status: "active",
            activeTemplateVersionId: undefined,
            targetSubmissions: 0,
            scope: [{ district, block }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          ...current
        ]);
      }
      setProjectName("");
      setProjectDescription("");
      setDistrict("");
      setBlock("");
      toast.success("Project created.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create the project."
      );
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Create project</h3>
            <Input
              placeholder="Project name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
            <Input
              placeholder="Short description"
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
            />
            <select
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
              className="h-11 rounded-2xl border border-white/70 bg-white px-4 text-sm"
            >
              <option value="census">Census</option>
              <option value="community_survey">Community survey</option>
              <option value="campus_outreach">Campus outreach</option>
              <option value="social_audit">Social audit</option>
            </select>
            <Input
              placeholder="District"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
            />
            <Input
              placeholder="Block"
              value={block}
              onChange={(event) => setBlock(event.target.value)}
            />
            <Button onClick={createProject}>Create active project</Button>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Live projects</h3>
            {projectRows.length ? (
              projectRows.map((project) => (
                <div key={project.id} className="rounded-[1.75rem] bg-lavender-50 p-4">
                  <p className="font-semibold">{project.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.type.replaceAll("_", " ")} • {project.scope[0]?.district} / {project.scope[0]?.block}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-4 text-sm text-muted-foreground">
                No projects created yet. Create one here to assign users and activate templates.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {rows.map((template) => (
        <Card key={template.id}>
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">{template.name} • {template.version}</h3>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">
                  {template.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {projects.find((project) => project.id === template.projectId)?.name ?? "Unassigned project"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{template.releaseNotes}</p>
            </div>
            <Button
              variant={template.status === "active" ? "secondary" : "default"}
              onClick={() => activate(template.id)}
            >
              {template.status === "active" ? "Currently active" : "Set active"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
