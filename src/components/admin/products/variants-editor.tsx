"use client";

import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VARIANT_TYPES, type ProductInput } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FieldHint } from "@/components/admin/shared/form-bits";

const OTHER = "__other";
const NO_IMAGE = "__none";

const EXAMPLES: Record<string, string> = {
  Size: "e.g. 6 inch",
  Weight: "e.g. 250g",
  Colour: "e.g. Pink",
  "Pack Quantity": "e.g. Pack of 12",
  Flavour: "e.g. Vanilla",
};

export function emptyVariant(): ProductInput["variants"][number] {
  return { label: "", sku: "", price: "", salePrice: "", stockQuantity: 0, weight: "", isActive: true, image: "" };
}

export function VariantsEditor() {
  const { control, setValue, getValues, formState } = useFormContext<ProductInput>();
  const { fields, append, remove, insert } = useFieldArray({ control, name: "variants", keyName: "_key" });
  const variantType = useWatch({ control, name: "variantType" });
  const isPreset = (VARIANT_TYPES as readonly string[]).includes(variantType);
  const [custom, setCustom] = useState(!isPreset && !!variantType);
  const listError = formState.errors.variants?.message ?? formState.errors.variants?.root?.message;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="variantType">What are the options?</Label>
          <Select
            value={custom ? OTHER : variantType || "Size"}
            onValueChange={(v) => {
              if (v === OTHER) {
                setCustom(true);
                setValue("variantType", "", { shouldDirty: true });
              } else {
                setCustom(false);
                setValue("variantType", v, { shouldDirty: true });
              }
            }}
          >
            <SelectTrigger id="variantType" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {VARIANT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>Something else…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {custom && (
          <div className="space-y-1.5">
            <Label htmlFor="variantTypeCustom">Option name</Label>
            <Controller
              control={control}
              name="variantType"
              render={({ field }) => <Input id="variantTypeCustom" className="h-10" placeholder="e.g. Shape" {...field} />}
            />
            <FieldError message={formState.errors.variantType?.message} />
          </div>
        )}
      </div>

      {fields.length > 0 && (
        <ul className="space-y-3" aria-label="Product options">
          {fields.map((field, index) => (
            <VariantRow
              key={field._key}
              index={index}
              typeLabel={variantType || "Option"}
              onRemove={() => remove(index)}
              onDuplicate={() => {
                const v = getValues(`variants.${index}`);
                insert(index + 1, { ...v, id: undefined, label: "", sku: "" });
              }}
            />
          ))}
        </ul>
      )}

      {listError && <FieldError message={listError} />}

      <Button type="button" variant="outline" className="h-10" onClick={() => append(emptyVariant())}>
        <Plus /> Add {variantType ? variantType.toLowerCase() : "option"}
      </Button>
      <FieldHint>The product&apos;s stock is the total of all available options.</FieldHint>
    </div>
  );
}

function VariantRow({ index, typeLabel, onRemove, onDuplicate }: { index: number; typeLabel: string; onRemove: () => void; onDuplicate: () => void }) {
  const { control, register, formState } = useFormContext<ProductInput>();
  const [more, setMore] = useState(false);
  const images = useWatch({ control, name: "images" }) ?? [];
  const label = useWatch({ control, name: `variants.${index}.label` });
  const err = formState.errors.variants?.[index];
  const p = `variants.${index}` as const;
  const hasHiddenError = !!(err?.sku || err?.weight || err?.salePrice);

  return (
    <li className="rounded-xl border bg-background p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
        <div className="space-y-1">
          <Label htmlFor={`${p}.label`}>{typeLabel}</Label>
          <Input id={`${p}.label`} className="h-10" placeholder={EXAMPLES[typeLabel] ?? "e.g. Large"} aria-invalid={!!err?.label} {...register(`${p}.label`)} />
          <FieldError message={err?.label?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.price`}>Price (₹)</Label>
          <Input id={`${p}.price`} className="h-10" inputMode="decimal" placeholder="0" aria-invalid={!!err?.price} {...register(`${p}.price`)} />
          <FieldError message={err?.price?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.stockQuantity`}>Stock</Label>
          <Input
            id={`${p}.stockQuantity`}
            className="h-10"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-invalid={!!err?.stockQuantity}
            {...register(`${p}.stockQuantity`, { valueAsNumber: true })}
          />
          <FieldError message={err?.stockQuantity?.message} />
        </div>
        <div className="flex items-end gap-1 sm:pt-6">
          <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} aria-label={`Copy ${label || `option ${index + 1}`}`}>
            <Copy />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove} aria-label={`Remove ${label || `option ${index + 1}`}`}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more || hasHiddenError}
        className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronDown className={cn("size-3.5 transition", (more || hasHiddenError) && "rotate-180")} />
        More details (SKU, sale price, weight, photo)
        {hasHiddenError && <span className="text-destructive">: needs attention</span>}
      </button>

      {(more || hasHiddenError) && (
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor={`${p}.sku`}>SKU</Label>
            <Input id={`${p}.sku`} className="h-10 font-mono text-sm" aria-invalid={!!err?.sku} {...register(`${p}.sku`)} />
            <FieldError message={err?.sku?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}.salePrice`}>Sale price (₹)</Label>
            <Input id={`${p}.salePrice`} className="h-10" inputMode="decimal" placeholder="Optional" aria-invalid={!!err?.salePrice} {...register(`${p}.salePrice`)} />
            <FieldError message={err?.salePrice?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${p}.weight`}>Weight (grams)</Label>
            <Input id={`${p}.weight`} className="h-10" inputMode="decimal" placeholder="Optional" aria-invalid={!!err?.weight} {...register(`${p}.weight`)} />
            <FieldError message={err?.weight?.message} />
          </div>
          <div className="space-y-1">
            <Label>Photo</Label>
            <Controller
              control={control}
              name={`${p}.image`}
              render={({ field }) => (
                <Select value={field.value || NO_IMAGE} onValueChange={(v) => field.onChange(v === NO_IMAGE ? "" : v)} disabled={images.length === 0}>
                  <SelectTrigger className="h-10 w-full" aria-label="Photo for this option">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NO_IMAGE}>{images.length ? "Use the main image" : "Add product images first"}</SelectItem>
                    {images.map((img, i) => (
                      <SelectItem key={img.media} value={img.media}>
                        <span className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="size-5 rounded object-cover" />
                          Image {i + 1}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Controller
            control={control}
            name={`${p}.isActive`}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Available to buy
              </label>
            )}
          />
        </div>
      )}
    </li>
  );
}
