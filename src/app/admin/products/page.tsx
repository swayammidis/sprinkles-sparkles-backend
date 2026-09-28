import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageIcon, Package, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { listProducts } from "@/lib/services/products";
import { productListQuerySchema, LOW_STOCK_THRESHOLD, type ProductListQuery } from "@/lib/validations/product";
import { formatDate, formatINR } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/shared/page-header";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { Pagination } from "@/components/admin/shared/pagination";
import { StatusBadge, stockTone } from "@/components/admin/shared/status-badge";
import { ProductFilters } from "@/components/admin/products/product-filters";
import { FeaturedToggle, ProductRowActions } from "@/components/admin/products/product-row-actions";

export const metadata: Metadata = { title: "Products" };

function toSearch(q: ProductListQuery, patch: Partial<Record<keyof ProductListQuery, string | number | undefined>>) {
  const merged = { ...q, ...patch } as Record<string, unknown>;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || v === null) continue;
    if ((k === "page" && v === 1) || (k === "sort" && v === "updatedAt") || (k === "dir" && v === "desc") || (k === "pageSize" && v === 20)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `/admin/products?${s}` : "/admin/products";
}

function SortHeader({ q, field, children, className }: { q: ProductListQuery; field: ProductListQuery["sort"]; children: React.ReactNode; className?: string }) {
  const active = q.sort === field;
  const nextDir = active && q.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : q.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (q.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={toSearch(q, { sort: field, dir: nextDir, page: 1 })} scroll={false} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-40"}`} />
      </Link>
    </TableHead>
  );
}

export default async function ProductsPage(props: PageProps<"/admin/products">) {
  const admin = await requireAdminPage("catalog:read");
  const q = productListQuerySchema.parse(await props.searchParams);
  const [result, categories] = await Promise.all([
    listProducts(q),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const canWrite = hasPermission(admin.role, "catalog:write");
  const canDelete = hasPermission(admin.role, "catalog:delete");
  const filtered = Boolean(q.q || q.categoryId || q.stock || q.status || q.featured);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${result.total} product${result.total === 1 ? "" : "s"}${filtered ? " match your filters" : " in the catalog"}`}
        actions={
          canWrite && (
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus /> New product
              </Link>
            </Button>
          )
        }
      />
      <ProductFilters categories={categories} />

      {result.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filtered ? "No products match these filters" : "No products yet"}
          description={filtered ? "Try a different search or clear the filters." : "Create your first product to start building the catalog."}
          action={
            !filtered && canWrite ? (
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus /> New product
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16">Image</TableHead>
                  <SortHeader q={q} field="name">Product</SortHeader>
                  <SortHeader q={q} field="sku">SKU</SortHeader>
                  <TableHead>Category</TableHead>
                  <SortHeader q={q} field="price" className="text-right">Price</SortHeader>
                  <SortHeader q={q} field="stockQuantity">Stock</SortHeader>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <SortHeader q={q} field="updatedAt">Updated</SortHeader>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((p) => {
                  const stock = stockTone(p.stockStatus, p.stockQuantity, LOW_STOCK_THRESHOLD);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image.url} alt={p.image.altText ?? ""} className="size-10 rounded-md border object-cover" loading="lazy" />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-72">
                        <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-primary">
                          {p.name}
                        </Link>
                        {p.hasVariants && (
                          <span className="text-xs text-muted-foreground">
                            {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="text-sm">{p.category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.salePrice ? (
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-brand-pink">{formatINR(p.salePrice)}</span>
                            <span className="text-xs text-muted-foreground line-through">{formatINR(p.price)}</span>
                          </div>
                        ) : (
                          formatINR(p.price)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-right tabular-nums">{p.stockQuantity}</span>
                          <StatusBadge tone={stock.tone}>{stock.label}</StatusBadge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Draft"}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <FeaturedToggle id={p.id} featured={p.featured} disabled={!canWrite} />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</TableCell>
                      <TableCell>
                        <ProductRowActions id={p.id} name={p.name} active={p.active} canWrite={canWrite} canDelete={canDelete} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            hrefFor={(page) => toSearch(q, { page })}
          />
        </div>
      )}
    </>
  );
}
