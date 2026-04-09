import "server-only";

import { env } from "@/lib/env";
import type { CampaignSection } from "@/types/campaign";

import {
  campaignDraftRequestSchema,
  parseAiSections,
  normalizeQuestionDrafts
} from "@/lib/campaigns/schemas";

function buildFallbackSections(input: {
  name: string;
  purpose: string;
  targetAudience: string;
  collectionMode: "employee_only" | "public_only" | "hybrid";
}) {
  const introQuestions: CampaignSection["questions"] = [
    {
      id: "question_participant_name",
      key: "participant_name",
      prompt: "What is the participant's name?",
      description: "Keep this optional when anonymous participation is acceptable.",
      type: "short_text",
      required: false
    },
    {
      id: "question_context_location",
      key: "context_location",
      prompt:
        input.collectionMode === "public_only"
          ? "Which location, product, or experience are you responding about?"
          : "Which location or collection context is this response associated with?",
      type: "short_text",
      required: true
    }
  ];

  const feedbackQuestions: CampaignSection["questions"] = [
    {
      id: "question_overall_rating",
      key: "overall_rating",
      prompt: `How would you rate the overall ${input.name.toLowerCase()} experience?`,
      type: "rating",
      required: true,
      ratingScale: {
        min: 1,
        max: 5,
        minLabel: "Low",
        maxLabel: "High"
      }
    },
    {
      id: "question_primary_reason",
      key: "primary_reason",
      prompt: `What is the main reason behind your rating for ${input.targetAudience}?`,
      type: "long_text",
      required: true
    },
    {
      id: "question_improvement_areas",
      key: "improvement_areas",
      prompt: "Which areas should improve?",
      type: "multi_select",
      required: false,
      options: [
        { id: "speed", label: "Speed", value: "speed" },
        { id: "quality", label: "Quality", value: "quality" },
        { id: "support", label: "Support", value: "support" },
        { id: "accessibility", label: "Accessibility", value: "accessibility" }
      ]
    }
  ];

  const outcomeQuestions: CampaignSection["questions"] = [
    {
      id: "question_recommend",
      key: "would_recommend",
      prompt: "Would you recommend this experience to others?",
      type: "single_select",
      required: true,
      options: [
        { id: "yes", label: "Yes", value: "yes" },
        { id: "no", label: "No", value: "no" },
        { id: "maybe", label: "Maybe", value: "maybe" }
      ]
    },
    {
      id: "question_followup",
      key: "followup_requested",
      prompt: "Would you like a follow-up from the organization?",
      type: "boolean",
      required: false
    },
    {
      id: "question_final_notes",
      key: "final_notes",
      prompt: `What else should the organization learn from this ${input.purpose.toLowerCase()}?`,
      type: "long_text",
      required: false
    }
  ];

  return [
    {
      id: "section_participant_context",
      title: "Participant context",
      description: "Collect enough context to interpret the response later.",
      questions: introQuestions
    },
    {
      id: "section_feedback",
      title: "Core feedback",
      description: "Measure sentiment and capture the primary driver behind it.",
      questions: feedbackQuestions
    },
    {
      id: "section_next_steps",
      title: "Next steps",
      description: "Close with recommendation and any follow-up request.",
      questions: outcomeQuestions
    }
  ];
}

function extractGeminiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const parts = (candidate as { content?: { parts?: unknown[] } }).content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string" &&
        (part as { text: string }).text.trim()
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

function buildDraftPrompt(input: {
  name: string;
  purpose: string;
  targetAudience: string;
  description?: string;
  collectionMode: "employee_only" | "public_only" | "hybrid";
  district?: string;
  block?: string;
  cluster?: string;
}) {
  return `Campaign name: ${input.name}
Purpose: ${input.purpose}
Target audience: ${input.targetAudience}
Collection mode: ${input.collectionMode}
Location: ${input.district ?? "n/a"} / ${input.block ?? "n/a"} / ${input.cluster ?? "n/a"}
Additional context: ${input.description ?? "n/a"}

Generate 2-4 sections with practical questions for a business-facing census application. Prefer short, structured, high-signal questions.

Return JSON only using this shape:
{
  "sections": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "questions": [
        {
          "id": "string",
          "key": "string",
          "prompt": "string",
          "description": "string",
          "type": "short_text|long_text|number|single_select|multi_select|boolean|date|rating",
          "required": true,
          "options": [{ "id": "string", "label": "string", "value": "string" }],
          "ratingScale": { "min": 1, "max": 5, "minLabel": "Low", "maxLabel": "High" }
        }
      ]
    }
  ]
}`;
}

type DraftProviderResult = {
  sections: CampaignSection[] | null;
  error?: string;
};

type GeminiProviderConfig = {
  geminiApiKey?: string;
  geminiModel?: string;
};

const RETRYABLE_GEMINI_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const GEMINI_RETRY_DELAYS_MS = [400, 1200];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractGeminiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  if (!error || typeof error !== "object" || typeof error.message !== "string") {
    return null;
  }

  return error.message.trim() || null;
}

