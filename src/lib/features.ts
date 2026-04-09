export const featureFlags = {
  trustOps: true,
  conditionalForms: true,
  multilingualForms: true,
  voiceAssist: true,
  commandCenter: true,
  predictivePlanning: true,
  campaignPlatform: true
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlagName) {
  return featureFlags[flag];
}
