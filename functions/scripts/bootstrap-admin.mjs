#!/usr/bin/env node
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <admin-email>");
  process.exit(1);
}

initializeApp({
  credential: cert({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    projectId: process.env.FIREBASE_PROJECT_ID
  })
});

const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, {
  role: "admin",
  projectId: null,
  districts: ["All Districts"],
  blocks: ["All Blocks"]
});

await db.collection("users").doc(user.uid).set(
  {
    uid: user.uid,
    name: user.displayName ?? email.split("@")[0],
    email,
    role: "admin",
    status: "active",
    projectId: null,
    assignmentLabel: "Platform administration",
    scopes: [{ district: "All Districts", block: "All Blocks" }],
    assignedTemplateVersion: "template-unassigned",
    createdAt: new Date().toISOString()
  },
  { merge: true }
);

console.log(`Bootstrapped ${email} as the first CensusSync admin.`);
