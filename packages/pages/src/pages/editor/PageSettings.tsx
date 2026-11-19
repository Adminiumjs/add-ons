/**
 * THE PAGE'S OWN SETTINGS (comp 436-484, `States` 555-600; D64).
 *
 * - Its name (staff's own, for the lists) and its address: `/x/pages/` and
 *   the slug, held to the landing slug rule as it is typed and saved on its
 *   own once it is right, so a clash says so on the field and keeps nothing
 *   else back.
 * - Its own domain: a page has none. Every host mapped to the add-on pages
 *   serves every page, so each is listed with this page's address on it, and
 *   someone who may change the hosts can make this page the host's home. With
 *   no host yet: "None yet." and, for that person, "Set one up in Hosted apps".
 *   A draft's addresses are grey: "Live once you publish."
 * - Its title and description (what a shared link and a search result show),
 *   and its sharing picture.
 * - "Show this page", for a page that was published.
 * - "Make a copy": one language per page, so a page in another language is a
 *   copy written in it.
 */
import { LANDING_SLUG_MAX, LANDING_TEXT_MAX } from '@adminium/add-on-contracts/landing';
import { useEffect, useState, type ReactNode } from 'react';

import { Button, Field, Input, Link, Textarea, type AddOnTranslate } from '../shared/host.ts';
import { HOSTED_APPS } from '../shared/paths.ts';
import { Icon } from './Canvas.tsx';
import type { Picture } from './doc.ts';
import type { LandingStatus } from './engine.ts';
import { PictureField } from './PictureField.tsx';
import { ShowSwitch } from './Publish.tsx';
import { addressRefused, isPageSlug, typedSlug } from './slug.ts';

/** An address's scheme and host: what a visitor types to reach a host's home. */
export const originOf = (url: string): string => url.split('/x/pages/')[0] ?? url;

export interface PageSettingsProps {
  t: AddOnTranslate;
  pageKey: string;
  name: string;
  slug: string;
  state: 'draft' | 'live' | 'off';
  title: string;
  description: string;
  picture: Picture | undefined;
  status: LandingStatus | null;
  mayEdit: boolean;
  mayMove: boolean;
  /** Whether this person may change which page a host opens on: null while it is asked. */
  mayChangeHosts: boolean | null;
  onName: (name: string) => void;
  /** Save the address; resolves to the refusal's words, or null once it is saved. */
  onSlug: (slug: string) => Promise<string | null>;
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
  onPicture: (picture: Picture | undefined) => void;
  onMakeHome: (host: string) => Promise<void>;
  onTurn: (on: boolean) => void;
  onCopy: (address: string) => void;
  onMakeCopy: () => void;
}

