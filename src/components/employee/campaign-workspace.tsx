"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Copy, MapPin, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  cacheCampaignPackage,
  compressImageForCampaign,
  getCachedCampaignPackageByAssignmentId,
  getCampaignDraft,
  queueCampaignResponse,
  saveCampaignDraft,
  syncCampaignQueue
} from "@/lib/campaigns/offline";
import { validateCampaignAnswers } from "@/lib/campaigns/schemas";
import { calculateDistanceMeters } from "@/lib/missions/utils";
import type { CampaignFieldPackage, ResponseGeoCheck } from "@/types/campaign";
import type { AuthSession } from "@/types/session";

function createEmptyAnswers(pkg: CampaignFieldPackage) {
  return Object.fromEntries(
    pkg.version.sections.flatMap((section) =>
      section.questions.map((question) => {
        if (question.type === "multi_select") {
          return [question.key, []];
        }

        if (question.type === "boolean") {
          return [question.key, false];
        }

        return [question.key, ""];
      })
    )
  ) as Record<string, unknown>;
}

function buildGeoCheck(
  location: GeolocationPosition["coords"],
  center?: { latitude: number; longitude: number },
  radiusMeters?: number
) {
  const base: ResponseGeoCheck = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    capturedAt: new Date().toISOString()
  };

  if (!center) {
    return base;
  }

  const distanceMeters = Math.round(
    calculateDistanceMeters(
      {
        latitude: location.latitude,
        longitude: location.longitude
      },
      center
    )
  );

  return {
    ...base,
    distanceMeters,
    withinRange: distanceMeters <= (radiusMeters ?? 1000)
  };
}

