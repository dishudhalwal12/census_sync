import { afterEach, describe, expect, it, vi } from "vitest";

const createAiCampaignDraftMock = vi.fn();
const requireRouteSessionMock = vi.fn();

vi.mock("@/lib/campaigns/server", () => ({
  createAiCampaignDraft: createAiCampaignDraftMock
}));

vi.mock("@/lib/server/api-route", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/server/api-route")>("@/lib/server/api-route");

  return {
    ...actual,
    requireRouteSession: requireRouteSessionMock
  };
});

describe("admin campaign AI draft route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it(
    "returns the draft response shape expected by the admin client",
    async () => {
    requireRouteSessionMock.mockResolvedValue({
      uid: "admin-1",
      role: "admin"
    });
    createAiCampaignDraftMock.mockResolvedValue({
      sections: [
        {
          id: "section_1",
          title: "Customer context",
          questions: [
            {
              id: "question_1",
              key: "location",
              prompt: "Which branch did you visit?",
              type: "short_text",
              required: true
            }
          ]
        }
      ],
      source: "gemini",
      summary: "hybrid draft for Retail customers"
    });

    const { POST } = await import("@/app/api/admin/campaigns/ai-draft/route");
    const response = await POST(
      new Request("http://localhost/api/admin/campaigns/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Store Feedback Census" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sections: [
        {
          id: "section_1",
          title: "Customer context",
          questions: [
            {
              id: "question_1",
              key: "location",
              prompt: "Which branch did you visit?",
              type: "short_text",
              required: true
            }
          ]
        }
      ],
      source: "gemini",
      summary: "hybrid draft for Retail customers"
    });
    },
    15000
  );
});
