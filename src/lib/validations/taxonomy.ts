import { z } from "zod";
import { imageRefField, nameField, optionalText, slugField } from "@/lib/validations/common";

/**
 * Categories, subcategories, brands, collections and occasions share one shape.
 * `image` maps to: image (category/subcategory/occasion), logo (brand), bannerImage (collection).
 */
export const taxonomyInputSchema = z.object({
  name: nameField,
  slug: slugField,
  description: optionalText(2000),
  image: imageRefField,
  active: z.boolean(),
  /** Only used by subcategories. */
  categoryId: z.string().trim().max(64),
});

export type TaxonomyInput = z.infer<typeof taxonomyInputSchema>;

export const taxonomyPatchSchema = z.object({ active: z.boolean() });

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
});

export const TAXONOMY_KINDS = ["categories", "subcategories", "brands", "collections", "occasions"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];