export function CampaignWorkspace({
  session,
  initialPackage,
  assignmentId,
  token
}: {
  session: AuthSession;
  initialPackage?: CampaignFieldPackage | null;
  assignmentId?: string;
  token?: string;
}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [pkg, setPkg] = useState<CampaignFieldPackage | null>(initialPackage ?? null);
  const [packageToken, setPackageToken] = useState(token ?? "");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentPhone, setRespondentPhone] = useState("");
  const [unlockGeo, setUnlockGeo] = useState<ResponseGeoCheck>();
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoFileName, setPhotoFileName] = useState("respondent-photo.jpg");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const lastSavedRef = useRef("");

  useEffect(() => {
    let mounted = true;

    async function resolvePackage() {
      if (initialPackage && token) {
        await cacheCampaignPackage(initialPackage, session.uid, token);
        if (mounted) {
          setPkg(initialPackage);
          setPackageToken(token);
        }
        return;
      }

      if (!assignmentId) {
        return;
      }

      const cached = await getCachedCampaignPackageByAssignmentId(assignmentId, session.uid);
      if (mounted) {
        setPkg(cached?.data ?? null);
        setPackageToken(cached?.token ?? "");
      }
    }

    void resolvePackage();
    return () => {
      mounted = false;
    };
  }, [assignmentId, initialPackage, session.uid, token]);

  useEffect(() => {
    let mounted = true;

    async function hydrateDraft() {
      if (!pkg) {
        return;
      }

      const draft = await getCampaignDraft(pkg.assignment.id, session.uid);
      const baseAnswers = createEmptyAnswers(pkg);
      if (!mounted) {
        return;
      }

      setAnswers(draft ? { ...baseAnswers, ...draft.answers } : baseAnswers);
      setRespondentName(draft?.respondentName ?? "");
      setRespondentEmail(draft?.respondentEmail ?? "");
      setRespondentPhone(draft?.respondentPhone ?? "");
      setUnlockGeo(draft?.unlockGeo);
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
      respondentName,
      respondentEmail,
      respondentPhone,
      unlockGeo
    });
    if (serialized === lastSavedRef.current) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      await saveCampaignDraft(
        {
          assignmentId: pkg.assignment.id,
          token: packageToken,
          answers,
          respondentName,
          respondentEmail,
          respondentPhone,
          unlockGeo
        },
        session.uid
      );
      lastSavedRef.current = serialized;
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [answers, packageToken, pkg, respondentEmail, respondentName, respondentPhone, session.uid, unlockGeo]);

  const totalQuestions = useMemo(
    () => pkg?.version.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0,
    [pkg]
  );

  async function resolveLiveGeoCheck() {
    if (!pkg?.assignment.geofenceCenter) {
      throw new Error("This assignment does not have a configured target location.");
    }

    if (!navigator.geolocation) {
      throw new Error("Geolocation is not available on this device.");
    }

    return new Promise<ResponseGeoCheck>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve(
            buildGeoCheck(
              position.coords,
              pkg.assignment.geofenceCenter,
              pkg.assignment.geofenceRadiusMeters
            )
          ),
        () => reject(new Error("Unable to read your live GPS location.")),
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  }

  async function unlockAssignment() {
    setIsResolvingLocation(true);
    try {
      const nextGeo = await resolveLiveGeoCheck();
      if (!nextGeo.withinRange) {
        toast.error(
          `You are ${nextGeo.distanceMeters} m away. Move inside the ${pkg?.assignment.geofenceRadiusMeters ?? 1000} m radius to continue.`
        );
        return;
      }

      setUnlockGeo(nextGeo);
      toast.success("Field assignment unlocked inside the configured geofence.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify location.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function onPhotoSelected(file?: File | null) {
    if (!file) {
      return;
    }

    const compressed = await compressImageForCampaign(file);
    setPhotoBlob(compressed);
    setPhotoFileName(file.name || "respondent-photo.jpg");
    const objectUrl = URL.createObjectURL(compressed);
    setPhotoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return objectUrl;
    });
  }

  function updateAnswer(key: string, value: unknown) {
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function submitResponse() {
    if (!pkg) {
      toast.error("Campaign package is not available yet.");
      return;
    }

    if (!unlockGeo?.withinRange) {
      toast.error("Unlock the assignment inside the configured geofence before submitting.");
      return;
    }

    const validationErrors = validateCampaignAnswers(pkg.version.sections, answers);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      toast.error("Complete the required campaign questions before submitting.");
      return;
    }

    if (!photoBlob) {
      toast.error("Capture a respondent photo before submitting.");
      return;
    }

    setIsResolvingLocation(true);
    try {
      const submitGeo = await resolveLiveGeoCheck();
      if (!submitGeo.withinRange) {
        toast.error("Final geofence check failed. Move inside the assigned radius and retry.");
        return;
      }

      await queueCampaignResponse(
        {
          fieldPackage: pkg,
          token: packageToken,
          answers,
          respondentName,
          respondentEmail,
          respondentPhone,
          unlockGeo,
          submitGeo,
          photoBlob,
          photoFileName
        },
        session
      );

      toast.success("Response queued locally.");

      if (isOnline) {
        const syncResults = await syncCampaignQueue(session);
        const failed = syncResults.find((entry) => entry.status === "failed");
        if (failed) {
          toast.warning(failed.message ?? "Queued locally, but sync still needs attention.");
        } else {
          toast.success("Response synced successfully.");
        }
      }

      router.replace("/app/employee/campaigns");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the campaign response.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  if (!pkg) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This campaign is not cached on this device yet. Open the field link while online once so
          it can be stored for offline use.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                Employee collection
              </div>
              <h3 className="mt-3 text-2xl font-semibold">{pkg.assignment.label}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{pkg.campaign.purpose}</p>
            </div>
            <Button
              variant="secondary"
              type="button"
              onClick={async () => {
                if (!token) {
                  return;
                }

                await navigator.clipboard.writeText(`${window.location.origin}/field/${token}`);
                toast.success("Field link copied.");
              }}
              disabled={!token}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
          </div>

          <div className="rounded-[1.75rem] bg-teal-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Location validation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unlock and submit from inside the {pkg.assignment.geofenceRadiusMeters ?? 1000} m
                  campaign radius. GPS is checked twice.
                </p>
              </div>
              <Button type="button" onClick={unlockAssignment} disabled={isResolvingLocation}>
                <MapPin className="mr-2 h-4 w-4" />
                {unlockGeo?.withinRange ? "Refresh location" : "Check live location"}
              </Button>
            </div>

            {unlockGeo ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Distance</p>
                  <p className="mt-2 text-2xl font-bold">{unlockGeo.distanceMeters ?? 0} m</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Accuracy</p>
                  <p className="mt-2 text-2xl font-bold">{Math.round(unlockGeo.accuracy ?? 0)} m</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/45">Status</p>
                  <p className="mt-2 text-base font-semibold">
                    {unlockGeo.withinRange ? "Inside radius" : "Outside radius"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Respondent name</Label>
              <Input value={respondentName} onChange={(event) => setRespondentName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Respondent email</Label>
              <Input value={respondentEmail} onChange={(event) => setRespondentEmail(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Respondent phone</Label>
              <Input value={respondentPhone} onChange={(event) => setRespondentPhone(event.target.value)} />
            </div>
          </div>

          <div className="space-y-6">
            {pkg.version.sections.map((section) => (
              <div key={section.id} className="space-y-4 rounded-[1.5rem] border border-black/5 p-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black/45">
                    {section.title}
                  </p>
                  {section.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  ) : null}
                </div>

                <div className="grid gap-4">
                  {section.questions.map((question) => {
                    const value = answers[question.key];

                    if (question.type === "long_text") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.prompt}</Label>
                          <Textarea
                            value={typeof value === "string" ? value : ""}
                            onChange={(event) => updateAnswer(question.key, event.target.value)}
                          />
                          {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                        </div>
                      );
                    }

                    if (question.type === "number") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.prompt}</Label>
                          <Input
                            type="number"
                            value={typeof value === "number" ? value : ""}
                            onChange={(event) =>
                              updateAnswer(
                                question.key,
                                event.target.value === "" ? "" : Number(event.target.value)
                              )
                            }
                          />
                          {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                        </div>
                      );
                    }

                    if (question.type === "single_select") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.prompt}</Label>
                          <select
                            value={typeof value === "string" ? value : ""}
                            onChange={(event) => updateAnswer(question.key, event.target.value)}
                            className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
                          >
                            <option value="">Select an option</option>
                            {question.options?.map((option) => (
                              <option key={option.id} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                        </div>
                      );
                    }

                    if (question.type === "multi_select") {
                      const selected = Array.isArray(value) ? value : [];
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.prompt}</Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {question.options?.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.includes(option.value)}
                                  onChange={(event) =>
                                    updateAnswer(
                                      question.key,
                                      event.target.checked
                                        ? [...selected, option.value]
                                        : selected.filter((item) => item !== option.value)
                                    )
                                  }
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                        </div>
                      );
                    }

                    if (question.type === "boolean") {
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label>{question.prompt}</Label>
                          <label className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) => updateAnswer(question.key, event.target.checked)}
                            />
                            Yes
                          </label>
                        </div>
                      );
                    }

                    if (question.type === "rating") {
                      const ratingValue = typeof value === "number" ? value : 0;
                      return (
                        <div key={question.id} className="space-y-3">
                          <Label>{question.prompt}</Label>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(
                              { length: (question.ratingScale?.max ?? 5) - (question.ratingScale?.min ?? 1) + 1 },
                              (_, index) => (question.ratingScale?.min ?? 1) + index
                            ).map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => updateAnswer(question.key, score)}
                                className={`h-11 w-11 rounded-full border text-sm font-semibold transition ${
                                  ratingValue === score
                                    ? "border-teal-600 bg-teal-600 text-white"
                                    : "border-black/10 bg-white text-black/70"
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                          {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                        </div>
                      );
                    }

                    return (
                      <div key={question.id} className="space-y-2">
                        <Label>{question.prompt}</Label>
                        <Input
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => updateAnswer(question.key, event.target.value)}
                        />
                        {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.5rem] border border-black/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Respondent photo verification</p>
                <p className="text-sm text-muted-foreground">
                  Capture a respondent photo to complete the field evidence pack.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
                <Camera className="h-4 w-4" />
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void onPhotoSelected(event.target.files?.[0])}
                />
              </label>
            </div>
            {photoPreviewUrl ? (
              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-black/5">
                <Image
                  src={photoPreviewUrl}
                  alt="Respondent preview"
                  width={1200}
                  height={800}
                  className="h-72 w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <Button type="button" onClick={submitResponse} disabled={isResolvingLocation}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isResolvingLocation ? "Submitting..." : "Queue verified response"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h3 className="text-xl font-semibold">Assignment snapshot</h3>
              <p className="text-sm text-muted-foreground">
                Campaign: {pkg.campaign.name}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-black/5 p-4">
              <p className="text-sm text-muted-foreground">Total questions</p>
              <p className="mt-2 text-2xl font-semibold">{totalQuestions}</p>
            </div>
            <div className="rounded-[1.5rem] bg-black/5 p-4">
              <p className="text-sm text-muted-foreground">Scope</p>
              <p className="mt-2 text-base font-semibold">
                {[pkg.assignment.scope?.district, pkg.assignment.scope?.block, pkg.assignment.scope?.cluster]
                  .filter(Boolean)
                  .join(" / ") || "General field collection"}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-black/5 p-4">
              <p className="text-sm text-muted-foreground">Sync mode</p>
              <p className="mt-2 text-base font-semibold">
                {isOnline ? "Online, sync available" : "Offline, queue only"}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void syncCampaignQueue(session)}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry queued sync
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
