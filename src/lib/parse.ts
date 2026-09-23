const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a sentence pairs going-concern language with substantial doubt,
 * significant doubt, or a material uncertainty, and the sentence is not a denial.
 * IFRS reports often say "significant doubt" rather than the US "substantial doubt" phrase.
 */
export function detectGoingConcern(text: string): boolean {
  const windows =
    text.match(
      /[^.]{0,240}(?:substantial doubt|significant doubt|material uncertaint\w*|going concern)[^.]{0,240}\./gi,
    ) ?? [];
  return windows.some((sentence) => {
    const lower = sentence.toLowerCase();
    const concern = lower.includes("going concern");
    const doubt =
      lower.includes("substantial doubt") ||
      lower.includes("significant doubt") ||
      /material uncertaint/.test(lower);
    if (!concern || !doubt) return false;
    if (/\bno\b[^.]{0,60}(?:substantial|significant) doubt/.test(lower)) return false;
    if (/\bno\b[^.]{0,40}material uncertaint/.test(lower)) return false;
    if (/do(?:es)? not (?:raise|cast)/.test(lower)) return false;
    if (/without (?:substantial|significant) doubt/.test(lower)) return false;
    return true;
  });
}

/** An at-the-market program, not a passing use of the letters ATM. */
export function mentionsAtmProgram(text: string): boolean {
  if (/at[- ]the[- ]market/i.test(text)) return true;
  return (
    /\bATM\b[^.]{0,48}\b(?:program|offering|facility|sales)\b/i.test(text) ||
    /\b(?:program|offering|facility)\b[^.]{0,48}\bATM\b/i.test(text)
  );
}

export function parseCount(raw: string): number | null {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function extractWarrantCount(text: string): number | null {
  const match = text.match(
    /(?:approximately\s+)?([\d,]{3,})\s+warrants remained outstanding/i,
  );
  return match ? parseCount(match[1]) : null;
}

export function extractAuthorizedShares(text: string): number | null {
  const match = text.match(/common stock[^.]{0,120}?([\d,]{5,})\s+shares authorized/i);
  return match ? parseCount(match[1]) : null;
}

export function extractCoverShares(text: string): { shares: number; asOf: string | null } | null {
  const match = text.match(
    /as of\s+([A-Z][a-z]+ \d{1,2}, \d{4})[^.]{0,80}?([\d,]{3,})\s+shares of common stock outstanding/i,
  );
  if (!match) {
    const loose = text.match(/([\d,]{3,})\s+shares of common stock outstanding/i);
    if (!loose) return null;
    const shares = parseCount(loose[1]);
    return shares == null ? null : { shares, asOf: null };
  }
  const shares = parseCount(match[2]);
  if (shares == null) return null;
  return { shares, asOf: isoFromLongDate(match[1]) };
}

export function extractReverseSplits(text: string): { date: string; ratio: string }[] {
  const found: { date: string; ratio: string }[] = [];
  const pattern = /(\d+)\s*-for-\s*(\d+)\s+reverse stock split/gi;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const neighborhood = text.slice(Math.max(0, index - 140), index + match[0].length + 140);
    const dateMatch = neighborhood.match(/[A-Z][a-z]+ \d{1,2}, \d{4}/);
    const date = dateMatch ? isoFromLongDate(dateMatch[0]) : null;
    if (!date) continue;
    const ratio = `${match[1]}-for-${match[2]}`;
    if (!found.some((item) => item.date === date && item.ratio === ratio)) {
      found.push({ date, ratio });
    }
  }
  return found;
}

export function extractShelfUnsoldDollars(text: string): number | null {
  const match = text.match(
    /maximum aggregate price of \$\s*([\d,]+)\s+registered are unsold/i,
  );
  if (!match) return null;
  return parseCount(match[1]);
}

export function extractAtmProgramDollars(text: string): number | null {
  const match = text.match(/aggregate offering price of up to \$\s*([\d,]+)/i);
  if (!match) return null;
  return parseCount(match[1]);
}

