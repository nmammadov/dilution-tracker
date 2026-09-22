import { daysBetween, formatDate, formatPct, formatShares, formatUsd } from "./format";
import { deriveCash, overhangRatio, overhangShareCount } from "./metrics";
import { THRESHOLDS } from "./thresholds";
import type { AnalysisInput, CapitalEvent, ScoreCard, ScoreLevel } from "./types";

function inWindow(event: CapitalEvent, asOf: string): boolean {
  const days = daysBetween(event.date, asOf);
  return days != null && days >= 0 && days <= THRESHOLDS.historicalDays;
}

function isRaise(event: CapitalEvent): boolean {
  return event.kind === "equity-raise" || event.kind === "atm-draw" || event.kind === "eloc-draw";
}

export function scoreAnalysis(input: AnalysisInput): ScoreCard[] {
  const offeringAbility = scoreOfferingAbility(input);
  const overheadSupply = scoreOverhead(input);
  const historical = scoreHistorical(input);
  const cashNeed = scoreCashNeed(input);
  const overall = scoreOverall(offeringAbility, overheadSupply, historical, cashNeed);
  return [overall, offeringAbility, overheadSupply, historical, cashNeed];
}

function scoreOfferingAbility(input: AnalysisInput): ScoreCard {
  const reasons: string[] = [];
  const facilities = input.instruments.filter(
    (item) =>
      (item.kind === "atm" || item.kind === "eloc") &&
      item.usable &&
      (item.remainingDollars ?? 0) >= THRESHOLDS.facilityUsd,
  );
  for (const facility of facilities) {
    const pause = facility.paused
      ? " A contractual pause is still in force, and the capacity is counted because the pause is temporary."
      : "";
    reasons.push(
      `${facility.name} has about ${formatUsd(facility.remainingDollars)} remaining.${pause}`,
    );
  }

  const shelves = input.instruments.filter(
    (item) =>
      item.kind === "shelf" && item.usable && (item.remainingDollars ?? 0) >= THRESHOLDS.shelfUsd,
  );
  for (const shelf of shelves) {
    reasons.push(
      `${shelf.name} is an effective shelf with about ${formatUsd(shelf.remainingDollars)} remaining.`,
    );
  }

  const outstanding = input.profile.sharesOutstanding;
  const nearTerm = input.instruments.reduce(
    (sum, item) => sum + (item.nearTermIssuanceShares ?? 0),
    0,
  );
  if (outstanding != null && outstanding > 0 && nearTerm / outstanding >= THRESHOLDS.nearTermRatio) {
    reasons.push(
      `Near-term exercisable or convertible issuance is ${formatShares(nearTerm)} shares, ${formatPct(nearTerm / outstanding)} of shares outstanding.`,
    );
  }

  const authorized = input.profile.authorizedShares;
  const raises = input.events.filter((event) => inWindow(event, input.analysisAsOf) && isRaise(event));
  if (
    authorized != null &&
    outstanding != null &&
    outstanding > 0 &&
    authorized > outstanding &&
    (authorized - outstanding) / outstanding >= THRESHOLDS.headroomMultiple &&
    raises.length >= 1
  ) {
    const multiple = (authorized - outstanding) / outstanding;
    reasons.push(
      `Authorized but unissued shares are about ${multiple.toFixed(0)}× shares outstanding, and the company raised equity inside the lookback window.`,
    );
  }

  return {
    id: "offeringAbility",
    label: "Offering Ability",
    level: reasons.length > 0 ? "High" : "Low",
    why:
      reasons.length > 0
        ? reasons.join(" ")
        : `No ATM or ELOC with at least ${formatUsd(THRESHOLDS.facilityUsd)} remaining, no effective shelf of at least ${formatUsd(THRESHOLDS.shelfUsd)}, and no large near-term issuance or authorized-headroom pattern. Unknown remaining capacity does not raise this score.`,
  };
}

