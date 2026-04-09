"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Copy,
  MapPin,
  RefreshCcw,
  ShieldCheck
} from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  cacheMissionPackage,
  compressImageForMission,
  getCachedMissionPackageByAssignmentId,
  getCachedMissionPackageByShareCode,
  getMissionDraft,
  queueMissionSubmission,
  saveMissionDraft,
  syncMissionQueue,
  updateCachedMissionStatus
} from "@/lib/missions/service";
import {
  buildMissionGeoCheck,
  getMissionFieldCopy,
  getMissionSectionCopy,
  getMissionRequiredCounts,
  isGeoCheckFresh,
  validateMissionAnswers
} from "@/lib/missions/utils";
import { isTemplateFieldVisible } from "@/lib/trust/forms";
import type { MissionAssignmentPackage, MissionGeoCheck, TemplateField } from "@/types/domain";
import type { AuthSession } from "@/types/session";

function createEmptyAnswers(pkg: MissionAssignmentPackage) {
  return Object.fromEntries(
    pkg.template.sections.flatMap((section) =>
      section.fields.map((field) => {
        if (field.kind === "multi_select") {
          return [field.key, []];
        }

        if (field.kind === "boolean") {
          return [field.key, false];
        }

        return [field.key, ""];
      })
    )
  ) as Record<string, unknown>;
}

function renderFieldLabel(field: TemplateField, language: "en" | "hi") {
  const copy = getMissionFieldCopy(field, language);
  return (
    <div className="space-y-1">
      <Label>{copy.label}</Label>
      {copy.helperText ? (
        <p className="text-xs text-muted-foreground">{copy.helperText}</p>
      ) : null}
    </div>
  );
}

