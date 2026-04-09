import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { mutateReviewStore, readReviewCollection } from "@/lib/review-store/server";
import type { AuthSession } from "@/types/session";
import type { UserPrivateSettings } from "@/types/domain";

const geminiSettingsSchema = z.object({
  geminiApiKey: z.string().trim().optional(),
  geminiModel: z.string().trim().optional(),
  clear: z.boolean().optional()
});

function maskApiKey(value: string) {
  if (value.length <= 8) {
    return "Saved";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function listUserPrivateSettings() {
  const db = getAdminDb();

  if (!db) {
    return readReviewCollection<UserPrivateSettings>("user_private_settings");
  }

  const snapshot = await db.collection("user_private_settings").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as UserPrivateSettings);
}

async function upsertUserPrivateSettings(value: UserPrivateSettings) {
  const db = getAdminDb();

  if (!db) {
    return mutateReviewStore((draft) => {
      const index = draft.user_private_settings.findIndex((entry) => entry.uid === value.uid);
      if (index >= 0) {
        draft.user_private_settings[index] = value;
      } else {
        draft.user_private_settings.push(value);
      }

      return value;
    });
  }

  await db.collection("user_private_settings").doc(value.uid).set(value);
  return value;
}

async function deleteUserPrivateSettings(uid: string) {
  const db = getAdminDb();

  if (!db) {
    return mutateReviewStore((draft) => {
      draft.user_private_settings = draft.user_private_settings.filter(
        (entry) => entry.uid !== uid
      );
    });
  }

  await db.collection("user_private_settings").doc(uid).delete();
}

export async function getUserGeminiSettingsStatus(session: AuthSession) {
  const settings = await listUserPrivateSettings();
  const current = settings.find((entry) => entry.uid === session.uid);

  return {
    hasCustomGeminiApiKey: Boolean(current?.geminiApiKey),
    geminiApiKeyPreview: current?.geminiApiKey ? maskApiKey(current.geminiApiKey) : null,
    geminiModel: current?.geminiModel ?? env.geminiModel
  };
}

export async function getUserGeminiProviderConfig(uid: string) {
  const settings = await listUserPrivateSettings();
  const current = settings.find((entry) => entry.uid === uid);

  return {
    geminiApiKey: current?.geminiApiKey?.trim() || undefined,
    geminiModel: current?.geminiModel?.trim() || undefined
  };
}

export async function updateUserGeminiSettings(
  payload: unknown,
  session: AuthSession
) {
  const parsed = geminiSettingsSchema.parse(payload);
  const shouldClear = parsed.clear || !parsed.geminiApiKey;

  if (shouldClear) {
    await deleteUserPrivateSettings(session.uid);

    return {
      hasCustomGeminiApiKey: false,
      geminiApiKeyPreview: null,
      geminiModel: env.geminiModel,
      message: "Personal Gemini API key removed. The shared workspace key will be used."
    };
  }

  const geminiApiKey = parsed.geminiApiKey?.trim() ?? "";
  if (geminiApiKey.length < 20) {
    throw new Error("Enter a valid Gemini API key.");
  }

  const value: UserPrivateSettings = {
    id: session.uid,
    uid: session.uid,
    geminiApiKey,
    geminiModel: parsed.geminiModel?.trim() || env.geminiModel,
    updatedAt: new Date().toISOString()
  };

  await upsertUserPrivateSettings(value);

  return {
    hasCustomGeminiApiKey: true,
    geminiApiKeyPreview: maskApiKey(geminiApiKey),
    geminiModel: value.geminiModel,
    message: "Personal Gemini API key saved. Draft generation will use it for your account."
  };
}
