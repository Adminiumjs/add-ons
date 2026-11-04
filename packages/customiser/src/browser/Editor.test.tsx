// @vitest-environment jsdom
/**
 * THE CUSTOMER'S EDITOR, AS A CUSTOMER USES IT, AGAINST THE SAMPLES.
 *
 * Each comp row the editor builds is held here by what the customer sees and
 * does: Birch Row's coasters, book nook and cutting board in the maker's
 * look, Marlow Press's business cards and flyers in the print look. The API
 * is a stand-in (`testing/stub.ts`): these prove what the editor asks for and
 * shows; what a real Adminium answers is the walk on a real engine.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomiserEditor, type CustomiserEditorProps } from './index.ts';
import { drawn, setWidth, settle } from './testing/render.tsx';
import { stubApi, type Stub } from './testing/stub.ts';

afterEach(cleanup);
beforeEach(() => setWidth(1280));

const type = (label: string | RegExp, text: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
};

function maker(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  const onAddToBasket = vi.fn();
  const onSaved = vi.fn();
  const onDesignChange = vi.fn();
  return {
    onAddToBasket,
    onSaved,
    onDesignChange,
    view: drawn(
      <CustomiserEditor
        api={stub.api}
        base={stub.ids.coasters}
        product={{ name: 'Engraved walnut coasters', price: '£34.00', unit: 'set of 4' }}
        price={{ total: '£40.00', detail: '£40.00 a set', note: 'Order by 17:00 and we post it by Tue 11 Aug' }}
        quantity={{ value: 1, breaks: [{ qty: 4, label: '−8%' }], onChange: () => {} }}
        featurePrices={{ logo: '+£1.50 a piece' }}
        shop="Birch Row"
        onAddToBasket={onAddToBasket}
        onSaved={onSaved}
        onDesignChange={onDesignChange}
        {...extra}
      />,
    ),
  };
}

async function openRing(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  const out = maker(stub, extra);
  await out.view;
  fireEvent.click(screen.getByRole('button', { name: /^Customise the Ring design/ }));
  await settle();
  return out;
}

describe('the maker’s look: choose a design (BC-A1, BC-A2)', () => {
  it('shows the coasters’ six designs, filters with counts, and the plain piece last', async () => {
    const stub = stubApi('maker');
    await maker(stub).view;
    expect(screen.getByText('Make it yours')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Choose a design' })).toBeTruthy();
    const counts = screen.getAllByRole('radio').map((one) => one.textContent);
    expect(counts).toEqual(['All6', 'Words only3', 'With a logo2', 'Motifs1']);
    const cards = screen.getAllByRole('button', { name: /^Customise the / }).map((one) => /the (.+) design/.exec(one.getAttribute('aria-label')!)![1]);
    expect(cards).toEqual(['Ring', 'Two lines', 'Monogram', 'Sprig', 'Badge', 'Stamp']);
    expect(screen.getByRole('button', { name: /Start with a plain piece/ })).toBeTruthy();
    // Each card says what it lets you change.
    expect(screen.getByRole('button', { name: 'Customise the Sprig design. Your words, Motifs.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^With a logo/ }));
    expect(screen.getAllByRole('button', { name: /^Customise the / })).toHaveLength(2);
  });

  it('searches, and when nothing matches says so and offers every design again', async () => {
    const stub = stubApi('maker');
    await maker(stub).view;
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search designs' }), { target: { value: 'zebra' } });
    expect(screen.getByText('No designs match “zebra”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all designs' }));
    expect(screen.getAllByRole('button', { name: /^Customise the / })).toHaveLength(6);
  });

  it('opens a product with no ready-made designs straight on its plain piece (BC-A3)', async () => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.board} product={{ name: 'Walnut cutting board' }} onAddToBasket={() => {}} />);
    expect(screen.queryByRole('heading', { name: 'Choose a design' })).toBeNull();
    expect(screen.getByText('No ready-made designs for this one')).toBeTruthy();
    expect(screen.getByLabelText('In the corner')).toBeTruthy();
  });
});

describe('the maker’s look: fill it in (BC-B1, BC-B2, BC-B5, BC-B6)', () => {
  it('lists the parts in the design’s order: a part only the studio sets, the logo with its price, the words', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    expect(screen.getByRole('heading', { name: 'Engraved walnut coasters' })).toBeTruthy();
    expect(screen.getByText('Design: Ring')).toBeTruthy();
    expect(screen.getByText('2 TO CHANGE')).toBeTruthy();
    const locked = screen.getByLabelText('The ring, set by the studio: Engraved ring, 1 mm');
    expect(locked.getAttribute('tabindex')).toBe('0');
    fireEvent.focus(locked);
    expect(within(locked).getByText('Set by the studio').className).toContain('cz-shown');
    expect(screen.getByText('+£1.50 a piece')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload your logo' })).toBeTruthy();
    expect(screen.getByText('Your logo is private. Only you and the studio can see it.')).toBeTruthy();
    expect(screen.getByLabelText('Your words').getAttribute('placeholder')).toBe('The Hartleys · 2019');
    expect(screen.getByText('We’ll send you a proof before we cut anything.')).toBeTruthy();
  });

  it('counts the characters: amber with three left, red over, and the fix box offers to shorten or set smaller letters', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    const counter = (): HTMLElement => document.getElementById('cz-f-words-count')!;
    type('Your words', 'The Pinfold · 2019');
    expect(counter().textContent).toBe('18 / 22');
    expect(counter().className).toContain('cz-counter-ok');
    type('Your words', 'The Pinfold · 2019 ok');
    expect(counter().className).toContain('cz-counter-near');
    type('Your words', 'The Bellamy-Hart Kitchen Co.');
    expect(counter().className).toContain('cz-counter-over');
    expect(screen.getByLabelText('Your words').getAttribute('aria-invalid')).toBe('true');
    const box = screen.getByRole('alert');
    expect(box.textContent).toContain('6 characters over. At 6 mm this part fits 22. Smaller letters fit more.');
    fireEvent.click(within(box).getByRole('button', { name: 'Make it smaller' }));
    await settle();
    // 28 characters at 4.5 mm: 22 × 6 / 4.5 = 29.
    expect(screen.getByRole('group', { name: 'Letter size for Your words' }).textContent).toContain('4.5 mm');
    expect(screen.queryByRole('alert')).toBeNull();
    type('Your words', 'The Bellamy-Hart Kitchen Company Ltd');
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Shorten it' }));
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toHaveLength(29);
  });

  it('steps the letter size within the part’s range, and says the range', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    const group = screen.getByRole('group', { name: 'Letter size for Your words' });
    expect(group.textContent).toContain('6 mm');
    expect(screen.getByText('4–8 mm')).toBeTruthy();
    for (let i = 0; i < 6; i += 1) fireEvent.click(within(group).getByRole('button', { name: 'Bigger letters' }));
    expect(group.textContent).toContain('8 mm');
    expect(within(group).getByRole('button', { name: 'Bigger letters' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('chooses a font and a finish, each a chip, and the drawing follows', async () => {
    const stub = stubApi('maker');
    const { onDesignChange } = await openRing(stub);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Font for Your words' })).getByRole('radio', { name: 'Caveat' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Finish for Your words' })).getByRole('radio', { name: 'Painted white' }));
    const last = onDesignChange.mock.calls.at(-1)![0] as { design: { values: { parts: Record<string, unknown> } } };
    expect(last.design.values.parts['words']).toEqual({ font: 'Caveat', finish: 'paint-white' });
    expect(screen.getByRole('radio', { name: 'Caveat' }).getAttribute('aria-checked')).toBe('true');
  });

  it('lists the checks, takes the customer to each part, and holds Add to basket with its reason', async () => {
    const stub = stubApi('maker');
    const { onAddToBasket } = await openRing(stub);
    expect(screen.getByText('1 to look at')).toBeTruthy();
    const check = screen.getByRole('button', { name: /Your words is needed — it can’t be left empty/ });
    const add = screen.getByRole('button', { name: 'Add to basket' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(add.getAttribute('aria-describedby')!)!.textContent).toBe('Fix 1 thing in the checks before it can go in the basket.');
    fireEvent.click(check);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Your words'));
    // Pressing the held button shows the field's own error and goes to it.
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(add);
    await settle();
    expect(screen.getByText('Add your words — this part is needed')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Your words'));
    expect(onAddToBasket).not.toHaveBeenCalled();
    type('Your words', 'The Pinfold · 2019');
    expect(screen.getByText('Nothing to fix. Whether it looks right is what the proof is for.')).toBeTruthy();
    expect(screen.getByText('All clear')).toBeTruthy();
  });

  it('takes the customer from a part on the drawing to its field (BC-B1 tap)', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Your words' }));
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Your words'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit Your logo' }), { key: 'Enter' });
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload your logo' }));
    // A part only the studio sets is no stop of its own on the drawing: its row is.
    expect(screen.queryByRole('button', { name: 'Edit The ring' })).toBeNull();
  });

  it('shows the app’s quantity, its breaks, its total and the post-by line, and prices nothing itself', async () => {
    const stub = stubApi('maker');
    const onChange = vi.fn();
    await openRing(stub, { quantity: { value: 1, breaks: [{ qty: 4, label: '−8%' }, { qty: 8, label: '−14%' }], onChange } });
    expect(screen.getByText('£40.00', { selector: '.cz-total' })).toBeTruthy();
    expect(screen.getByText('£40.00 a set')).toBeTruthy();
    expect(screen.getByText('Order by 17:00 and we post it by Tue 11 Aug')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'One more' }));
    fireEvent.click(screen.getByRole('button', { name: /^8/ }));
    expect(onChange.mock.calls).toEqual([[2], [8]]);
    expect(screen.getByRole('button', { name: 'One fewer' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('adds it to the basket by saving it first, and hands the app its code and the features it takes', async () => {
    const stub = stubApi('maker');
    const { onAddToBasket } = await openRing(stub);
    type('Your words', 'The Pinfold · 2019');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    });
    await settle();
    expect(stub.calls.filter((one) => one.call === 'create')).toHaveLength(1);
    const [design, email] = stub.calls.find((one) => one.call === 'create')!.args as [{ ready_design_id: number; values: unknown }, string | null];
    expect(design.ready_design_id).toBe(stub.ids.ring);
    expect(design.values).toEqual({ parts: { words: { text: 'The Pinfold · 2019' } } });
    expect(email).toBeNull();
    const handed = onAddToBasket.mock.calls[0]![0] as { code: string; used: string[]; session: unknown };
    expect(handed.code).toMatch(/^CZ/);
    expect(handed.used).toEqual([]);
    expect(handed.session).not.toBeNull();
    // A second time changes the same design in place.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    });
    await settle();
    expect(stub.calls.filter((one) => one.call === 'create')).toHaveLength(1);
    expect(stub.calls.filter((one) => one.call === 'change')).toHaveLength(1);
  });

  it('takes a logo through the upload, and then tells the app the design takes the logo feature', async () => {
    const stub = stubApi('maker');
    const { onDesignChange } = await openRing(stub);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toContain('image/svg+xml');
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'pinfold-sign.svg', { type: 'image/svg+xml' })] } });
    });
    await settle();
    expect(stub.calls.find((one) => one.call === 'upload')!.args).toEqual(['logo_file', 'pinfold-sign.svg']);
    expect(screen.getByText('pinfold-sign.svg')).toBeTruthy();
    expect((onDesignChange.mock.calls.at(-1)![0] as { used: string[] }).used).toEqual(['logo']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove your logo' }));
    expect((onDesignChange.mock.calls.at(-1)![0] as { used: string[] }).used).toEqual([]);
  });

  it('undoes and redoes one change at a time, a run of typing as one, by the buttons and the keyboard (BC-F24)', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    type('Your words', 'T');
    type('Your words', 'Th');
    type('Your words', 'The');
    fireEvent.click(screen.getByRole('radio', { name: 'Caveat' }));
    fireEvent.click(undo);
    expect(screen.getByRole('radio', { name: 'Manrope' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toBe('The');
    fireEvent.keyDown(screen.getByLabelText('Your words'), { key: 'z', ctrlKey: true });
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(screen.getByLabelText('Your words'), { key: 'z', ctrlKey: true, shiftKey: true });
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toBe('The');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('radio', { name: 'Caveat' }).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the words typed when the customer changes the design', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    type('Your words', 'Allotment 14');
    fireEvent.click(screen.getByRole('button', { name: 'Change the design' }));
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Sprig design/ }));
    await settle();
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toBe('Allotment 14');
    expect(screen.getByText('Design: Sprig')).toBeTruthy();
    expect(within(screen.getByRole('radiogroup', { name: 'Motif' })).getAllByRole('radio').map((one) => one.textContent)).toEqual(['Sprout', 'Leaf', 'Wheat']);
  });

  it('offers a part that takes words or a logo as two ways in, or left plain (the nook’s left window)', async () => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.nook} product={{ name: 'The Little Bookshop' }} featurePrices={{ logo: '+£1.50 for the logo' }} onAddToBasket={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Corner shop design/ }));
    await settle();
    expect(screen.getByText('Leave it plain, or put your own words or logo here.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add words' }));
    expect(screen.getByLabelText('The left window — your words')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Leave it empty' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Add your logo/ }));
    expect(screen.getByText('The left window — your logo')).toBeTruthy();
    expect(screen.getByText('110 × 180 × 150 mm · 14 pieces')).toBeTruthy();
  });

  it('tells the app of a change once, however often the app draws it again', async () => {
    const stub = stubApi('maker');
    const { onDesignChange, view } = await openRing(stub);
    const { rerender } = await view;
    const before = onDesignChange.mock.calls.length;
    const again = vi.fn();
    rerender(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} onAddToBasket={() => {}} onDesignChange={again} />);
    await settle();
    expect(again).not.toHaveBeenCalled();
    type('Your words', 'Ada');
    expect(again).toHaveBeenCalledTimes(1);
    expect(onDesignChange.mock.calls.length).toBe(before);
  });

  it('shows a refusal the shop’s order got at its part', async () => {
    const stub = stubApi('maker');
    await openRing(stub, { refused: { reason: 'font-not-allowed', part: 'words' } });
    expect(screen.getByRole('button', { name: /Your words: This choice isn’t one the shop offers here/ })).toBeTruthy();
  });
});

describe('the maker’s look: save and come back (BC-0.SAVE, BC-C1)', () => {
  it('asks for the address first, refuses one that is not, saves, says where the link went, and changes the same design after', async () => {
    const stub = stubApi('maker');
    const { onSaved } = await openRing(stub, { mailsLink: true });
    type('Your words', 'The Pinfold · 2019');
    screen.getByRole('button', { name: 'Save and come back' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    const dialog = screen.getByRole('dialog', { name: 'Save and come back' });
    expect(within(dialog).getByText('We’ll keep the design and e-mail you a private link to it. Nobody else can open it.')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Your e-mail'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save it' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Enter your e-mail so we can send you the link');
    fireEvent.change(within(dialog).getByLabelText('Your e-mail'), { target: { value: 'iris' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save it' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('That doesn’t look like an e-mail address. Try name@example.com');
    fireEvent.change(within(dialog).getByLabelText('Your e-mail'), { target: { value: 'iris@example.com' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save it' }));
    });
    await settle();
    const done = screen.getByRole('dialog', { name: 'Saved. We’ve e-mailed you a link to come back to it.' });
    expect(done.textContent).toContain('Sent to iris@example.com. The link opens your designs and nobody else’s.');
    expect(stub.calls.find((one) => one.call === 'create')!.args[1]).toBe('iris@example.com');
    expect(onSaved).toHaveBeenCalledTimes(1);
    fireEvent.click(within(done).getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save and come back' }));
    type('Your words', 'The Pinfold · 2020');
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    expect((screen.getByLabelText('Your e-mail') as HTMLInputElement).value).toBe('iris@example.com');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save it' }));
    });
    expect(stub.calls.filter((one) => one.call === 'create')).toHaveLength(1);
    expect(stub.calls.filter((one) => one.call === 'change')).toHaveLength(1);
  });

  it('where the link cannot be mailed, saves at once, asks no address, and shows the customer their link to keep', async () => {
    const stub = stubApi('maker');
    const { onSaved } = await openRing(stub, { linkUrl: (token) => `https://birchrow.example/design#${token}` });
    type('Your words', 'The Pinfold · 2019');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    });
    await settle();
    const done = screen.getByRole('dialog', { name: 'Saved. Keep this link to come back to it.' });
    expect(within(done).queryByLabelText('Your e-mail')).toBeNull();
    const link = stub.designs.get(String((onSaved.mock.calls[0]![0] as { id: unknown }).id))!.link;
    expect(done.textContent).toContain(`https://birchrow.example/design#${link}`);
    expect(stub.calls.find((one) => one.call === 'create')!.args[1]).toBeNull();
    expect(onSaved.mock.calls[0]![1]).toBeNull();
    expect(document.activeElement).toBe(within(done).getByRole('button', { name: 'Keep going' }));
    // Saved again, the same design changes, and its link is the one it had.
    fireEvent.click(within(done).getByRole('button', { name: 'Keep going' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    });
    await settle();
    expect(stub.calls.filter((one) => one.call === 'change')).toHaveLength(1);
    expect(screen.getByRole('dialog').textContent).toContain(link);
  });

  it('closes on Escape and gives the focus back', async () => {
    const stub = stubApi('maker');
    await openRing(stub);
    const opener = screen.getByRole('button', { name: 'Save and come back' });
    opener.focus();
    await act(async () => {
      fireEvent.click(opener);
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('says when the save fails, and saves nothing', async () => {
    const stub = stubApi('maker');
    await openRing(stub, { mailsLink: true });
    stub.failNext(Object.assign(new Error('slow down'), { code: 'PUBLIC_RATE_LIMITED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    fireEvent.change(screen.getByLabelText('Your e-mail'), { target: { value: 'iris@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save it' }));
    });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('Too many tries. Wait a minute and try again.');
  });

  it('saves nothing and puts nothing in a basket while the shop previews its own design', async () => {
    const stub = stubApi('maker');
    const { onAddToBasket } = await openRing(stub, { preview: true });
    type('Your words', 'The Pinfold · 2019');
    fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    expect(screen.getByText('Previewing — nothing goes in a real basket.')).toBeTruthy();
    expect(screen.getByText('Previewing — saving is switched off here.')).toBeTruthy();
    expect(stub.calls.filter((one) => one.call === 'create' || one.call === 'change')).toEqual([]);
    expect(onAddToBasket).not.toHaveBeenCalled();
  });
});

describe('the maker’s look on a phone (BC-B7d, FX-B)', () => {
  it('keeps the bar to one row, puts the rest in the page above it, and hides it while a text field has focus', async () => {
    setWidth(390);
    const stub = stubApi('maker');
    await openRing(stub);
    const bar = document.querySelector('.cz-phone-bar')!;
    expect(within(bar as HTMLElement).getAllByRole('button').map((one) => one.getAttribute('aria-label') ?? one.textContent)).toEqual(['One fewer', 'One more', 'Add to basket']);
    expect(bar.textContent).toContain('£40.00');
    const before = document.querySelector('.cz-before-bar') as HTMLElement;
    expect(within(before).getByRole('button', { name: 'Save and come back' })).toBeTruthy();
    expect(within(before).getByRole('button', { name: /^4/ })).toBeTruthy();
    expect(before.textContent).toContain('Fix 1 thing in the checks');
    expect(before.textContent).toContain('Order by 17:00');
    fireEvent.focus(screen.getByLabelText('Your words'));
    expect(document.querySelector('.cz-phone-bar')!.className).toContain('cz-gone');
    fireEvent.blur(screen.getByLabelText('Your words'));
    expect(document.querySelector('.cz-phone-bar')!.className).not.toContain('cz-gone');
  });
});

function print(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  return drawn(
    <CustomiserEditor
      api={stub.api}
      base={stub.ids.cards}
      product={{ name: 'Business cards' }}
      shop="Marlow Press"
      sides={2}
      price={{ total: '£87.55', each: '£0.18', detail: '500 business cards · including tax and delivery', ready: 'Mon 10 Aug' }}
      onAddToBasket={() => {}}
      onStartBlank={() => {}}
      onSendOwnFile={() => {}}
      {...extra}
    />,
  );
}
async function openHarbour(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  await print(stub, extra);
  fireEvent.click(screen.getByRole('button', { name: /^Customise the Harbour design/ }));
  await settle();
}

describe('the print look: choose a design (MC-A2, MC-A3)', () => {
  it('shows the eight cards on the customer’s size and sides, filters, a search, a count', async () => {
    const stub = stubApi('printing');
    await print(stub);
    expect(screen.getByText(/Shown on your 85 × 55 mm business cards, both sides\./)).toBeTruthy();
    expect(screen.getAllByRole('radio').map((one) => one.textContent)).toEqual(['All8', 'Simple3', 'Bold4', 'With a photo1', 'One colour3']);
    expect(screen.getByText('8 designs')).toBeTruthy();
    expect(screen.getByText('3 colourways · 2 layouts')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search designs' }), { target: { value: 'photo' } });
    expect(screen.getAllByRole('button', { name: /^Customise the / })).toHaveLength(1);
    expect(screen.getByText('1 design')).toBeTruthy();
  });

  it('offers the two other ways in when a product has no designs (MC-0.WAYS)', async () => {
    const stub = stubApi('printing');
    const onStartBlank = vi.fn();
    const onSendOwnFile = vi.fn();
    await print(stub, { base: stub.ids.flyers, product: { name: 'A5 flyers' }, onStartBlank, onSendOwnFile });
    expect(screen.getByRole('heading', { name: 'No ready-made designs for A5 flyers yet' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start from blank/ }));
    fireEvent.click(screen.getByRole('button', { name: /Send your own file/ }));
    expect(onStartBlank).toHaveBeenCalledTimes(1);
    expect(onSendOwnFile).toHaveBeenCalledTimes(1);
  });
});

describe('the print look: fill it in (MC-B1, MC-B2, MC-B5, MC-0.CHECKS)', () => {
  it('groups the fields by side and draws the card, its side and guides switchable', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub);
    expect(screen.getByRole('heading', { name: 'Harbour' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Front' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Back' })).getByLabelText('E-mail').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Address lines').tagName).toBe('TEXTAREA');
    fireEvent.click(screen.getByRole('radio', { name: 'With guides' }));
    expect(screen.getByText('Trim')).toBeTruthy();
    expect(screen.getByText('Safe line').parentElement!.textContent).toContain('4 mm');
    // A field's focus turns the card to its side.
    fireEvent.focus(screen.getByLabelText('E-mail'));
    expect(screen.getByRole('radio', { name: 'Back' }).getAttribute('aria-checked')).toBe('true');
  });

  it('says what is wrong under the field and in the checks, holds Add to basket with the first reason and how many more', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub);
    type('Job title', 'Head baker and pastry chef, Quay Street');
    expect(screen.getByText('39 / 24')).toBeTruthy();
    expect(screen.getByText(/15 over the limit\. Shorten it\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Job title is 15 characters over the limit\./ })).toBeTruthy();
    expect(screen.getByText(/Add your name — this design needs it\./)).toBeTruthy();
    const block = document.getElementById('cz-block')!;
    expect(block.textContent).toBe('Add your name. And 1 more. Show me');
    fireEvent.click(within(block).getByRole('button', { name: 'Show me' }));
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
    expect(screen.getByRole('button', { name: 'Add to basket' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('warns that words are hard to read on their colour, and offers the colour that reads (Sand)', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub);
    type('Name', 'Nell Fairweather');
    type('Job title', 'Head baker');
    fireEvent.click(screen.getByRole('radio', { name: 'Sand' }));
    const warning = screen.getAllByText(/Hard to read — the words are too close to the colour behind them\./)[0]!;
    const fix = within(warning.closest('.cz-advice') as HTMLElement).getByRole('button', { name: /^Use / });
    fireEvent.click(fix);
    expect(screen.queryAllByText(/Hard to read/).length).toBeLessThan(2 + 4);
    // Advice never holds the basket.
    expect(screen.getAllByRole('button', { name: 'Add to basket' })[0]!.getAttribute('aria-disabled')).toBe('false');
  });

  it('shows the app’s quote, and that customising adds nothing only where no feature is used', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub, { sides: 1 });
    expect(screen.getByRole('region', { name: 'Your quote' }).textContent).toContain('£87.55£0.18 each500 business cards · including tax and delivery');
    expect(screen.getByText('Ready Mon 10 Aug')).toBeTruthy();
    expect(screen.getByText('Customising adds nothing to the price.')).toBeTruthy();
    cleanup();
    await openHarbour(stubApi('printing'), { sides: 2 });
    // Both sides take "Print the back".
    expect(screen.queryByText('Customising adds nothing to the price.')).toBeNull();
  });

  it('lets a part only the shop sets be reached on the card, and says so (MC-B1.locked)', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub);
    const rule = screen.getByRole('img', { name: 'Rule — the shop’s part. It stays as it is.' });
    fireEvent.focus(rule);
    expect(screen.getByText('Rule is the shop’s part — it stays as it is.')).toBeTruthy();
  });

  it('switches layout and colours, and opens the full editor through the app (CR11 words)', async () => {
    const stub = stubApi('printing');
    const onFullEditor = vi.fn();
    await openHarbour(stub, { onFullEditor });
    fireEvent.click(screen.getByRole('radio', { name: 'Logo top' }));
    fireEvent.click(screen.getByRole('button', { name: /Switch to the full editor/ }));
    expect((onFullEditor.mock.calls[0]![0] as { values: { layout: string } }).values.layout).toBe('top');
  });

  it('opens the full-screen preview with its own sides and guides, and closes on Escape', async () => {
    const stub = stubApi('printing');
    await openHarbour(stub);
    fireEvent.click(screen.getByRole('button', { name: 'Full-screen preview' }));
    const full = screen.getByRole('dialog', { name: 'Full-screen preview' });
    expect(within(full).getByRole('radio', { name: 'Back' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the print look on a phone (MC-B6b, FX-M)', () => {
  it('puts the side and guides on one row, keeps the quote bar to one row, and hides it while a field has focus', async () => {
    setWidth(390);
    const stub = stubApi('printing');
    await openHarbour(stub);
    const tools = document.querySelector('.cz-sheet-tools') as HTMLElement;
    expect(within(tools).getByRole('radio', { name: 'Front' })).toBeTruthy();
    expect(within(tools).getByRole('button', { name: 'Guides' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(tools).queryByRole('radio', { name: 'With guides' })).toBeNull();
    const bar = screen.getByRole('region', { name: 'Your quote' });
    expect(bar.className).toBe('cz-quote-bar');
    expect(within(bar).getAllByRole('button').map((one) => one.getAttribute('aria-label') ?? one.textContent)).toEqual(['Save and come back', 'Add to basket']);
    fireEvent.focus(screen.getByLabelText('Name'));
    expect(bar.className).toContain('cz-gone');
    // The first thing to fix sits in the page, not in the bar.
    expect(document.querySelector('.cz-before-bar #cz-block')).not.toBeNull();
  });
});

describe('a design opened again', () => {
  it('opens a saved draft on its values, and changes it in place', async () => {
    const stub = stubApi('maker');
    const saved = await stub.api.create({ base_id: stub.ids.coasters, ready_design_id: stub.ids.ring, values: { parts: { words: { text: 'The Pinfold · 2019' } } } }, 'iris@example.com');
    const onAddToBasket = vi.fn();
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} design={saved} email="iris@example.com" onAddToBasket={onAddToBasket} />);
    expect((screen.getByLabelText('Your words') as HTMLInputElement).value).toBe('The Pinfold · 2019');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    });
    expect(stub.calls.filter((one) => one.call === 'change')).toHaveLength(1);
    expect((onAddToBasket.mock.calls[0]![0] as { id: unknown }).id).toBe(saved.id);
  });

  it('keeps an ordered design as it was: what is changed is saved as a new one', async () => {
    const stub = stubApi('maker');
    const [ordered] = await stub.api.byCodes(['BR2289R4W8N2T6JC']);
    expect(ordered!.state).toBe('ordered');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.keyring} product={{ name: 'Name keyring' }} design={ordered!} onAddToBasket={() => {}} />);
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('SAM');
    expect(screen.getByText(/This design is with an order already/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    });
    expect(stub.calls.filter((one) => one.call === 'create')).toHaveLength(1);
    expect(stub.calls.filter((one) => one.call === 'change')).toHaveLength(0);
  });
});

describe('the editor in another language', () => {
  it('is written right to left in Arabic, and draws the design left to right', async () => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} locale="ar-EG" onAddToBasket={() => {}} />);
    const root = document.querySelector('.cz')!;
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.getAttribute('lang')).toBe('ar-EG');
    expect(screen.queryByText('Choose a design')).toBeNull();
    for (const drawing of document.querySelectorAll('svg.cz-drawing')) expect(drawing.getAttribute('direction')).toBe('ltr');
  });

  it('keeps the shop’s own words as the shop typed them', async () => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} locale="de-DE" onAddToBasket={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Ring/ })[0]!);
    await settle();
    expect(screen.getByLabelText('Your words')).toBeTruthy();
    // The part's name and the design's are the shop's own words; the rest is German.
    expect(screen.getByText('Design: Ring')).toBeTruthy();
    expect(screen.queryByText('Make it yours')).toBeNull();
  });
});
