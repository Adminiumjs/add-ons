/**
 * WHAT ADMINIUM SAID, IN THE READER'S WORDS.
 *
 * The door and the Sources routes refuse with stable codes and English
 * messages (the engine's words never name this add-on's screens); a screen
 * words each code in the reader's language. A code this file does not know
 * is said in the engine's own words.
 */
import type { AddOnTranslate, DataError } from './host.ts';
import type { AddReason, SourceView, WebsiteOutcome } from './door.ts';
import { sourceWords } from './sourceWords.ts';

/** Where a refusal came from, to say it about. */
export interface Said {
  message: string;
  /** What kind of card a search draws for it. */
  kind: 'key' | 'limit' | 'down' | 'off' | 'other';
}

const detail = (error: DataError, name: string): unknown => (error.details as Record<string, unknown> | undefined)?.[name];

/** A refusal of a call to a source (search, look-up, people). */
export function sourceRefusal(t: AddOnTranslate, error: DataError, source: SourceView | undefined, id: string): Said {
  const named = sourceWords(t, id).short;
  const cap = source?.dailyCap ?? null;
  switch (error.code) {
    case 'KEY_REFUSED':
      return { kind: 'key', message: t('door.keyRefused', '{source} refused its key. Check it in Sources.', { source: named }) };
    case 'KEY_NOT_SET':
      return { kind: 'key', message: t('door.keyNotSet', '{source} has no key yet. Add one in Sources.', { source: named }) };
    case 'SOURCE_OFF':
      return { kind: 'off', message: t('door.sourceOff', '{source} is switched off. Turn it on in Sources.', { source: named }) };
    case 'DAILY_CAP':
      return cap === null
        ? { kind: 'limit', message: t('door.capNoNumber', '{source}: today’s limit of look-ups is reached. Search again tomorrow, or raise the limit in Sources.', { source: named }) }
        : { kind: 'limit', message: t('door.cap', '{source}: today’s limit of {count} look-ups is reached. Search again tomorrow, or raise the limit in Sources.', { source: named, count: cap }) };
    case 'PERSON_SHARE':
      return { kind: 'limit', message: t('door.share', '{source}: you have used your share of today’s look-ups. Search again tomorrow.', { source: named }) };
    case 'QUOTA_SPENT':
      return { kind: 'limit', message: t('door.quota', '{source}: your account’s look-ups are used up.', { source: named }) };
    case 'PAUSED':
    case 'RATE_LIMITED':
    case 'BUSY': {
      const seconds = Number(detail(error, 'retryAfterSeconds'));
      return Number.isFinite(seconds) && seconds > 0
        ? { kind: 'down', message: t('door.paused', '{source} asked us to wait. Try again in {seconds} seconds.', { source: named, seconds: Math.ceil(seconds) }) }
        : { kind: 'down', message: t('door.busy', '{source} is busy. Try again in a minute.', { source: named }) };
    }
    case 'UNAVAILABLE':
      return { kind: 'down', message: t('door.down', '{source} didn’t answer. Try again in a minute.', { source: named }) };
    case 'NOT_VOUCHED':
      return { kind: 'other', message: t('door.notVouched', 'Lead finder did not load: its package is not one Adminium can vouch for.') };
    case 'NOT_FOUND':
      return { kind: 'other', message: t('door.noMatch', '{source} has no company by this name.', { source: named }) };
    case 'INVALID_REQUEST':
      return { kind: 'other', message: t('door.invalid', '{source} could not take that question. Check what you typed.', { source: named }) };
    default:
      return { kind: 'other', message: doorRefusal(t, error) };
  }
}

