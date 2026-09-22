export type ScoreLevel = "High" | "Low";

export type ScoreId =
  | "overall"
  | "offeringAbility"
  | "overheadSupply"
  | "historical"
  | "cashNeed";

export type InstrumentKind =
  | "shelf"
  | "atm"
  | "eloc"
  | "warrant"
  | "convertible"
  | "pipe"
  | "preferred";

export type EventKind = "equity-raise" | "reverse-split" | "atm-draw" | "eloc-draw";

export type DataSource = "live" | "fixture" | "mixed";

export interface ScoreCard {
  id: ScoreId;
  label: string;
  level: ScoreLevel;
  why: string;
}

export interface Instrument {
  kind: InstrumentKind;
  name: string;
  /** Dollars still available to sell or draw. Null when the filing does not state a figure. */
  remainingDollars: number | null;
  /** Shares still issuable, exercisable, or reserved under this line. */
  remainingShares: number | null;
  /**
   * Shares that count as overhead supply (warrants, convertibles, resale registrations).
   * Null means the filing did not give a count. Zero means a known empty overhang.
   */
  overhangShares: number | null;
  /**
   * Shares the company or holders can issue or convert now, without a new milestone
   * or stockholder vote. Used for offering-ability, not for overhang.
   */
  nearTermIssuanceShares: number | null;
  /** Facility still exists. A contractual pause stays true. */
  usable: boolean;
  paused: boolean;
  status: string;
  edgarUrl: string | null;
  notes: string | null;
}

export interface CapitalEvent {
  date: string;
  kind: EventKind;
  label: string;
  proceeds: number | null;
  shares: number | null;
  price: number | null;
  edgarUrl: string | null;
  notes: string | null;
}

export interface FilingLink {
  form: string;
  filed: string;
  description: string;
  url: string;
}

export interface CashFacts {
  asOf: string | null;
  /** Cash, cash equivalents, and restricted cash when the filing presents them together. */
  totalCash: number | null;
  restrictedCash: number | null;
  /** Negative when operations consumed cash. */
  operatingCashFlow: number | null;
  operatingCashFlowMonths: number | null;
  workingCapital: number | null;
  goingConcern: boolean;
  goingConcernNote: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  cik: string | null;
  exchange: string | null;
  sic: string | null;
  sicDescription: string | null;
  sharesOutstanding: number | null;
  sharesOutstandingAsOf: string | null;
  floatShares: number | null;
  authorizedShares: number | null;
  price: number | null;
  marketCap: number | null;
}

export interface AnalysisInput {
  profile: CompanyProfile;
  cash: CashFacts;
  instruments: Instrument[];
  events: CapitalEvent[];
  filings: FilingLink[];
  /** Date the lookback window and the narrative are measured from (YYYY-MM-DD). */
  analysisAsOf: string;
  caveats: string[];
}

export interface CashView {
  unrestrictedCash: number | null;
  monthlyBurn: number | null;
  runwayMonths: number | null;
}

export interface TickerReport {
  profile: CompanyProfile;
  scores: ScoreCard[];
  instruments: Instrument[];
  offerings: CapitalEvent[];
  reverseSplits: CapitalEvent[];
  cash: CashFacts & CashView;
  likelihood: string;
  filings: FilingLink[];
  source: DataSource;
  sourceNote: string;
  analysisAsOf: string;
  caveats: string[];
}
