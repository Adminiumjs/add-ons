/**
 * THE RULES' ANSWER, IN THE CUSTOMER'S WORDS.
 *
 * `checkDesign` answers in Adminium's closed list of reasons and a few kinds
 * of advice, each with the part it is about. This turns each into what the
 * customer reads, twice: at the field (the message under it, with its fix)
 * and in the list of checks that takes them there ("Go to it"). A refusal
 * blocks "Add to basket"; advice never does, with one exception the print
 * look draws: words past the safe line are held there, as the print comp
 * holds them, though the server would take them.
 *
 * The words are each comp's own: the maker's look says it the Birch Row way
 * ("Your words: 2 characters too long"), the print look the Marlow Press way
 * ("2 over the limit. Shorten it.").
 */
import { charCount, charLimit, lineCount, sizeAllowed, sizeThatFits, type Advice, type DesignAnswer, type DesignValues, type PartValue, type Refusal } from '../rules/index.ts';
import { mm, type Locale, type Translate } from './i18n.ts';
import { hexOf, valueOf, type EditPart, type Palette } from './catalogue.ts';
import type { Look } from './ui/context.tsx';

export type FixAction = { label: string; value: PartValue };

export interface Check {
  part: string | null;
  block: boolean;
  /** At the field. */
  inline: string;
  /** In the list of checks, and the reason "Add to basket" gives. */
  listed: string;
  /** A smaller line under the message (the arithmetic of a blurry logo). */
  detail?: string;
  icon: 'ruler' | 'alert' | 'search' | 'scan' | 'image-off' | 'contrast' | 'lock';
  fixes: FixAction[];
  /** Which kind of check it is, for the fields that draw some of them their own way. */
  kind: Refusal['reason'] | Advice['kind'] | 'refused';
}

interface Context {
  t: Translate;
  locale: Locale;
  look: Look;
  parts: readonly EditPart[];
  values: DesignValues;
  palette: Palette | null;
  /** A 3D-printed item: its words and logo are raised from it or cut into it. */
  printed?: boolean;
}

/** "Add your name", in English: the shop's part names start with a capital, the sentence does not. */
const inSentence = (name: string, locale: Locale): string => (locale.startsWith('en') ? name.charAt(0).toLocaleLowerCase(locale) + name.slice(1) : name);

function refusalCheck(c: Context, refusal: Refusal): Check {
  const { t, look, locale } = c;
  const part = c.parts.find((one) => one.code === refusal.part) ?? null;
  const name = part?.name ?? '';
  const value = part === null ? {} : valueOf(c.values, part);
  const base = { part: part?.code ?? null, block: true, fixes: [] as FixAction[], kind: refusal.reason } as const;
  switch (refusal.reason) {
    case 'too-long': {
      const rules = part?.text;
      if (rules === null || rules === undefined) break;
      const size = value.size ?? rules.size;
      const limit = charLimit(rules, sizeAllowed(rules, size) ? size : rules.size);
      const count = charCount(value.text);
      if (lineCount(value.text) > rules.lines && count <= limit)
        return { ...base, icon: 'ruler', inline: t('editor.check.lines', '{n, plural, one {Only # line fits here.} other {Only # lines fit here.}}', { n: rules.lines }), listed: t('editor.check.linesListed', '{part} has too many lines.', { part: name }) };
      const over = count - limit;
      const shorten = { label: t('editor.fix.shorten', 'Shorten it'), value: { ...value, text: [...(value.text ?? '').trim()].slice(0, limit).join('') } };
      const smaller = rules.grows ? sizeThatFits(rules, (value.text ?? '').trim(), size) : null;
      const fixes = [shorten, ...(smaller === null ? [] : [{ label: t('editor.fix.smaller', 'Make it smaller'), value: { ...value, size: smaller } }])];
      if (look === 'print') return { ...base, icon: 'ruler', fixes, inline: t('editor.check.overPrint', '{n} over the limit. Shorten it.', { n: over }), listed: t('editor.check.overPrintListed', '{part} is {n, plural, one {# character} other {# characters}} over the limit.', { part: name, n: over }) };
      const sizeWords = rules.unit === 'pt' ? `${String(size)} pt` : mm(size, locale);
      const inline = smaller === null ? t('editor.check.over', '{n, plural, one {# character over.} other {# characters over.}} At {size} this part fits {limit}.', { n: over, size: sizeWords, limit }) : t('editor.check.overGrows', '{n, plural, one {# character over.} other {# characters over.}} At {size} this part fits {limit}. Smaller letters fit more.', { n: over, size: sizeWords, limit });
      return { ...base, icon: 'ruler', fixes, inline, listed: t('editor.check.overListed', '{part}: {n, plural, one {# character too long} other {# characters too long}}', { part: name, n: over }) };
    }
    case 'required-empty': {
      if (part?.kind === 'picture' || (part?.kind === 'text' && value.mode === 'logo')) {
        const photo = part.picture?.picture === 'photo';
        const inline = photo ? t('editor.check.needPhoto', 'Add a photo — this design needs one.') : t('editor.check.needLogo', 'Add a logo — this design needs one.');
        return { ...base, icon: 'alert', inline, listed: look === 'print' ? (photo ? t('editor.check.needPhotoShort', 'Add a photo.') : t('editor.check.needLogoShort', 'Add a logo.')) : t('editor.check.needed', '{part} is needed — it can’t be left empty', { part: name }) };
      }
      if (look === 'print') return { ...base, icon: 'alert', inline: t('editor.check.needWords', 'Add your {part} — this design needs it.', { part: inSentence(name, locale) }), listed: t('editor.check.needWordsShort', 'Add your {part}.', { part: inSentence(name, locale) }) };
      return { ...base, icon: 'alert', inline: t('editor.check.neededField', 'Add your words — this part is needed'), listed: t('editor.check.needed', '{part} is needed — it can’t be left empty', { part: name }) };
    }
    case 'size-out-of-range': {
      const floor = part?.text === null || part?.text === undefined ? null : part.text.min;
      const text = floor === null ? t('editor.check.size', 'That size isn’t one this part takes.') : t('editor.check.sizeFloor', 'Letters under {size} won’t print cleanly', { size: mm(floor, locale) });
      return { ...base, icon: 'ruler', inline: text, listed: part === null ? text : `${name}: ${text}` };
    }
    case 'font-not-allowed':
    case 'colour-not-allowed':
    case 'choice-not-allowed':
    case 'part-locked': {
      const text = t('editor.check.notOffered', 'This choice isn’t one the shop offers here. Pick another.');
      return { ...base, icon: 'alert', inline: text, listed: part === null ? text : `${name}: ${text}` };
    }
    case 'file-missing':
      return { ...base, icon: 'alert', inline: t('editor.check.fileMissing', 'The file for this part didn’t arrive. Upload it again.'), listed: t('editor.check.fileMissingListed', '{part}: upload the file again', { part: name }) };
    case 'file-kind':
      // A 3D-printed item stands its logo up from its face: only a drawing has edges to raise.
      if (c.printed === true) return { ...base, icon: 'alert', inline: t('editor.check.fileKindPrinted', 'A raised logo has to be a drawing: send it as an SVG. A picture has no edges to raise.'), listed: t('editor.check.fileKindPrintedListed', '{part}: send your logo as an SVG drawing', { part: name }) };
      return { ...base, icon: 'alert', inline: t('editor.check.fileKind', 'That kind of file can’t be used here.'), listed: t('editor.check.fileKindListed', '{part}: that kind of file can’t be used here', { part: name }) };
    default:
      break;
  }
  const text = t('editor.check.unknown', 'This design can’t be made as it is. Start again from the shop’s designs.');
  return { ...base, icon: 'alert', inline: text, listed: text };
}

