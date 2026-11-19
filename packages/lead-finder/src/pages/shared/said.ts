/**
 * A status line for the page's one polite region: set it, and it is said
 * once. Setting the same words again says them again.
 */
import { useRef, useState } from 'react';

export function useSaid(): [string, (words: string) => void] {
  const [said, setSaid] = useState('');
  const turn = useRef(0);
  const say = (words: string): void => {
    turn.current += 1;
    // A zero-width mark makes equal words a new value, so they are announced again.
    setSaid(turn.current % 2 === 0 ? words : `${words}​`);
  };
  return [said, say];
}
