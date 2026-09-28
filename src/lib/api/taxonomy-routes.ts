import "server-only";
import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { reorderSchema, statusToggleSchema, taxonomyInputSchema, type TaxonomyKind } from "@/lib/validations/catalog";
import {
  createTaxonomy,
  deleteTaxonomy,
  getTaxonomy,
  listTaxonomy,
  reorderTaxonomy,
  setTaxonomyActive,
  updateTaxonomy,
} from "@/lib/services/taxonomy";

/** Shared handlers for categories, subcategories, collections, occasions and brands. */
export function taxonomyCollectionRoutes(kind: TaxonomyKind) {
  return {
    GET: adminRoute("catalog:read", async (req) => {
      const sp = req.nextUrl.searchParams;
      return { items: await listTaxonomy(kind, { q: sp.get("q") ?? undefined, categoryId: sp.get("category") ?? undefined }) };
    }),
    POST: adminRoute("catalog:write", async (req) => {
      const input = taxonomyInputSchema.parse((await readJson(req)) ?? {});
      return Response.json({ item: await createTaxonomy(kind, input) }, { status: 201 });
    }),
  };
}

export function taxonomyItemRoutes(kind: TaxonomyKind) {
  type P = { id: string };
  return {
    GET: adminRoute<P>("catalog:read", async (_req, { params }) => ({ item: await getTaxonomy(kind, params.id) })),
    PUT: adminRoute<P>("catalog:write", async (req, { params }) => {
      const input = taxonomyInputSchema.parse((await readJson(req)) ?? {});
      return { item: await updateTaxonomy(kind, params.id, input) };
    }),
    PATCH: adminRoute<P>("catalog:write", async (req, { params }) => {
      const { isActive } = statusToggleSchema.parse((await readJson(req)) ?? {});
      return { item: await setTaxonomyActive(kind, params.id, isActive) };
    }),
    DELETE: adminRoute<P>("catalog:delete", async (_req, { params }) => {
      await deleteTaxonomy(kind, params.id);
      return { ok: true };
    }),
  };
}

export function taxonomyReorderRoute(kind: TaxonomyKind) {
  return adminRoute("catalog:write", async (req) => {
    const { ids } = reorderSchema.parse((await readJson(req)) ?? {});
    await reorderTaxonomy(kind, ids);
    return { ok: true };
  });
}