function parseRetryDelayMs(payload: unknown, response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const details = (payload as { error?: { details?: unknown[] } }).error?.details;
  if (!Array.isArray(details)) {
    return null;
  }

  for (const detail of details) {
    if (!detail || typeof detail !== "object") {
      continue;
    }

    const retryDelay = (detail as { retryDelay?: unknown }).retryDelay;
    if (typeof retryDelay !== "string") {
      continue;
    }

    const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
    if (!match) {
      continue;
    }

    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }
  }

  return null;
}

function buildGeminiModelCandidates(model: string) {
  const primaryModel = model.trim() || "gemini-2.5-flash";
  const candidates = [primaryModel];

  if (env.geminiModel && env.geminiModel !== primaryModel) {
    candidates.push(env.geminiModel);
  }

  if (primaryModel === "gemini-2.5-pro") {
    candidates.push("gemini-2.5-flash");
  }

  if (primaryModel === "gemini-2.5-flash") {
    candidates.push("gemini-2.5-flash-lite");
  }

  return [...new Set(candidates)];
}

async function requestGeminiDraft(input: {
  name: string;
  purpose: string;
  targetAudience: string;
  description?: string;
  collectionMode: "employee_only" | "public_only" | "hybrid";
  district?: string;
  block?: string;
  cluster?: string;
}, providerConfig?: GeminiProviderConfig): Promise<DraftProviderResult> {
  const geminiApiKey = providerConfig?.geminiApiKey ?? env.geminiApiKey;
  const geminiModel = providerConfig?.geminiModel ?? env.geminiModel;

  if (!geminiApiKey) {
    return {
      sections: null,
      error: "Gemini AI is not configured on the server."
    };
  }

  const modelCandidates = buildGeminiModelCandidates(geminiModel);
  let lastError = "Gemini AI is unavailable right now.";

  for (const model of modelCandidates) {
    for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [
                  {
                    text:
                      "You generate concise, production-ready survey sections and questions for structured census campaigns. Return valid JSON only."
                  }
                ]
              },
              contents: [
                {
                  parts: [{ text: buildDraftPrompt(input) }]
                }
              ],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.4
              }
            })
          }
        );
      } catch {
        lastError = "Gemini AI request failed before a response was received.";

        if (attempt < GEMINI_RETRY_DELAYS_MS.length) {
          await sleep(GEMINI_RETRY_DELAYS_MS[attempt] ?? 0);
          continue;
        }

        break;
      }

      let payload: unknown;

      try {
        payload = (await response.json()) as unknown;
      } catch {
        if (!response.ok) {
          lastError = `Gemini AI request failed with status ${response.status}.`;
        } else {
          lastError = "Gemini AI returned an unreadable response.";
        }

        break;
      }

      if (!response.ok) {
        const providerMessage = extractGeminiErrorMessage(payload);
        lastError = providerMessage
          ? `Gemini AI request failed with status ${response.status}: ${providerMessage}`
          : `Gemini AI request failed with status ${response.status}.`;

        if (
          RETRYABLE_GEMINI_STATUS_CODES.has(response.status) &&
          attempt < GEMINI_RETRY_DELAYS_MS.length
        ) {
          const retryDelayMs =
            parseRetryDelayMs(payload, response) ?? GEMINI_RETRY_DELAYS_MS[attempt] ?? 0;
          await sleep(retryDelayMs);
          continue;
        }

        break;
      }

      const text = extractGeminiResponseText(payload);
      if (!text) {
        return {
          sections: null,
          error: "Gemini AI returned an empty draft."
        };
      }

      try {
        const parsed = JSON.parse(text) as { sections?: unknown };
        const sections = parseAiSections(parsed.sections);

        if (!sections) {
          return {
            sections: null,
            error: "Gemini AI returned a draft that did not match the campaign schema."
          };
        }

        return { sections };
      } catch {
        return {
          sections: null,
          error: "Gemini AI returned invalid JSON."
        };
      }
    }
  }

  return {
    sections: null,
    error: lastError
  };
}

export async function generateCampaignDraft(
  input: unknown,
  providerConfig?: GeminiProviderConfig
) {
  const parsed = campaignDraftRequestSchema.parse(input);
  const aiResult = await requestGeminiDraft(parsed, providerConfig).catch<DraftProviderResult>(
    () => ({
      sections: null,
      error: "Gemini AI request failed unexpectedly."
    })
  );
  const usedFallback = !aiResult.sections;
  const sections = normalizeQuestionDrafts(aiResult.sections ?? buildFallbackSections(parsed));
  const fallbackMessage = usedFallback
    ? `${aiResult.error ?? "Gemini AI is unavailable."} Using a built-in draft template instead.`
    : undefined;

  return {
    sections,
    source: aiResult.sections ? "gemini" : "fallback",
    summary: `${parsed.collectionMode.replaceAll("_", " ")} draft for ${parsed.targetAudience}`,
    message: fallbackMessage
  };
}
