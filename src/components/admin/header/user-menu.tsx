"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ admin }: { admin: { name: string; email: string; role: Role } }) {
  const initials = admin.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    await authClient.signOut();
    window.location.replace(new URL("/login", window.location.origin).href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand-pink-soft text-xs font-semibold text-brand-pink">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{admin.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{admin.name}</div>
          <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
          <div className="mt-1.5 inline-flex rounded-full bg-brand-turquoise-soft px-2 py-0.5 text-[11px] font-medium text-brand-turquoise">
            {ROLE_LABELS[admin.role]}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
