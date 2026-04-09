const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  firebaseMeasurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  useDemoMode: process.env.NEXT_PUBLIC_USE_DEMO_MODE !== "false",
  reviewSafeMode: process.env.NEXT_PUBLIC_REVIEW_SAFE_MODE === "true"
};

export const env = {
  ...clientEnv,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  firebaseProjectIdServer: process.env.FIREBASE_PROJECT_ID,
  firebaseStorageBucketServer: process.env.FIREBASE_STORAGE_BUCKET,
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  sessionCookieName:
    process.env.FIREBASE_SESSION_COOKIE_NAME ?? "censussync_session",
  demoSessionCookieName:
    process.env.DEMO_SESSION_COOKIE_NAME ?? "censussync_demo_session"
};

export const isFirebaseClientConfigured = Boolean(
  env.firebaseApiKey &&
    env.firebaseAuthDomain &&
    env.firebaseProjectId &&
    env.firebaseStorageBucket &&
    env.firebaseMessagingSenderId &&
    env.firebaseAppId
);

export const isFirebaseAdminConfigured = Boolean(
  env.firebaseClientEmail &&
    env.firebasePrivateKey &&
    env.firebaseProjectIdServer
);

export const isReviewSafeMode = env.reviewSafeMode || !isFirebaseClientConfigured;

export const runtimeMode = isReviewSafeMode ? "review-safe" : "live-firebase";

export const runtimeModeLabel =
  runtimeMode === "review-safe" ? "Review-safe local mode" : "Live Firebase";

export const isDemoMode =
  env.useDemoMode || isReviewSafeMode || !isFirebaseClientConfigured;
