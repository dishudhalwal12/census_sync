import { createHash, randomBytes } from "node:crypto";

export function hashCampaignToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createCampaignLinkToken() {
  return randomBytes(24).toString("base64url");
}

export function buildTokenPreview(token: string) {
  if (token.length <= 8) {
    return token;
  }

  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
