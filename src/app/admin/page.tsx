import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, FolderTree, ImageOff, Package, PackageX, Plus, TrendingDown } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { CategoryBars } from "@/components/admin/dashboard/category-bars";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({
  label,
  value,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  href: string;
  accent: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</div>
    </Link>
  );
}

export default async function DashboardPage(props: PageProps<"/admin">) {
  const admin = await requireAdminPage("dashboard:view");
  const { forbidden } = await props.searchParams;
  const data = await getDashboardData();
  const { stats } = data;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${admin.name.split(" ")[0]}`}
        description="Live overview of your catalog."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> New product
            </Link>
          </Button>
        }
      />

      {forbidden && (
        <p role="alert" className="mb-4 rounded-lg bg-warning-soft px-4 py-2.5 text-sm text-warning">
          You don&apos;t have permission to open that page.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total products" value={stats.total} icon={Package} href="/admin/products" accent="bg-brand-pink-soft text-brand-pink" />
        <Stat label="Active" value={stats.active} icon={CheckCircle2} href="/admin/products?status=active" accent="bg-success-soft text-success" />
        <Stat label="Out of stock" value={stats.outOfStock} icon={PackageX} href="/admin/products?stock=out_of_stock" accent="bg-destructive/10 text-destructive" />
        <Stat label="Low stock" value={stats.lowStock} icon={TrendingDown} href="/admin/products?stock=low_stock" accent="bg-warning-soft text-warning" />
        <Stat label="Categories" value={stats.categories} icon={FolderTree} href="/admin/categories" accent="bg-brand-turquoise-soft text-brand-turquoise" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Products per category</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byCategory.length ? (
              <CategoryBars data={data.byCategory} />
            ) : (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Link href="/admin/products?status=draft" className="rounded-lg bg-muted/60 p-3 hover:bg-muted">
                <div className="text-lg font-semibold tabular-nums">{stats.draft}</div>
                <div className="text-muted-foreground">Unpublished</div>
              </Link>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                  <ImageOff className="size-4 text-muted-foreground" /> {data.attention.noImage}
                </div>
                <div className="text-muted-foreground">Without images</div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Low stock</h3>
              {data.lowStockItems.length ? (
                <ul className="divide-y text-sm">
                  {data.lowStockItems.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate hover:underline">
                        {p.name}
                        <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
                      </Link>
                      <StatusBadge tone="warning">{p.stockQuantity} left</StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing is running low.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recently updated</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length ? (
            <ul className="divide-y text-sm">
              {data.recent.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Draft"}</StatusBadge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(p.updatedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
