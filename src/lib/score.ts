import { daysBetween, formatDate, formatPct, formatShares, formatUsd, formatUsdExact } from "./format";
import { deriveCash, overhangRatio, overhangShareCount } from "./metrics";
import { THRESHOLDS } from "./thresholds";
import type {
  AnalysisInput,
  CapitalEvent,
  EvidenceInput,
  FilingLink,
  Instrument,
  ScoreCard,
  ScoreLevel,
} from "./types";

const OFFERING_FORMULA =
  "Offering Ability is High when any one path is true: an ATM or ELOC is still in place with remaining capacity of at least $1 million (a contractual pause still counts), an effective shelf has remaining capacity of at least $5 million, near-term exercisable or convertible shares are at least 50% of shares outstanding, or authorized-but-unissued shares are at least 10× shares outstanding and the company raised equity in the lookback. A cited registration or program size is not remaining capacity unless the filing states what is still unsold and usable. Market cap is shown only as scale.";

const OVERHEAD_FORMULA =
  "Overhead Supply is High when warrant shares + convertible shares + resale-registered shares are at least 50% of shares outstanding. Count a resale block once if those shares are already inside the warrant total. Missing share counts stay Low.";

const HISTORICAL_FORMULA =
  "Historical is High when the 731 days (about 24 months) before the analysis date include at least two equity raises, at least two reverse splits, one reverse split plus one equity raise, or at least two ATM or ELOC draws. PIPE, registered deals, ATM draws, and ELOC draws all count as raises.";

const CASH_FORMULA =
  "Cash Need is High when the filing discloses substantial doubt about continuing as a going concern, or when unrestricted cash covers 9 months or less of trailing operating burn. Unrestricted cash is total cash minus restricted cash when both are known. Monthly burn is the absolute value of negative operating cash flow divided by the length of that period. Positive operating cash flow does not create a burn rate. Missing cash evidence stays Low.";

