import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

import { env, isFirebaseClientConfigured } from "@/lib/env";

let firebaseApp: FirebaseApp | null = null;

export function getFirebaseClientApp() {
  if (!isFirebaseClientConfigured) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: env.firebaseApiKey,
        authDomain: env.firebaseAuthDomain,
        projectId: env.firebaseProjectId,
        storageBucket: env.firebaseStorageBucket,
        messagingSenderId: env.firebaseMessagingSenderId,
        appId: env.firebaseAppId,
        measurementId: env.firebaseMeasurementId
      });

  return firebaseApp;
}

export const firebaseAuth = (() => {
  const app = getFirebaseClientApp();
  return app ? getAuth(app) : null;
})();

export const firebaseDb = (() => {
  const app = getFirebaseClientApp();
  return app ? getFirestore(app) : null;
})();

export const firebaseFunctions = (() => {
  const app = getFirebaseClientApp();
  return app ? getFunctions(app, "asia-south1") : null;
})();

export const firebaseStorage = (() => {
  const app = getFirebaseClientApp();
  return app ? getStorage(app) : null;
})();
