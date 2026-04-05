import "server-only";

import { isFirebaseAdminConfigured, isFirebaseClientConfigured } from "@/lib/env";

export type RuntimeBackendMode = "live-firebase" | "review-safe";

export function getServerRuntimeMode(): RuntimeBackendMode {
  return isFirebaseAdminConfigured && isFirebaseClientConfigured
    ? "live-firebase"
    : "review-safe";
}

export function isLiveFirebaseMode() {
  return getServerRuntimeMode() === "live-firebase";
}

export function getRuntimeModeLabel(mode = getServerRuntimeMode()) {
  return mode === "live-firebase" ? "Live Firebase" : "Review-safe local mode";
}
