/**
 * HOW PERSONALIZING WORKS — the page a shopper reads before they trust a box.
 *
 * ── WHY IT SHIPS WITH THE ADD-ON RATHER THAN WITH THE SHOP ─────────────────
 *
 * Every sentence in it is about THIS FEATURE: that the box is the piece, that
 * an overrun is answered with two numbers rather than a shrug, that a picture
 * comes back before anything is cut, and that the words reach the laser as
 * outlines. A shop with no personalizer connected has none of that to explain,
 * and a shop that connects one should not have to write the explanation in
 * eight languages. So it comes with the thing it describes and leaves with it.
 *
 * ── WHY A DISCLOSURE AND NOT A PAGE ────────────────────────────────────────
 *
 * Comp L makes it a full shopper page with its own route. The add-on contract
 * has no shopper-side route to take — `nav.add-on.routes` is the maker's shell
 * — and inventing one would mean the host keeping a list of an add-on's pages.
 * It opens in place instead, directly under the surface it is about, which is
 * also where the question is actually asked. Recorded as a bracket amendment
 * against 24 §8B.
 *
 * Closed by default, because a shopper who is happy typing should not have to
 * scroll past an essay, and `<details>` rather than a hand-rolled toggle so it
 * is keyboard-operable and announced as a disclosure without any of our code.
 */

import { useNumber, useT } from '../i18n/t.ts';

const STEPS = ['s1', 's2', 's3', 's4'] as const;
const ASKED = ['1', '2', '3', '4', '5'] as const;

export function Help() {
  const t = useT();
  const number = useNumber();

  return (
    <details className="lp-help">
      <summary className="lp-help-open">{t('addon.personalizer.help.open')}</summary>

      <p className="lp-sub">{t('addon.personalizer.help.sub')}</p>

      <ol className="lp-help-steps">
        {STEPS.map((step, index) => (
          <li key={step} className="lp-help-step">
            {/* The number is drawn, not listed: a maker's shop counts steps
                out loud, and a bare <ol> marker is the browser's counter rather
                than the studio's voice. `aria-hidden` because the list element
                already carries the position for a reader — and `number()`
                because a drawn digit beside Arabic prose has to be an Arabic
                digit, which is what the host's own numerals sweep asks of every
                figure this add-on renders. */}
            <span className="lp-help-n" aria-hidden="true">
              {number(index + 1)}
            </span>
            <span className="lp-help-what">
              <span className="lp-help-title">
                {t(`addon.personalizer.help.${step}.title` as never)}
              </span>
              <span className="lp-help-body">
                {t(`addon.personalizer.help.${step}.body` as never)}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="lp-help-asked">
        <span className="lp-panel-title">{t('addon.personalizer.help.ask')}</span>
        <dl className="lp-help-qa">
          {ASKED.map((n) => (
            <div key={n} className="lp-help-pair">
              <dt>{t(`addon.personalizer.help.q${n}` as never)}</dt>
              <dd>{t(`addon.personalizer.help.a${n}` as never)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="lp-honest">{t('addon.personalizer.help.close')}</p>
    </details>
  );
}
