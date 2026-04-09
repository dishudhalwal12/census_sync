import type {
  Assignment,
  AlertEvent,
  AuditLogEvent,
  CoveragePoint,
  ReviewCase,
  ExportRequest,
  HouseholdSubmission,
  MissionAssignmentPackage,
  MissionCoveragePoint,
  MissionSubmission,
  Project,
  TemplateVersion,
  UserProfile
} from "@/types/domain";

const now = new Date();
const iso = (offsetDays = 0) =>
  new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();

export const demoProjects: Project[] = [
  {
    id: "project-census-2026",
    name: "Ward Census Starter",
    slug: "ward-census-starter",
    description:
      "Starter project for household census operations across district survey teams.",
    type: "census",
    status: "active",
    activeTemplateVersionId: "template-v1",
    targetSubmissions: 250,
    scope: [{ district: "South District", block: "Block A", cluster: "Ward 7" }],
    createdAt: iso(-21),
    updatedAt: iso(-1)
  },
  {
    id: "project-market-sweep-2026",
    name: "Ward 7 Market Sweep",
    slug: "ward-7-market-sweep",
    description:
      "Mission-based storefront census with geofence enforcement and proof-of-visit capture.",
    objective: "Verify active shops, capture service capacity, and confirm proof of visit.",
    type: "census",
    status: "active",
    activeTemplateVersionId: "template-mission-v1",
    targetSubmissions: 12,
    siteCenter: { latitude: 28.5352, longitude: 77.3907 },
    serviceRadiusMeters: 1000,
    capacityLimit: 12,
    verificationMode: "hard_lock",
    missionSummary: {
      sent: 2,
      opened: 2,
      inProgress: 1,
      completed: 1
    },
    scope: [{ district: "South District", block: "Block A", cluster: "Ward 7" }],
    createdAt: iso(-10),
    updatedAt: iso(0)
  }
];

export const demoUsers: UserProfile[] = [
  {
    uid: "demo-enumerator",
    name: "Ananya Rao",
    email: "enumerator@demo.censussync.app",
    role: "employee",
    status: "active",
    projectId: "project-census-2026",
    assignmentLabel: "South District / Block A",
    scopes: [{ district: "South District", block: "Block A", cluster: "Ward 7" }],
    assignedTemplateVersion: "template-v1",
    lastLoginAt: iso(0),
    createdAt: iso(-30)
  },
  {
    uid: "demo-supervisor",
    name: "Rahul Mehta",
    email: "supervisor@demo.censussync.app",
    role: "admin",
    status: "active",
    projectId: "project-census-2026",
    assignmentLabel: "South District",
    scopes: [{ district: "South District", block: "All Blocks" }],
    assignedTemplateVersion: "template-v1",
    lastLoginAt: iso(0),
    createdAt: iso(-60)
  },
  {
    uid: "demo-admin",
    name: "Priya Iyer",
    email: "admin@demo.censussync.app",
    role: "admin",
    status: "active",
    projectId: "project-census-2026",
    assignmentLabel: "All District Operations",
    scopes: [{ district: "All Districts", block: "All Blocks" }],
    assignedTemplateVersion: "template-v1",
    lastLoginAt: iso(0),
    createdAt: iso(-90)
  }
];

