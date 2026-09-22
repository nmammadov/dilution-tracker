/**
 * Seed list of DilutionTracker-style popular names.
 * Checked against the SEC company ticker file on 2026-09-22.
 * This is not scraped at runtime and Splitline is not affiliated with that site.
 */
export interface PopularTicker {
  symbol: string;
  name: string;
  note?: string;
}

export interface SkippedTicker {
  symbol: string;
  reason: string;
}

export const POPULAR_TICKERS: PopularTicker[] = [
  { symbol: "DCOY", name: "Decoy Therapeutics Inc." },
  { symbol: "CNSP", name: "CNS Pharmaceuticals, Inc." },
  { symbol: "AMIX", name: "Autonomix Medical, Inc." },
  { symbol: "OPTT", name: "Ocean Power Technologies, Inc." },
  { symbol: "ZCAR", name: "Zoomcar Holdings, Inc." },
  { symbol: "RDZN", name: "Roadzen Inc." },
  { symbol: "VS", name: "Versus Systems Inc." },
  { symbol: "ANVS", name: "Annovis Bio, Inc." },
  { symbol: "MLGO", name: "MicroAlgo Inc." },
  { symbol: "BINI", name: "Bollinger Innovations, Inc.", note: "Formerly MULN" },
  { symbol: "HOLO", name: "MicroCloud Hologram Inc." },
  { symbol: "COSM", name: "Cosmos Health Inc." },
  { symbol: "ASNS", name: "Actelis Networks Inc." },
  { symbol: "AHG", name: "Akso Health Group" },
  { symbol: "GDHG", name: "Golden Heaven Group Holdings Ltd." },
  { symbol: "GME", name: "GameStop Corp." },
  { symbol: "SCLX", name: "Scilex Holding Co" },
  { symbol: "GMM", name: "Global Mofy AI Ltd" },
  { symbol: "SNTI", name: "Senti Biosciences Holdings, Inc." },
  { symbol: "XTIA", name: "XTI Aerospace, Inc." },
  { symbol: "SMX", name: "SMX (Security Matters) Public Ltd Co" },
  { symbol: "RGS", name: "Regis Corp" },
  { symbol: "BENF", name: "Beneficient" },
  { symbol: "EOSE", name: "Eos Energy Enterprises, Inc." },
  { symbol: "POET", name: "POET Technologies Inc." },
  { symbol: "TVGN", name: "Tevogen Inc." },
  { symbol: "MDWD", name: "MediWound Ltd." },
];

export const SKIPPED_POPULAR: SkippedTicker[] = [
  { symbol: "VVPR", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  { symbol: "ZAPP", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  { symbol: "IVP", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  {
    symbol: "MAXN",
    reason: "Nasdaq delisting proceedings in 2026. The SEC ticker file lists MAXNQ, not MAXN, so MAXN is left off the working list.",
  },
  { symbol: "QLGN", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  {
    symbol: "MULN",
    reason: "Renamed to BINI (Bollinger Innovations) effective July 28, 2025. BINI is on the working list.",
  },
  { symbol: "VLCN", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  { symbol: "CSLR", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  { symbol: "SING", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
  { symbol: "DYNT", reason: "Not in the SEC company ticker file checked on 2026-09-22." },
];