function adviceCheck(c: Context, advice: Advice): Check {
  const { t, locale, look } = c;
  const part = c.parts.find((one) => one.code === advice.part) ?? null;
  const name = part?.name ?? '';
  const value = part === null ? {} : valueOf(c.values, part);
  const base = { part: part?.code ?? null, block: false, fixes: [] as FixAction[], kind: advice.kind } as const;
  switch (advice.kind) {
    case 'logo-small': {
      const text = t('editor.check.logoSmall', 'Your logo will be {size} across — too small to read', { size: mm(advice.acrossMm, locale) });
      return { ...base, icon: 'search', inline: text, listed: text };
    }
    case 'blurry': {
      const photo = part?.picture?.picture === 'photo';
      const text = photo ? t('editor.check.blurryPhoto', 'Your photo may print blurry at this size — a bigger file will be sharper') : t('editor.check.blurry', 'Your logo may print blurry at this size — a bigger file or an SVG will be sharper');
      const detail = t('editor.check.blurryDetail', '{px} px is {dpi} dpi at {w} × {h} mm — we need {needs}.', { px: `${String(advice.px[0])} × ${String(advice.px[1])}`, dpi: advice.dpi, w: advice.boxMm[0], h: advice.boxMm[1], needs: advice.needs });
      return { ...base, icon: 'image-off', inline: text, listed: text, detail };
    }
    case 'fine-detail': {
      const text = t('editor.check.fine', 'Some lines in your logo are too fine to engrave — they may disappear');
      return { ...base, icon: 'scan', inline: text, listed: text };
    }
    case 'hard-to-read': {
      const better = advice.better;
      const colour = better === null ? null : (c.palette?.colours.find((one) => one.role === better || one.code === better) ?? null);
      const fixes = colour === null || hexOf(c.palette, better) === null ? [] : [{ label: t('editor.fix.use', 'Use {colour}', { colour: inSentence(colour.name, locale) }), value: { ...value, colour: better! } }];
      const text = t('editor.check.hard', 'Hard to read — the words are too close to the colour behind them.');
      return { ...base, icon: 'contrast', fixes, inline: text, listed: `${name}: ${text}` };
    }
    case 'past-safe-line': {
      const fixes = advice.smaller === null ? [] : [{ label: t('editor.fix.smaller', 'Make it smaller'), value: { ...value, size: advice.smaller } }];
      const inline = advice.smaller === null ? t('editor.check.safeShorten', 'This runs past the safe line. Shorten it.') : t('editor.check.safe', 'This runs past the safe line.');
      return { ...base, block: look === 'print', icon: 'ruler', fixes, inline, listed: t('editor.check.safeListed', '{part} runs past the safe line.', { part: name }) };
    }
  }
}

/** Every check of a design, refusals first, in the order of its parts. */
export function checksOf(answer: DesignAnswer, c: Context, refusedNow: Refusal | null = null): Check[] {
  const order = (check: Check): number => {
    const at = c.parts.findIndex((one) => one.code === check.part);
    return at < 0 ? c.parts.length : at;
  };
  const out = [...answer.refusals.map((one) => refusalCheck(c, one)), ...answer.advice.map((one) => adviceCheck(c, one))];
  // A refusal the shop's server gave on the order, which the browser did not see.
  if (refusedNow !== null && !answer.refusals.some((one) => one.reason === refusedNow.reason && one.part === refusedNow.part)) out.unshift({ ...refusalCheck(c, refusedNow), kind: 'refused' });
  return out.sort((a, b) => Number(b.block) - Number(a.block) || order(a) - order(b));
}
