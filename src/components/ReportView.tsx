import Link from "next/link";
import { formatDate, formatMoney, formatMonths, formatPrice, formatShares, formatUsd, kindLabel } from "@/lib/format";
import type { ScoreCard, TickerReport } from "@/lib/types";

export function ReportView({ report }: { report: TickerReport }) {
  const { profile, cash } = report;
  const edgarBrowse = profile.cik
    ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${profile.cik}&type=&dateb=&owner=include&count=40`
    : null;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs tracking-[0.2em] text-muted">{profile.exchange ?? "US listing"}</p>
          <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">
            <span className="mono">{profile.symbol}</span>
            <span className="ml-3 text-2xl font-normal text-muted sm:text-3xl">{profile.name}</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {profile.sicDescription ? `${profile.sicDescription}` : "Filer"}
            {profile.sic ? ` · SIC ${profile.sic}` : ""}
            {profile.cik ? ` · CIK ${profile.cik}` : ""}
            {" · "}
            Analysis date {formatDate(report.analysisAsOf)}
          </p>
        </div>
        <SourcePill source={report.source} />
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">{report.sourceNote}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Price" value={formatPrice(profile.price)} />
        <Stat label="Market cap" value={formatUsd(profile.marketCap)} />
        <Stat label="Shares out" value={formatShares(profile.sharesOutstanding)} detail={formatDate(profile.sharesOutstandingAsOf)} />
        <Stat label="Float" value={formatShares(profile.floatShares)} />
        <Stat label="Authorized" value={formatShares(profile.authorizedShares)} />
        <Stat
          label="EDGAR"
          value={edgarBrowse ? "Company page" : "—"}
          href={edgarBrowse}
        />
      </dl>

      <section className="mt-8" aria-label="Dilution scores">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg">Scores</h2>
          <Link href="/methodology" className="text-sm text-copper underline-offset-2 hover:underline">
            Methodology
          </Link>
        </div>
        <div className="space-y-3">
          {report.scores.map((score) => (
            <ScorePanel key={score.id} score={score} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-panel p-5">
        <h2 className="mono text-xs tracking-[0.18em] text-muted">OFFERING LIKELIHOOD</h2>
        <p className="mt-3 max-w-4xl text-base leading-7 text-paper">{report.likelihood}</p>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg">Cash snapshot</h2>
            <span className="text-xs text-muted">{formatDate(cash.asOf)}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <CashRow label="Cash, equivalents, restricted" value={formatMoney(cash.totalCash, cash.currency)} />
            <CashRow label="Restricted" value={formatMoney(cash.restrictedCash, cash.currency)} />
            <CashRow label="Unrestricted" value={formatMoney(cash.unrestrictedCash, cash.currency)} />
            <CashRow label="Working capital" value={formatMoney(cash.workingCapital, cash.currency)} />
            <CashRow
              label="Operating cash flow"
              value={
                cash.operatingCashFlow == null
                  ? "—"
                  : `${formatMoney(cash.operatingCashFlow, cash.currency)}${cash.operatingCashFlowMonths ? ` / ${cash.operatingCashFlowMonths} mo` : ""}`
              }
            />
            <CashRow label="Implied monthly burn" value={formatMoney(cash.monthlyBurn, cash.currency)} />
            <CashRow label="Runway" value={formatMonths(cash.runwayMonths)} />
            <CashRow label="Going concern" value={cash.goingConcern ? "Flagged" : "Not flagged"} />
          </dl>
          {cash.currency === "CAD" ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              Cash amounts are Canadian dollars as reported. They are not converted to US dollars.
            </p>
          ) : null}
          {cash.goingConcernNote ? (
            <p className="mt-4 text-sm leading-6 text-muted">{cash.goingConcernNote}</p>
          ) : null}
          {cash.sourceUrl ? (
            <p className="mt-3 text-sm">
              <a className="text-copper underline-offset-2 hover:underline" href={cash.sourceUrl}>
                {cash.sourceLabel ?? "Source filing"}
              </a>
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">{cash.sourceLabel ?? "No cash source linked."}</p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-lg">How this score is calculated</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Each score opens to the raw inputs, the threshold that chose High or Low, and the EDGAR
            filings those inputs came from. The same map, without a ticker’s numbers, is on the
            methodology page.
          </p>
          <Link href="/methodology" className="mt-4 inline-block text-sm text-copper underline-offset-2 hover:underline">
            Open the methodology
          </Link>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="text-lg">Instruments</h2>
        <p className="mt-1 text-sm text-muted">
          Shelf, ATM, ELOC, warrants, convertibles, PIPE, and preferred. Remaining capacity is blank
          when the filing does not state a number.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Dilution instruments</caption>
            <thead className="bg-panel-2 text-xs tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Instrument</th>
                <th className="px-3 py-3 font-medium">Remaining</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Filing</th>
              </tr>
            </thead>
            <tbody>
              {report.instruments.map((item) => (
                <tr key={`${item.kind}-${item.name}`} className="border-t border-line align-top">
                  <td className="mono px-3 py-3 text-xs text-copper">{kindLabel(item.kind)}</td>
                  <td className="px-3 py-3">
                    <p className="text-paper">{item.name}</p>
                    {item.notes ? <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{item.notes}</p> : null}
                  </td>
                  <td className="mono px-3 py-3 whitespace-nowrap text-paper">
                    {item.remainingDollars != null ? `${formatUsd(item.remainingDollars)} left` : "Remaining not stated"}
                    {item.registeredDollars != null ? (
                      <span className="mt-1 block text-xs text-muted">Registered {formatUsd(item.registeredDollars)}</span>
                    ) : null}
                    {item.remainingShares != null ? (
                      <span className="mt-1 block text-xs text-muted">{formatShares(item.remainingShares)} sh</span>
                    ) : null}
                    {item.agent ? <span className="mt-1 block text-xs text-muted">{item.agent}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-muted">{item.status}</td>
                  <td className="px-3 py-3">
                    {item.edgarUrl ? (
                      <a className="text-copper underline-offset-2 hover:underline" href={item.edgarUrl}>
                        EDGAR
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {report.instruments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-muted">
                    No shelf, ATM, ELOC, warrant, convertible, PIPE, or preferred line was parsed.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg">Completed offerings</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Completed offerings</caption>
            <thead className="bg-panel-2 text-xs tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Deal</th>
                <th className="px-3 py-3 font-medium">Proceeds</th>
                <th className="px-3 py-3 font-medium">Shares</th>
                <th className="px-3 py-3 font-medium">Filing</th>
              </tr>
            </thead>
            <tbody>
              {report.offerings.map((event) => (
                <tr key={`${event.date}-${event.label}`} className="border-t border-line align-top">
                  <td className="mono px-3 py-3 whitespace-nowrap">{formatDate(event.date)}</td>
                  <td className="px-3 py-3">
                    <p>{event.label}</p>
                    {event.notes ? <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{event.notes}</p> : null}
                  </td>
                  <td className="mono px-3 py-3 whitespace-nowrap">{formatUsd(event.proceeds)}</td>
                  <td className="mono px-3 py-3 whitespace-nowrap">
                    {formatShares(event.shares)}
                    {event.price != null ? (
                      <span className="mt-1 block text-xs text-muted">@ {formatPrice(event.price)}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {event.edgarUrl ? (
                      <a className="text-copper underline-offset-2 hover:underline" href={event.edgarUrl}>
                        EDGAR
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {report.offerings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-muted">
                    No completed equity raises were recorded in the parsed history.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-base text-paper">Reverse splits in the file</h3>
        {report.reverseSplits.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None recorded.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {report.reverseSplits.map((event) => (
              <li key={`${event.date}-${event.label}`} className="text-muted">
                <span className="mono text-paper">{formatDate(event.date)}</span>
                {" · "}
                {event.label}
                {event.notes ? ` — ${event.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg">Filing index</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {report.filings.map((filing) => (
            <li key={`${filing.form}-${filing.filed}-${filing.url}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-3 text-sm">
              <span className="mono text-copper">{filing.form}</span>
              <span className="text-muted">{formatDate(filing.filed)}</span>
              <a className="text-paper underline-offset-2 hover:underline" href={filing.url}>
                {filing.description || "Open on EDGAR"}
              </a>
            </li>
          ))}
          {report.filings.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted">No filing links on this report.</li>
          ) : null}
        </ul>
      </section>

      {report.caveats.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm text-muted">Notes</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            {report.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        <Link href="/" className="text-copper underline-offset-2 hover:underline">
          Back to the desk
        </Link>
      </p>
    </main>
  );
}

export function LookupMessage({ message }: { message: string }) {
  return (
    <main>
      <h1 className="text-3xl font-medium">No report</h1>
      <p className="mt-3 max-w-xl text-muted">{message}</p>
      <p className="mt-6 text-sm">
        <Link href="/ticker/DCOY" className="text-copper underline-offset-2 hover:underline">
          Open the DCOY fixture
        </Link>
      </p>
    </main>
  );
}

function ScorePanel({ score }: { score: ScoreCard }) {
  const high = score.level === "High";
  return (
    <article
      data-score={score.id}
      data-level={score.level}
      className={`rounded-xl border p-4 ${high ? "border-high/50 bg-[#2a2416]" : "border-low/30 bg-[#16241c]"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm text-muted">{score.label}</h3>
          <p className="mt-2 text-sm leading-6 text-paper" data-numeric={score.id}>
            {score.numericLine}
          </p>
        </div>
        <p className={`mono text-3xl ${high ? "text-high" : "text-low"}`}>{score.level}</p>
      </div>
      <details className="mt-3 border-t border-line/80 pt-3" open={score.id === "overall"}>
        <summary className="cursor-pointer text-sm text-copper">Why {score.level}</summary>
        <div className="mt-3 space-y-4">
          <div>
            <h4 className="mono text-[10px] tracking-[0.16em] text-muted">HOW THIS SCORE IS CALCULATED</h4>
            <p className="mt-2 text-sm leading-6 text-paper">{score.formula}</p>
          </div>
          <div>
            <h4 className="mono text-[10px] tracking-[0.16em] text-muted">THRESHOLD THAT DECIDED IT</h4>
            <p className="mt-2 text-sm leading-6 text-paper">{score.decision}</p>
          </div>
          <div>
            <h4 className="mono text-[10px] tracking-[0.16em] text-muted">RAW INPUTS</h4>
            <dl className="mt-2 divide-y divide-line/70">
              {score.inputs.map((row) => (
                <div key={`${score.id}-${row.label}-${row.value}`} className="py-2">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="mt-1 text-sm text-paper">
                    {row.href ? (
                      <a className="text-copper underline-offset-2 hover:underline" href={row.href}>
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                    {row.note ? <span className="mt-1 block text-xs leading-5 text-muted">{row.note}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h4 className="mono text-[10px] tracking-[0.16em] text-muted">SOURCE FILINGS</h4>
            {score.sources.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No filing link was attached to this score.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {score.sources.map((filing) => (
                  <li key={`${score.id}-${filing.url}`}>
                    <a className="text-copper underline-offset-2 hover:underline" href={filing.url}>
                      <span className="mono">{filing.form}</span>
                      {filing.filed ? ` · ${formatDate(filing.filed)}` : ""}
                      {filing.description ? ` · ${filing.description}` : ""}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </article>
  );
}

function SourcePill({ source }: { source: TickerReport["source"] }) {
  const label = source === "live" ? "Live EDGAR" : source === "mixed" ? "Fixture + EDGAR" : "Offline fixture";
  return (
    <span className="mono rounded-full border border-line px-3 py-1 text-[11px] tracking-[0.14em] text-muted">
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-3">
      <dt className="mono text-[10px] tracking-[0.16em] text-muted">{label.toUpperCase()}</dt>
      <dd className="mt-1 text-sm text-paper">
        {href && value !== "—" ? (
          <a className="text-copper underline-offset-2 hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
        {detail && detail !== "—" ? <span className="mt-0.5 block text-xs text-muted">{detail}</span> : null}
      </dd>
    </div>
  );
}

function CashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line/70 pb-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mono mt-1 text-paper">{value}</dd>
    </div>
  );
}
