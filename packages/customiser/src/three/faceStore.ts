/**
 * A BASE'S MARKED FACES, AS ITS `faces` COLUMN KEEPS THEM: read and written
 * with no geometry in it, so the customer's editor reads a kit's faces
 * without the 3D stage's own code (`faces.ts` finds them on a model).
 */
import type { MarkedFace, Vec } from './faces.ts';

const isVec = (value: unknown): value is Vec => Array.isArray(value) && value.length === 3 && value.every((one) => typeof one === 'number' && Number.isFinite(one));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** One stored face, or none when it is not one this reads. */
export function readFace(raw: unknown): MarkedFace | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const one = raw as Record<string, unknown>;
  const bounds = one['bounds'] as Record<string, unknown> | undefined;
  const size = one['size'] as Record<string, unknown> | undefined;
  if (typeof one['code'] !== 'string' || one['code'] === '' || typeof one['mesh'] !== 'string') return null;
  if (!isVec(one['normal']) || !isVec(one['point']) || !isVec(one['u']) || !isVec(one['v'])) return null;
  if (bounds === undefined || !finite(bounds['u0']) || !finite(bounds['u1']) || !finite(bounds['v0']) || !finite(bounds['v1'])) return null;
  return {
    code: one['code'],
    name: typeof one['name'] === 'string' ? one['name'] : one['code'],
    piece: one['piece'] === null || one['piece'] === undefined || one['piece'] === '' ? null : String(one['piece']),
    mesh: one['mesh'],
    ...(typeof one['meshName'] === 'string' && one['meshName'] !== '' ? { meshName: one['meshName'] } : {}),
    normal: one['normal'],
    point: one['point'],
    u: one['u'],
    v: one['v'],
    bounds: { u0: bounds['u0'], u1: bounds['u1'], v0: bounds['v0'], v1: bounds['v1'] },
    size: { w: finite(size?.['w']) ? size['w'] : 0, h: finite(size?.['h']) ? size['h'] : 0 },
  };
}

/** A base's marked faces, from its `faces` column (text or parsed JSON); a face it cannot read is left out. */
export function facesOf(value: unknown): MarkedFace[] {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  const list = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>)['faces']) ? ((raw as Record<string, unknown>)['faces'] as unknown[]) : [];
  return list.map(readFace).filter((one): one is MarkedFace => one !== null);
}

const round = (value: number, places = 6): number => Math.round(value * 10 ** places) / 10 ** places;
const roundVec = (a: Vec): Vec => [round(a[0]), round(a[1]), round(a[2])];

/** The faces as the column keeps them: numbers rounded to a millionth, so a save and a read give back the same plane. */
export function facesValue(faces: readonly MarkedFace[]): string {
  return JSON.stringify(
    faces.map((face) => ({
      code: face.code,
      name: face.name,
      piece: face.piece,
      mesh: face.mesh,
      ...(face.meshName === undefined ? {} : { meshName: face.meshName }),
      normal: roundVec(face.normal),
      point: roundVec(face.point),
      u: roundVec(face.u),
      v: roundVec(face.v),
      bounds: { u0: round(face.bounds.u0), u1: round(face.bounds.u1), v0: round(face.bounds.v0), v1: round(face.bounds.v1) },
      size: { w: round(face.size.w, 1), h: round(face.size.h, 1) },
    })),
  );
}
