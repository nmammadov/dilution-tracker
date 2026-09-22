export interface QuoteSnapshot {
  price: number | null;
  sharesOutstanding: number | null;
  floatShares: number | null;
  marketCap: number | null;
}

const EMPTY: QuoteSnapshot = {
  price: null,
  sharesOutstanding: null,
  floatShares: null,
  marketCap: null,
};

/**
 * Price, share count, and float only. There is no quote-site tab in the UI.
 * Failures return nulls so a filing-based report still renders.
 */
export async function fetchQuote(symbol: string): Promise<QuoteSnapshot> {
  const summary = await fetchQuoteSummary(symbol);
  if (summary.price != null || summary.sharesOutstanding != null || summary.floatShares != null) {
    return summary;
  }
  const chartPrice = await fetchChartPrice(symbol);
  return { ...EMPTY, price: chartPrice };
}

async function fetchQuoteSummary(symbol: string): Promise<QuoteSnapshot> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,defaultKeyStatistics`;
    const json = await fetchJson(url);
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return EMPTY;
    return {
      price: rawNumber(result.price?.regularMarketPrice),
      marketCap: rawNumber(result.price?.marketCap),
      sharesOutstanding: rawNumber(result.defaultKeyStatistics?.sharesOutstanding),
      floatShares: rawNumber(result.defaultKeyStatistics?.floatShares),
    };
  } catch {
    return EMPTY;
  }
}

async function fetchChartPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const json = await fetchJson(url);
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

function rawNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "raw" in value) {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

async function fetchJson(url: string): Promise<Record<string, any> | null> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Splitline/0.1; research)",
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, any>;
}
