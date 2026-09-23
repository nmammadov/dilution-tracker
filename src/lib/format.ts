export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${trimNumber(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}$${trimNumber(abs / 1_000_000)}M`;
  if (abs >= 100_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${trimNumber(abs / 1_000)}K`;
  return `${sign}$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}

export function formatUsdExact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Filing currency, with no FX conversion. CAD is shown as C$. */
export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (currency === "CAD") {
    if (value == null || !Number.isFinite(value)) return "—";
    const sign = value < 0 ? "−" : "";
    const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(value));
    return `${sign}C$${formatted}`;
  }
  return formatUsdExact(value);
}

export function formatShares(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  const pct = ratio * 100;
  if (pct >= 100) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

export function formatMonths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} mo`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function trimNumber(value: number): string {
  const fixed = value >= 10 ? value.toFixed(1) : value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function daysBetween(earlierIso: string, laterIso: string): number | null {
  const earlier = Date.parse(`${earlierIso.slice(0, 10)}T00:00:00Z`);
  const later = Date.parse(`${laterIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(earlier) || Number.isNaN(later)) return null;
  return Math.round((later - earlier) / 86_400_000);
}

export function normalizeSymbol(raw: string): string | null {
  let symbol = raw.trim();
  try {
    symbol = decodeURIComponent(symbol);
  } catch {
    return null;
  }
  symbol = symbol.toUpperCase().replace(/^\$/, "").replace(/\s+/g, "");
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return null;
  return symbol;
}

export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "shelf":
      return "Shelf";
    case "atm":
      return "ATM";
    case "eloc":
      return "ELOC";
    case "warrant":
      return "Warrants";
    case "convertible":
      return "Convertibles";
    case "pipe":
      return "PIPE";
    case "preferred":
      return "Preferred";
    default:
      return kind;
  }
}
