# Splitline

Splitline is a dilution desk for small and micro-cap traders. Enter a US ticker and it marks five signals **High** or **Low**: overall risk, offering ability, overhead supply, historical raises, and cash need. The screen is built from SEC EDGAR filings (cash, shelves, ATMs, equity lines, warrants, convertibles, PIPEs, preferred, and completed offerings), plus a thin quote request for price and float when that feed answers.

This is an original app. It is not affiliated with DilutionTracker and it does not use that site’s branding, CSS, logos, or proprietary datasets.

There is no Yahoo Finance tab, no Finviz tab, and no general fundamentals tab. A quote is used only to fill price, market cap, and float on the dilution profile.

## Run

```bash
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search `DCOY` or `IMCC`.

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

Every cutoff lives in `src/lib/thresholds.ts`. The same map is on the in-app Methodology page at `/methodology`. On a ticker, each score has an expandable **Why High** or **Why Low** panel with the plain-English formula, the numeric line, every raw input, and links to the source filings.

Missing evidence stays **Low**. A cited S-3 unsold aggregate or ATM program size does not raise Offering Ability unless the filing states a remaining balance that clears the threshold.

| Score | Inputs | Threshold | Filings |
| --- | --- | --- | --- |
| Offering Ability | S-3/F-3 remaining $, ATM remaining $ and agent, ELOC remaining commitment, near-term shares, authorized headroom, F-3/S-3 resale shares, open variable share-settled notes | ATM/ELOC remaining ≥ $1M (pause still counts), usable shelf remaining ≥ $5M, near-term ≥ 50% of shares out, headroom ≥ 10× with a raise in the lookback, resale registration ≥ 50% of shares out, or an open variable-price share-settled note in the lookback | S-3, F-3, S-1, 424B, 8-K, 6-K, 10-Q, 10-K, 20-F |
| Overhead Supply | Warrants + convertibles + F-3/S-3 resale-registered shares, divided by shares outstanding | ≥ 50%. A later stated consolidation ratio divides pre-consolidation counts first | 10-Q, 10-K, 20-F, 6-K, S-1, S-3, F-3 |
| Historical | Raise count (including convertible notes), ATM/ELOC draw count, reverse-split count in ~24 months | ≥ 2 raises, or ≥ 2 reverse splits, or one of each, or ≥ 2 draws | 8-K, 6-K, 424B, S-1, 10-Q, 10-K, 20-F |
| Cash Need | Cash, restricted cash, burn, runway months, going-concern flag, in the filing currency | Going-concern language (substantial or significant doubt), or runway ≤ 9 months | 10-Q, 10-K, 20-F, 40-F, 6-K |
| Overall Risk | The four High/Low results | Cash Need High and (Offering Ability or Overhead High), or ≥ 3 of 4 High | The component filings |

The lookback is **731 days** (about 24 months) ending on the analysis date. For a curated fixture that date is the filing date the notes were taken from. For a live lookup it is the filing date of the latest 10-Q, 10-K, 20-F, 40-F, or 6-K.

### Offering Ability — High

Any one of these is enough:

- An ATM or ELOC is still in place and at least **$1 million** remains. A contractual pause still counts. The “why” says the facility is paused.
- An effective shelf has at least **$5 million** remaining. A registration that is merely “on file,” with no parsed dollar capacity, does not count.
- Near-term exercisable or convertible shares (not milestone-gated) are at least **50%** of shares outstanding.
- Authorized-but-unissued shares are at least **10×** shares outstanding **and** the company raised equity inside the lookback window.
- An effective or pending **F-3 or S-3 resale** registration covers at least **50%** of shares outstanding. The share count is the one printed in the prospectus. If a later filing states a consolidation ratio, that count is divided by the ratio before the comparison. This is not the $5 million primary-shelf test, and a cited unsold dollar aggregate still does not count as remaining capacity.
- A convertible note issued inside the lookback is still outstanding, converts at a **variable price** (a discount to VWAP or the lowest trading price), and is **settled only in shares**. There is no dollar cutoff on this path. A US$225,000 note qualifies when the filing states those terms. A fixed-price note that can be repaid in cash does not.

### Overhead Supply — High

Warrants + convertible shares + F-3/S-3 resale-registered shares are at least **50%** of shares outstanding. Count a resale block once if those shares are already in the warrant or convertible total. Pre-consolidation counts are divided by a consolidation ratio when a later filing states one. A floor price is not turned into a share count. The severe zone above 100% still uses the same High flag; the “why” shows the percentage.

### Historical — High

Inside the lookback window, any one of these:

- At least two equity raises (PIPE, registered deal, ATM draw, ELOC draw, convertible note, or other share-settled note)
- At least two reverse splits, including a stated share consolidation
- One reverse split and one equity raise
- At least two ATM or ELOC draws

### Cash Need — High

Any one of these:

- The filing discloses substantial doubt or significant doubt about continuing as a going concern
- Unrestricted cash covers **9 months or less** of trailing operating burn

Foreign private issuers use cash and operating cash flow from the latest 20-F, 40-F, or financial 6-K. Amounts stay in the filing currency. Runway subtracts restricted cash only when the cash total already includes it. When the filing presents cash equivalents and restricted cash as separate lines, restricted cash is shown and is not subtracted. Positive operating cash flow does not create a burn rate. If cash or burn is missing and there is no going-concern language, Cash Need stays Low.

### Overall Risk — High

Either:

- Cash Need is High **and** Offering Ability or Overhead Supply is High, or
- At least **3 of the 4** component scores are High

Cash Need alone is not enough. Two Highs that do not include that cash-plus-path pair are not enough, unless they are part of a 3-of-4 result.

## Data

Live lookup, in order:

1. `https://www.sec.gov/files/company_tickers.json` maps the ticker to a CIK
2. `https://data.sec.gov/submissions/CIK##########.json` supplies the filing index
3. `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` supplies cash, operating cash flow, and shares when tagged, including `ifrs-full` facts for foreign issuers
4. The latest 10-Q, 10-K, 20-F, or 40-F HTML is scanned for going-concern language (substantial doubt or significant doubt), a warrant count, authorized shares, reverse splits, and an equity-line remainder when the prose states one
5. Recent 6-K and 8-K reports are scanned for convertible notes and share consolidations. The latest F-3 or S-3 is scanned for a selling-shareholder resale share count
6. When a newer 6-K or periodic report has inline XBRL, cash, restricted cash, operating cash flow, and shares are read from that instance

