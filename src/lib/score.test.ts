import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleReport } from "./assemble";
import { decoyFixture, imccFixture } from "./fixtures";
import { interpretFilings } from "./liveFacts";
import { deriveCash } from "./metrics";
import {
  detectGoingConcern,
  extractAtmAgent,
  extractAtmProgramDollars,
  extractConsolidation,
  extractConvertibleNote,
  extractInlineCash,
  extractResaleShareCount,
  extractShelfUnsoldDollars,
  isoFromLongDate,
  mentionsAtmProgram,
} from "./parse";
import { scoreAnalysis } from "./score";
import type { AnalysisInput, Instrument } from "./types";

function input(partial: Partial<AnalysisInput> & Pick<AnalysisInput, "instruments" | "events" | "cash">): AnalysisInput {
  return {
    analysisAsOf: "2026-08-12",
    caveats: [],
    filings: [],
    profile: {
      symbol: "TEST",
      name: "Test Co",
      cik: null,
      exchange: null,
      sic: null,
      sicDescription: null,
      sharesOutstanding: 1_000_000,
      sharesOutstandingAsOf: "2026-08-12",
      floatShares: null,
      authorizedShares: 2_000_000,
      price: null,
      marketCap: null,
    },
    ...partial,
    profile: {
      symbol: "TEST",
      name: "Test Co",
      cik: null,
      exchange: null,
      sic: null,
      sicDescription: null,
      sharesOutstanding: 1_000_000,
      sharesOutstandingAsOf: "2026-08-12",
      floatShares: null,
      authorizedShares: 2_000_000,
      price: null,
      marketCap: null,
      ...partial.profile,
    },
  };
}

function levels(source: AnalysisInput) {
  return Object.fromEntries(scoreAnalysis(source).map((score) => [score.id, score.level]));
}

describe("DCOY fixture", () => {
  it("scores every signal High and explains why", () => {
    const facts = decoyFixture();
    const report = assembleReport(facts, "fixture", "test");
    for (const score of report.scores) {
      assert.equal(score.level, "High", `${score.label} should be High: ${score.why}`);
      assert.ok(score.formula.length > 40, score.id);
      assert.match(score.numericLine, new RegExp(score.level.toUpperCase()));
      assert.ok(score.inputs.length > 0, score.id);
      assert.ok(score.decision.length > 20, score.id);
      assert.ok(score.sources.length > 0, score.id);
    }
    const ability = report.scores.find((score) => score.id === "offeringAbility");
    assert.ok(ability);
    assert.match(ability.numericLine, /ELOC remaining \$5M/);
    assert.match(ability.decision, /\$5,000,000/);
    assert.match(ability.formula, /\$1 million/);
    assert.ok(ability.inputs.some((row) => row.label.startsWith("Shelf")));
    assert.ok(ability.inputs.some((row) => /Ladenburg/.test(`${row.value} ${row.note ?? ""}`)));
    assert.ok(ability.sources.some((source) => source.url.includes("slrx-formsx3atmprosupp2025")));
    assert.ok(ability.sources.some((source) => source.url.includes("slrxatmprospectus")));
    const overhead = report.scores.find((score) => score.id === "overheadSupply");
    assert.match(overhead?.numericLine ?? "", /902%/);
    assert.match(overhead?.decision ?? "", /50%/);
    const cashNeed = report.scores.find((score) => score.id === "cashNeed");
    assert.match(cashNeed?.numericLine ?? "", /6\.1 months/);
    assert.match(cashNeed?.numericLine ?? "", /going concern yes/i);
    const historical = report.scores.find((score) => score.id === "historical");
    assert.match(historical?.numericLine ?? "", /4 equity raises/);
    assert.match(historical?.numericLine ?? "", /2 reverse splits/);
    assert.match(report.likelihood, /Offering likelihood is elevated/);
    assert.equal(report.offerings.length, 4);
    assert.equal(report.reverseSplits.length, 2);
    assert.ok(report.instruments.some((item) => item.kind === "eloc"));
    assert.ok(report.instruments.some((item) => item.kind === "shelf"));
    assert.ok(report.instruments.some((item) => item.kind === "warrant"));
    assert.ok(report.instruments.some((item) => item.kind === "convertible"));
    assert.ok(report.instruments.some((item) => item.kind === "pipe"));
    assert.ok(report.instruments.some((item) => item.kind === "preferred"));
    assert.ok(report.instruments.some((item) => item.kind === "atm"));

    const cash = deriveCash(facts.cash);
    assert.ok(cash.unrestrictedCash != null && cash.unrestrictedCash < 6_000_000);
    assert.ok(cash.runwayMonths != null && cash.runwayMonths <= 9);
    assert.equal(facts.cash.totalCash, 8_289_108);
    assert.equal(facts.cash.restrictedCash, 2_700_000);
  });
});

