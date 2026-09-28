import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { collectionProductsSchema } from "@/lib/validations/catalog";
import { addProductsToCollection, collectionProducts, removeProductFromCollection } from "@/lib/services/taxonomy";

type P = { id: string };

/** Products assigned to a collection. */
export const GET = adminRoute<P>("catalog:read", async (_req, { params }) => ({ products: await collectionProducts(params.id) }));

/** Add products: { productIds: [...] } */
export const POST = adminRoute<P>("catalog:write", async (req, { params }) => {
  const { productIds } = collectionProductsSchema.parse((await readJson(req)) ?? {});
  return { added: await addProductsToCollection(params.id, productIds) };
});

/** Remove one product: { productId } */
export const DELETE = adminRoute<P>("catalog:write", async (req, { params }) => {
  const { productId } = z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i) }).parse((await readJson(req)) ?? {});
  await removeProductFromCollection(params.id, productId);
  return { ok: true };
});
