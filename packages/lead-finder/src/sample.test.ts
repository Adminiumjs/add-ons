/**
 * THE SAMPLE FILES.
 *
 * Written by `scripts/sample.mjs` and never by hand: this suite holds the
 * files to the script, to the checks Adminium runs before it adds a row (the
 * CRM's rows for an add-on, and the CRM's own rows), and to what they
 * promise: Hunter's people in each state, field notes whose hashes are the
 * values', and nothing real: numbers that fail their registers' checks,
 * `.example` everywhere, none of the comps' real companies.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sampleBundleIssues, sampleSectionIssues } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { CRM_TARGET, crmRows, TARGET, written } from '../scripts/sample.mjs';
import { buildSample, CRM_ROWS, VALUE_HASHES, type Row } from './sample/bundle.ts';
import { inUnallocatedUkBlock, passesLuhn, passesMod11 } from './testing/check-digits.ts';

const section = JSON.parse(readFileSync(TARGET as string, 'utf8')) as ReturnType<typeof buildSample>;
const rowsOf = (ref: string): Row[] => section.tables.find((table) => table.ref === ref)?.rows ?? [];

/** The CRM's two tables as the CRM declares them, with the company columns it declares for Lead finder to fill, and Lead finder suggested. */
function crm(): Record<string, unknown> {
  const text = (ref: string, maxLength: number, nullable = true) => ({ ref, type: 'text', maxLength, ...(nullable ? { nullable: true } : {}) });
  return {
    kind: 'app',
    key: 'crm',
    addOns: { suggests: [{ key: 'lead-finder', range: '>=1.0.31' }] },
    sampleData: { file: 'seeds/meridian.json', people: [{ key: 'dana', name: 'Dana Whitlock', email: 'dana@meridian.example', role: 'rep' }] },
    requiredSchema: {
      tables: [
        {
          ref: 'companies',
          columns: [{ ref: 'id', type: 'int', role: 'pk' }, text('name', 160, false), text('company_number', 40), text('sector', 80), text('website', 200), text('phone', 40), text('address_lines', 400), text('town', 120), text('region', 120), text('postal_code', 20), text('country', 2), text('about', 1000)],
        },
        {
          ref: 'contacts',
          columns: [{ ref: 'id', type: 'int', role: 'pk' }, { ref: 'company_id', type: 'fk', references: 'companies' }, text('name', 120, false), text('job_title', 120), text('email', 200), { ref: 'may_email', type: 'bool', default: false }, { ref: 'may_email_at', type: 'timestamptz', nullable: true }, { ref: 'won_deals', type: 'int', default: 0 }],
        },
      ],
    },
  };
}

describe('the sample files', () => {
  it('are what the script writes', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe(written(buildSample()));
    expect(readFileSync(CRM_TARGET as string, 'utf8')).toBe(written(crmRows()));
  });

  it('are the CRM’s rows for Lead finder, by the check Adminium runs before it adds one', () => {
    expect(section).toMatchObject({ format: 'adminium.sample/1', app: 'crm', addOn: 'lead-finder' });
    expect(sampleSectionIssues(section as never, crm() as never, manifest as never).map((issue) => `${issue.path}: ${issue.message}`)).toEqual([]);
  });

  it('name only rows the CRM’s own sample carries, which fit the CRM’s tables', () => {
    expect(sampleBundleIssues(crmRows() as never, crm() as never).map((issue) => `${issue.path}: ${issue.message}`)).toEqual([]);
    const labels = new Set([...CRM_ROWS.companies, ...CRM_ROWS.contacts].map((row) => row['@label']));
    const named = JSON.stringify(section.tables).match(/"@ref":"(co|ct):[^"]+"/g) ?? [];
    for (const one of named) expect(labels.has(JSON.parse(`{${one}}`)['@ref']), one).toBe(true);
  });

  it('are not shipped with the add-on: its manifest names no sample of its own', () => {
    expect((manifest as Record<string, unknown>)['sampleData']).toBeUndefined();
  });
});

