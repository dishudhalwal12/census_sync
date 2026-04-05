import path from "node:path";

function hasValue(value) {
  return Boolean(value && String(value).trim());
}

const publicEnv = {
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.VITE_APP_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_FIREBASE_API_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY ?? "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    process.env.VITE_FIREBASE_AUTH_DOMAIN ??
    "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    "",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.VITE_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ??
    "",
  NEXT_PUBLIC_FIREBASE_APP_ID:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.VITE_FIREBASE_APP_ID ?? "",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ??
    process.env.VITE_FIREBASE_MEASUREMENT_ID ??
    "",
  NEXT_PUBLIC_USE_DEMO_MODE:
    process.env.NEXT_PUBLIC_USE_DEMO_MODE ?? process.env.VITE_USE_DEMO_MODE ?? "true"
};

const hasFirebaseClientEnv =
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) &&
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) &&
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) &&
  hasValue(publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID);

const hasFirebaseAdminEnv =
  hasValue(process.env.FIREBASE_CLIENT_EMAIL) &&
  hasValue(process.env.FIREBASE_PRIVATE_KEY) &&
  hasValue(process.env.FIREBASE_PROJECT_ID);

const resolvedPublicEnv = {
  ...publicEnv,
  NEXT_PUBLIC_REVIEW_SAFE_MODE: String(!(hasFirebaseClientEnv && hasFirebaseAdminEnv))
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  env: resolvedPublicEnv,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime !== "edge") {
      config.output.chunkFilename = "chunks/[name].js";
    }

    return config;
  }
};

export default nextConfig;
