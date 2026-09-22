import type { Metadata } from "next";
import { LookupMessage, ReportView } from "@/components/ReportView";
import { getTickerReport } from "@/lib/getReport";
import { normalizeSymbol } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const normalized = normalizeSymbol(symbol) ?? symbol.toUpperCase();
  return { title: normalized };
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const result = await getTickerReport(symbol);
  if (!result.ok) return <LookupMessage message={result.message} />;
  return <ReportView report={result.report} />;
}
