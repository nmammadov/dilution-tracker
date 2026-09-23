import { daysBetween } from "./format";
import {
  extractConsolidation,
  extractConvertibleNote,
  extractOutstandingAsOf,
  extractResaleShareCount,
  sharesAfterConsolidation,
  type ParsedConsolidation,
} from "./parse";
import type { CapitalEvent, Instrument } from "./types";

export interface CurrentReport {
  filed: string;
  url: string;
  text: string;
}

export interface ShareCandidate {
  shares: number;
  asOf: string | null;
  label: string;
}

export interface InterpretedFilings {
  instruments: Instrument[];
  events: CapitalEvent[];
  sharesOutstanding: number | null;
  sharesOutstandingAsOf: string | null;
  caveats: string[];
}

const LOOKBACK_DAYS = 800;

/**
 * Turn 6-K / 8-K prose and an F-3 or S-3 resale prospectus into instruments and events.
 * Share counts stay as printed. A later consolidation ratio from a filing divides
 * pre-consolidation counts; it does not invent a dollar amount.
 */
export function interpretFilings(args: {
  analysisAsOf: string;
  reports: CurrentReport[];
  resale: { text: string; url: string | null; filed: string | null } | null;
  shareCandidates: ShareCandidate[];
}): InterpretedFilings {
  const caveats: string[] = [];
  const instruments: Instrument[] = [];
  const events: CapitalEvent[] = [];
  const shareCandidates = [...args.shareCandidates];

  const consolidation = pickConsolidation(args.reports);
  if (consolidation) {
    events.push({
      date: consolidation.date,
      kind: "reverse-split",
      label: `${consolidation.ratio}-for-1 share consolidation`,
      proceeds: null,
      shares: consolidation.toShares,
      price: null,
      edgarUrl: consolidation.url,
      notes: consolidation.completed
        ? `The filing states a ${consolidation.ratio}:1 consolidation${
            consolidation.fromShares != null && consolidation.toShares != null
              ? `, reducing common shares from ${consolidation.fromShares.toLocaleString("en-US")} to ${consolidation.toShares.toLocaleString("en-US")}`
              : ""
          }.`
        : `The filing describes a planned ${consolidation.ratio}:1 consolidation.`,
    });
    if (consolidation.toShares != null) {
      shareCandidates.push({
        shares: consolidation.toShares,
        asOf: consolidation.date,
        label: "Post-consolidation shares stated in the filing",
      });
    }
  }

  const resaleFiled = args.resale?.filed ?? null;
  const resaleCount = args.resale ? extractResaleShareCount(args.resale.text) : null;
  const outstandingInResale = args.resale ? extractOutstandingAsOf(args.resale.text) : null;
  if (outstandingInResale) {
    shareCandidates.push({
      shares: outstandingInResale.shares,
      asOf: outstandingInResale.asOf,
      label: "Shares outstanding stated in the resale prospectus",
    });
  }

  let resaleOverhang: number | null = null;
  if (resaleCount != null && args.resale) {
    const adjust =
      consolidation != null &&
      consolidation.completed &&
      resaleFiled != null &&
      consolidation.date > resaleFiled;
    resaleOverhang = adjust ? sharesAfterConsolidation(resaleCount, consolidation.ratio) : resaleCount;
    const ratioNote = adjust
      ? ` The prospectus count is pre-consolidation. ${resaleCount.toLocaleString("en-US")} / ${consolidation?.ratio} = ${resaleOverhang.toLocaleString("en-US")} shares on a post-consolidation basis, using the ${consolidation?.ratio}:1 ratio stated in the later consolidation filing.`
      : "";
    instruments.push({
      kind: "shelf",
      name: "F-3/S-3 resale registration",
      remainingDollars: null,
      remainingShares: resaleOverhang,
      overhangShares: resaleOverhang,
      nearTermIssuanceShares: null,
      usable: false,
      paused: false,
      resaleRegistration: true,
      status: resaleFiled ? `Resale prospectus filed ${resaleFiled}` : "Resale prospectus",
      edgarUrl: args.resale.url,
      notes: `The prospectus registers up to ${resaleCount.toLocaleString("en-US")} common shares for resale by the selling shareholder. This is not a primary shelf and it has no remaining dollar capacity.${ratioNote} Warrant and conversion shares included in that total are not counted again.`,
    });
  }

  const seenNotes = new Set<string>();
  for (const report of args.reports) {
    const note = extractConvertibleNote(report.text);
    if (!note || note.principalUsd == null) continue;
    const date = note.date ?? report.filed;
    const noteKey = `${date}:${note.principalUsd}`;
    if (seenNotes.has(noteKey)) continue;
    seenNotes.add(noteKey);
    const days = daysBetween(date, args.analysisAsOf);
    if (days == null || days < 0 || days > LOOKBACK_DAYS) continue;

    events.push({
      date,
      kind: "equity-raise",
      label: "Convertible note",
      proceeds: note.principalUsd,
      shares: note.warrantShares,
      price: null,
      edgarUrl: report.url,
      notes: noteSummary(note),
    });

    const beforeSplit =
      consolidation != null && consolidation.completed && date < consolidation.date;
    const warrantShares =
      note.warrantShares == null
        ? null
        : beforeSplit
          ? sharesAfterConsolidation(note.warrantShares, consolidation.ratio)
          : note.warrantShares;
    const insideResale = resaleFiled != null && date <= resaleFiled && resaleOverhang != null;

    if (note.variableConversion && note.shareSettled) {
      instruments.push({
        kind: "convertible",
        name: `${date} convertible note`,
        remainingDollars: null,
        remainingShares: null,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: true,
        paused: false,
        variableConversion: true,
        shareSettled: true,
        issuedOn: date,
        status: "Variable conversion price, share settlement only",
        edgarUrl: report.url,
        notes: `${noteSummary(note)} Principal is the note size stated in the filing. It is not shelf capacity. The filing does not state a maximum conversion share count, so none is estimated from the floor price.`,
      });
    }

    if (warrantShares != null && !insideResale) {
      instruments.push({
        kind: "warrant",
        name: `${date} note warrant`,
        remainingDollars: null,
        remainingShares: warrantShares,
        overhangShares: warrantShares,
        nearTermIssuanceShares: warrantShares,
        usable: false,
        paused: false,
        issuedOn: date,
        status: beforeSplit
          ? `Exercisable; pre-consolidation count ${note.warrantShares?.toLocaleString("en-US")} divided by the ${consolidation?.ratio}:1 ratio`
          : "Exercisable on issuance, as stated in the filing",
        edgarUrl: report.url,
        notes: beforeSplit
          ? `The 6-K states a warrant for ${note.warrantShares?.toLocaleString("en-US")} shares. The later ${consolidation?.ratio}:1 consolidation says outstanding convertible securities were proportionately adjusted, so overhang uses ${warrantShares.toLocaleString("en-US")} shares.`
          : note.exercisePrice
            ? `Exercise price CAD$${note.exercisePrice} per share, as stated in the filing.`
            : null,
      });
    }
  }

  const chosen = latestShares(shareCandidates);
  if (consolidation?.completed && chosen && chosen.asOf && chosen.asOf < consolidation.date) {
    caveats.push(
      `A ${consolidation.ratio}:1 consolidation is dated ${consolidation.date}, later than the share count used here (${chosen.asOf}). The post-consolidation count was not stated as a single number.`,
    );
  }

  return {
    instruments,
    events,
    sharesOutstanding: chosen?.shares ?? null,
    sharesOutstandingAsOf: chosen?.asOf ?? null,
    caveats,
  };
}

