import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseInput = {
  name: "Store Feedback Census",
  purpose: "Collect customer satisfaction data for store visits",
  targetAudience: "Retail customers",
  collectionMode: "hybrid" as const
};

const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;
const originalFetch = globalThis.fetch;

async function importGenerateCampaignDraft() {
  vi.resetModules();
  const campaignAi = await import("@/lib/campaigns/ai");
  return campaignAi.generateCampaignDraft;
}

describe("campaign AI drafts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }

    if (originalGeminiModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalGeminiModel;
    }

    globalThis.fetch = originalFetch;
  });

  it("uses Gemini when the provider returns valid structured JSON", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    delete process.env.GEMINI_MODEL;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sections: [
                        {
                          id: "section_customer_sentiment",
                          title: "Customer sentiment",
                          description: "Capture the overall visit outcome.",
                          questions: [
                            {
                              id: "question_overall_rating",
                              key: "overall_rating",
                              prompt: "How would you rate your visit?",
                              type: "rating",
                              required: true,
                              ratingScale: { min: 1, max: 5 }
                            }
                          ]
                        },
                        {
                          id: "section_follow_up",
                          title: "Follow-up",
                          questions: [
                            {
                              id: "question_improvements",
                              key: "improvements",
                              prompt: "What should improve next?",
                              type: "long_text",
                              required: false
                            }
                          ]
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    globalThis.fetch = fetchMock as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("gemini");
    expect(draft.message).toBeUndefined();
    expect(draft.sections).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "models/gemini-2.5-flash:generateContent"
    );
  });

  it("falls back cleanly when the Gemini API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("fallback");
    expect(draft.sections.length).toBeGreaterThan(1);
    expect(draft.message).toContain("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back cleanly when Gemini returns a non-OK response", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "upstream unavailable" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    ) as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("fallback");
    expect(draft.message).toContain("status 503");
  });

  it("retries transient Gemini failures before falling back", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "model overloaded" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        sections: [
                          {
                            id: "section_retry_success",
                            title: "Retry success",
                            questions: [
                              {
                                id: "question_retry_success",
                                key: "retry_success",
                                prompt: "Did the retry work?",
                                type: "boolean",
                                required: true
                              }
                            ]
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("gemini");
    expect(draft.message).toBeUndefined();
    expect(draft.sections).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails over to a backup Gemini model when the primary model stays overloaded", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "model overloaded" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "model overloaded" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "model overloaded" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        sections: [
                          {
                            id: "section_backup_model",
                            title: "Backup model",
                            questions: [
                              {
                                id: "question_backup_model",
                                key: "backup_model",
                                prompt: "Did backup model generation work?",
                                type: "boolean",
                                required: true
                              }
                            ]
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("gemini");
    expect(draft.sections).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[0]).toContain(
      "models/gemini-2.5-flash-lite:generateContent"
    );
  });

  it("falls back cleanly when Gemini returns malformed or empty content", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "{\"sections\":" }]
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as typeof fetch;

    const generateCampaignDraft = await importGenerateCampaignDraft();
    const draft = await generateCampaignDraft(baseInput);

    expect(draft.source).toBe("fallback");
    expect(draft.sections.length).toBeGreaterThan(1);
    expect(draft.message).toContain("invalid JSON");
  });
});
