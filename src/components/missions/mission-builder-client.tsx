"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  MissionAssignmentPackage,
  TemplateField,
  TemplateSection,
  UserProfile
} from "@/types/domain";

function createField(type: TemplateField["kind"] = "text"): TemplateField {
  return {
    key: `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    label: "New question",
    type:
      type === "number"
        ? "number"
        : type === "date"
          ? "date"
          : type === "boolean"
            ? "checkbox"
            : type === "single_select" || type === "multi_select"
              ? "select"
              : type === "textarea" || type === "instruction"
                ? "textarea"
                : "text",
    kind: type,
    required: type !== "instruction",
    helperText: "",
    placeholder: "",
    options:
      type === "single_select" || type === "multi_select"
        ? [
            { label: "Option 1", value: "option_1" },
            { label: "Option 2", value: "option_2" }
          ]
        : undefined
  };
}

function createSection(title = "New section"): TemplateSection {
  return {
    id: `section_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    description: "",
    fields: [createField("text")]
  };
}

export function MissionBuilderClient({
  users,
  missionPackages
}: {
  users: UserProfile[];
  missionPackages: MissionAssignmentPackage[];
}) {
  const router = useRouter();
  const enumerators = useMemo(
    () => users.filter((user) => user.role === "enumerator" && user.status === "active"),
    [users]
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [cluster, setCluster] = useState("");
  const [latitude, setLatitude] = useState("28.5352");
  const [longitude, setLongitude] = useState("77.3907");
  const [serviceRadiusMeters, setServiceRadiusMeters] = useState("1000");
  const [capacityLimit, setCapacityLimit] = useState("25");
  const [assigneeUid, setAssigneeUid] = useState(enumerators[0]?.uid ?? "");
  const [sections, setSections] = useState<TemplateSection[]>([
    {
      id: "instructions",
      title: "Enumerator briefing",
      description: "Explain the mission and any mandatory field behavior.",
      fields: [
        {
          key: "briefing",
          label: "Mission briefing",
          type: "textarea",
          kind: "instruction",
          required: false,
          helperText:
            "Stay within the mission radius, complete all questions, and capture one proof photo."
        }
      ]
    },
    createSection("Census questions")
  ]);
  const [latestSharePath, setLatestSharePath] = useState<string>();
  const reviewMission =
    missionPackages.find((pkg) => pkg.assignment.shareCode === "ward7-market-sweep") ??
    missionPackages[0];

  function updateSection(sectionId: string, updates: Partial<TemplateSection>) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    );
  }

  function updateField(
    sectionId: string,
    fieldKey: string,
    updates: Partial<TemplateField>
  ) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.key === fieldKey ? { ...field, ...updates } : field
              )
            }
          : section
      )
    );
  }

  function addField(sectionId: string, kind: TemplateField["kind"] = "text") {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [...section.fields, createField(kind)]
            }
          : section
      )
    );
  }

  function removeField(sectionId: string, fieldKey: string) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.key !== fieldKey)
            }
          : section
      )
    );
  }

  function addSection() {
    setSections((current) => [...current, createSection()]);
  }

  async function publishMission() {
    if (!name || !district || !block || !assigneeUid) {
      toast.error("Mission name, district, block, and enumerator are required.");
      return;
    }

    try {
      const response = await fetch("/api/admin/missions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          description,
          objective,
          district,
          block,
          cluster: cluster || undefined,
          siteCenter: {
            latitude: Number(latitude),
            longitude: Number(longitude)
          },
          serviceRadiusMeters: Number(serviceRadiusMeters || "1000"),
          capacityLimit: Number(capacityLimit || "0"),
          assigneeUid,
          sections
        })
      });
      const data = (await response.json()) as { sharePath?: string; message?: string };
      if (!response.ok || !data.sharePath) {
        throw new Error(data.message ?? "Unable to publish the mission.");
      }
      setLatestSharePath(data.sharePath);
      toast.success("Mission published and secure field link generated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to publish the mission."
      );
    }
  }

  async function copyLatestLink() {
    if (!latestSharePath) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}${latestSharePath}`);
    toast.success("Latest mission link copied.");
  }

  async function calibrateMissionToCurrentLocation() {
    try {
      if (!reviewMission) {
        toast.error("No mission is available to calibrate yet.");
        return;
      }

      if (!navigator.geolocation) {
        toast.error("Geolocation is not available on this device.");
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000
        });
      }).catch(() => null);

      if (!position) {
        toast.error("Unable to read the current location.");
        return;
      }

      const response = await fetch("/api/admin/missions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          assignmentId: reviewMission.assignment.id,
          siteCenter: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          },
          serviceRadiusMeters: Number(serviceRadiusMeters || "1000")
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to calibrate the mission location.");
      }

      toast.success("Mission geofence calibrated to this device location.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to calibrate the mission location."
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="text-2xl font-semibold">Guided mission builder</h3>
            <p className="text-sm text-muted-foreground">
              Configure the census objective, geofence, capacity, custom question set, and assigned
              enumerator in one publishing flow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Mission name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Objective</Label>
              <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>District</Label>
              <Input value={district} onChange={(event) => setDistrict(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Block</Label>
              <Input value={block} onChange={(event) => setBlock(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cluster</Label>
              <Input value={cluster} onChange={(event) => setCluster(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assigned enumerator</Label>
              <select
                value={assigneeUid}
                onChange={(event) => setAssigneeUid(event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
              >
                {enumerators.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input value={latitude} onChange={(event) => setLatitude(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input value={longitude} onChange={(event) => setLongitude(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Service radius (m)</Label>
              <Input
                type="number"
                value={serviceRadiusMeters}
                onChange={(event) => setServiceRadiusMeters(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity limit</Label>
              <Input
                type="number"
                value={capacityLimit}
                onChange={(event) => setCapacityLimit(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xl font-semibold">Questionnaire builder</h4>
                <p className="text-sm text-muted-foreground">
                  Supported v1 field types: text, textarea, number, single select, multi select,
                  boolean, date, and instruction blocks.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={addSection}>
                <Plus className="mr-2 h-4 w-4" />
                Add section
              </Button>
            </div>

            {sections.map((section) => (
              <div key={section.id} className="rounded-[1.75rem] border border-black/5 bg-white p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Section title</Label>
                    <Input
                      value={section.title}
                      onChange={(event) =>
                        updateSection(section.id, { title: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Section description</Label>
                    <Input
                      value={section.description}
                      onChange={(event) =>
                        updateSection(section.id, { description: event.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {section.fields.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-[1.5rem] bg-lavender-50 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{field.kind ?? field.type}</div>
                        {section.fields.length > 1 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => removeField(section.id, field.key)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Field key</Label>
                          <Input
                            value={field.key}
                            onChange={(event) =>
                              updateField(section.id, field.key, { key: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={field.label}
                            onChange={(event) =>
                              updateField(section.id, field.key, { label: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <select
                            value={field.kind ?? "text"}
                            onChange={(event) => {
                              const kind = event.target.value as TemplateField["kind"];
                              updateField(section.id, field.key, createField(kind));
                            }}
                            className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="number">Number</option>
                            <option value="single_select">Single select</option>
                            <option value="multi_select">Multi select</option>
                            <option value="boolean">Boolean</option>
                            <option value="date">Date</option>
                            <option value="instruction">Instruction</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Placeholder / helper</Label>
                          <Input
                            value={field.placeholder ?? field.helperText ?? ""}
                            onChange={(event) =>
                              updateField(section.id, field.key, {
                                placeholder: event.target.value,
                                helperText: event.target.value
                              })
                            }
                          />
                        </div>
                      </div>
                      {field.kind !== "instruction" ? (
                        <label className="mt-3 flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(event) =>
                              updateField(section.id, field.key, {
                                required: event.target.checked
                              })
                            }
                          />
                          Required question
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "text",
                    "textarea",
                    "number",
                    "single_select",
                    "multi_select",
                    "boolean",
                    "date",
                    "instruction"
                  ].map((kind) => (
                    <Button
                      key={kind}
                      type="button"
                      variant="secondary"
                      onClick={() => addField(section.id, kind as TemplateField["kind"])}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {kind.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={publishMission}>
              Publish mission
            </Button>
            {reviewMission ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void calibrateMissionToCurrentLocation()}
              >
                <Crosshair className="mr-2 h-4 w-4" />
                Calibrate review mission
              </Button>
            ) : null}
            {latestSharePath ? (
              <Button type="button" variant="secondary" onClick={() => void copyLatestLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy latest link
              </Button>
            ) : null}
          </div>
          {latestSharePath ? (
            <div className="rounded-[1.75rem] bg-emerald-50 p-4 text-sm text-emerald-700">
              Published link: {latestSharePath}
            </div>
          ) : null}
          {reviewMission ? (
            <div className="rounded-[1.75rem] bg-butter-50 p-4 text-sm text-black/75">
              Review mission ready to calibrate: {reviewMission.assignment.label}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold">Published mission links</h3>
          {missionPackages.length ? (
            missionPackages.map((pkg) => (
              <div key={pkg.assignment.id} className="rounded-[1.75rem] bg-lavender-50 p-4">
                <p className="font-semibold">{pkg.assignment.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pkg.assignee?.name ?? "Assigned enumerator"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  /field/{pkg.assignment.shareCode}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 p-4 text-sm text-muted-foreground">
              No mission links have been published yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
