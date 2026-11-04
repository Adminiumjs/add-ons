/**
 * THE EDITOR'S NAMES FOR THINGS: a motif by its code, a new part by the tool
 * that adds it, a part's kind as the panel heads it. Each sentence is written
 * once, here, beside its key.
 */
import type { AddOnTranslate } from '../shared/host.ts';
import type { PartKind } from '../../draw/parts.ts';
import type { Tool } from './draft.ts';

/** A motif's name (Birch Row's list); a code this does not know is shown as it is. */
export function motifName(t: AddOnTranslate, code: string): string {
  switch (code) {
    case 'sprout':
      return t('designs.motif.sprout', 'Sprig');
    case 'leaf':
      return t('designs.motif.leaf', 'Oak leaf');
    case 'wheat':
      return t('designs.motif.wheat', 'Wheat');
    case 'moon':
      return t('designs.motif.moon', 'Moon');
    case 'star':
      return t('designs.motif.star', 'Star');
    case 'lamp':
      return t('designs.motif.lamp', 'Lamp');
    case 'heart':
      return t('designs.motif.heart', 'Heart');
    case 'library':
      return t('designs.motif.library', 'Books');
    case 'book-open':
      return t('designs.motif.bookOpen', 'Open book');
    default:
      return code;
  }
}

/** What a new part is called, the words it starts with, and what a new shape says it is. */
export function partWords(t: AddOnTranslate, tool: Tool, page: boolean): { name: string; sample: string; says: string } {
  const sample = page ? t('designs.new.samplePage', 'Your words here') : t('designs.new.sample', 'Your words');
  const says = t('designs.new.frameSays', 'Engraved frame, 1 mm');
  switch (tool) {
    case 'logo':
      return { name: page ? t('designs.new.logo', 'Logo') : t('designs.new.logoBox', 'Logo box'), sample, says };
    case 'motif':
      return { name: t('designs.new.motif', 'Motif'), sample, says };
    case 'shape':
      return { name: t('designs.new.frame', 'Frame'), sample, says };
    case 'rect':
      return { name: t('designs.tool.rect', 'Rectangle'), sample, says };
    case 'ellipse':
      return { name: t('designs.tool.ellipse', 'Ellipse'), sample, says };
    case 'line':
      return { name: t('designs.tool.line', 'Line'), sample, says };
    default:
      return { name: page ? t('designs.new.textPage', 'Text') : t('designs.new.text', 'New text'), sample, says };
  }
}

/** The panel's word for a part's kind (Birch Row's TEXT, LOGO BOX, MOTIF, SHAPE, COLOUR). */
export function kindName(t: AddOnTranslate, kind: PartKind, alsoLogo: boolean): string {
  switch (kind) {
    case 'picture':
      return t('designs.kind.logo', 'LOGO BOX');
    case 'choice':
      return t('designs.kind.motif', 'MOTIF');
    case 'shape':
      return t('designs.kind.shape', 'SHAPE');
    case 'colour':
      return t('designs.kind.colour', 'COLOUR');
    default:
      return alsoLogo ? t('designs.kind.either', 'WORDS OR A LOGO') : t('designs.kind.text', 'TEXT');
  }
}
