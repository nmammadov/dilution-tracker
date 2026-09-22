import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { POPULAR_TICKERS, SKIPPED_POPULAR } from "@/lib/popular";
import { METHODOLOGY } from "@/lib/thresholds";

export default function HomePage() {
  return (
    <main>
      <p className="mono text-xs tracking-[0.22em] text-copper">OFFERING RISK · SEC FILINGS</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-paper sm:text-5xl">
        See whether a micro-cap can raise, and whether the share overhang is already heavy.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Enter a US ticker. Splitline reads EDGAR for cash, shelves, ATMs, equity lines, warrants,
        and recent raises, then marks five signals High or Low. The worked example is Decoy
        Therapeutics, loaded from a local fixture when the SEC feed is down.
      </p>

      <div className="mt-8 max-w-xl">
        <SearchForm variant="hero" initial="DCOY" />
      </div>

      <section className="mt-10" aria-label="Popular tickers">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg text-paper">Popular</h2>
          <p className="text-xs text-muted">{POPULAR_TICKERS.length} names that still resolve on EDGAR</p>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Seeded from DilutionTracker-style popular names. This list is not scraped from that site at
          runtime, and Splitline is not affiliated with it. Each chip opens the same High/Low scores
          and evidence panels. Figures come from EDGAR, or from the curated DCOY fixture when that
          feed is down.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR_TICKERS.map((ticker) => (
            <li key={ticker.symbol}>
              <Link
                href={`/ticker/${ticker.symbol}`}
                title={ticker.note ? `${ticker.name}. ${ticker.note}` : ticker.name}
                className="mono inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-paper hover:border-copper"
              >
                {ticker.symbol}
                {ticker.note ? <span className="text-[10px] tracking-normal text-muted">{ticker.note}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        <details className="mt-4 text-sm text-muted">
          <summary className="cursor-pointer text-copper">Names from the seed list that are not current SEC tickers</summary>
          <ul className="mt-3 space-y-2">
            {SKIPPED_POPULAR.map((ticker) => (
              <li key={ticker.symbol}>
                <span className="mono text-paper">{ticker.symbol}</span>
                {" — "}
                {ticker.reason}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-line bg-panel p-5">
          <h2 className="mono text-xs tracking-[0.18em] text-muted">FIVE SCORES</h2>
          <ol className="mt-4 space-y-4">
            {METHODOLOGY.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-paper">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
          <Link href="/methodology" className="mt-5 inline-block text-sm text-copper underline-offset-2 hover:underline">
            Full score map
          </Link>
        </section>

        <aside className="flex flex-col justify-between rounded-xl border border-copper/40 bg-panel-2 p-5">
          <div>
            <p className="mono text-xs tracking-[0.18em] text-copper">WORKED EXAMPLE</p>
            <h2 className="mt-3 text-2xl text-paper">DCOY</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Decoy Therapeutics, from the June 30, 2026 Form 10-Q and the June 2026 equity-line
              resale prospectus. Cash is about $8.3 million with roughly $2.7 million
              Gates-restricted, going-concern language is present, the equity line still has about
              $5 million and is paused after the June PIPE, and warrant overhang dwarfs the share
              count. The screen should read High across the board.
            </p>
          </div>
          <Link
            href="/ticker/DCOY"
            className="mono mt-6 inline-flex w-fit items-center rounded-md bg-paper px-4 py-2 text-sm text-ink"
          >
            Open DCOY
          </Link>
        </aside>
      </div>
    </main>
  );
}
