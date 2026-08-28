/**
 * The vocabulary ban, driven — including the ruling that is new in this package.
 *
 * Three separate things are checked and they fail for different reasons:
 * the SCANNER (does it read a script's words rather than its code), the LIST
 * (does the ban bite where 17 §2's grep bites), and the SCOPING (does 31 D4's
 * split put the right offences on the right side).
 *
 * The last one is the reason this file is longer than the guard it drives. A
 * split that mis-attributes fails silently in the direction that matters: every
 * new string reads as pre-existing debt, nothing fails, and the gate reports
 * green on a retrofit that shipped an upsell.
 */

import { afterAll, describe, expect, it } from 'vitest';

import {
  addOnCopyOffences,
  bundleOffences,
  hostCopyDebt,
  readableText,
  BANNED_IDEAS,
  HOMOGRAPH_TOKENS,
  IDEA_IN_LANGUAGE,
  OTHER_LANGUAGES,
  SUBSTRING_BANNED,
  TIERING_WORDS,
  type LexiconScope,
} from './lexicon.ts';
import { syntheticHost } from './synthetic-host.ts';

const words = (text: string): string[] => bundleOffences(text).map((offence) => offence.word);

describe('the list bites where the release grep bites', () => {
  it('catches the two traps 24 D10 names, which no `\\b` version can', () => {
    expect(words('a short explanation of the sizes')).toContain('plan');
    expect(words('the frontier of large format')).toContain('tier');
    // …and the anchored version is shown NOT to, which is why the ban is a
    // substring run and why nobody may "repair" it into word boundaries.
    expect(/\b(plans?|tiers?)\b/i.test('a short explanation of the frontier')).toBe(false);
  });

  it('catches the words a shortened list once dropped', () => {
    expect(words('delivery is free on this one')).toContain('free');
    expect(words('the flatplan')).toContain('plan');
    expect(words('freephone support')).toContain('free');
  });

  it('catches "pro" as a word and not as a substring', () => {
    expect(words('a Pro account')).toContain('pro');
    // A shop that makes things says all three of these on nearly every screen.
    expect(words('proof, process, product')).toEqual([]);
  });

  it('allows exactly the named homographs, and nothing that merely resembles them', () => {
    expect(words('Das ist eingeplant.')).toEqual([]);
    expect(words('0,04 $ pro Stück')).toEqual([]);
    // The allowance is one EXACT token. Its neighbours are still hits.
    expect(words('we have no plans')).toContain('plan');
    expect(words('planned for Tuesday')).toContain('plan');
  });

  it('catches the tiering idea in a language with no English banned run', () => {
    // The plants that walked through a one-word-per-language table.
    expect(words('Wechseln Sie jetzt zur kostenpflichtigen Vollversion.').length).toBeGreaterThan(
      0,
    );
    expect(words('انتقل إلى النسخة المدفوعة للحصول على مزايا إضافية.').length).toBeGreaterThan(0);
    // …and the English spelling of the same plant, which no substring covers.
    expect(bundleOffences('switch to the paid version for more').length).toBeGreaterThan(0);
  });

  it('is total by type: every idea has a cell in every language', () => {
    for (const language of OTHER_LANGUAGES) {
      for (const idea of BANNED_IDEAS) {
        expect(
          Array.isArray(IDEA_IN_LANGUAGE[language][idea]),
          `${language} · ${idea}`,
        ).toBe(true);
      }
      expect((TIERING_WORDS[language] ?? []).length, language).toBeGreaterThan(0);
    }
    expect((TIERING_WORDS['en-US'] ?? []).length).toBeGreaterThan(0);
  });
});

describe('the craft-trap table that was left out, measured rather than argued', () => {
  /**
   * `maker-shop`'s copy of the word list carries a seventh export the print
   * works' does not: seven "wrong → say this instead" pairs for a shop that
   * sells pots and cake toppers. It reads like the thing a host would have to
   * add, which `config.ts` says a host may never do.
   *
   * IT IS NOT, AND THIS IS THE MEASUREMENT. Every one of those seven patterns
   * is a strict subset of `SUBSTRING_BANNED`, so it cannot match a string the
   * ban would have passed. It widened the gate by nothing; what it carried was
   * a REMEDY, and a remedy belongs in a failure message.
   */
  const CRAFT_TRAPS = [
    'plant markers',
    'a planter for the sill',
    'free postage',
    'free engraving',
    'a free-standing sign',
    'a tiered cake topper',
    'upgrade to walnut',
  ];

  it('is already caught, every entry, by the list this package ships', () => {
    for (const phrase of CRAFT_TRAPS) {
      expect(words(phrase), phrase).not.toEqual([]);
    }
  });
});

describe('the scanner reads a script’s words and not its code', () => {
  const fixture = [
    'const a="a plan for the week";',
    'let mo=3,b=6,E=b/mo;',
    'const re=/["\'`]/g;',
    '// a line comment mentioning a free upgrade',
    `${'/'}${'*'} a block comment mentioning premium pricing ${'*'}${'/'}`,
    'const t=`a ${b} tier of ${{x:"nested"}.x} thing`;',
    'const esc="he said \\"billing\\" out loud";',
  ].join('\n');

  it('keeps every literal, in order, and nothing else', () => {
    expect(readableText(fixture).split('\n')).toEqual([
      'a plan for the week',
      'a ',
      ' tier of ',
      'nested',
      ' thing',
      'he said "billing" out loud',
    ]);
  });

  it('drops what only a minifier can see, and keeps what a reader can', () => {
    const readable = words(readableText(fixture));
    expect(readable).toContain('plan');
    expect(readable).toContain('tier');
    expect(readable).toContain('billing');
    expect(readable).not.toContain('/mo'); //      `E=b/mo` — division
    expect(readable).not.toContain('free'); //     the line comment
    expect(readable).not.toContain('premium'); //  the block comment
    // And the raw bytes DO carry all of those, so the difference is the scanner
    // and not a weaker word list.
    const raw = words(fixture);
    expect(raw).toContain('/mo');
    expect(raw).toContain('free');
  });

  it('reads an escaped spelling back, so a packer cannot hide a word', () => {
    // esbuild writes any character as `\uXXXX` whenever its charset is ascii,
    // which is one config line away.
    expect(words(readableText('const s="\\u0066ree delivery";'))).toContain('free');
  });
});

