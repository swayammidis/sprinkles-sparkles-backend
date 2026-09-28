"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/utils/api-client";
import { productInputSchema, slugify, type ProductInput } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/admin/shared/confirm-dialog";
import { FieldError, FieldHint, FormSection } from "@/components/admin/shared/form-bits";
import { ProductStatusBadge } from "@/components/admin/products/badges";
import { ImageManager } from "@/components/admin/products/image-manager";
import { TagsInput } from "@/components/admin/products/tags-input";
import { emptyVariant, VariantsEditor } from "@/components/admin/products/variants-editor";

type Option = { id: string; name: string; isActive: boolean };
export type ProductFormOptions = {
  categories: Option[];
  subcategories: (Option & { categoryId: string })[];
  brands: Option[];
  collections: Option[];
  occasions: Option[];
};

const NONE = "__none";

export const EMPTY_PRODUCT: ProductInput = {
  status: "draft",
  name: "",
  sku: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: "",
  salePrice: "",
  stockQuantity: 0,
  allowBackorder: false,
  category: "",
  subcategory: "",
  brand: "",
  collections: [],
  occasions: [],
  tags: [],
  images: [],
  hasVariants: false,
  variantType: "Size",
  variants: [],
  shipping: { weight: "", length: "", width: "", height: "" },
  featured: false,
  newArrival: false,
  bestSeller: false,
  seoTitle: "",
  seoDescription: "",
};

/** Count every leaf error so we can tell the owner how many fields need attention. */
function countErrors(errors: FieldErrors): number {
  let n = 0;
  const walk = (e: unknown) => {
    if (!e || typeof e !== "object") return;
    if ("message" in e && typeof (e as { message?: unknown }).message === "string") n++;
    for (const [k, v] of Object.entries(e)) if (k !== "ref" && k !== "message" && k !== "type") walk(v);
  };
  walk(errors);
  return n;
}

