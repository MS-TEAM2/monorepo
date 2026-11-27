export type ContractStage = "upload" | "review" | "result";

export type ContractConditionId =
  "deposit" | "rent" | "maintenance" | "vat" | "term" | "increaseRate" | "earlyTermination" | "restoration";

export type ContractCondition = {
  id: ContractConditionId;
  label: string;
  description: string;
  value: string;
  confidence: number;
  evidence: string;
  unit?: string;
  inputKind?: "text" | "number" | "vat";
};

export type ContractRisk = {
  id: string;
  title: string;
  source: string;
  reviewPoint: string;
  question: string;
};

export type ExitInputs = {
  month: string;
  obligationMonths: string;
  restorationCost: string;
  penaltyAmount: string;
  penaltyCoversRemainingRent: "true" | "false" | "unknown";
};
