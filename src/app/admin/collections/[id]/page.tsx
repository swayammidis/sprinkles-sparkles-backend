import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { collectionProducts, getTaxonomy } from "@/lib/services/taxonomy";
import { ApiError } from "@/lib/api/admin-route";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { CollectionProducts } from "@/components/admin/catalog/collection-products";

export const metadata: Metadata = { title: "Collection products" };

export default async function CollectionDetailPage(props: PageProps<"/admin/collections/[id]">) {
  const admin = await requireAdminPage("catalog:read");
  const { id } = await props.params;
  const collection = await getTaxonomy("collections", id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!collection) notFound();
  const products = await collectionProducts(id);

  return (
    <>
      <div className="mb-6 flex items-start gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/collections" aria-label="Back to collections">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{collection.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge tone={collection.isActive ? "success" : "neutral"}>{collection.isActive ? "Active" : "Hidden"}</StatusBadge>
            {collection.description && <span className="text-sm text-muted-foreground">{collection.description}</span>}
          </div>
        </div>
      </div>
      {collection.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={collection.image} alt="" className="mb-6 aspect-[3/1] w-full max-w-3xl rounded-xl border object-cover" />
      )}
      <CollectionProducts collectionId={id} collectionName={collection.name} products={products} canWrite={hasPermission(admin.role, "catalog:write")} />
    </>
  );
}
