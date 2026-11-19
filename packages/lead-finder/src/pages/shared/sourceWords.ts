/**
 * EACH SOURCE, IN THE READER'S WORDS: its name, what it gives, its note, its
 * licence line, its icon, and the country a register searches.
 *
 * The manifest names a source by its id only (`addOn.sources[].id`); these are
 * the words every screen shows for it. A source this file does not know (a
 * later version's) is shown by its id.
 */
import type { AddOnTranslate } from './host.ts';

export interface SourceWords {
  /** Its name on a card and in "Search in": "Companies House (UK)". */
  name: string;
  /** Its name inside a sentence: "Companies House". */
  short: string;
  gives: string;
  note: string | null;
  licence: string | null;
  icon: string;
  /** The country a register searches (ISO alpha-2); null for a source that spans countries, or none. */
  country: string | null;
}

/** The order the cards are drawn in (the comp's). */
export const SOURCE_ORDER: readonly string[] = ['website', 'companies-house', 'france', 'norway', 'opencorporates', 'hunter'];

export const sourceRank = (id: string): number => {
  const at = SOURCE_ORDER.indexOf(id);
  return at === -1 ? SOURCE_ORDER.length : at;
};

export function sourceWords(t: AddOnTranslate, id: string): SourceWords {
  switch (id) {
    case 'website':
      return {
        name: t('source.website.name', 'Website reader'),
        short: t('source.website.short', 'the website'),
        gives: t('source.website.gives', 'Details from a company’s own website'),
        note: t('source.website.note', 'Reads one page of a company’s own website, only when you press Fill in, and respects its wish not to be read.'),
        licence: null,
        icon: 'globe',
        country: null,
      };
    case 'companies-house':
      return {
        name: t('source.companiesHouse.name', 'Companies House (UK)'),
        short: t('source.companiesHouse.short', 'Companies House'),
        gives: t('source.companiesHouse.gives', 'Companies by activity and town, and registered details'),
        note: null,
        licence: t('source.companiesHouse.licence', 'Open Government Licence'),
        icon: 'landmark',
        country: 'GB',
      };
    case 'france':
      return {
        name: t('source.france.name', 'Register of France'),
        short: t('source.france.short', 'the Register of France'),
        gives: t('source.france.gives', 'Companies by activity and town, and registered details'),
        note: null,
        licence: t('source.france.licence', 'Licence Ouverte (Etalab)'),
        icon: 'landmark',
        country: 'FR',
      };
    case 'norway':
      return {
        name: t('source.norway.name', 'Register of Norway'),
        short: t('source.norway.short', 'the Register of Norway'),
        gives: t('source.norway.gives', 'Companies by activity and town, and registered details'),
        note: null,
        licence: t('source.norway.licence', 'NLOD · Brønnøysundregistrene'),
        icon: 'landmark',
        country: 'NO',
      };
    case 'opencorporates':
      return {
        name: t('source.opencorporates.name', 'OpenCorporates'),
        short: t('source.opencorporates.short', 'OpenCorporates'),
        gives: t('source.opencorporates.gives', 'Registered details by company name'),
        note: t('source.opencorporates.note', 'A business needs a paid OpenCorporates key. Details found with it may need finding again if your subscription ends.'),
        licence: t('source.opencorporates.licence', 'Powered by OpenCorporates'),
        icon: 'library',
        country: null,
      };
    case 'hunter':
      return {
        name: t('source.hunter.name', 'Hunter'),
        short: t('source.hunter.short', 'Hunter'),
        gives: t('source.hunter.gives', 'People and their work e-mails'),
        note: t('source.hunter.note', 'Used only while Lead finder keeps people. Each look-up counts against your Hunter account.'),
        licence: null,
        icon: 'at-sign',
        country: null,
      };
    default:
      return { name: id, short: id, gives: '', note: null, licence: null, icon: 'plug', country: null };
  }
}
