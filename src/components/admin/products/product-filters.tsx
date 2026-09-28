"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_SORTS } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";
const FILTER_KEYS = ["q", "category", "stock", "status", "featured", "newArrival"] as const;

/** Search, filters and sorting. All work happens on the server; this only updates the URL. */
export function ProductFilters({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const lastQ = useRef(params.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if (q === lastQ.current) return;
    const t = setTimeout(() => {
      lastQ.current = q;
      update({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeFilters = FILTER_KEYS.filter((k) => k !== "q" && params.get(k)).length;
  const hasAny = activeFilters > 0 || !!params.get("q");

  const select = (key: string, label: string, options: [string, string][]) => (
    <Select value={params.get(key) ?? ALL} onValueChange={(v) => update({ [key]: v })}>
      <SelectTrigger className="h-10 w-full lg:w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="h-10 pl-9"
            aria-label="Search products"
          />
          {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" />}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 lg:hidden"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls="product-filters"
          >
            <SlidersHorizontal /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
          <Select value={params.get("sort") ?? "newest"} onValueChange={(v) => update({ sort: v === "newest" ? null : v })}>
            <SelectTrigger className="h-10 flex-1 sm:w-48 sm:flex-none" aria-label="Sort products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {Object.entries(PRODUCT_SORTS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="product-filters" className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap", !showFilters && "hidden lg:flex")}>
        {select("category", "Category", [[ALL, "All categories"], ...categories.map((c) => [c.id, c.name] as [string, string])])}
        {select("stock", "Stock", [
          [ALL, "Any stock"],
          ["in_stock", "In stock"],
          ["low_stock", "Low stock"],
          ["out_of_stock", "Out of stock"],
        ])}
        {select("status", "Status", [
          [ALL, "Published & drafts"],
          ["published", "Published"],
          ["draft", "Drafts"],
        ])}
        {select("featured", "Featured", [
          [ALL, "Featured: any"],
          ["yes", "Featured"],
          ["no", "Not featured"],
        ])}
        {select("newArrival", "New arrival", [
          [ALL, "New arrival: any"],
          ["yes", "New arrivals"],
          ["no", "Not new arrivals"],
        ])}
        {hasAny && (
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => {
              setQ("");
              lastQ.current = "";
              const sort = params.get("sort");
              startTransition(() => router.replace(sort ? `${pathname}?sort=${sort}` : pathname, { scroll: false }));
            }}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
