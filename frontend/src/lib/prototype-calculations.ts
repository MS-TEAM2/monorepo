export type ProfitInputs = {
  monthlyRent: number;
  maintenance: number;
  payroll: number;
  otherFixedCosts: number;
  variableCostRate: number;
};

export function calculateBreakEvenRevenue({
  monthlyRent,
  maintenance,
  payroll,
  otherFixedCosts,
  variableCostRate,
}: ProfitInputs): number | null {
  const values = [monthlyRent, maintenance, payroll, otherFixedCosts, variableCostRate];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (variableCostRate >= 1) return null;

  return (monthlyRent + maintenance + payroll + otherFixedCosts) / (1 - variableCostRate);
}
