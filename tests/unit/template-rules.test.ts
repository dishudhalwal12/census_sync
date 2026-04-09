import { describe, expect, it } from "vitest";

import { demoMissionPackages } from "@/lib/data/mock";
import {
  isTemplateFieldRequired,
  isTemplateFieldVisible
} from "@/lib/trust/forms";

describe("template rules", () => {
  it("shows conditional mission fields only when the rule matches", () => {
    const template = demoMissionPackages[0]!.template;
    const field = template.sections
      .flatMap((section) => section.fields)
      .find((entry) => entry.key === "regulatedInventory");

    expect(field).toBeDefined();
    expect(isTemplateFieldVisible(field!, { businessType: "grocery" })).toBe(false);
    expect(isTemplateFieldVisible(field!, { businessType: "pharmacy" })).toBe(true);
    expect(isTemplateFieldRequired(field!, { businessType: "pharmacy" })).toBe(true);
  });
});
