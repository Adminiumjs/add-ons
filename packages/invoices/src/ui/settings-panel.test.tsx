/**
 * @vitest-environment happy-dom
 *
 * The settings panel's new fields, and the checks on the ones Adminium's
 * rules read when an app's row is created — a prefix the numbering rule can
 * use, a first number that only moves up, a rate from 0 to 100, ladders of
 * three rising days. A value that fails is never saved.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { strings } from '../i18n/strings.ts';
import { settingsFrom } from '../settings.ts';
import { SettingsPanel } from './SettingsPanel.tsx';

const en = strings['en-US'];

function mount(settings: Record<string, unknown> = {}) {
  const patch = vi.fn();
  render(<SettingsPanel payload={{ settings: settings as never, patch, samples: [] }} />);
  return patch;
}

/** The input under a field's label. */
function field(label: string): HTMLInputElement {
  return screen.getByText(label, { selector: 'span' }).parentElement!.querySelector('input, select, textarea') as HTMLInputElement;
}

function commit(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the letterhead fields', () => {
  it('shows the new ones and saves each under its own key', () => {
    const patch = mount();
    fireEvent.change(field(en['addon.invoices.setting.tax_number']), { target: { value: 'GB 123' } });
    expect(patch).toHaveBeenLastCalledWith({ tax_number: 'GB 123' });
    fireEvent.change(field(en['addon.invoices.setting.payment_instructions']), { target: { value: 'Pay by transfer' } });
    expect(patch).toHaveBeenLastCalledWith({ payment_instructions: 'Pay by transfer' });
    fireEvent.change(field(en['addon.invoices.setting.footer']), { target: { value: 'Thanks' } });
    expect(patch).toHaveBeenLastCalledWith({ footer: 'Thanks' });
  });

  it('keeps the tax name and the older tax-line word in step', () => {
    const patch = mount();
    fireEvent.change(field(en['addon.invoices.setting.tax_name']), { target: { value: 'VAT' } });
    expect(patch).toHaveBeenLastCalledWith({ tax_name: 'VAT', tax_label: 'VAT' });
  });
});

describe('the numbering fields', () => {
  it('saves a prefix the numbering rule accepts', () => {
    const patch = mount();
    commit(field(en['addon.invoices.setting.prefix_quote']), 'P/2026-');
    expect(patch).toHaveBeenLastCalledWith({ prefix_quote: 'P/2026-' });
  });

  it('refuses a prefix the numbering rule cannot use, and says why', () => {
    const patch = mount();
    commit(field(en['addon.invoices.setting.prefix_invoice']), 'INV #');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText(en['addon.invoices.problem.prefix'])).toBeTruthy();
  });

  it('lets a first number move up', () => {
    const patch = mount({ number_start_invoice: 40 });
    commit(field(en['addon.invoices.setting.number_start_invoice']), '2040');
    expect(patch).toHaveBeenLastCalledWith({ number_start_invoice: 2040 });
  });

  it('never lets a first number move down, and names the lowest it may be', () => {
    const patch = mount({ number_start_invoice: 40 });
    commit(field(en['addon.invoices.setting.number_start_invoice']), '12');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText('The first number can only move up. 40 is the lowest it can be now.')).toBeTruthy();
  });

  it('refuses a first number that is not a whole number', () => {
    const patch = mount();
    commit(field(en['addon.invoices.setting.number_start_receipt']), '1.5');
    expect(patch).not.toHaveBeenCalled();
  });
});

describe('the defaults and the ladders', () => {
  it('saves a default rate from 0 to 100, and refuses one outside', () => {
    const patch = mount();
    commit(field(en['addon.invoices.setting.default_tax_rate']), '20');
    expect(patch).toHaveBeenLastCalledWith({ default_tax_rate: 20 });
    patch.mockClear();
    commit(field(en['addon.invoices.setting.default_tax_rate']), '120');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText(en['addon.invoices.problem.rate'])).toBeTruthy();
  });

  it('offers the four terms and the three ladders in words', () => {
    mount();
    const terms = field(en['addon.invoices.setting.default_terms']) as unknown as HTMLSelectElement;
    expect([...terms.options].map((option) => option.textContent)).toEqual(['Net 7', 'Net 14', 'Net 30', 'On receipt']);
    expect(terms.value).toBe('net14');
    const ladder = field(en['addon.invoices.setting.default_ladder']) as unknown as HTMLSelectElement;
    expect([...ladder.options].map((option) => option.textContent)).toEqual(['Gentle', 'Standard', 'Firm']);
  });

  it('saves a ladder of three rising days and keeps the other two', () => {
    const patch = mount();
    commit(field(en['addon.invoices.ladder.firm']), '2, 5, 10');
    expect(patch).toHaveBeenLastCalledWith({ ladders: { gentle: [7, 21, 45], standard: [3, 14, 30], firm: [2, 5, 10] } });
  });

  it('refuses a ladder that does not rise', () => {
    const patch = mount();
    commit(field(en['addon.invoices.ladder.gentle']), '7, 7, 45');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText(en['addon.invoices.problem.ladder'])).toBeTruthy();
  });

  it('turns the payments list off', () => {
    const patch = mount();
    fireEvent.click(screen.getByText(en['addon.invoices.setting.show_payment_ledger']).parentElement!.querySelector('input')!);
    expect(patch).toHaveBeenLastCalledWith({ show_payment_ledger: false });
  });
});

describe('settings read leniently', () => {
  it('reads what an older panel saved: the tax word, the terms sentence', () => {
    const settings = settingsFrom({ tax_label: 'GST', terms: 'Thirty days, please.' });
    expect(settings.taxName).toBe('GST');
    expect(settings.footer).toBe('Thirty days, please.');
  });

  it('does not mistake the shipped English default for a chosen tax name', () => {
    expect(settingsFrom({ tax_label: 'Tax' }).taxName).toBe('');
  });

  it('takes the default for a prefix, a first number or a ladder it cannot use', () => {
    const settings = settingsFrom({
      prefix_invoice: 'INV #',
      number_start_receipt: 0,
      ladders: JSON.stringify({ gentle: [9, 3, 1], standard: [3, 14, 30], firm: 'soon' }),
    });
    expect(settings.prefixes.invoice).toBe('INV-');
    expect(settings.starts.receipt).toBe(1);
    expect(settings.ladders).toEqual({ gentle: [7, 21, 45], standard: [3, 14, 30], firm: [1, 7, 21] });
  });
});
