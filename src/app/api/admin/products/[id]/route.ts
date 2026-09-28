import { adminRoute, ApiError } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { deleteProduct, getProductForEdit, quickUpdateProduct, updateProduct } from "@/lib/services/products";
import { productInputSchema, productQuickUpdateSchema } from "@/lib/validations/catalog";

type P = { id: string };

export const GET = adminRoute<P>("catalog:read", async (_req, { params }) => {
  const product = await getProductForEdit(params.id);
  if (!product) throw new ApiError(404, "Product not found.");
  return product;
});

/** Save from the product form. */
export const PUT = adminRoute<P>("catalog:write", async (req, { params }) => {
  const input = productInputSchema.parse((await readJson(req, 512_000)) ?? {});
  return updateProduct(params.id, input);
});

/** Quick actions from the product list: publish/unpublish, featured, new arrival. */
export const PATCH = adminRoute<P>("catalog:write", async (req, { params }) => {
  const patch = productQuickUpdateSchema.parse((await readJson(req)) ?? {});
  return quickUpdateProduct(params.id, patch);
});

export const DELETE = adminRoute<P>("catalog:delete", async (_req, { params }) => {
  await deleteProduct(params.id);
  return { ok: true };
});