export const demoAssignments: Assignment[] = [
  {
    id: "assignment-1",
    projectId: "project-census-2026",
    projectType: "census",
    enumeratorId: "demo-enumerator",
    supervisorId: "demo-supervisor",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    label: "Ward 7 household sweep",
    activeScopeOwner: "demo-enumerator",
    targetCount: 120,
    activeFrom: iso(-7),
    status: "active"
  },
  {
    id: "assignment-2",
    projectId: "project-census-2026",
    projectType: "census",
    enumeratorId: "demo-enumerator",
    supervisorId: "demo-supervisor",
    scope: { district: "South District", block: "Block B", cluster: "Ward 3" },
    label: "Ward 3 validation support",
    activeScopeOwner: "demo-enumerator",
    targetCount: 35,
    activeFrom: iso(-2),
    status: "paused"
  },
  {
    id: "assignment-mission-1",
    projectId: "project-market-sweep-2026",
    projectType: "census",
    templateVersionId: "template-mission-v1",
    enumeratorId: "demo-enumerator",
    assigneeUid: "demo-enumerator",
    supervisorId: "demo-supervisor",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    label: "Ward 7 commercial lane census",
    activeScopeOwner: "demo-enumerator",
    targetCount: 12,
    activeFrom: iso(-1),
    status: "active",
    shareCode: "ward7-market-sweep",
    activationStatus: "in_progress",
    openedAt: iso(-1),
    startedAt: iso(-1),
    progress: {
      requiredResponses: 6,
      completedResponses: 3
    }
  },
  {
    id: "assignment-mission-2",
    projectId: "project-market-sweep-2026",
    projectType: "census",
    templateVersionId: "template-mission-v1",
    enumeratorId: "demo-enumerator",
    assigneeUid: "demo-enumerator",
    supervisorId: "demo-supervisor",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    label: "Ward 7 storefront follow-up",
    activeScopeOwner: "demo-enumerator",
    targetCount: 12,
    activeFrom: iso(-3),
    status: "completed",
    shareCode: "ward7-market-followup",
    activationStatus: "completed",
    openedAt: iso(-3),
    startedAt: iso(-3),
    completedAt: iso(-2),
    progress: {
      requiredResponses: 6,
      completedResponses: 6
    }
  }
];

export const demoTemplates: TemplateVersion[] = [
  {
    id: "template-v1",
    projectId: "project-census-2026",
    projectType: "census",
    name: "Household Census Starter",
    version: "2026.1",
    status: "active",
    sections: [
      {
        id: "household",
        title: "Household details",
        description: "Capture identity and address details for the household.",
        fields: [
          { key: "householdId", label: "Household ID", type: "text", required: true },
          { key: "headOfHousehold", label: "Head of household", type: "text", required: true }
        ]
      },
      {
        id: "members",
        title: "Members",
        description: "Repeatable member roster with demographic details.",
        fields: [{ key: "members", label: "Members", type: "textarea", required: true }]
      }
    ],
    releaseNotes: "Added internet availability and sanitation detail fields.",
    publishedAt: iso(-14),
    createdAt: iso(-20)
  },
  {
    id: "template-mission-v1",
    projectId: "project-market-sweep-2026",
    projectType: "census",
    name: "Mission storefront verification",
    version: "2026.mission.1",
    status: "active",
    sections: [
      {
        id: "instructions",
        title: "Enumerator briefing",
        description: "Confirm the storefront is open and speak with the person in charge.",
        fields: [
          {
            key: "briefing",
            label: "Mission briefing",
            type: "textarea",
            kind: "instruction",
            helperText:
              "Stay within the assigned radius, complete all questions, then capture proof photo."
          }
        ]
      },
      {
        id: "business-profile",
        title: "Business profile",
        description: "Capture the storefront identity and operating state.",
        fields: [
          {
            key: "businessName",
            label: "Business name",
            type: "text",
            kind: "text",
            required: true,
            placeholder: "Gupta General Store",
            translations: {
              hi: {
                label: "व्यवसाय का नाम",
                placeholder: "गुप्ता जनरल स्टोर"
              }
            }
          },
          {
            key: "businessType",
            label: "Business type",
            type: "select",
            kind: "single_select",
            required: true,
            options: [
              { label: "Grocery", value: "grocery" },
              { label: "Clinic", value: "clinic" },
              { label: "Restaurant", value: "restaurant" },
              { label: "Pharmacy", value: "pharmacy" }
            ],
            translations: {
              hi: {
                label: "व्यवसाय का प्रकार"
              }
            }
          },
          {
            key: "openToPublic",
            label: "Currently open to the public",
            type: "checkbox",
            kind: "boolean",
            required: true,
            translations: {
              hi: {
                label: "क्या यह अभी जनता के लिए खुला है"
              }
            }
          }
        ]
      },
      {
        id: "service-capacity",
        title: "Service capacity",
        description: "Estimate the establishment's footprint and service capacity.",
        fields: [
          {
            key: "dailyCustomers",
            label: "Approximate daily customers",
            type: "number",
            kind: "number",
            required: true,
            validation: { min: 0, max: 2000 },
            translations: {
              hi: {
                label: "प्रतिदिन अनुमानित ग्राहक"
              }
            }
          },
          {
            key: "serviceArea",
            label: "Service area",
            type: "textarea",
            kind: "textarea",
            required: true,
            placeholder: "Ward 7, nearby blocks, and school area",
            translations: {
              hi: {
                label: "सेवा क्षेत्र",
                placeholder: "वार्ड 7, आसपास के ब्लॉक और स्कूल क्षेत्र"
              }
            }
          },
          {
            key: "peakDays",
            label: "Peak service days",
            type: "select",
            kind: "multi_select",
            options: [
              { label: "Monday", value: "mon" },
              { label: "Tuesday", value: "tue" },
              { label: "Wednesday", value: "wed" },
              { label: "Thursday", value: "thu" },
              { label: "Friday", value: "fri" },
              { label: "Saturday", value: "sat" },
              { label: "Sunday", value: "sun" }
            ]
          },
          {
            key: "regulatedInventory",
            label: "Regulated inventory handled",
            type: "textarea",
            kind: "textarea",
            placeholder: "Only visible for pharmacies",
            visibilityRules: [
              {
                fieldKey: "businessType",
                operator: "equals",
                value: "pharmacy"
              }
            ],
            requiredRules: [
              {
                fieldKey: "businessType",
                operator: "equals",
                value: "pharmacy"
              }
            ],
            translations: {
              hi: {
                label: "नियंत्रित इन्वेंटरी विवरण",
                placeholder: "यह प्रश्न केवल फार्मेसी के लिए दिखेगा"
              }
            }
          },
          {
            key: "visitedOn",
            label: "Visited on",
            type: "date",
            kind: "date",
            required: true
          }
        ]
      }
    ],
    releaseNotes: "Mission template for geofenced storefront verification.",
    publishedAt: iso(-10),
    createdAt: iso(-10)
  },
  {
    id: "template-v2",
    projectId: "project-census-2026",
    projectType: "census",
    name: "Household Census Starter",
    version: "2026.2-beta",
    status: "draft",
    sections: [],
    releaseNotes: "Draft version for migrant worker capture.",
    createdAt: iso(-1)
  }
];

