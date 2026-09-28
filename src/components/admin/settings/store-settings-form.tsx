"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/utils/api-client";
import { storeSettingsSchema, type StoreSettingsInput } from "@/lib/validations/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint, FormSection } from "@/components/admin/shared/form-bits";

export function StoreSettingsForm({ initial }: { initial: StoreSettingsInput }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const form = useForm<StoreSettingsInput>({ resolver: zodResolver(storeSettingsSchema), defaultValues: initial, mode: "onTouched" });
  const { register, handleSubmit, setError, reset, formState } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(
    async (values) => {
      setSaving(true);
      try {
        const res = await apiFetch<{ settings: StoreSettingsInput }>("/api/admin/settings", { method: "PUT", body: values });
        reset(res.settings);
        toast.success("Settings saved.");
        router.refresh();
      } catch (err) {
        if (err instanceof ApiClientError) for (const [k, m] of Object.entries(err.fieldErrors)) setError(k as FieldPath<StoreSettingsInput>, { message: m });
        toast.error(errorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    () => {
      toast.error("Please fix the highlighted fields.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
    },
  );

  const field = (name: FieldPath<StoreSettingsInput>, label: string, opts: { placeholder?: string; type?: string; hint?: string; inputMode?: "tel" | "email" | "url" | "numeric" } = {}) => {
    const err = name.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], e) as { message?: string } | undefined;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          className="h-10"
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          placeholder={opts.placeholder}
          aria-invalid={!!err?.message}
          {...register(name, name === "lowStockThreshold" ? { valueAsNumber: true } : undefined)}
        />
        <FieldError message={err?.message} />
        {opts.hint && <FieldHint>{opts.hint}</FieldHint>}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormSection title="Store information" description="Shown on your website (header, footer and contact page).">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("storeName", "Store name")}
          {field("tagline", "Tagline", { placeholder: "The Cake Decor Shop" })}
        </div>
      </FormSection>

      <FormSection title="Contact information">
        <div className="grid gap-4 sm:grid-cols-3">
          {field("email", "Email", { type: "email", inputMode: "email", placeholder: "hello@example.com" })}
          {field("phone", "Phone", { inputMode: "tel", placeholder: "+91 98765 43210" })}
          {field("whatsapp", "WhatsApp", { inputMode: "tel", placeholder: "+91 98765 43210" })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("address.line1", "Address line 1")}
          {field("address.line2", "Address line 2")}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {field("address.city", "City")}
          {field("address.state", "State")}
          {field("address.postalCode", "PIN code", { inputMode: "numeric" })}
          {field("address.country", "Country")}
        </div>
      </FormSection>

      <FormSection title="Social links" description="Paste the full link to each profile. Leave empty to hide it.">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("social.instagram", "Instagram", { inputMode: "url", placeholder: "https://instagram.com/yourstore" })}
          {field("social.facebook", "Facebook", { inputMode: "url", placeholder: "https://facebook.com/yourstore" })}
          {field("social.youtube", "YouTube", { inputMode: "url", placeholder: "https://youtube.com/@yourstore" })}
          {field("social.pinterest", "Pinterest", { inputMode: "url", placeholder: "https://pinterest.com/yourstore" })}
        </div>
      </FormSection>

      <FormSection title="Store preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <p className="flex h-10 items-center rounded-lg border bg-muted/40 px-3 text-sm">Indian Rupee (₹ INR)</p>
          </div>
          {field("lowStockThreshold", "Low stock alert level", { type: "number", inputMode: "numeric", hint: "Products at or below this number show as “low stock” on the dashboard." })}
        </div>
      </FormSection>

      <div className="sticky bottom-0 z-20 -mx-4 -mb-5 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Save settings
        </Button>
      </div>
    </form>
  );
}
