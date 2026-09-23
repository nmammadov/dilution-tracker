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
  /** Plain-English rule. Same rule for every ticker. */
  formula: string;
  /** The ticker's numbers, then the High or Low result. */
  numericLine: string;
  /** The comparison that decided High versus Low. */
  decision: string;
  inputs: EvidenceInput[];
  sources: FilingLink[];
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
  /** Headline registration or program size when remaining dollars are a different figure. */
  registeredDollars?: number | null;
  /** ATM sales agent or ELOC counterparty, when the filing names one. */
  agent?: string | null;
  /**
   * Conversion price moves with VWAP or another trading-price formula.
   * A fixed conversion price stays false.
   */
  variableConversion?: boolean;
  /** The note is satisfied by issuing shares. Cash repayment is not available. */
  shareSettled?: boolean;
  /** F-3/S-3 (or S-1) resale registration for a selling shareholder, not a primary shelf. */
  resaleRegistration?: boolean;
  /** Issue or closing date (YYYY-MM-DD) when the filing states one. */
  issuedOn?: string | null;
}

export interface EvidenceInput {
  label: string;
  value: string;
  note: string | null;
  href: string | null;
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
  /** Filing currency. Null means US dollars. Amounts are not converted. */
  currency?: "USD" | "CAD" | null;
  /**
   * True when totalCash already includes restricted cash (US-GAAP combined line).
   * False when the filing presents cash equivalents and restricted cash as separate lines.
   * Omitted means true, so existing snapshots keep subtracting restricted cash.
   */
  restrictedIncludedInTotal?: boolean;
  /** Form type of the cash source, when it is not a 10-Q or 10-K. */
  sourceForm?: string | null;
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