export function extractAtmAgent(text: string): string | null {
  const named = text.match(/with (Ladenburg Thalmann(?:\s+&\s+Co\.,?\s+Inc\.?)?)/i);
  if (named) return named[1].replace(/\s+/g, " ").trim();
  const generic = text.match(
    /sales agreement,?\s+(?:dated as of [^,]{4,40},?\s+)?with ([A-Z][A-Za-z0-9 .,&]{2,60}?)(?:,| acting|\s+\()/,
  );
  return generic ? generic[1].trim() : null;
}

export function extractElocRemaining(text: string): number | null {
  const match = text.match(
    /approximately\s+\$\s*([\d,.]+)\s+million(?:\s+of the commitment amount)?\s+remained available/i,
  );
  if (!match) return null;
  const millions = parseCount(match[1]);
  return millions == null ? null : millions * 1_000_000;
}

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

export interface ParsedNote {
  date: string | null;
  principalUsd: number | null;
  warrantShares: number | null;
  variableConversion: boolean;
  shareSettled: boolean;
  fixedPrice: string | null;
  floorPrice: string | null;
  exercisePrice: string | null;
}

/**
 * A share-settled convertible note described in a 6-K or 8-K.
 * Returns null when the text does not state a principal amount.
 */
export function extractConvertibleNote(text: string): ParsedNote | null {
  if (!/convertible note/i.test(text)) return null;
  const principalMatch = text.match(/principal amount of US\$\s*([\d,]+)/i);
  if (!principalMatch) return null;
  const principalUsd = parseCount(principalMatch[1]);
  const warrantMatch = text.match(/warrant to purchase up to\s+([\d,]+)\s+common shares/i);
  const warrantShares = warrantMatch ? parseCount(warrantMatch[1]) : null;
  const closed = text.match(/(?:expected to close|closed) on\s+([A-Z][a-z]+ \d{1,2}, \d{4})/);
  const announced = text.match(/\bOn\s+([A-Z][a-z]+ \d{1,2}, \d{4})/);
  const fixed = text.match(/Fixed Price set in the Note is US\$\s*(\d+(?:\.\d+)?)/i);
  const floor = text.match(/Floor Price set in the Note is US\$\s*(\d+(?:\.\d+)?)/i);
  const exercise = text.match(/exercise price of\s+(?:CAD|C)\$\s*(\d+(?:\.\d+)?)/i);
  const variableConversion =
    /lowest daily volume-weighted average price/i.test(text) ||
    /\bvariable price\b/i.test(text);
  const shareSettled =
    /not repayable in cash/i.test(text) ||
    /satisfied solely through the issuance of common shares/i.test(text);
  return {
    date: isoFromLongDate(closed?.[1] ?? announced?.[1] ?? "") ,
    principalUsd,
    warrantShares,
    variableConversion,
    shareSettled,
    fixedPrice: fixed?.[1] ?? null,
    floorPrice: floor?.[1] ?? null,
    exercisePrice: exercise?.[1] ?? null,
  };
}

/** Share count on an F-3/S-3 resale prospectus. Primary shelves return null. */
export function extractResaleShareCount(text: string): number | null {
  const head = text.slice(0, 8_000);
  if (!/resale|selling shareholder|selling stockholder/i.test(head)) return null;
  const match = head.match(/up to\s+([\d,]{4,})\s+common shares/i);
  if (!match) return null;
  return parseCount(match[1]);
}

export function extractOutstandingAsOf(text: string): { shares: number; asOf: string | null } | null {
  const match = text.match(
    /([\d,]{4,})\s+common shares outstanding as of\s+([A-Z][a-z]+ \d{1,2}, \d{4})/i,
  );
  if (!match) return null;
  const shares = parseCount(match[1]);
  if (shares == null) return null;
  return { shares, asOf: isoFromLongDate(match[2]) };
}

export interface ParsedConsolidation {
  ratio: number;
  fromShares: number | null;
  toShares: number | null;
  completed: boolean;
}

/** A stated share consolidation, including "30:1" and "one for every thirty". */
export function extractConsolidation(text: string): ParsedConsolidation | null {
  if (!/consolidat/i.test(text)) return null;
  const numeric = text.match(/\b(\d{1,3})\s*:\s*1\b/);
  const word = text.match(/for every\s+([a-z]+)\s+pre-consolidat/i);
  const fromWord = word ? NUMBER_WORDS[word[1].toLowerCase().replace(/-/g, "")] : null;
  const ratio = numeric ? Number(numeric[1]) : fromWord ?? null;
  if (ratio == null || !Number.isFinite(ratio) || ratio < 2) return null;
  const reduced = text.match(
    /reduced from\s+([\d,]+)(?:\s+common shares)?\s+to\s+(?:approximately\s+)?([\d,]+)/i,
  );
  const completed = /were reduced from/i.test(text);
  return {
    ratio,
    fromShares: reduced ? parseCount(reduced[1]) : null,
    toShares: reduced ? parseCount(reduced[2]) : null,
    completed,
  };
}

export function sharesAfterConsolidation(shares: number, ratio: number): number {
  return Math.round(shares / ratio);
}

export interface InlineCashFacts {
  asOf: string | null;
  totalCash: number | null;
  restrictedCash: number | null;
  restrictedSeparate: boolean;
  operatingCashFlow: number | null;
  operatingStart: string | null;
  operatingEnd: string | null;
  sharesOutstanding: number | null;
  sharesAsOf: string | null;
  currency: "USD" | "CAD" | null;
}

/**
 * Cash, burn, and shares from an inline XBRL instance.
 * Contexts marked pro forma are ignored. Values are the instance amounts, not scaled again.
 */
export function extractInlineCash(xml: string): InlineCashFacts | null {
  const contexts = new Map<string, { instant: string | null; start: string | null; end: string | null; skip: boolean }>();
  for (const match of xml.matchAll(/<context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/context>/gi)) {
    const body = match[2];
    const instant = body.match(/<instant>([^<]+)<\/instant>/i)?.[1] ?? null;
    const start = body.match(/<startDate>([^<]+)<\/startDate>/i)?.[1] ?? null;
    const end = body.match(/<endDate>([^<]+)<\/endDate>/i)?.[1] ?? null;
    const skip = /pro\s*forma/i.test(`${match[1]} ${body}`);
    contexts.set(match[1], { instant, start, end, skip });
  }

  const facts: { tag: string; ctx: string; value: number; unit: string | null }[] = [];
  for (const match of xml.matchAll(
    /<(?:ifrs-full|us-gaap):([A-Za-z0-9]+)\s+([^>]*)>([-\d.]+)<\/(?:ifrs-full|us-gaap):\1>/gi,
  )) {
    const attrs = match[2];
    const ctx = attrs.match(/contextRef="([^"]+)"/i)?.[1];
    const unit = attrs.match(/unitRef="([^"]+)"/i)?.[1] ?? null;
    if (!ctx) continue;
    const value = Number(match[3]);
    if (!Number.isFinite(value)) continue;
    facts.push({ tag: match[1], ctx, value, unit });
  }

  const usable = (ctx: string) => {
    const meta = contexts.get(ctx);
    return meta != null && !meta.skip;
  };
  const instantOf = (ctx: string) => contexts.get(ctx)?.instant ?? contexts.get(ctx)?.end ?? null;

  const cashFacts = facts.filter(
    (fact) => fact.tag === "CashAndCashEquivalents" && usable(fact.ctx) && instantOf(fact.ctx),
  );
  cashFacts.sort((a, b) => (instantOf(b.ctx) ?? "").localeCompare(instantOf(a.ctx) ?? ""));
  const cash = cashFacts[0] ?? null;
  const asOf = cash ? instantOf(cash.ctx) : null;

  const restrictedFacts = facts.filter(
    (fact) =>
      (fact.tag === "CurrentRestrictedCashAndCashEquivalents" ||
        fact.tag === "RestrictedCashAndCashEquivalents" ||
        fact.tag === "RestrictedCash") &&
      usable(fact.ctx) &&
      asOf != null &&
      instantOf(fact.ctx) === asOf,
  );
  const restricted = restrictedFacts.find((fact) => fact.tag === "CurrentRestrictedCashAndCashEquivalents") ?? restrictedFacts[0] ?? null;

  const flowFacts = facts.filter(
    (fact) => fact.tag === "CashFlowsFromUsedInOperatingActivities" && usable(fact.ctx),
  );
  flowFacts.sort((a, b) => (contexts.get(b.ctx)?.end ?? "").localeCompare(contexts.get(a.ctx)?.end ?? ""));
  const flow =
    flowFacts.find((fact) => {
      const meta = contexts.get(fact.ctx);
      const months = periodMonths(meta?.start ?? undefined, meta?.end ?? undefined);
      return months != null && months >= 2.5 && months <= 13;
    }) ?? null;

  const shareFacts = facts.filter(
    (fact) =>
      (fact.tag === "NumberOfSharesOutstanding" || fact.tag === "CommonStockSharesOutstanding") &&
      usable(fact.ctx) &&
      fact.value > 0 &&
      instantOf(fact.ctx),
  );
  shareFacts.sort((a, b) => (instantOf(b.ctx) ?? "").localeCompare(instantOf(a.ctx) ?? ""));
  const shares = shareFacts[0] ?? null;

  if (!cash && !flow && !shares) return null;
  const unit = cash?.unit ?? flow?.unit ?? null;
  const currency = unit === "CAD" ? "CAD" : unit === "USD" ? "USD" : null;
  return {
    asOf,
    totalCash: cash?.value ?? null,
    restrictedCash: restricted?.value ?? null,
    restrictedSeparate: restricted != null && cash != null,
    operatingCashFlow: flow?.value ?? null,
    operatingStart: flow ? contexts.get(flow.ctx)?.start ?? null : null,
    operatingEnd: flow ? contexts.get(flow.ctx)?.end ?? null : null,
    sharesOutstanding: shares?.value ?? null,
    sharesAsOf: shares ? instantOf(shares.ctx) : null,
    currency,
  };
}

export function isoFromLongDate(value: string): string | null {
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

export function periodMonths(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null;
  const days = Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days) || days <= 0) return null;
  return days / 30.437;
}
