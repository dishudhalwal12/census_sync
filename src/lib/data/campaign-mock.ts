import { createHash } from "node:crypto";

import type {
  Campaign,
  CampaignAssignment,
  CampaignLink,
  CampaignResponse,
  CampaignVersion,
  Organization
} from "@/types/campaign";

export const DEMO_ORG_ID = "org-demo-censussync";
export const DEMO_EMPLOYEE_LINK_TOKEN = "employee-demo-token";
export const DEMO_PUBLIC_LINK_TOKEN = "public-demo-token";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const now = new Date();
const iso = (offsetDays = 0) =>
  new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();

export const demoOrganizations: Organization[] = [
  {
    id: DEMO_ORG_ID,
    name: "CensusSync Demo Organization",
    slug: "censussync-demo-organization",
    createdBy: "demo-admin",
    createdAt: iso(-90),
    updatedAt: iso(0)
  }
];

export const demoCampaigns: Campaign[] = [
  {
    id: "campaign-demo-customer-feedback",
    orgId: DEMO_ORG_ID,
    name: "Retail Customer Feedback Census",
    slug: "retail-customer-feedback-census",
    purpose: "Collect structured retail feedback across stores and in public link distribution.",
    description:
      "Hybrid feedback census used by field teams in-store and by self-serve participants online.",
    targetAudience: "Recent retail customers in Ward 7 stores",
    status: "published",
    collectionMode: "hybrid",
    geofenceCenter: {
      latitude: 28.5352,
      longitude: 77.3907
    },
    geofenceRadiusMeters: 1200,
    locationScope: {
      district: "South District",
      block: "Block A",
      cluster: "Ward 7"
    },
    activeVersionId: "campaign-version-demo-v1",
    createdBy: "demo-admin",
    createdAt: iso(-14),
    updatedAt: iso(-1)
  }
];

export const demoCampaignVersions: CampaignVersion[] = [
  {
    id: "campaign-version-demo-v1",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    versionLabel: "v1",
    status: "published",
    source: "ai",
    aiContext: {
      prompt:
        "Build a short hybrid customer feedback census for in-store retail teams and public participants.",
      summary: "Retail feedback hybrid starter"
    },
    sections: [
      {
        id: "section-intro",
        title: "Participant details",
        description: "Capture optional identity and store context.",
        questions: [
          {
            id: "question-name",
            key: "participant_name",
            prompt: "What is your name?",
            type: "short_text",
            required: false
          },
          {
            id: "question-store",
            key: "store_location",
            prompt: "Which store or location are you giving feedback about?",
            type: "short_text",
            required: true
          }
        ]
      },
      {
        id: "section-feedback",
        title: "Service feedback",
        description: "Measure satisfaction and collect follow-up detail.",
        questions: [
          {
            id: "question-rating",
            key: "overall_rating",
            prompt: "How would you rate your overall experience?",
            type: "rating",
            required: true,
            ratingScale: {
              min: 1,
              max: 5,
              minLabel: "Very poor",
              maxLabel: "Excellent"
            }
          },
          {
            id: "question-recommend",
            key: "would_recommend",
            prompt: "Would you recommend this location to others?",
            type: "single_select",
            required: true,
            options: [
              { id: "yes", label: "Yes", value: "yes" },
              { id: "no", label: "No", value: "no" },
              { id: "maybe", label: "Maybe", value: "maybe" }
            ]
          },
          {
            id: "question-improve",
            key: "improvement_areas",
            prompt: "Which areas should improve?",
            type: "multi_select",
            required: false,
            options: [
              { id: "speed", label: "Service speed", value: "service_speed" },
              { id: "staff", label: "Staff support", value: "staff_support" },
              { id: "cleanliness", label: "Cleanliness", value: "cleanliness" },
              { id: "availability", label: "Product availability", value: "product_availability" }
            ]
          },
          {
            id: "question-comment",
            key: "comment",
            prompt: "What else should we know?",
            type: "long_text",
            required: false
          }
        ]
      }
    ],
    createdBy: "demo-admin",
    createdAt: iso(-14),
    publishedAt: iso(-12)
  }
];