const OVERALL_FORMULA =
  "Overall Risk is High when Cash Need is High and either Offering Ability or Overhead Supply is High, or when at least 3 of those 4 component scores are High. Cash Need alone is not enough.";

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
  const fired: string[] = [];
  const inputs: EvidenceInput[] = [];
  const shelves = input.instruments.filter((item) => item.kind === "shelf");
  const atms = input.instruments.filter((item) => item.kind === "atm");
  const elocs = input.instruments.filter((item) => item.kind === "eloc");

  if (shelves.length === 0) {
    inputs.push({
      label: "S-3 / S-3ASR shelf",
      value: "No shelf line in this model",
      note: "A form on the filing index without a parsed remaining dollar amount does not raise this score.",
      href: firstUrl(filingsMatching(input, /^S-3|^F-3/)),
    });
  }
  for (const shelf of shelves) {
    const remaining = shelf.remainingDollars;
    const clears = shelf.usable && (remaining ?? 0) >= THRESHOLDS.shelfUsd;
    if (clears) fired.push(`${shelf.name} remaining ${formatUsdExact(remaining)} ≥ ${formatUsdExact(THRESHOLDS.shelfUsd)}`);
    inputs.push({
      label: `Shelf · ${shelf.name}`,
      value: `Remaining ${moneyOrBlank(remaining)} · Registered ${moneyOrBlank(shelf.registeredDollars ?? null)}`,
      note: `${shelf.status}${shelf.notes ? ` ${shelf.notes}` : ""}`,
      href: shelf.edgarUrl,
    });
  }

  if (atms.length === 0) {
    inputs.push({
      label: "ATM",
      value: "No ATM line in this model",
      note: "Remaining capacity and sales agent were not found.",
      href: firstUrl(filingsMatching(input, /^424B/)),
    });
  }
  for (const atm of atms) {
    const remaining = atm.remainingDollars;
    const clears = atm.usable && (remaining ?? 0) >= THRESHOLDS.facilityUsd;
    if (clears) fired.push(`ATM remaining ${formatUsdExact(remaining)} ≥ ${formatUsdExact(THRESHOLDS.facilityUsd)}`);
    inputs.push({
      label: "ATM remaining capacity",
      value: `${moneyOrBlank(remaining)} remaining`,
      note: agentNote(atm),
      href: atm.edgarUrl,
    });
    if (atm.agent || atm.registeredDollars != null) {
      inputs.push({
        label: "ATM agent and program size",
        value: `${atm.agent ?? "Agent not stated"} · program ${moneyOrBlank(atm.registeredDollars ?? null)}`,
        note: "Program size is not remaining capacity. Only a stated remainder of at least $1 million raises Offering Ability.",
        href: atm.edgarUrl,
      });
    }
  }

  if (elocs.length === 0) {
    inputs.push({
      label: "ELOC remaining commitment",
      value: "No equity line in this model",
      note: null,
      href: null,
    });
  }
  for (const eloc of elocs) {
    const remaining = eloc.remainingDollars;
    const clears = eloc.usable && (remaining ?? 0) >= THRESHOLDS.facilityUsd;
    if (clears) {
      fired.push(
        `ELOC remaining ${formatUsdExact(remaining)} ≥ ${formatUsdExact(THRESHOLDS.facilityUsd)}${eloc.paused ? " (paused, still counted)" : ""}`,
      );
    }
    inputs.push({
      label: "ELOC remaining commitment",
      value: `${moneyOrBlank(remaining)} remaining${eloc.agent ? ` · ${eloc.agent}` : ""}`,
      note: `${eloc.status}${eloc.notes ? ` ${eloc.notes}` : ""}`,
      href: eloc.edgarUrl,
    });
  }

  const outstanding = input.profile.sharesOutstanding;
  const nearTerm = input.instruments.reduce((sum, item) => sum + (item.nearTermIssuanceShares ?? 0), 0);
  const nearRatio = outstanding != null && outstanding > 0 ? nearTerm / outstanding : null;
  if (nearRatio != null && nearRatio >= THRESHOLDS.nearTermRatio) {
    fired.push(
      `Near-term issuance ${formatShares(nearTerm)} is ${formatPct(nearRatio)} of shares outstanding ≥ ${THRESHOLDS.nearTermRatio * 100}%`,
    );
  }
  inputs.push({
    label: "Near-term exercisable issuance",
    value:
      nearRatio == null
        ? "Shares outstanding missing"
        : `${formatShares(nearTerm)} shares · ${formatPct(nearRatio)} of ${formatShares(outstanding)} outstanding`,
    note: `High if this is at least ${THRESHOLDS.nearTermRatio * 100}%. Milestone-gated warrants are excluded.`,
    href: null,
  });

  const authorized = input.profile.authorizedShares;
  const raises = input.events.filter((event) => inWindow(event, input.analysisAsOf) && isRaise(event));
  const headroom =
    authorized != null && outstanding != null && outstanding > 0 && authorized > outstanding
      ? (authorized - outstanding) / outstanding
      : null;
  const headroomClears = headroom != null && headroom >= THRESHOLDS.headroomMultiple && raises.length >= 1;
  if (headroomClears && headroom != null) {
    fired.push(
      `Authorized headroom ${headroom.toFixed(1)}× ≥ ${THRESHOLDS.headroomMultiple}× and ${raises.length} equity raise(s) in the window ≥ 1`,
    );
  }
  inputs.push({
    label: "Authorized headroom",
    value:
      headroom == null
        ? `Authorized ${formatShares(authorized)} · outstanding ${formatShares(outstanding)}`
        : `${headroom.toFixed(1)}× unused authorized shares · ${raises.length} equity raise(s) in the lookback`,
    note: `High only when headroom is at least ${THRESHOLDS.headroomMultiple}× and there is at least one equity raise in the window.`,
    href: input.cash.sourceUrl,
  });

  const usableRemaining = [...atms, ...elocs, ...shelves]
    .filter((item) => item.usable)
    .reduce((sum, item) => sum + (item.remainingDollars ?? 0), 0);
  if (input.profile.marketCap != null && input.profile.marketCap > 0 && usableRemaining > 0) {
    inputs.push({
      label: "Usable remaining capacity vs market cap",
      value: `${formatUsd(usableRemaining)} is ${formatPct(usableRemaining / input.profile.marketCap)} of ${formatUsd(input.profile.marketCap)} market cap`,
      note: "Context only. Offering Ability does not use a percent-of-market-cap cutoff.",
      href: null,
    });
  }

  const level: ScoreLevel = fired.length > 0 ? "High" : "Low";
  const shelfRemaining = sumRemaining(shelves.filter((item) => item.usable));
  const atmRemaining = sumRemaining(atms.filter((item) => item.usable));
  const elocRemaining = sumRemaining(elocs.filter((item) => item.usable));
  const numericLine = `Shelf remaining ${blankOrMoney(shelfRemaining)} + ATM remaining ${blankOrMoney(atmRemaining)} + ELOC remaining ${blankOrMoney(elocRemaining)} → Offering Ability ${level.toUpperCase()} because ${
    level === "High"
      ? fired[0]
      : `none of the paths clear (ATM/ELOC ≥ ${formatUsd(THRESHOLDS.facilityUsd)}, shelf remaining ≥ ${formatUsd(THRESHOLDS.shelfUsd)}, near-term ≥ ${THRESHOLDS.nearTermRatio * 100}%, or headroom ≥ ${THRESHOLDS.headroomMultiple}× with a recent raise)`
  }.`;

  return {
    id: "offeringAbility",
    label: "Offering Ability",
    level,
    why: level === "High" ? fired.join(" ") : numericLine,
    formula: OFFERING_FORMULA,
    numericLine,
    decision:
      level === "High"
        ? `High because ${fired.join("; ")}.`
        : `Low because no ATM or ELOC remainder is ≥ ${formatUsdExact(THRESHOLDS.facilityUsd)}, no usable shelf remainder is ≥ ${formatUsdExact(THRESHOLDS.shelfUsd)}, near-term issuance is under ${THRESHOLDS.nearTermRatio * 100}%, and the authorized-headroom rule did not clear.`,
    inputs,
    sources: dedupeSources([
      ...shelves.map(linkFromInstrument),
      ...atms.map(linkFromInstrument),
      ...elocs.map(linkFromInstrument),
      ...filingsMatching(input, /^(S-3|S-3\/A|S-3ASR|F-3|F-3ASR|424B|S-1|10-Q|10-K)/),
    ]),
  };
}

