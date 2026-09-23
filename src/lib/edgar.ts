import { padCik } from "./format";
import { interpretFilings, type CurrentReport } from "./liveFacts";
import {
  detectGoingConcern,
  extractAtmAgent,
  extractAtmProgramDollars,
  extractAuthorizedShares,
  extractCoverShares,
  extractElocRemaining,
  extractInlineCash,
  extractReverseSplits,
  extractShelfUnsoldDollars,
  extractWarrantCount,
  mentionsAtmProgram,
  periodMonths,
  stripHtml,
  type InlineCashFacts,
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
  /^(10-K|10-K\/A|10-Q|10-Q\/A|20-F|20-F\/A|40-F|40-F\/A|8-K|8-K\/A|6-K|6-K\/A|S-1|S-1\/A|S-3|S-3\/A|S-3ASR|F-1|F-3|F-3\/A|F-3ASR|424B\d|EFFECT)$/;

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

    const combinedCash = latestMoney(facts, ["us-gaap"], [
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ]);
    const plainCash = latestMoney(facts, ["us-gaap", "ifrs-full"], [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashAndCashEquivalents",
    ]);
    const cashPick = newerMoney(combinedCash, plainCash);
    const cashFact = cashPick?.row ?? null;
    const restricted = latestMoney(facts, ["us-gaap", "ifrs-full"], [
      "RestrictedCash",
      "RestrictedCashAndCashEquivalents",
      "RestrictedCashCurrent",
      "RestrictedCashAndCashEquivalentsAtCarryingValue",
      "CurrentRestrictedCashAndCashEquivalents",
    ]);
    const operating = latestFlow(facts, ["NetCashProvidedByUsedInOperatingActivities", "CashFlowsFromUsedInOperatingActivities"]);
    const sharesFact = latestShares(facts, [
      "EntityCommonStockSharesOutstanding",
      "CommonStockSharesOutstanding",
      "NumberOfSharesOutstanding",
    ]);

    let narrative = "";
    let registrationText = "";
    let resale: { text: string; url: string | null; filed: string | null } | null = null;
    let reports: CurrentReport[] = [];
    let inlineCash: (InlineCashFacts & { sourceUrl: string | null; sourceForm: string | null }) | null = null;
    if (options.includeNarrative) {
      const [narrativeResult, registrationResult, reportResult, inlineResult] = await Promise.all([
        loadLatestNarrative(match.cik, submissions),
        loadRegistrationFilings(match.cik, submissions),
        loadCurrentReports(match.cik, submissions),
        loadInlineCash(match.cik, submissions),
      ]);
      narrative = narrativeResult;
      registrationText = registrationResult.map((filing) => filing.text).join("\n");
      const resaleFiling =
        registrationResult.find((filing) => filing.form === "F-3" || filing.form === "S-3") ?? null;
      resale = resaleFiling
        ? { text: resaleFiling.text, url: resaleFiling.url, filed: resaleFiling.filed }
        : null;
      reports = reportResult;
      inlineCash = inlineResult;
    }

    const analysis = buildLiveAnalysis({
      symbol,
      identity,
      filings,
      cashFact,
      restricted: restricted?.row ?? null,
      operating,
      sharesFact,
      narrative,
      registrationText,
      resale,
      reports,
      inlineCash,
      cashCurrency: cashPick?.currency ?? inlineCash?.currency ?? null,
      restrictedSeparate: (cashPick != null && cashPick.source === "plain") || inlineCash?.restrictedSeparate === true,
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
  restricted: FactRow | null;
  operating: { row: FactRow; months: number } | null;
  sharesFact: FactRow | null;
  narrative: string;
  registrationText: string;
  resale: { text: string; url: string | null; filed: string | null } | null;
  reports: CurrentReport[];
  inlineCash: (InlineCashFacts & { sourceUrl: string | null; sourceForm: string | null }) | null;
  cashCurrency: "USD" | "CAD" | null;
  restrictedSeparate: boolean;
}): AnalysisInput {
  const caveats = [
    "Live mode is a best-effort read of EDGAR submissions, XBRL company facts, the latest periodic report, recent 6-Ks, and an F-3 or S-3 when one is on file. Unparsed shelf or ATM capacity stays blank and does not raise a score. Share counts are taken from filings and are not estimated from a conversion floor.",
  ];
  const text = args.narrative;
  const goingConcern = text ? detectGoingConcern(text) : false;
  if (!text) {
    caveats.push("The latest 10-Q, 10-K, 20-F, or 40-F text was not downloaded, so going-concern language was not scanned.");
  }

  let totalCash = args.cashFact?.val ?? null;
  let restrictedCash = args.restricted?.val ?? null;
  let operatingCashFlow = args.operating?.row.val ?? null;
  let operatingMonths = args.operating?.months ?? null;
  let cashAsOf = args.cashFact?.end ?? null;
  let currency = args.cashCurrency;
  let restrictedSeparate = args.restrictedSeparate;
  const inline = args.inlineCash;
  if (inline && inline.asOf && (!cashAsOf || inline.asOf > cashAsOf)) {
    totalCash = inline.totalCash;
    restrictedCash = inline.restrictedCash;
    operatingCashFlow = inline.operatingCashFlow;
    operatingMonths = periodMonths(inline.operatingStart ?? undefined, inline.operatingEnd ?? undefined);
    cashAsOf = inline.asOf;
    currency = inline.currency ?? currency;
    restrictedSeparate = inline.restrictedSeparate;
    caveats.push(
      `Cash uses the inline XBRL in a periodic report dated ${inline.asOf}, which is later than the company-facts cash period.`,
    );
  }
  if (currency === "CAD") {
    caveats.push("Cash figures are Canadian dollars as reported. They are not converted to US dollars.");
  }

  const cover = text ? extractCoverShares(text) : null;
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

  if (mentionsAtmProgram(text)) {
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
  const analysisAsOf =
    args.filings.find((filing) => /^(10-[QK]|20-F|40-F|6-K)/.test(filing.form))?.filed ?? utcToday();
  const interpreted = interpretFilings({
    analysisAsOf,
    reports: args.reports,
    resale: args.resale,
    shareCandidates: [
      ...(cover ? [{ shares: cover.shares, asOf: cover.asOf, label: "Cover page" }] : []),
      ...(args.sharesFact?.val
        ? [{ shares: args.sharesFact.val, asOf: args.sharesFact.end ?? null, label: "Company facts" }]
        : []),
      ...(inline?.sharesOutstanding
        ? [{ shares: inline.sharesOutstanding, asOf: inline.sharesAsOf, label: "Inline XBRL shares" }]
        : []),
    ],
  });
  if (interpreted.instruments.some((item) => item.resaleRegistration)) {
    for (let index = instruments.length - 1; index >= 0; index -= 1) {
      const item = instruments[index];
      if (item.kind === "shelf" && item.remainingDollars == null && item.overhangShares == null && !item.resaleRegistration) {
        instruments.splice(index, 1);
      }
    }
  }
  instruments.push(...interpreted.instruments);
  events.push(...interpreted.events);
  caveats.push(...interpreted.caveats);
  const sharesOutstanding = interpreted.sharesOutstanding ?? cover?.shares ?? args.sharesFact?.val ?? null;
  const sharesOutstandingAsOf =
    interpreted.sharesOutstanding != null
      ? interpreted.sharesOutstandingAsOf
      : cover?.asOf ?? args.sharesFact?.end ?? null;
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
      sharesOutstandingAsOf,
      floatShares: null,
      authorizedShares,
      price: null,
      marketCap: null,
    },
    cash: {
      asOf: cashAsOf,
      totalCash,
      restrictedCash,
      operatingCashFlow,
      operatingCashFlowMonths: operatingMonths,
      workingCapital: null,
      goingConcern,
      goingConcernNote: goingConcern
        ? "The latest periodic report pairs substantial-doubt or significant-doubt language with going concern."
        : null,
      sourceLabel: inline && cashAsOf === inline.asOf
        ? `Inline XBRL${inline.sourceForm ? `, ${inline.sourceForm}` : ""}`
        : args.cashFact
          ? `EDGAR company facts${args.cashFact.form ? `, ${args.cashFact.form}` : ""}${currency === "CAD" ? ", CAD" : ""}`
          : "EDGAR submissions",
      sourceUrl:
        (inline && cashAsOf === inline.asOf ? inline.sourceUrl : null) ??
        args.filings.find((filing) => /^(10-[QK]|20-F|40-F|6-K)/.test(filing.form))?.url ??
        null,
      currency,
      restrictedIncludedInTotal: !restrictedSeparate,
      sourceForm:
        inline && cashAsOf === inline.asOf
          ? inline.sourceForm
          : args.cashFact?.form ?? null,
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
  const keepOne = /^(20-F|40-F|10-K|10-Q|F-3|S-3|S-3ASR)$/;
  for (const filing of links) {
    if (seen.has(filing.url)) continue;
    const shelf = SHELF_FORM.test(filing.form);
    const periodic = keepOne.test(filing.form.replace(/\/A$/, ""));
    if (!shelf && !periodic) continue;
    const key = filing.form.replace(/\/A$/, "");
    if (formsKept.has(key)) continue;
    formsKept.add(key);
    extras.push(filing);
    if (extras.length >= 8) break;
  }
  return [...newest, ...extras];
}

interface LoadedFiling {
  form: string;
  filed: string;
  url: string;
  text: string;
}

async function loadRegistrationFilings(
  cik: string,
  submissions: Record<string, any> | null,
): Promise<LoadedFiling[]> {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return [];
  const wanted = ["F-3", "S-3", "S-3ASR", "424B5"];
  const found = new Set<string>();
  const filings: LoadedFiling[] = [];
  const count = recent.form.length as number;
  for (let index = 0; index < count && found.size < wanted.length; index += 1) {
    const form = String(recent.form[index] ?? "");
    if (!wanted.includes(form) || found.has(form)) continue;
    const accession = String(recent.accessionNumber[index] ?? "");
    const primary = String(recent.primaryDocument[index] ?? "");
    const filed = String(recent.filingDate[index] ?? "");
    if (!accession || !primary) continue;
    found.add(form);
    const url = archiveUrl(cik, accession, primary);
    const html = await fetchText(url);
    if (!html) continue;
    filings.push({ form, filed, url, text: stripHtml(html).slice(0, 120_000) });
  }
  return filings;
}

async function loadCurrentReports(
  cik: string,
  submissions: Record<string, any> | null,
): Promise<CurrentReport[]> {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return [];
  const targets: { filed: string; url: string }[] = [];
  const count = recent.form.length as number;
  for (let index = 0; index < count && targets.length < 18; index += 1) {
    const form = String(recent.form[index] ?? "");
    if (form !== "6-K" && form !== "8-K") continue;
    const accession = String(recent.accessionNumber[index] ?? "");
    const primary = String(recent.primaryDocument[index] ?? "");
    const filed = String(recent.filingDate[index] ?? "");
    if (!accession || !primary || !filed) continue;
    targets.push({ filed, url: archiveUrl(cik, accession, primary) });
  }
  return mapPool(targets, 4, async (target) => {
    const html = await fetchText(target.url);
    let text = html ? stripHtml(html) : "";
    const needsExhibit =
      /exhibit 99\.1/i.test(text) &&
      !/principal amount of/i.test(text) &&
      !/reduced from\s+[\d,]+/i.test(text);
    if (needsExhibit) {
      const exhibit = await fetchText(target.url.replace(/[^/]+$/, "exhibit_99-1.htm"));
      if (exhibit) text = `${text}\n${stripHtml(exhibit)}`;
    }
    return { filed: target.filed, url: target.url, text: text.slice(0, 80_000) };
  });
}

async function loadInlineCash(
  cik: string,
  submissions: Record<string, any> | null,
): Promise<(InlineCashFacts & { sourceUrl: string | null; sourceForm: string | null }) | null> {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return null;
  const candidates: { form: string; accession: string; primary: string }[] = [];
  const count = recent.form.length as number;
  for (let index = 0; index < count && candidates.length < 8; index += 1) {
    const form = String(recent.form[index] ?? "");
    if (!/^(6-K|20-F|10-Q|10-K)$/.test(form)) continue;
    const accession = String(recent.accessionNumber[index] ?? "");
    const primary = String(recent.primaryDocument[index] ?? "");
    if (!accession || !primary) continue;
    candidates.push({ form, accession, primary });
  }
  let best: (InlineCashFacts & { sourceUrl: string | null; sourceForm: string | null }) | null = null;
  for (const candidate of candidates) {
    const index = await fetchJson(archiveUrl(cik, candidate.accession, "").replace(/\/$/, "/index.json")).catch(() => null);
    const items = index?.directory?.item;
    if (!Array.isArray(items)) continue;
    const instance = items.find((item: { name?: string }) => String(item?.name ?? "").endsWith("_htm.xml"));
    if (!instance?.name) continue;
    const xml = await fetchText(archiveUrl(cik, candidate.accession, String(instance.name)));
    if (!xml) continue;
    const parsed = extractInlineCash(xml);
    if (!parsed?.asOf || parsed.totalCash == null) continue;
    const row = {
      ...parsed,
      sourceUrl: archiveUrl(cik, candidate.accession, candidate.primary),
      sourceForm: candidate.form,
    };
    if (!best || (row.asOf ?? "") > (best.asOf ?? "")) best = row;
  }
  return best;
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
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

function latestMoney(
  facts: Record<string, any> | null,
  namespaces: string[],
  concepts: string[],
): { row: FactRow; currency: "USD" | "CAD"; source: "combined" | "plain" } | null {
  const found: { row: FactRow; currency: "USD" | "CAD"; source: "combined" | "plain" }[] = [];
  for (const namespace of namespaces) {
    for (const currency of ["USD", "CAD"] as const) {
      const row = latestFact(facts, namespace, concepts, currency);
      if (!row) continue;
      const combined = concepts.some((concept) => concept.startsWith("CashCashEquivalentsRestricted"));
      found.push({ row, currency, source: combined ? "combined" : "plain" });
    }
  }
  found.sort((a, b) => compareFacts(a.row, b.row));
  return found[0] ?? null;
}

function newerMoney(
  combined: { row: FactRow; currency: "USD" | "CAD"; source: "combined" | "plain" } | null,
  plain: { row: FactRow; currency: "USD" | "CAD"; source: "combined" | "plain" } | null,
): { row: FactRow; currency: "USD" | "CAD"; source: "combined" | "plain" } | null {
  if (!combined) return plain;
  if (!plain) return combined;
  return compareFacts(combined.row, plain.row) <= 0 ? combined : plain;
}

function latestShares(facts: Record<string, any> | null, concepts: string[]): FactRow | null {
  const rows = ["dei", "us-gaap", "ifrs-full"]
    .map((namespace) => latestPositiveShares(facts, namespace, concepts))
    .filter((row): row is FactRow => row != null);
  rows.sort((a, b) => compareFacts(a, b));
  return rows[0] ?? null;
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
  const rows = [
    ...collectFacts(facts, "us-gaap", concepts, "USD"),
    ...collectFacts(facts, "us-gaap", concepts, "CAD"),
    ...collectFacts(facts, "ifrs-full", concepts, "USD"),
    ...collectFacts(facts, "ifrs-full", concepts, "CAD"),
  ].filter((row) => {
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