export const demoCampaignAssignments: CampaignAssignment[] = [
  {
    id: "campaign-assignment-demo-1",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    campaignVersionId: "campaign-version-demo-v1",
    employeeId: "demo-enumerator",
    employeeName: "Ananya Rao",
    label: "Ward 7 retail feedback collection",
    scope: {
      district: "South District",
      block: "Block A",
      cluster: "Ward 7"
    },
    geofenceCenter: {
      latitude: 28.5352,
      longitude: 77.3907
    },
    geofenceRadiusMeters: 1200,
    targetResponses: 40,
    status: "active",
    employeeLinkId: "campaign-link-demo-employee",
    activeFrom: iso(-7),
    createdBy: "demo-admin",
    createdAt: iso(-7),
    updatedAt: iso(-1)
  }
];

export const demoCampaignLinks: CampaignLink[] = [
  {
    id: "campaign-link-demo-employee",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    campaignVersionId: "campaign-version-demo-v1",
    assignmentId: "campaign-assignment-demo-1",
    type: "employee",
    tokenHash: hashToken(DEMO_EMPLOYEE_LINK_TOKEN),
    tokenPreview: "empl...oken",
    status: "active",
    createdBy: "demo-admin",
    createdAt: iso(-7)
  },
  {
    id: "campaign-link-demo-public",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    campaignVersionId: "campaign-version-demo-v1",
    type: "public",
    tokenHash: hashToken(DEMO_PUBLIC_LINK_TOKEN),
    tokenPreview: "publ...oken",
    status: "active",
    createdBy: "demo-admin",
    createdAt: iso(-6)
  }
];

export const demoCampaignResponses: CampaignResponse[] = [
  {
    id: "campaign-response-demo-employee",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    campaignVersionId: "campaign-version-demo-v1",
    linkId: "campaign-link-demo-employee",
    assignmentId: "campaign-assignment-demo-1",
    channel: "employee",
    employeeId: "demo-enumerator",
    employeeName: "Ananya Rao",
    respondentName: "Pooja Sharma",
    answers: {
      participant_name: "Pooja Sharma",
      store_location: "Ward 7 Market",
      overall_rating: 4,
      would_recommend: "yes",
      improvement_areas: ["service_speed"],
      comment: "Helpful staff and quick billing."
    },
    verification: {
      unlockedAt: {
        latitude: 28.53521,
        longitude: 77.39075,
        capturedAt: iso(-1),
        distanceMeters: 22,
        withinRange: true
      },
      submittedAt: {
        latitude: 28.53518,
        longitude: 77.39069,
        capturedAt: iso(-1),
        distanceMeters: 27,
        withinRange: true
      },
      respondentPhoto: {
        fileName: "respondent-demo.jpg",
        mimeType: "image/jpeg",
        byteSize: 120_000,
        capturedAt: iso(-1),
        latitude: 28.53518,
        longitude: 77.39069
      }
    },
    syncStatus: "synced",
    validationStatus: "approved",
    submittedAt: iso(-1),
    createdAt: iso(-1),
    updatedAt: iso(-1)
  },
  {
    id: "campaign-response-demo-public",
    orgId: DEMO_ORG_ID,
    campaignId: "campaign-demo-customer-feedback",
    campaignVersionId: "campaign-version-demo-v1",
    linkId: "campaign-link-demo-public",
    channel: "public",
    respondentName: "Arjun Malhotra",
    answers: {
      participant_name: "Arjun Malhotra",
      store_location: "Online delivery",
      overall_rating: 5,
      would_recommend: "yes",
      improvement_areas: [],
      comment: "Fast delivery and easy ordering."
    },
    syncStatus: "synced",
    validationStatus: "approved",
    submittedAt: iso(-2),
    createdAt: iso(-2),
    updatedAt: iso(-2)
  }
];
