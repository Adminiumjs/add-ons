/**
 * WHAT THE SIGNED-IN READER MAY DO, asked of Adminium once and read by every
 * screen. A control the reader may not use is not drawn; the server refuses
 * anyway.
 */
import { useAccess } from './host.ts';

export interface Role {
  ready: boolean;
  /** Top up, adjust, issue a card by hand, give credit. */
  cardMoney: boolean;
  cancelCard: boolean;
  /** Send a card's or a voucher's mail again. */
  sendCard: boolean;
  sendVoucher: boolean;
  issueVoucher: boolean;
  makeBatch: boolean;
  /** Record a voucher's use by hand. */
  useVoucher: boolean;
  /** A whole code, where the table holds one. */
  readsCode: boolean;
  readsBalance: boolean;
  editOffers: boolean;
  /** Change how Adminium works out a table's columns. */
  changeRules: boolean;
}

export function useRole(): Role {
  const access = useAccess();
  return {
    ready: access.ready,
    cardMoney: access.canCreate('card_actions'),
    cancelCard: access.canMove('gift_cards', 'cancel-card'),
    sendCard: access.canMove('gift_cards', 'send-again'),
    sendVoucher: access.canMove('vouchers', 'send-again'),
    issueVoucher: access.canCreate('vouchers'),
    makeBatch: access.canCreate('voucher_batches'),
    useVoucher: access.canCreate('voucher_actions'),
    readsCode: access.canRead('gift_cards', ['code']),
    readsBalance: access.canRead('gift_cards', ['balance']),
    editOffers: access.canCreate('offers'),
    changeRules: access.has('system:schema:remap'),
  };
}
