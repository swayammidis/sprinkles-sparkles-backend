"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, User } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/admin/auth/password-input";

type Field = keyof RegisterInput;

type SuccessState =
  | { kind: "first_admin" }
  | { kind: "pending_admin" };

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
  const [success, setSuccess] = useState<SuccessState | null>(null);

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

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      isFirstAdmin?: boolean;
      error?: string;
      fieldErrors?: Record<string, string>;
    };

    if (res.ok) {
      if (data.isFirstAdmin) {
        setSuccess({ kind: "first_admin" });
        router.refresh();
      } else {
        setSuccess({ kind: "pending_admin" });
      }
      return;
    }

    setError(data.error ?? "Something went wrong. Please try again.");
    for (const [key, message] of Object.entries(data.fieldErrors ?? {})) {
      setFieldError(key as Field, { message });
    }
  });

  // Success view for FIRST USER: Became SUPER_ADMIN and session was created
  if (success?.kind === "first_admin") {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Admin account created successfully.</h2>
          <p className="text-sm text-muted-foreground">
            You are the store administrator.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild size="lg" className="h-10 w-full">
            <Link href="/admin">Continue to Admin Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success view for SECOND AND LATER USERS: Created as PENDING ADMIN
  if (success?.kind === "pending_admin") {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Clock className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Registration submitted.</h2>
          <p className="text-sm text-muted-foreground">
            Your admin access request has been sent to the store administrator. You can sign in after your account is approved.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild size="lg" variant="outline" className="h-10 w-full">
            <Link href="/login">Back to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  const aria = (f: Field) => ({
    "aria-invalid": !!errors[f],
    "aria-describedby": errors[f] ? `${f}-error` : undefined,
  });

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
        <Label htmlFor="name">Full Name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            className="h-10 pl-9"
            disabled={isSubmitting}
            {...aria("name")}
            {...register("name")}
          />
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
        <PasswordInput
          id="password"
          autoComplete="new-password"
          disabled={isSubmitting}
          {...aria("password")}
          {...register("password")}
        />
        {errors.password ? (
          <FieldError id="password-error" message={errors.password.message} />
        ) : (
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with upper- and lower-case letters and a number.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
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
            <Loader2 className="animate-spin motion-reduce:animate-none" /> Creating Account…
          </>
        ) : (
          "Create Account"
        )}
      </Button>
    </form>
  );
}
