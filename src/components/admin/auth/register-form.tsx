"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Mail, User } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/admin/auth/password-input";

type Field = keyof RegisterInput;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setError("Network error. Please try again.");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
    if (res.ok) {
      router.replace("/login?reason=registered");
      return;
    }
    setError(data.error ?? "Something went wrong. Please try again.");
    for (const [key, message] of Object.entries(data.fieldErrors ?? {})) {
      setFieldError(key as Field, { message });
    }
    if (res.status === 403 && data.error?.includes("restricted")) router.refresh();
  });

  const aria = (f: Field) => ({ "aria-invalid": !!errors[f], "aria-describedby": errors[f] ? `${f}-error` : undefined });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="name" autoComplete="name" autoFocus className="h-10 pl-9" disabled={isSubmitting} {...aria("name")} {...register("name")} />
        </div>
        <FieldError id="name-error" message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            className="h-10 pl-9"
            disabled={isSubmitting}
            {...aria("email")}
            {...register("email")}
          />
        </div>
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="new-password" disabled={isSubmitting} {...aria("password")} {...register("password")} />
        {errors.password ? (
          <FieldError id="password-error" message={errors.password.message} />
        ) : (
          <p className="text-xs text-muted-foreground">At least 8 characters, with upper- and lower-case letters and a number.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          disabled={isSubmitting}
          {...aria("confirmPassword")}
          {...register("confirmPassword")}
        />
        <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin motion-reduce:animate-none" /> Creating account…
          </>
        ) : (
          "Create Admin Account"
        )}
      </Button>
    </form>
  );
}