export const demoMissionSubmissions: MissionSubmission[] = [
  {
    submissionId: "mission-sub-001",
    assignmentId: "assignment-mission-2",
    projectId: "project-market-sweep-2026",
    projectType: "census",
    templateVersionId: "template-mission-v1",
    enumeratorId: "demo-enumerator",
    enumeratorName: "Ananya Rao",
    answers: {
      businessName: "Gupta General Store",
      businessType: "grocery",
      openToPublic: true,
      dailyCustomers: 180,
      serviceArea: "Ward 7 and neighbouring apartment lanes",
      peakDays: ["fri", "sat", "sun"],
      visitedOn: iso(-2).slice(0, 10)
    },
    geoCheckAtStart: {
      latitude: 28.5351,
      longitude: 77.3904,
      accuracy: 9,
      capturedAt: iso(-2),
      distanceMeters: 34,
      withinRange: true
    },
    geoCheckAtSubmit: {
      latitude: 28.5354,
      longitude: 77.3906,
      accuracy: 7,
      capturedAt: iso(-2),
      distanceMeters: 22,
      withinRange: true
    },
    evidence: {
      fileName: "ward7-market-proof.jpg",
      mimeType: "image/jpeg",
      byteSize: 481233,
      capturedAt: iso(-2),
      latitude: 28.5354,
      longitude: 77.3906,
      accuracy: 7,
      downloadUrl: "https://example.com/demo-proof.jpg",
      storagePath: "missions/demo/assignment-mission-2/mission-sub-001-proof.jpg",
      fingerprint: "demo-proof-fingerprint-1"
    },
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    syncStatus: "synced",
    validationStatus: "approved",
    validationMessage: "Proof of visit and geofence validated.",
    status: "completed",
    anomalyFlags: [],
    dedupeKey: "assignment-mission-2::mission-sub-001",
    riskScore: 8,
    riskLevel: "low",
    riskSignals: [],
    visitOutcome: "survey_completed",
    language: "en",
    sourceDeviceId: "device-demo-a",
    revisionGroupId: "mission-sub-001",
    revisionNumber: 1,
    startedAt: iso(-2),
    capturedAt: iso(-2),
    updatedAt: iso(-2),
    audit: {
      createdBy: "demo-enumerator",
      createdAt: iso(-2),
      lastUpdatedBy: "demo-enumerator",
      lastUpdatedAt: iso(-2)
    }
  }
];