export function PageSettings(props: PageSettingsProps): ReactNode {
  const { t, pageKey, name, slug, state, title, description, picture, status, mayEdit, mayMove, mayChangeHosts } = props;
  const [typed, setTyped] = useState(slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  useEffect(() => setTyped(slug), [slug]);

  const draft = state === 'draft';
  // Wrong by its shape as it is typed, or, once saved, by Adminium's own judgement (a word the addresses keep).
  const wrong = (typed !== '' && !isPageSlug(typed)) || (typed === slug && addressRefused(status, slug));
  const saveSlug = async (): Promise<void> => {
    if (typed === slug) return;
    if (!isPageSlug(typed)) {
      setSlugError(t('editor.settings.slugRule', 'Use lower-case letters, digits and dashes; not a word the addresses use (api, login, account…).'));
      return;
    }
    const refused = await props.onSlug(typed);
    setSlugError(refused);
    if (refused === null) setSaid(t('editor.settings.slugSaved', 'Address saved.'));
  };

  const hosts = (status?.page?.addresses ?? []).filter((one) => (status?.hosts ?? []).some((host) => host.host === one.host));
  const own = status?.page?.addresses.find((one) => !hosts.includes(one));
  const address = own?.url ?? `/x/pages/${slug}`;

  return (
    <div data-lpe-fields="">
      {draft ? (
        <p data-lpe-note="" className="flex items-center gap-1.5">
          <Icon name="clock" />
          <span>{t('editor.settings.liveOnce', 'Live once you publish.')}</span>
        </p>
      ) : null}
      <Input id="lpe-name" label={t('editor.settings.name', 'Name')} hint={t('editor.settings.nameHint', 'Only your team sees it, in the list of pages.')} value={name} maxLength={200} disabled={!mayEdit} onChange={(event) => props.onName(event.target.value)} />
      <div className="flex flex-col gap-1.5">
        <Input
          id="lpe-slug"
          label={t('editor.settings.address', 'Address')}
          hint={t('editor.settings.addressHint', 'The last part of the page’s address, after /x/pages/.')}
          {...(slugError !== null ? { error: slugError } : wrong ? { error: t('editor.settings.slugRule', 'Use lower-case letters, digits and dashes; not a word the addresses use (api, login, account…).') } : {})}
          value={typed}
          dir="ltr"
          maxLength={LANDING_SLUG_MAX}
          disabled={!mayEdit}
          onChange={(event) => {
            setTyped(typedSlug(event.target.value));
            setSlugError(null);
          }}
          onBlur={() => void saveSlug()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void saveSlug();
          }}
        />
        <div data-lpe-address="" {...(draft ? { 'data-lpe-draft': '' } : {})}>
          <bdi dir="ltr">{address}</bdi>
          <button type="button" data-lpe-move="" aria-label={t('editor.settings.copyAddress', 'Copy address')} title={t('editor.settings.copyAddress', 'Copy address')} onClick={() => props.onCopy(address)}>
            <Icon name="copy" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span data-lpe-micro="">{t('editor.settings.domain', 'Your own domain')}</span>
        {hosts.length === 0 ? (
          <>
            <p data-lpe-note="">{t('editor.settings.noDomain', 'None yet.')}</p>
            {mayChangeHosts === true ? <Link to={HOSTED_APPS}>{t('editor.settings.setUp', 'Set one up in Hosted apps')}</Link> : null}
          </>
        ) : (
          hosts.map((one) => (
            <div key={one.host} data-lpe-group="">
              <span className="flex items-center gap-2">
                <Icon name="globe" />
                <bdi dir="ltr" className="font-bold">
                  {one.host}
                </bdi>
                {one.home && !draft ? <span className="ms-auto inline-flex items-center gap-1 text-[11.5px] font-bold text-accent">{t('editor.settings.home', 'Home')}</span> : null}
              </span>
              <div data-lpe-address="" {...(draft ? { 'data-lpe-draft': '' } : {})}>
                <bdi dir="ltr">{one.url}</bdi>
                <button type="button" data-lpe-move="" aria-label={t('editor.settings.copyOn', 'Copy the address on {host}', { host: one.host })} title={t('editor.settings.copyAddress', 'Copy address')} onClick={() => props.onCopy(one.url)}>
                  <Icon name="copy" />
                </button>
              </div>
              {one.home && !draft ? (
                <p data-lpe-note="">
                  {t('editor.settings.homeLine', '{address} opens this page.', { address: originOf(one.url) })}
                </p>
              ) : null}
              {!one.home && !draft && state === 'live' && mayChangeHosts === true ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void props.onMakeHome(one.host).then(
                        () => setSaid(t('editor.settings.madeHome', 'This page is now the home of {host}.', { host: one.host })),
                        () => setSaid(t('editor.settings.homeFailed', 'The home of {host} could not be changed. Try again.', { host: one.host })),
                      )
                    }
                  >
                    {t('editor.settings.makeHome', 'Make this the home of {host}', { host: one.host })}
                  </Button>
                  <p data-lpe-note="">{t('editor.settings.visitLine', 'Visitors who open {address} see this page.', { address: originOf(one.url) })}</p>
                </>
              ) : null}
            </div>
          ))
        )}
      </div>
      <Input id="lpe-title" label={t('editor.settings.title', 'Title')} hint={t('editor.settings.titleHint', 'The browser tab and a shared link show it.')} value={title} maxLength={LANDING_TEXT_MAX.title} disabled={!mayEdit} onChange={(event) => props.onTitle(event.target.value)} />
      <Field label={t('editor.settings.description', 'Description')} hint={t('editor.settings.descriptionHint', 'A line or two under the title in a shared link and in search results.')}>
        <Textarea value={description} rows={3} maxLength={LANDING_TEXT_MAX.description} disabled={!mayEdit} onChange={(event) => props.onDescription(event.target.value)} />
      </Field>
      <PictureField t={t} pageKey={pageKey} id="lpe-share" label={t('editor.settings.share', 'Sharing picture')} value={picture} mayEdit={mayEdit} describe={false} removable onChange={(next) => props.onPicture(next === undefined ? undefined : { file: next.file, decorative: true })} />
      {picture === undefined ? <p data-lpe-note="">{t('editor.settings.noShare', 'No sharing picture. Links to this page show the title and description only.')}</p> : <p data-lpe-note="">{t('editor.settings.shareHint', 'Best at 1200 × 630.')}</p>}
      {draft ? null : <ShowSwitch t={t} id="lpe-settings-show" on={state === 'live'} homeOf={status?.page?.homeOf ?? []} mayMove={mayMove} onTurn={props.onTurn} />}
      {mayEdit ? (
        <div className="flex flex-col gap-1.5">
          <span data-lpe-micro="">{t('editor.settings.language', 'Another language')}</span>
          <p data-lpe-note="">{t('editor.settings.languageNote', 'One language per page. For another language, make a copy of the page and write it in that language.')}</p>
          <span>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="copy-plus" />} onClick={props.onMakeCopy}>
              {t('editor.copy.make', 'Make a copy')}
            </Button>
          </span>
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
