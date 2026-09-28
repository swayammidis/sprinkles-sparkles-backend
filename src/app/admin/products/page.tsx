import Link from "next/link";
import type { Metadata } from "next";
import { ImageIcon, Package, Plus, SearchX } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { listProducts } from "@/lib/services/products";
import { taxonomyOptions } from "@/lib/services/taxonomy";
import { productListQuerySchema, type ProductListQuery } from "@/lib/validations/catalog";
import { formatPaise } from "@/lib/money";
import { timeAgo } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/shared/page-header";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { Pagination } from "@/components/admin/shared/pagination";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ProductFilters } from "@/components/admin/products/product-filters";
import { FeaturedToggle, ProductActions } from "@/components/admin/products/product-actions";
import { ProductStatusBadge, StockBadge } from "@/components/admin/products/badges";
import type { ProductListItem } from "@/lib/services/products";

export const metadata: Metadata = { title: "Products" };

function hrefWith(q: ProductListQuery, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...q, page })) {
    if (v === undefined || v === "" || (k === "page" && v === 1) || (k === "sort" && v === "newest") || (k === "pageSize" && v === 20)) continue;
    sp.set(k, String(v));
  }
  return sp.size ? `/admin/products?${sp}` : "/admin/products";
}

function Thumb({ url, name, size = "size-12" }: { url: string; name: string; size?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={`${size} shrink-0 rounded-lg border object-cover`} loading="lazy" />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground`} aria-label="No image">
      <ImageIcon className="size-4" />
    </span>
  );
}

function Price({ p }: { p: ProductListItem }) {
  if (p.hasVariants) return <span>from {formatPaise(p.effectivePrice)}</span>;
  if (p.salePrice !== null) {
    return (
      <span className="flex flex-col">
        <span className="font-medium text-brand-pink">{formatPaise(p.salePrice)}</span>
        <span className="text-xs text-muted-foreground line-through">{formatPaise(p.price)}</span>
      </span>
    );
  }
  return <span>{formatPaise(p.price)}</span>;
}

export default async function ProductsPage(props: PageProps<"/admin/products">) {
  const admin = await requireAdminPage("catalog:read");
  const q = productListQuerySchema.parse(await props.searchParams);
  const [result, options] = await Promise.all([listProducts(q), taxonomyOptions()]);
  const canWrite = hasPermission(admin.role, "catalog:write");
  const canDelete = hasPermission(admin.role, "catalog:delete");
  const filtered = Boolean(q.q || q.category || q.stock || q.status || q.featured || q.newArrival);
  const low = result.lowStockThreshold;

  return (
    <>
      <PageHeader
        title="Products"
        description={filtered ? `${result.total} product${result.total === 1 ? " matches" : "s match"} your search` : `${result.total} product${result.total === 1 ? "" : "s"} in your catalog`}
        actions={
          canWrite && (
            <Button asChild className="h-10">
              <Link href="/admin/products/new">
                <Plus /> Add product
              </Link>
            </Button>
          )
        }
      />

      {(result.total > 0 || filtered) && <ProductFilters categories={options.categories} />}

      {result.items.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No products match" description="Try a different search, or clear the filters." />
        ) : (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Start building your catalog by adding your first product."
            action={
              canWrite && (
                <Button asChild className="h-10">
                  <Link href="/admin/products/new">
                    <Plus /> Add product
                  </Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {/* Desktop / laptop: table */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Thumb url={p.image} name={p.name} size="size-11" />
                    </TableCell>
                    <TableCell className="max-w-72">
                      <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {p.sku || "No SKU yet"}
                        {p.hasVariants && ` · ${p.variantCount} option${p.variantCount === 1 ? "" : "s"}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.categoryName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <Price p={p} />
                    </TableCell>
                    <TableCell>
                      <StockBadge status={p.stockStatus} quantity={p.stockQuantity} lowThreshold={low} />
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <FeaturedToggle id={p.id} name={p.name} featured={p.featured} disabled={!canWrite} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{timeAgo(p.updatedAt)}</TableCell>
                    <TableCell>
                      <ProductActions id={p.id} name={p.name} status={p.status} canWrite={canWrite} canDelete={canDelete} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tablet / mobile: cards */}
          <ul className="divide-y lg:hidden" aria-label="Products">
            {result.items.map((p) => (
              <li key={p.id} className="flex gap-3 p-3 sm:p-4">
                <Link href={`/admin/products/${p.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
                  <Thumb url={p.image} name={p.name} size="size-16 sm:size-20" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/products/${p.id}`} className="-my-1.5 line-clamp-2 py-1.5 font-medium hover:text-primary">
                        {p.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.categoryName || "No category"} · {p.sku || "No SKU yet"}
                      </p>
                    </div>
                    <div className="-mt-1 -mr-1 flex shrink-0">
                      <FeaturedToggle id={p.id} name={p.name} featured={p.featured} disabled={!canWrite} />
                      <ProductActions id={p.id} name={p.name} status={p.status} canWrite={canWrite} canDelete={canDelete} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    <span className="font-semibold tabular-nums">
                      <Price p={p} />
                    </span>
                    <StockBadge status={p.stockStatus} quantity={p.stockQuantity} lowThreshold={low} />
                    <ProductStatusBadge status={p.status} />
                    {p.newArrival && <StatusBadge tone="pink" dot={false}>New</StatusBadge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Updated {timeAgo(p.updatedAt)}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t">
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} hrefFor={(page) => hrefWith(q, page)} noun="products" />
          </div>
        </div>
      )}
    </>
  );
}
