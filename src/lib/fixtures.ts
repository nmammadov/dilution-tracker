import type { AnalysisInput } from "./types";

const Q2_10Q = "https://www.sec.gov/Archives/edgar/data/1615219/000119312526346852/dcoy-20260630.htm";
const ELOC_S1 = "https://www.sec.gov/Archives/edgar/data/1615219/000119312526269891/dcoy-20260612.htm";
const PIPE_EXHIBIT =
  "https://www.sec.gov/Archives/edgar/data/1615219/000119312526286737/dcoy-ex99_1.htm";
const SHELF_S3 =
  "https://www.sec.gov/Archives/edgar/data/1615219/000161521925000105/slrx-formsx3atmprosupp2025.htm";
const ATM_424B5 =
  "https://www.sec.gov/Archives/edgar/data/1615219/000162828025041046/slrxatmprospectus.htm";

/**
 * Curated from Decoy Therapeutics public EDGAR filings (Q2 2026 Form 10-Q,
 * the June 2026 ELOC resale prospectus, and the June 2026 private-placement release).
 * Scores are not stored here; the same scorer used for live lookups runs on these facts.
 */
export function decoyFixture(): AnalysisInput {
  return {
    analysisAsOf: "2026-09-15",
    caveats: [
      "DCOY dilution figures are a curated reading of public filings, not a live re-parse of the 10-Q HTML. Price is filled from a quote feed only when that request succeeds.",
      "The June 30, 2026 balance sheet lists 531,968 common shares outstanding. The August 11, 2026 cover page lists 655,185. Overhang uses the later cover-page count. A July 20, 2026 record date in the September 2026 8-K listed 590,185 shares entitled to vote.",
      "H1 2025 ATM share counts disagree inside the same 10-Q (equity footnote 2,218 shares versus MD&A 1,966). Both describe about $0.4 million of gross proceeds. The table shows the footnote count.",
      "On September 14, 2026 stockholders approved issuance of the June PIPE milestone warrants. Exercise still depends on the clinical milestones, so those shares stay in overhang and are not counted as near-term issuance.",
      "The same meeting approved cutting authorized common stock by 10 million shares, to 90 million. The 8-K does not say the certificate of amendment was filed, so this fixture keeps the 100 million authorized shares from the June 30 balance sheet. Either figure is still more than 10× shares outstanding.",
    ],
    profile: {
      symbol: "DCOY",
      name: "Decoy Therapeutics Inc.",
      cik: "0001615219",
      exchange: "Nasdaq",
      sic: "2834",
      sicDescription: "Pharmaceutical Preparations",
      sharesOutstanding: 655_185,
      sharesOutstandingAsOf: "2026-08-11",
      floatShares: null,
      authorizedShares: 100_000_000,
      price: null,
      marketCap: null,
    },
    cash: {
      asOf: "2026-06-30",
      totalCash: 8_289_108,
      restrictedCash: 2_700_000,
      operatingCashFlow: -5_541_348,
      operatingCashFlowMonths: 6,
      workingCapital: 3_800_000,
      goingConcern: true,
      goingConcernNote:
        "The Q2 2026 report discloses substantial doubt about the ability to continue as a going concern. Management said cash is expected to fund restructured operations into late 2026.",
      sourceLabel: "Form 10-Q for the quarter ended June 30, 2026, filed August 12, 2026",
      sourceUrl: Q2_10Q,
    },
    instruments: [
      {
        kind: "shelf",
        name: "Form S-3 unsold securities",
        remainingDollars: null,
        registeredDollars: 46_236_111,
        remainingShares: null,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        agent: null,
        status: "Filed August 15, 2025; remaining balance not restated",
        edgarUrl: SHELF_S3,
        notes:
          "The S-3 says unsold securities were registered at a maximum aggregate price of $46,236,111 under Rule 415(a)(6). That cited aggregate is not treated as current remaining shelf capacity. The August 22, 2025 ATM supplement also describes a baby-shelf limit while the public float was about $9.2 million. This row does not by itself raise Offering Ability.",
      },
      {
        kind: "eloc",
        name: "ELOC with C/M Capital Master Fund",
        remainingDollars: 5_000_000,
        agent: "C/M Capital Master Fund, LP",
        remainingShares: null,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: true,
        paused: true,
        status: "Open, paused about 180 days after the June 26, 2026 PIPE",
        edgarUrl: ELOC_S1,
        notes:
          "December 12, 2024 purchase agreement. About $4.54 million had been drawn through July 30, 2025, leaving about $5.0 million. The June 2026 PIPE prohibits ELOC sales for 180 days. Resale shares on this line are counted on the shelf row so they are not double-counted.",
      },
      {
        kind: "atm",
        name: "At-the-market program",
        remainingDollars: null,
        registeredDollars: 2_600_000,
        remainingShares: null,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: true,
        paused: true,
        agent: "Ladenburg Thalmann & Co., Inc.",
        status: "Paused about 180 days after the June 26, 2026 PIPE; remainder not restated",
        edgarUrl: ATM_424B5,
        notes:
          "Sales agreement dated February 5, 2021. The August 22, 2025 prospectus supplement offers shares with an aggregate offering price of up to $2,600,000 through Ladenburg Thalmann & Co., Inc. The Q2 2026 10-Q does not restate what remains, so remaining capacity stays blank and does not raise Offering Ability. H1 2025 ATM sales were about $0.4 million, before this supplement. No ATM sales in the first half of 2026.",
      },
      {
        kind: "shelf",
        name: "ELOC resale registration",
        remainingDollars: null,
        remainingShares: 808_000,
        overhangShares: 808_000,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        status: "Resale S-1 covering remaining ELOC shares, not a primary shelf",
        edgarUrl: ELOC_S1,
        notes:
          "June 2026 prospectus registers up to 808,000 shares (800,000 purchase shares and 8,000 commitment shares) against the remaining ELOC availability, assuming a $6.25 share price. This row is overhang, not a company-controlled primary shelf.",
      },
      {
        kind: "warrant",
        name: "Outstanding common warrants",
        remainingDollars: null,
        remainingShares: 4_699_381,
        overhangShares: 4_699_381,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        status: "4,699,381 warrants outstanding at June 30, 2026",
        edgarUrl: Q2_10Q,
        notes:
          "Weighted-average exercise price about $9.91. The total includes November 2025 series and representative warrants plus 3,766,500 warrants granted in 2026 at $5.91, largely the milestone Series A (100%), Series B (200%), and Series C (200%) warrants on the June PIPE. Stockholders approved issuance on exercise of those milestone warrants on September 14, 2026. The clinical milestones still gate exercise, so the shares are overhang and not near-term issuance.",
      },
      {
        kind: "convertible",
        name: "Common reserved for preferred conversion",
        remainingDollars: null,
        remainingShares: 401_126,
        overhangShares: 401_126,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        status: "Reserved; none converted as of June 30, 2026",
        edgarUrl: Q2_10Q,
        notes:
          "401,126 common shares underlie Series A and Series B preferred. Conversion waits on stockholder approval under Nasdaq Rule 5635, so the shares count as overhang and not as near-term issuance.",
      },
      {
        kind: "preferred",
        name: "Series A and Series B preferred",
        remainingDollars: null,
        remainingShares: 1_674,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        status: "1,674 shares issued and outstanding",
        edgarUrl: Q2_10Q,
        notes:
          "877.709 Series A and 796.306 Series B non-voting convertible preferred issued in the November 2025 merger exchange. The common-share reserve is on the convertibles row.",
      },
      {
        kind: "pipe",
        name: "June 2026 private placement",
        remainingDollars: 0,
        remainingShares: null,
        overhangShares: null,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        status: "Closed June 29, 2026",
        edgarUrl: PIPE_EXHIBIT,
        notes:
          "592,217 shares or pre-funded warrants at $5.91. Gross proceeds about $3.5 million. Milestone warrants could add about $3.5 million, $7.0 million, and $7.0 million if fully exercised. Those warrants are inside the warrant overhang, not a second share count here.",
      },
    ],
    events: [
      {
        date: "2026-06-29",
        kind: "equity-raise",
        label: "PIPE",
        proceeds: 3_500_000,
        shares: 592_217,
        price: 5.91,
        edgarUrl: PIPE_EXHIBIT,
        notes:
          "Closed private placement of common stock or pre-funded warrants, plus milestone Series A, B, and C warrants.",
      },
      {
        date: "2025-11-12",
        kind: "equity-raise",
        label: "Registered offering",
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: Q2_10Q,
        notes:
          "November 2025 offering. Pre-funded warrants for up to 179,361 shares were fully exercised by December 31, 2025. Series A and Series B warrants and representative warrants remained outstanding. Share counts in the 10-Q are adjusted for the March 2026 reverse split. Gross proceeds are not restated in that note.",
      },
      {
        date: "2025-06-30",
        kind: "eloc-draw",
        label: "ELOC draws",
        proceeds: 700_000,
        shares: 1_593,
        price: null,
        edgarUrl: Q2_10Q,
        notes:
          "First-half 2025 issuances under the ELOC, as presented in the Q2 2026 10-Q. Dated at the period end because the filing does not list each draw.",
      },
      {
        date: "2025-06-30",
        kind: "atm-draw",
        label: "ATM sales",
        proceeds: 400_000,
        shares: 2_218,
        price: null,
        edgarUrl: Q2_10Q,
        notes:
          "First-half 2025 at-the-market sales. The equity footnote cites 2,218 shares and the MD&A cites 1,966; both cite about $0.4 million.",
      },
      {
        date: "2026-03-06",
        kind: "reverse-split",
        label: "1-for-12 reverse split",
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: Q2_10Q,
        notes: "Certificate of amendment filed March 5, 2026. Effective March 6, 2026.",
      },
      {
        date: "2025-08-15",
        kind: "reverse-split",
        label: "1-for-15 reverse split",
        proceeds: null,
        shares: null,
        price: null,
        edgarUrl: Q2_10Q,
        notes: "Effective August 15, 2025, while the issuer was still Salarius Pharmaceuticals.",
      },
    ],
    filings: [
      {
        form: "S-3",
        filed: "2025-08-15",
        description: "Shelf registration citing $46,236,111 of unsold securities",
        url: SHELF_S3,
      },
      {
        form: "424B5",
        filed: "2025-08-22",
        description: "ATM prospectus supplement, up to $2.6 million, Ladenburg Thalmann",
        url: ATM_424B5,
      },
      {
        form: "8-K",
        filed: "2026-09-15",
        description:
          "Special meeting: stockholders approved milestone-warrant issuance and an authorized-share reduction",
        url: "https://www.sec.gov/Archives/edgar/data/1615219/000161521926000016/dcoy-20260914.htm",
      },
      {
        form: "10-Q",
        filed: "2026-08-12",
        description: "Quarterly report for the period ended June 30, 2026",
        url: Q2_10Q,
      },
      {
        form: "8-K EX-99.1",
        filed: "2026-06-29",
        description: "Press release on the June 2026 private placement",
        url: PIPE_EXHIBIT,
      },
      {
        form: "S-1",
        filed: "2026-06-12",
        description: "Resale prospectus for remaining ELOC shares",
        url: ELOC_S1,
      },
    ],
  };
}