function scoreOverhead(input: AnalysisInput): ScoreCard {
  const outstanding = input.profile.sharesOutstanding;
  const overhang = overhangShareCount(input.instruments);
  if (outstanding == null || outstanding <= 0) {
    return {
      id: "overheadSupply",
      label: "Overhead Supply",
      level: "Low",
      why: "Shares outstanding are missing, so warrant, convertible, and resale overhang cannot be sized. Overhead Supply stays Low.",
    };
  }
  if (overhang == null) {
    return {
      id: "overheadSupply",
      label: "Overhead Supply",
      level: "Low",
      why: "Warrant, convertible, and resale share counts were not found in the parsed filings. Overhead Supply stays Low until those figures are present.",
    };
  }
  const ratio = overhang / outstanding;
  const level: ScoreLevel = ratio >= THRESHOLDS.overhangRatio ? "High" : "Low";
  const parts = input.instruments
    .filter((item) => (item.overhangShares ?? 0) > 0)
    .map((item) => `${item.name} ${formatShares(item.overhangShares)}`);
  const breakdown = parts.length > 0 ? ` Included: ${parts.join("; ")}.` : "";
  return {
    id: "overheadSupply",
    label: "Overhead Supply",
    level,
    why: `Overhang of ${formatShares(overhang)} shares is ${formatPct(ratio)} of ${formatShares(outstanding)} shares outstanding. The High cutoff is ${THRESHOLDS.overhangRatio * 100}%.${breakdown}`,
  };
}

function scoreHistorical(input: AnalysisInput): ScoreCard {
  const windowed = input.events.filter((event) => inWindow(event, input.analysisAsOf));
  const raises = windowed.filter(isRaise);
  const splits = windowed.filter((event) => event.kind === "reverse-split");
  const draws = windowed.filter((event) => event.kind === "atm-draw" || event.kind === "eloc-draw");
  const high =
    raises.length >= 2 ||
    splits.length >= 2 ||
    (splits.length >= 1 && raises.length >= 1) ||
    draws.length >= 2;
  const asOf = formatDate(input.analysisAsOf);
  return {
    id: "historical",
    label: "Historical",
    level: high ? "High" : "Low",
    why: high
      ? `In the ~24 months ending ${asOf}: ${raises.length} equity raise${raises.length === 1 ? "" : "s"} or program draw${raises.length === 1 ? "" : "s"}, ${draws.length} ATM or ELOC draw${draws.length === 1 ? "" : "s"}, and ${splits.length} reverse split${splits.length === 1 ? "" : "s"}.`
      : `In the ~24 months ending ${asOf}: ${raises.length} equity raise(s), ${draws.length} ATM or ELOC draw(s), and ${splits.length} reverse split(s). That is below the repeat-issuer cutoff.`,
  };
}

function scoreCashNeed(input: AnalysisInput): ScoreCard {
  const cash = deriveCash(input.cash);
  const reasons: string[] = [];
  if (input.cash.goingConcern) {
    reasons.push(
      input.cash.goingConcernNote ??
        "The filing discloses substantial doubt about continuing as a going concern.",
    );
  }
  if (cash.runwayMonths != null && cash.runwayMonths <= THRESHOLDS.runwayMonths) {
    reasons.push(
      `Unrestricted cash of ${formatUsd(cash.unrestrictedCash)} versus trailing operating burn of ${formatUsd(cash.monthlyBurn)} per month is about ${cash.runwayMonths.toFixed(1)} months of runway. The High cutoff is ${THRESHOLDS.runwayMonths} months.`,
    );
  }
  if (reasons.length > 0) {
    return {
      id: "cashNeed",
      label: "Cash Need",
      level: "High",
      why: reasons.join(" "),
    };
  }
  if (cash.runwayMonths != null) {
    return {
      id: "cashNeed",
      label: "Cash Need",
      level: "Low",
      why: `Runway is about ${cash.runwayMonths.toFixed(1)} months and no going-concern statement was flagged. The High cutoff is ${THRESHOLDS.runwayMonths} months or a going-concern disclosure.`,
    };
  }
  return {
    id: "cashNeed",
    label: "Cash Need",
    level: "Low",
    why: "No going-concern statement was detected, and runway could not be computed from cash and operating cash flow. Missing evidence stays Low.",
  };
}

