import { describe, expect, it } from "vitest";

import {
  demoMissionPackages,
  demoMissionSubmissions
} from "@/lib/data/mock";
import {
  calculateDistanceMeters,
  getMissionRequiredCounts,
  validateMissionAnswers
} from "@/lib/missions/utils";

describe("mission helpers", () => {
  it("flags missing required mission answers", () => {
    const template = demoMissionPackages[0]!.template;
    const errors = validateMissionAnswers(template, {});

    expect(errors.businessName).toBeDefined();
    expect(errors.businessType).toBeDefined();
    expect(errors.dailyCustomers).toBeDefined();
  });

  it("counts completed required mission answers from a synced submission", () => {
    const template = demoMissionPackages[0]!.template;
    const submission = demoMissionSubmissions[0]!;
    const counts = getMissionRequiredCounts(template, submission.answers);

    expect(counts.required).toBeGreaterThan(0);
    expect(counts.completed).toBe(counts.required);
  });

  it("computes a realistic distance between mission points", () => {
    const distance = calculateDistanceMeters(
      { latitude: 28.5352, longitude: 77.3907 },
      { latitude: 28.5354, longitude: 77.3906 }
    );

    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(50);
  });
});
