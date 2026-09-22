# Splitline

Splitline is a dilution desk for small and micro-cap traders. Enter a US ticker and it marks five signals **High** or **Low**: overall risk, offering ability, overhead supply, historical raises, and cash need. The screen is built from SEC EDGAR filings (cash, shelves, ATMs, equity lines, warrants, convertibles, PIPEs, preferred, and completed offerings), plus a thin quote request for price and float when that feed answers.

This is an original app. It is not affiliated with DilutionTracker and it does not use that site’s branding, CSS, logos, or proprietary datasets.

There is no Yahoo Finance tab, no Finviz tab, and no general fundamentals tab. A quote is used only to fill price, market cap, and float on the dilution profile.

## Run

```bash
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search `DCOY`.

Other commands:

```bash
npm test
npm run build
```

The ticker API is `GET /api/ticker/[symbol]`, for example `/api/ticker/DCOY`.

## What a ticker page shows

- Company identity, shares outstanding, float when a quote provides it, and market cap when price and shares are both known
- Five High/Low cards. Each card includes a short “why”
- Instruments: shelf, ATM, ELOC, warrants, convertibles, PIPE, and preferred, with remaining capacity, status, and EDGAR links
- Completed offerings, plus reverse splits that feed the historical score
- Cash snapshot: cash, restricted cash, burn, runway, and a going-concern flag
- A short offering-likelihood summary

## Scores

Every cutoff lives in `src/lib/thresholds.ts`. The ticker page repeats the same rules. Missing evidence stays **Low**. Unknown ATM or shelf capacity does not raise Offering Ability.

The lookback is **731 days** (about 24 months) ending on the analysis date. For a curated fixture that date is the filing date the notes were taken from. For a live lookup it is the filing date of the latest 10-Q or 10-K.

### Offering Ability — High

Any one of these is enough:

- An ATM or ELOC is still in place and at least **$1 million** remains. A contractual pause still counts. The “why” says the facility is paused.
- An effective shelf has at least **$5 million** remaining. A registration that is merely “on file,” with no parsed dollar capacity, does not count.
- Near-term exercisable or convertible shares (not milestone-gated) are at least **50%** of shares outstanding.
- Authorized-but-unissued shares are at least **10×** shares outstanding **and** the company raised equity inside the lookback window.

### Overhead Supply — High

Warrants + convertible shares + resale-registered shares are at least **50%** of shares outstanding. Count a resale block once if those shares are already in the warrant total. The severe zone above 100% still uses the same High flag; the “why” shows the percentage.

### Historical — High

Inside the lookback window, any one of these:

- At least two equity raises (PIPE, registered deal, ATM draw, or ELOC draw)
- At least two reverse splits
- One reverse split and one equity raise
- At least two ATM or ELOC draws

### Cash Need — High

Any one of these:

- The filing discloses substantial doubt about continuing as a going concern
- Unrestricted cash covers **9 months or less** of trailing operating burn

Runway uses cash minus restricted cash when both figures are known, divided by the absolute value of negative operating cash flow spread over that statement’s length. Positive operating cash flow does not create a burn rate. If cash or burn is missing and there is no going-concern language, Cash Need stays Low.

### Overall Risk — High

Either:

- Cash Need is High **and** Offering Ability or Overhead Supply is High, or
- At least **3 of the 4** component scores are High

Cash Need alone is not enough. Two Highs that do not include that cash-plus-path pair are not enough, unless they are part of a 3-of-4 result.

## Data

Live lookup, in order:

1. `https://www.sec.gov/files/company_tickers.json` maps the ticker to a CIK
2. `https://data.sec.gov/submissions/CIK##########.json` supplies the filing index
3. `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` supplies cash, operating cash flow, and shares when tagged
4. The latest 10-Q or 10-K HTML is scanned for going-concern language, a warrant count, authorized shares, reverse splits, and an equity-line remainder when the prose states one

Requests send a descriptive `User-Agent`. If EDGAR cannot be reached, a ticker with a local fixture still renders. Other tickers return a clear error instead of an empty scorecard.

Quote data is optional and only fills price, shares (if EDGAR had none), float, and market cap. Share counts from the filing are not overwritten by the quote.

Live mode is best-effort. A shelf form on the filing list, without a parsed dollar amount, is shown and does not flip Offering Ability to High.

## DCOY fixture

`src/lib/fixtures.ts` curates **Decoy Therapeutics Inc.** (CIK 0001615219) from public filings, principally the Form 10-Q for the quarter ended June 30, 2026 (filed August 12, 2026) and the June 2026 equity-line resale prospectus. Scores are computed by the same function as live lookups. They are not hardcoded.

Facts the fixture uses:

- Cash, cash equivalents, and restricted cash **$8,289,108** at June 30, 2026, of which about **$2.7 million** is restricted under the Gates Foundation grant
- Operating cash used in the first half of 2026 **$5,541,348** (about six months of burn)
- Going-concern language; management pointed to funding into late 2026
- ELOC with about **$5.0 million** remaining, paused about 180 days by the June 26, 2026 PIPE
- About **4,699,381** warrants outstanding, **401,126** common shares reserved for convertible preferred, and **808,000** resale-registered ELOC shares
- Cover-page shares outstanding **655,185** as of August 11, 2026 (the June 30 balance sheet still showed 531,968; the fixture uses the later cover figure and says so)
- Reverse splits effective August 15, 2025 (1-for-15) and March 6, 2026 (1-for-12)
- June 29, 2026 PIPE of about **$3.5 million**, plus earlier ATM and ELOC draws
- September 14, 2026 special meeting: stockholders approved issuance on exercise of the milestone warrants, and approved cutting authorized common shares to 90 million. The clinical milestones still gate exercise. Authorized shares in the model stay at 100 million until a filed certificate says otherwise. Headroom is High either way.

On these inputs every score is **High**, and the likelihood summary says offering likelihood is elevated. Milestone warrants are overhang only. They are not treated as immediately exercisable.

When EDGAR answers, DCOY still uses this curated model for instruments and cash, and refreshes the filing index. The page label is “Fixture + EDGAR”. When EDGAR is down, the page label is “Offline fixture” and the saved filing links remain.

## Disclaimer

Splitline is a research screen. Filings are summarized with fixed rules and, in live mode, incomplete parsers. A High score is not a prediction that a company will sell stock, and a Low score is not a statement that it cannot.
