import "server-only";

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { env, isFirebaseAdminConfigured } from "@/lib/env";

export function getFirebaseAdminApp() {
  if (!isFirebaseAdminConfigured) {
    return null;
  }

  if (getApps().length) {
    return getApps()[0]!;
  }

  return initializeApp({
    credential: cert({
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey,
      projectId: env.firebaseProjectIdServer
    }),
    storageBucket: env.firebaseStorageBucketServer,
    databaseURL: env.firebaseDatabaseUrl
  });
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminDb() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}

export function getAdminStorage() {
  const app = getFirebaseAdminApp();
  return app ? getStorage(app) : null;
}
