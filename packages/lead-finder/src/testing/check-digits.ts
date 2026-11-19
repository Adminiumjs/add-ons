/**
 * THE REGISTERS' CHECK DIGITS, so a test can prove a sample number belongs to
 * nobody: a real SIREN passes Luhn, a real Norwegian organisation number
 * passes mod-11 (weights 3 2 7 6 5 4 3 2), and a real UK company number is
 * never in the unallocated `98` block.
 */

/** Whether nine digits pass Luhn, as every real SIREN does. */
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  [...digits].reverse().forEach((digit, i) => {
    let n = Number(digit);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  });
  return sum % 10 === 0;
}

/** Whether nine digits pass Norway's mod-11, as every real organisation number does. */
export function passesMod11(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, i) => total + weight * Number(digits[i]), 0);
  const check = (11 - (sum % 11)) % 11;
  return check !== 10 && check === Number(digits[8]);
}

/** Whether a UK company number is in the block Companies House has not given out. */
export function inUnallocatedUkBlock(number: string): boolean {
  return /^98\d{6}$/.test(number);
}

/** `count` nine-digit numbers from `start` that fail a check: made-up numbers for a page of fixtures. */
export function failing(start: number, count: number, passes: (digits: string) => boolean): string[] {
  const out: string[] = [];
  for (let n = start; out.length < count; n += 1) if (!passes(String(n))) out.push(String(n));
  return out;
}