export const demoSubmissions: HouseholdSubmission[] = [
  {
    submissionId: "sub-001",
    projectId: "project-census-2026",
    projectType: "census",
    householdId: "SD-BA-0001",
    templateVersionId: "template-v1",
    enumeratorId: "demo-enumerator",
    enumeratorName: "Ananya Rao",
    headOfHousehold: "Sunita Verma",
    phone: "9999988888",
    addressLine1: "14 River Lane",
    addressLine2: "Near Market Square",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    members: [
      {
        id: "mem-1",
        fullName: "Sunita Verma",
        relationship: "Head",
        age: 45,
        gender: "female",
        occupation: "Teacher",
        educationLevel: "Graduate"
      },
      {
        id: "mem-2",
        fullName: "Arjun Verma",
        relationship: "Son",
        age: 17,
        gender: "male",
        occupation: "Student",
        educationLevel: "Class 11"
      }
    ],
    housing: {
      dwellingType: "Apartment",
      ownershipStatus: "Owned",
      rooms: 3,
      drinkingWaterSource: "Municipal",
      sanitationType: "Flush",
      electricityAvailable: true,
      internetAvailable: true
    },
    notes: "Documentation verified on site.",
    geo: {
      latitude: 28.5355,
      longitude: 77.391,
      accuracy: 8,
      capturedAt: iso(-1)
    },
    capturedAt: iso(-1),
    updatedAt: iso(-1),
    syncStatus: "synced",
    validationStatus: "approved",
    validationMessage: "Passed all validations.",
    reviewStatus: "not_required",
    flags: [],
    dedupeKey: "SD-BA-0001::sub-001",
    riskScore: 12,
    riskLevel: "low",
    riskSignals: [],
    visitOutcome: "survey_completed",
    language: "en",
    consent: {
      mode: "verbal",
      capturedAt: iso(-1),
      collectorName: "Ananya Rao",
      acknowledged: true
    },
    sourceDeviceId: "device-demo-a",
    revisionGroupId: "SD-BA-0001",
    revisionNumber: 1,
    startedAt: iso(-1),
    audit: {
      createdBy: "demo-enumerator",
      createdAt: iso(-1),
      lastUpdatedBy: "demo-enumerator",
      lastUpdatedAt: iso(-1)
    }
  },
  {
    submissionId: "sub-002",
    projectId: "project-census-2026",
    projectType: "census",
    householdId: "SD-BB-0042",
    templateVersionId: "template-v1",
    enumeratorId: "demo-enumerator",
    enumeratorName: "Ananya Rao",
    headOfHousehold: "Sajid Khan",
    addressLine1: "22 Orchard Road",
    scope: { district: "South District", block: "Block B", cluster: "Ward 3" },
    members: [
      {
        id: "mem-1",
        fullName: "Sajid Khan",
        relationship: "Head",
        age: 51,
        gender: "male",
        occupation: "Shopkeeper",
        educationLevel: "Secondary"
      }
    ],
    housing: {
      dwellingType: "Detached",
      ownershipStatus: "Rented",
      rooms: 2,
      drinkingWaterSource: "Hand pump",
      sanitationType: "Shared",
      electricityAvailable: true,
      internetAvailable: false
    },
    notes: "Household ID requires duplicate review.",
    geo: {
      latitude: 28.5199,
      longitude: 77.4085,
      accuracy: 11,
      capturedAt: iso(-2)
    },
    capturedAt: iso(-2),
    updatedAt: iso(-2),
    syncStatus: "flagged",
    validationStatus: "flagged",
    validationMessage: "Possible duplicate household in same block.",
    reviewStatus: "pending_review",
    flags: ["duplicate_household"],
    dedupeKey: "SD-BB-0042::sub-002",
    riskScore: 72,
    riskLevel: "high",
    riskSignals: ["duplicate_household_id", "fuzzy_address_match"],
    reviewCaseId: "review-sub-002",
    visitOutcome: "survey_completed",
    language: "en",
    consent: {
      mode: "written",
      capturedAt: iso(-2),
      collectorName: "Ananya Rao",
      acknowledged: true
    },
    sourceDeviceId: "device-demo-a",
    revisionGroupId: "SD-BB-0042",
    revisionNumber: 1,
    startedAt: iso(-2),
    audit: {
      createdBy: "demo-enumerator",
      createdAt: iso(-2),
      lastUpdatedBy: "demo-enumerator",
      lastUpdatedAt: iso(-2)
    }
  }
];

