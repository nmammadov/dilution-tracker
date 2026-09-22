import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POPULAR_TICKERS, SKIPPED_POPULAR } from "./popular";

describe("popular tickers", () => {
  it("keeps a working seeded set that includes DCOY and GME", () => {
    const symbols = POPULAR_TICKERS.map((ticker) => ticker.symbol);
    assert.ok(symbols.includes("DCOY"));
    assert.ok(symbols.includes("GME"));
    assert.ok(symbols.includes("BINI"));
    assert.equal(symbols.includes("MULN"), false);
    assert.equal(symbols.includes("MAXN"), false);
    assert.ok(symbols.length >= 20 && symbols.length <= 30);
    assert.equal(new Set(symbols).size, symbols.length);
    assert.ok(SKIPPED_POPULAR.some((ticker) => ticker.symbol === "MULN" && /BINI/.test(ticker.reason)));
    assert.ok(SKIPPED_POPULAR.some((ticker) => ticker.symbol === "MAXN"));
  });
});
