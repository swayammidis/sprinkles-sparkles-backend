"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowUp,
  Award,
  FolderTree,
  Layers,
  PartyPopper,
  Tags,
  ChevronDown,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/utils/api-client";
import { slugify, taxonomyInputSchema, type TaxonomyInput, type TaxonomyKind } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";
import { EmptyState } from "@/components/admin/shared/empty-state";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { FieldError, FieldHint } from "@/components/admin/shared/form-bits";
import { ImageField } from "@/components/admin/media/image-field";

export type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageMedia: string;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  productCount: number;
  subcategoryCount: number;
};

export type TaxonomyConfig = {
  kind: TaxonomyKind;
  singular: string;
  plural: string;
  imageLabel: string;
  ordered: boolean;
  emptyText: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
};

/** Icons live on the client: components (functions) can't be passed from a Server Component. */
const ICONS: Record<TaxonomyKind, LucideIcon> = { categories: FolderTree, subcategories: Tags, collections: Layers, occasions: PartyPopper, brands: Award };

const ALL = "__all";
const NONE = "__none";

export function TaxonomyManager({
  config,
  items,
  categories = [],
  categoryFilter,
  canWrite,
  canDelete,
  startWithNew = false,
}: {
  config: TaxonomyConfig;
  items: TaxonomyRow[];
  categories?: { id: string; name: string }[];
  categoryFilter?: string;
  canWrite: boolean;
  canDelete: boolean;
  startWithNew?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TaxonomyRow | "new" | null>(startWithNew ? "new" : null);
  const [deleting, setDeleting] = useState<TaxonomyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const refresh = () => startTransition(() => router.refresh());
  const isSub = config.kind === "subcategories";
  const base = `/api/admin/${config.kind}`;
  const lower = config.singular.toLowerCase();

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((i) => i.name.toLowerCase().includes(term) || i.categoryName.toLowerCase().includes(term)) : items;
  }, [items, q]);

  const toggleActive = async (row: TaxonomyRow) => {
    setBusyId(row.id);
    try {
      await apiFetch(`${base}/${row.id}`, { method: "PATCH", body: { isActive: !row.isActive } });
      toast.success(row.isActive ? `${row.name} is now hidden from your website.` : `${row.name} is now visible on your website.`);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (row: TaxonomyRow, dir: -1 | 1) => {
    const group = isSub ? items.filter((i) => i.categoryId === row.categoryId) : items;
    const idx = group.findIndex((i) => i.id === row.id);
    const target = idx + dir;
    if (target < 0 || target >= group.length) return;
    const ids = group.map((i) => i.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setBusyId(row.id);
    try {
      await apiFetch(`${base}/reorder`, { method: "POST", body: { ids } });
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const blockedReason = (row: TaxonomyRow) => {
    const n = row.productCount;
    if (config.kind === "categories" && n > 0) return `This category contains ${n} product${n === 1 ? "" : "s"}. Please move ${n === 1 ? "it" : "them"} to another category before deleting it.`;
    if (config.kind === "categories" && row.subcategoryCount > 0) {
      const s = row.subcategoryCount;
      return `This category has ${s} subcategor${s === 1 ? "y" : "ies"}. Please move or delete ${s === 1 ? "it" : "them"} first.`;
    }
    if (isSub && n > 0) return `This subcategory contains ${n} product${n === 1 ? "" : "s"}. Please move ${n === 1 ? "it" : "them"} to another subcategory before deleting it.`;
    return null;
  };

  const productsLink = (row: TaxonomyRow) =>
    config.kind === "categories" ? `/admin/products?category=${row.id}` : config.kind === "collections" ? `/admin/collections/${row.id}` : null;

  const Actions = ({ row }: { row: TaxonomyRow }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`More actions for ${row.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canWrite && (
          <DropdownMenuItem onSelect={() => setEditing(row)}>
            <Pencil /> Edit
          </DropdownMenuItem>
        )}
        {config.kind === "collections" && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/collections/${row.id}`}>
              <Package /> Manage products
            </Link>
          </DropdownMenuItem>
        )}
        {config.kind === "categories" && row.productCount > 0 && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/products?category=${row.id}`}>
              <Package /> View products
            </Link>
          </DropdownMenuItem>
        )}
        {canWrite && (
          <DropdownMenuItem onSelect={() => toggleActive(row)}>
            {row.isActive ? <EyeOff /> : <Eye />} {row.isActive ? "Hide from website" : "Show on website"}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const OrderButtons = ({ row }: { row: TaxonomyRow }) => {
    const group = isSub ? items.filter((i) => i.categoryId === row.categoryId) : items;
    const gi = group.findIndex((i) => i.id === row.id);
    return (
      <div className="flex">
        <Button variant="ghost" size="icon-sm" disabled={gi === 0 || !!busyId || !!q} onClick={() => move(row, -1)} aria-label={`Move ${row.name} up`}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={gi === group.length - 1 || !!busyId || !!q} onClick={() => move(row, 1)} aria-label={`Move ${row.name} down`}>
          <ArrowDown />
        </Button>
      </div>
    );
  };

  const Thumb = ({ row, className }: { row: TaxonomyRow; className?: string }) =>
    row.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={row.image} alt="" className={cn("shrink-0 rounded-lg border object-cover", className)} />
    ) : (
      <span className={cn("flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground", className)}>
        <ImageIcon className="size-4" />
      </span>
    );

  const StatusCell = ({ row }: { row: TaxonomyRow }) => (
    <label className="inline-flex items-center gap-2">
      <Switch checked={row.isActive} disabled={!canWrite || busyId === row.id} onCheckedChange={() => toggleActive(row)} aria-label={`${row.name}: show on website`} />
      <StatusBadge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Hidden"}</StatusBadge>
    </label>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          {items.length > 0 && (
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${config.plural.toLowerCase()}…`} className="h-10 pl-9" aria-label={`Search ${config.plural.toLowerCase()}`} />
            </div>
          )}
          {isSub && (
            <Select
              value={categoryFilter || ALL}
              onValueChange={(v) => startTransition(() => router.replace(v === ALL ? "/admin/subcategories" : `/admin/subcategories?category=${v}`))}
            >
              <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Show subcategories of">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {canWrite && (
          <Button className="h-10" onClick={() => setEditing("new")} disabled={isSub && categories.length === 0}>
            <Plus /> Add {lower}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ICONS[config.kind]}
          title={`No ${config.plural.toLowerCase()} yet`}
          description={isSub && categories.length === 0 ? "Create a category first, then add subcategories inside it." : config.emptyText}
          action={
            isSub && categories.length === 0 ? (
              <Button asChild className="h-10">
                <Link href="/admin/categories?new=1">
                  <Plus /> Add category
                </Link>
              </Button>
            ) : (
              canWrite && (
                <Button className="h-10" onClick={() => setEditing("new")}>
                  <Plus /> Add {lower}
                </Button>
              )
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title={`No ${config.plural.toLowerCase()} match “${q}”`} description="Try a different search." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16">{config.imageLabel}</TableHead>
                  <TableHead>Name</TableHead>
                  {isSub && <TableHead>Category</TableHead>}
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Status</TableHead>
                  {config.ordered && canWrite && <TableHead className="w-24">Order</TableHead>}
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
                  const link = productsLink(row);
                  return (
                    <TableRow key={row.id} className={busyId === row.id ? "opacity-60" : undefined}>
                      <TableCell>
                        <Thumb row={row} className="size-11" />
                      </TableCell>
                      <TableCell className="max-w-80">
                        <button type="button" onClick={() => canWrite && setEditing(row)} className="text-left font-medium hover:text-primary hover:underline disabled:no-underline" disabled={!canWrite}>
                          {row.name}
                        </button>
                        {row.description && <p className="truncate text-xs text-muted-foreground">{row.description}</p>}
                      </TableCell>
                      {isSub && <TableCell className="text-sm">{row.categoryName}</TableCell>}
                      <TableCell className="text-right text-sm tabular-nums">
                        {link && row.productCount > 0 ? (
                          <Link href={link} className="hover:text-primary hover:underline">
                            {row.productCount}
                          </Link>
                        ) : (
                          row.productCount
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusCell row={row} />
                      </TableCell>
                      {config.ordered && canWrite && (
                        <TableCell>
                          <OrderButtons row={row} />
                        </TableCell>
                      )}
                      <TableCell>
                        <Actions row={row} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y md:hidden" aria-label={config.plural}>
            {visible.map((row) => (
              <li key={row.id} className={cn("flex gap-3 p-3", busyId === row.id && "opacity-60")}>
                <Thumb row={row} className="size-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isSub && `${row.categoryName} · `}
                        {row.productCount} product{row.productCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Actions row={row} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusCell row={row} />
                    {config.ordered && canWrite && <OrderButtons row={row} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <TaxonomyDialog
          key={editing === "new" ? "new" : editing.id}
          config={config}
          categories={categories}
          row={editing === "new" ? null : editing}
          nextOrder={items.length}
          defaultCategoryId={categoryFilter}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast.success(msg);
            setEditing(null);
            refresh();
          }}
        />
      )}

      {deleting &&
        (blockedReason(deleting) ? (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setDeleting(null)}
            title={`Can't delete “${deleting.name}” yet`}
            description={blockedReason(deleting)}
            confirmLabel={config.kind === "categories" && deleting.productCount > 0 ? "View products" : "OK"}
            destructive={false}
            onConfirm={async () => {
              if (config.kind === "categories" && deleting.productCount > 0) router.push(`/admin/products?category=${deleting.id}`);
            }}
          />
        ) : (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setDeleting(null)}
            title={`Delete this ${lower}?`}
            description={
              <>
                <p>
                  <strong>{deleting.name}</strong> will be permanently deleted.
                </p>
                {deleting.productCount > 0 && (
                  <p className="mt-2">
                    It will be removed from {deleting.productCount} product{deleting.productCount === 1 ? "" : "s"}. The products themselves are kept.
                  </p>
                )}
                <p className="mt-2">Tip: to keep it but hide it from customers, use &ldquo;Hide from website&rdquo; instead.</p>
              </>
            }
            confirmLabel={`Delete ${lower}`}
            onConfirm={async () => {
              try {
                await apiFetch(`${base}/${deleting.id}`, { method: "DELETE" });
                toast.success(`${config.singular} deleted.`);
                refresh();
              } catch (e) {
                toast.error(errorMessage(e));
                throw e;
              }
            }}
          />
        ))}
    </>
  );
}

function TaxonomyDialog({
  config,
  categories,
  row,
  nextOrder,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  config: TaxonomyConfig;
  categories: { id: string; name: string }[];
  row: TaxonomyRow | null;
  nextOrder: number;
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isSub = config.kind === "subcategories";
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(row?.image ?? "");
  const [advanced, setAdvanced] = useState(false);
  const form = useForm<TaxonomyInput>({
    resolver: zodResolver(taxonomyInputSchema),
    defaultValues: row
      ? { name: row.name, slug: row.slug, description: row.description, imageMedia: row.imageMedia, sortOrder: row.sortOrder, isActive: row.isActive, category: row.categoryId }
      : { name: "", slug: "", description: "", imageMedia: "", sortOrder: nextOrder, isActive: true, category: defaultCategoryId ?? "" },
  });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const e = formState.errors;
  const name = useWatch({ control, name: "name" });

  const onSubmit = handleSubmit(async (values) => {
    if (isSub && !values.category) {
      setError("category", { message: "Please select a parent category." });
      return;
    }
    setFormError(null);
    try {
      if (row) await apiFetch(`/api/admin/${config.kind}/${row.id}`, { method: "PUT", body: values });
      else await apiFetch(`/api/admin/${config.kind}`, { method: "POST", body: values });
      onSaved(`${config.singular} ${row ? "updated" : "created"} successfully.`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        for (const [k, m] of Object.entries(err.fieldErrors)) setError(k as FieldPath<TaxonomyInput>, { message: m });
        if (err.fieldErrors.slug) setAdvanced(true);
      }
      setFormError(errorMessage(err));
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${config.singular.toLowerCase()}` : `Add ${config.singular.toLowerCase()}`}</DialogTitle>
          <DialogDescription>{row ? "Changes appear on your website straight away." : `Create a new ${config.singular.toLowerCase()} for your shop.`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isSub && (
            <div className="space-y-1.5 rounded-lg border border-primary/30 bg-brand-pink-soft/40 p-3">
              <Label htmlFor="tx-category" className="text-sm font-semibold">
                Parent category
              </Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="tx-category" className="h-10 w-full bg-background" aria-invalid={!!e.category}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value={NONE}>Select the category this belongs to</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={e.category?.message} />
              <FieldHint>For example, &ldquo;Cake Boxes&rdquo; belongs in &ldquo;Boxes &amp; Packaging&rdquo;.</FieldHint>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-name">{config.singular} name</Label>
            <Input
              id="tx-name"
              className="h-10"
              placeholder={config.namePlaceholder}
              aria-invalid={!!e.name}
              {...register("name", {
                onChange: (ev) => {
                  if (!row && !form.getFieldState("slug").isDirty) setValue("slug", slugify(ev.target.value));
                },
              })}
            />
            <FieldError message={e.name?.message} />
          </div>

          <div className="space-y-1.5">
            <Label>{config.imageLabel}</Label>
            <ImageField
              url={imageUrl}
              folder="catalog"
              label={config.imageLabel}
              aspect={config.kind === "collections" ? "aspect-[3/1]" : config.kind === "brands" ? "aspect-[2/1]" : "aspect-video"}
              onChange={(img) => {
                setImageUrl(img?.url ?? "");
                setValue("imageMedia", img?.id ?? "", { shouldDirty: true });
              }}
            />
            <FieldError message={e.imageMedia?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Description</Label>
            <Textarea id="tx-description" rows={3} placeholder={config.descriptionPlaceholder} aria-invalid={!!e.description} {...register("description")} />
            <FieldError message={e.description?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {config.ordered && (
              <div className="space-y-1.5">
                <Label htmlFor="tx-order">Display order</Label>
                <Input id="tx-order" className="h-10" type="number" inputMode="numeric" min={0} step={1} aria-invalid={!!e.sortOrder} {...register("sortOrder", { valueAsNumber: true })} />
                <FieldError message={e.sortOrder?.message} />
                <FieldHint>Lower numbers appear first.</FieldHint>
              </div>
            )}
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-start gap-3 pt-1 sm:pt-7">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Active" />
                  <span className="text-sm">
                    <span className="block font-medium">Active</span>
                    <span className="block text-xs text-muted-foreground">Visible on your website</span>
                  </span>
                </label>
              )}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvanced((a) => !a)}
              aria-expanded={advanced}
              className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ChevronDown className={cn("size-3.5 transition", advanced && "rotate-180")} /> Web address
            </button>
            {advanced && (
              <div className="mt-2 space-y-1.5">
                <Label htmlFor="tx-slug">Web address</Label>
                <Input id="tx-slug" className="h-10 font-mono text-sm" placeholder={slugify(name ?? "")} aria-invalid={!!e.slug} {...register("slug")} />
                <FieldError message={e.slug?.message} />
                <FieldHint>Created automatically from the name. Only change it if you need to.</FieldHint>
              </div>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              Save {config.singular.toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
