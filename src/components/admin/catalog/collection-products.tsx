"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ImageIcon, Loader2, Package, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, errorMessage } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { ProductStatusBadge } from "@/components/admin/products/badges";

type Row = { id: string; name: string; sku: string; status: "draft" | "published"; image: string };
type Found = Row & { collectionIds: string[] };

function Thumb({ url }: { url: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-11 shrink-0 rounded-lg border object-cover" />
  ) : (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <ImageIcon className="size-4" />
    </span>
  );
}

export function CollectionProducts({ collectionId, collectionName, products, canWrite }: { collectionId: string; collectionName: string; products: Row[]; canWrite: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const remove = async (p: Row) => {
    setRemoving(p.id);
    try {
      await apiFetch(`/api/admin/collections/${collectionId}/products`, { method: "DELETE", body: { productId: p.id } });
      toast.success(`${p.name} removed from ${collectionName}.`);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"} in this collection. Only published products appear on the website.
        </p>
        {canWrite && (
          <Button className="h-10" onClick={() => setPickerOpen(true)}>
            <Plus /> Add products
          </Button>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products in this collection yet"
          description="Add products to show them together on your website."
          action={
            canWrite && (
              <Button className="h-10" onClick={() => setPickerOpen(true)}>
                <Plus /> Add products
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label={`Products in ${collectionName}`}>
          {products.map((p) => (
            <li key={p.id} className={cn("flex items-center gap-3 p-3", removing === p.id && "opacity-50")}>
              <Thumb url={p.image} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">{p.sku || "No SKU yet"}</p>
              </div>
              <ProductStatusBadge status={p.status} />
              {canWrite && (
                <Button variant="ghost" size="sm" className="h-9" disabled={removing === p.id} onClick={() => remove(p)} aria-label={`Remove ${p.name} from this collection`}>
                  <X /> <span className="hidden sm:inline">Remove</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pickerOpen && (
        <ProductPicker
          collectionId={collectionId}
          collectionName={collectionName}
          onClose={() => setPickerOpen(false)}
          onAdded={(n) => {
            toast.success(`${n} product${n === 1 ? "" : "s"} added to ${collectionName}.`);
            setPickerOpen(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </>
  );
}

function ProductPicker({ collectionId, collectionName, onClose, onAdded }: { collectionId: string; collectionName: string; onClose: () => void; onAdded: (n: number) => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ products: Found[] }>(`/api/admin/products/lookup?q=${encodeURIComponent(query)}`)
      .then((d) => !cancelled && setResults(d.products))
      .catch((e) => toast.error(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ added: number }>(`/api/admin/collections/${collectionId}/products`, { method: "POST", body: { productIds: [...selected] } });
      onAdded(res.added);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add products to {collectionName}</DialogTitle>
          <DialogDescription>Search for products and tick the ones to add.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU…" className="h-10 pl-9" aria-label="Search products" />
        </div>
        <div className="min-h-40">
          {results === null ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{query ? "No products match your search." : "No products yet."}</p>
          ) : (
            <ul className="space-y-1" aria-label="Search results">
              {results.map((p) => {
                const already = p.collectionIds.includes(collectionId);
                const isSel = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => toggle(p.id)}
                      aria-pressed={isSel}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                        isSel && "bg-brand-pink-soft",
                      )}
                    >
                      <Thumb url={p.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{already ? "Already in this collection" : p.sku || "No SKU yet"}</span>
                      </span>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", (isSel || already) && "border-primary bg-primary text-primary-foreground")}>
                        {(isSel || already) && <Check className="size-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-10" disabled={selected.size === 0 || saving} onClick={add}>
            {saving && <Loader2 className="animate-spin" />}
            Add {selected.size || ""} product{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
