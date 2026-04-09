import { describe, expect, it } from "vitest";

import {
  buildTokenPreview,
  createCampaignLinkToken,
  hashCampaignToken
} from "@/lib/campaigns/tokens";

describe("campaign token helpers", () => {
  it("creates stable hashes for the same token", () => {
    const token = "demo-public-token";

    expect(hashCampaignToken(token)).toBe(hashCampaignToken(token));
    expect(hashCampaignToken(token)).not.toBe(hashCampaignToken("another-token"));
  });

  it("creates a safe preview and random token", () => {
    const token = createCampaignLinkToken();

    expect(token.length).toBeGreaterThan(20);
    expect(buildTokenPreview(token)).toMatch(/^[A-Za-z0-9_-]{4}\.\.\.[A-Za-z0-9_-]{4}$/);
  });
});
