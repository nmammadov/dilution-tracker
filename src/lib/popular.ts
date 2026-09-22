/**
 * Seed list from DilutionTracker Open Access popular names on 2026-09-22.
 * Checked against the SEC company ticker file the same day.
 * This is not scraped at runtime and Splitline is not affiliated with that site.
 */
export interface PopularTicker {
  symbol: string;
  /** Current SEC registrant name. */
  name: string;
  /** Short label shown on the home-page chip. */
  label: string;
  note?: string;
}

export interface SkippedTicker {
  symbol: string;
  reason: string;
}

export const POPULAR_TICKERS: PopularTicker[] = [
  { symbol: "DCOY", name: "Decoy Therapeutics Inc.", label: "Decoy Therapeutics" },
  { symbol: "GRML", name: "Greenland Mines Ltd", label: "Greenland Mines" },
  { symbol: "LHSW", name: "Lianhe Sowell International Group Ltd", label: "Lianhe Sowell" },
  {
    symbol: "QNME",
    name: "Quanome Technologies, Inc.",
    label: "Quanome Technologies",
    note: "Formerly Lakeside Holding",
  },
  { symbol: "JAGX", name: "Jaguar Health, Inc.", label: "Jaguar Health" },
  { symbol: "TOPS", name: "TOP SHIPS INC.", label: "Top Ships" },
  { symbol: "IMCC", name: "IM Cannabis Corp.", label: "IM Cannabis" },
  { symbol: "FBGL", name: "FBS Global Ltd", label: "FBS Global" },
  { symbol: "ZEO", name: "Zeo Energy Corp.", label: "Zeo Energy" },
  { symbol: "FLNA", name: "FILANA THERAPEUTICS, INC.", label: "Filana Therapeutics" },
  { symbol: "CWD", name: "CaliberCos Inc.", label: "Caliber" },
  { symbol: "IPDN", name: "Professional Diversity Network, Inc.", label: "Professional Diversity Network" },
  { symbol: "GDC", name: "GD Culture Group Ltd", label: "GD Culture Group" },
  { symbol: "NCT", name: "Intercont (Cayman) Ltd", label: "Intercont" },
  { symbol: "RAIN", name: "Rain Enhancement Technologies Holdco, Inc.", label: "Rain Enhancement" },
  { symbol: "GLND", name: "Greenland Energy Co", label: "Greenland Energy" },
  { symbol: "STI", name: "Solidion Technology Inc.", label: "Solidion Technology" },
  { symbol: "BFRG", name: "BullFrog AI Holdings, Inc.", label: "BullFrog AI" },
  { symbol: "WHLR", name: "Wheeler Real Estate Investment Trust, Inc.", label: "Wheeler REIT" },
  { symbol: "VKTX", name: "Viking Therapeutics, Inc.", label: "Viking Therapeutics" },
  { symbol: "PFSA", name: "Profusa, Inc.", label: "Profusa" },
  { symbol: "SVRE", name: "SaverOne 2014 Ltd.", label: "SaverOne" },
  { symbol: "GELS", name: "Gelteq Ltd", label: "Gelteq" },
  { symbol: "MASK", name: "3 E Network Technology Group Ltd", label: "3 E Network" },
  { symbol: "EDBL", name: "Edible Garden AG Inc", label: "Edible Garden" },
  { symbol: "VEEE", name: "Twin Vee PowerCats, Co.", label: "Twin Vee Powercats" },
  { symbol: "TPST", name: "Tempest Therapeutics, Inc.", label: "Tempest Therapeutics" },
  { symbol: "JTAI", name: "Jet.AI Inc.", label: "JetAI" },
  { symbol: "SQFT", name: "Presidio Property Trust, Inc.", label: "Presidio Property Trust" },
  { symbol: "YMT", name: "Yimutian Inc.", label: "Yimutian" },
];

/** Every name in the 2026-09-22 seed mapped to a current SEC ticker. */
export const SKIPPED_POPULAR: SkippedTicker[] = [];