Requests send a descriptive `User-Agent`. If EDGAR cannot be reached, a ticker with a local fixture still renders. Other tickers return a clear error instead of an empty scorecard.

Quote data is optional and only fills price, shares (if EDGAR had none), float, and market cap. Share counts from the filing are not overwritten by the quote.

Live mode is best-effort. A shelf form on the filing list, without a parsed dollar amount, is shown and does not flip Offering Ability to High.

## Popular tickers

The home page **Popular** list is the 30 DilutionTracker Open Access names checked on 2026-09-22. It is a static seed in `src/lib/popular.ts`. It is not scraped at runtime, and Splitline is not affiliated with that site.

All 30 symbols were in the SEC company ticker file that day (`https://www.sec.gov/files/company_tickers.json`). `QNME` is labeled **Quanome Technologies** because EDGAR’s former-name record shows Lakeside Holding Ltd only through July 10, 2026.

Opening a chip uses the same `/ticker/[symbol]` page as search: five High/Low scores and the Why High/Low evidence panels. DCOY and IMCC use curated fixtures. Every other popular name is scored from live EDGAR: submissions, company facts (US-GAAP or IFRS), and the latest 10-Q, 10-K, 20-F, or 40-F, plus recent 6-Ks and an S-3, F-3, or 424B5 when one is on file. No dollar amount in that path is invented. If the parser cannot read a capacity, the input stays blank and does not raise a score.

SVRE and GELS have no `us-gaap` cash facts. Live mode reads `ifrs-full` cash when the company facts or a financial 6-K provide it, and Cash Need still follows going-concern language in the latest 20-F or 40-F. A zero `EntityCommonStockSharesOutstanding` fact is ignored in favor of the newest positive share count. IMCC is curated separately below because the 2026 notes and the post-consolidation share math are cited from specific filings.

To refresh the list:

1. Replace `POPULAR_TICKERS` with the names you want, then drop any symbol missing from `https://www.sec.gov/files/company_tickers.json`.
2. Do not add a fixture unless you are copying a figure from a specific filing, with the accession or EDGAR URL in `src/lib/fixtures.ts`.
3. Re-run the names through `/api/ticker/[symbol]` and update the sample table below if the High/Low mix changed.

Sample scored on 2026-09-22. DCOY uses the fixture. The other rows are the live parser. “Drove it” lists component scores that are High. Overall follows the published rule. Live mode often leaves shelf and ATM dollar capacity unparsed, so Offering Ability stays Low unless a filing states a figure the parser can read.

| Ticker | Overall | What drove it (High components) |
| --- | --- | --- |
| DCOY | High | Offering Ability, Overhead Supply, Historical, Cash Need |
| RAIN | High | Offering Ability, Historical, Cash Need |
| GRML | Low | Historical, Cash Need |
| QNME | Low | Historical, Cash Need |
| VKTX | Low | Cash Need |
| JTAI | Low | Offering Ability, Historical |
| TPST | Low | Historical, Cash Need |
| LHSW | Low | Historical, Cash Need |
| MASK | Low | Cash Need |
| STI | Low | Historical, Cash Need |

