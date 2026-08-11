/**
 * The contracts' Zod validators, copied from `@adminium/add-on-contracts`
 * alongside the types in `../contracts/`.
 *
 * THEY LIVE UNDER `testing/` RATHER THAN BESIDE THE TYPES for one reason: they
 * are the only part of a contract that needs a runtime dependency, and an
 * add-on's shipped bundle may take no runtime dependency the host does not
 * already have (24 D7). Nothing outside `testing/` imports this module, `zod`
 * is a devDependency, and no add-on's `dist/` contains a byte of it.
 *
 * Both contracts' validators are in one file now. Design Studio and Canva
 * Import each carried the `artwork-source@1` half — one importing it from a
 * `testing/schemas.ts`, one declaring it inline inside its conformance suite —
 * and the delivery add-on carried the `shipping-carrier@1` half. Three files,
 * one upstream.
 */

import { z } from 'zod';

// ── artwork-source@1 ────────────────────────────────────────────────────────

export const jobSpecSchema = z
  .object({
    productKey: z.string().min(1),
    productLabel: z.string().min(1),
    trimWidthMm: z.number().positive(),
    trimHeightMm: z.number().positive(),
    bleedMm: z.number().min(0),
    sides: z.union([z.literal(1), z.literal(2)]),
    quantity: z.number().int().positive(),
  })
  .strict();

export const artworkRefSchema = z
  .object({
    fileId: z.string().min(1),
    source: z.string().min(1),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    bleedMm: z.number().min(0),
    dpi: z.number().positive(),
    pages: z.number().int().positive(),
    previewFileId: z.string().min(1).optional(),
  })
  .strict();

// ── shipping-carrier@1 ──────────────────────────────────────────────────────

export const rateSchema = z
  .object({
    code: z.string().min(1),
    service: z.string().min(1),
    amount: z.number().nonnegative(),
    currency: z.string().length(3),
    estimatedDelivery: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'estimatedDelivery must be an ISO date'),
  })
  .strict();

export const shipmentSchema = z
  .object({
    id: z.string().min(1),
    tracking: z.string().min(1),
    labelFileId: z.string().min(1),
    collectionFrom: z.string().min(1),
    collectionTo: z.string().min(1),
    rate: rateSchema,
  })
  .strict();

export const trackEventSchema = z
  .object({
    at: z.string().min(1),
    place: z.string().min(1),
    status: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const parcelSchema = z
  .object({
    weightKg: z.number().positive(),
    lengthCm: z.number().positive(),
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
    contents: z.string().min(1),
  })
  .strict();

export const addressSchema = z
  .object({
    name: z.string().min(1),
    lines: z.array(z.string().min(1)).min(1),
    city: z.string().min(1),
    postcode: z.string().min(1),
    country: z.string().min(1),
  })
  .strict();

// ── product-personalizer@1 ──────────────────────────────────────────────────

export const zoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(['text-line', 'text-block', 'image', 'colour']),
    shape: z
      .object({
        type: z.enum(['rect', 'ellipse']),
        xMm: z.number(),
        yMm: z.number(),
        wMm: z.number().positive(),
        hMm: z.number().positive(),
      })
      .strict(),
    constraints: z
      .object({
        maxChars: z.number().int().positive().optional(),
        fonts: z.array(z.string().min(1)).optional(),
        minSizeMm: z.number().positive().optional(),
        maxSizeMm: z.number().positive().optional(),
        palette: z.array(z.string().min(1)).optional(),
      })
      .strict(),
    finish: z.enum(['engraved', 'raised', 'printed', 'painted']),
    perAngle: z.record(
      z.string(),
      z
        .object({
          xPct: z.number(),
          yPct: z.number(),
          wPct: z.number(),
          hPct: z.number(),
          skewDeg: z.number().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const templateSchema = z
  .object({
    productKey: z.string().min(1),
    angles: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            fileId: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    zones: z.array(zoneSchema),
  })
  .strict();

export const personalizationSchema = z
  .object({
    templateId: z.string().min(1),
    values: z.record(z.string(), z.string()),
    font: z.string().min(1).optional(),
    sizeMm: z.number().positive().optional(),
    finish: z.enum(['engraved', 'raised', 'printed', 'painted']).optional(),
  })
  .strict();
