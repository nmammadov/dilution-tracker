import type { AnalysisInput, CashFacts, CashView, Instrument } from "./types";

export function deriveCash(cash: CashFacts): CashView {
  const subtractRestricted = cash.restrictedIncludedInTotal !== false;
  const unrestrictedCash =
    cash.totalCash != null && cash.restrictedCash != null && subtractRestricted
      ? Math.max(0, cash.totalCash - cash.restrictedCash)
      : cash.totalCash;

  const monthlyBurn =
    cash.operatingCashFlow != null &&
    cash.operatingCashFlow < 0 &&
    cash.operatingCashFlowMonths != null &&
    cash.operatingCashFlowMonths > 0
      ? Math.abs(cash.operatingCashFlow) / cash.operatingCashFlowMonths
      : null;

  const runwayMonths =
    unrestrictedCash != null && monthlyBurn != null && monthlyBurn > 0
      ? unrestrictedCash / monthlyBurn
      : null;

  return { unrestrictedCash, monthlyBurn, runwayMonths };
}

export function overhangShareCount(instruments: Instrument[]): number | null {
  const counted = instruments.filter((item) => item.overhangShares != null);
  if (counted.length === 0) return null;
  return counted.reduce((sum, item) => sum + (item.overhangShares ?? 0), 0);
}

export function overhangRatio(input: AnalysisInput): number | null {
  const shares = input.profile.sharesOutstanding;
  const overhang = overhangShareCount(input.instruments);
  if (shares == null || shares <= 0 || overhang == null) return null;
  return overhang / shares;
}
