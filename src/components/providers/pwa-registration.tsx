"use client";

import { useEffect } from "react";

const CACHE_PREFIX = "censussync-";

async function clearAppCaches() {
  if (!("caches" in window)) {
    return;
  }

  const cacheKeys = await window.caches.keys();

  await Promise.all(
    cacheKeys
      .filter((cacheKey) => cacheKey.startsWith(CACHE_PREFIX))
      .map((cacheKey) => window.caches.delete(cacheKey))
  );
}

async function unregisterExistingServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map((registration) => registration.unregister())
  );
}

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void unregisterExistingServiceWorkers()
        .then(clearAppCaches)
        .catch(() => {
          // Keep local development resilient even if cleanup is blocked by the browser.
        });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", {
        updateViaCache: "none"
      })
      .catch(() => {
        // Keep PWA registration best-effort so unsupported environments still load cleanly.
      });
  }, []);

  return null;
}
