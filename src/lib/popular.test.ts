import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POPULAR_TICKERS, SKIPPED_POPULAR } from "./popular";

const SEEDED = [
  "DCOY", "GRML", "LHSW", "QNME", "JAGX", "TOPS", "IMCC", "FBGL", "ZEO", "FLNA",
  "CWD", "IPDN", "GDC", "NCT", "RAIN", "GLND", "STI", "BFRG", "WHLR", "VKTX",
  "PFSA", "SVRE", "GELS", "MASK", "EDBL", "VEEE", "TPST", "JTAI", "SQFT", "YMT",
];

describe("popular tickers", () => {
  it("uses the 2026-09-22 DilutionTracker-style seed", () => {
    const symbols = POPULAR_TICKERS.map((ticker) => ticker.symbol);
    assert.deepEqual(symbols, SEEDED);
    assert.equal(new Set(symbols).size, 30);
    assert.ok(POPULAR_TICKERS.every((ticker) => ticker.label.length > 0 && ticker.name.length > 0));
    const qnme = POPULAR_TICKERS.find((ticker) => ticker.symbol === "QNME");
    assert.equal(qnme?.name, "Quanome Technologies, Inc.");
    assert.match(qnme?.note ?? "", /Lakeside/);
    assert.equal(SKIPPED_POPULAR.length, 0);
  });
});
