import { describe, expect, it } from "vitest";

import {
  buildQuestionKey,
  normalizeQuestionDrafts,
  validateCampaignAnswers
} from "@/lib/campaigns/schemas";
import { demoCampaignVersions } from "@/lib/data/campaign-mock";

describe("campaign schema helpers", () => {
  it("flags missing required campaign answers", () => {
    const version = demoCampaignVersions[0]!;
    const errors = validateCampaignAnswers(version.sections, {});

    expect(errors.store_location).toBeDefined();
    expect(errors.overall_rating).toBeDefined();
    expect(errors.would_recommend).toBeDefined();
  });

  it("normalizes generated drafts with stable ids and keys", () => {
    const normalized = normalizeQuestionDrafts([
      {
        id: "",
        title: "Section",
        questions: [
          {
            id: "",
            key: "",
            prompt: "How was the service quality?",
            type: "single_select",
            required: true,
            options: [{ id: "", label: "Good", value: "good" }]
          }
        ]
      }
    ]);

    expect(normalized[0]?.id).toContain("section_");
    expect(normalized[0]?.questions[0]?.id).toContain("question_");
    expect(normalized[0]?.questions[0]?.key).toBe(buildQuestionKey("How was the service quality?", "fallback"));
    expect(normalized[0]?.questions[0]?.options?.[0]?.id).toContain("question_");
  });
});