const IMCC_SEP2 = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326004396/zk2636065.htm";
const IMCC_F3 = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326003150/zk2635519.htm";
const IMCC_SPLIT = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326004289/exhibit_99-1.htm";
const IMCC_Q2 = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326004126/zk2635894.htm";
const IMCC_20F = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326001877/zk2634906.htm";
const IMCC_APR = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326002019/zk2635038.htm";
const IMCC_MAY = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326002452/zk2635230.htm";
const IMCC_JUN = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326003087/zk2635492.htm";
const IMCC_JUL = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326003389/zk2635630.htm";
const IMCC_AUG = "https://www.sec.gov/Archives/edgar/data/1792030/000117891326003959/zk2635890.htm";

/**
 * Curated from IM Cannabis public EDGAR filings. Scores are not stored here.
 * Share counts that predate the August 27, 2026 30:1 consolidation are divided
 * by 30 because that filing states the ratio. Principal amounts are the US$
 * figures printed in the 6-Ks. No conversion share count is estimated.
 */
export function imccFixture(): AnalysisInput {
  const resaleShares = Math.round(17_276_931 / 30);
  const julyWarrants = Math.round(1_483_386 / 30);
  const augustWarrants = Math.round(2_052_545 / 30);
  return {
    analysisAsOf: "2026-09-23",
    caveats: [
      "IMCC figures are a curated reading of public filings. Cash stays in Canadian dollars. Nothing here is converted to US dollars, and no share count is estimated by dividing a note principal by the floor price.",
      "The June 9, 2026 Form F-3 registers up to 17,276,931 common shares for resale, against 9,016,539 shares outstanding as of June 8, 2026. The August 27, 2026 6-K states a 30:1 consolidation that reduced common shares from 18,567,650 to 618,899. Resale overhang uses 17,276,931 / 30.",
      "Warrants on the April, May, and June notes are inside that F-3 total and are not counted again. The July 1 and August 7 warrant counts are pre-consolidation, so they are divided by 30. The September 2 warrant for 77,855 shares is already on a post-consolidation basis.",
      "Each 2026 convertible note is treated as still outstanding because these filings do not say it was repaid or fully converted. The September 2, 2026 note is the clearest open issuance: variable conversion price and share settlement only.",
      "Shares outstanding are the August 27, 2026 post-consolidation count. Issuances after that date are not in the count.",
    ],
    profile: {
      symbol: "IMCC",
      name: "IM Cannabis Corp.",
      cik: "0001792030",
      exchange: "Nasdaq",
      sic: "2833",
      sicDescription: "Medicinal Chemicals & Botanical Products",
      sharesOutstanding: 618_899,
      sharesOutstandingAsOf: "2026-08-27",
      floatShares: null,
      authorizedShares: null,
      price: null,
      marketCap: null,
    },
    cash: {
      asOf: "2026-06-30",
      totalCash: 1_617_000,
      restrictedCash: 124_000,
      operatingCashFlow: -1_339_000,
      operatingCashFlowMonths: 6,
      workingCapital: null,
      goingConcern: true,
      goingConcernNote:
        "The June 30, 2026 interim financial statements, furnished on Form 6-K on August 13, 2026, say these conditions raise uncertainties that cast significant doubt on the ability to continue as a going concern. The March 30, 2026 Form 20-F also says the conditions raise substantial doubt about continuing as a going concern.",
      sourceLabel:
        "Form 6-K furnished August 13, 2026, inline XBRL for the six months ended June 30, 2026",
      sourceUrl: IMCC_Q2,
      currency: "CAD",
      restrictedIncludedInTotal: false,
      sourceForm: "6-K",
    },
    instruments: [
      {
        kind: "shelf",
        name: "June 9, 2026 Form F-3 resale",
        remainingDollars: null,
        remainingShares: resaleShares,
        overhangShares: resaleShares,
        nearTermIssuanceShares: null,
        usable: false,
        paused: false,
        resaleRegistration: true,
        status: "Resale prospectus filed June 9, 2026; EFFECT June 16, 2026",
        edgarUrl: IMCC_F3,
        notes:
          "The prospectus relates to the resale of up to 17,276,931 common shares by the selling shareholder: conversion shares and warrants on the April 2026 US$250,000 note, the May 2026 US$300,000 note, and the June 2026 US$225,000 note. It is not a primary shelf and it states no remaining dollar capacity. After the 30:1 consolidation, 17,276,931 / 30 = 575,898 shares. Those warrant and conversion shares are not counted a second time.",
      },
      warrantRow("2026-07-01", julyWarrants, 1_483_386, "0.22", IMCC_JUL),
      warrantRow("2026-08-07", augustWarrants, 2_052_545, "0.17", IMCC_AUG),
      {
        kind: "warrant",
        name: "2026-09-02 note warrant",
        remainingDollars: null,
        remainingShares: 77_855,
        overhangShares: 77_855,
        nearTermIssuanceShares: 77_855,
        usable: false,
        paused: false,
        issuedOn: "2026-09-02",
        status: "Exercisable on issuance, as stated in the September 2, 2026 6-K",
        edgarUrl: IMCC_SEP2,
        notes:
          "Warrant to purchase up to 77,855 common shares at CAD$4.63. The note closed after the 30:1 consolidation, so this count is not divided.",
      },
      ...[
        ["2026-04-07", 250_000, IMCC_APR, "272,861 shares at CAD$0.47"],
        ["2026-05-07", 300_000, IMCC_MAY, "1,127,820 shares at CAD$0.36"],
        ["2026-06-03", 225_000, IMCC_JUN, "781,250 shares at CAD$0.40"],
        ["2026-07-01", 225_000, IMCC_JUL, "1,483,386 shares at CAD$0.22, before the 30:1 consolidation"],
        ["2026-08-07", 250_000, IMCC_AUG, "2,052,545 shares at CAD$0.17, before the 30:1 consolidation"],
        ["2026-09-02", 225_000, IMCC_SEP2, "77,855 shares at CAD$4.63"],
      ].map(([date, principal, url, warrant]) =>
        convertRow(String(date), Number(principal), String(url), String(warrant)),
      ),
    ],
    events: [
      raiseRow("2026-04-07", 250_000, IMCC_APR, "April 6, 2026 6-K. The June 9, 2026 F-3 says this offering closed on April 7, 2026. 10% original issue discount. Warrant for 272,861 shares."),
      raiseRow("2026-05-07", 300_000, IMCC_MAY, "May 7, 2026 6-K. Closed the same day. Warrant for 1,127,820 shares."),
      raiseRow("2026-06-03", 225_000, IMCC_JUN, "June 3, 2026 6-K. Closed the same day. Warrant for 781,250 shares."),
      raiseRow("2026-07-01", 225_000, IMCC_JUL, "July 1, 2026 6-K. Closed the same day. Warrant for 1,483,386 shares."),
      raiseRow("2026-08-07", 250_000, IMCC_AUG, "August 7, 2026 6-K. Closed the same day. Warrant for 2,052,545 shares."),
      raiseRow("2026-09-02", 225_000, IMCC_SEP2, "September 2, 2026 6-K. Principal US$225,000, net proceeds US$202,500. Fixed price US$3.328, variable price 90% of the 20-day lowest VWAP, floor US$0.665692. Share settlement only. Warrant for 77,855 shares at CAD$4.63. The company agreed to file an F-3 resale registration."),
      {
        date: "2026-08-27",
        kind: "reverse-split",
        label: "30-for-1 share consolidation",
        proceeds: null,
        shares: 618_899,
        price: null,
        edgarUrl: IMCC_SPLIT,
        notes:
          "August 27, 2026 6-K press release: common shares were reduced from 18,567,650 to 618,899 on a 30:1 basis. Outstanding convertible securities were proportionately adjusted.",
      },
    ],
    filings: [
      { form: "6-K", filed: "2026-09-02", description: "US$225,000 convertible note and 77,855 warrants", url: IMCC_SEP2 },
      { form: "F-3", filed: "2026-06-09", description: "Resale prospectus for up to 17,276,931 common shares", url: IMCC_F3 },
      { form: "6-K", filed: "2026-08-27", description: "30:1 share consolidation, 618,899 shares outstanding", url: IMCC_SPLIT },
      { form: "6-K", filed: "2026-08-13", description: "Interim financials for the six months ended June 30, 2026", url: IMCC_Q2 },
      { form: "20-F", filed: "2026-03-30", description: "Annual report for the year ended December 31, 2025", url: IMCC_20F },
      { form: "6-K", filed: "2026-08-07", description: "US$250,000 convertible note", url: IMCC_AUG },
      { form: "6-K", filed: "2026-07-01", description: "US$225,000 convertible note", url: IMCC_JUL },
      { form: "6-K", filed: "2026-06-03", description: "US$225,000 convertible note", url: IMCC_JUN },
      { form: "6-K", filed: "2026-05-07", description: "US$300,000 convertible note", url: IMCC_MAY },
      { form: "6-K", filed: "2026-04-06", description: "US$250,000 convertible note", url: IMCC_APR },
    ],
  };
}

