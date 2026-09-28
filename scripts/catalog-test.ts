/**
 * End-to-end catalog test (admin API + public storefront API) against a RUNNING
 * test server that uses a THROWAWAY database.
 *
 *   TEST_BASE_URL=http://localhost:3005 MONGODB_URI=<same test DB> \
 *   TEST_SUPER_EMAIL=... TEST_SUPER_PASSWORD=... TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... \
 *   npm run test:catalog
 *
 * Refuses to run if the database already contains products (safety).
 */
import mongoose from "mongoose";
import sharp from "sharp";
import { connectDB } from "../src/lib/db";
import { Product } from "../src/models/Product";

const BASE = process.env.TEST_BASE_URL ?? "";
if (!BASE) throw new Error("Set TEST_BASE_URL to a test server that uses a throwaway database");
const SUPER = { email: process.env.TEST_SUPER_EMAIL ?? "", password: process.env.TEST_SUPER_PASSWORD ?? "" };
const ADMIN = { email: process.env.TEST_ADMIN_EMAIL ?? "", password: process.env.TEST_ADMIN_PASSWORD ?? "" };
const STOREFRONT = "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
}

class Jar {
  private c = new Map<string, string>();
  store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (!v || /max-age=0/i.test(raw)) this.c.delete(k);
      else this.c.set(k, v);
    }
  }
  header() {
    return [...this.c].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(s: string) {
    return [...this.c.keys()].some((k) => k.includes(s));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function api(path: string, opts: { method?: string; body?: unknown; jar?: Jar; form?: FormData; origin?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.jar) headers.cookie = opts.jar.header();
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.method && opts.method !== "GET") headers.origin = BASE;
  if (opts.origin) headers.origin = opts.origin;
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function signIn(email: string, password: string) {
  const jar = new Jar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  jar.store(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header(), origin: BASE },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/admin` }),
  });
  jar.store(res);
  if (!jar.has("session-token")) throw new Error(`Sign-in failed for ${email}`);
  return jar;
}

async function png(color: string, w = 1200, h = 1200) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

async function upload(jar: Jar, bytes: Uint8Array, name: string, type = "image/png") {
  const fd = new FormData();
  fd.append("file", new Blob([bytes as BlobPart], { type }), name);
  fd.append("folder", "products");
  return api("/api/admin/media", { method: "POST", jar, form: fd });
}

const baseProduct = {
  status: "draft",
  name: "",
  sku: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: "",
  salePrice: "",
  stockQuantity: 0,
  allowBackorder: false,
  category: "",
  subcategory: "",
  brand: "",
  collections: [] as string[],
  occasions: [] as string[],
  tags: [] as string[],
  images: [] as { media: string; alt: string; isPrimary: boolean }[],
  hasVariants: false,
  variantType: "Size",
  variants: [] as unknown[],
  shipping: { weight: "", length: "", width: "", height: "" },
  featured: false,
  newArrival: false,
  bestSeller: false,
  seoTitle: "",
  seoDescription: "",
};

const taxonomy = (name: string, extra: Record<string, unknown> = {}) => ({ name, slug: "", description: "", imageMedia: "", sortOrder: 0, isActive: true, category: "", ...extra });

async function main() {
  for (const [k, v] of Object.entries({ ...SUPER, ...{ adminEmail: ADMIN.email, adminPassword: ADMIN.password } })) if (!v) throw new Error(`Missing credential: ${k}`);
  await connectDB();
  if ((await Product.countDocuments()) > 0) throw new Error("Refusing to run: the database already has products. Use a throwaway database.");
  console.log(`Testing ${BASE}\n`);

  // ------------------------------------------------------------------ security basics
  console.log("Unauthenticated access");
  check("GET /api/admin/products without login → 401", (await api("/api/admin/products")).status === 401);
  check("POST /api/admin/categories without login → 401", (await api("/api/admin/categories", { method: "POST", body: taxonomy("X") })).status === 401);
  check("/admin/products without login → redirect to /login", (await api("/admin/products")).status === 307);

  const sa = await signIn(SUPER.email, SUPER.password);
  const ad = await signIn(ADMIN.email, ADMIN.password);

  // ------------------------------------------------------------------ taxonomy
  console.log("\nCategories, subcategories, collections, occasions, brands");
  const cat = await api("/api/admin/categories", { method: "POST", jar: sa, body: taxonomy("Sprinkles", { description: "Colourful sprinkles for cakes." }) });
  check("Create category → 201, slug generated", cat.status === 201 && cat.json.item.slug === "sprinkles", cat.json);
  const catId: string = cat.json.item.id;
  const cat2 = await api("/api/admin/categories", { method: "POST", jar: ad, body: taxonomy("Boxes & Packaging") });
  check("ADMIN can create a category; '&' becomes 'and' in slug", cat2.status === 201 && cat2.json.item.slug === "boxes-and-packaging", cat2.json);
  const cat2Id: string = cat2.json.item.id;
  const dupCat = await api("/api/admin/categories", { method: "POST", jar: sa, body: taxonomy("Sprinkles") });
  check("Same name again gets a unique slug (sprinkles-2)", dupCat.status === 201 && dupCat.json.item.slug === "sprinkles-2", dupCat.json);
  await api(`/api/admin/categories/${dupCat.json.item.id}`, { method: "DELETE", jar: sa });
  const noName = await api("/api/admin/categories", { method: "POST", jar: sa, body: taxonomy("") });
  check("Missing name → 'Please enter a name.'", noName.status === 422 && noName.json.fieldErrors?.name === "Please enter a name.", noName.json);

  const editCat = await api(`/api/admin/categories/${catId}`, { method: "PUT", jar: sa, body: taxonomy("Sprinkles & Toppings", { slug: "sprinkles", description: "Updated." }) });
  check("Edit category (keeps URL name)", editCat.status === 200 && editCat.json.item.name === "Sprinkles & Toppings" && editCat.json.item.slug === "sprinkles", editCat.json);

  const subNoParent = await api("/api/admin/subcategories", { method: "POST", jar: sa, body: taxonomy("Cake Boxes") });
  check("Subcategory without parent → 'Please select a parent category.'", subNoParent.status === 422 && /parent category/.test(subNoParent.json.error), subNoParent.json);
  const sub = await api("/api/admin/subcategories", { method: "POST", jar: sa, body: taxonomy("Cake Boxes", { category: cat2Id }) });
  check("Create subcategory under Boxes & Packaging", sub.status === 201 && sub.json.item.categoryName === "Boxes & Packaging", sub.json);
  const subSpr = await api("/api/admin/subcategories", { method: "POST", jar: sa, body: taxonomy("Sprinkle Mixes", { category: catId }) });
  const subSprId: string = subSpr.json.item.id;

  const col = await api("/api/admin/collections", { method: "POST", jar: sa, body: taxonomy("Birthday Collection") });
  const colId: string = col.json.item.id;
  const occ = await api("/api/admin/occasions", { method: "POST", jar: sa, body: taxonomy("Birthday") });
  const brand = await api("/api/admin/brands", { method: "POST", jar: sa, body: taxonomy("Sparkle House") });
  check("Create collection, occasion, brand", col.status === 201 && occ.status === 201 && brand.status === 201);

  // ------------------------------------------------------------------ images
  console.log("\nImages");
  const img1 = await upload(sa, await png("#e2508a"), "rainbow sprinkles.png");
  check("Upload PNG → optimised to WebP ≤ 2000px with dimensions", img1.status === 201 && img1.json.asset.mimeType === "image/webp" && img1.json.asset.width === 1200, img1.json);
  const img2 = await upload(sa, await png("#14a39a", 3000, 1500), "wide.png");
  check("Large image is resized to fit 2000px", img2.json.asset?.width === 2000 && img2.json.asset?.height === 1000, img2.json.asset);
  const fake = await upload(sa, new TextEncoder().encode("<html>not an image</html>".padEnd(64)), "evil.png");
  check("Non-image rejected with a friendly message", fake.status === 415 && /JPG, PNG/.test(fake.json.error), fake.json);
  const served = await fetch(new URL(img1.json.asset.url, BASE));
  check("Image is served (nosniff)", served.status === 200 && served.headers.get("x-content-type-options") === "nosniff");
  const m1: string = img1.json.asset.id;
  const m2: string = img2.json.asset.id;

  // ------------------------------------------------------------------ product flow (client scenario)
  console.log("\nProduct: add → draft → publish → search → edit");
  const rainbow = {
    ...baseProduct,
    name: "Rainbow Sprinkles",
    price: "180",
    stockQuantity: 42,
    category: catId,
    subcategory: subSprId,
    collections: [colId],
    occasions: [occ.json.item.id],
    brand: brand.json.item.id,
    tags: ["Rainbow", "rainbow", "eggless"],
    images: [
      { media: m1, alt: "Rainbow sprinkles jar", isPrimary: false },
      { media: m2, alt: "", isPrimary: true },
    ],
    featured: true,
  };
  const noName2 = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...rainbow, name: "" } });
  check("Missing name → 'Please enter a product name.'", noName2.status === 422 && noName2.json.fieldErrors?.name === "Please enter a product name.", noName2.json);
  const pubNoSku = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...rainbow, status: "published" } });
  check("Publish without SKU → 'Add a SKU before publishing.'", pubNoSku.status === 422 && pubNoSku.json.fieldErrors?.sku === "Add a SKU before publishing.", pubNoSku.json);
  const badSale = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...rainbow, salePrice: "200" } });
  check("Sale ≥ price → friendly message", badSale.status === 422 && /lower than the regular price/.test(badSale.json.fieldErrors?.salePrice), badSale.json);
  const wrongSub = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...rainbow, category: cat2Id } });
  check("Subcategory from another category rejected", wrongSub.status === 422 && /different category/.test(wrongSub.json.error), wrongSub.json);

  const draft = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...rainbow, effectivePrice: 1, stockStatus: "in_stock", isAdmin: true } });
  check("Save as draft → 201", draft.status === 201 && draft.json.status === "draft", draft.json);
  const pid: string = draft.json.id;
  const stored = await Product.findById(pid).lean();
  check("Price stored exactly in paise (18000)", stored?.price === 18000 && stored.effectivePrice === 18000, stored?.price);
  check("Stock status derived by the server (in_stock)", stored?.stockStatus === "in_stock");
  check("Chosen main image kept; order preserved", stored?.images[1].isPrimary === true && String(stored.images[0].media) === m1);
  check("Tags normalised & de-duplicated", JSON.stringify(stored?.tags) === JSON.stringify(["rainbow", "eggless"]), stored?.tags);
  check("Slug generated from name", stored?.slug === "rainbow-sprinkles", stored?.slug);

  const pubDraft = await api(`/api/public/products/rainbow-sprinkles`);
  check("Draft does NOT appear on the public website API", pubDraft.status === 404, pubDraft.status);

  const quickPublishNoSku = await api(`/api/admin/products/${pid}`, { method: "PATCH", jar: sa, body: { status: "published" } });
  check("Quick publish without SKU explains what's missing", quickPublishNoSku.status === 422 && /add a SKU/.test(quickPublishNoSku.json.error), quickPublishNoSku.json);

  const edit = await api(`/api/admin/products/${pid}`, { jar: sa });
  const publish = await api(`/api/admin/products/${pid}`, { method: "PUT", jar: sa, body: { ...edit.json.values, sku: "SPR-RAINBOW-100", status: "published" } });
  check("Publish product → 200 published", publish.status === 200 && publish.json.status === "published", publish.json);

  const pub = await api(`/api/public/products/rainbow-sprinkles`, { origin: STOREFRONT });
  const d = pub.json.data;
  check("Published product appears on public API", pub.status === 200 && d?.name === "Rainbow Sprinkles");
  check("Public price ₹180 (amount '180.00', paise 18000)", d?.price.amount === "180.00" && d?.price.paise === 18000, d?.price);
  check("Public category/subcategory/brand/collections/occasions by name+slug", d?.category?.slug === "sprinkles" && d?.subcategory?.slug === "sprinkle-mixes" && d?.brand?.name === "Sparkle House" && d?.collections[0]?.slug === "birthday-collection" && d?.occasions[0]?.slug === "birthday", d);
  check("Public main image first", d?.image?.url === img2.json.asset.url && d?.images[0].url === img2.json.asset.url);
  const leaked = ["stockQuantity", "status", "isActive", "_id", "__v", "createdAt", "effectivePrice", "allowBackorder"].filter((k) => d && k in d);
  check("No internal fields in public response", leaked.length === 0 && !pub.text.includes("stockQuantity") && !pub.text.includes('"media"'), leaked);
  check("CORS allowed for storefront origin", pub.headers.get("access-control-allow-origin") === STOREFRONT);
  const evil = await api(`/api/public/products`, { origin: "https://evil.example" });
  check("CORS not granted to other origins", !evil.headers.get("access-control-allow-origin"));

  const shop = await api(`/api/public/products?category=sprinkles`);
  check("Shop → Sprinkles lists the product", shop.json.data.items.length === 1 && shop.json.data.items[0].fromPrice.amount === "180.00", shop.json.data);

  const search = await api(`/api/admin/products?q=rainbow`, { jar: sa });
  check("Admin search by name", search.json.items?.length === 1);
  const searchSku = await api(`/api/admin/products?q=SPR-RAINBOW`, { jar: sa });
  check("Admin search by SKU", searchSku.json.items?.length === 1);

  const edit2 = await api(`/api/admin/products/${pid}`, { jar: sa });
  const priceChange = await api(`/api/admin/products/${pid}`, { method: "PUT", jar: sa, body: { ...edit2.json.values, price: "199.50", salePrice: "175" } });
  check("Edit price → saved", priceChange.status === 200);
  const pub2 = (await api(`/api/public/products/rainbow-sprinkles`)).json.data;
  check("Public API reflects new price & sale (₹199.50 / ₹175)", pub2.price.amount === "199.50" && pub2.salePrice.amount === "175.00" && pub2.fromPrice.paise === 17500 && pub2.badges.onSale, pub2.price);

  // ------------------------------------------------------------------ variants
  console.log("\nVariants");
  const variantProduct = {
    ...baseProduct,
    status: "published",
    name: "Cake Box",
    sku: "BOX-WHITE",
    category: cat2Id,
    subcategory: sub.json.item.id,
    hasVariants: true,
    variantType: "Size",
    images: [{ media: m1, alt: "", isPrimary: true }],
    variants: [
      { label: "6 inch", sku: "BOX-6", price: "45", salePrice: "", stockQuantity: 20, weight: "", isActive: true, image: m1 },
      { label: "8 inch", sku: "BOX-8", price: "55", salePrice: "50", stockQuantity: 15, weight: "120", isActive: true, image: "" },
      { label: "10 inch", sku: "BOX-10", price: "65", salePrice: "", stockQuantity: 8, weight: "", isActive: false, image: "" },
    ],
    newArrival: true,
    stockQuantity: 999,
  };
  const dupLabel = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...variantProduct, variants: [variantProduct.variants[0], { ...variantProduct.variants[1], label: "6 inch" }] } });
  check("Duplicate option names rejected", dupLabel.status === 422 && /listed twice/.test(JSON.stringify(dupLabel.json.fieldErrors)), dupLabel.json);
  const vp = await api("/api/admin/products", { method: "POST", jar: sa, body: variantProduct });
  check("Create product with 3 size variants → 201", vp.status === 201, vp.json);
  const vStored = await Product.findById(vp.json.id).lean();
  check("Stock = total of available options (20+15=35), client value ignored", vStored?.stockQuantity === 35, vStored?.stockQuantity);
  check("From-price = cheapest available option incl. sale (₹45)", vStored?.effectivePrice === 4500, vStored?.effectivePrice);
  const vPub = (await api(`/api/public/products/cake-box`)).json.data;
  check("Public shows only available options, with prices", vPub.variants.length === 2 && vPub.variantType === "Size" && vPub.variants[1].salePrice.amount === "50.00", vPub.variants);
  check("Variant photo resolved for 6 inch", vPub.variants[0].image?.url === img1.json.asset.url);
  const dupSku = await api("/api/admin/products", { method: "POST", jar: sa, body: { ...variantProduct, name: "Another box", sku: "SPR-RAINBOW-100" } });
  check("Duplicate SKU → 'A product with this SKU already exists.'", dupSku.status === 409 && dupSku.json.error === "A product with this SKU already exists.", dupSku.json);

  // ------------------------------------------------------------------ list: filters, sort, pagination
  console.log("\nProduct list: filters, sorting, pagination");
  for (let i = 1; i <= 6; i++) {
    await api("/api/admin/products", {
      method: "POST",
      jar: ad,
      body: { ...baseProduct, name: `Gel Colour ${i}`, sku: `GEL-${i}`, price: String(50 + i * 10), stockQuantity: i === 1 ? 0 : i, category: catId, status: i % 2 ? "published" : "draft" },
    });
  }
  const all = (await api(`/api/admin/products?pageSize=5`, { jar: sa })).json;
  check("Pagination: 8 products, 5 per page, 2 pages", all.total === 8 && all.items.length === 5 && all.totalPages === 2, all.total);
  const page2 = (await api(`/api/admin/products?pageSize=5&page=2`, { jar: sa })).json;
  check("Page 2 has the remaining 3", page2.items.length === 3);
  const drafts = (await api(`/api/admin/products?status=draft`, { jar: sa })).json;
  check("Filter: drafts only", drafts.items.every((p: Json) => p.status === "draft") && drafts.total === 3, drafts.total);
  const oos = (await api(`/api/admin/products?stock=out_of_stock`, { jar: sa })).json;
  check("Filter: out of stock", oos.total === 1 && oos.items[0].name === "Gel Colour 1", oos.items.map((p: Json) => p.name));
  const lowStock = (await api(`/api/admin/products?stock=low_stock`, { jar: sa })).json;
  check("Filter: low stock (≤5)", lowStock.items.every((p: Json) => p.stockQuantity > 0 && p.stockQuantity <= 5) && lowStock.total === 4, lowStock.total);
  const featured = (await api(`/api/admin/products?featured=yes`, { jar: sa })).json;
  check("Filter: featured", featured.total === 1 && featured.items[0].name === "Rainbow Sprinkles");
  const newArr = (await api(`/api/admin/products?newArrival=yes`, { jar: sa })).json;
  check("Filter: new arrival", newArr.total === 1 && newArr.items[0].name === "Cake Box");
  const byCat = (await api(`/api/admin/products?category=${cat2Id}`, { jar: sa })).json;
  check("Filter: category", byCat.total === 1);
  const priceAsc = (await api(`/api/admin/products?sort=price_asc&pageSize=50`, { jar: sa })).json.items.map((p: Json) => p.effectivePrice);
  check("Sort: price low → high", priceAsc.every((v: number, i: number) => i === 0 || priceAsc[i - 1] <= v), priceAsc);
  const priceDesc = (await api(`/api/admin/products?sort=price_desc&pageSize=50`, { jar: sa })).json.items.map((p: Json) => p.effectivePrice);
  check("Sort: price high → low", priceDesc.every((v: number, i: number) => i === 0 || priceDesc[i - 1] >= v), priceDesc);
  const nameAsc = (await api(`/api/admin/products?sort=name_asc&pageSize=50`, { jar: sa })).json.items.map((p: Json) => p.name);
  check("Sort: name A–Z", nameAsc[0] === "Cake Box" && nameAsc.at(-1) === "Rainbow Sprinkles", nameAsc);
  const stockAsc = (await api(`/api/admin/products?sort=stock_asc&pageSize=50`, { jar: sa })).json.items.map((p: Json) => p.stockQuantity);
  check("Sort: stock low → high", stockAsc.every((v: number, i: number) => i === 0 || stockAsc[i - 1] <= v), stockAsc);
  const oldest = (await api(`/api/admin/products?sort=oldest&pageSize=1`, { jar: sa })).json.items[0]?.name;
  check("Sort: oldest first", oldest === "Rainbow Sprinkles", oldest);

  // ------------------------------------------------------------------ public API filters
  console.log("\nPublic API: filters, sort, pagination");
  const pubAll = (await api(`/api/public/products`)).json.data;
  check("Only published products are public (2 + 3 published gel colours = 5)", pubAll.pagination.total === 5, pubAll.pagination);
  const pubFeatured = (await api(`/api/public/products?featured=true`)).json.data;
  check("Featured products", pubFeatured.items.length === 1 && pubFeatured.items[0].slug === "rainbow-sprinkles");
  const pubNew = (await api(`/api/public/products?newArrival=true`)).json.data;
  check("New arrivals", pubNew.items.length === 1 && pubNew.items[0].slug === "cake-box");
  const pubCol = (await api(`/api/public/products?collection=birthday-collection`)).json.data;
  check("Collection filter", pubCol.items.length === 1);
  const pubOcc = (await api(`/api/public/products?occasion=birthday`)).json.data;
  check("Occasion filter", pubOcc.items.length === 1);
  const pubSub = (await api(`/api/public/products?subcategory=cake-boxes`)).json.data;
  check("Subcategory filter", pubSub.items.length === 1 && pubSub.items[0].slug === "cake-box");
  const pubSearch = (await api(`/api/public/products?search=eggless`)).json.data;
  check("Search matches tags", pubSearch.items.length === 1);
  const pubPrice = (await api(`/api/public/products?minPrice=60&maxPrice=100&sort=price_asc`)).json.data.items.map((p: Json) => p.fromPrice.paise);
  check("Price range + sort", pubPrice.length > 0 && pubPrice.every((v: number, i: number) => v >= 6000 && v <= 10000 && (i === 0 || pubPrice[i - 1] <= v)), pubPrice);
  const pubPage = (await api(`/api/public/products?pageSize=2&page=2&sort=name_asc`)).json.data;
  check("Public pagination", pubPage.items.length === 2 && pubPage.pagination.totalPages === 3, pubPage.pagination);
  const unknownCat = (await api(`/api/public/products?category=does-not-exist`)).json.data;
  check("Unknown category slug → empty list", unknownCat.items.length === 0);
  const pubCats = (await api(`/api/public/categories`)).json.data;
  check("Public categories include subcategories", pubCats.find((c: Json) => c.slug === "boxes-and-packaging")?.subcategories[0]?.slug === "cake-boxes", pubCats);

  await api(`/api/admin/categories/${cat2Id}`, { method: "PATCH", jar: sa, body: { isActive: false } });
  check("Hiding a category hides its products publicly", (await api(`/api/public/products/cake-box`)).status === 404);
  check("…and the category itself", !(await api(`/api/public/categories`)).json.data.some((c: Json) => c.slug === "boxes-and-packaging"));
  await api(`/api/admin/categories/${cat2Id}`, { method: "PATCH", jar: sa, body: { isActive: true } });

  // ------------------------------------------------------------------ collections: assign products
  console.log("\nCollections: assign products");
  const gel = (await api(`/api/admin/products/lookup?q=Gel Colour 3`, { jar: sa })).json.products[0];
  const assign = await api(`/api/admin/collections/${colId}/products`, { method: "POST", jar: sa, body: { productIds: [gel.id, vp.json.id] } });
  check("Add 2 products to collection", assign.status === 200 && assign.json.added === 2, assign.json);
  const inCol = (await api(`/api/admin/collections/${colId}/products`, { jar: sa })).json.products;
  check("Collection now has 3 products", inCol.length === 3, inCol.length);
  await api(`/api/admin/collections/${colId}/products`, { method: "DELETE", jar: sa, body: { productId: gel.id } });
  check("Remove product from collection", (await api(`/api/admin/collections/${colId}/products`, { jar: sa })).json.products.length === 2);

  // ------------------------------------------------------------------ duplicate & delete safety
  console.log("\nDuplicate & delete safety");
  const dupe = await api(`/api/admin/products/${pid}/duplicate`, { method: "POST", jar: sa });
  const dupeStored = await Product.findById(dupe.json.id).lean();
  check("Duplicate → new draft without SKU, same category/images/description", dupe.status === 201 && dupeStored?.status === "draft" && dupeStored.sku === null && String(dupeStored.category) === catId && dupeStored.images.length === 2, dupeStored);
  check("Duplicate is not public", (await api(`/api/public/products/${dupeStored?.slug}`)).status === 404);
  const delCat = await api(`/api/admin/categories/${catId}`, { method: "DELETE", jar: sa });
  check("Delete category with products is blocked with a clear message", delCat.status === 409 && /contains \d+ products\. Please move them to another category/.test(delCat.json.error), delCat.json);
  const delMedia = await api(`/api/admin/media/${m1}`, { method: "DELETE", jar: sa });
  check("Delete image in use is blocked", delMedia.status === 409 && /used in/.test(delMedia.json.error), delMedia.json);
  const delProduct = await api(`/api/admin/products/${dupe.json.id}`, { method: "DELETE", jar: sa });
  check("Delete product → 200", delProduct.status === 200);
  check("Deleted product is gone", (await api(`/api/admin/products/${dupe.json.id}`, { jar: sa })).status === 404);
  const delBrand = await api(`/api/admin/brands/${brand.json.item.id}`, { method: "DELETE", jar: sa });
  check("Delete brand unlinks it from products (products kept)", delBrand.status === 200 && (await Product.findById(pid).lean())?.brand === null);

  // ------------------------------------------------------------------ settings & roles
  console.log("\nSettings & roles");
  const settings = await api("/api/admin/settings", { jar: sa });
  const saved = await api("/api/admin/settings", { method: "PUT", jar: sa, body: { ...settings.json.settings, phone: "+91 98765 43210", social: { ...settings.json.settings.social, instagram: "https://instagram.com/sprinkleandsparkle" } } });
  check("SUPER_ADMIN saves store settings", saved.status === 200);
  const badSettings = await api("/api/admin/settings", { method: "PUT", jar: sa, body: { ...settings.json.settings, social: { ...settings.json.settings.social, facebook: "facebook.com/x" } } });
  check("Invalid social link → friendly message", badSettings.status === 422 && /https:\/\//.test(badSettings.json.fieldErrors?.["social.facebook"]), badSettings.json);
  const store = (await api("/api/public/store")).json.data;
  check("Public store info reflects settings", store.contact.phone === "+91 98765 43210" && store.social.instagram.includes("instagram.com"));
  check("ADMIN cannot read settings API → 403", (await api("/api/admin/settings", { jar: ad })).status === 403);
  check("ADMIN cannot change settings → 403", (await api("/api/admin/settings", { method: "PUT", jar: ad, body: settings.json.settings })).status === 403);
  check("ADMIN cannot manage admin users → 403", (await api("/api/admin/users", { jar: ad })).status === 403);
  check("ADMIN can manage products", (await api("/api/admin/products", { jar: ad })).status === 200);
  check("ADMIN /admin/settings page → redirected", (await api("/admin/settings", { jar: ad })).status === 307);
  check("Cross-site POST blocked (CSRF)", (await api("/api/admin/categories", { method: "POST", jar: sa, body: taxonomy("Evil"), origin: "https://evil.example" })).status === 403);
  check("Invalid product id → 404 (no crash)", (await api("/api/admin/products/not-an-id", { jar: sa })).status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
