/**
 * A BASE'S MARKED FACES, AS ITS `faces` COLUMN KEEPS THEM: read and written
 * with no geometry in it, so the customer's editor reads a kit's faces
 * without the 3D stage's own code (`faces.ts` finds them on a model).
 */
import type { FacePlane, FaceRelief, MarkedFace, Vec } from './faces.ts';

const isVec = (value: unknown): value is Vec => Array.isArray(value) && value.length === 3 && value.every((one) => typeof one === 'number' && Number.isFinite(one));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** A plane as stored, or none when it is not one. */
function readPlane(raw: unknown): FacePlane | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const one = raw as Record<string, unknown>;
  const bounds = one['bounds'] as Record<string, unknown> | undefined;
  if (typeof one['mesh'] !== 'string') return null;
  if (!isVec(one['normal']) || !isVec(one['point']) || !isVec(one['u']) || !isVec(one['v'])) return null;
  if (bounds === undefined || !finite(bounds['u0']) || !finite(bounds['u1']) || !finite(bounds['v0']) || !finite(bounds['v1'])) return null;
  return {
    mesh: one['mesh'],
    ...(typeof one['meshName'] === 'string' && one['meshName'] !== '' ? { meshName: one['meshName'] } : {}),
    normal: one['normal'],
    point: one['point'],
    u: one['u'],
    v: one['v'],
    bounds: { u0: bounds['u0'], u1: bounds['u1'], v0: bounds['v0'], v1: bounds['v1'] },
  };
}

/** The most a printed face's words stand out or are cut in, and its smallest letter's range, as the set-up's steppers offer. */
export const RELIEF_DEPTH = { least: 0.5, most: 3, step: 0.5, start: 1 } as const;
export const RELIEF_LETTER = { least: 2, most: 12, step: 1, start: 4 } as const;

/** How the words sit on a printed face, as stored; none when it says nothing this reads. */
export function readRelief(raw: unknown): FaceRelief | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const one = raw as Record<string, unknown>;
  const mode = one['mode'] === 'cut' ? 'cut' : one['mode'] === 'raised' ? 'raised' : null;
  if (mode === null) return null;
  const depth = finite(one['depth']) ? Math.min(RELIEF_DEPTH.most, Math.max(RELIEF_DEPTH.least, one['depth'])) : RELIEF_DEPTH.start;
  const smallest = finite(one['smallest']) ? Math.min(RELIEF_LETTER.most, Math.max(RELIEF_LETTER.least, one['smallest'])) : RELIEF_LETTER.start;
  return { mode, depth, smallest };
}

/** One stored face, or none when it is not one this reads. */
export function readFace(raw: unknown): MarkedFace | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const one = raw as Record<string, unknown>;
  const bounds = one['bounds'] as Record<string, unknown> | undefined;
  const size = one['size'] as Record<string, unknown> | undefined;
  if (typeof one['code'] !== 'string' || one['code'] === '' || typeof one['mesh'] !== 'string') return null;
  if (!isVec(one['normal']) || !isVec(one['point']) || !isVec(one['u']) || !isVec(one['v'])) return null;
  if (bounds === undefined || !finite(bounds['u0']) || !finite(bounds['u1']) || !finite(bounds['v0']) || !finite(bounds['v1'])) return null;
  const relief = readRelief(one['relief']);
  const preview = readPlane(one['preview']);
  return {
    ...(relief === null ? {} : { relief }),
    ...(preview === null ? {} : { preview }),
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
      ...(face.relief === undefined ? {} : { relief: { mode: face.relief.mode, depth: round(face.relief.depth, 2), smallest: round(face.relief.smallest, 2) } }),
      ...(face.preview === undefined ? {} : { preview: planeValue(face.preview) }),
    })),
  );
}

const planeValue = (plane: FacePlane): Record<string, unknown> => ({
  mesh: plane.mesh,
  ...(plane.meshName === undefined ? {} : { meshName: plane.meshName }),
  normal: roundVec(plane.normal),
  point: roundVec(plane.point),
  u: roundVec(plane.u),
  v: roundVec(plane.v),
  bounds: { u0: round(plane.bounds.u0), u1: round(plane.bounds.u1), v0: round(plane.bounds.v0), v1: round(plane.bounds.v1) },
});
