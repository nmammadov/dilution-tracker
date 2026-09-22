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
