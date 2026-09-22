export default function TickerLoading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <p className="mono text-xs tracking-[0.18em] text-muted">READING FILINGS</p>
      <div className="mt-4 h-10 w-56 animate-pulse rounded bg-panel-2" />
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-panel" />
        ))}
      </div>
    </main>
  );
}
