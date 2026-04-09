import { describe, expect, it } from "vitest";

import {
  demoAssignments,
  demoMissionSubmissions,
  demoSubmissions
} from "@/lib/data/mock";
import {
  buildCoverageGaps,
  buildCoverageTargets,
  buildEnumeratorScorecards,
  evaluateHouseholdRisk,
  evaluateMissionRisk
} from "@/lib/trust/engine";

describe("trust engine", () => {
  it("detects duplicate and trust signals on risky household submissions", () => {
    const riskySubmission = {
      ...demoSubmissions[1]!,
      householdId: demoSubmissions[0]!.householdId,
      phone: demoSubmissions[0]!.phone,
      addressLine1: demoSubmissions[0]!.addressLine1,
      headOfHousehold: demoSubmissions[0]!.headOfHousehold
    };
    const assessment = evaluateHouseholdRisk(riskySubmission, [demoSubmissions[0]!]);

    expect(assessment.riskScore).toBeGreaterThan(0);
    expect(assessment.riskLevel).not.toBe("low");
  });

  it("keeps approved mission proofs at low risk when no anomalies exist", () => {
    const assessment = evaluateMissionRisk(demoMissionSubmissions[0]!, []);

    expect(assessment.riskLevel).toBe("low");
  });

  it("builds enumerator scorecards and coverage gaps from submission history", () => {
    const scorecards = buildEnumeratorScorecards(demoSubmissions, demoMissionSubmissions, []);
    const gaps = buildCoverageGaps(demoSubmissions, [], buildCoverageTargets(demoAssignments));

    expect(scorecards[0]?.submissionsCompleted).toBeGreaterThan(0);
    expect(gaps.length).toBeGreaterThan(0);
  });
});
