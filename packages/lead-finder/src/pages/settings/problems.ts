/**
 * WHY PEOPLE CANNOT BE KEPT YET, from the engine's refusal of the switch.
 *
 * Adminium refuses a save that turns "Store people" on while anything the
 * tell mail needs is missing. The refusal carries what is missing by stable
 * code (`details.problems: { code, languages?, message }[]`, Adminium
 * 0.3.66, this add-on's floor), so the card lists each thing in the reader's
 * language, a link to where it is put right. A code this file does not know
 * is listed in the engine's own words; a refusal with no codes at all is
 * said as the engine wrote it.
 */
export type Problem =
  | { code: 'purpose'; language: string }
  | { code: 'keep-years' | 'mail-server' | 'public-origin' | 'mail-door' | 'privacy-notice' | 'tell-mail' | 'tables' }
  | { code: 'other'; words: string };

/** The engine's codes, as the card names them. */
const KNOWN: Readonly<Record<string, Exclude<Problem['code'], 'purpose' | 'other'>>> = {
  'keep-time': 'keep-years',
  smtp: 'mail-server',
  'public-origin': 'public-origin',
  'mail-door': 'mail-door',
  'privacy-notice': 'privacy-notice',
  'tell-outbox': 'tell-mail',
  tables: 'tables',
};

/** Whether a refusal is the People switch's (its hook). */
export function isSwitchRefusal(details: unknown): boolean {
  return typeof details === 'object' && details !== null && (details as { hook?: unknown }).hook === 'leads.people-switch';
}

/** The things missing, in the order the engine named them. */
export function problemsOf(details: unknown, message: string): Problem[] {
  const given = typeof details === 'object' && details !== null ? (details as { problems?: unknown }).problems : undefined;
  if (!Array.isArray(given) || given.length === 0) return message.trim() === '' ? [] : [{ code: 'other', words: message.trim() }];
  const out: Problem[] = [];
  for (const one of given as { code?: unknown; languages?: unknown; message?: unknown }[]) {
    const words = typeof one.message === 'string' ? one.message : '';
    if (one.code === 'purpose-missing') {
      const languages = Array.isArray(one.languages) ? one.languages.filter((tag): tag is string => typeof tag === 'string') : [];
      if (languages.length === 0 && words !== '') out.push({ code: 'other', words });
      for (const language of languages) out.push({ code: 'purpose', language });
      continue;
    }
    const known = typeof one.code === 'string' ? KNOWN[one.code] : undefined;
    if (known !== undefined) out.push({ code: known });
    else if (words !== '') out.push({ code: 'other', words });
  }
  return out;
}
