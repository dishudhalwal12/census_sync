export interface ResourceArticle {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
}

export const resourceArticles: ResourceArticle[] = [
  {
    slug: "offline-first-coverage",
    title: "How offline-first systems improve district coverage",
    summary:
      "Why resilient local capture closes the gap between planned and actual household outreach.",
    intro:
      "Offline-first field tools let teams keep collecting, validating, and syncing work even when network quality changes block by block.",
    sections: [
      {
        heading: "Capture continues in weak-network zones",
        body: [
          "Enumerators keep moving because the form, queue, and draft recovery stay on-device.",
          "Supervisors see the sync backlog instead of losing visibility entirely when connectivity drops."
        ]
      },
      {
        heading: "Coverage confidence improves",
        body: [
          "Geo-tagged records help managers verify which lanes, wards, and clusters have actually been visited.",
          "That makes it easier to redirect teams before a reporting deadline becomes a crisis."
        ]
      }
    ]
  },
  {
    slug: "sync-aware-workflows",
    title: "Reducing census delays with sync-aware workflows",
    summary:
      "How queue visibility and retry-safe submission design prevent last-mile reporting delays.",
    intro:
      "Most field delays come from uncertainty: teams do not know what has synced, what is still pending, and what needs intervention.",
    sections: [
      {
        heading: "Queues make bottlenecks visible",
        body: [
          "A visible queue tells the team whether a record is pending, failed, flagged, or already synchronized.",
          "That replaces guesswork with a measurable list of follow-up work."
        ]
      },
      {
        heading: "Retry-safe sync prevents duplicate panic",
        body: [
          "When the same submission can be retried safely, teams stop inventing manual workarounds.",
          "Managers can focus on validation quality instead of reconstructing missing records from chat messages and paper notes."
        ]
      }
    ]
  },
  {
    slug: "geotagged-accountability",
    title: "Why geo-tagged submissions improve accountability",
    summary:
      "A practical view of how proof-of-visit and location-aware forms support field accountability.",
    intro:
      "Location evidence is most useful when it supports field operations instead of turning into noise.",
    sections: [
      {
        heading: "Proof of visit becomes reviewable",
        body: [
          "A geo-tag plus proof photo gives supervisors a fast way to review whether the mission happened in the right place.",
          "That is especially useful for storefront checks, spot audits, and time-sensitive verification drives."
        ]
      },
      {
        heading: "Escalations get sharper",
        body: [
          "If a record is outside the expected radius or missing evidence, the review queue can flag it immediately.",
          "That lets teams resolve issues while the field context is still fresh."
        ]
      }
    ]
  }
];

export function getResourceArticle(slug: string) {
  return resourceArticles.find((article) => article.slug === slug) ?? null;
}
