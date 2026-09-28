"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { slugify } from "@/lib/validations/common";
import { STOCK_STATUSES, STOCK_STATUS_LABELS, productInputSchema, type ProductInput } from "@/lib/validations/product";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";
import { ImageField } from "@/components/admin/media/image-field";
import { FieldError, FieldHint, FormSection } from "@/components/admin/products/field";
import { ImageManager } from "@/components/admin/products/image-manager";
import { VariantsEditor } from "@/components/admin/products/variants-editor";

type Option = { id: string; name: string; active: boolean };
export type ProductFormOptions = {
  categories: Option[];
  subcategories: (Option & { categoryId: string })[];
  brands: Option[];
  collections: Option[];
  occasions: Option[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

const NONE = "__none";

export const EMPTY_PRODUCT: ProductInput = {
  name: "",
  slug: "",
  sku: "",
  shortDescription: "",
  description: "",
  price: "",
  salePrice: "",
  stockQuantity: 0,
  stockStatus: "IN_STOCK",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  collectionIds: [],
  occasionIds: [],
  images: [],
  hasVariants: false,
  variants: [],
  weight: "",
  length: "",
  width: "",
  height: "",
  active: false,
  featured: false,
  newArrival: false,
  bestSeller: false,
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
};

export function ProductForm({
  mode,
  productId,
  initialValues,
  initialSeoImageUrl = "",
  options,
  canDelete,
}: {
  mode: "create" | "edit";
  productId?: string;
  initialValues: ProductInput;
  initialSeoImageUrl?: string;
  options: ProductFormOptions;
  canDelete: boolean;
}) {
  const router = useRouter();
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seoImageUrl, setSeoImageUrl] = useState(initialSeoImageUrl);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [name, categoryId, hasVariants, active, seoTitle, seoDescription] = useWatch({
    control,
    name: ["name", "categoryId", "hasVariants", "active", "seoTitle", "seoDescription"],
  });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const subcategories = options.subcategories.filter((s) => s.categoryId === categoryId);

  const onSubmit = handleSubmit(
    async (values) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        if (mode === "create") {
          const res = await apiFetch<{ id: string }>("/api/admin/products", { method: "POST", body: values });
          setSaveState("saved");
          toast.success("Product created");
          reset(values); // clear dirty state before navigating
          router.replace(`/admin/products/${res.id}?created=1`);
        } else {
          await apiFetch(`/api/admin/products/${productId}`, { method: "PUT", body: values });
          // Reload canonical values (new image/variant ids, server-derived stock).
          const fresh = await apiFetch<{ values: ProductInput; seoImageUrl: string }>(`/api/admin/products/${productId}`);
          reset(fresh.values);
          setSeoImageUrl(fresh.seoImageUrl);
          setSaveState("saved");
          toast.success("Saved successfully");
          router.refresh();
        }
      } catch (e) {
        setSaveState("error");
        if (e instanceof ApiClientError) {
          setSaveError(e.message);
          for (const [path, msgs] of Object.entries(e.fieldErrors)) {
            setError(path as FieldPath<ProductInput>, { type: "server", message: msgs[0] });
          }
        } else {
          setSaveError("Network error — please try again.");
        }
        toast.error("Failed to save");
      }
    },
    () => {
      setSaveState("error");
      setSaveError("Please fix the highlighted fields.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
    },
  );

  const duplicate = async () => {
    try {
      const res = await apiFetch<{ id: string }>(`/api/admin/products/${productId}/duplicate`, { method: "POST" });
      toast.success("Duplicated as a draft");
      router.push(`/admin/products/${res.id}`);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not duplicate");
    }
  };

  const status = isSubmitting || saveState === "saving" ? "saving" : isDirty ? "dirty" : saveState;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/products" aria-label="Back to products">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {mode === "create" ? "New product" : name || "Edit product"}
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Draft"}</StatusBadge>
              </div>
            </div>
          </div>
          {mode === "edit" && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={duplicate}>
                <Copy /> Duplicate
              </Button>
              {canDelete && (
                <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            <FormSection title="Basic information">
              <div className="space-y-1.5">
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  {...register("name", {
                    // Auto-generate the slug until it is edited manually (new products only).
                    onChange: (e) => {
                      if (mode === "create" && !form.getFieldState("slug").isDirty) {
                        setValue("slug", slugify(e.target.value));
                      }
                    },
                  })}
                />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    className="font-mono text-sm"
                    aria-invalid={!!errors.slug}
                    {...register("slug")}
                  />
                  <FieldError message={errors.slug?.message} />
                  <FieldHint>Used in the product URL.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" className="font-mono text-sm" aria-invalid={!!errors.sku} {...register("sku")} />
                  <FieldError message={errors.sku?.message} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortDescription">Short description</Label>
                <Textarea id="shortDescription" rows={2} aria-invalid={!!errors.shortDescription} {...register("shortDescription")} />
                <FieldError message={errors.shortDescription?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={7} aria-invalid={!!errors.description} {...register("description")} />
                <FieldError message={errors.description?.message} />
              </div>
            </FormSection>

            <FormSection title="Images" description="Drag to reorder. The starred image is shown first on the storefront.">
              <ImageManager />
            </FormSection>

            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection title="Pricing" description="Prices in INR.">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="price">Regular price (₹)</Label>
                    <Input id="price" inputMode="decimal" placeholder="0.00" aria-invalid={!!errors.price} {...register("price")} />
                    <FieldError message={errors.price?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="salePrice">Sale price (₹)</Label>
                    <Input id="salePrice" inputMode="decimal" placeholder="Optional" aria-invalid={!!errors.salePrice} {...register("salePrice")} />
                    <FieldError message={errors.salePrice?.message} />
                  </div>
                </div>
                {hasVariants && <FieldHint>With variants, customers pay the variant price. This is the base/reference price.</FieldHint>}
              </FormSection>

              <FormSection title="Inventory">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="stockQuantity">Stock quantity</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min={0}
                      step={1}
                      disabled={hasVariants}
                      aria-invalid={!!errors.stockQuantity}
                      {...register("stockQuantity", { valueAsNumber: true })}
                    />
                    <FieldError message={errors.stockQuantity?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stock status</Label>
                    <Controller
                      control={control}
                      name="stockStatus"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {STOCK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STOCK_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
                <FieldHint>
                  {hasVariants
                    ? "Stock is the total of active variants, calculated on save."
                    : "In/out of stock is set automatically from the quantity unless you choose backorder."}
                </FieldHint>
              </FormSection>
            </div>

            <FormSection
              title="Variants"
              description="Sizes, weights, colours, pack quantities — each with its own SKU, price and stock."
              aside={
                <Controller
                  control={control}
                  name="hasVariants"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Switch
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          if (v && form.getValues("variants").length === 0) {
                            form.setValue("variants", [
                              {
                                name: "",
                                sku: form.getValues("sku") ? `${form.getValues("sku")}-1` : "",
                                price: form.getValues("price"),
                                salePrice: "",
                                stockQuantity: 0,
                                weight: "",
                                active: true,
                                imageMediaAssetId: "",
                                attributes: [{ name: "Size", value: "" }],
                              },
                            ]);
                          }
                        }}
                      />
                      Enable variants
                    </label>
                  )}
                />
              }
            >
              {hasVariants ? (
                <VariantsEditor />
              ) : (
                <p className="text-sm text-muted-foreground">This product is sold as a single item.</p>
              )}
            </FormSection>

            <FormSection title="Shipping" description="Used for shipping rate calculation later.">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ["weight", "Weight (g)"],
                    ["length", "Length (cm)"],
                    ["width", "Width (cm)"],
                    ["height", "Height (cm)"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <Input id={key} inputMode="decimal" aria-invalid={!!errors[key]} {...register(key)} />
                    <FieldError message={errors[key]?.message} />
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection title="SEO" description="How this product appears in search results and link previews.">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="seoTitle">SEO title</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{seoTitle?.length ?? 0}/70</span>
                </div>
                <Input id="seoTitle" placeholder={name || "Defaults to product name"} aria-invalid={!!errors.seoTitle} {...register("seoTitle")} />
                <FieldError message={errors.seoTitle?.message} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="seoDescription">Meta description</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{seoDescription?.length ?? 0}/160</span>
                </div>
                <Textarea id="seoDescription" rows={3} aria-invalid={!!errors.seoDescription} {...register("seoDescription")} />
                <FieldError message={errors.seoDescription?.message} />
              </div>
              <div className="space-y-1.5">
                <Label>SEO image</Label>
                <ImageField
                  url={seoImageUrl}
                  folder="products"
                  label="SEO image"
                  onChange={(asset) => {
                    setSeoImageUrl(asset?.url ?? "");
                    setValue("seoImage", asset?.id ?? "", { shouldDirty: true });
                  }}
                />
                <FieldHint>Defaults to the primary product image.</FieldHint>
              </div>
            </FormSection>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            <FormSection title="Store visibility">
              {(
                [
                  ["active", "Active", "Visible on the storefront"],
                  ["featured", "Featured", "Shown in featured sections"],
                  ["newArrival", "New arrival", "Shown in new arrivals"],
                  ["bestSeller", "Best seller", "Shown with a best seller badge"],
                ] as const
              ).map(([key, label, hint]) => (
                <Controller
                  key={key}
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <label className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </label>
                  )}
                />
              ))}
            </FormSection>

            <FormSection title="Classification">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? "" : v);
                        setValue("subcategoryId", "", { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger className="w-full" aria-invalid={!!errors.categoryId}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NONE}>No category</SelectItem>
                        {options.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {!c.active && " (inactive)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.categoryId?.message} />
              </div>
              <div className="space-y-1.5">
                <Label>Subcategory</Label>
                <Controller
                  control={control}
                  name="subcategoryId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                      disabled={!categoryId || subcategories.length === 0}
                    >
                      <SelectTrigger className="w-full" aria-invalid={!!errors.subcategoryId}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NONE}>{categoryId ? "No subcategory" : "Choose a category first"}</SelectItem>
                        {subcategories.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {!s.active && " (inactive)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.subcategoryId?.message} />
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Controller
                  control={control}
                  name="brandId"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NONE}>No brand</SelectItem>
                        {options.brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.brandId?.message} />
              </div>
              <MultiCheck label="Collections" name="collectionIds" items={options.collections} error={errors.collectionIds?.message} />
              <MultiCheck label="Occasions" name="occasionIds" items={options.occasions} error={errors.occasionIds?.message} />
            </FormSection>
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 -mb-6 border-t bg-background/95 backdrop-blur sm:-mx-6 lg:-mx-8">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <SaveStatus status={status} error={saveError} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/products">Cancel</Link>
              </Button>
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" && <Loader2 className="animate-spin" />}
                {mode === "create" ? "Create product" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {mode === "edit" && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete product?"
          description="This permanently deletes the product and its variants. Images remain in the media library."
          onConfirm={async () => {
            try {
              await apiFetch(`/api/admin/products/${productId}`, { method: "DELETE" });
              reset(form.getValues());
              toast.success("Product deleted");
              router.replace("/admin/products");
            } catch (e) {
              toast.error(e instanceof ApiClientError ? e.message : "Could not delete");
              throw e;
            }
          }}
        />
      )}
    </FormProvider>
  );
}

function SaveStatus({ status, error }: { status: "idle" | "dirty" | "saving" | "saved" | "error"; error: string | null }) {
  const map = {
    idle: { icon: null, text: "No changes", cls: "text-muted-foreground" },
    dirty: { icon: <span className="size-2 rounded-full bg-warning" />, text: "Unsaved changes", cls: "text-warning" },
    saving: { icon: <Loader2 className="size-4 animate-spin" />, text: "Saving…", cls: "text-muted-foreground" },
    saved: { icon: <CheckCircle2 className="size-4" />, text: "Saved successfully", cls: "text-success" },
    error: { icon: <AlertCircle className="size-4" />, text: error ? `Failed to save — ${error}` : "Failed to save", cls: "text-destructive" },
  }[status];
  return (
    <p role="status" aria-live="polite" className={cn("flex min-w-0 items-center gap-2 text-sm font-medium", map.cls)}>
      {map.icon}
      <span className="truncate">{map.text}</span>
    </p>
  );
}

function MultiCheck({
  label,
  name,
  items,
  error,
}: {
  label: string;
  name: "collectionIds" | "occasionIds";
  items: Option[];
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None created yet.</p>
      ) : (
        <Controller
          name={name}
          render={({ field }) => {
            const value: string[] = field.value ?? [];
            return (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
                {items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={value.includes(item.id)}
                      onCheckedChange={(c) =>
                        field.onChange(c ? [...value, item.id] : value.filter((v) => v !== item.id))
                      }
                    />
                    <span className="truncate">{item.name}</span>
                    {!item.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                  </label>
                ))}
              </div>
            );
          }}
        />
      )}
      <FieldError message={error} />
    </div>
  );
}
