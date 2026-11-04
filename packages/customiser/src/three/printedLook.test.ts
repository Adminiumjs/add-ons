// @vitest-environment jsdom
/**
 * A PRINTED ITEM'S WORDS ON THE STAGE, STOOD UP OR SUNK: on the item made
 * from its size (the sample keyring) and on the shop's preview model's
 * marked face. Raised, they are slices up to the depth, the top in the
 * plastic's colour and the sides darker; cut in, one darker floor. Whatever
 * they hold is let go of with the model.
 */
import { Box3, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { darker, sliceCount } from './look.ts';
import { buildPiece, disposeBuilt, sameBody, type PieceModel } from './piece.ts';
import { boxModel, buildModel, disposeModel, dress, type ShopModel } from './shopModel.ts';

const mask = (): HTMLCanvasElement => document.createElement('canvas');

const keyring = (relief?: PieceModel['relief']): PieceModel => ({ width: 56, height: 24, corner: 11, thickness: 4, outline: null, face: '#d9822b', edge: '#b86a1f', top: null, ...(relief === undefined ? {} : { relief }) });

/** Spies on every dispose a built thing holds, so a test can count what was let go of. */
function watch(things: readonly (BufferGeometry | Material | Texture)[]): () => number {
  const spies = things.map((one) => vi.spyOn(one, 'dispose'));
  return () => spies.filter((spy) => spy.mock.calls.length > 0).length;
}

describe('the sample keyring, made from its size', () => {
  it('stands its words up in slices to the depth: the top slice in the plastic’s colour, the sides darker', () => {
    const built = buildPiece(keyring({ mode: 'raised', depth: 1, mask: mask() }));
    const slices = built.group.children.filter((one): one is Mesh => (one as Mesh).isMesh === true && one.name.startsWith('raised'));
    expect(slices).toHaveLength(sliceCount(1));
    expect(sliceCount(1)).toBe(5);
    expect((slices.at(-1)!.material as MeshStandardMaterial).color.getHexString()).toBe('d9822b');
    expect((slices[0]!.material as MeshStandardMaterial).color.getHexString()).toBe(darker('#d9822b', 0.25).slice(1));
    // The top slice is the depth above the top face: 2 + 1 mm, and the item is still 56 × 24.
    const box = new Box3().setFromObject(slices.at(-1)!);
    expect(box.max.z).toBeCloseTo(2 + 0.02 + 1, 5);
    const disposed = watch([...built.geometries, ...built.materials, ...built.textures]);
    const count = built.geometries.length + built.materials.length + built.textures.length;
    disposeBuilt(built);
    expect(disposed()).toBe(count);
  });

  it('sinks cut-in words as one darker floor on the top', () => {
    const built = buildPiece(keyring({ mode: 'cut', depth: 1, mask: mask() }));
    const floors = built.group.children.filter((one) => one.name === 'cut');
    expect(floors).toHaveLength(1);
    expect(((floors[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(darker('#d9822b', 0.4).slice(1));
    disposeBuilt(built);
  });

  it('is built again for each new design: its words are its body', () => {
    expect(sameBody(keyring(), keyring())).toBe(true);
    expect(sameBody(keyring({ mode: 'raised', depth: 1, mask: null }), keyring({ mode: 'raised', depth: 1, mask: null }))).toBe(false);
  });
});

describe('the shop’s preview model', () => {
  const face = { mesh: '0', normal: [0, 1, 0] as const, point: [-0.028, 0.002, -0.012] as const, u: [1, 0, 0] as const, v: [0, 0, 1] as const, bounds: { u0: 0, u1: 0.056, v0: 0, v1: 0.024 } };

  it('stands the words up from the marked face by the depth in its units, and lets them go', () => {
    const built = buildModel('keyring', boxModel(0.056, 0.004, 0.024));
    const model: ShopModel = { kind: 'model', file: 'glb', key: 'keyring', bytes: new ArrayBuffer(0), decals: [{ code: 'front', plane: face, canvas: mask(), width: 56, height: 24, relief: { mode: 'raised', depth: 0.001, depthMm: 1, colour: '#d9822b' } }] };
    dress(built, model);
    expect(built.decals.children).toHaveLength(5);
    const heights = built.decals.children.map((one) => Math.round(one.position.y * 1e6));
    expect(Math.max(...heights) - Math.min(...heights)).toBe(800);
    for (const one of built.decals.children) expect(one.userData).toMatchObject({ code: 'front', width: 56, height: 24 });
    const disposed = watch([...built.dressing.geometries, ...built.dressing.materials, ...built.dressing.textures]);
    const count = built.dressing.geometries.length + built.dressing.materials.length + built.dressing.textures.length;
    disposeModel(built);
    expect(disposed()).toBe(count);
    expect(built.decals.children).toHaveLength(0);
  });

  it('sinks cut-in words as one darker sheet on the face', () => {
    const built = buildModel('keyring', boxModel(0.056, 0.004, 0.024));
    dress(built, { kind: 'model', file: 'glb', key: 'keyring', bytes: new ArrayBuffer(0), decals: [{ code: 'front', plane: face, canvas: mask(), width: 56, height: 24, relief: { mode: 'cut', depth: 0.001, depthMm: 1, colour: '#d9822b' } }] });
    expect(built.decals.children).toHaveLength(1);
    expect(((built.decals.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(darker('#d9822b', 0.4).slice(1));
    disposeModel(built);
  });
});