export const demoAuditLogs: AuditLogEvent[] = [
  {
    id: "audit-1",
    actorId: "demo-supervisor",
    actorName: "Rahul Mehta",
    actorRole: "admin",
    action: "reviewed_submission",
    targetType: "submission",
    targetId: "sub-002",
    scope: { district: "South District", block: "Block B" },
    metadata: { result: "flagged" },
    timestamp: iso(-1)
  },
  {
    id: "audit-2",
    actorId: "demo-admin",
    actorName: "Priya Iyer",
    actorRole: "admin",
    action: "created_export",
    targetType: "export",
    targetId: "export-1",
    metadata: { format: "csv" },
    timestamp: iso(0)
  },
  {
    id: "audit-3",
    actorId: "demo-admin",
    actorName: "Priya Iyer",
    actorRole: "admin",
    action: "mission_assignment_published",
    targetType: "assignment",
    targetId: "assignment-mission-1",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    metadata: { shareCode: "ward7-market-sweep" },
    timestamp: iso(-1)
  },
  {
    id: "audit-4",
    actorId: "demo-enumerator",
    actorName: "Ananya Rao",
    actorRole: "employee",
    action: "mission_proof_captured",
    targetType: "mission_submission",
    targetId: "mission-sub-001",
    scope: { district: "South District", block: "Block A", cluster: "Ward 7" },
    metadata: { assignmentId: "assignment-mission-2" },
    timestamp: iso(-2)
  }
];

export const demoExports: ExportRequest[] = [
  {
    id: "export-1",
    projectId: "project-census-2026",
    projectType: "census",
    requesterId: "demo-supervisor",
    requesterName: "Rahul Mehta",
    scope: [{ district: "South District", block: "All Blocks" }],
    format: "csv",
    status: "completed",
    createdAt: iso(-1),
    downloadUrl: "#",
    filters: {
      dateFrom: iso(-7),
      dateTo: iso(0)
    }
  }
];

