import { padCik } from "./format";
import {
  detectGoingConcern,
  extractAtmAgent,
  extractAtmProgramDollars,
  extractAuthorizedShares,
  extractCoverShares,
  extractElocRemaining,
  extractReverseSplits,
  extractShelfUnsoldDollars,
  extractWarrantCount,
  periodMonths,
  stripHtml,
} from "./parse";
import type { AnalysisInput, CapitalEvent, FilingLink, Instrument } from "./types";

const USER_AGENT = "Splitline Dilution Desk research@splitline.local";

export interface EdgarBundle {
  notFound: boolean;
  identity: {
    name: string;
    cik: string;
    exchange: string | null;
    sic: string | null;
    sicDescription: string | null;
  } | null;
  filings: FilingLink[];
  cashAsOf: string | null;
  analysis: AnalysisInput | null;
}

interface FactRow {
  end?: string;
  start?: string;
  val?: number;
  filed?: string;
  form?: string;
  accn?: string;
}

const INTERESTING =
  /^(10-K|10-K\/A|10-Q|10-Q\/A|8-K|8-K\/A|S-1|S-1\/A|S-3|S-3\/A|S-3ASR|F-1|F-3|F-3ASR|424B\d|EFFECT)$/;

let tickerCache: Map<string, { cik: string; title: string }> | null = null;

