/**
 * A local harness that stands in for the host app: the tokens, an artwork
 * panel, and the slot payload the print shop passes. It exists so the add-on
 * can be looked at in the colours it inherits, and it is not part of the
 * shipped bundle — `vite build` only ever sees `src/index.ts`.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import { register } from "../src/index.ts";
import type { ArtworkRef } from "@adminium/add-on-host/contracts";
import { LOCALE_TAGS, type LocaleTag } from "../src/i18n/strings.ts";

const addOn = register();
const artworkFill = addOn.fills.find((f) => f.slot === "artwork.sources")!;

function Harness() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<LocaleTag>("en-US");
  const [got, setGot] = useState<ArtworkRef | null>(null);

  const apply = (nextTheme: "light" | "dark", nextLocale: LocaleTag) => {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.setAttribute("lang", nextLocale);
    document.documentElement.setAttribute("dir", nextLocale === "ar-EG" ? "rtl" : "ltr");
  };

  return (
    <div className="harness">
      <div className="harness-bar">
        <button
          type="button"
          onClick={() => {
            const next = theme === "light" ? "dark" : "light";
            setTheme(next);
            apply(next, locale);
          }}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
        <select
          value={locale}
          onChange={(e) => {
            const next = e.target.value as LocaleTag;
            setLocale(next);
            apply(theme, next);
          }}
        >
          {LOCALE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <h1>Artwork for MP-4127</h1>
      <p className="sub">500 business cards, 85 × 55mm on 350gsm silk.</p>

      <div className="panel">
        <h2>More ways to send artwork</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(238px, 1fr))", gap: 12 }}>
          {(artworkFill.render as (p: unknown) => React.ReactNode)({
            config: {
              product: "business-cards",
              size: "business-card",
              sides: 2,
              quantity: 500,
            },
            onArtwork: (ref: ArtworkRef) => setGot(ref),
          })}
        </div>
      </div>

      <h1 style={{ marginBlockStart: 32 }}>Artwork for MP-4131</h1>
      <p className="sub">
        250 A4 posters — a size no starting layout matches, so the picker opens.
      </p>

      <div className="panel">
        <h2>More ways to send artwork</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(238px, 1fr))", gap: 12 }}>
          {(artworkFill.render as (p: unknown) => React.ReactNode)({
            config: { product: "posters", size: "a4", sides: 1, quantity: 250 },
            onArtwork: (ref: ArtworkRef) => setGot(ref),
          })}
        </div>
      </div>

      {got !== null && (
        <p className="sub" style={{ marginBlockStart: 14 }}>
          The host received: <code>{JSON.stringify(got)}</code>
        </p>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
