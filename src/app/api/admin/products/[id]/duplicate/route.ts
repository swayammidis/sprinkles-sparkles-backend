import { adminRoute } from "@/lib/api/admin-route";
import { duplicateProduct } from "@/lib/services/products";

export const POST = adminRoute<{ id: string }>("catalog:write", async (_req, { params }) => {
  const copy = await duplicateProduct(params.id);
  return Response.json({ id: copy.id }, { status: 201 });
});
