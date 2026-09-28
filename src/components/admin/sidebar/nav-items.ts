import {
  Award,
  CreditCard,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  Package,
  PartyPopper,
  Receipt,
  Settings,
  ShieldCheck,
  Tags,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission };
export type NavGroup = { label: string; items: NavItem[] };

/** Links are filtered by permission in the UI; every page also checks permission on the server. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Main", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" }] },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "catalog:read" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "catalog:read" },
      { href: "/admin/subcategories", label: "Subcategories", icon: Tags, permission: "catalog:read" },
      { href: "/admin/collections", label: "Collections", icon: Layers, permission: "catalog:read" },
      { href: "/admin/occasions", label: "Occasions", icon: PartyPopper, permission: "catalog:read" },
      { href: "/admin/brands", label: "Brands", icon: Award, permission: "catalog:read" },
      { href: "/admin/media", label: "Media", icon: ImageIcon, permission: "media:read" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/users", label: "Admin Users", icon: ShieldCheck, permission: "admins:manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
    ],
  },
];

/** Store modules that are not built yet. Shown disabled with a "Soon" label, never as links. */
export const COMING_SOON_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: "Orders", icon: Receipt },
  { label: "Customers", icon: Users },
  { label: "Coupons", icon: TicketPercent },
  { label: "Shipping", icon: Truck },
  { label: "Payments", icon: CreditCard },
];