// ── 31 D4: whose copy is this gate about ────────────────────────────────────

const bundle = (entries: Record<string, string>): LexiconScope => ({
  bundleFor: () => entries,
});

describe('the scoping ruling (31 D4)', () => {
  const host = syntheticHost({ localeTags: ['en-US'] });
  const config = host.config;
  afterAll(() => host.dispose());

  const MIXED = {
    'shop.shipping.note': 'Delivery is free over £40.',
    'shop.orders.title': 'Your orders',
    'addon.shipping-example.line': 'Upgrade to a tracked plan.',
    'addon.host.dispatch.empty': 'No delivery company is connected yet.',
  };

  it('fails on copy the retrofit contributed', () => {
    const offences = addOnCopyOffences(config, bundle(MIXED));
    // A SET of keys, not a list: "Upgrade to a tracked plan." carries two
    // banned runs and is reported twice, which is right — a reader repairing
    // that sentence has to be told about both.
    expect([...new Set(offences.map((o) => o.key))]).toEqual(['addon.shipping-example.line']);
    expect([...new Set(offences.map((o) => o.word))].sort()).toEqual(['plan', 'upgrade']);
  });

  it('reports the host’s pre-existing copy without failing on it', () => {
    const debt = hostCopyDebt(config, bundle(MIXED));
    expect(debt.map((o) => o.key)).toEqual(['shop.shipping.note']);
    expect(debt[0]?.word).toBe('free');
    // The ruling in one line: the same word, on the two sides of the split,
    // has two different consequences.
    expect(addOnCopyOffences(config, bundle(MIXED)).some((o) => o.key.startsWith('shop.'))).toBe(
      false,
    );
  });

  it('is what stops the gate being red on arrival in a real retrofit target', () => {
    /*
     * `ecommerce-storefront`'s built bundle carries seventy `free`s, measured
     * 2026-08-28, on the very screen the carrier retrofit touches. An unscoped
     * gate installed there is red before the retrofit has contributed one
     * string, on copy the add-on did not write and cannot fix — and a gate that
     * is red on arrival gets deleted rather than paid.
     */
    const storefront = Object.fromEntries(
      Array.from({ length: 70 }, (_, i) => [`shop.item.${i}.badge`, 'Free shipping']),
    );
    expect(addOnCopyOffences(config, bundle(storefront))).toEqual([]);
    expect(hostCopyDebt(config, bundle(storefront))).toHaveLength(70);
  });

  it('lets a host that files its copy elsewhere say so', () => {
    const elsewhere: LexiconScope = {
      bundleFor: () => ({ 'retrofit.slot.empty': 'No plan is connected.' }),
      contributed: (key) => key.startsWith('retrofit.'),
    };
    expect(addOnCopyOffences(config, elsewhere).map((o) => o.word)).toEqual(['plan']);
    expect(hostCopyDebt(config, elsewhere)).toEqual([]);
    // …and without saying so, the same string would have been filed as debt,
    // which is the failure mode `LexiconScope.contributed` documents.
    expect(addOnCopyOffences(config, bundle({ 'retrofit.slot.empty': 'No plan.' }))).toEqual([]);
  });

  it('does not read a placeholder name as copy', () => {
    // `{spare}` is a number, not a word, and a host that renamed its own field
    // is not shipping an upsell.
    expect(addOnCopyOffences(config, bundle({ 'addon.x.count': '{planned} left' }))).toEqual([]);
  });

  it('reports every locale, not only the first', () => {
    const many = syntheticHost({ localeTags: ['en-US', 'de-DE'] });
    try {
      const scope: LexiconScope = {
        bundleFor: (locale) => ({
          'addon.x.line': locale === 'de-DE' ? 'Jetzt auf den Profi-Tarif wechseln' : 'All good',
        }),
      };
      const offences = addOnCopyOffences(many.config, scope);
      // "Profi-Tarif" is three hits: `Tarif` is both a PLAN and a TIER in the
      // German column, and `\bprofi` is the premium one. The locale is what
      // this case is about, so the set is what it asserts.
      expect([...new Set(offences.map((o) => o.locale))]).toEqual(['de-DE']);
      expect(offences.length).toBeGreaterThan(0);
    } finally {
      many.dispose();
    }
  });

  it('leaves a clean bundle clean, on both sides', () => {
    const clean = bundle({
      'shop.orders.title': 'Your orders',
      'addon.shipping-example.line': 'Book a collection from the shop.',
    });
    expect(addOnCopyOffences(config, clean)).toEqual([]);
    expect(hostCopyDebt(config, clean)).toEqual([]);
  });

  it('names every substring it bans in the exported list', () => {
    // A guard on the list itself: something has to fail if a word is quietly
    // dropped, and nothing else in this package would.
    expect([...SUBSTRING_BANNED]).toEqual([
      'pricing',
      'plan',
      'tier',
      'billing',
      'upgrade',
      'free',
      'premium',
      '/mo',
    ]);
    expect(HOMOGRAPH_TOKENS.every((entry) => entry.means.length > 10)).toBe(true);
  });
});
