/**
 * Scoring cutoffs. The ticker page and the README describe these same numbers.
 * Change them here so the screen and the write-up stay in lockstep.
 */
export const THRESHOLDS = {
  /** Open ATM or ELOC remaining capacity that counts as a real issuance path. */
  facilityUsd: 1_000_000,
  /** Effective shelf remaining capacity that counts on its own. */
  shelfUsd: 5_000_000,
  /** Warrants + convertibles + resale registrations, divided by shares outstanding. */
  overhangRatio: 0.5,
  /** Runway at or under this many months is Cash Need High. */
  runwayMonths: 9,
  /** About 24 months, inclusive, measured back from the analysis date. */
  historicalDays: 731,
  /** (authorized − outstanding) / outstanding. Combined with a recent raise. */
  headroomMultiple: 10,
  /** Near-term exercisable or convertible shares / shares outstanding. */
  nearTermRatio: 0.5,
} as const;

export const SCORE_MAP: {
  title: string;
  inputs: string[];
  formula: string;
  threshold: string;
  filings: string[];
}[] = [
  {
    title: "Offering Ability",
    inputs: [
      "S-3 / S-3ASR registered dollars and remaining dollars, if the filing states them",
      "ATM remaining dollars, program size, and sales agent",
      "ELOC remaining commitment",
      "Near-term exercisable or convertible shares versus shares outstanding",
      "Authorized shares versus shares outstanding, plus equity raises in the lookback",
      "Market cap, shown only as scale",
    ],
    formula:
      "Shelf remaining + ATM remaining + ELOC remaining, tested against the dollar cutoffs, with two share-count paths as alternates.",
    threshold:
      "High if ATM or ELOC remaining ≥ $1 million (a pause still counts), or usable shelf remaining ≥ $5 million, or near-term issuance ≥ 50% of shares outstanding, or authorized headroom ≥ 10× and at least one equity raise in the lookback. A cited program size or unsold aggregate is not remaining capacity.",
    filings: ["S-3", "S-3ASR", "S-1", "424B", "8-K", "10-Q", "10-K"],
  },
  {
    title: "Overhead Supply",
    inputs: [
      "Warrant shares",
      "Convertible shares reserved",
      "Resale-registered shares",
      "Shares outstanding",
    ],
    formula: "(Warrants + convertibles + resale registrations) / shares outstanding.",
    threshold: "High if that ratio is ≥ 50%.",
    filings: ["10-Q", "10-K", "S-1", "S-3", "424B"],
  },
  {
    title: "Historical",
    inputs: [
      "Count of equity raises in the lookback (PIPE, registered deal, ATM draw, ELOC draw)",
      "Count of ATM and ELOC draws",
      "Count of reverse splits",
    ],
    formula: "Counts inside the 731 days before the analysis date.",
    threshold:
      "High if raises ≥ 2, or reverse splits ≥ 2, or at least one reverse split and one raise, or ATM/ELOC draws ≥ 2.",
    filings: ["8-K", "424B", "S-1", "10-Q", "10-K"],
  },
  {
    title: "Cash Need",
    inputs: [
      "Cash, cash equivalents, and restricted cash",
      "Restricted cash",
      "Unrestricted cash (total minus restricted)",
      "Operating cash flow and the length of that period",
      "Monthly burn and runway months",
      "Going-concern flag",
    ],
    formula: "Unrestricted cash / monthly operating burn, plus a going-concern check.",
    threshold:
      "High if going-concern language is present, or runway ≤ 9 months. Missing cash or burn stays Low.",
    filings: ["10-Q", "10-K"],
  },
  {
    title: "Overall Risk",
    inputs: [
      "Cash Need High or Low",
      "Offering Ability High or Low",
      "Overhead Supply High or Low",
      "Historical High or Low",
    ],
    formula: "Combine the four component levels. No extra market data.",
    threshold:
      "High if Cash Need is High and Offering Ability or Overhead Supply is High, or if at least 3 of the 4 components are High.",
    filings: ["The filings linked on the component scores"],
  },
];

export const METHODOLOGY: { title: string; body: string }[] = [
  {
    title: "Offering Ability",
    body: `High when an ATM or ELOC is still in place with at least $${(THRESHOLDS.facilityUsd / 1_000_000).toFixed(0)} million remaining (a contractual pause still counts), or an effective shelf has at least $${(THRESHOLDS.shelfUsd / 1_000_000).toFixed(0)} million remaining, or near-term exercisable issuance is at least ${THRESHOLDS.nearTermRatio * 100}% of shares outstanding, or authorized-but-unissued shares are at least ${THRESHOLDS.headroomMultiple}× shares outstanding and the company raised equity in the lookback window.`,
  },
  {
    title: "Overhead Supply",
    body: `High when warrants, convertible shares, and resale-registered shares together are at least ${THRESHOLDS.overhangRatio * 100}% of shares outstanding. Resale shares that are the same securities as a warrant line should be counted once.`,
  },
  {
    title: "Historical",
    body: `High when the ~24 months before the analysis date include at least two equity raises (PIPE, registered deal, ATM draw, or ELOC draw), at least two reverse splits, one reverse split plus one equity raise, or at least two ATM or ELOC draws.`,
  },
  {
    title: "Cash Need",
    body: `High when the filing uses going-concern language, or unrestricted cash covers ${THRESHOLDS.runwayMonths} months or less of trailing operating burn. Runway uses cash minus restricted cash when both are known. Missing cash evidence stays Low.`,
  },
  {
    title: "Overall Risk",
    body: "High when Cash Need is High and either Offering Ability or Overhead Supply is High, or when at least three of those four component scores are High.",
  },
];
