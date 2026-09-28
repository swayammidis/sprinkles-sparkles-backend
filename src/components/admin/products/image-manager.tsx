"use client";

import { useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Library, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/lib/utils/api-client";
import type { ProductInput } from "@/lib/validations/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedAsset } from "@/components/admin/media/upload";

const MAX_IMAGES = 20;

export function ImageManager() {
  const { control, register, setValue, getValues, formState } = useFormContext<ProductInput>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "images", keyName: "_key" });
  const watched = useWatch({ control, name: "images" });
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addAssets = (assets: UploadedAsset[]) => {
    const existing = new Set(getValues("images").map((i) => i.mediaAssetId));
    const fresh = assets.filter((a) => !existing.has(a.id));
    const room = MAX_IMAGES - getValues("images").length;
    if (fresh.length > room) toast.warning(`Only ${MAX_IMAGES} images per product.`);
    const hasPrimary = getValues("images").some((i) => i.isPrimary);
    fresh.slice(0, Math.max(0, room)).forEach((a, idx) =>
      append({ mediaAssetId: a.id, url: a.url, altText: "", isPrimary: !hasPrimary && idx === 0 }, { shouldFocus: false }),
    );
  };

  const onFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading((n) => n + list.length);
    const uploaded: UploadedAsset[] = [];
    await Promise.all(
      list.map(async (f) => {
        try {
          uploaded.push(await uploadImageFile(f, "products"));
        } catch (e) {
          toast.error(`${f.name}: ${e instanceof ApiClientError ? e.message : "upload failed"}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
    addAssets(uploaded);
  };

  const setPrimary = (index: number) => {
    getValues("images").forEach((_, i) => setValue(`images.${i}.isPrimary`, i === index, { shouldDirty: true }));
  };

  const removeAt = (index: number) => {
    const wasPrimary = getValues(`images.${index}.isPrimary`);
    const removedMedia = getValues(`images.${index}.mediaAssetId`);
    remove(index);
    if (wasPrimary && getValues("images").length > 0) setValue("images.0.isPrimary", true, { shouldDirty: true });
    // Unlink variants that used this image.
    getValues("variants").forEach((v, i) => {
      if (v.imageMediaAssetId === removedMedia) setValue(`variants.${i}.imageMediaAssetId`, "", { shouldDirty: true });
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = fields.findIndex((f) => f._key === e.active.id);
    const to = fields.findIndex((f) => f._key === e.over!.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const imagesError = formState.errors.images?.message ?? formState.errors.images?.root?.message;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          dragOver ? "border-primary bg-brand-pink-soft/50" : "border-border",
        )}
      >
        <ImagePlus className="size-6 text-muted-foreground" />
        <p className="text-sm">
          Drag &amp; drop images here, or
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload images"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
            <Library /> From library
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP, AVIF or GIF. First/starred image is the primary image.</p>
      </div>

      {imagesError && <p className="text-xs text-destructive">{imagesError}</p>}

      {fields.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f._key)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {fields.map((field, index) => (
                <SortableImage
                  key={field._key}
                  id={field._key}
                  url={field.url ?? ""}
                  isPrimary={!!watched?.[index]?.isPrimary}
                  index={index}
                  count={fields.length}
                  onPrimary={() => setPrimary(index)}
                  onRemove={() => removeAt(index)}
                  onMove={(to) => move(index, to)}
                  altInput={<Input placeholder="Alt text" className="h-7 text-xs" {...register(`images.${index}.altText`)} />}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        excludeIds={fields.map((f) => f.mediaAssetId)}
        onSelect={addAssets}
      />
    </div>
  );
}

function SortableImage({
  id,
  url,
  isPrimary,
  index,
  count,
  onPrimary,
  onRemove,
  onMove,
  altInput,
}: {
  id: string;
  url: string;
  isPrimary: boolean;
  index: number;
  count: number;
  onPrimary: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  altInput: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        isPrimary && "border-primary ring-2 ring-primary/25",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover" />
        <button
          type="button"
          className="absolute top-1.5 left-1.5 flex size-7 cursor-grab items-center justify-center rounded-md bg-background/85 text-muted-foreground shadow-sm active:cursor-grabbing"
          aria-label={`Drag to reorder image ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {isPrimary && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
            Primary
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-2">
        {altInput}
        <div className="flex items-center justify-between">
          <div className="flex">
            <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move left">
              <ArrowLeft />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move right">
              <ArrowRight />
            </Button>
          </div>
          <div className="flex">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onPrimary}
              disabled={isPrimary}
              aria-label="Set as primary image"
              title="Set as primary"
            >
              <Star className={cn(isPrimary && "fill-primary text-primary")} />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove image" className="text-destructive">
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
