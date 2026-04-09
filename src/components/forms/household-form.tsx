"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getDraft, queueSubmission, saveDraft, syncQueue } from "@/lib/offline/service";
import {
  householdFormSchema,
  type HouseholdFormValues
} from "@/lib/validators/household";
import type { AuthSession } from "@/types/session";

const COPY = {
  en: {
    outcomeHint: "Choose the visit outcome. If the survey could not be completed, member and housing details become optional.",
    voice: "Voice input",
    consent: "Consent capture",
    language: "Form language"
  },
  hi: {
    outcomeHint: "भ्रमण का परिणाम चुनें। यदि सर्वे पूरा नहीं हो पाया तो सदस्य और आवास विवरण वैकल्पिक हो जाएंगे।",
    voice: "वॉइस इनपुट",
    consent: "सहमति कैप्चर",
    language: "फॉर्म भाषा"
  }
} as const;

const steps = [
  { id: "household", label: "Household" },
  { id: "members", label: "Members" },
  { id: "housing", label: "Housing" },
  { id: "review", label: "Review" }
];

export function HouseholdForm({
  session,
  existingHouseholdIds,
  initialValues
}: {
  session: AuthSession;
  existingHouseholdIds: string[];
  initialValues: HouseholdFormValues;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get("draft");
  const isOnline = useOnlineStatus();
  const [step, setStep] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const lastSerializedRef = useRef("");

  const draftQuery = useQuery({
    queryKey: ["draft", draftId ?? "new"],
    enabled: Boolean(draftId),
    queryFn: async () => {
      if (!draftId) {
        return null;
      }

      return (await getDraft(draftId, session.uid)) ?? null;
    }
  });

  const form = useForm<HouseholdFormValues>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: initialValues,
    mode: "onBlur"
  });

  const members = useFieldArray({
    control: form.control,
    name: "members"
  });

  useEffect(() => {
    if (draftQuery.data?.data) {
      form.reset(draftQuery.data.data);
      return;
    }

    if (!draftId) {
      form.reset(initialValues);
    }
  }, [draftId, draftQuery.data, form, initialValues]);

  const watchedValues = form.watch();
  const language = form.watch("language");
  const copy = COPY[language];
  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const duplicateDetected = useMemo(
    () => watchedValues.householdId && existingHouseholdIds.includes(watchedValues.householdId),
    [existingHouseholdIds, watchedValues.householdId]
  );

  useEffect(() => {
    const serialized = JSON.stringify(watchedValues);
    if (serialized === lastSerializedRef.current) {
        return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveDraft(watchedValues, session.uid);
        lastSerializedRef.current = serialized;
        setLastSavedAt(new Date().toISOString());
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [session.uid, watchedValues]);

  async function captureGeo() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("geoEnabled", true);
        form.setValue("geo", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString()
        });
        toast.success("Geo-tag attached to this household record.");
      },
      () => {
        toast.warning("Location capture was skipped. The form can still be submitted.");
      },
      { enableHighAccuracy: true, timeout: 8_000 }
    );
  }

  async function onSubmit(values: HouseholdFormValues) {
    try {
      if (values.projectId === "project-unassigned" || values.templateVersionId === "template-unassigned") {
        toast.error("Your account is not assigned to an active field project yet.");
        return;
      }

      await queueSubmission(values, session);
      toast.success("Submission queued locally.");

      if (isOnline) {
        await syncQueue(session);
        toast.success("Background sync started.");
      }

      router.replace("/app/enumerator/drafts");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the submission.");
    }
  }

  function startVoiceInput(target: "headOfHousehold" | "addressLine1" | "notes") {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as typeof window & {
            SpeechRecognition?: new () => {
              lang: string;
              interimResults: boolean;
              maxAlternatives: number;
              onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
              onerror: (() => void) | null;
              start: () => void;
            };
            webkitSpeechRecognition?: new () => {
              lang: string;
              interimResults: boolean;
              maxAlternatives: number;
              onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
              onerror: (() => void) | null;
              start: () => void;
            };
          }).SpeechRecognition ||
          (window as typeof window & { webkitSpeechRecognition?: new () => {
            lang: string;
            interimResults: boolean;
            maxAlternatives: number;
            onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
            onerror: (() => void) | null;
            start: () => void;
          } }).webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      toast.warning("Voice input is not available on this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        form.setValue(target, transcript, { shouldValidate: true });
      }
    };
    recognition.onerror = () => {
      toast.warning("Voice input could not capture speech. You can continue typing manually.");
    };
    recognition.start();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {steps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    step === index ? "bg-lavender-100" : "bg-black/5"
                  }`}
                  onClick={() => setStep(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={language}
                onChange={(event) =>
                  form.setValue("language", event.target.value as HouseholdFormValues["language"])
                }
                className="h-10 rounded-full border border-black/10 bg-white px-4 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <div className="text-sm text-muted-foreground">
                {isSaving
                  ? "Saving draft..."
                  : lastSavedAt
                    ? `Autosaved ${new Date(lastSavedAt).toLocaleTimeString()}`
                    : "Autosave enabled"}
              </div>
            </div>
          </div>

          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            {step === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{copy.language}</Label>
                  <p className="text-sm text-muted-foreground">{copy.outcomeHint}</p>
                </div>
                <div className="space-y-2">
                  <Label>Household ID</Label>
                  <Input placeholder="SD-BA-0007" {...form.register("householdId")} />
                  {duplicateDetected ? (
                    <p className="text-sm text-amber-600">
                      This household ID already exists in the synced dataset. Review carefully before submit.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Head of household</Label>
                  <Input placeholder="Enter full name" {...form.register("headOfHousehold")} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => startVoiceInput("headOfHousehold")}
                  >
                    {copy.voice}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input placeholder="Optional" {...form.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label>Address line 1</Label>
                  <Input placeholder="Street and locality" {...form.register("addressLine1")} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => startVoiceInput("addressLine1")}
                  >
                    {copy.voice}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Address line 2</Label>
                  <Input placeholder="Landmark or notes" {...form.register("addressLine2")} />
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Input {...form.register("district")} />
                </div>
                <div className="space-y-2">
                  <Label>Block</Label>
                  <Input {...form.register("block")} />
                </div>
                <div className="space-y-2">
                  <Label>Cluster / Ward</Label>
                  <Input {...form.register("cluster")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Visit outcome</Label>
                  <select
                    value={form.watch("visitOutcome")}
                    onChange={(event) =>
                      form.setValue(
                        "visitOutcome",
                        event.target.value as HouseholdFormValues["visitOutcome"]
                      )
                    }
                    className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
                  >
                    <option value="survey_completed">Survey completed</option>
                    <option value="house_locked">House locked</option>
                    <option value="respondent_unavailable">Respondent unavailable</option>
                    <option value="invalid_address">Invalid address</option>
                    <option value="duplicate_household">Duplicate household</option>
                    <option value="revisit_needed">Revisit needed</option>
                    <option value="refused">Refused</option>
                  </select>
                  <p className="text-sm text-muted-foreground">{copy.outcomeHint}</p>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                {members.fields.map((field, index) => (
                  <div key={field.id} className="rounded-[1.75rem] border border-black/5 bg-lavender-50 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Member {index + 1}</h3>
                      {members.fields.length > 1 ? (
                        <button
                          type="button"
                          className="text-sm font-semibold text-rose-600"
                          onClick={() => members.remove(index)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input placeholder="Full name" {...form.register(`members.${index}.fullName`)} />
                      <Input placeholder="Relationship" {...form.register(`members.${index}.relationship`)} />
                      <Input type="number" placeholder="Age" {...form.register(`members.${index}.age`, { valueAsNumber: true })} />
                      <Input placeholder="Gender" {...form.register(`members.${index}.gender` as const)} />
                      <Input placeholder="Occupation" {...form.register(`members.${index}.occupation`)} />
                      <Input placeholder="Education level" {...form.register(`members.${index}.educationLevel`)} />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    members.append({
                      id: `member-${Date.now()}`,
                      fullName: "",
                      relationship: "",
                      age: 0,
                      gender: "prefer_not_to_say",
                      occupation: "",
                      educationLevel: "",
                      disabilityStatus: ""
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add member
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Input placeholder="Dwelling type" {...form.register("housing.dwellingType")} />
                <Input placeholder="Ownership status" {...form.register("housing.ownershipStatus")} />
                <Input type="number" placeholder="Rooms" {...form.register("housing.rooms", { valueAsNumber: true })} />
                <Input placeholder="Drinking water source" {...form.register("housing.drinkingWaterSource")} />
                <Input placeholder="Sanitation type" {...form.register("housing.sanitationType")} />
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <Label className="flex items-center gap-3">
                    <input type="checkbox" {...form.register("housing.electricityAvailable")} />
                    Electricity available
                  </Label>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <Label className="flex items-center gap-3">
                    <input type="checkbox" {...form.register("housing.internetAvailable")} />
                    Internet available
                  </Label>
                </div>
                <div className="md:col-span-2">
                  <Textarea placeholder="Enumerator notes" {...form.register("notes")} />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => startVoiceInput("notes")}
                  >
                    {copy.voice}
                  </Button>
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" onClick={captureGeo}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Capture geo-tag
                  </Button>
                  {form.watch("geo") ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {form.watch("geo")?.latitude.toFixed(3)}, {form.watch("geo")?.longitude.toFixed(3)}
                    </span>
                  ) : null}
                </div>
                <div className="md:col-span-2 rounded-[1.5rem] border border-black/5 bg-white p-4">
                  <div className="space-y-2">
                    <Label>{copy.consent}</Label>
                    <select
                      value={form.watch("consent")?.mode ?? ""}
                      onChange={(event) => {
                        if (!event.target.value) {
                          form.setValue("consent", undefined);
                          return;
                        }

                        form.setValue("consent", {
                          mode: event.target.value as NonNullable<HouseholdFormValues["consent"]>["mode"],
                          capturedAt: new Date().toISOString(),
                          collectorName: session.name,
                          acknowledged: true
                        });
                      }}
                      className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
                    >
                      <option value="">No consent recorded</option>
                      <option value="verbal">Verbal</option>
                      <option value="written">Written</option>
                      <option value="signature">Signature</option>
                      <option value="photo_acknowledged">Photo acknowledged</option>
                    </select>
                    {form.watch("consent") ? (
                      <p className="text-sm text-muted-foreground">
                        Consent recorded by {session.name} via {form.watch("consent")?.mode.replaceAll("_", " ")}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4 rounded-[1.75rem] bg-lavender-50 p-6">
                <h3 className="text-xl font-semibold">Review before queueing</h3>
                <p className="text-sm text-muted-foreground">
                  Submit now to store locally and queue for background sync. The record will continue
                  to work offline even if connectivity drops after submission.
                </p>
                <ul className="space-y-2 text-sm text-black/70">
                  <li>Household ID: {form.watch("householdId") || "Pending"}</li>
                  <li>Members: {form.watch("members").length}</li>
                  <li>Scope: {form.watch("district")} / {form.watch("block")}</li>
                  <li>Visit outcome: {form.watch("visitOutcome").replaceAll("_", " ")}</li>
                  <li>Language: {form.watch("language") === "hi" ? "Hindi" : "English"}</li>
                  <li>
                    Consent:{" "}
                    {form.watch("consent")?.mode
                      ? form.watch("consent")?.mode.replaceAll("_", " ")
                      : "Not recorded"}
                  </li>
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3">
              <Button type="button" variant="secondary" asChild>
                <Link href="/app/enumerator/drafts">
                  <Save className="mr-2 h-4 w-4" />
                  Open drafts
                </Link>
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
                  Back
                </Button>
                {step < steps.length - 1 ? (
                  <Button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
                    Continue
                  </Button>
                ) : (
                  <Button type="submit">Queue household submission</Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
              Progress summary
            </p>
            <div className="mt-4 h-3 rounded-full bg-black/5">
              <div className="h-3 rounded-full bg-lavender-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{Math.round(progress)}% complete</p>
            <div className="mt-5 space-y-3">
              {steps.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${index <= step ? "bg-lavender-400" : "bg-black/15"}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
              Local-first behavior
            </p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Autosave runs while you work.</li>
              <li>Queued submissions retry whenever the device reconnects.</li>
              <li>Geo-tagging is optional and can be skipped safely.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