export function ProductForm({
  mode,
  productId,
  initialValues,
  options,
  canDelete,
}: {
  mode: "create" | "edit";
  productId?: string;
  initialValues: ProductInput;
  options: ProductFormOptions;
  canDelete: boolean;
}) {
  const router = useRouter();
  const form = useForm<ProductInput>({ resolver: zodResolver(productInputSchema), defaultValues: initialValues, mode: "onTouched" });
  const { control, register, handleSubmit, setValue, setError, reset, getValues, formState } = form;
  const { errors, isDirty } = formState;
  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [savedStatus, setSavedStatus] = useState(initialValues.status);

  const [name, category, hasVariants, allowBackorder, stockQuantity, seoTitle, seoDescription, slug] = useWatch({
    control,
    name: ["name", "category", "hasVariants", "allowBackorder", "stockQuantity", "seoTitle", "seoDescription", "slug"],
  });
  const subcategories = options.subcategories.filter((s) => s.categoryId === category);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const save = async (status: "draft" | "published") => {
    setValue("status", status);
    setBanner(null);
    await handleSubmit(
      async (values) => {
        setSaving(status);
        try {
          if (mode === "create") {
            const res = await apiFetch<{ id: string }>("/api/admin/products", { method: "POST", body: values });
            reset(values);
            toast.success(status === "published" ? "Product created and published." : "Draft saved.");
            router.replace(`/admin/products/${res.id}`);
          } else {
            await apiFetch(`/api/admin/products/${productId}`, { method: "PUT", body: values });
            const fresh = await apiFetch<{ values: ProductInput }>(`/api/admin/products/${productId}`);
            reset(fresh.values);
            const msg =
              status === "published" && savedStatus === "draft"
                ? "Product published. It's now visible on your website."
                : status === "draft" && savedStatus === "published"
                  ? "Product moved to drafts. It's hidden from your website."
                  : status === "draft"
                    ? "Draft saved."
                    : "Product updated successfully.";
            setSavedStatus(status);
            toast.success(msg);
            setBanner({ tone: "success", text: msg });
            router.refresh();
          }
        } catch (e) {
          setValue("status", savedStatus);
          if (e instanceof ApiClientError) {
            for (const [path, message] of Object.entries(e.fieldErrors)) setError(path as FieldPath<ProductInput>, { type: "server", message });
          }
          setBanner({ tone: "error", text: errorMessage(e) });
          toast.error(errorMessage(e));
        } finally {
          setSaving(null);
        }
      },
      (errs) => {
        setValue("status", savedStatus);
        const n = countErrors(errs);
        setBanner({ tone: "error", text: `Please fix ${n === 1 ? "the highlighted field" : `the ${n} highlighted fields`} before saving.` });
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      },
    )();
  };

  const duplicate = async () => {
    try {
      const res = await apiFetch<{ id: string }>(`/api/admin/products/${productId}/duplicate`, { method: "POST" });
      toast.success("Product duplicated as a new draft. Add a SKU before publishing it.");
      router.push(`/admin/products/${res.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const busy = saving !== null;
  const title = mode === "create" ? "Add New Product" : name || "Edit product";

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => { e.preventDefault(); void save(savedStatus === "published" ? "published" : "draft"); }} noValidate>
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/products" aria-label="Back to products">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              <div className="mt-1 flex items-center gap-2">
                <ProductStatusBadge status={savedStatus} />
                {mode === "create" && <span className="text-xs text-muted-foreground">Not saved yet</span>}
              </div>
            </div>
          </div>
          {mode === "edit" && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-10 sm:h-8" onClick={duplicate}>
                <Copy /> Duplicate
              </Button>
              {canDelete && (
                <Button type="button" variant="destructive" className="h-10 sm:h-8" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {banner && (
          <div
            role={banner.tone === "error" ? "alert" : "status"}
            className={cn(
              "mb-5 flex items-start gap-2 rounded-lg px-4 py-3 text-sm",
              banner.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success",
            )}
          >
            {banner.tone === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            {banner.text}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <FormSection id="basic" title="Basic information">
              <div className="space-y-1.5">
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  className="h-10"
                  placeholder="e.g. Rainbow Sprinkles"
                  aria-invalid={!!errors.name}
                  aria-describedby="name-hint"
                  {...register("name", {
                    onChange: (e) => {
                      if (mode === "create" && !form.getFieldState("slug").isDirty) setValue("slug", slugify(e.target.value));
                    },
                  })}
                />
                <FieldError message={errors.name?.message} />
                <FieldHint id="name-hint">Use the name customers will see on the website.</FieldHint>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">Product SKU</Label>
                <Input id="sku" className="h-10 font-mono text-sm sm:max-w-xs" placeholder="e.g. SPR-RAINBOW-100" aria-invalid={!!errors.sku} {...register("sku")} />
                <FieldError message={errors.sku?.message} />
                <FieldHint>Your own product code, used to identify stock. Needed before publishing.</FieldHint>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortDescription">Short description</Label>
                <Textarea id="shortDescription" rows={2} placeholder="One or two lines shown on product cards." aria-invalid={!!errors.shortDescription} {...register("shortDescription")} />
                <FieldError message={errors.shortDescription?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={7} placeholder="Describe the product: what it is, size, ingredients, how to use it…" aria-invalid={!!errors.description} {...register("description")} />
                <FieldError message={errors.description?.message} />
              </div>
            </FormSection>

            <FormSection id="images" title="Product images" description="Add clear product photos. The first image will be used as the main product image.">
              <ImageManager />
            </FormSection>

            <FormSection
              id="variants"
              title="Variants"
              description="Use variants when the product comes in different sizes, weights, colours or pack sizes."
            >
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Does this product have variants?</legend>
                <Controller
                  control={control}
                  name="hasVariants"
                  render={({ field }) => (
                    <div role="radiogroup" aria-label="Does this product have variants?" className="inline-flex rounded-lg border p-1">
                      {[
                        { v: false, label: "No" },
                        { v: true, label: "Yes" },
                      ].map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          role="radio"
                          aria-checked={field.value === o.v}
                          onClick={() => {
                            field.onChange(o.v);
                            if (o.v && getValues("variants").length === 0) setValue("variants", [{ ...emptyVariant(), price: getValues("price") }]);
                          }}
                          className={cn(
                            "min-w-20 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                            field.value === o.v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </fieldset>
              {hasVariants && <VariantsEditor />}
            </FormSection>

            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection id="pricing" title="Pricing">
                {hasVariants ? (
                  <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                    This product has variants, so each option has its own price. Set prices in the <strong>Variants</strong> section.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="price">Price (₹)</Label>
                      <Input id="price" className="h-10" inputMode="decimal" placeholder="e.g. 180" aria-invalid={!!errors.price} {...register("price")} />
                      <FieldError message={errors.price?.message} />
                      <FieldHint>Enter the selling price in INR.</FieldHint>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="salePrice">Sale price (₹)</Label>
                      <Input id="salePrice" className="h-10" inputMode="decimal" placeholder="Optional" aria-invalid={!!errors.salePrice} {...register("salePrice")} />
                      <FieldError message={errors.salePrice?.message} />
                      <FieldHint>Leave empty if the product is not on sale.</FieldHint>
                    </div>
                  </div>
                )}
              </FormSection>

              <FormSection id="inventory" title="Inventory">
                {hasVariants ? (
                  <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                    Stock is tracked for each option in the <strong>Variants</strong> section.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="stockQuantity">Stock quantity</Label>
                    <Input
                      id="stockQuantity"
                      className="h-10 sm:max-w-40"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      aria-invalid={!!errors.stockQuantity}
                      {...register("stockQuantity", { valueAsNumber: true })}
                    />
                    <FieldError message={errors.stockQuantity?.message} />
                    <FieldHint>How many units are currently available?</FieldHint>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Stock status</span>
                  <span className="font-medium">
                    {!hasVariants && (stockQuantity ?? 0) > 0 ? "In stock" : allowBackorder ? "Available on backorder" : hasVariants ? "Based on options" : "Out of stock"}
                  </span>
                </div>
                <Controller
                  control={control}
                  name="allowBackorder"
                  render={({ field }) => (
                    <label className="flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="block font-medium">Allow orders when out of stock</span>
                        <span className="block text-xs text-muted-foreground">Shows as &ldquo;available on backorder&rdquo;.</span>
                      </span>
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Allow orders when out of stock" />
                    </label>
                  )}
                />
              </FormSection>
            </div>

            <FormSection id="shipping" title="Shipping information" description="Used later to calculate delivery charges.">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ["weight", "Weight (grams)"],
                    ["length", "Length (cm)"],
                    ["width", "Width (cm)"],
                    ["height", "Height (cm)"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`shipping.${key}`}>{label}</Label>
                    <Input id={`shipping.${key}`} className="h-10" inputMode="decimal" aria-invalid={!!errors.shipping?.[key]} {...register(`shipping.${key}`)} />
                    <FieldError message={errors.shipping?.[key]?.message} />
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection id="seo" title="SEO" description="How this product appears in Google and when shared.">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Product web address</Label>
                <div className="flex items-center overflow-hidden rounded-lg border focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="shrink-0 border-r bg-muted px-2.5 py-2 text-xs text-muted-foreground">/products/</span>
                  <input
                    id="slug"
                    className="h-10 w-full min-w-0 bg-transparent px-2.5 font-mono text-sm outline-none"
                    placeholder={slugify(name ?? "") || "rainbow-sprinkles"}
                    aria-invalid={!!errors.slug}
                    {...register("slug")}
                  />
                </div>
                <FieldError message={errors.slug?.message} />
                <FieldHint>{slug ? "Changing this changes the product's link." : "Created automatically from the product name."}</FieldHint>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <Label htmlFor="seoTitle">SEO title</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{seoTitle?.length ?? 0}/70</span>
                </div>
                <Input id="seoTitle" className="h-10" placeholder={name || "Defaults to the product name"} aria-invalid={!!errors.seoTitle} {...register("seoTitle")} />
                <FieldError message={errors.seoTitle?.message} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <Label htmlFor="seoDescription">SEO description</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{seoDescription?.length ?? 0}/160</span>
                </div>
                <Textarea id="seoDescription" rows={3} aria-invalid={!!errors.seoDescription} {...register("seoDescription")} />
                <FieldError message={errors.seoDescription?.message} />
                <FieldHint>A short description that can appear in search engine results.</FieldHint>
              </div>
            </FormSection>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            <FormSection id="visibility" title="Store visibility">
              <div className={cn("rounded-lg p-3 text-sm", savedStatus === "published" ? "bg-success-soft text-success" : "bg-muted/60 text-muted-foreground")}>
                {savedStatus === "published" ? (
                  <span className="flex items-start gap-2">
                    <Eye className="mt-0.5 size-4 shrink-0" /> Published: customers can see this product on the website.
                  </span>
                ) : (
                  <span className="flex items-start gap-2">
                    <EyeOff className="mt-0.5 size-4 shrink-0" /> Draft: hidden from the website until you publish it.
                  </span>
                )}
              </div>
              {(
                [
                  ["featured", "Featured", "Show in featured sections on the home page"],
                  ["newArrival", "New arrival", "Show in the New Arrivals section"],
                  ["bestSeller", "Best seller", "Show a best seller badge"],
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
                    </label>
                  )}
                />
              ))}
            </FormSection>

            <FormSection id="category" title="Category" description="Where customers will find this product in the shop.">
              <div className="space-y-1.5">
                <Label htmlFor="category-select">Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? "" : v);
                        setValue("subcategory", "", { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger id="category-select" className="h-10 w-full" aria-invalid={!!errors.category}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NONE}>Select a category</SelectItem>
                        {options.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {!c.isActive && " (hidden)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.category?.message} />
                {options.categories.length === 0 && (
                  <FieldHint>
                    No categories yet.{" "}
                    <Link href="/admin/categories" className="font-medium text-primary underline-offset-2 hover:underline">
                      Add a category
                    </Link>{" "}
                    first.
                  </FieldHint>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subcategory-select">Subcategory</Label>
                <Controller
                  control={control}
                  name="subcategory"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)} disabled={!category || subcategories.length === 0}>
                      <SelectTrigger id="subcategory-select" className="h-10 w-full" aria-invalid={!!errors.subcategory}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value={NONE}>{!category ? "Choose a category first" : subcategories.length ? "No subcategory" : "This category has no subcategories"}</SelectItem>
                        {subcategories.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {!s.isActive && " (hidden)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.subcategory?.message} />
              </div>
            </FormSection>

            <FormSection id="organization" title="Product organization">
              <div className="space-y-1.5">
                <Label htmlFor="brand-select">Brand</Label>
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="brand-select" className="h-10 w-full">
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
              </div>
              <CheckList label="Collections" name="collections" items={options.collections} emptyHref="/admin/collections" />
              <CheckList label="Occasions" name="occasions" items={options.occasions} emptyHref="/admin/occasions" />
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags</Label>
                <Controller control={control} name="tags" render={({ field }) => <TagsInput id="tags" value={field.value} onChange={field.onChange} />} />
                <FieldHint>Extra words that help customers find this product, e.g. &ldquo;eggless&rdquo;, &ldquo;gold&rdquo;.</FieldHint>
              </div>
            </FormSection>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 -mb-6 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-sm text-muted-foreground sm:text-left" role="status" aria-live="polite">
              {busy ? "Saving…" : isDirty ? <span className="font-medium text-warning">You have unsaved changes</span> : mode === "edit" ? "All changes saved" : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {savedStatus === "published" && mode === "edit" ? (
                <>
                  <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={busy} onClick={() => save("draft")}>
                    {saving === "draft" ? <Loader2 className="animate-spin" /> : <EyeOff />} Unpublish
                  </Button>
                  <Button type="button" className="h-11 sm:h-9" disabled={busy} onClick={() => save("published")}>
                    {saving === "published" && <Loader2 className="animate-spin" />} Save changes
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={busy} onClick={() => save("draft")}>
                    {saving === "draft" && <Loader2 className="animate-spin" />} Save as draft
                  </Button>
                  <Button type="button" className="h-11 sm:h-9" disabled={busy} onClick={() => save("published")}>
                    {saving === "published" && <Loader2 className="animate-spin" />} Publish product
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      {mode === "edit" && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this product?"
          description={
            <>
              <p>This action will remove the product from your catalog. It can&apos;t be undone.</p>
              <p className="mt-2">Tip: to hide it from customers but keep it, use <strong>Unpublish</strong> instead.</p>
            </>
          }
          confirmLabel="Delete product"
          onConfirm={async () => {
            try {
              await apiFetch(`/api/admin/products/${productId}`, { method: "DELETE" });
              reset(getValues());
              toast.success("Product deleted.");
              router.replace("/admin/products");
            } catch (e) {
              toast.error(errorMessage(e));
              throw e;
            }
          }}
        />
      )}
    </FormProvider>
  );
}

function CheckList({ label, name, items, emptyHref }: { label: string; name: "collections" | "occasions"; items: Option[]; emptyHref: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      {items.length === 0 ? (
        <FieldHint>
          None yet.{" "}
          <Link href={emptyHref} className="font-medium text-primary underline-offset-2 hover:underline">
            Create {label.toLowerCase()}
          </Link>
        </FieldHint>
      ) : (
        <Controller
          name={name}
          render={({ field }) => {
            const value: string[] = field.value ?? [];
            return (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1.5">
                {items.map((item) => (
                  <label key={item.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-muted">
                    <Checkbox
                      checked={value.includes(item.id)}
                      onCheckedChange={(c) => field.onChange(c ? [...value, item.id] : value.filter((v) => v !== item.id))}
                    />
                    <span className="truncate">{item.name}</span>
                    {!item.isActive && <span className="text-xs text-muted-foreground">(hidden)</span>}
                  </label>
                ))}
              </div>
            );
          }}
        />
      )}
    </fieldset>
  );
}
