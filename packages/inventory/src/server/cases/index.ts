/** Every worked example, in the order the actions were built. */
import { CORE_CASES } from './core.ts';
import { STOCK_CASES } from './stock.ts';
import type { Case } from './world.ts';

export const CASES: Case[] = [...CORE_CASES, ...STOCK_CASES];
export type { Case } from './world.ts';
