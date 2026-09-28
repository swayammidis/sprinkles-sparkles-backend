/**
 * Seed: catalog taxonomy + a handful of clearly-marked DEMO products.
 *
 * - Idempotent: safe to run repeatedly (upserts by slug/SKU).
 * - Demo products use SKU prefix "DEMO-", have isDemo = true and a
 *   "Demo product" note. Remove them all with: npm run db:remove-demo
 * - Demo images are generated placeholders reading "DEMO IMAGE" and are
 *   stored via the local storage provider (skipped for S3 storage).
 * - No fake reviews, sales numbers, customer counts, awards or brands.
 *
 * Optional: set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD to create the first SUPER_ADMIN.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { createScriptClient } from "./script-client";

const prisma = createScriptClient();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

const CATEGORIES: { name: string; description: string; subcategories?: string[] }[] = [
  { name: "Baking Ingredients", description: "Flours, premixes, fondant and everyday baking essentials.", subcategories: ["Flours & Premixes", "Leavening Agents", "Fondant & Icing"] },
  { name: "Baking Tins", description: "Cake tins, trays and moulds.", subcategories: ["Round Tins", "Square Tins", "Loaf Tins", "Cupcake & Muffin Trays"] },
  { name: "Boxes & Packaging", description: "Cake boxes, cupcake boxes and dessert packaging.", subcategories: ["Cake Boxes", "Cupcake Boxes", "Dessert Jars"] },
  { name: "Sprinkles", description: "Nonpareils, sugar pearls and sprinkle mixes.", subcategories: ["Nonpareils", "Sugar Pearls", "Sprinkle Mixes"] },
  { name: "Colours & Essences", description: "Edible gel colours and flavour essences.", subcategories: ["Gel Colours", "Edible Essences"] },
  { name: "Toppers", description: "Cake toppers for every celebration.", subcategories: ["Cake Toppers"] },
  { name: "Tools & Equipment", description: "Piping nozzles, spatulas, turntables and more.", subcategories: ["Piping Nozzles", "Spatulas & Scrapers", "Turntables"] },
  { name: "Chocolates", description: "Compound and couverture chocolate for baking.", subcategories: ["Compound Chocolate", "Couverture"] },
  { name: "Birthday Collection", description: "Everything for birthday bakes." },
  { name: "Festive Collection", description: "Seasonal and festive baking supplies." },
  { name: "Customized Hampers", description: "Curated hampers made to order." },
];

const COLLECTIONS = [
  { name: "New Arrivals", description: "The latest additions to the store." },
  { name: "Featured", description: "Hand-picked favourites." },
  { name: "Birthday Collection", description: "Toppers, sprinkles and boxes for birthday cakes." },
  { name: "Diwali Collection", description: "Festive supplies for Diwali baking and gifting." },
  { name: "Festive Collection", description: "Seasonal supplies for every festival." },
];

const OCCASIONS = [
  { name: "Birthday", description: "Birthday bakes and celebrations." },
  { name: "Diwali", description: "Diwali sweets, bakes and gifting." },
  { name: "Rakhi", description: "Rakhi treats and hampers." },
  { name: "Teacher's Day", description: "Thank-you treats for teachers." },
  { name: "Corporate Gifting", description: "Gifting for teams and clients." },
  { name: "Special Occasions", description: "Anniversaries, baby showers and more." },
];

// ---------------------------------------------------------------------------
// Demo products (clearly marked; replace with real products and photos)
// ---------------------------------------------------------------------------

type DemoVariant = { name: string; sku: string; price: string; salePrice?: string; stock: number; weight?: string; attrs: Record<string, string> };
type DemoProduct = {
  name: string;
  sku: string;
  category: string;
  subcategory?: string;
  price: string;
  salePrice?: string;
  stock: number;
  active: boolean;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  weight?: string;
  collections?: string[];
  occasions?: string[];
  image: { label: string; bg: string; fg: string };
  short: string;
  variants?: DemoVariant[];
};

const DEMO_NOTE = "Demo product for testing — replace with real product details and photos before launch.";

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "Rainbow Sprinkle Mix",
    sku: "DEMO-SPR-RAINBOW",
    category: "Sprinkles",
    subcategory: "Sprinkle Mixes",
    price: "149.00",
    stock: 0,
    active: true,
    featured: true,
    newArrival: true,
    collections: ["Birthday Collection", "New Arrivals"],
    occasions: ["Birthday"],
    image: { label: "Sprinkles", bg: "#fde7f0", fg: "#a51f57" },
    short: "Colourful sprinkle mix for cakes, cupcakes and cookies.",
    variants: [
      { name: "100g", sku: "DEMO-SPR-RAINBOW-100", price: "149.00", stock: 40, weight: "100", attrs: { Weight: "100g" } },
      { name: "250g", sku: "DEMO-SPR-RAINBOW-250", price: "329.00", salePrice: "299.00", stock: 25, weight: "250", attrs: { Weight: "250g" } },
      { name: "500g", sku: "DEMO-SPR-RAINBOW-500", price: "599.00", stock: 4, weight: "500", attrs: { Weight: "500g" } },
    ],
  },
  {
    name: "Round Aluminium Cake Tin",
    sku: "DEMO-TIN-ROUND",
    category: "Baking Tins",
    subcategory: "Round Tins",
    price: "399.00",
    stock: 0,
    active: true,
    bestSeller: true,
    image: { label: "Baking tin", bg: "#e7ecf5", fg: "#1b2440" },
    short: "Seamless round tin with removable base.",
    variants: [
      { name: "6 inch", sku: "DEMO-TIN-ROUND-6", price: "399.00", stock: 12, attrs: { Size: "6 inch" } },
      { name: "8 inch", sku: "DEMO-TIN-ROUND-8", price: "499.00", stock: 9, attrs: { Size: "8 inch" } },
      { name: "10 inch", sku: "DEMO-TIN-ROUND-10", price: "649.00", stock: 0, attrs: { Size: "10 inch" } },
    ],
  },
  {
    name: "Window Cake Box",
    sku: "DEMO-BOX-WINDOW",
    category: "Boxes & Packaging",
    subcategory: "Cake Boxes",
    price: "45.00",
    stock: 0,
    active: true,
    collections: ["Festive Collection"],
    occasions: ["Diwali", "Corporate Gifting"],
    image: { label: "Cake box", bg: "#fff4e0", fg: "#8a4b08" },
    short: "Sturdy cake box with a clear display window.",
    variants: [
      { name: "6 inch", sku: "DEMO-BOX-WINDOW-6", price: "45.00", stock: 200, attrs: { Size: "6 inch", "Pack Quantity": "1" } },
      { name: "8 inch", sku: "DEMO-BOX-WINDOW-8", price: "55.00", stock: 150, attrs: { Size: "8 inch", "Pack Quantity": "1" } },
      { name: "10 inch", sku: "DEMO-BOX-WINDOW-10", price: "65.00", stock: 90, attrs: { Size: "10 inch", "Pack Quantity": "1" } },
    ],
  },
  {
    name: "Open Star Piping Nozzle Set",
    sku: "DEMO-TOOL-NOZZLE-SET",
    category: "Tools & Equipment",
    subcategory: "Piping Nozzles",
    price: "349.00",
    salePrice: "299.00",
    stock: 18,
    active: true,
    featured: true,
    weight: "120",
    image: { label: "Piping nozzles", bg: "#dff5f3", fg: "#0f5f5a" },
    short: "Stainless steel open star nozzles for rosettes and borders.",
  },
  {
    name: "Gel Food Colour",
    sku: "DEMO-COL-GEL",
    category: "Colours & Essences",
    subcategory: "Gel Colours",
    price: "95.00",
    stock: 0,
    active: true,
    newArrival: true,
    image: { label: "Edible colour", bg: "#efe6fb", fg: "#5b2a9e" },
    short: "Concentrated gel colour for icing, fondant and batters.",
    variants: [
      { name: "Pink", sku: "DEMO-COL-GEL-PINK", price: "95.00", stock: 30, weight: "25", attrs: { Colour: "Pink", Weight: "25g" } },
      { name: "Blue", sku: "DEMO-COL-GEL-BLUE", price: "95.00", stock: 22, weight: "25", attrs: { Colour: "Blue", Weight: "25g" } },
      { name: "Yellow", sku: "DEMO-COL-GEL-YELLOW", price: "95.00", stock: 2, weight: "25", attrs: { Colour: "Yellow", Weight: "25g" } },
    ],
  },
  {
    name: "Happy Birthday Cake Topper",
    sku: "DEMO-TOP-HBD-GOLD",
    category: "Toppers",
    subcategory: "Cake Toppers",
    price: "129.00",
    stock: 35,
    active: true,
    collections: ["Birthday Collection"],
    occasions: ["Birthday"],
    image: { label: "Cake topper", bg: "#fdf0dc", fg: "#8a5a00" },
    short: "Gold acrylic topper for birthday cakes.",
  },
  {
    name: "Dark Compound Chocolate Slab",
    sku: "DEMO-CHOC-DARK-500",
    category: "Chocolates",
    subcategory: "Compound Chocolate",
    price: "285.00",
    stock: 0,
    active: true,
    weight: "500",
    collections: ["Diwali Collection"],
    occasions: ["Diwali"],
    image: { label: "Chocolate", bg: "#efe4dc", fg: "#4a2a17" },
    short: "Dark compound chocolate for melting, moulding and ganache.",
  },
  {
    name: "Cake Decorating Turntable",
    sku: "DEMO-TOOL-TURNTABLE",
    category: "Tools & Equipment",
    subcategory: "Turntables",
    price: "899.00",
    stock: 3,
    active: false, // draft — used to verify drafts are hidden from the public API
    image: { label: "Decorating tools", bg: "#e3f6f4", fg: "#0f5f5a" },
    short: "Rotating turntable for smooth icing and piping.",
  },
];

// ---------------------------------------------------------------------------
// Demo image generation (placeholder PNGs, clearly labelled)
// ---------------------------------------------------------------------------

async function createDemoImage(label: string, bg: string, fg: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="${bg}"/>
    <g fill="${fg}" opacity="0.18">
      <circle cx="140" cy="150" r="14"/><circle cx="660" cy="190" r="10"/><circle cx="210" cy="640" r="12"/>
      <circle cx="610" cy="620" r="16"/><rect x="520" y="110" width="40" height="10" rx="5" transform="rotate(30 540 115)"/>
      <rect x="150" y="480" width="44" height="10" rx="5" transform="rotate(-25 172 485)"/>
    </g>
    <rect x="80" y="300" width="640" height="200" rx="28" fill="#ffffff" opacity="0.75"/>
    <text x="400" y="375" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="${fg}">DEMO IMAGE</text>
    <text x="400" y="432" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="${fg}">${esc(label)}</text>
    <text x="400" y="475" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="${fg}" opacity="0.8">Replace with a real product photo</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

  const now = new Date();
  const key = `products/demo/${now.getUTCFullYear()}/${randomUUID()}.png`;
  const full = path.join(process.cwd(), "storage", "uploads", key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, png);

  const base = (process.env.STORAGE_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return prisma.mediaAsset.create({
    data: {
      provider: "local",
      key,
      url: `${base}/media/${key}`,
      filename: `demo-${slugify(label)}.png`,
      mimeType: "image/png",
      size: png.byteLength,
      isDemo: true,
    },
  });
}

// ---------------------------------------------------------------------------

async function seedTaxonomy() {
  for (const [i, c] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i },
    });
    for (const [j, s] of (c.subcategories ?? []).entries()) {
      await prisma.subcategory.upsert({
        where: { slug: slugify(s) },
        update: {},
        create: { name: s, slug: slugify(s), categoryId: category.id, sortOrder: j },
      });
    }
  }
  for (const [i, c] of COLLECTIONS.entries()) {
    await prisma.collection.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i },
    });
  }
  for (const [i, o] of OCCASIONS.entries()) {
    await prisma.occasion.upsert({
      where: { slug: slugify(o.name) },
      update: {},
      create: { name: o.name, slug: slugify(o.name), description: o.description, sortOrder: i },
    });
  }
  console.log(`✓ ${CATEGORIES.length} categories, ${COLLECTIONS.length} collections, ${OCCASIONS.length} occasions`);
}

// Exact comparison in paise via BigInt — no floating point for money.
const toPaise = (s: string) => {
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
};
const minMoney = (values: string[]) => values.reduce((min, v) => (toPaise(v) < toPaise(min) ? v : min));

async function seedDemoProducts() {
  const withImages = (process.env.STORAGE_PROVIDER ?? "local") === "local";
  if (!withImages) console.log("! STORAGE_PROVIDER is not local — demo products are seeded without images.");

  let created = 0;
  for (const p of DEMO_PRODUCTS) {
    if (await prisma.product.findUnique({ where: { sku: p.sku } })) continue;

    const category = await prisma.category.findUniqueOrThrow({ where: { slug: slugify(p.category) } });
    const subcategory = p.subcategory ? await prisma.subcategory.findUnique({ where: { slug: slugify(p.subcategory) } }) : null;
    const collections = await prisma.collection.findMany({ where: { slug: { in: (p.collections ?? []).map(slugify) } } });
    const occasions = await prisma.occasion.findMany({ where: { slug: { in: (p.occasions ?? []).map(slugify) } } });
    const media = withImages ? await createDemoImage(p.image.label, p.image.bg, p.image.fg) : null;

    const hasVariants = !!p.variants?.length;
    const stockQuantity = hasVariants ? p.variants!.reduce((s, v) => s + v.stock, 0) : p.stock;
    const effectivePrice = hasVariants
      ? minMoney(p.variants!.map((v) => v.salePrice ?? v.price))
      : (p.salePrice ?? p.price);

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: p.name,
          slug: slugify(p.name),
          sku: p.sku,
          shortDescription: p.short,
          description: `${p.short}\n\n${DEMO_NOTE}`,
          price: p.price,
          salePrice: p.salePrice ?? null,
          effectivePrice,
          stockQuantity,
          stockStatus: stockQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          hasVariants,
          categoryId: category.id,
          subcategoryId: subcategory?.id ?? null,
          featured: !!p.featured,
          newArrival: !!p.newArrival,
          bestSeller: !!p.bestSeller,
          active: p.active,
          weight: p.weight ?? null,
          isDemo: true,
          collections: { create: collections.map((c) => ({ collectionId: c.id })) },
          occasions: { create: occasions.map((o) => ({ occasionId: o.id })) },
        },
      });
      const image = media
        ? await tx.productImage.create({
            data: { productId: product.id, mediaAssetId: media.id, url: media.url, altText: `${p.name} (demo image)`, isPrimary: true, sortOrder: 0 },
          })
        : null;
      for (const [i, v] of (p.variants ?? []).entries()) {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            salePrice: v.salePrice ?? null,
            stockQuantity: v.stock,
            weight: v.weight ?? null,
            sortOrder: i,
            imageId: image?.id ?? null,
            attributes: { create: Object.entries(v.attrs).map(([name, value]) => ({ name, value })) },
          },
        });
      }
    });
    created++;
  }
  console.log(`✓ ${created} demo product(s) created (${DEMO_PRODUCTS.length - created} already present)`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD — skipping admin creation (use `npm run admin:create`).");
    return;
  }
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    console.log(`• Admin ${email} already exists`);
    return;
  }
  const id = randomUUID();
  await prisma.adminUser.create({
    data: {
      id,
      email,
      name: process.env.SEED_ADMIN_NAME || "Super Admin",
      role: "SUPER_ADMIN",
      emailVerified: true,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    },
  });
  console.log(`✓ Super admin ${email} created`);
}

async function main() {
  await seedTaxonomy();
  await seedDemoProducts();
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