export const demoReviewCases: ReviewCase[] = [
  {
    id: "review-sub-002",
    submissionId: "sub-002",
    currentSubmissionId: "sub-002",
    projectId: "project-census-2026",
    scope: { district: "South District", block: "Block B", cluster: "Ward 3" },
    enumeratorId: "demo-enumerator",
    householdId: "SD-BB-0042",
    status: "revisit_requested",
    riskLevel: "high",
    riskScore: 72,
    riskSignals: ["duplicate_household_id", "fuzzy_address_match"],
    duplicateCandidates: [
      {
        submissionId: "sub-002",
        matchedSubmissionId: "sub-001",
        confidence: "medium",
        reasons: ["same_phone_number"]
      }
    ],
    latestActionAt: iso(-1),
    createdAt: iso(-2),
    updatedAt: iso(-1),
    comments: [
      {
        id: "review-comment-1",
        actorId: "demo-supervisor",
        actorName: "Rahul Mehta",
        actorRole: "admin",
        message: "Please revisit and verify whether this is a duplicate or a new tenant.",
        createdAt: iso(-1)
      }
    ],
    timeline: [
      {
        id: "review-event-1",
        type: "created",
        actorId: "system",
        actorName: "Trust engine",
        actorRole: "system",
        createdAt: iso(-2),
        detail: "Case created because duplicate and address-match signals were detected."
      },
      {
        id: "review-event-2",
        type: "revisit_requested",
        actorId: "demo-supervisor",
        actorName: "Rahul Mehta",
        actorRole: "admin",
        createdAt: iso(-1),
        detail: "Requested revisit for duplicate verification."
      }
    ],
    revisitTask: {
      id: "review-sub-002-revisit",
      submissionId: "sub-002",
      reviewCaseId: "review-sub-002",
      enumeratorId: "demo-enumerator",
      reasons: ["duplicate_check", "address_mismatch"],
      status: "open",
      requestedAt: iso(-1),
      requestedBy: "demo-supervisor",
      requestedByName: "Rahul Mehta",
      notes: "Confirm whether the household shifted recently."
    }
  }
];

export const demoAlerts: AlertEvent[] = [
  {
    id: "alert-gap-1",
    title: "Coverage gap at risk",
    description: "Block B is behind target completion and still has a revisit backlog.",
    severity: "critical",
    status: "open",
    audience: "admin",
    projectId: "project-census-2026",
    scope: { district: "South District", block: "Block B", cluster: "Ward 3" },
    relatedEntityType: "coverage_gap",
    relatedEntityId: "gap-target-project-census-2026-demo-enumerator",
    createdAt: iso(0)
  },
  {
    id: "alert-review-1",
    title: "High-risk review case",
    description: "One flagged submission needs revisit because of duplicate and address-match signals.",
    severity: "warning",
    status: "open",
    audience: "admin",
    projectId: "project-census-2026",
    relatedEntityType: "review_case",
    relatedEntityId: "review-sub-002",
    createdAt: iso(0)
  }
];

export const demoCoveragePoints: CoveragePoint[] = demoSubmissions
  .filter((submission) => submission.geo)
  .map((submission) => ({
    id: submission.submissionId,
    householdId: submission.householdId,
    enumeratorName: submission.enumeratorName,
    status: submission.validationStatus,
    latitude: submission.geo!.latitude,
    longitude: submission.geo!.longitude,
    submittedAt: submission.capturedAt,
    scope: submission.scope
  }));

export const demoMissionCoveragePoints: MissionCoveragePoint[] = demoMissionSubmissions.map(
  (submission) => ({
    id: submission.submissionId,
    assignmentId: submission.assignmentId,
    projectId: submission.projectId,
    projectName:
      demoProjects.find((project) => project.id === submission.projectId)?.name ?? "Mission",
    enumeratorName: submission.enumeratorName,
    status: submission.validationStatus,
    latitude: submission.geoCheckAtSubmit.latitude,
    longitude: submission.geoCheckAtSubmit.longitude,
    distanceMeters: submission.geoCheckAtSubmit.distanceMeters,
    proofCaptured: Boolean(submission.evidence.storagePath),
    submittedAt: submission.capturedAt,
    scope: submission.scope
  })
);

export const demoMissionPackages: MissionAssignmentPackage[] = demoAssignments
  .filter((assignment) => assignment.shareCode)
  .map((assignment) => ({
    assignment,
    project:
      demoProjects.find((project) => project.id === assignment.projectId) ?? demoProjects[0]!,
    template:
      demoTemplates.find(
        (template) =>
          template.id === assignment.templateVersionId ||
          template.id ===
            demoProjects.find((project) => project.id === assignment.projectId)
              ?.activeTemplateVersionId
      ) ?? demoTemplates[0]!,
    assignee: assignment.assigneeUid
      ? demoUsers.find((user) => user.uid === assignment.assigneeUid)
      : undefined,
    shareUrl: `http://localhost:3000/field/${assignment.shareCode}`
  }));
