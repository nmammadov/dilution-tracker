import { buildLikelihood, scoreAnalysis } from "./score";
import { deriveCash } from "./metrics";
import type { AnalysisInput, DataSource, TickerReport } from "./types";

export function assembleReport(
  input: AnalysisInput,
  source: DataSource,
  sourceNote: string,
): TickerReport {
  const scores = scoreAnalysis(input);
  const cashView = deriveCash(input.cash);
  return {
    profile: input.profile,
    scores,
    instruments: input.instruments,
    offerings: input.events.filter((event) => event.kind !== "reverse-split"),
    reverseSplits: input.events.filter((event) => event.kind === "reverse-split"),
    cash: { ...input.cash, ...cashView },
    likelihood: buildLikelihood(input, scores),
    filings: input.filings,
    source,
    sourceNote,
    analysisAsOf: input.analysisAsOf,
    caveats: input.caveats,
  };
}
