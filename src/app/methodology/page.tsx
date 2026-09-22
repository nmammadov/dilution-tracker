import type { Metadata } from "next";
import Link from "next/link";
import { SCORE_MAP } from "@/lib/thresholds";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Splitline turns filing inputs into High or Low dilution scores.",
};

export default function MethodologyPage() {
  return (
    <main>
      <p className="mono text-xs tracking-[0.22em] text-copper">SCORES → INPUTS → THRESHOLDS</p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">How this score is calculated</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
        Every ticker page uses these same rules. A High or Low flag is the result of the comparison
        below, not a hidden model. On a ticker, open “Why High” or “Why Low” under each score to see
        the raw numbers and the EDGAR links for that company. Missing evidence stays Low. A cited
        shelf or ATM program size does not count as remaining capacity unless the filing states what
        is still unsold and usable.
      </p>

      <div className="mt-8 space-y-4">
        {SCORE_MAP.map((rule) => (
          <section key={rule.title} className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-xl text-paper">{rule.title}</h2>
            <p className="mt-3 text-sm leading-6 text-paper">{rule.formula}</p>
            <h3 className="mono mt-4 text-[10px] tracking-[0.16em] text-muted">INPUTS</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
              {rule.inputs.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
            <h3 className="mono mt-4 text-[10px] tracking-[0.16em] text-muted">THRESHOLD</h3>
            <p className="mt-2 text-sm leading-6 text-paper">{rule.threshold}</p>
            <h3 className="mono mt-4 text-[10px] tracking-[0.16em] text-muted">FILINGS</h3>
            <p className="mt-2 text-sm text-muted">{rule.filings.join(" · ")}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        The worked example is{" "}
        <Link href="/ticker/DCOY" className="text-copper underline-offset-2 hover:underline">
          DCOY
        </Link>
        . Cutoffs also live in <span className="mono">src/lib/thresholds.ts</span> and the README.
      </p>
    </main>
  );
}