function convertRow(date: string, principal: number, url: string, warrant: string): AnalysisInput["instruments"][number] {
  const floor =
    date === "2026-09-02"
      ? " Fixed conversion price US$3.328. Floor price US$0.665692."
      : "";
  return {
    kind: "convertible",
    name: `${date} convertible note`,
    remainingDollars: null,
    remainingShares: null,
    overhangShares: null,
    nearTermIssuanceShares: null,
    usable: true,
    paused: false,
    variableConversion: true,
    shareSettled: true,
    issuedOn: date,
    status: "Variable conversion price, share settlement only",
    edgarUrl: url,
    notes: `Principal US$${principal.toLocaleString("en-US")} as stated in the 6-K. 8% interest. Original issue discount, purchase price 90% of principal. Not repayable in cash. Conversion price is the lower of a fixed price and 90% of the lowest 20-day VWAP.${floor} Accompanying warrant: ${warrant}. The 6-K does not state a maximum conversion share count, so none is estimated.`,
  };
}

function warrantRow(
  date: string,
  adjusted: number,
  printed: number,
  exerciseCad: string,
  url: string,
): AnalysisInput["instruments"][number] {
  return {
    kind: "warrant",
    name: `${date} note warrant`,
    remainingDollars: null,
    remainingShares: adjusted,
    overhangShares: adjusted,
    nearTermIssuanceShares: adjusted,
    usable: false,
    paused: false,
    issuedOn: date,
    status: `Pre-consolidation count ${printed.toLocaleString("en-US")} divided by the 30:1 ratio`,
    edgarUrl: url,
    notes: `The 6-K states a warrant for ${printed.toLocaleString("en-US")} shares at CAD$${exerciseCad}. The August 27, 2026 consolidation says outstanding convertible securities were proportionately adjusted, so overhang uses ${adjusted.toLocaleString("en-US")} shares.`,
  };
}

function raiseRow(date: string, proceeds: number, url: string, notes: string): AnalysisInput["events"][number] {
  return {
    date,
    kind: "equity-raise",
    label: "Convertible note",
    proceeds,
    shares: null,
    price: null,
    edgarUrl: url,
    notes,
  };
}

const FIXTURES: Record<string, () => AnalysisInput> = {
  DCOY: decoyFixture,
  IMCC: imccFixture,
};

export function getFixture(symbol: string): AnalysisInput | null {
  const factory = FIXTURES[symbol.toUpperCase()];
  return factory ? factory() : null;
}
