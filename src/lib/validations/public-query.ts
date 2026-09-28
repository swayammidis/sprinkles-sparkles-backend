import { z } from "zod";
import { RUPEES_REGEX } from "@/lib/money";
import { SLUG_REGEX } from "@/lib/validations/catalog";

const slug = z.string().trim().max(140).regex(SLUG_REGEX).optional().catch(undefined);
const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional()
  .catch(undefined);
const rupees = z.string().trim().regex(RUPEES_REGEX).optional().catch(undefined);

/** Lenient: invalid parameters are ignored rather than failing the storefront request. */
export const publicProductQuerySchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  category: slug,
  subcategory: slug,
  brand: slug,
  collection: slug,
  occasion: slug,
  featured: bool,
  newArrival: bool,
  bestSeller: bool,
  onSale: bool,
  inStock: bool,
  minPrice: rupees,
  maxPrice: rupees,
  sort: z.enum(["newest", "price_asc", "price_desc", "name_asc", "name_desc", "featured"]).catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).catch(24).default(24),
});

export type PublicProductQuery = z.infer<typeof publicProductQuerySchema>;
