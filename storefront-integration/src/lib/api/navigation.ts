/**
 * Navigation items mapped to the Sprinkle & Sparkle catalog backend.
 * Can be used dynamically or statically in the customer storefront header/navbar.
 */

export interface NavItem {
  label: string;
  href: string;
  type: "link" | "category" | "collection" | "dropdown";
  slug?: string;
  children?: NavItem[];
}

export const STOREFRONT_NAVBAR: NavItem[] = [
  { label: "Home", href: "/", type: "link" },
  { label: "About Us", href: "/about", type: "link" },
  { label: "Shop", href: "/shop", type: "link" },
  { label: "Baking Tins", href: "/shop/category/baking-tins", type: "category", slug: "baking-tins" },
  { label: "Boxes", href: "/shop/category/boxes-packaging", type: "category", slug: "boxes-packaging" },
  { label: "Diwali Collection", href: "/shop/collection/diwali-collection", type: "collection", slug: "diwali-collection" },
  { label: "Birthday Collection", href: "/shop/collection/birthday-collection", type: "collection", slug: "birthday-collection" },
  { label: "Tools & Equipment", href: "/shop/category/tools-equipment", type: "category", slug: "tools-equipment" },
  {
    label: "More",
    href: "#",
    type: "dropdown",
    children: [
      { label: "Sprinkles", href: "/shop/category/sprinkles", type: "category", slug: "sprinkles" },
      { label: "Knife Cutters", href: "/shop/category/knife-cutters", type: "category", slug: "knife-cutters" },
      { label: "Acrylic Toppers", href: "/shop/category/acrylic-toppers", type: "category", slug: "acrylic-toppers" },
      { label: "Paper Theme Toppers", href: "/shop/category/paper-theme-toppers", type: "category", slug: "paper-theme-toppers" },
      { label: "Chocolate Boxes", href: "/shop/category/chocolate-boxes", type: "category", slug: "chocolate-boxes" },
      { label: "Diwali Exclusive Range", href: "/shop/category/diwali-exclusive-range", type: "category", slug: "diwali-exclusive-range" },
    ],
  },
];
