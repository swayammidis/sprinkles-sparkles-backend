import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderTree, ImageIcon, Layers, Package, PackageX, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardStats } from "@/lib/dashboard";
import { formatPaise } from "@/lib/money";
import { timeAgo } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ProductStatusBadge } from "@/components/admin/products/badges";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, icon: Icon, accent, href, note }: { label: string; value: number; icon: typeof Package; accent: string; href: string; note?: string }) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex size-9 items-center justify-center rounded-lg ${accent}`} aria-hidden>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">{value.toLocaleString("en-IN")}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </Link>
  );
}

function Thumb({ url }: { url: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-10 shrink-0 rounded-lg border object-cover" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <ImageIcon className="size-4" />
    </span>
  );
}

export default async function DashboardPage(props: PageProps<"/admin">) {
  const admin = await requireAdminPage("dashboard:view");
  const { forbidden } = await props.searchParams;
  const s = await getDashboardStats();
  const canWrite = hasPermission(admin.role, "catalog:write");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Welcome back, {admin.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your Sprinkle &amp; Sparkle store from one place.</p>
      </div>

      {forbidden && (
        <p role="alert" className="mb-4 rounded-lg bg-warning-soft px-4 py-2.5 text-sm text-warning">
          You don&apos;t have permission to open that page. Ask a Super Admin if you need access.
        </p>
      )}

      {canWrite && (
        <section aria-labelledby="quick-actions" className="mb-6">
          <h2 id="quick-actions" className="sr-only">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap">
            <Button asChild className="h-11 sm:h-10">
              <Link href="/admin/products/new">
                <Plus /> Add product
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 sm:h-10">
              <Link href="/admin/categories?new=1">
                <Plus /> Add category
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 sm:h-10">
              <Link href="/admin/collections?new=1">
                <Plus /> Add collection
              </Link>
            </Button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Products" value={s.totalProducts} icon={Package} href="/admin/products" accent="bg-brand-pink-soft text-brand-pink" note={s.draftProducts ? `${s.draftProducts} draft${s.draftProducts === 1 ? "" : "s"}` : undefined} />
        <Stat label="Published" value={s.publishedProducts} icon={CheckCircle2} href="/admin/products?status=published" accent="bg-success-soft text-success" note="Visible on your website" />
        <Stat label="Out of stock" value={s.outOfStockProducts} icon={PackageX} href="/admin/products?stock=out_of_stock" accent="bg-destructive/10 text-destructive" />
        <Stat label="Categories" value={s.totalCategories} icon={FolderTree} href="/admin/categories" accent="bg-brand-turquoise-soft text-brand-turquoise" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Recent products</CardTitle>
            {s.totalProducts > 0 && (
              <Link href="/admin/products" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {s.recent.length ? (
              <ul className="divide-y">
                {s.recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Thumb url={p.image} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatPaise(p.price)} · updated {timeAgo(p.updatedAt)}
                      </span>
                    </div>
                    <ProductStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <p className="font-medium">No products yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Start building your catalog by adding your first product.</p>
                {canWrite && (
                  <Button asChild className="mt-4 h-10">
                    <Link href="/admin/products/new">
                      <Plus /> Add product
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Low stock
            </CardTitle>
            {s.lowStockCount > 0 && (
              <Link href="/admin/products?stock=low_stock" className="text-sm font-medium text-primary hover:underline">
                View all ({s.lowStockCount})
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {s.lowStock.length ? (
              <ul className="divide-y">
                {s.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Thumb url={p.image} />
                    <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                    <StatusBadge tone="warning">{p.stockQuantity} left</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing is running low. Products with {s.lowStockThreshold} or fewer units will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Layers className="size-3.5" aria-hidden /> Figures are live from your store database.
      </p>
    </>
  );
}