export function MissionWorkspace({
  session,
  initialPackage,
  assignmentId,
  shareCode
}: {
  session: AuthSession;
  initialPackage?: MissionAssignmentPackage | null;
  assignmentId?: string;
  shareCode?: string;
}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [pkg, setPkg] = useState<MissionAssignmentPackage | null>(initialPackage ?? null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const [geoCheckAtStart, setGeoCheckAtStart] = useState<MissionGeoCheck>();
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [proofBlob, setProofBlob] = useState<Blob | null>(null);
  const [proofFileName, setProofFileName] = useState("mission-proof.jpg");
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const lastSavedRef = useRef("");

  useEffect(() => {
    let mounted = true;

    async function resolvePackage() {
      if (initialPackage) {
        await cacheMissionPackage(initialPackage, session.uid);
        if (mounted) {
          setPkg(initialPackage);
        }
        return;
      }

      const cached = assignmentId
        ? await getCachedMissionPackageByAssignmentId(assignmentId, session.uid)
        : shareCode
          ? await getCachedMissionPackageByShareCode(shareCode, session.uid)
          : undefined;

      if (mounted) {
        setPkg(cached?.data ?? null);
      }
    }

    void resolvePackage();
    return () => {
      mounted = false;
    };
  }, [assignmentId, initialPackage, session.uid, shareCode]);

  useEffect(() => {
    let mounted = true;

    async function hydrateDraft() {
      if (!pkg) {
        return;
      }

      const draft = await getMissionDraft(pkg.assignment.id, session.uid);
      const baseAnswers = createEmptyAnswers(pkg);

      if (!mounted) {
        return;
      }

      setAnswers(draft ? { ...baseAnswers, ...draft.answers } : baseAnswers);
      setGeoCheckAtStart(draft?.geoCheckAtStart);
      setStep(draft?.progressStep ?? 0);
    }

    void hydrateDraft();
    return () => {
      mounted = false;
    };
  }, [pkg, session.uid]);

  useEffect(() => {
    if (!pkg) {
      return;
    }

    const serialized = JSON.stringify({
      answers,
      geoCheckAtStart,
      step
    });
    if (serialized === lastSavedRef.current) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      await saveMissionDraft(
        {
          assignmentId: pkg.assignment.id,
          answers,
          geoCheckAtStart,
          progressStep: step
        },
        session.uid
      );
      lastSavedRef.current = serialized;
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [answers, geoCheckAtStart, pkg, session.uid, step]);

  const sections = pkg?.template.sections ?? [];
  const currentSection = sections[step];
  const translatedSection =
    pkg && currentSection ? getMissionSectionCopy(pkg.template, currentSection.id, language) : null;
  const progress = useMemo(() => {
    if (!pkg) {
      return { required: 0, completed: 0 };
    }

    return getMissionRequiredCounts(pkg.template, answers);
  }, [answers, pkg]);

  async function resolveLiveGeoCheck() {
    if (!pkg?.project.siteCenter) {
      throw new Error("This mission does not have a configured target location.");
    }

    if (!navigator.geolocation) {
      throw new Error("Geolocation is not available on this device.");
    }

    return new Promise<MissionGeoCheck>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve(
            buildMissionGeoCheck({
              location: position.coords,
              siteCenter: pkg.project.siteCenter!,
              radiusMeters: pkg.project.serviceRadiusMeters
            })
          ),
        () => reject(new Error("Unable to read your live GPS location.")),
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  }

  async function unlockMission() {
    setIsResolvingLocation(true);
    try {
      const geoCheck = await resolveLiveGeoCheck();

      if (!geoCheck.withinRange) {
        toast.error(
          `You are ${geoCheck.distanceMeters} m away. Move inside the ${pkg?.project.serviceRadiusMeters ?? 1000} m mission radius to continue.`
        );
        return;
      }

      setGeoCheckAtStart(geoCheck);
      if (pkg) {
        await updateCachedMissionStatus(pkg.assignment.id, session.uid, "in_progress", {
          requiredResponses: progress.required,
          completedResponses: progress.completed
        });
      }
      toast.success("Mission unlocked. Live geofence check passed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify location.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function onProofSelected(file?: File | null) {
    if (!file) {
      return;
    }

    const compressed = await compressImageForMission(file);
    setProofBlob(compressed);
    setProofFileName(file.name || "mission-proof.jpg");
    const objectUrl = URL.createObjectURL(compressed);
    setProofPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return objectUrl;
    });
  }

  function updateAnswer(fieldKey: string, value: unknown) {
    setAnswers((current) => ({
      ...current,
      [fieldKey]: value
    }));
  }

  async function submitMission() {
    if (!pkg) {
      toast.error("Mission package is not available yet.");
      return;
    }

    if (!geoCheckAtStart?.withinRange) {
      toast.error("Unlock the mission inside the assigned geofence before submitting.");
      return;
    }

    const fieldErrors = validateMissionAnswers(pkg.template, answers, language);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      toast.error("Complete the required mission questions before submitting.");
      return;
    }

    if (!proofBlob) {
      toast.error("A proof-of-visit photo is required before submission.");
      return;
    }

    setIsResolvingLocation(true);
    try {
      const finalGeo = await resolveLiveGeoCheck();
      if (!finalGeo.withinRange) {
        toast.error(
          `Final GPS check failed at ${finalGeo.distanceMeters} m from the mission center.`
        );
        return;
      }

      if (!isGeoCheckFresh(finalGeo.capturedAt)) {
        toast.error("Final GPS evidence is stale. Please retry submit.");
        return;
      }

      await queueMissionSubmission(
        {
          assignmentPackage: pkg,
          answers,
          geoCheckAtStart,
          geoCheckAtSubmit: finalGeo,
          evidenceBlob: proofBlob,
          evidenceFileName: proofFileName
        },
        session
      );

      toast.success("Mission queued locally with proof-of-visit evidence.");

      if (isOnline) {
        const results = await syncMissionQueue(session);
        const failed = results.find((result) => result.status === "failed");
        if (failed) {
          toast.warning(failed.message ?? "Mission queued but sync needs attention.");
        } else {
          toast.success("Mission synced successfully.");
        }
      }

      router.replace("/app/enumerator/missions");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue mission.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function copyShareLink() {
    if (!pkg?.assignment.shareCode) {
      return;
    }

    const url = `${window.location.origin}/field/${pkg.assignment.shareCode}`;
    await navigator.clipboard.writeText(url);
    toast.success("Mission link copied.");
  }

  if (!pkg) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This mission is not available on this device yet. Open the secure share link once while
          online to cache it for offline use.
        </CardContent>
      </Card>
    );
  }

  const missionUnlocked = Boolean(geoCheckAtStart?.withinRange);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <StatusBadge
                status={
                  missionUnlocked ? pkg.assignment.activationStatus ?? "pending_sync" : "pending"
                }
              />
              <div>
                <h3 className="text-2xl font-semibold">{pkg.assignment.label}</h3>
                <p className="text-sm text-muted-foreground">{pkg.project.objective}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "hi")}
                className="h-10 rounded-full border border-black/10 bg-white px-4 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <Button variant="secondary" type="button" onClick={copyShareLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/app/enumerator/missions">Back to assigned censuses</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-lavender-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Location trust gate</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The form unlocks only inside {pkg.project.serviceRadiusMeters ?? 1000} m of the
                  configured site. GPS is checked again when you submit.
                </p>
              </div>
              <Button type="button" onClick={unlockMission} disabled={isResolvingLocation}>
                <MapPin className="mr-2 h-4 w-4" />
                {missionUnlocked ? "Refresh location" : "Check live location"}
              </Button>
            </div>

            {geoCheckAtStart ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Distance</p>
                  <p className="mt-2 text-2xl font-bold">{geoCheckAtStart.distanceMeters} m</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Accuracy</p>
                  <p className="mt-2 text-2xl font-bold">
                    {Math.round(geoCheckAtStart.accuracy ?? 0)} m
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Status</p>
                  <p className="mt-2 text-base font-semibold">
                    {geoCheckAtStart.withinRange ? "Inside radius" : "Outside radius"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {!missionUnlocked ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-800">
              Complete the live geofence check to unlock the census questions.
            </div>
          ) : null}

          {currentSection ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
                  Section {step + 1} of {sections.length}
                </p>
                <h4 className="mt-2 text-xl font-semibold">
                  {translatedSection?.title ?? currentSection.title}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {translatedSection?.description ?? currentSection.description}
                </p>
              </div>

              <div className="grid gap-4">
                {currentSection.fields.map((field) => {
                  const value = answers[field.key];
                  const copy = getMissionFieldCopy(field, language);

                  if (!isTemplateFieldVisible(field, answers)) {
                    return null;
                  }

                  if (field.kind === "instruction") {
                    return (
                      <div
                        key={field.key}
                        className="rounded-[1.5rem] border border-black/5 bg-butter-50 p-5 text-sm text-black/70"
                      >
                        <p className="font-semibold">{copy.label}</p>
                        <p className="mt-2">{copy.helperText ?? copy.placeholder}</p>
                      </div>
                    );
                  }

                  if (field.kind === "textarea" || field.type === "textarea") {
                    return (
                      <div key={field.key} className="space-y-2">
                        {renderFieldLabel(field, language)}
                        <Textarea
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => updateAnswer(field.key, event.target.value)}
                          placeholder={copy.placeholder}
                          disabled={!missionUnlocked}
                        />
                        {errors[field.key] ? (
                          <p className="text-sm text-rose-500">{errors[field.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.kind === "number" || field.type === "number") {
                    return (
                      <div key={field.key} className="space-y-2">
                        {renderFieldLabel(field, language)}
                        <Input
                          type="number"
                          value={typeof value === "number" ? value : ""}
                          onChange={(event) =>
                            updateAnswer(
                              field.key,
                              event.target.value === "" ? "" : Number(event.target.value)
                            )
                          }
                          placeholder={copy.placeholder}
                          disabled={!missionUnlocked}
                        />
                        {errors[field.key] ? (
                          <p className="text-sm text-rose-500">{errors[field.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.kind === "single_select" || field.type === "select") {
                    return (
                      <div key={field.key} className="space-y-2">
                        {renderFieldLabel(field, language)}
                        <select
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => updateAnswer(field.key, event.target.value)}
                          className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
                          disabled={!missionUnlocked}
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {errors[field.key] ? (
                          <p className="text-sm text-rose-500">{errors[field.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.kind === "multi_select") {
                    const selected = Array.isArray(value) ? value : [];
                    return (
                      <div key={field.key} className="space-y-3">
                        {renderFieldLabel(field, language)}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {field.options?.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(option.value)}
                                disabled={!missionUnlocked}
                                onChange={(event) => {
                                  const next = event.target.checked
                                    ? [...selected, option.value]
                                    : selected.filter((item) => item !== option.value);
                                  updateAnswer(field.key, next);
                                }}
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                        {errors[field.key] ? (
                          <p className="text-sm text-rose-500">{errors[field.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.kind === "boolean" || field.type === "checkbox") {
                    return (
                      <div key={field.key} className="rounded-2xl border border-black/5 bg-white p-4">
                        <Label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            disabled={!missionUnlocked}
                            onChange={(event) => updateAnswer(field.key, event.target.checked)}
                          />
                          <span>{copy.label}</span>
                        </Label>
                        {copy.helperText ? (
                          <p className="mt-2 text-xs text-muted-foreground">{copy.helperText}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.kind === "date" || field.type === "date") {
                    return (
                      <div key={field.key} className="space-y-2">
                        {renderFieldLabel(field, language)}
                        <Input
                          type="date"
                          value={typeof value === "string" ? value : ""}
                          disabled={!missionUnlocked}
                          onChange={(event) => updateAnswer(field.key, event.target.value)}
                        />
                        {errors[field.key] ? (
                          <p className="text-sm text-rose-500">{errors[field.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <div key={field.key} className="space-y-2">
                      {renderFieldLabel(field, language)}
                      <Input
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) => updateAnswer(field.key, event.target.value)}
                        placeholder={copy.placeholder}
                        disabled={!missionUnlocked}
                      />
                      {errors[field.key] ? (
                        <p className="text-sm text-rose-500">{errors[field.key]}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.75rem] bg-peach-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Proof-of-visit photo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Capture one in-app photo. We attach the final live GPS/time evidence during
                  submit.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                <Camera className="h-4 w-4" />
                Add proof photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void onProofSelected(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {proofPreviewUrl ? (
              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-black/5 bg-white p-3">
                <Image
                  src={proofPreviewUrl}
                  alt="Mission proof preview"
                  unoptimized
                  width={896}
                  height={448}
                  className="h-56 w-full rounded-[1.25rem] object-cover"
                />
                <p className="mt-3 text-sm text-muted-foreground">{proofFileName}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </Button>
            <div className="flex gap-3">
              {step < sections.length - 1 ? (
                <Button type="button" onClick={() => setStep((current) => current + 1)}>
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={submitMission} disabled={isResolvingLocation}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Submit mission
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
              Mission progress
            </p>
            <div className="mt-4 h-3 rounded-full bg-black/5">
              <div
                className="h-3 rounded-full bg-lavender-400"
                style={{
                  width:
                    progress.required === 0
                      ? "0%"
                      : `${Math.round((progress.completed / progress.required) * 100)}%`
                }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {progress.completed}/{progress.required} required mission answers complete
            </p>
            <div className="mt-5 space-y-3">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
                    step === index ? "bg-lavender-100" : "bg-black/5"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {getMissionSectionCopy(pkg.template, section.id, language)?.title ?? section.title}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      index <= step ? "bg-lavender-400" : "bg-black/15"
                    }`}
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
                  Offline mission state
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Draft answers save automatically and sync resumes when the device reconnects.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void syncMissionQueue(session)}
                disabled={!isOnline}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Sync
              </Button>
            </div>
            <div className="rounded-2xl bg-black/5 p-4 text-sm text-muted-foreground">
              {isOnline
                ? "Online and ready to upload evidence."
                : "Offline mode active. Mission proof stays queued on this device."}
            </div>
            {geoCheckAtStart ? (
              <div
                className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700"
                suppressHydrationWarning
              >
                <CheckCircle2 className="mb-2 h-4 w-4" />
                Start location captured at {new Date(geoCheckAtStart.capturedAt).toLocaleTimeString()}.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
