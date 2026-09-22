"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchForm({
  initial = "",
  variant = "compact",
}: {
  initial?: string;
  variant?: "compact" | "hero";
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = value.trim().toUpperCase().replace(/^\$/, "");
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      setError("Use a US ticker such as DCOY.");
      return;
    }
    setError("");
    router.push(`/ticker/${encodeURIComponent(symbol)}`);
  }

  const hero = variant === "hero";

  return (
    <form onSubmit={onSubmit} className={hero ? "w-full" : "w-full max-w-sm"}>
      <label className="sr-only" htmlFor={hero ? "ticker-hero" : "ticker-nav"}>
        Ticker
      </label>
      <div className={`flex ${hero ? "gap-3" : "gap-2"}`}>
        <input
          id={hero ? "ticker-hero" : "ticker-nav"}
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          placeholder="Ticker"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={10}
          className={`mono w-full rounded-md border border-line bg-ink text-paper outline-none placeholder:text-muted/70 focus:border-copper ${
            hero ? "px-4 py-3 text-lg tracking-[0.18em]" : "px-3 py-2 text-sm tracking-[0.14em]"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-copper font-medium text-ink hover:brightness-110 ${
            hero ? "px-5 py-3 text-sm tracking-wide" : "px-3 py-2 text-xs tracking-wide"
          }`}
        >
          Look up
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-copper">{error}</p> : null}
    </form>
  );
}
