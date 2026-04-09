import type {
  AppLanguage,
  TemplateField,
  TemplateFieldRule,
  TemplateSection
} from "@/types/domain";

function asComparable(value: unknown) {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  return value;
}

export function evaluateTemplateRule(
  rule: TemplateFieldRule,
  answers: Record<string, unknown>
) {
  const value = answers[rule.fieldKey];
  const comparable = asComparable(value);
  const expected = asComparable(rule.value);

  switch (rule.operator) {
    case "equals":
      return comparable === expected;
    case "not_equals":
      return comparable !== expected;
    case "includes":
      return Array.isArray(value) ? value.includes(rule.value) : false;
    case "greater_than":
      return typeof value === "number" && typeof rule.value === "number"
        ? value > rule.value
        : false;
    case "less_than":
      return typeof value === "number" && typeof rule.value === "number"
        ? value < rule.value
        : false;
    case "is_true":
      return value === true;
    case "is_false":
      return value === false;
    default:
      return false;
  }
}

function everyRulePasses(rules: TemplateFieldRule[] | undefined, answers: Record<string, unknown>) {
  if (!rules?.length) {
    return true;
  }

  return rules.every((rule) => evaluateTemplateRule(rule, answers));
}

export function isTemplateFieldVisible(field: TemplateField, answers: Record<string, unknown>) {
  return everyRulePasses(field.visibilityRules, answers);
}

export function isTemplateFieldRequired(field: TemplateField, answers: Record<string, unknown>) {
  if (!isTemplateFieldVisible(field, answers)) {
    return false;
  }

  if (field.requiredRules?.length) {
    return everyRulePasses(field.requiredRules, answers);
  }

  return Boolean(field.required);
}

export function getTranslatedFieldCopy(field: TemplateField, language: AppLanguage) {
  const translated = field.translations?.[language];

  return {
    label: translated?.label ?? field.label,
    helperText: translated?.helperText ?? field.helperText,
    placeholder: translated?.placeholder ?? field.placeholder
  };
}

export function getTranslatedSectionCopy(section: TemplateSection, language: AppLanguage) {
  const translated = section.translations?.[language];

  return {
    title: translated?.title ?? section.title,
    description: translated?.description ?? section.description
  };
}