## IMCC before and after

Searched on 2026-09-23 against the scorer that only treated an ATM or ELOC remainder of at least $1 million, or a shelf remainder of at least $5 million, as Offering Ability. IM Cannabis (Nasdaq: IMCC, CIK 0001792030) had already filed a series of share-settled convertible notes and a Form F-3 resale prospectus. The live read still came back mostly Low.

| Score | Before | After |
| --- | --- | --- |
| Overall Risk | Low | High |
| Offering Ability | Low | High |
| Overhead Supply | Low | High |
| Historical | Low | High |
| Cash Need | High | High |

Before, Cash Need was High only because the March 30, 2026 Form 20-F pairs substantial doubt with going concern. Cash dollars were blank because company facts are IFRS, not US-GAAP. Shares outstanding stayed at the December 31, 2025 XBRL count of 5,894,812. The June 9, 2026 F-3 was on the filing list with no parsed capacity, so it did not raise Offering Ability. No 6-K was read, so the note financings and the August 27, 2026 30:1 consolidation were missing. Overall stayed Low because Cash Need alone is not enough.

After, the same rules score the curated IMCC fixture High on every line. The Why panels cite the filings below. Figures are the ones printed in those documents, or an exact division by the stated 30:1 ratio. No share count is estimated from a floor price.

| Input | Filing figure | How it is used |
| --- | --- | --- |
| September 2, 2026 6-K | Convertible note principal US$225,000, 10% original issue discount, 8% interest, not repayable in cash. Conversion price is the lower of US$3.328 and 90% of the 20-day lowest VWAP, with a floor of US$0.665692. Warrant for 77,855 shares at CAD$4.63. The company agreed to file an F-3 resale registration. | Open variable-price share-settled note. That path has no dollar cutoff, so the US$225,000 principal is shown and is not compared with $1 million. |
| June 9, 2026 Form F-3 | Resale of up to 17,276,931 common shares, against 9,016,539 shares outstanding as of June 8, 2026. EFFECT filed June 16, 2026. | Resale overhang. Not a primary shelf. |
| August 27, 2026 6-K | 30:1 consolidation. Common shares reduced from 18,567,650 to 618,899. Outstanding convertible securities were proportionately adjusted. | Shares outstanding. 17,276,931 / 30 = 575,898 resale shares on a post-consolidation basis (93.1% of 618,899). |
| July 1 and August 7, 2026 6-Ks | Warrants for 1,483,386 and 2,052,545 shares, issued before the consolidation and not included in the June F-3. | 1,483,386 / 30 = 49,446 and 2,052,545 / 30 = 68,418. |
| April 7, May 7, June 3, July 1, August 7, and September 2, 2026 notes | Principals US$250,000, US$300,000, US$225,000, US$225,000, US$250,000, and US$225,000. | Six equity raises inside the lookback, plus the consolidation. |
| August 13, 2026 6-K XBRL | Cash and cash equivalents CAD 1,617,000 and current restricted cash CAD 124,000 at June 30, 2026. Operating cash flow CAD (1,339,000) for the six months then ended. The statements also say the conditions cast significant doubt on continuing as a going concern. | Runway about 7.2 months. Restricted cash is a separate line, so it is not subtracted. Not converted to US dollars. |

Overhead is 575,898 + 49,446 + 68,418 + 77,855 = 771,617 shares, which is 125% of 618,899. April, May, and June warrant shares sit inside the 17,276,931 F-3 total and are not added again.

## DCOY fixture

`src/lib/fixtures.ts` curates **Decoy Therapeutics Inc.** (CIK 0001615219) from public filings, principally the Form 10-Q for the quarter ended June 30, 2026 (filed August 12, 2026) and the June 2026 equity-line resale prospectus. Scores are computed by the same function as live lookups. They are not hardcoded.

Facts the fixture uses:

- Cash, cash equivalents, and restricted cash **$8,289,108** at June 30, 2026, of which about **$2.7 million** is restricted under the Gates Foundation grant
- Operating cash used in the first half of 2026 **$5,541,348** (about six months of burn)
- Going-concern language; management pointed to funding into late 2026
- Form S-3 filed August 15, 2025 cites **$46,236,111** of unsold securities. That figure is shown on the score and is not treated as remaining shelf capacity
- ATM sales agreement with **Ladenburg Thalmann & Co., Inc.** The August 22, 2025 424B5 states a program of up to **$2.6 million**. Remaining ATM capacity is not restated in the Q2 2026 10-Q, so it does not raise Offering Ability
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
