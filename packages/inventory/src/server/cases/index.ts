/** Every worked example, in the order the actions were built. */
import { CORE_CASES } from './core.ts';
import type { Case } from './world.ts';

export const CASES: Case[] = [...CORE_CASES];
export type { Case } from './world.ts';
