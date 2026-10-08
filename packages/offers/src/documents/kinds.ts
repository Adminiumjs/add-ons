/**
 * THE FOUR THINGS OFFERS PRINTS: a gift card and a voucher, each on a card of
 * A6 and on a strip of receipt paper. A strip is a kind of its own because a
 * document's paper comes from its kind.
 */
import type { DocumentKind, DocumentOutline, OutlineSlot } from '@adminium/add-on-contracts';

import { WORDS, type Word } from './words.ts';

export const KINDS: readonly DocumentKind[] = [
  { id: 'gift-card', label: WORDS.giftCard, formats: ['html'], paper: ['a6'], coverage: 'all' },
  { id: 'gift-card-strip', label: WORDS.giftCardStrip, formats: ['html'], paper: ['receipt-80mm'], coverage: 'all' },
  { id: 'voucher', label: WORDS.voucher, formats: ['html'], paper: ['a6'], coverage: 'all' },
  { id: 'voucher-strip', label: WORDS.voucherStrip, formats: ['html'], paper: ['receipt-80mm'], coverage: 'all' },
];

const slot = (id: string, word: Word, type: OutlineSlot['type'], required: boolean, more: Partial<OutlineSlot> = {}): OutlineSlot => ({ id, label: WORDS[word], type, required, ...more });

const CARD: DocumentOutline = {
  slots: [
    slot('code', 'code', 'text', true),
    slot('qr', 'qr', 'qr', false),
    slot('amount', 'amount', 'money', true),
    slot('useBy', 'useBySlot', 'date', false),
    slot('first', 'first', 'text', false, { help: WORDS.firstHelp }),
    slot('printedAt', 'printedAt', 'date', false, { default: 'now' }),
  ],
};
const VOUCHER: DocumentOutline = {
  slots: [
    slot('code', 'code', 'text', true),
    slot('qr', 'qr', 'qr', false),
    slot('name', 'name', 'text', true),
    slot('worth', 'worth', 'text', true),
    slot('value', 'value', 'number', false),
    slot('usesLeft', 'usesLeftSlot', 'number', false),
    slot('usesTotal', 'usesTotal', 'number', false),
    slot('useBy', 'useBySlot', 'date', false),
    slot('printedAt', 'printedAt', 'date', false, { default: 'now' }),
  ],
};

export const isCard = (kind: string): boolean => kind === 'gift-card' || kind === 'gift-card-strip';
export const isStrip = (kind: string): boolean => kind.endsWith('-strip');
export const kindOf = (id: string): DocumentKind | undefined => KINDS.find((kind) => kind.id === id);
export const outlineOf = (kind: string): DocumentOutline => (isCard(kind) ? CARD : VOUCHER);
