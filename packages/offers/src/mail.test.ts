/**
 * THE MAILS, AS THEY ARE DECLARED.
 *
 * Seven kinds of message from four templates. What goes out when, to whom
 * and with which code is proved where there is a database and a clock (the
 * engine's suite); here the declaration is held to what a wrong mail would
 * come from: which change a kind hears, whose address it is sent to, which
 * variables a template may print — and that a credit's mail carries no code
 * and no link at all.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Producer {
  kind: string;
  link: string;
  repeat?: boolean;
  onChange?: { table: string; column?: string; to?: string; columns?: string[]; changed?: boolean; where?: Record<string, unknown> };
  onCreate?: { table: string; where?: Record<string, unknown> };
  due?: { date: string; days: number; at: string };
  dropWhen?: Record<string, unknown>[];
  recipient: { column: string; name?: string; language?: string };
}
interface Block {
  block: string;
  data: Record<string, unknown>;
}
interface Template {
  key: string;
  name: Record<string, string>;
  vars: string[];
  locales: Record<string, { subject: string; blocks: Block[]; footer: string }>;
}
const m = manifest as unknown as { outbox: { table: string; columns: Record<string, string>; links: Record<string, string>; pages: { app: Record<string, string> }; kinds: Record<string, string>; producers: Producer[] }; emailTemplates: Template[] };
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; enum?: string[]; nullable?: boolean }[] }[];
const columnsOf = (ref: string): string[] => tables.find((table) => table.ref === ref)!.columns.map((column) => column.ref);
const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const template = (key: string): Template => m.emailTemplates.find((one) => one.key === key)!;
const variablesIn = (value: unknown): string[] => [...JSON.stringify(value).matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match) => match[1] as string);
const english = (key: string): Block[] => template(key).locales['en-US']!.blocks;
const shape = (blocks: Block[]): string[] => blocks.map((block) => `${block.block}${block.data['onlyWith'] === undefined ? '' : ` with ${String(block.data['onlyWith'])}`}${block.data['onlyWithout'] === undefined ? '' : ` without ${String(block.data['onlyWithout'])}`}`);

describe('the outbox', () => {
  it('logs to `messages`, which keeps who, when and why — and no body, so no code', () => {
    expect(m.outbox.table).toBe('messages');
    for (const column of Object.values(m.outbox.columns)) expect(columnsOf('messages')).toContain(column);
    for (const never of ['body', 'subject', 'html', 'text', 'code']) expect(columnsOf('messages')).not.toContain(never);
    expect(m.outbox.links).toEqual({ card: 'card_id', voucher: 'voucher_id' });
  });

  it('has seven kinds from four templates, and every kind the log can hold is one of them', () => {
    expect(m.outbox.kinds).toEqual({ gift_card: 'offers-gift-card', gift_card_dated: 'offers-gift-card', gift_card_again: 'offers-gift-card', gift_card_expiring: 'offers-gift-card-expiring', credit: 'offers-credit', voucher: 'offers-voucher', voucher_again: 'offers-voucher' });
    const kinds = tables.find((table) => table.ref === 'messages')!.columns.find((column) => column.ref === 'kind')!.enum!;
    expect([...kinds].sort()).toEqual(Object.keys(m.outbox.kinds).sort());
    expect(m.outbox.producers.map((producer) => producer.kind).sort()).toEqual(Object.keys(m.outbox.kinds).sort());
    expect([...new Set(Object.values(m.outbox.kinds))].sort()).toEqual(m.emailTemplates.map((one) => one.key).sort());
  });

  it("a card's first mail is decided by one column: each producer hears one value of `notify` and nothing else", () => {
    const heard = (kind: string): Producer => m.outbox.producers.find((producer) => producer.kind === kind)!;
    expect(heard('gift_card').onChange).toEqual({ table: 'gift_cards', column: 'notify', to: 'card' });
    expect(heard('gift_card_dated').onChange).toEqual({ table: 'gift_cards', column: 'notify', to: 'card_dated' });
    expect(heard('credit').onChange).toEqual({ table: 'gift_cards', column: 'notify', to: 'credit' });
    // Only the dated one waits; one with no date would wait for ever.
    expect(heard('gift_card').due).toBeUndefined();
    expect(heard('credit').due).toBeUndefined();
    expect(heard('gift_card_dated').due).toEqual({ date: 'send_on', days: 0, at: '09:00' });
    const values = tables.find((table) => table.ref === 'gift_cards')!.columns.find((column) => column.ref === 'notify')!.enum!;
    expect([...values].sort()).toEqual(['card', 'card_dated', 'credit']);
  });

  it('"Send again" is its own kind, heard on any change of one column, and sends each time', () => {
    for (const [kind, table] of [['gift_card_again', 'gift_cards'], ['voucher_again', 'vouchers']] as const) {
      const producer = m.outbox.producers.find((one) => one.kind === kind)!;
      expect(producer.repeat, kind).toBe(true);
      expect(producer.onChange, kind).toMatchObject({ table, columns: ['resent_at'], changed: true });
    }
    // No other kind repeats: a card's own mail goes once.
    expect(m.outbox.producers.filter((producer) => producer.repeat === true).map((producer) => producer.kind).sort()).toEqual(['gift_card_again', 'voucher_again']);
    // A cancelled card is not sent again.
    expect(m.outbox.producers.find((one) => one.kind === 'gift_card_again')!.onChange!.where).toEqual({ column: 'status', eq: 'active' });
  });

  it('the reminder is dated by the card and dropped for a card that is cancelled, expired or empty', () => {
    const reminder = m.outbox.producers.find((one) => one.kind === 'gift_card_expiring')!;
    expect(reminder.onChange).toEqual({ table: 'gift_cards', column: 'status', to: 'active', where: { column: 'remind_on', isNull: false } });
    expect(reminder.due).toEqual({ date: 'remind_on', days: 0, at: '09:00' });
    expect(reminder.dropWhen).toEqual([{ column: 'status', in: ['void', 'expired'], reason: 'void' }, { column: 'balance', lte: 0, reason: 'no-longer-needed' }]);
    expect(m.outbox.producers.find((one) => one.kind === 'gift_card_dated')!.dropWhen).toEqual([{ column: 'status', in: ['void', 'expired'], reason: 'void' }]);
  });

  it('every mail is addressed from the row it is about: a card to its recipient, credit to its owner, a voucher to its holder', () => {
    const to = Object.fromEntries(m.outbox.producers.map((producer) => [producer.kind, `${producer.link} → ${producer.recipient.column}`]));
    expect(to).toEqual({ gift_card: 'card_id → recipient_email', gift_card_dated: 'card_id → recipient_email', gift_card_again: 'card_id → recipient_email', gift_card_expiring: 'card_id → recipient_email', credit: 'card_id → owner_email', voucher: 'voucher_id → holder_email', voucher_again: 'voucher_id → holder_email' });
    for (const producer of m.outbox.producers) {
      const table = producer.link === 'card_id' ? 'gift_cards' : 'vouchers';
      for (const column of [producer.recipient.column, producer.recipient.name, producer.recipient.language]) if (column !== undefined) expect(columnsOf(table), `${producer.kind}: ${column}`).toContain(column);
    }
    // A voucher with nobody's address is nobody's mail.
    expect(m.outbox.producers.find((one) => one.kind === 'voucher')!.onCreate).toEqual({ table: 'vouchers', where: { column: 'holder_email', isNull: false } });
  });
});

describe('the templates', () => {
  it('each has the same blocks in eight languages, with the same conditions and the same variables', () => {
    for (const one of m.emailTemplates) {
      expect(Object.keys(one.locales).sort(), one.key).toEqual(LOCALES);
      expect(Object.keys(one.name).sort(), one.key).toEqual(LOCALES);
      for (const [locale, words] of Object.entries(one.locales)) {
        expect(shape(words.blocks), `${one.key} ${locale}`).toEqual(shape(english(one.key)));
        expect(words.blocks.map((block) => variablesIn(block.data)), `${one.key} ${locale}`).toEqual(english(one.key).map((block) => variablesIn(block.data)));
        expect(variablesIn(words.subject), `${one.key} ${locale}`).toEqual(variablesIn(one.locales['en-US']!.subject));
        expect(words.subject.trim(), `${one.key} ${locale}`).not.toBe('');
        // Nothing an owner would have to rewrite by hand: no raw HTML block.
        for (const block of words.blocks) expect(block.block, `${one.key} ${locale}`).not.toBe('email.html');
      }
    }
  });

  it('every sentence is translated: no language repeats the English word for word, but for a line that is only a variable', () => {
    for (const one of m.emailTemplates) {
      for (const locale of LOCALES.filter((tag) => tag !== 'en-US')) {
        one.locales[locale]!.blocks.forEach((block, at) => {
          const [theirs, ours] = [JSON.stringify(block.data), JSON.stringify(english(one.key)[at]!.data)];
          const words = ours.replace(/\{\{[^}]+\}\}/g, '').replace(/"(label|value|text|author|url|qr|size|items|stats|onlyWith|onlyWithout)"|[^A-Za-z]/g, '');
          if (words.length > 12) expect(theirs, `${one.key} ${locale} block ${String(at)}`).not.toBe(ours);
        });
      }
    }
  });

  it('prints only variables it declares, and each names a real column of the row it is about', () => {
    const FORMS = new Set(['money', 'date', 'grouped', 'qr']);
    for (const one of m.emailTemplates) {
      const used = new Set(Object.values(one.locales).flatMap((words) => [...variablesIn(words.blocks), ...variablesIn(words.subject), ...variablesIn(words.footer)]));
      for (const variable of used) {
        if (variable === 'appName') continue;
        const bare = variable.split('.').filter((part, at) => !(at === 2 && FORMS.has(part))).join('.');
        expect(one.vars.map((declared) => declared.split('.').slice(0, 2).join('.')), `${one.key}: ${variable}`).toContain(bare);
        const [row, column] = variable.split('.');
        if (row === 'app_url') expect(Object.keys(m.outbox.pages.app), variable).toContain(column);
        else expect(columnsOf(row === 'card' ? 'gift_cards' : 'vouchers'), variable).toContain(column);
      }
      // And a condition names a variable the same way.
      for (const block of english(one.key)) {
        for (const mark of ['onlyWith', 'onlyWithout']) {
          if (block.data[mark] === undefined) continue;
          const [row, column] = String(block.data[mark]).split('.');
          if (row === 'app_url') expect(Object.keys(m.outbox.pages.app), `${one.key}: ${String(block.data[mark])}`).toContain(column);
          else expect(columnsOf(row === 'card' ? 'gift_cards' : 'vouchers'), `${one.key}: ${String(block.data[mark])}`).toContain(column);
        }
      }
    }
  });

  it('no template prints a code but through card.code or voucher.code, grouped and as a QR', () => {
    const all = m.emailTemplates.flatMap((one) => Object.values(one.locales).flatMap((words) => [...variablesIn(words.blocks), ...variablesIn(words.subject)]));
    expect([...new Set(all.filter((variable) => /code/.test(variable)))].sort()).toEqual(['card.code.grouped', 'card.code.qr', 'voucher.code.grouped', 'voucher.code.qr']);
    // Never in a subject line, which a lock screen shows.
    for (const one of m.emailTemplates) for (const words of Object.values(one.locales)) expect(variablesIn(words.subject).filter((variable) => variable !== 'appName'), one.key).toEqual([]);
    // The card's own link is only ever the end of the balance button's address.
    const tokens = m.emailTemplates.flatMap((one) => Object.values(one.locales).flatMap((words) => words.blocks.filter((block) => JSON.stringify(block.data).includes('link_token'))));
    // And the button is there only where an app serves a balance page: a link to nowhere with a card's token on it is never sent.
    for (const block of tokens) expect(block).toMatchObject({ block: 'email.button', data: { url: '{{app_url.balance}}#{{card.link_token}}', onlyWith: 'app_url.balance' } });
  });

  it('a credit is told what it holds and how to use it, with no code, no QR and no link', () => {
    const credit = template('offers-credit');
    expect(shape(english('offers-credit'))).toEqual(['email.heading', 'email.stats', 'email.text']);
    const used = Object.values(credit.locales).flatMap((words) => variablesIn(words.blocks));
    expect([...new Set(used)]).toEqual(['card.balance.money']);
    expect(credit.vars).toEqual(['card.balance.money']);
  });

  it('a gift card says who sent it only when somebody did, and how to see the balance either way', () => {
    expect(shape(english('offers-gift-card'))).toEqual([
      'email.heading with card.sender_name',
      'email.heading without card.sender_name',
      'email.stats',
      'email.quote',
      'email.box',
      'email.image',
      'email.text',
      'email.button with app_url.balance',
      'email.text without app_url.balance',
      'email.text with card.expires_on',
      'email.list',
    ]);
    const box = english('offers-gift-card').find((block) => block.block === 'email.box')!;
    expect(box.data).toEqual({ label: 'Your code', value: '{{card.code.grouped}}' });
    expect(english('offers-gift-card').find((block) => block.block === 'email.image')!.data).toEqual({ qr: '{{card.code.qr}}', size: 160 });
    // The figure is always what is on the card when the mail goes: the amount at first, what is left on a re-send.
    expect(english('offers-gift-card').find((block) => block.block === 'email.stats')!.data).toEqual({ stats: [{ value: '{{card.balance.money}}', label: 'Gift card balance' }] });
  });

  it('a voucher for one person says so, and a voucher with a last day says which', () => {
    // This mail goes only for a voucher made for somebody, so it always says so.
    expect(shape(english('offers-voucher'))).toEqual(['email.heading', 'email.box', 'email.image', 'email.text', 'email.text', 'email.text with voucher.expires_on']);
    // A mail prints no column marked personal: who gave a card is told to its recipient, so that name is not marked so.
    const cards = (manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; rules?: { personal?: boolean } }[] }[]).find((table) => table.ref === 'gift_cards')!;
    const personal = new Set(cards.columns.filter((column) => column.rules?.personal === true).map((column) => column.ref));
    for (const one of m.emailTemplates.filter((candidate) => candidate.key !== 'offers-voucher')) for (const variable of one.vars) if (variable.startsWith('card.')) expect([...personal], `${one.key} prints ${variable}`).not.toContain(variable.split('.')[1]);
  });
});