/** Any other refusal of the door: a write, a fill, a keep. */
export function doorRefusal(t: AddOnTranslate, error: DataError): string {
  const reason = detail(error, 'reason');
  switch (error.code) {
    case 'FIELD_CHANGED':
      return t('door.fieldChanged', 'A detail was changed after you looked. Look up again.');
    case 'PEOPLE_OFF':
      return t('door.peopleOff', 'Keeping people is off, so Lead finder fills in company details only.');
    case 'NO_SALES_CONTACT':
      return t('door.noSales', 'This business told the register it does not want sales contact, so nobody there is kept.');
    case 'RECHECK_FAILED':
      return t('door.recheck', 'The register could not be asked again whether this business takes sales contact. Try again.');
    case 'RATE_LIMITED':
      return t('door.rate', 'Too many tries. Wait a minute.');
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
    case 'COLUMN_FORBIDDEN':
      return t('door.forbidden', 'You do not have permission to do this.');
    case 'NOT_FOUND':
      return t('door.notHere', 'That company is not here, or not one you can open.');
    case 'VALIDATION_FAILED':
      switch (reason) {
        case 'network-off':
          return t('door.networkOff', 'This server calls nothing outside, so no source can be asked.');
        case 'no-companies-table':
          return t('door.noTable', 'No app on this database keeps companies.');
        case 'no-database':
          return t('door.noDatabase', 'Lead finder is not attached to an app’s database.');
        case 'look-up-again':
          return t('door.lookAgain', 'That was found a while ago. Look up again.');
        case 'no-website':
          return t('door.noWebsite', 'This company has no website, so nobody can be looked for at it.');
        case 'database':
          return t('door.database', 'The database cannot be read now. Try again in a minute.');
        default:
          return error.message !== '' ? error.message : t('door.other', 'That could not be done. Try again.');
      }
    default:
      if (error.code === 'TRIAL_REFUSED' || reason === 'addOnHttp') return t('door.operatorOff', 'Network calls by add-ons are switched off here, so no source can be asked.');
      return error.message !== '' ? error.message : t('door.other', 'That could not be done. Try again.');
  }
}

/** Why a found company may not be added, said on its row or after an add. */
export function addReasonWords(t: AddOnTranslate, reason: AddReason | 'no-marketing' | 'sole-trader' | 'needs-address' | null): string {
  switch (reason) {
    case 'already-here':
      return t('door.add.here', 'Already here.');
    case 'no-marketing':
      return t('door.add.noSales', 'This business told the register it does not want sales contact.');
    case 'sole-trader':
      return t('door.add.sole', 'Sole traders are people. Lead finder adds them only while it keeps people, and then tells them.');
    case 'needs-address':
      return t('door.add.address', 'A sole trader is kept only with their own e-mail address, so they can be told.');
    case 'not-found':
      return t('door.add.gone', 'This company is no longer in your search: search again.');
    case 'not-kept':
      return t('door.add.notKept', 'The person could not be kept, so the company was not added.');
    case 'refused':
    case null:
      return t('door.add.refused', 'The company was refused.');
  }
}

/** What reading a company's website came to, when it was not read. */
export function websiteWords(t: AddOnTranslate, outcome: WebsiteOutcome, host: string | null): string {
  switch (outcome) {
    case 'asks':
      return t('door.site.asks', 'This website sends visitors to {host}.', { host: host ?? '' });
    case 'refused-by-site':
      return t('door.site.blocked', 'This website asks tools not to read it, so we didn’t.');
    case 'not-a-page':
      return t('door.site.notPage', 'That address is not a web page Lead finder can read.');
    case 'unreachable':
      return t('door.site.down', 'Couldn’t reach the website.');
    case 'no-website':
      return t('door.site.none', 'This company has no website to read.');
    case 'off':
      return t('door.site.off', 'The website reader is switched off in Sources.');
    case 'read':
      return '';
  }
}

/** Why a found person was not kept. */
export function keepReasonWords(t: AddOnTranslate, reason: string): string {
  switch (reason) {
    case 'people-off':
      return t('door.keep.off', 'Keeping people is off.');
    case 'stopped':
      return t('door.keep.stopped', 'On the do-not-email list.');
    case 'already-here':
      return t('door.keep.here', 'Already a contact.');
    case 'generic':
      return t('door.keep.generic', 'A shared address, not a person.');
    case 'no-name':
      return t('door.keep.noName', 'No name to keep them by.');
    case 'no-company':
      return t('door.keep.noCompany', 'The company is not here.');
    case 'not-told-yet':
      return t('door.keep.notTold', 'They could not be told at once, so they were not kept.');
    case 'not-found':
      return t('door.keep.gone', 'No longer in what Hunter found: find people again.');
    default:
      return t('door.keep.other', 'Not kept.');
  }
}