describe("scoring rules", () => {
  it("stays Low when the filing record is quiet", () => {
    const scored = levels(
      input({
        instruments: [],
        events: [],
        cash: {
          asOf: "2026-06-30",
          totalCash: 50_000_000,
          restrictedCash: 0,
          operatingCashFlow: -1_000_000,
          operatingCashFlowMonths: 12,
          workingCapital: null,
          goingConcern: false,
          goingConcernNote: null,
          sourceLabel: null,
          sourceUrl: null,
        },
      }),
    );
    assert.deepEqual(scored, {
      overall: "Low",
      offeringAbility: "Low",
      overheadSupply: "Low",
      historical: "Low",
      cashNeed: "Low",
    });
  });

  it("marks Overall High when only cash need and overhead are High", () => {
    const scored = levels(
      input({
        instruments: [overhang(600_000)],
        events: [],
        cash: tightCash(true),
      }),
    );
    assert.equal(scored.cashNeed, "High");
    assert.equal(scored.overheadSupply, "High");
    assert.equal(scored.offeringAbility, "Low");
    assert.equal(scored.historical, "Low");
    assert.equal(scored.overall, "High");
  });

  it("keeps Overall Low when cash need is the only High score", () => {
    const scored = levels(
      input({
        instruments: [],
        events: [],
        cash: tightCash(false),
      }),
    );
    assert.equal(scored.cashNeed, "High");
    assert.equal(scored.overall, "Low");
  });

  it("marks Overall High when three components are High without cash need", () => {
    const scored = levels(
      input({
        instruments: [
          overhang(600_000),
          {
            kind: "eloc",
            name: "Equity line",
            remainingDollars: 5_000_000,
            remainingShares: null,
            overhangShares: null,
            nearTermIssuanceShares: null,
            usable: true,
            paused: true,
            status: "Paused",
            edgarUrl: null,
            notes: null,
          },
        ],
        events: [
          raise("2026-01-15"),
          { ...raise("2025-06-01"), kind: "reverse-split", label: "1-for-10 reverse split" },
        ],
        cash: {
          asOf: "2026-06-30",
          totalCash: 40_000_000,
          restrictedCash: 0,
          operatingCashFlow: -1_000_000,
          operatingCashFlowMonths: 12,
          workingCapital: null,
          goingConcern: false,
          goingConcernNote: null,
          sourceLabel: null,
          sourceUrl: null,
        },
      }),
    );
    assert.equal(scored.cashNeed, "Low");
    assert.equal(scored.offeringAbility, "High");
    assert.equal(scored.overheadSupply, "High");
    assert.equal(scored.historical, "High");
    assert.equal(scored.overall, "High");
  });

  it("uses a 50% overhang cutoff and a 9 month runway cutoff", () => {
    const under = levels(input({ instruments: [overhang(499_000)], events: [], cash: quietCash(9.01) }));
    const over = levels(input({ instruments: [overhang(500_000)], events: [], cash: quietCash(9) }));
    assert.equal(under.overheadSupply, "Low");
    assert.equal(over.overheadSupply, "High");
    assert.equal(under.cashNeed, "Low");
    assert.equal(over.cashNeed, "High");
  });

  it("counts a paused ELOC with remaining capacity and ignores unknown ATM capacity", () => {
    const scored = levels(
      input({
        instruments: [
          {
            kind: "eloc",
            name: "ELOC",
            remainingDollars: 1_000_000,
            remainingShares: null,
            overhangShares: null,
            nearTermIssuanceShares: null,
            usable: true,
            paused: true,
            status: "Paused",
            edgarUrl: null,
            notes: null,
          },
          {
            kind: "atm",
            name: "ATM",
            remainingDollars: null,
            remainingShares: null,
            overhangShares: null,
            nearTermIssuanceShares: null,
            usable: true,
            paused: true,
            status: "Paused",
            edgarUrl: null,
            notes: null,
          },
        ],
        events: [],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.offeringAbility, "High");
  });

  it("drops capital events outside the 24 month window", () => {
    const scored = levels(
      input({
        instruments: [],
        events: [raise("2024-08-10"), raise("2024-08-09")],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.historical, "Low");

    const inside = levels(
      input({
        instruments: [],
        events: [raise("2024-08-12"), raise("2025-01-01")],
        cash: quietCash(24),
      }),
    );
    assert.equal(inside.historical, "High");
  });
});

describe("IMCC fixture", () => {
  it("elevates converts and the F-3 resale instead of reading a clean Low", () => {
    const facts = imccFixture();
    const report = assembleReport(facts, "fixture", "test");
    const scored = Object.fromEntries(report.scores.map((score) => [score.id, score.level]));
    assert.deepEqual(scored, {
      overall: "High",
      offeringAbility: "High",
      overheadSupply: "High",
      historical: "High",
      cashNeed: "High",
    });
    const ability = report.scores.find((score) => score.id === "offeringAbility");
    assert.match(ability?.numericLine ?? "", /93\.1%/);
    assert.match(ability?.numericLine ?? "", /575,898/);
    assert.match(ability?.decision ?? "", /6 open variable-price share-settled convertible/);
    assert.ok(ability?.sources.some((source) => source.url.includes("000117891326004396")));
    assert.ok(ability?.sources.some((source) => source.url.includes("000117891326003150")));
    const overhead = report.scores.find((score) => score.id === "overheadSupply");
    assert.match(overhead?.numericLine ?? "", /771,617 \/ 618,899/);
    assert.match(overhead?.numericLine ?? "", /125%/);
    const historical = report.scores.find((score) => score.id === "historical");
    assert.match(historical?.numericLine ?? "", /6 equity raises/);
    assert.match(historical?.numericLine ?? "", /1 reverse splits/);
    const cashNeed = report.scores.find((score) => score.id === "cashNeed");
    assert.match(cashNeed?.numericLine ?? "", /C\$1,617,000/);
    assert.match(cashNeed?.numericLine ?? "", /7\.2 months/);
    assert.match(cashNeed?.numericLine ?? "", /going concern yes/i);
    assert.equal(facts.cash.currency, "CAD");
    assert.equal(facts.cash.totalCash, 1_617_000);
    assert.equal(facts.cash.restrictedCash, 124_000);
    assert.equal(deriveCash(facts.cash).unrestrictedCash, 1_617_000);
    assert.ok(facts.instruments.some((item) => item.resaleRegistration && item.overhangShares === 575_898));
    assert.ok(
      facts.instruments.some(
        (item) => item.kind === "convertible" && item.issuedOn === "2026-09-02" && item.variableConversion && item.shareSettled,
      ),
    );
  });
});

describe("convertible and resale rules", () => {
  it("treats a small variable share-settled note as Offering Ability High", () => {
    const scored = levels(
      input({
        analysisAsOf: "2026-09-23",
        instruments: [
          {
            kind: "convertible",
            name: "2026-09-02 convertible note",
            remainingDollars: null,
            remainingShares: null,
            overhangShares: null,
            nearTermIssuanceShares: null,
            usable: true,
            paused: false,
            variableConversion: true,
            shareSettled: true,
            issuedOn: "2026-09-02",
            status: "Share settlement only",
            edgarUrl: "https://www.sec.gov/Archives/edgar/data/1792030/000117891326004396/zk2636065.htm",
            notes: "Principal US$225,000.",
          },
        ],
        events: [raise("2026-09-02")],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.offeringAbility, "High");
    assert.equal(scored.historical, "Low");
    assert.equal(scored.overall, "Low");
  });

  it("does not treat a cash-repayable fixed convert as an issuance path", () => {
    const scored = levels(
      input({
        instruments: [
          {
            kind: "convertible",
            name: "Fixed convert",
            remainingDollars: 225_000,
            remainingShares: null,
            overhangShares: 10_000,
            nearTermIssuanceShares: null,
            usable: true,
            paused: false,
            variableConversion: false,
            shareSettled: false,
            issuedOn: "2026-09-02",
            status: "Repayable in cash",
            edgarUrl: null,
            notes: null,
          },
        ],
        events: [],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.offeringAbility, "Low");
    assert.equal(scored.overheadSupply, "Low");
  });

  it("counts two convertible-note raises and a large resale block", () => {
    const scored = levels(
      input({
        instruments: [
          {
            kind: "shelf",
            name: "F-3 resale",
            remainingDollars: null,
            remainingShares: 600_000,
            overhangShares: 600_000,
            nearTermIssuanceShares: null,
            usable: false,
            paused: false,
            resaleRegistration: true,
            status: "Resale",
            edgarUrl: null,
            notes: null,
          },
        ],
        events: [
          { ...raise("2026-04-07"), label: "Convertible note" },
          { ...raise("2026-05-07"), label: "Convertible note" },
        ],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.historical, "High");
    assert.equal(scored.offeringAbility, "High");
    assert.equal(scored.overheadSupply, "High");
  });

  it("keeps a small resale block below the 50% line", () => {
    const scored = levels(
      input({
        instruments: [
          {
            kind: "shelf",
            name: "F-3 resale",
            remainingDollars: null,
            remainingShares: 100_000,
            overhangShares: 100_000,
            nearTermIssuanceShares: null,
            usable: false,
            paused: false,
            resaleRegistration: true,
            status: "Resale",
            edgarUrl: null,
            notes: null,
          },
        ],
        events: [],
        cash: quietCash(24),
      }),
    );
    assert.equal(scored.offeringAbility, "Low");
    assert.equal(scored.overheadSupply, "Low");
  });
});

describe("filing text parsers", () => {
  it("detects going-concern language and ignores a denial", () => {
    assert.equal(
      detectGoingConcern(
        "These factors raise substantial doubt about the Company's ability to continue as a going concern.",
      ),
      true,
    );
    assert.equal(
      detectGoingConcern(
        "Management concluded there is no substantial doubt about the ability to continue as a going concern.",
      ),
      false,
    );
    assert.equal(
      detectGoingConcern("The statements are prepared on a going concern basis."),
      false,
    );
  });

  it("parses a long date", () => {
    assert.equal(isoFromLongDate("August 15, 2025"), "2025-08-15");
  });

  it("flags significant doubt for a foreign issuer and ignores a denial", () => {
    assert.equal(
      detectGoingConcern(
        "These conditions raise uncertainties that cast significant doubt as to whether the Company will be able to continue as a going concern.",
      ),
      true,
    );
    assert.equal(
      detectGoingConcern("Management concluded there is no significant doubt about continuing as a going concern."),
      false,
    );
  });

  it("reads a share-settled variable note, a resale count, and a 30:1 consolidation", () => {
    const note = extractConvertibleNote(
      "On September 2, 2026 the Company issued a convertible note in the principal amount of US$225,000 and a warrant to purchase up to 77,855 Common Shares at an exercise price of CAD$4.63. The Offering closed on September 2, 2026. The Note is not repayable in cash and will be satisfied solely through the issuance of Common Shares. The Conversion Price is the lower of the Fixed Price or ninety percent (90%) of the lowest daily volume-weighted average price. The Fixed Price set in the Note is US$3.328. The Floor Price set in the Note is US$0.665692.",
    );
    assert.equal(note?.principalUsd, 225_000);
    assert.equal(note?.warrantShares, 77_855);
    assert.equal(note?.date, "2026-09-02");
    assert.equal(note?.variableConversion, true);
    assert.equal(note?.shareSettled, true);
    assert.equal(note?.floorPrice, "0.665692");
    assert.equal(
      extractResaleShareCount(
        "This prospectus relates to the resale by the selling shareholder of up to 17,276,931 common shares.",
      ),
      17_276_931,
    );
    assert.equal(extractResaleShareCount("We may sell up to 17,276,931 common shares from time to time."), null);
    const split = extractConsolidation(
      "Shares commenced trading on a 30:1 post-consolidated basis. The Common Shares were reduced from 18,567,650 to 618,899 Common Shares.",
    );
    assert.equal(split?.ratio, 30);
    assert.equal(split?.toShares, 618_899);
    assert.equal(split?.completed, true);
  });

  it("does not treat a biography mention of ATM as a program", () => {
    assert.equal(mentionsAtmProgram("product development for cryptocurrency ATM technologies"), false);
    assert.equal(mentionsAtmProgram("at-the-market offering agreement with a sales agent"), true);
  });

  it("reads IFRS inline XBRL cash without rescaling", () => {
    const facts = extractInlineCash(`
      <context id="C_20260630"><period><instant>2026-06-30</instant></period></context>
      <context id="C_20260101to20260630"><period><startDate>2026-01-01</startDate><endDate>2026-06-30</endDate></period></context>
      <context id="C_proforma"><period><instant>2026-06-30</instant></period><segment>pro forma</segment></context>
      <ifrs-full:CashAndCashEquivalents contextRef="C_20260630" unitRef="CAD">1617000</ifrs-full:CashAndCashEquivalents>
      <ifrs-full:CashAndCashEquivalents contextRef="C_proforma" unitRef="CAD">999</ifrs-full:CashAndCashEquivalents>
      <ifrs-full:CurrentRestrictedCashAndCashEquivalents contextRef="C_20260630" unitRef="CAD">124000</ifrs-full:CurrentRestrictedCashAndCashEquivalents>
      <ifrs-full:CashFlowsFromUsedInOperatingActivities contextRef="C_20260101to20260630" unitRef="CAD">-1339000</ifrs-full:CashFlowsFromUsedInOperatingActivities>
    `);
    assert.equal(facts?.totalCash, 1_617_000);
    assert.equal(facts?.restrictedCash, 124_000);
    assert.equal(facts?.operatingCashFlow, -1_339_000);
    assert.equal(facts?.currency, "CAD");
    assert.equal(facts?.restrictedSeparate, true);
  });

  it("adjusts a pre-consolidation resale count and keeps a later warrant whole", () => {
    const interpreted = interpretFilings({
      analysisAsOf: "2026-09-23",
      reports: [
        {
          filed: "2026-08-27",
          url: "https://www.sec.gov/example-split",
          text: "30:1 consolidation. The Common Shares were reduced from 18,567,650 to 618,899 Common Shares.",
        },
        {
          filed: "2026-09-02",
          url: "https://www.sec.gov/example-note",
          text: "On September 2, 2026 the Company issued a convertible note in the principal amount of US$225,000 and a warrant to purchase up to 77,855 Common Shares. The Offering closed on September 2, 2026. The Note is not repayable in cash. The price uses the lowest daily volume-weighted average price.",
        },
      ],
      resale: {
        filed: "2026-06-09",
        url: "https://www.sec.gov/example-f3",
        text: "This prospectus relates to the resale by the selling shareholder of up to 17,276,931 common shares.",
      },
      shareCandidates: [],
    });
    assert.equal(interpreted.sharesOutstanding, 618_899);
    const resale = interpreted.instruments.find((item) => item.resaleRegistration);
    assert.equal(resale?.overhangShares, 575_898);
    const warrant = interpreted.instruments.find((item) => item.kind === "warrant");
    assert.equal(warrant?.overhangShares, 77_855);
    assert.equal(interpreted.events.filter((event) => event.kind === "equity-raise").length, 1);
  });

  it("reads shelf unsold dollars and the ATM agent from registration prose", () => {
    assert.equal(
      extractShelfUnsoldDollars(
        "securities with a maximum aggregate price of $46,236,111 registered are unsold securities",
      ),
      46_236_111,
    );
    assert.equal(
      extractAtmProgramDollars(
        "we may offer and sell shares having an aggregate offering price of up to $2,600,000",
      ),
      2_600_000,
    );
    assert.match(
      extractAtmAgent("At the Market Offering Agreement with Ladenburg Thalmann & Co., Inc. acting as sales agent") ??
        "",
      /Ladenburg Thalmann/,
    );
  });
});

function overhang(shares: number): Instrument {
  return {
    kind: "warrant",
    name: "Warrants",
    remainingDollars: null,
    remainingShares: shares,
    overhangShares: shares,
    nearTermIssuanceShares: null,
    usable: false,
    paused: false,
    status: "Outstanding",
    edgarUrl: null,
    notes: null,
  };
}

function raise(date: string): AnalysisInput["events"][number] {
  return {
    date,
    kind: "equity-raise",
    label: "PIPE",
    proceeds: 1_000_000,
    shares: 100_000,
    price: 1,
    edgarUrl: null,
    notes: null,
  };
}

function tightCash(goingConcern: boolean): AnalysisInput["cash"] {
  return {
    asOf: "2026-06-30",
    totalCash: 2_000_000,
    restrictedCash: 500_000,
    operatingCashFlow: -3_000_000,
    operatingCashFlowMonths: 6,
    workingCapital: null,
    goingConcern,
    goingConcernNote: goingConcern ? "Going concern." : null,
    sourceLabel: null,
    sourceUrl: null,
  };
}

function quietCash(runwayMonths: number): AnalysisInput["cash"] {
  const monthly = 100_000;
  return {
    asOf: "2026-06-30",
    totalCash: monthly * runwayMonths,
    restrictedCash: 0,
    operatingCashFlow: -monthly * 12,
    operatingCashFlowMonths: 12,
    workingCapital: null,
    goingConcern: false,
    goingConcernNote: null,
    sourceLabel: null,
    sourceUrl: null,
  };
}
