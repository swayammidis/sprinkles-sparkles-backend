"use client";

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { SUGGESTED_VARIANT_ATTRIBUTES, type ProductInput } from "@/lib/validations/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/admin/products/field";

const NONE = "__none";

const emptyVariant = (): ProductInput["variants"][number] => ({
  name: "",
  sku: "",
  price: "",
  salePrice: "",
  stockQuantity: 0,
  weight: "",
  active: true,
  imageMediaAssetId: "",
  attributes: [{ name: "Size", value: "" }],
});

export function VariantsEditor() {
  const { control, getValues, formState } = useFormContext<ProductInput>();
  const { fields, append, remove, move, insert } = useFieldArray({ control, name: "variants", keyName: "_key" });
  const images = useWatch({ control, name: "images" }) ?? [];
  const variantsError = formState.errors.variants?.message ?? formState.errors.variants?.root?.message;

  return (
    <div className="space-y-3">
      <datalist id="variant-attribute-names">
        {SUGGESTED_VARIANT_ATTRIBUTES.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {fields.map((field, index) => (
        <VariantCard
          key={field._key}
          index={index}
          count={fields.length}
          images={images}
          onRemove={() => remove(index)}
          onMove={(to) => move(index, to)}
          onDuplicate={() => {
            const v = getValues(`variants.${index}`);
            insert(index + 1, { ...v, id: undefined, sku: `${v.sku}-COPY`, attributes: v.attributes.map((a) => ({ ...a })) });
          }}
        />
      ))}

      {variantsError && <p className="text-xs text-destructive">{variantsError}</p>}

      <Button type="button" variant="outline" size="sm" onClick={() => append(emptyVariant())}>
        <Plus /> Add variant
      </Button>
    </div>
  );
}

function VariantCard({
  index,
  count,
  images,
  onRemove,
  onMove,
  onDuplicate,
}: {
  index: number;
  count: number;
  images: ProductInput["images"];
  onRemove: () => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
}) {
  const { control, register, formState } = useFormContext<ProductInput>();
  const attrs = useFieldArray({ control, name: `variants.${index}.attributes` });
  const err = formState.errors.variants?.[index];
  const name = useWatch({ control, name: `variants.${index}.name` });
  const p = `variants.${index}` as const;

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">
          <span className="mr-2 text-muted-foreground tabular-nums">#{index + 1}</span>
          {name || "New variant"}
        </p>
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDuplicate} aria-label="Duplicate variant">
            <Copy />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove variant" className="text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${p}.name`}>Name</Label>
          <Input id={`${p}.name`} placeholder="e.g. 250g / 8 inch / Pink" aria-invalid={!!err?.name} {...register(`${p}.name`)} />
          <FieldError message={err?.name?.message} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${p}.sku`}>SKU</Label>
          <Input id={`${p}.sku`} className="font-mono" aria-invalid={!!err?.sku} {...register(`${p}.sku`)} />
          <FieldError message={err?.sku?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.price`}>Price (₹)</Label>
          <Input id={`${p}.price`} inputMode="decimal" placeholder="0.00" aria-invalid={!!err?.price} {...register(`${p}.price`)} />
          <FieldError message={err?.price?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.salePrice`}>Sale price (₹)</Label>
          <Input id={`${p}.salePrice`} inputMode="decimal" placeholder="Optional" aria-invalid={!!err?.salePrice} {...register(`${p}.salePrice`)} />
          <FieldError message={err?.salePrice?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.stockQuantity`}>Stock</Label>
          <Input
            id={`${p}.stockQuantity`}
            type="number"
            min={0}
            step={1}
            aria-invalid={!!err?.stockQuantity}
            {...register(`${p}.stockQuantity`, { valueAsNumber: true })}
          />
          <FieldError message={err?.stockQuantity?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${p}.weight`}>Weight (g)</Label>
          <Input id={`${p}.weight`} inputMode="decimal" placeholder="Optional" aria-invalid={!!err?.weight} {...register(`${p}.weight`)} />
          <FieldError message={err?.weight?.message} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Image</Label>
          <Controller
            control={control}
            name={`${p}.imageMediaAssetId`}
            render={({ field }) => (
              <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NONE}>Use product images</SelectItem>
                  {images.map((img, i) => (
                    <SelectItem key={img.mediaAssetId} value={img.mediaAssetId}>
                      <span className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="size-5 rounded object-cover" />
                        Image {i + 1}
                        {img.altText ? ` – ${img.altText}` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={err?.imageMediaAssetId?.message} />
        </div>
        <div className="flex items-end pb-1 sm:col-span-2">
          <Controller
            control={control}
            name={`${p}.active`}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Available for sale
              </label>
            )}
          />
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Attributes</p>
        <div className="space-y-2">
          {attrs.fields.map((a, j) => (
            <div key={a.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <div>
                <Input
                  list="variant-attribute-names"
                  placeholder="Attribute (e.g. Size)"
                  className="h-8"
                  aria-label="Attribute name"
                  aria-invalid={!!err?.attributes?.[j]?.name}
                  {...register(`${p}.attributes.${j}.name`)}
                />
                <FieldError message={err?.attributes?.[j]?.name?.message} />
              </div>
              <div>
                <Input
                  placeholder="Value (e.g. 8 inch)"
                  className="h-8"
                  aria-label="Attribute value"
                  aria-invalid={!!err?.attributes?.[j]?.value}
                  {...register(`${p}.attributes.${j}.value`)}
                />
                <FieldError message={err?.attributes?.[j]?.value?.message} />
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => attrs.remove(j)} aria-label="Remove attribute">
                <X />
              </Button>
            </div>
          ))}
          {attrs.fields.length < 6 && (
            <Button type="button" variant="ghost" size="xs" onClick={() => attrs.append({ name: "", value: "" })}>
              <Plus /> Add attribute
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
