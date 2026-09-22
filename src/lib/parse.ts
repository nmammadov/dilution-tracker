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
 * True only when a short window pairs "substantial doubt" with "going concern"
 * and the sentence is not a denial ("no substantial doubt").
 */
export function detectGoingConcern(text: string): boolean {
  const windows = text.match(/[^.]{0,180}(?:substantial doubt|going concern)[^.]{0,180}\./gi) ?? [];
  return windows.some((sentence) => {
    const lower = sentence.toLowerCase();
    if (!lower.includes("substantial doubt") || !lower.includes("going concern")) return false;
    if (/\bno\b[^.]{0,48}substantial doubt/.test(lower)) return false;
    if (/do(?:es)? not raise substantial doubt/.test(lower)) return false;
    return true;
  });
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

export function extractElocRemaining(text: string): number | null {
  const match = text.match(
    /approximately\s+\$\s*([\d,.]+)\s+million(?:\s+of the commitment amount)?\s+remained available/i,
  );
  if (!match) return null;
  const millions = parseCount(match[1]);
  return millions == null ? null : millions * 1_000_000;
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
