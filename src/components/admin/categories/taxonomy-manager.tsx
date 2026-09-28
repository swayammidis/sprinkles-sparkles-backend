"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ImageIcon, Loader2, MoreHorizontal, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { slugify } from "@/lib/validations/common";
import { taxonomyInputSchema, type TaxonomyInput, type TaxonomyKind } from "@/lib/validations/taxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ImageField } from "@/components/admin/media/image-field";
import { FieldError, FieldHint } from "@/components/admin/products/field";

export type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sortOrder: number;
  categoryId: string;
  categoryName: string;
  productCount: number;
  subcategoryCount: number;
};

type Config = {
  kind: TaxonomyKind;
  singular: string;
  plural: string;
  imageLabel: string;
  ordered: boolean;
  icon: LucideIcon;
};

const ALL = "__all";

export function TaxonomyManager({
  config,
  items,
  categories = [],
  canWrite,
  canDelete,
  categoryFilter,
}: {
  config: Config;
  items: TaxonomyRow[];
  categories?: { id: string; name: string }[];
  canWrite: boolean;
  canDelete: boolean;
  categoryFilter?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TaxonomyRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TaxonomyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = () => startTransition(() => router.refresh());
  const isSub = config.kind === "subcategories";
  const base = `/api/admin/${config.kind}`;

  const toggleActive = async (row: TaxonomyRow, active: boolean) => {
    setBusyId(row.id);
    try {
      await apiFetch(`${base}/${row.id}`, { method: "PATCH", body: { active } });
      toast.success(`${row.name} ${active ? "activated" : "deactivated"}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const moveRow = async (row: TaxonomyRow, dir: -1 | 1) => {
    // Subcategories are ordered within their category.
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
      toast.error(e instanceof ApiClientError ? e.message : "Reorder failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        {isSub ? (
          <Select
            value={categoryFilter || ALL}
            onValueChange={(v) =>
              startTransition(() => router.replace(v === ALL ? "/admin/subcategories" : `/admin/subcategories?categoryId=${v}`))
            }
          >
            <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Filter by category">
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
        ) : (
          <span />
        )}
        {canWrite && (
          <Button onClick={() => setEditing("new")} disabled={isSub && categories.length === 0}>
            <Plus /> New {config.singular.toLowerCase()}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={`No ${config.plural.toLowerCase()} yet`}
          description={isSub && categories.length === 0 ? "Create a category first." : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {config.ordered && canWrite && <TableHead className="w-20">Order</TableHead>}
                  <TableHead className="w-14">{config.imageLabel}</TableHead>
                  <TableHead>Name</TableHead>
                  {isSub && <TableHead>Category</TableHead>}
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const group = isSub ? items.filter((i) => i.categoryId === row.categoryId) : items;
                  const gi = group.findIndex((i) => i.id === row.id);
                  return (
                    <TableRow key={row.id} className={busyId === row.id ? "opacity-60" : undefined}>
                      {config.ordered && canWrite && (
                        <TableCell>
                          <div className="flex">
                            <Button variant="ghost" size="icon-xs" disabled={gi === 0 || !!busyId} onClick={() => moveRow(row, -1)} aria-label={`Move ${row.name} up`}>
                              <ArrowUp />
                            </Button>
                            <Button variant="ghost" size="icon-xs" disabled={gi === group.length - 1 || !!busyId} onClick={() => moveRow(row, 1)} aria-label={`Move ${row.name} down`}>
                              <ArrowDown />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.image} alt="" className="size-9 rounded-md border object-cover" />
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        {row.description && <div className="max-w-md truncate text-xs text-muted-foreground">{row.description}</div>}
                      </TableCell>
                      {isSub && <TableCell className="text-sm">{row.categoryName}</TableCell>}
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.slug}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.productCount}
                        {config.kind === "categories" && row.subcategoryCount > 0 && (
                          <div className="text-xs text-muted-foreground">{row.subcategoryCount} sub</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.active}
                          disabled={!canWrite || busyId === row.id}
                          onCheckedChange={(v) => toggleActive(row, v)}
                          aria-label={`${row.name} active`}
                        />
                      </TableCell>
                      <TableCell>
                        {(canWrite || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canWrite && (
                                <DropdownMenuItem onSelect={() => setEditing(row)}>
                                  <Pencil /> Edit
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <TaxonomyDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        config={config}
        categories={categories}
        editing={editing}
        defaultCategoryId={categoryFilter}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${config.singular.toLowerCase()}?`}
        description={
          <>
            <strong>{deleting?.name}</strong> will be permanently deleted.
            {deleting && deleting.productCount > 0 && ` It is linked to ${deleting.productCount} product(s).`}
          </>
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiFetch(`${base}/${deleting.id}`, { method: "DELETE" });
            toast.success(`${config.singular} deleted`);
            refresh();
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
            throw e;
          }
        }}
      />
    </>
  );
}

