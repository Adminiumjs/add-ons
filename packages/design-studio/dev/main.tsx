/**
 * A local harness that stands in for the host app: the tokens, an artwork
 * panel, and the slot payload the print shop passes. It exists so the add-on
 * can be looked at in the colours it inherits, and it is not part of the
 * shipped bundle — `vite build` only ever sees `src/index.ts`.
 */
import { Fragment, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import { createRegistry, type ArtworkJob, type ArtworkResult } from "@adminium/add-on-host";
import { register } from "../src/index.ts";
import { LOCALE_TAGS, type LocaleTag } from "../src/i18n/strings.ts";
import { HARNESS_JOBS } from "./jobs.ts";

const addOn = register();

/*
 * RESOLVED THROUGH THE HOST'S OWN PATH, and that is what lets this file hold no
 * cast.
 *
 * `addOn.fills.find(f => f.slot === "artwork.sources")` hands back
 * `AnyAddOnFill` — the union over every id in the registry — so calling
 * `.render` on it needed an annotation to get past the compiler, and the one
 * that was here read `(p: unknown) => React.ReactNode`. That erased exactly the
 * check the payloads exist to make: the jobs in `jobs.ts` were still the host's
 * OLD `{ config: { product, size, sides, quantity } }` record long after the
 * slot started carrying a resolved `job` in millimetres, so
 * `jobFromPayload()` returned `undefined` and every tile threw on
 * `job.trimWidthMm` — with `npm run typecheck` green, because the cast had
 * thrown the payload's name away.
 *
 * `fillsFor` is generic in the slot id (`ResolvedFill<"artwork.sources">`), so
 * `render` here takes `ArtworkSlotPayload` and a stale payload is red in this
 * repo. It is also what a real mount site does: ask the registry for the fills
 * of one slot from the enabled add-ons, in the order it resolves them. The
 * payloads themselves live in `jobs.ts` so `src/harness.test.tsx` can render
 * them without booting this file's React root.
 */
const artworkFills = createRegistry([addOn]).fillsFor("artwork.sources", new Set([addOn.key]));

function JobPanel({
  heading,
  note,
  job,
  onArtwork,
  first,
}: {
  heading: string;
  note: string;
  job: ArtworkJob;
  onArtwork: (result: ArtworkResult) => void;
  first: boolean;
}) {
  return (
    <section style={first ? undefined : { marginBlockStart: 32 }}>
      <h1>{heading}</h1>
      <p className="sub">{note}</p>

      <div className="panel">
        <h2>More ways to send artwork</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(238px, 1fr))",
            gap: 12,
          }}
        >
          {artworkFills.map(({ addOn: key, fill }) => (
            <Fragment key={key}>{fill.render({ job, onArtwork })}</Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function Harness() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<LocaleTag>("en-US");
  const [got, setGot] = useState<ArtworkResult | null>(null);

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

      {HARNESS_JOBS.map(({ ref, note, job }, i) => (
        <JobPanel
          key={ref}
          first={i === 0}
          heading={`Artwork for ${ref}`}
          note={note}
          job={job}
          onArtwork={setGot}
        />
      ))}

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
