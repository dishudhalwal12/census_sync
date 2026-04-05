import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(2, "Enter the member name."),
  relationship: z.string().min(2, "Enter the relationship."),
  age: z.number().min(0).max(120),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]),
  occupation: z.string().optional(),
  educationLevel: z.string().optional(),
  disabilityStatus: z.string().optional()
});

export const housingSchema = z.object({
  dwellingType: z.string().min(2, "Select the dwelling type."),
  ownershipStatus: z.string().min(2, "Select the ownership status."),
  rooms: z.number().min(1).max(25),
  drinkingWaterSource: z.string().min(2, "Select the water source."),
  sanitationType: z.string().min(2, "Select the sanitation type."),
  electricityAvailable: z.boolean(),
  internetAvailable: z.boolean()
});

export const householdFormSchema = z.object({
  submissionId: z.string().min(1),
  projectId: z.string().min(1),
  projectType: z.enum([
    "census",
    "community_survey",
    "campus_outreach",
    "social_audit"
  ]),
  householdId: z
    .string()
    .min(3, "Household ID is required.")
    .regex(/^[A-Z0-9-]+$/, "Use letters, numbers, and hyphens only."),
  templateVersionId: z.string().min(1),
  headOfHousehold: z.string().min(2, "Enter the head of household."),
  phone: z.string().optional(),
  addressLine1: z.string().min(4, "Enter the primary address."),
  addressLine2: z.string().optional(),
  district: z.string().min(2, "Select a district."),
  block: z.string().min(2, "Select a block."),
  cluster: z.string().optional(),
  members: z.array(memberSchema).min(1, "Add at least one household member."),
  housing: housingSchema,
  notes: z.string().optional(),
  geoEnabled: z.boolean(),
  geo: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      capturedAt: z.string()
    })
    .optional()
});

export type HouseholdFormValues = z.infer<typeof householdFormSchema>;

export function createEmptyHouseholdForm(overrides?: Partial<HouseholdFormValues>): HouseholdFormValues {
  const submissionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sub-${Date.now()}`;

  return {
    submissionId,
    projectId: overrides?.projectId ?? "project-unassigned",
    projectType: overrides?.projectType ?? "census",
    householdId: "",
    templateVersionId: overrides?.templateVersionId ?? "template-unassigned",
    headOfHousehold: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    district: overrides?.district ?? "",
    block: overrides?.block ?? "",
    cluster: "",
    members: [
      {
        id: `member-${Date.now()}`,
        fullName: "",
        relationship: "Head",
        age: 0,
        gender: "prefer_not_to_say",
        occupation: "",
        educationLevel: "",
        disabilityStatus: ""
      }
    ],
    housing: {
      dwellingType: "",
      ownershipStatus: "",
      rooms: 1,
      drinkingWaterSource: "",
      sanitationType: "",
      electricityAvailable: true,
      internetAvailable: false
    },
    notes: "",
    geoEnabled: false,
    ...overrides
  };
}

export function createDedupeKey(householdId: string, submissionId: string) {
  return `${householdId.trim().toUpperCase()}::${submissionId}`;
}