function TaxonomyDialog({
  config,
  categories,
  editing,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  config: Config;
  categories: { id: string; name: string }[];
  editing: TaxonomyRow | "new" | null;
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const row = editing && editing !== "new" ? editing : null;
  const isSub = config.kind === "subcategories";
  const [formError, setFormError] = useState<string | null>(null);

  // The parent remounts this dialog (via `key`) for each record, so defaults are computed once.
  const form = useForm<TaxonomyInput>({
    resolver: zodResolver(taxonomyInputSchema),
    defaultValues: row
      ? { name: row.name, slug: row.slug, description: row.description, image: row.image, active: row.active, categoryId: row.categoryId }
      : { name: "", slug: "", description: "", image: "", active: true, categoryId: defaultCategoryId ?? "" },
  });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const image = useWatch({ control, name: "image" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (row) await apiFetch(`/api/admin/${config.kind}/${row.id}`, { method: "PUT", body: values });
      else await apiFetch(`/api/admin/${config.kind}`, { method: "POST", body: values });
      toast.success(`${config.singular} ${row ? "updated" : "created"}`);
      onSaved();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setFormError(e.message);
        for (const [path, msgs] of Object.entries(e.fieldErrors)) {
          setError(path as FieldPath<TaxonomyInput>, { type: "server", message: msgs[0] });
        }
      } else setFormError("Network error");
    }
  });

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {row ? "Edit" : "New"} {config.singular.toLowerCase()}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isSub && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-invalid={!!formState.errors.categoryId}>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={formState.errors.categoryId?.message} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tx-name">Name</Label>
            <Input
              id="tx-name"
              aria-invalid={!!formState.errors.name}
              {...register("name", {
                // Auto-generate the slug until it is edited manually (new records only).
                onChange: (e) => {
                  if (isNew && !form.getFieldState("slug").isDirty) setValue("slug", slugify(e.target.value));
                },
              })}
            />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-slug">Slug</Label>
            <Input
              id="tx-slug"
              className="font-mono text-sm"
              aria-invalid={!!formState.errors.slug}
              {...register("slug")}
            />
            <FieldError message={formState.errors.slug?.message} />
            {row && <FieldHint>Changing the slug changes storefront URLs.</FieldHint>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Description</Label>
            <Textarea id="tx-desc" rows={3} {...register("description")} />
            <FieldError message={formState.errors.description?.message} />
          </div>
          <div className="space-y-1.5">
            <Label>{config.imageLabel}</Label>
            <ImageField
              url={image}
              folder="catalog"
              label={config.imageLabel}
              aspect={config.kind === "collections" ? "aspect-[3/1]" : config.kind === "brands" ? "aspect-[2/1]" : "aspect-video"}
              onChange={(a) => setValue("image", a?.url ?? "", { shouldDirty: true })}
            />
            <FieldError message={formState.errors.image?.message} />
          </div>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> Active (visible on storefront)
              </label>
            )}
          />
          {formError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              {row ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
