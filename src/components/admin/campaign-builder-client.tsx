"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  Campaign,
  CampaignAssignment,
  CampaignLink,
  CampaignQuestion,
  CampaignSection,
  CampaignVersion
} from "@/types/campaign";
import type { UserProfile } from "@/types/domain";

export function CampaignBuilderClient({
  campaigns,
  versions,
  links,
  assignments,
  users
}: {
  campaigns: Campaign[];
  versions: CampaignVersion[];
  links: CampaignLink[];
  assignments: CampaignAssignment[];
  users: UserProfile[];
}) {
  const router = useRouter();
  const localIdRef = useRef(0);
  const employees = useMemo(
    () => users.filter((user) => user.role === "employee" && user.status !== "disabled"),
    [users]
  );

  function nextLocalId(prefix: string) {
    localIdRef.current += 1;
    return `${prefix}_${localIdRef.current}`;
  }

  function createQuestion(type: CampaignQuestion["type"] = "short_text"): CampaignQuestion {
    const questionId = nextLocalId("question");
    return {
      id: questionId,
      key: `${questionId}_key`,
      prompt: "New question",
      type,
      required: true,
      options:
        type === "single_select" || type === "multi_select"
          ? [
              { id: `${questionId}_option_1`, label: "Option 1", value: "option_1" },
              { id: `${questionId}_option_2`, label: "Option 2", value: "option_2" }
            ]
          : undefined,
      ratingScale:
        type === "rating"
          ? {
              min: 1,
              max: 5,
              minLabel: "Low",
              maxLabel: "High"
            }
          : undefined
    };
  }

  function createSection() {
    return {
      id: nextLocalId("section"),
      title: "New section",
      description: "",
      questions: [createQuestion()]
    } satisfies CampaignSection;
  }

  const [campaignId, setCampaignId] = useState<string>();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [collectionMode, setCollectionMode] = useState<Campaign["collectionMode"]>("hybrid");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [cluster, setCluster] = useState("");
  const [latitude, setLatitude] = useState("28.5352");
  const [longitude, setLongitude] = useState("77.3907");
  const [radius, setRadius] = useState("1200");
  const [sections, setSections] = useState<CampaignSection[]>(() => [
    {
      id: "section_initial",
      title: "New section",
      description: "",
      questions: [
        {
          id: "question_initial",
          key: "question_initial_key",
          prompt: "New question",
          type: "short_text",
          required: true
        }
      ]
    }
  ]);
  const [employeeId, setEmployeeId] = useState(employees[0]?.uid ?? "");
  const [latestShareUrl, setLatestShareUrl] = useState<string>();
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id ?? "");

  const selectedCampaign = campaigns.find((entry) => entry.id === selectedCampaignId);
  const selectedVersion = versions.find((entry) => entry.id === selectedCampaign?.activeVersionId);
  const selectedLinks = links.filter((entry) => entry.campaignId === selectedCampaignId);
  const selectedAssignments = assignments.filter((entry) => entry.campaignId === selectedCampaignId);

  useEffect(() => {
    if (!employees.length) {
      if (employeeId) {
        setEmployeeId("");
      }
      return;
    }

    const selectedEmployeeStillExists = employees.some((employee) => employee.uid === employeeId);
    if (!selectedEmployeeStillExists) {
      setEmployeeId(employees[0]?.uid ?? "");
    }
  }, [employeeId, employees]);

  function updateSection(sectionId: string, updates: Partial<CampaignSection>) {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, ...updates } : section))
    );
  }

  function updateQuestion(
    sectionId: string,
    questionId: string,
    updates: Partial<CampaignQuestion>
  ) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              questions: section.questions.map((question) =>
                question.id === questionId ? { ...question, ...updates } : question
              )
            }
          : section
      )
    );
  }

  function addSection() {
    setSections((current) => [...current, createSection()]);
  }

  function addQuestion(sectionId: string, type: CampaignQuestion["type"] = "short_text") {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              questions: [...section.questions, createQuestion(type)]
            }
          : section
      )
    );
  }

  function removeQuestion(sectionId: string, questionId: string) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              questions: section.questions.filter((question) => question.id !== questionId)
            }
          : section
      )
    );
  }

  async function generateDraft() {
    if (!name || !purpose || !targetAudience) {
      toast.error("Campaign name, purpose, and target audience are required for AI draft generation.");
      return;
    }

    setIsGeneratingDraft(true);
    try {
      const response = await fetch("/api/admin/campaigns/ai-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          purpose,
          description,
          targetAudience,
          collectionMode,
          district,
          block,
          cluster
        })
      });
      const payload = (await response.json()) as {
        sections?: CampaignSection[];
        source?: "gemini" | "fallback";
        summary?: string;
        message?: string;
      };

      if (!response.ok || !payload.sections?.length) {
        throw new Error(payload.message ?? "Unable to generate the campaign draft.");
      }

      setSections(payload.sections);

      if (payload.source === "fallback") {
        toast.warning(payload.message ?? "Draft generated from the built-in template.");
      } else {
        toast.success("Draft generated. Review and edit before publishing.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate the campaign draft.");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function saveCampaign() {
    if (!name || !purpose || !targetAudience || !sections.length) {
      toast.error("Campaign name, purpose, audience, and at least one section are required.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          campaignId,
          name,
          purpose,
          description,
          targetAudience,
          collectionMode,
          district,
          block,
          cluster,
          geofenceCenter: {
            latitude: Number(latitude),
            longitude: Number(longitude)
          },
          geofenceRadiusMeters: Number(radius),
          sections
        })
      });

      const payload = (await response.json()) as {
        campaign?: Campaign;
        version?: CampaignVersion;
        message?: string;
      };

      if (!response.ok || !payload.campaign || !payload.version) {
        throw new Error(payload.message ?? "Unable to publish this campaign.");
      }

      setCampaignId(payload.campaign.id);
      setSelectedCampaignId(payload.campaign.id);
      toast.success("Campaign published successfully.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish this campaign.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createLink(type: "employee" | "public") {
    const effectiveCampaignId = campaignId ?? selectedCampaignId;
    if (!effectiveCampaignId) {
      toast.error("Publish or select a campaign before generating links.");
      return;
    }

    if (type === "employee" && !employeeId) {
      toast.error("Invite or create an employee account before generating an employee link.");
      return;
    }

    try {
      const response = await fetch("/api/admin/campaign-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          campaignId: effectiveCampaignId,
          type,
          employeeId: type === "employee" ? employeeId : undefined
        })
      });

      const payload = (await response.json()) as { shareUrl?: string; message?: string };
      if (!response.ok || !payload.shareUrl) {
        throw new Error(payload.message ?? "Unable to create the campaign link.");
      }

      setLatestShareUrl(payload.shareUrl);
      await navigator.clipboard.writeText(payload.shareUrl);
      toast.success(`${type === "employee" ? "Employee" : "Public"} link created and copied.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the campaign link.");
    }
  }

  async function revokeLink(linkId: string) {
    try {
      const response = await fetch("/api/admin/campaign-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ revokeLinkId: linkId })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Unable to revoke the link.");
      }

      toast.success("Campaign link revoked.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revoke the link.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">Campaign builder</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the campaign brief, generate editable draft questions, and publish a versioned
                survey for employee and public collection.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={generateDraft}
              disabled={isGeneratingDraft}
              type="button"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isGeneratingDraft ? "Generating..." : "Generate draft"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Purpose</Label>
              <Textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Target audience</Label>
              <Input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Collection mode</Label>
              <select
                value={collectionMode}
                onChange={(event) => setCollectionMode(event.target.value as Campaign["collectionMode"])}
                className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
              >
                <option value="hybrid">Hybrid</option>
                <option value="employee_only">Employee only</option>
                <option value="public_only">Public only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Geofence radius (m)</Label>
              <Input value={radius} onChange={(event) => setRadius(event.target.value)} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={latitude} onChange={(event) => setLatitude(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={longitude} onChange={(event) => setLongitude(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold">Question design</h4>
                <p className="text-sm text-muted-foreground">
                  Review or edit the generated draft before publishing.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={addSection}>
                Add section
              </Button>
            </div>

            {sections.map((section) => (
              <div key={section.id} className="space-y-4 rounded-[1.5rem] border border-black/5 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <Input
                    value={section.title}
                    onChange={(event) => updateSection(section.id, { title: event.target.value })}
                  />
                  <Input
                    value={section.description ?? ""}
                    onChange={(event) =>
                      updateSection(section.id, { description: event.target.value })
                    }
                    placeholder="Section description"
                  />
                </div>

                <div className="space-y-3">
                  {section.questions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-[1.25rem] border border-black/5 bg-white p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.45fr]">
                        <Input
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(section.id, question.id, {
                              prompt: event.target.value
                            })
                          }
                        />
                        <select
                          value={question.type}
                          onChange={(event) =>
                            updateQuestion(section.id, question.id, {
                              type: event.target.value as CampaignQuestion["type"]
                            })
                          }
                          className="h-11 rounded-2xl border border-white/70 bg-white px-4 text-sm"
                        >
                          <option value="short_text">Short text</option>
                          <option value="long_text">Long text</option>
                          <option value="number">Number</option>
                          <option value="single_select">Single select</option>
                          <option value="multi_select">Multi select</option>
                          <option value="boolean">Boolean</option>
                          <option value="date">Date</option>
                          <option value="rating">Rating</option>
                        </select>
                        <label className="flex items-center gap-2 rounded-2xl border border-black/5 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(event) =>
                              updateQuestion(section.id, question.id, {
                                required: event.target.checked
                              })
                            }
                          />
                          Required
                        </label>
                      </div>

                      {(question.type === "single_select" || question.type === "multi_select") &&
                      question.options ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {question.options.map((option, optionIndex) => (
                            <Input
                              key={option.id}
                              value={option.label}
                              onChange={(event) => {
                                const nextOptions = [...(question.options ?? [])];
                                nextOptions[optionIndex] = {
                                  ...nextOptions[optionIndex]!,
                                  label: event.target.value,
                                  value: event.target.value.toLowerCase().replace(/\s+/g, "_")
                                };
                                updateQuestion(section.id, question.id, {
                                  options: nextOptions
                                });
                              }}
                            />
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(section.id, question.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove question
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion(section.id, "short_text")}>
                    Add text
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion(section.id, "single_select")}>
                    Add select
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion(section.id, "rating")}>
                    Add rating
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" onClick={saveCampaign} disabled={isSaving}>
            {isSaving ? "Publishing..." : "Publish campaign"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h3 className="text-xl font-semibold">Campaign links</h3>
              <p className="text-sm text-muted-foreground">
                Generate tokenized field and public links after publishing.
              </p>
            </div>

            <select
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
            >
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
              disabled={!employees.length}
            >
              {!employees.length ? (
                <option value="">No active employees available</option>
              ) : null}
              {employees.map((employee) => (
                <option key={employee.uid} value={employee.uid}>
                  {employee.name}
                </option>
              ))}
            </select>

            {!employees.length ? (
              <p className="text-sm text-muted-foreground">
                Create or invite an employee first, then come back here to generate an employee link.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => createLink("employee")}
                disabled={!employees.length}
              >
                Generate employee link
              </Button>
              <Button type="button" variant="secondary" onClick={() => createLink("public")}>
                Generate public link
              </Button>
            </div>

            {latestShareUrl ? (
              <div className="rounded-[1.5rem] bg-lavender-50 p-4 text-sm">
                <p className="font-semibold">Latest generated link</p>
                <p className="mt-2 break-all text-muted-foreground">{latestShareUrl}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h3 className="text-xl font-semibold">Published campaigns</h3>
              <p className="text-sm text-muted-foreground">
                Review active versions, generated links, and field assignments.
              </p>
            </div>

            {campaigns.length ? (
              campaigns.map((campaign) => {
                const campaignVersion = versions.find((entry) => entry.id === campaign.activeVersionId);
                const campaignLinks = links.filter((entry) => entry.campaignId === campaign.id);
                const campaignAssignments = assignments.filter((entry) => entry.campaignId === campaign.id);

                return (
                  <div key={campaign.id} className="rounded-[1.5rem] border border-black/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.purpose}</p>
                      </div>
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">
                        {campaign.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                      Active version: {campaignVersion?.versionLabel ?? "Not published"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Assignments: {campaignAssignments.length} • Links: {campaignLinks.length}
                    </p>

                    {campaignLinks.length ? (
                      <div className="mt-3 space-y-2">
                        {campaignLinks.map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 px-4 py-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {link.type === "employee" ? "Employee" : "Public"} link
                              </p>
                              <p className="text-muted-foreground">
                                {link.tokenPreview} • {link.status}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {link.status === "active" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => revokeLink(link.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No campaigns published yet. Use the builder to generate the first campaign.
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCampaign ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <h3 className="text-xl font-semibold">Selected campaign snapshot</h3>
              <p className="text-sm text-muted-foreground">{selectedCampaign.description}</p>
              <p className="text-sm text-muted-foreground">
                Mode: {selectedCampaign.collectionMode.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-muted-foreground">
                Questions: {selectedVersion?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Employee assignments: {selectedAssignments.length}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