function scoreOverhead(input: AnalysisInput): ScoreCard {
  const outstanding = input.profile.sharesOutstanding;
  const overhang = overhangShareCount(input.instruments);
  const parts = input.instruments.filter((item) => item.overhangShares != null);
  const inputs: EvidenceInput[] = parts.map((item) => ({
    label: item.name,
    value: `${formatShares(item.overhangShares)} shares`,
    note: item.notes,
    href: item.edgarUrl,
  }));
  inputs.push({
    label: "Shares outstanding",
    value: outstanding == null ? "Not available" : formatShares(outstanding),
    note: input.profile.sharesOutstandingAsOf
      ? `Count dated ${formatDate(input.profile.sharesOutstandingAsOf)}.`
      : null,
    href: input.cash.sourceUrl,
  });

  if (outstanding == null || outstanding <= 0 || overhang == null) {
    const numericLine =
      "Warrant + convertible + resale shares could not be divided by shares outstanding → Overhead Supply LOW because the ratio is missing.";
    return {
      id: "overheadSupply",
      label: "Overhead Supply",
      level: "Low",
      why: numericLine,
      formula: OVERHEAD_FORMULA,
      numericLine,
      decision: "Low because shares outstanding or the overhang share count is missing. Missing evidence stays Low.",
      inputs,
      sources: dedupeSources([
        ...parts.map(linkFromInstrument),
        ...filingsMatching(input, /^(10-Q|10-K|S-1|S-3)/),
      ]),
    };
  }

  const ratio = overhang / outstanding;
  const level: ScoreLevel = ratio >= THRESHOLDS.overhangRatio ? "High" : "Low";
  const breakdown = parts
    .filter((item) => (item.overhangShares ?? 0) > 0)
    .map((item) => `${formatShares(item.overhangShares)} ${item.name}`)
    .join(" + ");
  const numericLine = `${breakdown || formatShares(overhang)} = ${formatShares(overhang)} / ${formatShares(outstanding)} shares outstanding = ${formatPct(ratio)} → Overhead Supply ${level.toUpperCase()} because overhang ${level === "High" ? "≥" : "<"} ${THRESHOLDS.overhangRatio * 100}%.`;
  inputs.unshift({
    label: "Overhang ratio",
    value: `${formatPct(ratio)} (${formatShares(overhang)} / ${formatShares(outstanding)})`,
    note: `Threshold is ${THRESHOLDS.overhangRatio * 100}%.`,
    href: null,
  });
  return {
    id: "overheadSupply",
    label: "Overhead Supply",
    level,
    why: numericLine,
    formula: OVERHEAD_FORMULA,
    numericLine,
    decision: `${level} because ${formatPct(ratio)} ${level === "High" ? "≥" : "<"} ${THRESHOLDS.overhangRatio * 100}% of shares outstanding.`,
    inputs,
    sources: dedupeSources([
      ...parts.map(linkFromInstrument),
      ...filingsMatching(input, /^(10-Q|10-K|S-1|S-3)/),
    ]),
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
  const level: ScoreLevel = high ? "High" : "Low";
  const asOf = formatDate(input.analysisAsOf);
  const reasons: string[] = [];
  if (raises.length >= 2) reasons.push(`${raises.length} equity raises ≥ 2`);
  if (splits.length >= 2) reasons.push(`${splits.length} reverse splits ≥ 2`);
  if (splits.length >= 1 && raises.length >= 1) reasons.push("at least one reverse split and one equity raise");
  if (draws.length >= 2) reasons.push(`${draws.length} ATM or ELOC draws ≥ 2`);
  const numericLine = `${raises.length} equity raises + ${draws.length} ATM/ELOC draws + ${splits.length} reverse splits in the 731 days ending ${asOf} → Historical ${level.toUpperCase()} because ${
    high ? reasons[0] : "none of the repeat-issuer tests cleared"
  }.`;
  const inputs: EvidenceInput[] = [
    {
      label: "Equity raises in the window",
      value: String(raises.length),
      note: "PIPE, registered offerings, ATM draws, and ELOC draws.",
      href: raises[0]?.edgarUrl ?? null,
    },
    {
      label: "ATM or ELOC draws in the window",
      value: String(draws.length),
      note: "High on this test alone at 2 or more.",
      href: draws[0]?.edgarUrl ?? null,
    },
    {
      label: "Reverse splits in the window",
      value: String(splits.length),
      note: "High on this test alone at 2 or more, or at 1 if there is also a raise.",
      href: splits[0]?.edgarUrl ?? null,
    },
  ];
  for (const event of windowed) {
    inputs.push({
      label: `${formatDate(event.date)} · ${event.label}`,
      value: event.proceeds != null ? formatUsdExact(event.proceeds) : event.kind,
      note: event.notes,
      href: event.edgarUrl,
    });
  }
  return {
    id: "historical",
    label: "Historical",
    level,
    why: numericLine,
    formula: HISTORICAL_FORMULA,
    numericLine,
    decision: high
      ? `High because ${reasons.join("; ")}.`
      : `Low because the window has ${raises.length} raise(s), ${draws.length} draw(s), and ${splits.length} reverse split(s).`,
    inputs,
    sources: dedupeSources([
      ...windowed.map((event) =>
        event.edgarUrl
          ? { form: event.label, filed: event.date, description: event.notes ?? event.label, url: event.edgarUrl }
          : null,
      ),
      ...filingsMatching(input, /^(8-K|424B|S-1|S-3|10-Q|10-K)/),
    ]),
  };
}

function scoreCashNeed(input: AnalysisInput): ScoreCard {
  const cash = deriveCash(input.cash);
  const fired: string[] = [];
  if (input.cash.goingConcern) fired.push("going-concern language is present");
  if (cash.runwayMonths != null && cash.runwayMonths <= THRESHOLDS.runwayMonths) {
    fired.push(
      `runway ${cash.runwayMonths.toFixed(1)} months ≤ ${THRESHOLDS.runwayMonths} months`,
    );
  }
  const level: ScoreLevel = fired.length > 0 ? "High" : "Low";
  const runwayText =
    cash.runwayMonths == null
      ? "runway not computed"
      : `${formatUsdExact(cash.unrestrictedCash)} unrestricted / ${formatUsdExact(cash.monthlyBurn)} per month = ${cash.runwayMonths.toFixed(1)} months`;
  const numericLine = `${runwayText}; going concern ${input.cash.goingConcern ? "yes" : "no"} → Cash Need ${level.toUpperCase()} because ${
    level === "High"
      ? fired.join(" and ")
      : cash.runwayMonths == null
        ? "neither a going-concern statement nor a computable runway of 9 months or less was found"
        : `runway is above ${THRESHOLDS.runwayMonths} months and going concern was not flagged`
  }.`;
  const inputs: EvidenceInput[] = [
    {
      label: "Cash, equivalents, and restricted cash",
      value: formatUsdExact(input.cash.totalCash),
      note: input.cash.asOf ? `As of ${formatDate(input.cash.asOf)}.` : null,
      href: input.cash.sourceUrl,
    },
    {
      label: "Restricted cash",
      value: formatUsdExact(input.cash.restrictedCash),
      note: null,
      href: input.cash.sourceUrl,
    },
    {
      label: "Unrestricted cash",
      value: formatUsdExact(cash.unrestrictedCash),
      note: "Total cash minus restricted cash when both are known.",
      href: input.cash.sourceUrl,
    },
    {
      label: "Operating cash flow",
      value:
        input.cash.operatingCashFlow == null
          ? "—"
          : `${formatUsdExact(input.cash.operatingCashFlow)} over ${input.cash.operatingCashFlowMonths ?? "—"} months`,
      note: "Negative means cash used in operations.",
      href: input.cash.sourceUrl,
    },
    {
      label: "Monthly burn",
      value: formatUsdExact(cash.monthlyBurn),
      note: "Absolute operating outflow divided by the period length. Blank when operations did not use cash.",
      href: input.cash.sourceUrl,
    },
    {
      label: "Runway",
      value: cash.runwayMonths == null ? "Not computed" : `${cash.runwayMonths.toFixed(1)} months`,
      note: `High at or under ${THRESHOLDS.runwayMonths} months.`,
      href: input.cash.sourceUrl,
    },
    {
      label: "Going concern",
      value: input.cash.goingConcern ? "Flagged" : "Not flagged",
      note: input.cash.goingConcernNote,
      href: input.cash.sourceUrl,
    },
  ];
  return {
    id: "cashNeed",
    label: "Cash Need",
    level,
    why: input.cash.goingConcernNote && level === "High" ? `${input.cash.goingConcernNote} ${numericLine}` : numericLine,
    formula: CASH_FORMULA,
    numericLine,
    decision:
      level === "High"
        ? `High because ${fired.join("; ")}.`
        : `Low because going concern is not flagged and runway is ${cash.runwayMonths == null ? "not computed" : `${cash.runwayMonths.toFixed(1)} months, above ${THRESHOLDS.runwayMonths}`}.`,
    inputs,
    sources: dedupeSources([
      input.cash.sourceUrl
        ? {
            form: "10-Q/10-K",
            filed: input.cash.asOf ?? "",
            description: input.cash.sourceLabel ?? "Cash note",
            url: input.cash.sourceUrl,
          }
        : null,
      ...filingsMatching(input, /^(10-Q|10-K)/),
    ]),
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
  const numericLine = `Cash Need ${cashNeed.level} + Offering Ability ${offeringAbility.level} + Overhead Supply ${overheadSupply.level} + Historical ${historical.level} (${highCount} of 4 High) → Overall ${level.toUpperCase()} because ${
    cashAndPath
      ? "Cash Need is High and Offering Ability or Overhead Supply is High"
      : highCount >= 3
        ? `${highCount} of 4 components are High`
        : "Cash Need is not paired with Offering Ability or Overhead Supply, and fewer than 3 components are High"
  }.`;
  return {
    id: "overall",
    label: "Overall Risk",
    level,
    why: numericLine,
    formula: OVERALL_FORMULA,
    numericLine,
    decision: numericLine,
    inputs: components.map((score) => ({
      label: score.label,
      value: score.level,
      note: score.decision,
      href: null,
    })),
    sources: dedupeSources(components.flatMap((score) => score.sources)),
  };
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

function moneyOrBlank(value: number | null): string {
  return value == null ? "not stated" : formatUsdExact(value);
}

function blankOrMoney(value: number | null): string {
  return value == null ? "not stated" : formatUsd(value);
}

function sumRemaining(items: Instrument[]): number | null {
  const known = items.filter((item) => item.remainingDollars != null);
  if (known.length === 0) return null;
  return known.reduce((sum, item) => sum + (item.remainingDollars ?? 0), 0);
}

function agentNote(item: Instrument): string {
  const agent = item.agent ? `Sales agent: ${item.agent}. ` : "Sales agent not stated. ";
  const pause = item.paused ? "Contractually paused. " : "";
  return `${agent}${pause}${item.status}${item.notes ? ` ${item.notes}` : ""}`;
}

function filingsMatching(input: AnalysisInput, pattern: RegExp): FilingLink[] {
  return input.filings.filter((filing) => pattern.test(filing.form));
}

function firstUrl(filings: FilingLink[]): string | null {
  return filings[0]?.url ?? null;
}

function linkFromInstrument(item: Instrument): FilingLink | null {
  if (!item.edgarUrl) return null;
  return {
    form: item.kind,
    filed: "",
    description: item.name,
    url: item.edgarUrl,
  };
}

function dedupeSources(links: (FilingLink | null | undefined)[]): FilingLink[] {
  const seen = new Set<string>();
  const unique: FilingLink[] = [];
  for (const link of links) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    unique.push(link);
  }
  return unique;
}
