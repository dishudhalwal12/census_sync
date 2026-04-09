"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateCampaignAnswers } from "@/lib/campaigns/schemas";
import type { PublicCampaignPackage } from "@/types/campaign";

function createEmptyAnswers(pkg: PublicCampaignPackage) {
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

export function PublicCampaignForm({
  pkg,
  token
}: {
  pkg: PublicCampaignPackage;
  token: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => createEmptyAnswers(pkg));
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [respondentPhone, setRespondentPhone] = useState("");
  const [submitGeo, setSubmitGeo] = useState<{
    latitude: number;
    longitude: number;
    capturedAt: string;
    accuracy?: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateAnswer(key: string, value: unknown) {
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("Location access is not available on this device.");
      return;
    }

    setIsCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSubmitGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString()
        });
        toast.success("Submission location attached.");
        setIsCapturingLocation(false);
      },
      () => {
        toast.warning("Location permission was skipped. You can still submit without it.");
        setIsCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function submitResponse() {
    const validationErrors = validateCampaignAnswers(pkg.version.sections, answers);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      toast.error("Complete the required questions before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/public/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          respondentName,
          respondentEmail,
          respondentPhone,
          answers,
          submitGeo: submitGeo ?? undefined,
          submissionMeta: {
            userAgent: navigator.userAgent,
            locale: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to submit the response.");
      }

      toast.success("Response submitted successfully.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit the response.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div>
          <div className="inline-flex rounded-full bg-butter-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Public participation
          </div>
          <h2 className="mt-3 text-3xl font-semibold">{pkg.campaign.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pkg.campaign.purpose}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Your name</Label>
            <Input value={respondentName} onChange={(event) => setRespondentName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Your email</Label>
            <Input value={respondentEmail} onChange={(event) => setRespondentEmail(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Your phone</Label>
            <Input value={respondentPhone} onChange={(event) => setRespondentPhone(event.target.value)} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-black/5 bg-white/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-600" />
                <p className="font-semibold">Optional submission location</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow location to store where this public form was filled. Admins can review it in analytics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={captureLocation}
                disabled={isCapturingLocation}
              >
                <LocateFixed className="mr-2 h-4 w-4" />
                {isCapturingLocation ? "Capturing..." : submitGeo ? "Refresh location" : "Allow location"}
              </Button>
              {submitGeo ? (
                <Button type="button" variant="ghost" onClick={() => setSubmitGeo(null)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {submitGeo ? (
            <div className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-muted-foreground">
              Captured at {submitGeo.latitude.toFixed(5)}, {submitGeo.longitude.toFixed(5)}
              {typeof submitGeo.accuracy === "number"
                ? ` with ±${Math.round(submitGeo.accuracy)}m accuracy`
                : ""}
            </div>
          ) : null}
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
                                  ? "border-amber-500 bg-amber-500 text-white"
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

                  return (
                    <div key={question.id} className="space-y-2">
                      <Label>{question.prompt}</Label>
                      <Input
                        type={question.type === "date" ? "date" : question.type === "number" ? "number" : "text"}
                        value={typeof value === "string" || typeof value === "number" ? value : ""}
                        onChange={(event) =>
                          updateAnswer(
                            question.key,
                            question.type === "number"
                              ? event.target.value === ""
                                ? ""
                                : Number(event.target.value)
                              : event.target.value
                          )
                        }
                      />
                      {errors[question.key] ? <p className="text-sm text-rose-500">{errors[question.key]}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" onClick={submitResponse} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit response"}
        </Button>
      </CardContent>
    </Card>
  );
}
