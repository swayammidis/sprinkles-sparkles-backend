import { adminRoute, readJson } from "@/lib/api/admin-route";
import { notFound } from "@/lib/api/errors";
import { deleteProduct, getProductForEdit, patchProduct, updateProduct } from "@/lib/services/products";
import { productInputSchema, productPatchSchema } from "@/lib/validations/product";

type Params = { id: string };

export const GET = adminRoute<Params>("catalog:read", async (_req, { params }) => {
  const product = await getProductForEdit(params.id);
  if (!product) throw notFound("Product");
  return product;
});

/** Full replace from the product form. */
export const PUT = adminRoute<Params>("catalog:write", async (req, { params }) => {
  const input = productInputSchema.parse(await readJson(req));
  return updateProduct(params.id, input);
});

/** Quick toggles: publish/unpublish, featured, stock. */
export const PATCH = adminRoute<Params>("catalog:write", async (req, { params }) => {
  const patch = productPatchSchema.parse(await readJson(req));
  return patchProduct(params.id, patch);
});

export const DELETE = adminRoute<Params>("catalog:delete", async (_req, { params }) => {
  await deleteProduct(params.id);
  return { ok: true };
});