export async function fetchEdgarBundle(
  symbol: string,
  options: { includeNarrative: boolean },
): Promise<EdgarBundle> {
  const empty: EdgarBundle = {
    notFound: false,
    identity: null,
    filings: [],
    cashAsOf: null,
    analysis: null,
  };
  try {
    const tickers = await loadTickers();
    const match = tickers.get(symbol) ?? tickers.get(symbol.replace(".", "-"));
    if (!match) return { ...empty, notFound: true };

    const [submissions, facts] = await Promise.all([
      fetchJson(`https://data.sec.gov/submissions/CIK${match.cik}.json`),
      fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${match.cik}.json`).catch(() => null),
    ]);
    const filings = listFilings(match.cik, submissions);

    const identity = {
      name: stringField(submissions?.name) || match.title,
      cik: match.cik,
      exchange: firstString(submissions?.exchanges),
      sic: stringField(submissions?.sic),
      sicDescription: stringField(submissions?.sicDescription),
    };

    const cashFact = latestMonetary(facts, [
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "CashAndCashEquivalentsAtCarryingValue",
    ]);
    const plainCash = latestMonetary(facts, ["CashAndCashEquivalentsAtCarryingValue"]);
    const restricted = latestMonetary(facts, [
      "RestrictedCash",
      "RestrictedCashAndCashEquivalents",
      "RestrictedCashCurrent",
      "RestrictedCashAndCashEquivalentsAtCarryingValue",
    ]);
    const operating = latestFlow(facts, ["NetCashProvidedByUsedInOperatingActivities"]);
    const sharesFact = latestShares(facts, [
      "EntityCommonStockSharesOutstanding",
      "CommonStockSharesOutstanding",
    ]);

    let narrative = "";
    let registrationText = "";
    if (options.includeNarrative) {
      [narrative, registrationText] = await Promise.all([
        loadLatestNarrative(match.cik, submissions),
        loadRegistrationText(match.cik, submissions),
      ]);
    }

    const analysis = buildLiveAnalysis({
      symbol,
      identity,
      filings,
      cashFact,
      plainCash,
      restricted,
      operating,
      sharesFact,
      narrative,
      registrationText,
    });

    return {
      notFound: false,
      identity,
      filings,
      cashAsOf: cashFact?.end ?? null,
      analysis,
    };
  } catch {
    return empty;
  }
}

function buildLiveAnalysis(args: {
  symbol: string;
  identity: NonNullable<EdgarBundle["identity"]>;
  filings: FilingLink[];
  cashFact: FactRow | null;
  plainCash: FactRow | null;
  restricted: FactRow | null;
  operating: { row: FactRow; months: number } | null;
  sharesFact: FactRow | null;
  narrative: string;
  registrationText: string;
}): AnalysisInput {
  const caveats = [
    "Live mode is a best-effort read of EDGAR submissions, XBRL company facts, and one periodic report. Unparsed shelf or ATM capacity stays blank and does not raise a score.",
  ];
  const text = args.narrative;
  const goingConcern = text ? detectGoingConcern(text) : false;
  if (!text) {
    caveats.push("The latest 10-Q or 10-K text was not downloaded, so going-concern language was not scanned.");
  }

  let totalCash = args.cashFact?.val ?? null;
  let restrictedCash = args.restricted?.val ?? null;
  if (
    totalCash != null &&
    args.plainCash?.val != null &&
    args.cashFact?.end &&
    args.plainCash.end &&
    args.cashFact.end === args.plainCash.end &&
    totalCash > args.plainCash.val &&
    restrictedCash == null
  ) {
    restrictedCash = totalCash - args.plainCash.val;
  }

  const cover = text ? extractCoverShares(text) : null;
  const sharesOutstanding = cover?.shares ?? args.sharesFact?.val ?? null;
  const authorizedShares = text ? extractAuthorizedShares(text) : null;
  const warrantCount = text ? extractWarrantCount(text) : null;
  const elocRemaining = text ? extractElocRemaining(text) : null;

  const instruments: Instrument[] = [];
  if (elocRemaining != null) {
    instruments.push({
      kind: "eloc",
      name: "Equity line referenced in the latest periodic report",
      remainingDollars: elocRemaining,
      remainingShares: null,
      overhangShares: null,
      nearTermIssuanceShares: null,
      usable: true,
      paused: /prohibited from using the eloc|eloc and atm for 180 days/i.test(text),
      status: "Remaining capacity parsed from the filing text",
      edgarUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
      notes: null,
    });
  } else if (/\bequity line\b|\bELOC\b/i.test(text)) {
    instruments.push({
      kind: "eloc",
      name: "Equity line referenced in the latest periodic report",
      remainingDollars: null,
      remainingShares: null,
      overhangShares: null,
      nearTermIssuanceShares: null,
      usable: true,
      paused: /180 days/i.test(text),
      status: "Mentioned; remaining dollars were not parsed",
      edgarUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
      notes: "A mention without a remaining-dollar figure does not raise Offering Ability.",
    });
  }

  if (/at[- ]the[- ]market|\bATM\b/i.test(text)) {
    instruments.push({
      kind: "atm",
      name: "At-the-market program referenced in the latest periodic report",
      remainingDollars: null,
      remainingShares: null,
      overhangShares: null,
      nearTermIssuanceShares: null,
      usable: true,
      paused: /atm for 180 days|using the eloc and atm/i.test(text),
      status: "Mentioned; remaining dollars were not parsed",
      edgarUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
      notes: "Unknown ATM capacity does not raise Offering Ability.",
    });
  }

  const shelfFiling = args.filings.find((filing) => /^(S-3|S-3ASR|F-3|F-3ASR)/.test(filing.form));
  const shelfUnsold = extractShelfUnsoldDollars(`${text}\n${args.registrationText}`);
  if (shelfFiling || shelfUnsold != null) {
    instruments.push({
      kind: "shelf",
      name: shelfFiling ? `${shelfFiling.form} on file` : "Shelf amount cited in a filing",
      remainingDollars: null,
      registeredDollars: shelfUnsold,
      remainingShares: null,
      overhangShares: null,
      nearTermIssuanceShares: null,
      usable: false,
      paused: false,
      status: shelfUnsold != null
        ? "Unsold aggregate cited; current remainder was not confirmed"
        : "Registration on file; remaining capacity was not parsed",
      edgarUrl: shelfFiling?.url ?? args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
      notes: shelfUnsold != null
        ? "The unsold aggregate printed in the registration is shown as registered dollars. It is not treated as remaining shelf capacity, so it does not raise Offering Ability."
        : "Live mode does not assume a dollar capacity from the form type alone.",
    });
  }

  const atm = instruments.find((item) => item.kind === "atm");
  const atmAgent = extractAtmAgent(`${text}\n${args.registrationText}`);
  const atmProgram = extractAtmProgramDollars(`${text}\n${args.registrationText}`);
  const atmFiling = args.filings.find((filing) => /^424B/.test(filing.form));
  if (atm) {
    if (atmAgent) atm.agent = atmAgent;
    if (atmProgram != null) atm.registeredDollars = atmProgram;
    if (atmFiling) atm.edgarUrl = atmFiling.url;
  } else if (atmAgent || atmProgram != null) {
    instruments.push({
      kind: "atm",
      name: "At-the-market program cited in a registration",
      remainingDollars: null,
      registeredDollars: atmProgram,
      remainingShares: null,
      overhangShares: null,
      nearTermIssuanceShares: null,
      usable: true,
      paused: false,
      agent: atmAgent,
      status: "Program size parsed; remaining capacity was not",
      edgarUrl: atmFiling?.url ?? null,
      notes: "A stated program size without a remaining-dollar figure does not raise Offering Ability.",
    });
  }

  if (warrantCount != null) {
    instruments.push({
      kind: "warrant",
      name: "Warrants outstanding",
      remainingDollars: null,
      remainingShares: warrantCount,
      overhangShares: warrantCount,
      nearTermIssuanceShares: null,
      usable: false,
      paused: false,
      status: "Count parsed from the latest periodic report",
      edgarUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
      notes: "Live mode does not assume these warrants are currently exercisable.",
    });
  }

  const events: CapitalEvent[] = [];
  const analysisAsOf = args.filings.find((filing) => /^10-[QK]/.test(filing.form))?.filed ?? utcToday();
  for (const filing of args.filings) {
    const days = daysFrom(filing.filed, analysisAsOf);
    if (days == null || days < 0 || days > 800) continue;
    if (/^424B/.test(filing.form)) {
      events.push({
        date: filing.filed,
        kind: "equity-raise",
        label: filing.form,
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: filing.url,
        notes: filing.description || "Prospectus supplement",
      });
    } else if (
      filing.form.startsWith("8-K") &&
      /offering|private placement|registered direct|at the market|equity line|securities purchase/i.test(
        filing.description,
      )
    ) {
      events.push({
        date: filing.filed,
        kind: "equity-raise",
        label: "8-K",
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: filing.url,
        notes: filing.description,
      });
    }
  }
  if (text) {
    for (const split of extractReverseSplits(text)) {
      events.push({
        date: split.date,
        kind: "reverse-split",
        label: `${split.ratio} reverse split`,
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
        notes: "Parsed from the latest periodic report.",
      });
    }
  }

  return {
    analysisAsOf,
    caveats,
    profile: {
      symbol: args.symbol,
      name: args.identity.name,
      cik: args.identity.cik,
      exchange: args.identity.exchange,
      sic: args.identity.sic,
      sicDescription: args.identity.sicDescription,
      sharesOutstanding,
      sharesOutstandingAsOf: cover?.asOf ?? args.sharesFact?.end ?? null,
      floatShares: null,
      authorizedShares,
      price: null,
      marketCap: null,
    },
    cash: {
      asOf: args.cashFact?.end ?? null,
      totalCash,
      restrictedCash,
      operatingCashFlow: args.operating?.row.val ?? null,
      operatingCashFlowMonths: args.operating?.months ?? null,
      workingCapital: null,
      goingConcern,
      goingConcernNote: goingConcern
        ? "The latest periodic report pairs substantial-doubt language with going concern."
        : null,
      sourceLabel: args.cashFact
        ? `EDGAR company facts${args.cashFact.form ? `, ${args.cashFact.form}` : ""}`
        : "EDGAR submissions",
      sourceUrl: args.filings.find((filing) => filing.form.startsWith("10-"))?.url ?? null,
    },
    instruments,
    events,
    filings: args.filings,
  };
}

async function loadTickers(): Promise<Map<string, { cik: string; title: string }>> {
  if (tickerCache) return tickerCache;
  const json = await fetchJson("https://www.sec.gov/files/company_tickers.json");
  const map = new Map<string, { cik: string; title: string }>();
  for (const row of Object.values(json ?? {})) {
    if (!row || typeof row !== "object") continue;
    const record = row as { cik_str?: number; ticker?: string; title?: string };
    if (!record.ticker || record.cik_str == null) continue;
    map.set(String(record.ticker).toUpperCase(), {
      cik: padCik(record.cik_str),
      title: record.title ?? String(record.ticker),
    });
  }
  tickerCache = map;
  return map;
}

const SHELF_FORM = /^(S-3|S-3\/A|S-3ASR|F-3|F-3ASR|424B\d|S-1|S-1\/A)$/;

function listFilings(cik: string, submissions: Record<string, any> | null): FilingLink[] {
  const recent = submissions?.filings?.recent;
  if (!recent || !Array.isArray(recent.form) || !Array.isArray(recent.accessionNumber)) return [];
  const links: FilingLink[] = [];
  const count = Math.min(recent.form.length as number, 400);
  for (let index = 0; index < count; index += 1) {
    const form = String(recent.form[index] ?? "");
    if (!INTERESTING.test(form)) continue;
    const accession = String(recent.accessionNumber[index] ?? "");
    const primary = String(recent.primaryDocument[index] ?? "");
    if (!accession || !primary) continue;
    links.push({
      form,
      filed: String(recent.filingDate[index] ?? ""),
      description: String(recent.primaryDocDescription?.[index] ?? "").trim(),
      url: archiveUrl(cik, accession, primary),
    });
  }
  const newest = links.slice(0, 12);
  const seen = new Set(newest.map((filing) => filing.url));
  const extras: FilingLink[] = [];
  const formsKept = new Set<string>();
  for (const filing of links) {
    if (!SHELF_FORM.test(filing.form) || seen.has(filing.url)) continue;
    const key = filing.form.replace(/\/A$/, "");
    if (formsKept.has(key)) continue;
    formsKept.add(key);
    extras.push(filing);
    if (extras.length >= 6) break;
  }
  return [...newest, ...extras];
}

async function loadRegistrationText(
  cik: string,
  submissions: Record<string, any> | null,
): Promise<string> {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return "";
  const wanted = ["S-3", "S-3ASR", "424B5"];
  const found = new Set<string>();
  const chunks: string[] = [];
  const count = recent.form.length as number;
  for (let index = 0; index < count && found.size < wanted.length; index += 1) {
    const form = String(recent.form[index] ?? "");
    if (!wanted.includes(form) || found.has(form)) continue;
    const accession = String(recent.accessionNumber[index] ?? "");
    const primary = String(recent.primaryDocument[index] ?? "");
    if (!accession || !primary) continue;
    found.add(form);
    const html = await fetchText(archiveUrl(cik, accession, primary));
    if (html) chunks.push(stripHtml(html).slice(0, 120_000));
  }
  return chunks.join("\n");
}

async function loadLatestNarrative(cik: string, submissions: Record<string, any> | null): Promise<string> {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return "";
  const count = recent.form.length as number;
  const preferred = ["10-Q", "10-K", "20-F", "40-F"];
  for (const formName of preferred) {
    for (let index = 0; index < count; index += 1) {
      if (String(recent.form[index] ?? "") !== formName) continue;
      const accession = String(recent.accessionNumber[index] ?? "");
      const primary = String(recent.primaryDocument[index] ?? "");
      if (!accession || !primary) continue;
      const html = await fetchText(archiveUrl(cik, accession, primary));
      if (!html) return "";
      return stripHtml(html).slice(0, 450_000);
    }
  }
  return "";
}

function latestMonetary(facts: Record<string, any> | null, concepts: string[]): FactRow | null {
  return latestFact(facts, "us-gaap", concepts, "USD");
}

function latestShares(facts: Record<string, any> | null, concepts: string[]): FactRow | null {
  return (
    latestPositiveShares(facts, "dei", concepts) ??
    latestPositiveShares(facts, "us-gaap", concepts)
  );
}

/** A zero share fact is a bad tag, not a company with no stock. Keep the newest positive count. */
function latestPositiveShares(
  facts: Record<string, any> | null,
  namespace: string,
  concepts: string[],
): FactRow | null {
  const rows = collectFacts(facts, namespace, concepts, "shares").filter((row) => (row.val ?? 0) > 0);
  rows.sort((a, b) => compareFacts(a, b));
  return rows[0] ?? null;
}

function latestFlow(
  facts: Record<string, any> | null,
  concepts: string[],
): { row: FactRow; months: number } | null {
  const rows = collectFacts(facts, "us-gaap", concepts, "USD").filter((row) => {
    const months = periodMonths(row.start, row.end);
    return months != null && months >= 2.5 && months <= 13;
  });
  rows.sort((a, b) => compareFacts(a, b));
  const row = rows[0];
  if (!row) return null;
  const months = periodMonths(row.start, row.end);
  if (months == null) return null;
  return { row, months };
}

function latestFact(
  facts: Record<string, any> | null,
  namespace: string,
  concepts: string[],
  unit: string,
): FactRow | null {
  const rows = collectFacts(facts, namespace, concepts, unit);
  rows.sort((a, b) => compareFacts(a, b));
  return rows[0] ?? null;
}

function collectFacts(
  facts: Record<string, any> | null,
  namespace: string,
  concepts: string[],
  unit: string,
): FactRow[] {
  const rows: FactRow[] = [];
  for (const concept of concepts) {
    const series = facts?.facts?.[namespace]?.[concept]?.units?.[unit];
    if (!Array.isArray(series)) continue;
    for (const row of series) {
      if (typeof row?.val === "number" && typeof row?.end === "string") rows.push(row as FactRow);
    }
  }
  return rows;
}

function compareFacts(a: FactRow, b: FactRow): number {
  if ((a.end ?? "") !== (b.end ?? "")) return (a.end ?? "") < (b.end ?? "") ? 1 : -1;
  return (a.filed ?? "") < (b.filed ?? "") ? 1 : -1;
}

function archiveUrl(cik: string, accession: string, primary: string): string {
  const cikInt = String(parseInt(cik, 10));
  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accession.replace(/-/g, "")}/${primary}`;
}

function daysFrom(earlier: string, later: string): number | null {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

async function fetchJson(url: string): Promise<Record<string, any> | null> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`EDGAR ${response.status} for ${url}`);
  return (await response.json()) as Record<string, any>;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > 3_000_000) return null;
  const text = await response.text();
  return text.slice(0, 2_000_000);
}
