import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleReport } from "./assemble";
import { decoyFixture } from "./fixtures";
import { deriveCash } from "./metrics";
import {
  detectGoingConcern,
  extractAtmAgent,
  extractAtmProgramDollars,
  extractShelfUnsoldDollars,
  isoFromLongDate,
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
