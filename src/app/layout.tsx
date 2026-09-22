import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Splitline",
    template: "%s · Splitline",
  },
  description:
    "Dilution desk for small and micro-cap stocks. High or Low scores for offering ability, overhead supply, history, and cash need, from SEC filings.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.className} ${mono.variable} antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
          <header className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="group">
              <span className="mono text-sm tracking-[0.28em] text-paper">SPLITLINE</span>
              <span className="mt-1 block text-xs text-muted">Micro-cap dilution desk</span>
            </Link>
            <SearchForm />
          </header>
          <div className="rule h-px w-full" />
          <div className="flex-1 py-8">{children}</div>
          <footer className="rule border-t py-6 text-xs leading-5 text-muted">
            Splitline is an original research screen. It is not affiliated with DilutionTracker and
            it does not copy that product’s branding or data. Scores are heuristics from public
            filings, not investment advice and not a forecast that an offering will price.
          </footer>
        </div>
      </body>
    </html>
  );
}
