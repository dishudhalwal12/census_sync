"use client";

import { useState } from "react";
import { KeyRound, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GeminiSettingsClient({
  initialHasCustomGeminiApiKey,
  initialGeminiApiKeyPreview,
  initialGeminiModel
}: {
  initialHasCustomGeminiApiKey: boolean;
  initialGeminiApiKeyPreview: string | null;
  initialGeminiModel: string;
}) {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState(initialGeminiModel);
  const [hasCustomGeminiApiKey, setHasCustomGeminiApiKey] = useState(
    initialHasCustomGeminiApiKey
  );
  const [geminiApiKeyPreview, setGeminiApiKeyPreview] = useState(
    initialGeminiApiKeyPreview
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  async function savePersonalKey() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/gemini", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          geminiApiKey,
          geminiModel
        })
      });

      const payload = (await response.json()) as {
        hasCustomGeminiApiKey?: boolean;
        geminiApiKeyPreview?: string | null;
        geminiModel?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to save your Gemini API key.");
      }

      setHasCustomGeminiApiKey(Boolean(payload.hasCustomGeminiApiKey));
      setGeminiApiKeyPreview(payload.geminiApiKeyPreview ?? null);
      setGeminiModel(payload.geminiModel ?? initialGeminiModel);
      setGeminiApiKey("");
      toast.success(payload.message ?? "Personal Gemini API key saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your Gemini API key.");
    } finally {
      setIsSaving(false);
    }
  }

  async function clearPersonalKey() {
    setIsClearing(true);

    try {
      const response = await fetch("/api/settings/gemini", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clear: true
        })
      });

      const payload = (await response.json()) as {
        hasCustomGeminiApiKey?: boolean;
        geminiApiKeyPreview?: string | null;
        geminiModel?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to clear your Gemini API key.");
      }

      setHasCustomGeminiApiKey(Boolean(payload.hasCustomGeminiApiKey));
      setGeminiApiKeyPreview(payload.geminiApiKeyPreview ?? null);
      setGeminiModel(payload.geminiModel ?? initialGeminiModel);
      setGeminiApiKey("");
      toast.success(payload.message ?? "Personal Gemini API key removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear your Gemini API key.");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-4">
          <KeyRound className="mt-1 h-10 w-10 text-lavender-500" />
          <div>
            <h3 className="text-xl font-semibold">Bring Your Own Gemini API key</h3>
            <p className="text-sm text-muted-foreground">
              Save your own Gemini key here so AI draft generation can keep working even when the
              shared workspace key hits its quota.
            </p>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-lavender-50 p-4 text-sm text-muted-foreground">
          {hasCustomGeminiApiKey
            ? `Personal key active: ${geminiApiKeyPreview ?? "Saved"}`
            : "No personal Gemini key saved yet. The shared workspace key will be used."}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="gemini-api-key">Gemini API key</Label>
            <Input
              id="gemini-api-key"
              type="password"
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
              placeholder="Paste your Gemini API key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-model">Gemini model</Label>
            <Input
              id="gemini-model"
              value={geminiModel}
              onChange={(event) => setGeminiModel(event.target.value)}
              placeholder="gemini-2.5-flash"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={savePersonalKey} disabled={isSaving || !geminiApiKey.trim()}>
            {isSaving ? "Saving..." : "Save personal Gemini key"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={clearPersonalKey}
            disabled={isClearing || !hasCustomGeminiApiKey}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {isClearing ? "Clearing..." : "Use shared workspace key"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