function scoreOverall(
  offeringAbility: ScoreCard,
  overheadSupply: ScoreCard,
  historical: ScoreCard,
  cashNeed: ScoreCard,
): ScoreCard {
  const components = [offeringAbility, overheadSupply, historical, cashNeed];
  const highCount = components.filter((score) => score.level === "High").length;
  const cashAndPath =
    cashNeed.level === "High" &&
    (offeringAbility.level === "High" || overheadSupply.level === "High");
  const level: ScoreLevel = cashAndPath || highCount >= 3 ? "High" : "Low";
  const snapshot = `Cash Need ${cashNeed.level}, Offering Ability ${offeringAbility.level}, Overhead Supply ${overheadSupply.level}, Historical ${historical.level}.`;
  const why = cashAndPath
    ? `${snapshot} Overall is High because Cash Need is High and ${
        offeringAbility.level === "High" && overheadSupply.level === "High"
          ? "both Offering Ability and Overhead Supply are High"
          : offeringAbility.level === "High"
            ? "Offering Ability is High"
            : "Overhead Supply is High"
      } (${highCount} of 4 components High).`
    : highCount >= 3
      ? `${snapshot} Overall is High because ${highCount} of 4 components are High.`
      : `${snapshot} Overall stays Low unless Cash Need is High and Offering Ability or Overhead Supply is High, or at least 3 components are High.`;
  return { id: "overall", label: "Overall Risk", level, why };
}

export function buildLikelihood(input: AnalysisInput, scores: ScoreCard[]): string {
  const level = Object.fromEntries(scores.map((score) => [score.id, score.level])) as Record<
    ScoreCard["id"],
    ScoreLevel
  >;
  const cash = deriveCash(input.cash);
  const sentences: string[] = [];

  if (level.overall === "High" && level.cashNeed === "High") {
    sentences.push("Offering likelihood is elevated.");
  } else if (level.overall === "High") {
    sentences.push(
      "Several dilution signals are High together, so offering likelihood stays elevated even without a High cash-need score.",
    );
  } else if (level.cashNeed === "High") {
    sentences.push(
      "Cash is tight, but this screen does not also show a ready issuance path or a large overhang, so it stops short of a high offering-likelihood call.",
    );
  } else {
    sentences.push("Offering likelihood looks quieter on this screen.");
  }

  if (input.cash.goingConcern) {
    sentences.push("The source filing includes going-concern language.");
  }
  if (cash.runwayMonths != null) {
    sentences.push(
      `Unrestricted cash covers about ${cash.runwayMonths.toFixed(1)} months of trailing operating burn.`,
    );
  }

  const eloc = input.instruments.find(
    (item) =>
      item.kind === "eloc" && item.usable && (item.remainingDollars ?? 0) >= THRESHOLDS.facilityUsd,
  );
  if (eloc) {
    sentences.push(
      eloc.paused
        ? `An equity line still shows about ${formatUsd(eloc.remainingDollars)} remaining, under a contractual pause rather than a termination.`
        : `An equity line still shows about ${formatUsd(eloc.remainingDollars)} remaining.`,
    );
  }

  const ratio = overhangRatio(input);
  if (ratio != null && ratio >= THRESHOLDS.overhangRatio) {
    sentences.push(
      `Warrant, convertible, and resale overhang is about ${formatPct(ratio)} of shares outstanding.`,
    );
  }
  if (level.historical === "High") {
    sentences.push("Raises or reverse splits inside the two-year window fit a repeat-issuer pattern.");
  }
  sentences.push("This is a research heuristic, not a prediction of timing or terms.");
  return sentences.join(" ");
}
