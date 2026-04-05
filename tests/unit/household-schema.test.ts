import { describe, expect, it } from "vitest";

import {
  createDedupeKey,
  createEmptyHouseholdForm,
  householdFormSchema
} from "@/lib/validators/household";

describe("household form schema", () => {
  it("creates a valid empty base form that can be extended", () => {
    const form = createEmptyHouseholdForm();

    const parsed = householdFormSchema.safeParse({
      ...form,
      householdId: "SD-BA-0007",
      headOfHousehold: "Sunita Verma",
      addressLine1: "14 River Lane",
      district: "South District",
      block: "Block A",
      members: [
        {
          ...form.members[0],
          fullName: "Sunita Verma",
          relationship: "Head",
          age: 42
        }
      ],
      housing: {
        ...form.housing,
        dwellingType: "Apartment",
        ownershipStatus: "Owned",
        drinkingWaterSource: "Municipal",
        sanitationType: "Flush"
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("builds a stable dedupe key", () => {
    expect(createDedupeKey("sd-ba-0007", "sub-1")).toBe("SD-BA-0007::sub-1");
  });
});
