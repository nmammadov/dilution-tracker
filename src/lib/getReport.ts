import { assembleReport } from "./assemble";
import { fetchEdgarBundle } from "./edgar";
import { normalizeSymbol } from "./format";
import { getFixture } from "./fixtures";
import { fetchQuote, type QuoteSnapshot } from "./quote";
import type { AnalysisInput, TickerReport } from "./types";

export type ReportResult =
  | { ok: true; report: TickerReport }
  | { ok: false; status: number; message: string };

export async function getTickerReport(rawSymbol: string): Promise<ReportResult> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return { ok: false, status: 400, message: "Enter a US ticker such as DCOY." };
  }

  const fixture = getFixture(symbol);
  const [edgarResult, quoteResult] = await Promise.allSettled([
    fetchEdgarBundle(symbol, { includeNarrative: !fixture }),
    fetchQuote(symbol),
  ]);

  const edgar = edgarResult.status === "fulfilled" ? edgarResult.value : null;
  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const edgarDown = edgar == null || (!edgar.notFound && edgar.identity == null && edgar.filings.length === 0);

  if (fixture) {
    const input = fixture;
    let sourceNote =
      "EDGAR was not reachable. Showing the curated offline fixture, including its saved filing links.";
    let source: "fixture" | "mixed" = "fixture";
    if (edgar && !edgarDown && !edgar.notFound) {
      source = "mixed";
      sourceNote =
        "Dilution instruments, cash, and scores use the curated fixture from public filings. The filing list was refreshed from EDGAR when that feed returned.";
      if (edgar.filings.length > 0) input.filings = edgar.filings;
      if (edgar.cashAsOf && input.cash.asOf && edgar.cashAsOf > input.cash.asOf) {
        input.caveats = [
          ...input.caveats,
          `EDGAR company facts include a cash period ending ${edgar.cashAsOf}, later than the fixture cash date. Scores still use the curated cash snapshot.`,
        ];
      }
    }
    applyQuote(input, quote);
    return { ok: true, report: assembleReport(input, source, sourceNote) };
  }

  if (edgar?.notFound) {
    return {
      ok: false,
      status: 404,
      message: `No SEC company matched ${symbol}, and there is no offline fixture for it.`,
    };
  }

  if (edgar?.analysis) {
    applyQuote(edgar.analysis, quote);
    if (!quote?.price) {
      edgar.analysis.caveats = [
        ...edgar.analysis.caveats,
        "A live quote was not available, so price, float, and market cap may be blank.",
      ];
    }
    return {
      ok: true,
      report: assembleReport(
        edgar.analysis,
        "live",
        "Best-effort read of EDGAR submissions, company facts, and the latest 10-Q or 10-K. Blank capacity does not raise a score.",
      ),
    };
  }

  return {
    ok: false,
    status: 502,
    message: `EDGAR could not be reached for ${symbol}, and there is no offline fixture. DCOY still loads from the local fixture.`,
  };
}

function applyQuote(input: AnalysisInput, quote: QuoteSnapshot | null): void {
  if (!quote) return;
  if (quote.price != null) input.profile.price = quote.price;
  if (input.profile.sharesOutstanding == null && quote.sharesOutstanding != null) {
    input.profile.sharesOutstanding = quote.sharesOutstanding;
    input.profile.sharesOutstandingAsOf = input.profile.sharesOutstandingAsOf ?? "quote";
  }
  if (input.profile.floatShares == null && quote.floatShares != null) {
    input.profile.floatShares = quote.floatShares;
  }
  if (input.profile.price != null && input.profile.sharesOutstanding != null) {
    input.profile.marketCap = input.profile.price * input.profile.sharesOutstanding;
  } else if (quote.marketCap != null) {
    input.profile.marketCap = quote.marketCap;
  }
}
