/**
 * A SENTENCE WITH ITS FIGURES SET IN MONO, as the comps set them: addresses,
 * e-mail addresses, times and numbers are a mono `<bdi dir="ltr">` inside the
 * sentence, so they read left to right in an Arabic one too.
 */
import type { ReactNode } from 'react';

const FIGURE = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|www\.[^\s,)]+|\d[\d:.,–-]*\d|\d)/g;

/** The sentence cut into its words and its figures. */
export function segmentsOf(text: string): { text: string; mono: boolean }[] {
  const out: { text: string; mono: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(FIGURE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), mono: false });
    let figure = match[0];
    let trail = '';
    // A full stop or a comma after a figure belongs to the sentence.
    if (figure.length > 1 && /[.,]$/.test(figure)) {
      trail = figure.slice(-1);
      figure = figure.slice(0, -1);
    }
    out.push({ text: figure, mono: true });
    if (trail !== '') out.push({ text: trail, mono: false });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mono: false });
  return out;
}

export function Segs({ text }: { text: string }): ReactNode {
  return (
    <>
      {segmentsOf(text).map((part, index) =>
        part.mono ? (
          <bdi key={String(index)} dir="ltr" className="font-mono">
            {part.text}
          </bdi>
        ) : (
          <span key={String(index)}>{part.text}</span>
        ),
      )}
    </>
  );
}
