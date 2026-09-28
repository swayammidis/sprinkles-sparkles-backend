import {
  Award,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  Package,
  PartyPopper,
  Settings,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission };

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "catalog:read" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "catalog:read" },
  { href: "/admin/subcategories", label: "Subcategories", icon: Tags, permission: "catalog:read" },
  { href: "/admin/collections", label: "Collections", icon: Layers, permission: "catalog:read" },
  { href: "/admin/occasions", label: "Occasions", icon: PartyPopper, permission: "catalog:read" },
  { href: "/admin/brands", label: "Brands", icon: Award, permission: "catalog:read" },
  { href: "/admin/media", label: "Media", icon: ImageIcon, permission: "media:read" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "dashboard:view" },
];
