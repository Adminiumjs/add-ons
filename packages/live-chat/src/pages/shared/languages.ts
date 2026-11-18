/**
 * A LANGUAGE'S OWN NAME: "English", "Deutsch", "العربية", as the language
 * writes itself, for the language button and its list. Chinese is named by
 * its script, the one thing that tells its two versions apart.
 */
const OWN: Readonly<Record<string, string>> = { 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };

export function languageName(tag: string): string {
  const asked = OWN[tag] ?? tag.split('-')[0] ?? tag;
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(asked);
    return name === undefined || name === asked ? tag : name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    return tag;
  }
}

/** Whether a language is written right to left. */
export const isRightToLeft = (tag: string): boolean => tag.startsWith('ar');
