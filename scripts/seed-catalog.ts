import { createRequire } from "node:module";
import mongoose, { Types } from "mongoose";

const require = createRequire(import.meta.url);

// Stub server-only in require cache so tsx does not throw in CLI context
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeModule;
} catch {
  // ignore
}

import { connectDB } from "../src/lib/db";
import { Category, Subcategory, Collection, Occasion, Brand } from "../src/models/taxonomy";
import { Product, type StockStatus } from "../src/models/Product";

// Helper for paise conversion
const inPaise = (rupees: number) => Math.round(rupees * 100);

interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

interface SeedSubcategory {
  name: string;
  slug: string;
  parentCategorySlug: string;
  description: string;
  sortOrder: number;
}

interface SeedTaxonomy {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

const CATEGORIES: SeedCategory[] = [
  {
    name: "Baking Tins",
    slug: "baking-tins",
    description: "Premium aluminium, non-stick, and silicone baking tins, pans, and moulds in various shapes and sizes for all your cake and pastry creations.",
    sortOrder: 1,
  },
  {
    name: "Boxes & Packaging",
    slug: "boxes-packaging",
    description: "Sturdy cake boxes, pastry boxes, cupcake holders, hamper trays, and festive packaging to present and protect your bakery creations.",
    sortOrder: 2,
  },
  {
    name: "Diwali Collection",
    slug: "diwali-collection",
    description: "Festive Diwali packaging, sweets and chocolate boxes, decorative hampers, diya moulds, and golden cake accents for the festive season.",
    sortOrder: 3,
  },
  {
    name: "Birthday Collection",
    slug: "birthday-collection",
    description: "Everything you need for unforgettable birthday celebrations: themed toppers, colourful sprinkles, candles, and cake boxes.",
    sortOrder: 4,
  },
  {
    name: "Tools & Equipment",
    slug: "tools-equipment",
    description: "Professional cake decorating turntables, spatulas, palette knives, acrylic scrapers, piping tips, nozzles, and measuring essentials.",
    sortOrder: 5,
  },
  {
    name: "Sprinkles",
    slug: "sprinkles",
    description: "Edible rainbow sprinkles, jimmies, nonpareils, edible pearls, metallic dragees, and themed sprinkle mixes for cake decorating.",
    sortOrder: 6,
  },
  {
    name: "Knife Cutters",
    slug: "knife-cutters",
    description: "Cake levellers, serrated bread knives, precision fondant craft knives, fondant plunger cutters, and cookie cutters.",
    sortOrder: 7,
  },
  {
    name: "Acrylic Toppers",
    slug: "acrylic-toppers",
    description: "High-quality reusable acrylic cake toppers for birthdays, anniversaries, baby showers, weddings, and special milestones.",
    sortOrder: 8,
  },
  {
    name: "Paper Theme Toppers",
    slug: "paper-theme-toppers",
    description: "Vibrant paper and cardstock toppers, character themes, banner toppers, and cupcake toppers for themed celebrations.",
    sortOrder: 9,
  },
  {
    name: "Chocolate Boxes",
    slug: "chocolate-boxes",
    description: "Luxury chocolate gift boxes, cavity trays, truffle boxes, and festive bonbon boxes with windows and inserts.",
    sortOrder: 10,
  },
  {
    name: "Diwali Exclusive Range",
    slug: "diwali-exclusive-range",
    description: "Limited-edition festive moulds, premium sweet boxes, golden hampers, and special festive baking embellishments.",
    sortOrder: 11,
  },
  {
    name: "Baking Ingredients",
    slug: "baking-ingredients",
    description: "Baking powders, fondants, icing sugar, cocoa powders, cake mixes, glucose syrup, and professional baking essentials.",
    sortOrder: 12,
  },
  {
    name: "Colours & Essences",
    slug: "colours-essences",
    description: "Concentrated food gel colours, oil candy colours, liquid food colours, and authentic culinary baking essences and extracts.",
    sortOrder: 13,
  },
  {
    name: "Chocolates",
    slug: "chocolates",
    description: "Baking chocolate compounds, pure couverture chocolates, chocolate chips, and decorative chocolate pearls.",
    sortOrder: 14,
  },
  {
    name: "Gifting & Hampers",
    slug: "gifting-hampers",
    description: "Curated baking gift baskets, customized festive hampers, decorative ribbons, glass jars, and gifting accessories.",
    sortOrder: 15,
  },
  {
    name: "Festive Collection",
    slug: "festive-collection",
    description: "Seasonal baking and gifting collections for Rakhi, Christmas, New Year, Valentine's Day, and Indian festivals.",
    sortOrder: 16,
  },
];

const SUBCATEGORIES: SeedSubcategory[] = [
  // Baking Tins
  { name: "Round Cake Tins", slug: "round-cake-tins", parentCategorySlug: "baking-tins", description: "Deep and standard round cake tins in various diameters.", sortOrder: 1 },
  { name: "Square Cake Tins", slug: "square-cake-tins", parentCategorySlug: "baking-tins", description: "Square baking tins for brownies, layered cakes, and tea cakes.", sortOrder: 2 },
  { name: "Heart Cake Tins", slug: "heart-cake-tins", parentCategorySlug: "baking-tins", description: "Heart-shaped cake pans for Valentine's and anniversaries.", sortOrder: 3 },
  { name: "Cupcake/Muffin Tins", slug: "cupcake-muffin-tins", parentCategorySlug: "baking-tins", description: "6, 12, and 24 cavity muffin and cupcake baking trays.", sortOrder: 4 },
  { name: "Specialty Cake Tins", slug: "specialty-cake-tins", parentCategorySlug: "baking-tins", description: "Bundt pans, loaf tins, doll cake moulds, and novelty shapes.", sortOrder: 5 },

  // Boxes & Packaging
  { name: "Cake Boxes", slug: "cake-boxes", parentCategorySlug: "boxes-packaging", description: "Tall, windowed, and standard white and printed cake boxes.", sortOrder: 1 },
  { name: "Cupcake Boxes", slug: "cupcake-boxes", parentCategorySlug: "boxes-packaging", description: "Boxes with cavity inserts for 2, 4, 6, and 12 cupcakes.", sortOrder: 2 },
  { name: "Chocolate Gift Boxes", slug: "chocolate-gift-boxes", parentCategorySlug: "boxes-packaging", description: "Cavity boxes with golden inserts for handmade chocolates.", sortOrder: 3 },
  { name: "Gift Boxes", slug: "gift-boxes", parentCategorySlug: "boxes-packaging", description: "Rigid gift boxes and hamper boxes for special treats.", sortOrder: 4 },
  { name: "Hamper Boxes", slug: "hamper-boxes", parentCategorySlug: "boxes-packaging", description: "Deep hamper boxes, baskets, and luxury gifting trays.", sortOrder: 5 },
  { name: "Packaging Accessories", slug: "packaging-accessories", parentCategorySlug: "boxes-packaging", description: "Ribbons, cake boards, thank-you stickers, and butter paper.", sortOrder: 6 },

  // Tools & Equipment
  { name: "Piping Tools", slug: "piping-tools", parentCategorySlug: "tools-equipment", description: "Reusable silicone piping bags, disposable bags, and couplers.", sortOrder: 1 },
  { name: "Spatulas", slug: "spatulas", parentCategorySlug: "tools-equipment", description: "Offset spatulas, straight palette knives, and silicone bowl scrapers.", sortOrder: 2 },
  { name: "Scrapers", slug: "scrapers", parentCategorySlug: "tools-equipment", description: "Acrylic smoothers, patterned side scrapers, and dough bench cutters.", sortOrder: 3 },
  { name: "Nozzles", slug: "nozzles", parentCategorySlug: "tools-equipment", description: "Russian nozzles, open star, round, petal, and leaf piping tips.", sortOrder: 4 },
  { name: "Measuring Tools", slug: "measuring-tools", parentCategorySlug: "tools-equipment", description: "Digital weighing scales, measuring cups, and spoon sets.", sortOrder: 5 },
  { name: "Decorating Tools", slug: "decorating-tools", parentCategorySlug: "tools-equipment", description: "Fondant embossing rolling pins, flower nails, and turntables.", sortOrder: 6 },

  // Sprinkles
  { name: "Rainbow Sprinkles", slug: "rainbow-sprinkles", parentCategorySlug: "sprinkles", description: "Classic multi-coloured sugar strands and sprinkles.", sortOrder: 1 },
  { name: "Nonpareils", slug: "nonpareils", parentCategorySlug: "sprinkles", description: "Tiny round sugar balls for cookies, cake pops, and cupcakes.", sortOrder: 2 },
  { name: "Sugar Pearls", slug: "sugar-pearls", parentCategorySlug: "sprinkles", description: "Shimmering metallic and pastel edible sugar pearls.", sortOrder: 3 },
  { name: "Confetti Sprinkles", slug: "confetti-sprinkles", parentCategorySlug: "sprinkles", description: "Flat round sequin and confetti sugar shapes.", sortOrder: 4 },
  { name: "Themed Sprinkles", slug: "themed-sprinkles", parentCategorySlug: "sprinkles", description: "Curated custom sprinkle blends for birthdays and festivals.", sortOrder: 5 },

  // Acrylic Toppers
  { name: "Birthday Toppers", slug: "birthday-toppers", parentCategorySlug: "acrylic-toppers", description: "Happy Birthday calligraphy acrylic toppers in gold, silver, and rose gold.", sortOrder: 1 },
  { name: "Anniversary Toppers", slug: "anniversary-toppers", parentCategorySlug: "acrylic-toppers", description: "Happy Anniversary and Love acrylic cake toppers.", sortOrder: 2 },
  { name: "Name Toppers", slug: "name-toppers", parentCategorySlug: "acrylic-toppers", description: "Customizable name toppers for birthdays and baby showers.", sortOrder: 3 },
  { name: "Age Toppers", slug: "age-toppers", parentCategorySlug: "acrylic-toppers", description: "Numbers and milestone age toppers (1st, 18th, 21st, 50th).", sortOrder: 4 },
  { name: "Custom Toppers", slug: "custom-toppers", parentCategorySlug: "acrylic-toppers", description: "Special bespoke occasion and monogram acrylic toppers.", sortOrder: 5 },

  // Paper Theme Toppers
  { name: "Birthday Themes", slug: "birthday-themes", parentCategorySlug: "paper-theme-toppers", description: "Themed paper cutouts, banner toppers, and mini flags.", sortOrder: 1 },
  { name: "Kids Themes", slug: "kids-themes", parentCategorySlug: "paper-theme-toppers", description: "Unicorn, superhero, space, cartoon, and animal paper toppers.", sortOrder: 2 },
  { name: "Baby Themes", slug: "baby-themes", parentCategorySlug: "paper-theme-toppers", description: "Baby shower, welcome baby, and gender reveal paper toppers.", sortOrder: 3 },
  { name: "Celebration Themes", slug: "celebration-themes", parentCategorySlug: "paper-theme-toppers", description: "Graduation, festive, and congratulatory party topper picks.", sortOrder: 4 },

  // Chocolates
  { name: "Baking Chocolates", slug: "baking-chocolates", parentCategorySlug: "chocolates", description: "Dark, milk, and white chocolate buttons for melting and ganache.", sortOrder: 1 },
  { name: "Chocolate Decorations", slug: "chocolate-decorations", parentCategorySlug: "chocolates", description: "Chocolate curls, vermicelli, chocolate crispearls, and chips.", sortOrder: 2 },
  { name: "Chocolate Compounds", slug: "chocolate-compounds", parentCategorySlug: "chocolates", description: "Easy-melting compound slabs in dark, milk, and white.", sortOrder: 3 },

  // Baking Ingredients
  { name: "Baking Mixes", slug: "baking-mixes", parentCategorySlug: "baking-ingredients", description: "Red velvet, brownie, sponge, and pancake mixes.", sortOrder: 1 },
  { name: "Cocoa", slug: "cocoa", parentCategorySlug: "baking-ingredients", description: "Dutch processed, natural, and dark black cocoa powders.", sortOrder: 2 },
  { name: "Sugars", slug: "sugars", parentCategorySlug: "baking-ingredients", description: "Icing sugar, caster sugar, demerara sugar, and fondant.", sortOrder: 3 },
  { name: "Decorating Ingredients", slug: "decorating-ingredients", parentCategorySlug: "baking-ingredients", description: "Edible glue, tylose powder, glucose syrup, and lustre dusts.", sortOrder: 4 },

  // Colours & Essences
  { name: "Gel Colours", slug: "gel-colours", parentCategorySlug: "colours-essences", description: "Highly concentrated gel food colours for icing, fondant, and batter.", sortOrder: 1 },
  { name: "Liquid Colours", slug: "liquid-colours", parentCategorySlug: "colours-essences", description: "Water-based liquid food colours for airbrushing and light tints.", sortOrder: 2 },
  { name: "Baking Essences", slug: "baking-essences", parentCategorySlug: "colours-essences", description: "Natural and culinary grade extracts: vanilla, almond, butter, rose.", sortOrder: 3 },
  { name: "Flavours", slug: "flavours", parentCategorySlug: "colours-essences", description: "Concentrated fruit oil emulsions and exotic flavour drops.", sortOrder: 4 },

  // Gifting & Hampers
  { name: "Gift Hampers", slug: "gift-hampers", parentCategorySlug: "gifting-hampers", description: "Curated gift sets with baking accessories and festive sprinkles.", sortOrder: 1 },
  { name: "Festive Hampers", slug: "festive-hampers", parentCategorySlug: "gifting-hampers", description: "Special seasonal Diwali, Rakhi, and Christmas gift packages.", sortOrder: 2 },
  { name: "Customized Hampers", slug: "customized-hampers", parentCategorySlug: "gifting-hampers", description: "Bespoke gift boxes assembled with selected baking treats.", sortOrder: 3 },
  { name: "Gift Jars", slug: "gift-jars", parentCategorySlug: "gifting-hampers", description: "Aesthetic glass and PET jars with decorative lids for treats.", sortOrder: 4 },
  { name: "Hamper Baskets", slug: "hamper-baskets", parentCategorySlug: "gifting-hampers", description: "Sturdy trays and woven gift baskets for packaging.", sortOrder: 5 },
];

const COLLECTIONS: SeedTaxonomy[] = [
  { name: "New Arrivals", slug: "new-arrivals", description: "Latest cake decorating supplies and innovative baking accessories.", sortOrder: 1 },
  { name: "Featured Collection", slug: "featured-collection", description: "Hand-picked essentials loved by professional home bakers.", sortOrder: 2 },
  { name: "Birthday Collection", slug: "birthday-collection", description: "Everything you need for spectacular birthday cakes and party treats.", sortOrder: 3 },
  { name: "Diwali Collection", slug: "diwali-collection", description: "Festive packaging, sweets boxes, golden accents, and holiday treats.", sortOrder: 4 },
  { name: "Festive Collection", slug: "festive-collection", description: "Seasonal festive products for celebrations throughout the year.", sortOrder: 5 },
  { name: "Gifting Collection", slug: "gifting-collection", description: "Premium gift boxes, hampers, and presentable baking packaging.", sortOrder: 6 },
  { name: "Cake Decorating Essentials", slug: "cake-decorating-essentials", description: "Must-have tools, scrapers, nozzles, and finishes for every cake maker.", sortOrder: 7 },
  { name: "Baking Essentials", slug: "baking-essentials", description: "Fundamental tins, mixes, and ingredients for reliable baking results.", sortOrder: 8 },
];

const OCCASIONS: SeedTaxonomy[] = [
  { name: "Birthday", slug: "birthday", description: "Products and decorations for birthday celebrations.", sortOrder: 1 },
  { name: "Anniversary", slug: "anniversary", description: "Romantic toppers and luxury boxes for wedding anniversaries.", sortOrder: 2 },
  { name: "Diwali", slug: "diwali", description: "Festive sweets boxes, diyas, golden sprinkles, and Diwali hampers.", sortOrder: 3 },
  { name: "Rakhi", slug: "rakhi", description: "Raksha Bandhan packaging, chocolate boxes, and gifting trays.", sortOrder: 4 },
  { name: "Teacher's Day", slug: "teachers-day", description: "Sweet gift jars and celebration boxes for Teacher's Day.", sortOrder: 5 },
  { name: "Baby Celebration", slug: "baby-celebration", description: "Pastel toppers, baby shower boxes, and welcome baby motifs.", sortOrder: 6 },
  { name: "Wedding", slug: "wedding", description: "Elegant white and gold cake boxes, multi-tier tins, and wedding toppers.", sortOrder: 7 },
  { name: "Corporate Gifting", slug: "corporate-gifting", description: "Professional gift hampers, branded packaging, and luxury chocolate boxes.", sortOrder: 8 },
  { name: "Christmas", slug: "christmas", description: "Red and green sprinkles, festive plum cake boxes, and holiday toppers.", sortOrder: 9 },
  { name: "New Year", slug: "new-year", description: "Glittery gold and silver party toppers and celebration treats.", sortOrder: 10 },
  { name: "Special Occasions", slug: "special-occasions", description: "Versatile celebration products for graduations, promotions, and festivals.", sortOrder: 11 },
];

interface StarterProductDef {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  priceRupees: number;
  salePriceRupees?: number;
  stockQuantity: number;
  categorySlug: string;
  subcategorySlug?: string;
  collectionSlugs: string[];
  occasionSlugs: string[];
  tags: string[];
  shipping: { weight: number; length: number; width: number; height: number };
  variantType?: string;
  variants?: { label: string; sku: string; priceRupees: number; salePriceRupees?: number; stockQuantity: number; weight: number }[];
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
}

const STARTER_PRODUCTS: StarterProductDef[] = [
  // 1. Baking Tins
  {
    name: "Round Cake Baking Tin",
    slug: "round-cake-baking-tin",
    sku: "BT-RND-001",
    shortDescription: "High-grade anodized aluminium round cake tin for even heat distribution.",
    description: "Our professional-grade round cake baking tin ensures perfectly baked cakes with sharp, even edges. Crafted from high-quality food-grade anodized aluminium that will not rust or warp. Ideal for layered celebration cakes and sponges.",
    priceRupees: 450,
    stockQuantity: 45,
    categorySlug: "baking-tins",
    subcategorySlug: "round-cake-tins",
    collectionSlugs: ["baking-essentials", "featured-collection"],
    occasionSlugs: ["birthday", "anniversary", "special-occasions"],
    tags: ["baking tin", "round cake", "cake mould", "aluminium tin"],
    shipping: { weight: 350, length: 22, width: 22, height: 8 },
    variantType: "Size",
    variants: [
      { label: "6 inch", sku: "BT-RND-001-6", priceRupees: 350, stockQuantity: 20, weight: 280 },
      { label: "8 inch", sku: "BT-RND-001-8", priceRupees: 450, stockQuantity: 15, weight: 350 },
      { label: "10 inch", sku: "BT-RND-001-10", priceRupees: 590, stockQuantity: 10, weight: 450 },
    ],
    bestSeller: true,
  },
  {
    name: "Square Cake Baking Tin",
    slug: "square-cake-baking-tin",
    sku: "BT-SQR-001",
    shortDescription: "Durable square cake pan with straight edges for brownies and layered cakes.",
    description: "Create crisp square cakes, brownies, and sheet bakes with this premium square baking tin. Straight edges ensure minimal trimming when decorating multi-tiered or geometric cakes.",
    priceRupees: 480,
    stockQuantity: 30,
    categorySlug: "baking-tins",
    subcategorySlug: "square-cake-tins",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["square tin", "brownie pan", "baking pan"],
    shipping: { weight: 380, length: 22, width: 22, height: 7 },
  },
  {
    name: "Heart Shape Cake Tin",
    slug: "heart-shape-cake-tin",
    sku: "BT-HRT-001",
    shortDescription: "Seamless heart-shaped baking pan for romantic occasions and anniversaries.",
    description: "Bake charming heart-shaped celebration cakes effortlessly with this seamless aluminium cake tin. Gentle rounded curves make unmoulding and crumb-coating simple and smooth.",
    priceRupees: 420,
    stockQuantity: 25,
    categorySlug: "baking-tins",
    subcategorySlug: "heart-cake-tins",
    collectionSlugs: ["featured-collection"],
    occasionSlugs: ["anniversary", "birthday"],
    tags: ["heart tin", "anniversary cake", "valentines"],
    shipping: { weight: 320, length: 20, width: 20, height: 6 },
  },
  {
    name: "Cupcake Baking Tray",
    slug: "cupcake-baking-tray",
    sku: "BT-CUP-001",
    shortDescription: "Heavy-duty 12-cavity non-stick muffin and cupcake baking tray.",
    description: "Bake a dozen fluffy cupcakes or muffins evenly with this premium heavy-gauge steel tray. Features a non-stick coating for effortless food release and quick cleanup.",
    priceRupees: 550,
    salePriceRupees: 499,
    stockQuantity: 40,
    categorySlug: "baking-tins",
    subcategorySlug: "cupcake-muffin-tins",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["birthday"],
    tags: ["cupcake tray", "muffin pan", "12 cavity"],
    shipping: { weight: 520, length: 35, width: 26, height: 4 },
  },

  // 2. Boxes & Packaging
  {
    name: "White Cake Box",
    slug: "white-cake-box",
    sku: "BX-WHT-001",
    shortDescription: "Sturdy food-grade paperboard white cake box with easy-fold assembly.",
    description: "Reliable, clean white cake boxes crafted from thick 350 GSM food-grade paperboard. Keeps celebration cakes secure during transit with easy tuck-in tabs.",
    priceRupees: 180,
    stockQuantity: 150,
    categorySlug: "boxes-packaging",
    subcategorySlug: "cake-boxes",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["birthday", "anniversary", "special-occasions"],
    tags: ["cake box", "white box", "packaging"],
    shipping: { weight: 120, length: 28, width: 28, height: 2 },
    variantType: "Size",
    variants: [
      { label: "6 inch (Pack of 5)", sku: "BX-WHT-001-6", priceRupees: 150, stockQuantity: 50, weight: 100 },
      { label: "8 inch (Pack of 5)", sku: "BX-WHT-001-8", priceRupees: 180, stockQuantity: 50, weight: 140 },
      { label: "10 inch (Pack of 5)", sku: "BX-WHT-001-10", priceRupees: 240, stockQuantity: 50, weight: 190 },
    ],
    bestSeller: true,
  },
  {
    name: "Window Cake Box",
    slug: "window-cake-box",
    sku: "BX-WIN-001",
    shortDescription: "Clear top transparent window cake box for stunning presentation.",
    description: "Show off your decorated cake before the customer even opens the box! Features a crystal-clear PET viewing window and sturdy paperboard construction.",
    priceRupees: 220,
    stockQuantity: 80,
    categorySlug: "boxes-packaging",
    subcategorySlug: "cake-boxes",
    collectionSlugs: ["featured-collection", "gifting-collection"],
    occasionSlugs: ["birthday", "anniversary"],
    tags: ["window box", "transparent box", "cake packaging"],
    shipping: { weight: 160, length: 30, width: 30, height: 2 },
  },
  {
    name: "Cupcake Box",
    slug: "cupcake-box",
    sku: "BX-CUP-001",
    shortDescription: "Multi-cavity cupcake box with secure insert holders to prevent tipping.",
    description: "Transport decorated cupcakes without any smudging or sliding. Includes removable inserts that hold each cupcake base firmly in place during delivery.",
    priceRupees: 140,
    stockQuantity: 120,
    categorySlug: "boxes-packaging",
    subcategorySlug: "cupcake-boxes",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["birthday"],
    tags: ["cupcake box", "muffin box", "insert"],
    shipping: { weight: 110, length: 26, width: 18, height: 2 },
  },
  {
    name: "Chocolate Gift Box",
    slug: "chocolate-gift-box",
    sku: "BX-CHOC-001",
    shortDescription: "Luxury rigid chocolate box with golden divider cavities for handmade pralines.",
    description: "An elegant gifting box tailored for bonbons, truffles, and artisan chocolates. Features a glossy printed finish with food-grade protective dividers.",
    priceRupees: 260,
    stockQuantity: 65,
    categorySlug: "chocolate-boxes",
    subcategorySlug: "chocolate-gift-boxes",
    collectionSlugs: ["gifting-collection", "diwali-collection"],
    occasionSlugs: ["diwali", "rakhi", "corporate-gifting"],
    tags: ["chocolate box", "truffle box", "praline box", "diwali box"],
    shipping: { weight: 180, length: 20, width: 15, height: 4 },
  },
  {
    name: "Hamper Gift Box",
    slug: "hamper-gift-box",
    sku: "BX-HMP-001",
    shortDescription: "Rigid decorative hamper box with ribbon tie for festive gift sets.",
    description: "Spacious luxury gift hamper box designed to hold cake jars, chocolate boxes, and sprinkles together in one gorgeous holiday presentation.",
    priceRupees: 420,
    salePriceRupees: 380,
    stockQuantity: 40,
    categorySlug: "boxes-packaging",
    subcategorySlug: "hamper-boxes",
    collectionSlugs: ["gifting-collection", "festive-collection"],
    occasionSlugs: ["diwali", "corporate-gifting", "wedding"],
    tags: ["hamper box", "gift box", "festive packaging"],
    shipping: { weight: 350, length: 32, width: 24, height: 10 },
  },

  // 3. Sprinkles
  {
    name: "Rainbow Sprinkles",
    slug: "rainbow-sprinkles",
    sku: "SP-RNB-001",
    shortDescription: "Vibrant rainbow sugar strands for ice creams, cakes, and funfetti batters.",
    description: "Classic multi-coloured sugar sprinkles with bright, bleed-resistant food colouring. Crunchy, sweet, and perfect for topping cupcakes, donuts, and funfetti cake layers.",
    priceRupees: 160,
    stockQuantity: 100,
    categorySlug: "sprinkles",
    subcategorySlug: "rainbow-sprinkles",
    collectionSlugs: ["new-arrivals", "cake-decorating-essentials"],
    occasionSlugs: ["birthday"],
    tags: ["rainbow sprinkles", "jimmies", "edible sprinkles", "funfetti"],
    shipping: { weight: 260, length: 12, width: 8, height: 6 },
    variantType: "Weight",
    variants: [
      { label: "100g", sku: "SP-RNB-001-100", priceRupees: 120, stockQuantity: 40, weight: 110 },
      { label: "250g", sku: "SP-RNB-001-250", priceRupees: 240, stockQuantity: 35, weight: 260 },
      { label: "500g", sku: "SP-RNB-001-500", priceRupees: 420, stockQuantity: 25, weight: 510 },
    ],
    featured: true,
  },
  {
    name: "Pastel Sprinkles",
    slug: "pastel-sprinkles",
    sku: "SP-PST-001",
    shortDescription: "Soft baby pastel mix of pink, lavender, mint, and cream edible sprinkles.",
    description: "Delicate pastel sprinkle medley curated specifically for elegant baby showers, princess birthdays, and soft minimalist drip cakes.",
    priceRupees: 180,
    stockQuantity: 60,
    categorySlug: "sprinkles",
    subcategorySlug: "themed-sprinkles",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["baby-celebration", "birthday"],
    tags: ["pastel sprinkles", "baby shower", "soft colours"],
    shipping: { weight: 260, length: 12, width: 8, height: 6 },
    variantType: "Weight",
    variants: [
      { label: "100g", sku: "SP-PST-001-100", priceRupees: 140, stockQuantity: 30, weight: 110 },
      { label: "250g", sku: "SP-PST-001-250", priceRupees: 280, stockQuantity: 30, weight: 260 },
    ],
  },
  {
    name: "Sugar Pearls",
    slug: "sugar-pearls",
    sku: "SP-PRL-001",
    shortDescription: "Shimmering edible pearl dragees in assorted sizes for royal cake borders.",
    description: "Lustrous round edible sugar pearls that lend a royal, high-end finish to wedding cakes and cupcakes. Available in shiny pearl and ivory finishes.",
    priceRupees: 210,
    stockQuantity: 50,
    categorySlug: "sprinkles",
    subcategorySlug: "sugar-pearls",
    collectionSlugs: ["featured-collection", "cake-decorating-essentials"],
    occasionSlugs: ["wedding", "anniversary"],
    tags: ["sugar pearls", "edible pearls", "metallic pearls"],
    shipping: { weight: 220, length: 10, width: 8, height: 6 },
    variantType: "Weight",
    variants: [
      { label: "100g", sku: "SP-PRL-001-100", priceRupees: 160, stockQuantity: 25, weight: 110 },
      { label: "250g", sku: "SP-PRL-001-250", priceRupees: 320, stockQuantity: 25, weight: 260 },
    ],
  },
  {
    name: "Confetti Sprinkles",
    slug: "confetti-sprinkles",
    sku: "SP-CNF-001",
    shortDescription: "Flat round rainbow edible sequins for festive carnival and birthday bakes.",
    description: "Thin, melt-in-the-mouth sugar discs that adhere smoothly to buttercream and chocolate ganache. Great for border details and confetti cupcakes.",
    priceRupees: 140,
    stockQuantity: 45,
    categorySlug: "sprinkles",
    subcategorySlug: "confetti-sprinkles",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["birthday"],
    tags: ["confetti", "sequins", "edible discs"],
    shipping: { weight: 160, length: 10, width: 8, height: 5 },
  },
  {
    name: "Birthday Sprinkles",
    slug: "birthday-sprinkles",
    sku: "SP-BDY-001",
    shortDescription: "Celebratory mix of golden stars, rainbow jimmies, and metallic beads.",
    description: "The ultimate birthday topper mix combining vibrant rainbow strands, golden stars, and pearl beads to make any birthday cake instantly photogenic.",
    priceRupees: 220,
    stockQuantity: 55,
    categorySlug: "sprinkles",
    subcategorySlug: "themed-sprinkles",
    collectionSlugs: ["birthday-collection", "featured-collection"],
    occasionSlugs: ["birthday"],
    tags: ["birthday sprinkles", "party mix", "gold stars"],
    shipping: { weight: 200, length: 12, width: 8, height: 6 },
  },

  // 4. Tools & Equipment
  {
    name: "Cake Decorating Spatula",
    slug: "cake-decorating-spatula",
    sku: "TL-SPT-001",
    shortDescription: "Ergonomic stainless steel angled offset spatula for seamless frosting.",
    description: "Engineered with a flexible stainless steel blade and comfort-grip handle. The angled neck keeps your knuckles away from frosted surfaces while spreading ganache or buttercream.",
    priceRupees: 250,
    stockQuantity: 60,
    categorySlug: "tools-equipment",
    subcategorySlug: "spatulas",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["offset spatula", "palette knife", "frosting tool"],
    shipping: { weight: 140, length: 28, width: 5, height: 2 },
  },
  {
    name: "Cake Scraper",
    slug: "cake-scraper",
    sku: "TL-SCP-001",
    shortDescription: "Clear acrylic tall cake scraper for razor-sharp edges and smooth sides.",
    description: "Get sharp 90-degree cake edges effortlessly! This transparent acrylic bench smoother allows you to see the cake through the tool while smoothing buttercream on a turntable.",
    priceRupees: 190,
    stockQuantity: 70,
    categorySlug: "tools-equipment",
    subcategorySlug: "scrapers",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["cake scraper", "acrylic smoother", "sharp edges"],
    shipping: { weight: 110, length: 25, width: 12, height: 1 },
  },
  {
    name: "Piping Nozzle Set",
    slug: "piping-nozzle-set",
    sku: "TL-NZL-001",
    shortDescription: "Comprehensive 24-piece stainless steel piping tips kit with storage box.",
    description: "Everything from round writing tips, star nozzles, basketweave, leaf, and drop flower nozzles. Made from seamless stainless steel that won't rust or bend under thick buttercream.",
    priceRupees: 590,
    salePriceRupees: 520,
    stockQuantity: 35,
    categorySlug: "tools-equipment",
    subcategorySlug: "nozzles",
    collectionSlugs: ["cake-decorating-essentials", "featured-collection"],
    occasionSlugs: ["special-occasions"],
    tags: ["piping nozzles", "icing tips", "decorating kit"],
    shipping: { weight: 320, length: 18, width: 14, height: 5 },
    featured: true,
  },
  {
    name: "Cake Decorating Tool Set",
    slug: "cake-decorating-tool-set",
    sku: "TL-SET-001",
    shortDescription: "Complete beginner and pro decorator starter pack with turntable and spatulas.",
    description: "The complete setup: 1 smooth revolving cake turntable, 2 offset spatulas, 3 side scrapers, and 10 disposable piping bags. The ideal gift for budding bakers.",
    priceRupees: 1250,
    salePriceRupees: 1099,
    stockQuantity: 20,
    categorySlug: "tools-equipment",
    subcategorySlug: "decorating-tools",
    collectionSlugs: ["cake-decorating-essentials", "gifting-collection"],
    occasionSlugs: ["birthday", "special-occasions"],
    tags: ["turntable", "starter kit", "tool set"],
    shipping: { weight: 950, length: 30, width: 30, height: 10 },
  },
  {
    name: "Measuring Spoon Set",
    slug: "measuring-spoon-set",
    sku: "TL-MSR-001",
    shortDescription: "Accurate stainless steel measuring spoons with engraved metric measurements.",
    description: "5 heavy-duty nesting measuring spoons: 1/4 tsp, 1/2 tsp, 1 tsp, 1/2 tbsp, and 1 tbsp. Laser-etched markings won't fade or wash away over time.",
    priceRupees: 220,
    stockQuantity: 50,
    categorySlug: "tools-equipment",
    subcategorySlug: "measuring-tools",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["measuring spoons", "baking tools", "stainless steel"],
    shipping: { weight: 150, length: 15, width: 5, height: 3 },
  },

  // 5. Toppers
  {
    name: "Happy Birthday Acrylic Topper",
    slug: "happy-birthday-acrylic-topper",
    sku: "TP-ACR-001",
    shortDescription: "Mirror gold acrylic calligraphy Happy Birthday cake topper.",
    description: "A shiny mirror gold acrylic cake topper that crowns celebration cakes with glamour. Clean, reusable, and easy to sanitize with a damp cloth after the party.",
    priceRupees: 150,
    stockQuantity: 110,
    categorySlug: "acrylic-toppers",
    subcategorySlug: "birthday-toppers",
    collectionSlugs: ["birthday-collection", "featured-collection"],
    occasionSlugs: ["birthday"],
    tags: ["happy birthday", "acrylic topper", "gold topper", "cake topper"],
    shipping: { weight: 60, length: 18, width: 14, height: 1 },
    bestSeller: true,
  },
  {
    name: "Number Cake Topper",
    slug: "number-cake-topper",
    sku: "TP-NUM-001",
    shortDescription: "Sparkling glitter acrylic number toppers from 0 to 9 for milestone ages.",
    description: "Celebrate milestone birthdays and anniversaries with elegant number toppers. Sturdy acrylic stems insert smoothly into cake layers without causing collapses.",
    priceRupees: 120,
    stockQuantity: 80,
    categorySlug: "acrylic-toppers",
    subcategorySlug: "age-toppers",
    collectionSlugs: ["birthday-collection"],
    occasionSlugs: ["birthday", "anniversary"],
    tags: ["number topper", "age topper", "milestone"],
    shipping: { weight: 50, length: 16, width: 8, height: 1 },
  },
  {
    name: "Happy Birthday Paper Topper",
    slug: "happy-birthday-paper-topper",
    sku: "TP-PPR-001",
    shortDescription: "Colourful multi-layer cardstock birthday banner cake topper on wooden picks.",
    description: "Whimsical, colourful paper banner cake topper supported by dual wooden picks. Lightweight and cheerful, perfect for smash cakes and kid parties.",
    priceRupees: 90,
    stockQuantity: 90,
    categorySlug: "paper-theme-toppers",
    subcategorySlug: "birthday-themes",
    collectionSlugs: ["birthday-collection"],
    occasionSlugs: ["birthday"],
    tags: ["paper topper", "banner topper", "kids birthday"],
    shipping: { weight: 40, length: 20, width: 15, height: 1 },
  },
  {
    name: "Celebration Cake Topper",
    slug: "celebration-cake-topper",
    sku: "TP-CLB-001",
    shortDescription: "Shimmering Congratulations acrylic topper for promotions, graduations, and events.",
    description: "Versatile script topper suited for any achievement or milestone celebration. Laser-cut from sturdy acrylic with a polished reflective finish.",
    priceRupees: 140,
    stockQuantity: 45,
    categorySlug: "acrylic-toppers",
    subcategorySlug: "custom-toppers",
    collectionSlugs: ["featured-collection"],
    occasionSlugs: ["special-occasions", "corporate-gifting"],
    tags: ["congratulations", "celebration", "milestone topper"],
    shipping: { weight: 55, length: 18, width: 14, height: 1 },
  },

  // 6. Colours & Essences
  {
    name: "Baking Gel Colour",
    slug: "baking-gel-colour",
    sku: "CE-GEL-001",
    shortDescription: "Highly concentrated professional food gel colour without altering batter texture.",
    description: "Intense, rich pigmentation with just a drop! Our formula is designed for fondant, royal icing, macarons, and cake batter without thinning the consistency.",
    priceRupees: 160,
    stockQuantity: 120,
    categorySlug: "colours-essences",
    subcategorySlug: "gel-colours",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["gel colour", "food colour", "icing tint"],
    shipping: { weight: 70, length: 8, width: 4, height: 4 },
  },
  {
    name: "Vanilla Baking Essence",
    slug: "vanilla-baking-essence",
    sku: "CE-ESN-001",
    shortDescription: "Classic warm vanilla essence for aromatic sponges, frostings, and cookies.",
    description: "Rich, bake-stable vanilla essence that maintains its aroma and warmth even under high oven temperatures. Perfect for all baking recipes.",
    priceRupees: 140,
    stockQuantity: 75,
    categorySlug: "colours-essences",
    subcategorySlug: "baking-essences",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["birthday", "special-occasions"],
    tags: ["vanilla essence", "flavour", "aroma"],
    shipping: { weight: 120, length: 10, width: 4, height: 4 },
  },
  {
    name: "Chocolate Essence",
    slug: "chocolate-essence",
    sku: "CE-ESN-002",
    shortDescription: "Deep cocoa extract drops to boost chocolate cake and mousse flavours.",
    description: "Intensify chocolate profiles in ganache, brownies, and chocolate frostings without adding moisture or altering fats balance.",
    priceRupees: 140,
    stockQuantity: 50,
    categorySlug: "colours-essences",
    subcategorySlug: "baking-essences",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["chocolate essence", "cocoa flavour", "baking drops"],
    shipping: { weight: 120, length: 10, width: 4, height: 4 },
  },
  {
    name: "Strawberry Essence",
    slug: "strawberry-essence",
    sku: "CE-ESN-003",
    shortDescription: "Fruity sweet strawberry flavour drops for summer cakes and fillings.",
    description: "Crisp strawberry aroma that pairs beautifully with whipped cream frostings, cupcakes, and fruit tarts.",
    priceRupees: 140,
    stockQuantity: 40,
    categorySlug: "colours-essences",
    subcategorySlug: "flavours",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["birthday"],
    tags: ["strawberry flavour", "fruit essence", "drops"],
    shipping: { weight: 120, length: 10, width: 4, height: 4 },
  },

  // 7. Chocolate
  {
    name: "Baking Chocolate",
    slug: "baking-chocolate",
    sku: "CH-DRK-001",
    shortDescription: "Premium dark chocolate buttons with 55% cocoa for silky glazes and melting.",
    description: "Smooth melting chocolate designed specifically for tempering, truffles, cake glazes, and brownie fillings. Melts evenly without graininess.",
    priceRupees: 350,
    stockQuantity: 50,
    categorySlug: "chocolates",
    subcategorySlug: "baking-chocolates",
    collectionSlugs: ["baking-essentials", "featured-collection"],
    occasionSlugs: ["special-occasions"],
    tags: ["baking chocolate", "dark chocolate", "ganache buttons"],
    shipping: { weight: 520, length: 20, width: 14, height: 4 },
  },
  {
    name: "Chocolate Decoration Pieces",
    slug: "chocolate-decoration-pieces",
    sku: "CH-DEC-001",
    shortDescription: "Delicate dark and white chocolate swirls and curls for elegant cake garnishing.",
    description: "Ready-to-use chocolate fans, curls, and shards for instant bakery-counter cake styling. Store in a cool, dry place.",
    priceRupees: 280,
    stockQuantity: 30,
    categorySlug: "chocolates",
    subcategorySlug: "chocolate-decorations",
    collectionSlugs: ["cake-decorating-essentials"],
    occasionSlugs: ["birthday", "anniversary"],
    tags: ["chocolate curls", "garnishing", "decorations"],
    shipping: { weight: 250, length: 15, width: 10, height: 5 },
  },
  {
    name: "Chocolate Compound",
    slug: "chocolate-compound",
    sku: "CH-CMP-001",
    shortDescription: "Easy-melt chocolate compound slab for dipping, cake pops, and drip cakes.",
    description: "No-temper chocolate compound slab that sets with a glossy snap at room temperature. The favorite choice for cake pops, drip borders, and silicone mould treats.",
    priceRupees: 220,
    stockQuantity: 70,
    categorySlug: "chocolates",
    subcategorySlug: "chocolate-compounds",
    collectionSlugs: ["baking-essentials"],
    occasionSlugs: ["special-occasions"],
    tags: ["chocolate slab", "compound", "cake drip"],
    shipping: { weight: 520, length: 22, width: 10, height: 3 },
  },

  // 8. Gifting
  {
    name: "Customized Gift Hamper",
    slug: "customized-gift-hamper",
    sku: "GF-HMP-001",
    shortDescription: "Bespoke festive hamper featuring artisanal baking supplies and sweet packaging.",
    description: "A deluxe custom hamper basket assembled with premium baking essentials, festive sprinkles, chocolate boxes, and decorative ribbons. Beautifully wrapped with a personalized card.",
    priceRupees: 1850,
    salePriceRupees: 1650,
    stockQuantity: 15,
    categorySlug: "gifting-hampers",
    subcategorySlug: "customized-hampers",
    collectionSlugs: ["gifting-collection", "festive-collection", "diwali-collection"],
    occasionSlugs: ["diwali", "corporate-gifting", "wedding"],
    tags: ["gift hamper", "festive hamper", "luxury gift"],
    shipping: { weight: 1400, length: 35, width: 28, height: 16 },
    featured: true,
  },
  {
    name: "Premium Gift Jar",
    slug: "premium-gift-jar",
    sku: "GF-JAR-001",
    shortDescription: "Clear hexagonal glass gift jar with golden metal lid for cookies and sweets.",
    description: "Reusable, airtight glass treat jar topped with a metallic gold screw cap. Ideal for packaging layered cookies, chocolates, and festive baking mixes.",
    priceRupees: 160,
    stockQuantity: 80,
    categorySlug: "gifting-hampers",
    subcategorySlug: "gift-jars",
    collectionSlugs: ["gifting-collection"],
    occasionSlugs: ["diwali", "rakhi", "corporate-gifting"],
    tags: ["gift jar", "glass jar", "treat jar"],
    shipping: { weight: 290, length: 10, width: 10, height: 12 },
  },
  {
    name: "Festive Gift Box",
    slug: "festive-gift-box",
    sku: "GF-BOX-001",
    shortDescription: "Embossed golden foil festive gift box with magnetic closure.",
    description: "Exquisite presentation box featuring festive Indian motifs and magnetic closure. Holds sweets, gourmet cupcakes, or dessert gift sets in grand style.",
    priceRupees: 320,
    salePriceRupees: 280,
    stockQuantity: 40,
    categorySlug: "gifting-hampers",
    subcategorySlug: "festive-hampers",
    collectionSlugs: ["gifting-collection", "festive-collection", "diwali-collection"],
    occasionSlugs: ["diwali", "rakhi", "wedding"],
    tags: ["festive box", "gold box", "diwali gift"],
    shipping: { weight: 260, length: 24, width: 18, height: 8 },
  },
];

async function main() {
  console.log("==================================================");
  console.log("Sprinkle & Sparkle — Catalog Seeder");
  console.log("==================================================");

  await connectDB();
  console.log("✓ Connected to MongoDB");

  // 1. Categories
  console.log("\n[1/5] Processing Categories...");
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();

  for (const catDef of CATEGORIES) {
    const existing = await Category.findOne({
      $or: [{ slug: catDef.slug }, { name: { $regex: new RegExp(`^${catDef.name}$`, "i") } }],
    });

    if (existing) {
      existing.name = catDef.name;
      existing.description = catDef.description;
      existing.sortOrder = catDef.sortOrder;
      existing.isActive = true;
      await existing.save();
      categoryMap.set(catDef.slug, existing._id as Types.ObjectId);
      console.log(`  → Updated category: "${catDef.name}" (${catDef.slug})`);
    } else {
      const created = await Category.create({
        name: catDef.name,
        slug: catDef.slug,
        description: catDef.description,
        sortOrder: catDef.sortOrder,
        isActive: true,
        image: null,
        imageMedia: null,
      });
      categoryMap.set(catDef.slug, created._id as Types.ObjectId);
      console.log(`  + Created category: "${catDef.name}" (${catDef.slug})`);
    }
  }

  // 2. Subcategories
  console.log("\n[2/5] Processing Subcategories...");
  const subcategoryMap = new Map<string, mongoose.Types.ObjectId>();

  for (const subDef of SUBCATEGORIES) {
    const parentId = categoryMap.get(subDef.parentCategorySlug);
    if (!parentId) {
      console.warn(`  ! Parent category "${subDef.parentCategorySlug}" not found for subcategory "${subDef.name}"`);
      continue;
    }

    const existing = await Subcategory.findOne({
      $or: [{ slug: subDef.slug }, { name: { $regex: new RegExp(`^${subDef.name}$`, "i") }, category: parentId }],
    });

    if (existing) {
      existing.name = subDef.name;
      existing.category = parentId;
      existing.description = subDef.description;
      existing.sortOrder = subDef.sortOrder;
      existing.isActive = true;
      await existing.save();
      subcategoryMap.set(subDef.slug, existing._id as Types.ObjectId);
      console.log(`  → Updated subcategory: "${subDef.name}" (${subDef.slug}) under "${subDef.parentCategorySlug}"`);
    } else {
      const created = await Subcategory.create({
        name: subDef.name,
        slug: subDef.slug,
        category: parentId,
        description: subDef.description,
        sortOrder: subDef.sortOrder,
        isActive: true,
        image: null,
        imageMedia: null,
      });
      subcategoryMap.set(subDef.slug, created._id as Types.ObjectId);
      console.log(`  + Created subcategory: "${subDef.name}" (${subDef.slug}) under "${subDef.parentCategorySlug}"`);
    }
  }

  // 3. Collections
  console.log("\n[3/5] Processing Collections...");
  const collectionMap = new Map<string, mongoose.Types.ObjectId>();

  for (const colDef of COLLECTIONS) {
    const existing = await Collection.findOne({
      $or: [{ slug: colDef.slug }, { name: { $regex: new RegExp(`^${colDef.name}$`, "i") } }],
    });

    if (existing) {
      existing.name = colDef.name;
      existing.description = colDef.description;
      existing.sortOrder = colDef.sortOrder;
      existing.isActive = true;
      await existing.save();
      collectionMap.set(colDef.slug, existing._id as Types.ObjectId);
      console.log(`  → Updated collection: "${colDef.name}" (${colDef.slug})`);
    } else {
      const created = await Collection.create({
        name: colDef.name,
        slug: colDef.slug,
        description: colDef.description,
        sortOrder: colDef.sortOrder,
        isActive: true,
        image: null,
        imageMedia: null,
      });
      collectionMap.set(colDef.slug, created._id as Types.ObjectId);
      console.log(`  + Created collection: "${colDef.name}" (${colDef.slug})`);
    }
  }

  // 4. Occasions
  console.log("\n[4/5] Processing Occasions...");
  const occasionMap = new Map<string, mongoose.Types.ObjectId>();

  for (const occDef of OCCASIONS) {
    const existing = await Occasion.findOne({
      $or: [{ slug: occDef.slug }, { name: { $regex: new RegExp(`^${occDef.name}$`, "i") } }],
    });

    if (existing) {
      existing.name = occDef.name;
      existing.description = occDef.description;
      existing.sortOrder = occDef.sortOrder;
      existing.isActive = true;
      await existing.save();
      occasionMap.set(occDef.slug, existing._id as Types.ObjectId);
      console.log(`  → Updated occasion: "${occDef.name}" (${occDef.slug})`);
    } else {
      const created = await Occasion.create({
        name: occDef.name,
        slug: occDef.slug,
        description: occDef.description,
        sortOrder: occDef.sortOrder,
        isActive: true,
        image: null,
        imageMedia: null,
      });
      occasionMap.set(occDef.slug, created._id as Types.ObjectId);
      console.log(`  + Created occasion: "${occDef.name}" (${occDef.slug})`);
    }
  }

  // 5. Starter Products
  console.log("\n[5/5] Processing Starter Products (Drafts for development/admin testing)...");
  for (const prodDef of STARTER_PRODUCTS) {
    const catId = categoryMap.get(prodDef.categorySlug) ?? null;
    const subId = prodDef.subcategorySlug ? subcategoryMap.get(prodDef.subcategorySlug) ?? null : null;
    const colIds = prodDef.collectionSlugs.map((s) => collectionMap.get(s)).filter((id): id is Types.ObjectId => Boolean(id));
    const occIds = prodDef.occasionSlugs.map((s) => occasionMap.get(s)).filter((id): id is Types.ObjectId => Boolean(id));

    const price = inPaise(prodDef.priceRupees);
    const salePrice = prodDef.salePriceRupees ? inPaise(prodDef.salePriceRupees) : null;

    const hasVariants = Boolean(prodDef.variants && prodDef.variants.length > 0);
    const variants = hasVariants
      ? prodDef.variants!.map((v) => ({
          _id: new Types.ObjectId(),
          label: v.label,
          sku: v.sku,
          price: inPaise(v.priceRupees),
          salePrice: v.salePriceRupees ? inPaise(v.salePriceRupees) : null,
          stockQuantity: v.stockQuantity,
          weight: v.weight,
          isActive: true,
          image: null,
        }))
      : [];

    // Derive effective price
    let effectivePrice = salePrice ?? price;
    if (hasVariants && variants.length > 0) {
      const variantPrices = variants.filter((v) => v.isActive).map((v) => v.salePrice ?? v.price);
      if (variantPrices.length > 0) {
        effectivePrice = Math.min(...variantPrices);
      }
    }

    const totalStock = hasVariants
      ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      : prodDef.stockQuantity;

    const stockStatus: StockStatus = totalStock > 0 ? "in_stock" : "out_of_stock";

    const productPayload = {
      name: prodDef.name,
      slug: prodDef.slug,
      sku: prodDef.sku,
      shortDescription: prodDef.shortDescription,
      description: prodDef.description,
      price,
      salePrice,
      effectivePrice,
      stockQuantity: totalStock,
      allowBackorder: false,
      stockStatus,
      category: catId,
      subcategory: subId,
      brand: null,
      collections: colIds,
      occasions: occIds,
      tags: prodDef.tags,
      images: [],
      hasVariants,
      variantType: prodDef.variantType ?? "Size",
      variants,
      shipping: prodDef.shipping,
      status: "draft" as const, // Strict Rule: ALWAYS draft for starter test catalog
      publishedAt: null,
      featured: Boolean(prodDef.featured),
      newArrival: Boolean(prodDef.newArrival),
      bestSeller: Boolean(prodDef.bestSeller),
      seo: {
        title: `${prodDef.name} | Sprinkle & Sparkle`,
        description: prodDef.shortDescription,
      },
    };

    const existing = await Product.findOne({
      $or: [{ slug: prodDef.slug }, { sku: prodDef.sku }],
    });

    if (existing) {
      // Retain existing images, status if already updated by admin
      Object.assign(existing, {
        ...productPayload,
        images: existing.images,
        status: existing.status, // preserve if client already published or changed
        publishedAt: existing.publishedAt,
      });
      await existing.save();
      console.log(`  → Updated starter product: "${prodDef.name}" (${prodDef.sku}) [status: ${existing.status}]`);
    } else {
      await Product.create(productPayload);
      console.log(`  + Created starter product: "${prodDef.name}" (${prodDef.sku}) [status: draft]`);
    }
  }

  // Summary counts
  const [totalCats, totalSubs, totalCols, totalOccs, totalBrands, totalProds, draftProds, pubProds] = await Promise.all([
    Category.countDocuments(),
    Subcategory.countDocuments(),
    Collection.countDocuments(),
    Occasion.countDocuments(),
    Brand.countDocuments(),
    Product.countDocuments(),
    Product.countDocuments({ status: "draft" }),
    Product.countDocuments({ status: "published" }),
  ]);

  console.log("\n==================================================");
  console.log("Catalog Seeding Complete!");
  console.log(`  • Categories:    ${totalCats}`);
  console.log(`  • Subcategories: ${totalSubs}`);
  console.log(`  • Collections:   ${totalCols}`);
  console.log(`  • Occasions:     ${totalOccs}`);
  console.log(`  • Brands:        ${totalBrands} (preserved unpopulated for client)`);
  console.log(`  • Products:      ${totalProds} total (${draftProds} draft, ${pubProds} published)`);
  console.log("==================================================");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✗ Catalog seeding failed:", err);
  process.exitCode = 1;
});
