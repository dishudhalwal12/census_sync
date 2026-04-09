import { z } from "zod";

import type {
  CampaignQuestion,
  CampaignSection,
  CampaignQuestionType
} from "@/types/campaign";

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1)
});

const ratingScaleSchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(2),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional()
});

export const campaignQuestionSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  prompt: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "single_select",
    "multi_select",
    "boolean",
    "date",
    "rating"
  ]),
  required: z.boolean(),
  options: z.array(optionSchema).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional()
    })
    .optional(),
  ratingScale: ratingScaleSchema.optional()
});

export const campaignSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(campaignQuestionSchema).min(1)
});

export const campaignDraftRequestSchema = z.object({
  name: z.string().min(2),
  purpose: z.string().min(8),
  targetAudience: z.string().min(3),
  description: z.string().optional(),
  collectionMode: z.enum(["employee_only", "public_only", "hybrid"]),
  district: z.string().optional(),
  block: z.string().optional(),
  cluster: z.string().optional()
});

export const campaignCreateSchema = campaignDraftRequestSchema.extend({
  campaignId: z.string().optional(),
  versionLabel: z.string().optional(),
  geofenceCenter: z
    .object({
      latitude: z.number(),
      longitude: z.number()
    })
    .optional(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
  employeeId: z.string().optional(),
  sections: z.array(campaignSectionSchema).min(1)
});

export const campaignLinkCreateSchema = z.object({
  campaignId: z.string().min(1),
  type: z.enum(["employee", "public"]),
  campaignVersionId: z.string().optional(),
  assignmentId: z.string().optional(),
  employeeId: z.string().optional()
});

export const publicCampaignResponseSchema = z.object({
  token: z.string().min(1),
  answers: z.record(z.string(), z.unknown()),
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional().or(z.literal("")),
  respondentPhone: z.string().optional(),
  submitGeo: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      capturedAt: z.string(),
      accuracy: z.number().optional(),
      distanceMeters: z.number().optional(),
      withinRange: z.boolean().optional()
    })
    .optional(),
  submissionMeta: z
    .object({
      userAgent: z.string().optional(),
      locale: z.string().optional(),
      timezone: z.string().optional()
    })
    .optional()
});

export const employeeCampaignResponseSchema = z.object({
  token: z.string().min(1),
  assignmentId: z.string().min(1),
  answers: z.record(z.string(), z.unknown()),
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional().or(z.literal("")),
  respondentPhone: z.string().optional(),
  unlockGeo: z.object({
    latitude: z.number(),
    longitude: z.number(),
    capturedAt: z.string(),
    accuracy: z.number().optional(),
    distanceMeters: z.number().optional(),
    withinRange: z.boolean().optional()
  }),
  submitGeo: z.object({
    latitude: z.number(),
    longitude: z.number(),
    capturedAt: z.string(),
    accuracy: z.number().optional(),
    distanceMeters: z.number().optional(),
    withinRange: z.boolean().optional()
  })
});

function isEmptyAnswer(value: unknown, type: CampaignQuestionType) {
  if (type === "boolean") {
    return value !== true && value !== false;
  }

  if (type === "multi_select") {
    return !Array.isArray(value) || value.length === 0;
  }

  return value === null || value === undefined || value === "";
}

export function validateCampaignAnswers(
  sections: CampaignSection[],
  answers: Record<string, unknown>
) {
  const issues: Record<string, string> = {};

  for (const section of sections) {
    for (const question of section.questions) {
      const value = answers[question.key];

      if (question.required && isEmptyAnswer(value, question.type)) {
        issues[question.key] = "This question is required.";
        continue;
      }

      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (question.type === "number" || question.type === "rating") {
        if (typeof value !== "number" || Number.isNaN(value)) {
          issues[question.key] = "Enter a valid number.";
          continue;
        }

        const min = question.type === "rating" ? question.ratingScale?.min : question.validation?.min;
        const max = question.type === "rating" ? question.ratingScale?.max : question.validation?.max;

        if (typeof min === "number" && value < min) {
          issues[question.key] = `Value must be at least ${min}.`;
        } else if (typeof max === "number" && value > max) {
          issues[question.key] = `Value must be at most ${max}.`;
        }
      }

      if (question.type === "single_select") {
        const allowed = new Set(question.options?.map((option) => option.value) ?? []);
        if (typeof value !== "string" || !allowed.has(value)) {
          issues[question.key] = "Select a valid option.";
        }
      }

      if (question.type === "multi_select") {
        const allowed = new Set(question.options?.map((option) => option.value) ?? []);
        if (
          !Array.isArray(value) ||
          value.some((item) => typeof item !== "string" || !allowed.has(item))
        ) {
          issues[question.key] = "Select valid options.";
        }
      }
    }
  }

  return issues;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseAiSections(input: unknown): CampaignSection[] | null {
  const parsed = z.array(campaignSectionSchema).safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }

  return null;
}

export function normalizeAiSections(input: unknown): CampaignSection[] {
  const parsed = parseAiSections(input);
  if (parsed) {
    return parsed;
  }

  return [
    {
      id: "section-primary",
      title: "Survey questions",
      description: "Fallback question set generated from the campaign brief.",
      questions: [
        {
          id: "question_overall_feedback",
          key: "overall_feedback",
          prompt: "What feedback would you like to share?",
          type: "long_text",
          required: true
        }
      ]
    }
  ];
}

export function buildQuestionKey(prompt: string, fallbackId: string) {
  const key = slug(prompt);
  return key || fallbackId;
}

export function normalizeQuestionDrafts(sections: CampaignSection[]) {
  return sections.map((section, sectionIndex) => ({
    ...section,
    id: section.id || `section_${sectionIndex + 1}`,
    questions: section.questions.map((question, questionIndex) => {
      const fallbackId = `question_${sectionIndex + 1}_${questionIndex + 1}`;
      const type = question.type;

      return {
        ...question,
        id: question.id || fallbackId,
        key: question.key || buildQuestionKey(question.prompt, fallbackId),
        type,
        options:
          type === "single_select" || type === "multi_select"
            ? (question.options ?? []).map((option, optionIndex) => ({
                ...option,
                id: option.id || `${fallbackId}_option_${optionIndex + 1}`
              }))
            : undefined,
        ratingScale:
          type === "rating"
            ? question.ratingScale ?? {
                min: 1,
                max: 5,
                minLabel: "Low",
                maxLabel: "High"
              }
            : undefined
      } satisfies CampaignQuestion;
    })
  }));
}
