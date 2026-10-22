/**
 * THE PRIVATE STRIPE APP THAT MAKES THE KEY.
 *
 * The way Stripe recommends to hand software a restricted key: the shop
 * uploads a small private app of its own to its own Stripe account, installs
 * it, and the install shows a restricted key (`rk_…`) with exactly the access
 * the app lists — nothing more. This add-on ships the app as a template; the
 * screen that sets the add-on up offers it as a download, stamped for that
 * shop, because Stripe app ids are unique across all of Stripe: two shops can
 * never upload the same id.
 *
 * The app has no screens (`ui_extension.views` is empty) and asks for the
 * restricted-key access type, so its only job is the key. The permission list
 * is the one the transport's own key check reads (`PERMISSION_PROBES` in
 * `wire.ts`, plus "Accounts: read" for the account id), so a key made this way
 * passes that check, and one made by hand from the same list does too.
 *
 * Everything here is pure: given the shop's name and an id for this install,
 * it answers the files to put in the download. Nothing is fetched or written.
 */

import { ACCOUNT_PERMISSION, PERMISSION_PROBES, type PermissionGroup } from './wire.ts';

/** One line of the app's permission list: Stripe's id, the name the key check uses, and why. */
export interface KeyAppPermission {
  /** Stripe's id for the access, as `stripe-app.json` names it. */
  permission: string;
  /** The same access as the Stripe dashboard form and the key check name it. */
  name: string;
  /** Where that form lists it. */
  group: PermissionGroup;
  /** Shown to whoever installs the app. */
  purpose: string;
  optional?: boolean;
}

/**
 * The access the key needs, in the order the setup screen lists it. Read in
 * the Stripe reference (docs.stripe.com/stripe-apps/reference/permissions):
 * the ids are Stripe's own.
 */
export const KEY_APP_PERMISSIONS: readonly KeyAppPermission[] = [
  { permission: 'checkout_session_write', name: 'Checkout Sessions: write', group: 'Checkout Sessions', purpose: 'Start a payment, and end one that is no longer needed.' },
  { permission: 'checkout_session_read', name: 'Checkout Sessions: read', group: 'Checkout Sessions', purpose: 'See how a payment ended.' },
  { permission: 'payment_intent_read', name: 'Payment Intents: read', group: 'Core', purpose: 'See the amount taken.' },
  { permission: 'charge_write', name: 'Charges and Refunds: write', group: 'Core', purpose: 'Give refunds. In Stripe this access also allows changing charges.' },
  { permission: 'event_read', name: 'Events: read', group: 'Core', purpose: 'Catch a payment whose webhook went missing.' },
  { permission: 'dispute_read', name: 'Payment Disputes: read', group: 'Core', purpose: 'Show disputes.' },
  { permission: 'payment_method_configurations_read', name: 'Payment Method Configurations: read', group: 'Core', purpose: 'See which ways to pay you switched on.' },
  { permission: 'connected_account_read', name: ACCOUNT_PERMISSION.name, group: ACCOUNT_PERMISSION.group, purpose: 'Show which Stripe account the key belongs to.' },
  { permission: 'webhook_read', name: 'Webhook Endpoints, Event Destinations: read', group: 'Webhook Endpoints, Event Destinations', purpose: 'Check your live webhook.', optional: true },
];

/** The id the shipped template carries: never valid to upload, so an unstamped template is refused here first. */
export const KEY_APP_PLACEHOLDER_ID = 'com.example.payments-stamp-me';

/** The name the shipped template carries, replaced by the stamp. */
export const KEY_APP_PLACEHOLDER_NAME = 'Payments for your shop';

/**
 * Words Stripe does not take in an app's name (its manifest reference names
 * "Stripe" and "App" — the rest of its list is about apps sold to others,
 * which this one is not; "RAK" is its short form for a restricted key),
 * matched as whole words.
 */
const NAME_REFUSED = /\b(?:stripe|apps?|rak)\b/giu;

/** The longest name the stamp writes. Stripe states no limit for a private app; a name this long reads whole in its dashboard. */
export const KEY_APP_NAME_MAX = 40;

/** What the download holds: file name → its text. */
export interface KeyAppTemplate {
  appId: string;
  appName: string;
  files: Readonly<Record<string, string>>;
}

/** The app manifest (`stripe-app.json`, version 1), as the template holds it. */
export function keyAppManifest(appId: string, appName: string): Record<string, unknown> {
  return {
    id: appId,
    version: '1.0.0',
    name: appName,
    distribution_type: 'private',
    sandbox_install_compatible: true,
    stripe_api_access_type: 'restricted_api_key',
    permissions: KEY_APP_PERMISSIONS.map(({ permission, purpose }) => ({ permission, purpose })),
    ui_extension: { views: [] },
  };
}

/** The shipped, unstamped template: what a test reads, and what the stamp starts from. */
export const KEY_APP_SHIPPED_MANIFEST: Readonly<Record<string, unknown>> = keyAppManifest(KEY_APP_PLACEHOLDER_ID, KEY_APP_PLACEHOLDER_NAME);

/** A slug of letters and digits from any text: lower case, Latin letters and digits only, words joined by `-`. */
function slug(text: string, max: number): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** "Payments for <shop>", without a word Stripe refuses, at most {@link KEY_APP_NAME_MAX} characters. */
export function keyAppName(shopName: string): string {
  const shop = shopName.replace(NAME_REFUSED, ' ').replace(/\s+/g, ' ').trim();
  const full = shop === '' ? KEY_APP_PLACEHOLDER_NAME : `Payments for ${shop}`;
  if (full.length <= KEY_APP_NAME_MAX) return full;
  // Cut at a word, never inside one.
  const cut = full.slice(0, KEY_APP_NAME_MAX + 1);
  const at = cut.lastIndexOf(' ');
  return (at > 'Payments for'.length ? cut.slice(0, at) : full.slice(0, KEY_APP_NAME_MAX)).trim();
}

