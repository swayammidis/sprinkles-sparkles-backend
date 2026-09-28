import { Award, FolderTree, Layers, PartyPopper, Tags } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { listTaxonomy } from "@/lib/services/taxonomy";
import type { TaxonomyKind } from "@/lib/validations/taxonomy";
import { PageHeader } from "@/components/admin/shared/page-header";
import { TaxonomyManager } from "@/components/admin/categories/taxonomy-manager";

const CONFIG = {
  categories: { singular: "Category", plural: "Categories", imageLabel: "Image", ordered: true, icon: FolderTree, description: "Top-level groups shown in the storefront navigation." },
  subcategories: { singular: "Subcategory", plural: "Subcategories", imageLabel: "Image", ordered: true, icon: Tags, description: "Groups inside a category. Ordered within their category." },
  brands: { singular: "Brand", plural: "Brands", imageLabel: "Logo", ordered: false, icon: Award, description: "Manufacturers and labels. Products may optionally belong to one brand." },
  collections: { singular: "Collection", plural: "Collections", imageLabel: "Banner", ordered: true, icon: Layers, description: "Curated product groups such as Diwali Collection or New Arrivals." },
  occasions: { singular: "Occasion", plural: "Occasions", imageLabel: "Image", ordered: true, icon: PartyPopper, description: "Shop-by-occasion groupings like Birthday, Rakhi or Corporate Gifting." },
} as const;

/** Server component shared by the five taxonomy admin pages. */
export async function TaxonomyPage({ kind, categoryId }: { kind: TaxonomyKind; categoryId?: string }) {
  const admin = await requireAdminPage("catalog:read");
  const cfg = CONFIG[kind];
  const [items, categories] = await Promise.all([
    listTaxonomy(kind, { categoryId }),
    kind === "subcategories"
      ? prisma.category.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={cfg.plural} description={cfg.description} />
      <TaxonomyManager
        config={{ kind, singular: cfg.singular, plural: cfg.plural, imageLabel: cfg.imageLabel, ordered: cfg.ordered, icon: cfg.icon }}
        items={items}
        categories={categories}
        categoryFilter={categoryId}
        canWrite={hasPermission(admin.role, "catalog:write")}
        canDelete={hasPermission(admin.role, "catalog:delete")}
      />
    </>
  );
}