describe('the people Hunter found', () => {
  it('stand one told, one waiting, one that could not be told, and one told who then agreed by phone', () => {
    expect(rowsOf('found_people').map((row) => [row['@label'], row['state']])).toEqual([
      ['found:robin-hale', 'told'],
      ['found:sam-ellery', 'waiting'],
      ['found:jo-ashby', 'failed'],
      ['found:kari-vik', 'told'],
    ]);
    expect(CRM_ROWS.contacts.find((row) => row['@label'] === 'ct:kari-vik')).toMatchObject({ may_email: true });
    expect(CRM_ROWS.contacts.filter((row) => row['may_email'] === true)).toHaveLength(1);
    expect(rowsOf('tell_mails').find((row) => row['status'] === 'failed')).toMatchObject({ error: 'The address bounced' });
  });

  it('were all found by Hunter, with the pages it saw them on, one https address a line', () => {
    for (const row of rowsOf('found_people')) {
      expect(row['source']).toBe('hunter');
      for (const page of String(row['source_pages']).split('\n')) expect(page).toMatch(/^https:\/\/[a-z.-]+\.example\//);
    }
  });

  it('queue no mail in the sample: the one waiting has none', () => {
    expect(rowsOf('tell_mails').map((row) => row['status'])).not.toContain('queued');
    expect(rowsOf('tell_mails').map((row) => (row['found_person_id'] as { '@ref': string })['@ref'])).not.toContain('found:sam-ellery');
  });
});

describe('the field notes', () => {
  it('hash each value as the record page reads it: sha-256 of the text, trimmed', () => {
    for (const [value, hash] of Object.entries(VALUE_HASHES)) expect(createHash('sha256').update(value.trim()).digest('hex'), value).toBe(hash);
  });

  it('note values the companies really hold, from a source Lead finder has', () => {
    const sources = new Set((manifest.addOn.sources as { id: string }[]).map((one) => one.id));
    for (const row of rowsOf('field_sources')) {
      const company = CRM_ROWS.companies.find((one) => one['@label'] === (row['row_key'] as { '@ref': string })['@ref'])!;
      const value = String(company[String(row['column_name'])]);
      expect(row['value_hash'], `${String(company['@label'])}.${String(row['column_name'])}`).toBe(createHash('sha256').update(value.trim()).digest('hex'));
      expect(sources.has(String(row['source']))).toBe(true);
    }
  });
});

describe('everything in the sample is made up', () => {
  const text = () => readFileSync(TARGET as string, 'utf8') + readFileSync(CRM_TARGET as string, 'utf8');

  it('UK numbers sit in the unallocated 98 block; Norwegian numbers fail mod-11; any SIREN fails Luhn', () => {
    for (const company of CRM_ROWS.companies) {
      const number = String(company['company_number']);
      if (company['country'] === 'GB') expect(inUnallocatedUkBlock(number), number).toBe(true);
      if (company['country'] === 'NO') expect(passesMod11(number), number).toBe(false);
      if (company['country'] === 'FR') expect(passesLuhn(number), number).toBe(false);
    }
  });

  it('the check-digit tests themselves tell a number that passes from one that does not', () => {
    // Numbers built here to pass, never a real unit's: eight digits and the check digit each scheme works out for them.
    const luhnDigit = (head: string) => [...'0123456789'].find((digit) => passesLuhn(`${head}${digit}`))!;
    const mod11Digit = (head: string) => [...'0123456789'].find((digit) => passesMod11(`${head}${digit}`));
    const siren = `10000000${luhnDigit('10000000')}`;
    expect(passesLuhn(siren)).toBe(true);
    expect(passesLuhn(`${siren.slice(0, 8)}${String((Number(siren[8]) + 1) % 10)}`)).toBe(false);
    const head = ['10000000', '10000001', '10000002'].find((one) => mod11Digit(one) !== undefined)!;
    const organisation = `${head}${mod11Digit(head)!}`;
    expect(passesMod11(organisation)).toBe(true);
    expect(passesMod11(`${head}${String((Number(organisation[8]) + 1) % 10)}`)).toBe(false);
    expect(inUnallocatedUkBlock('12345678')).toBe(false);
  });

  it('every site and address is .example', () => {
    for (const site of text().match(/https?:\/\/[^"\s/]+/g) ?? []) expect(site).toMatch(/\.example$/);
    for (const address of text().match(/[\w.+-]+@[\w.-]+/g) ?? []) expect(address).toMatch(/\.example$/);
  });

  it('none of the comps’ real companies, numbers or streets', () => {
    for (const real of ['Ashdown', 'Wharfedale', 'Briggate', 'Northlight', 'OC412345', '901226548', 'Sovereign Street', 'Hustlergate', 'Fenchurch']) expect(text()).not.toContain(real);
  });
});
