import type {
  AppLanguage,
  CoordinatePoint,
  MissionGeoCheck,
  TemplateField,
  TemplateVersion
} from "@/types/domain";
import {
  getTranslatedFieldCopy,
  getTranslatedSectionCopy,
  isTemplateFieldRequired,
  isTemplateFieldVisible
} from "@/lib/trust/forms";

export const GEO_CHECK_MAX_AGE_MS = 2 * 60 * 1000;

export function createMissionSubmissionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mission-${Date.now()}`;
}

export function createMissionDedupeKey(assignmentId: string, enumeratorId: string) {
  return `${assignmentId}::${enumeratorId}`;
}

export function calculateDistanceMeters(from: CoordinatePoint, to: CoordinatePoint) {
  const earthRadius = 6371e3;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isGeoCheckFresh(capturedAt?: string, maxAgeMs = GEO_CHECK_MAX_AGE_MS) {
  if (!capturedAt) {
    return false;
  }

  const capturedTime = new Date(capturedAt).getTime();
  if (Number.isNaN(capturedTime)) {
    return false;
  }

  return Date.now() - capturedTime <= maxAgeMs;
}

export function isMissionFieldComplete(field: TemplateField, value: unknown) {
  if (field.kind === "instruction") {
    return true;
  }

  if (value === undefined || value === null) {
    return false;
  }

  if (field.kind === "boolean") {
    return typeof value === "boolean";
  }

  if (field.kind === "multi_select") {
    return Array.isArray(value) && value.length > 0;
  }

  if (field.kind === "number") {
    return typeof value === "number" && !Number.isNaN(value);
  }

  return String(value).trim().length > 0;
}

export function validateMissionAnswers(
  template: TemplateVersion,
  answers: Record<string, unknown>,
  language: AppLanguage = "en"
) {
  const errors: Record<string, string> = {};

  template.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!isTemplateFieldVisible(field, answers)) {
        return;
      }

      const value = answers[field.key];
      const copy = getTranslatedFieldCopy(field, language);

      if (isTemplateFieldRequired(field, answers) && !isMissionFieldComplete(field, value)) {
        errors[field.key] = `${copy.label} is required.`;
        return;
      }

      if (value === undefined || value === null || value === "") {
        return;
      }

      if (field.kind === "number" || field.type === "number") {
        if (typeof value !== "number" || Number.isNaN(value)) {
          errors[field.key] = `${copy.label} must be a number.`;
          return;
        }

        if (typeof field.validation?.min === "number" && value < field.validation.min) {
          errors[field.key] = `${copy.label} must be at least ${field.validation.min}.`;
        }

        if (typeof field.validation?.max === "number" && value > field.validation.max) {
          errors[field.key] = `${copy.label} must be ${field.validation.max} or less.`;
        }
      }

      if (
        (field.kind === "text" || field.kind === "textarea" || !field.kind) &&
        typeof value === "string"
      ) {
        if (
          typeof field.validation?.minLength === "number" &&
          value.trim().length < field.validation.minLength
        ) {
          errors[field.key] = `${copy.label} is too short.`;
        }

        if (
          typeof field.validation?.maxLength === "number" &&
          value.trim().length > field.validation.maxLength
        ) {
          errors[field.key] = `${copy.label} is too long.`;
        }
      }
    });
  });

  return errors;
}

export function getMissionRequiredCounts(
  template: TemplateVersion,
  answers: Record<string, unknown>
) {
  const requiredFields = template.sections.flatMap((section) =>
    section.fields.filter(
      (field) =>
        isTemplateFieldVisible(field, answers) &&
        isTemplateFieldRequired(field, answers) &&
        field.kind !== "instruction"
    )
  );

  return {
    required: requiredFields.length,
    completed: requiredFields.filter((field) =>
      isMissionFieldComplete(field, answers[field.key])
    ).length
  };
}

export function getMissionSectionCopy(template: TemplateVersion, sectionId: string, language: AppLanguage) {
  const section = template.sections.find((entry) => entry.id === sectionId);
  return section ? getTranslatedSectionCopy(section, language) : null;
}

export function getMissionFieldCopy(field: TemplateField, language: AppLanguage) {
  return getTranslatedFieldCopy(field, language);
}

export async function fingerprintBlob(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function sanitizeStorageName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

export function buildMissionGeoCheck(params: {
  location: GeolocationPosition["coords"];
  siteCenter: CoordinatePoint;
  radiusMeters?: number;
}): MissionGeoCheck {
  const distanceMeters = calculateDistanceMeters(
    { latitude: params.location.latitude, longitude: params.location.longitude },
    params.siteCenter
  );

  return {
    latitude: params.location.latitude,
    longitude: params.location.longitude,
    accuracy: params.location.accuracy,
    capturedAt: new Date().toISOString(),
    distanceMeters: Math.round(distanceMeters),
    withinRange: distanceMeters <= (params.radiusMeters ?? 1000)
  };
}
