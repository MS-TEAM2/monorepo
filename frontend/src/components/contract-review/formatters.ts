import type { ContractCondition } from "./types";

export function formatConditionValue(condition: ContractCondition, value: string): string {
  if (condition.inputKind === "number" && value) {
    const digits = value.replace(/[^\d]/g, "");
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return value;
}

export function normalizeConditionValue(condition: ContractCondition, value: string): string {
  if (condition.inputKind === "number") return value.replace(/[^\d]/g, "");
  return value.trim();
}