/**
 * The app id for one install: `com.<shop>.payments.<install>`. It begins and
 * ends with a letter or digit, as Stripe asks, and the install part makes it
 * unique however many shops share a name.
 */
export function keyAppId(shopName: string, installId: string): string {
  const install = installId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (install.length < 8) throw new Error('The install id needs at least 8 letters or digits, so the app id is unique.');
  const shop = slug(shopName.replace(NAME_REFUSED, ' '), 24) || 'shop';
  return `com.${shop}.payments.${install.slice(0, 16)}`;
}

/** Why a manifest may not be uploaded as this add-on's key app: empty when it may. */
export function keyAppIssues(manifest: unknown): string[] {
  const issues: string[] = [];
  const m = (typeof manifest === 'object' && manifest !== null ? manifest : {}) as Record<string, unknown>;
  const id = typeof m['id'] === 'string' ? m['id'] : '';
  if (id === '' || id === KEY_APP_PLACEHOLDER_ID || id.includes('example')) issues.push('The app id is still the template one. Download the template from Studio again.');
  else if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(id)) issues.push('The app id must begin and end with a letter or digit and hold only letters, digits, dots and hyphens.');
  const name = typeof m['name'] === 'string' ? m['name'] : '';
  if (name === '' || name === KEY_APP_PLACEHOLDER_NAME) issues.push('The app has no name of its own.');
  else if (new RegExp(NAME_REFUSED.source, 'iu').test(name)) issues.push('The app name holds a word Stripe does not take in a name.');
  if (m['stripe_api_access_type'] !== 'restricted_api_key') issues.push('The app must ask for a restricted key.');
  if (m['distribution_type'] !== 'private') issues.push('The app must be private: only your own account installs it.');
  const asked = Array.isArray(m['permissions']) ? (m['permissions'] as { permission?: unknown }[]).map((one) => one.permission) : [];
  const wanted = KEY_APP_PERMISSIONS.map((one) => one.permission);
  const extra = asked.filter((one) => !wanted.includes(one as string));
  const lacking = KEY_APP_PERMISSIONS.filter((one) => one.optional !== true && !asked.includes(one.permission)).map((one) => one.permission);
  if (extra.length > 0) issues.push(`The app asks for access the payments do not use: ${extra.join(', ')}.`);
  if (lacking.length > 0) issues.push(`The app lacks access the payments need: ${lacking.join(', ')}.`);
  return issues;
}

/** The steps that travel inside the download, beside the manifest. */
function readme(appName: string): string {
  return [
    `# ${appName}`,
    '',
    'A private app for your own Stripe account. It shows nothing in the Stripe dashboard; installing it gives you a restricted key (`rk_…`) with exactly the access listed in `stripe-app.json`, and nothing more.',
    '',
    'You need the Stripe command-line tool 1.25.0 or newer with its `apps` plugin 1.19.0 or newer, Node 22 or newer, and pnpm 10.',
    '',
    '1. In a terminal, make a new app folder with the Stripe command-line tool: `stripe apps create key-app`. Answer its questions with anything; the next step replaces them.',
    '2. Copy this folder\'s `stripe-app.json` over the one in `key-app`. Keep its `id` as it is: it was made for your shop, and Stripe takes each id once.',
    '3. Sign in to your Stripe sandbox (`stripe login`), then in `key-app` run `stripe apps upload`. In the Stripe dashboard, open the app and install it in the sandbox.',
    '4. In the installed app, open "View API keys" and copy the restricted key that starts with `rk_test_`. Paste it into the test key field in Adminium (Studio → Payments).',
    '5. When you are ready to take real payments: sign in to your live account and run `stripe apps upload` again (an upload belongs to one account), then install it there. The live key (`rk_live_…`) is shown once: copy it at once.',
    '',
    'If "View API keys" shows only a publishable key, the install has no restricted key: upload a new version (raise `version` in `stripe-app.json`) or install the app again.',
    'If Adminium later says the key was refused, the app was uninstalled or its key was rolled: install it again and paste the new key.',
    '',
  ].join('\n');
}

/**
 * The download for one shop: its manifest, stamped with an id made for this
 * install and the name "Payments for <shop>", and the steps.
 *
 * `installId` is any value unique to the install (8 or more letters or
 * digits): the setup screen keeps it, so a second download names the same app.
 */
export function keyAppTemplate(input: { shopName: string; installId: string }): KeyAppTemplate {
  const appId = keyAppId(input.shopName, input.installId);
  const appName = keyAppName(input.shopName);
  const manifest = keyAppManifest(appId, appName);
  const issues = keyAppIssues(manifest);
  if (issues.length > 0) throw new Error(issues.join(' '));
  return { appId, appName, files: { 'stripe-app.json': `${JSON.stringify(manifest, null, 2)}\n`, 'README.md': readme(appName) } };
}

/** The key check's names, in the app's order: the two lists must never drift apart. */
export const KEY_APP_CHECKED_NAMES: readonly string[] = [...PERMISSION_PROBES.map((probe) => probe.name), ACCOUNT_PERMISSION.name];