function noteSummary(note: NonNullable<ReturnType<typeof extractConvertibleNote>>): string {
  const parts = [`Principal US$${note.principalUsd?.toLocaleString("en-US")}.`];
  if (note.warrantShares != null) {
    parts.push(
      `Warrant for up to ${note.warrantShares.toLocaleString("en-US")} shares${note.exercisePrice ? ` at CAD$${note.exercisePrice}` : ""}.`,
    );
  }
  if (note.fixedPrice) parts.push(`Fixed conversion price US$${note.fixedPrice}.`);
  if (note.floorPrice) parts.push(`Floor price US$${note.floorPrice}.`);
  if (note.variableConversion) parts.push("Conversion price includes a discount to VWAP.");
  if (note.shareSettled) parts.push("The note is not repayable in cash.");
  return parts.join(" ");
}

function pickConsolidation(reports: CurrentReport[]): (ParsedConsolidation & { date: string; url: string }) | null {
  let best: (ParsedConsolidation & { date: string; url: string }) | null = null;
  for (const report of reports) {
    const parsed = extractConsolidation(report.text);
    if (!parsed) continue;
    const candidate = { ...parsed, date: report.filed, url: report.url };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.completed && !best.completed) {
      best = candidate;
      continue;
    }
    if (candidate.completed === best.completed && candidate.date > best.date) best = candidate;
  }
  return best;
}

function latestShares(candidates: ShareCandidate[]): ShareCandidate | null {
  const usable = candidates.filter((item) => item.shares > 0);
  if (usable.length === 0) return null;
  usable.sort((a, b) => (a.asOf ?? "").localeCompare(b.asOf ?? ""));
  return usable[usable.length - 1];
}
