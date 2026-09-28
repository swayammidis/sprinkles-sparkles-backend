"use client";

import { useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Library, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/utils/api-client";
import type { ProductInput } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedImage } from "@/components/admin/media/upload";

const MAX_IMAGES = 15;

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
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addImages = (images: UploadedImage[]) => {
    const current = getValues("images");
    const existing = new Set(current.map((i) => i.media));
    const fresh = images.filter((i) => !existing.has(i.id));
    const room = MAX_IMAGES - current.length;
    if (fresh.length > room) toast.warning(`You can add up to ${MAX_IMAGES} images per product.`);
    const hasPrimary = current.some((i) => i.isPrimary);
    fresh.slice(0, Math.max(0, room)).forEach((img, n) =>
      append({ media: img.id, url: img.url, alt: "", isPrimary: !hasPrimary && n === 0 }, { shouldFocus: false }),
    );
  };

  const onFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading((n) => n + list.length);
    const done: UploadedImage[] = [];
    await Promise.all(
      list.map(async (f) => {
        try {
          done.push(await uploadImageFile(f, "products"));
        } catch (e) {
          toast.error(`${f.name}: ${errorMessage(e)}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
    if (done.length) {
      addImages(done);
      toast.success(done.length === 1 ? "Image uploaded." : `${done.length} images uploaded.`);
    }
  };

  const setPrimary = (index: number) =>
    getValues("images").forEach((_, i) => setValue(`images.${i}.isPrimary`, i === index, { shouldDirty: true }));

  const removeAt = (index: number) => {
    const wasPrimary = getValues(`images.${index}.isPrimary`);
    const media = getValues(`images.${index}.media`);
    remove(index);
    if (wasPrimary && getValues("images").length) setValue("images.0.isPrimary", true, { shouldDirty: true });
    getValues("variants").forEach((v, i) => v.image === media && setValue(`variants.${i}.image`, "", { shouldDirty: true }));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = fields.findIndex((f) => f._key === e.active.id);
    const to = fields.findIndex((f) => f._key === e.over!.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const error = formState.errors.images?.message ?? formState.errors.images?.root?.message;

  return (
    <div className="space-y-4">
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
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragOver ? "border-primary bg-brand-pink-soft/50" : "border-border",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-pink-soft text-brand-pink">
          <ImagePlus className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">
            <span className="hidden sm:inline">Drag &amp; drop product photos here</span>
            <span className="sm:hidden">Add product photos</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Recommended: clear, square product images. JPG, PNG or WebP.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" className="h-10" onClick={() => fileRef.current?.click()} disabled={uploading > 0 || fields.length >= MAX_IMAGES}>
            {uploading > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload images"}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={() => setPickerOpen(true)}>
            <Library /> Choose from library
          </Button>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      {fields.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            The <strong>main image</strong> appears first on the product card. Drag images (or use the arrows) to change the order.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={fields.map((f) => f._key)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Product images">
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
                    altInput={
                      <Input
                        placeholder="Describe this image (optional)"
                        aria-label={`Description for image ${index + 1}`}
                        className="h-9 text-xs"
                        {...register(`images.${index}.alt`)}
                      />
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} multiple excludeIds={fields.map((f) => f.media)} onSelect={addImages} />
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
      className={cn("overflow-hidden rounded-xl border bg-card", isPrimary && "border-primary ring-2 ring-primary/25", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover" />
        <button
          type="button"
          className="absolute top-1.5 left-1.5 flex size-9 cursor-grab touch-none items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm active:cursor-grabbing"
          aria-label={`Drag to reorder image ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {isPrimary && (
          <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            <Star className="size-3 fill-current" /> Main image
          </span>
        )}
      </div>
      <div className="space-y-2 p-2">
        {altInput}
        <div className="flex items-center justify-between">
          <div className="flex">
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move image ${index + 1} earlier`}>
              <ArrowLeft />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move image ${index + 1} later`}>
              <ArrowRight />
            </Button>
          </div>
          <div className="flex">
            {!isPrimary && (
              <Button type="button" variant="ghost" size="sm" onClick={onPrimary} aria-label={`Make image ${index + 1} the main image`}>
                <Star /> <span className="sr-only sm:not-sr-only">Main</span>
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={onRemove} aria-label={`Remove image ${index + 1}`}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
