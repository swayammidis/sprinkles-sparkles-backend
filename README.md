# Sprinkle & Sparkle — Admin & Catalog API

A custom admin panel and catalog backend for the Sprinkle & Sparkle store. It runs as a
separate Next.js application from the customer website.

```
Customer website ──(GET /api/public/*)──▶ this app ──▶ PostgreSQL (Prisma)
Admin users ──(/admin UI + /api/admin/*)──▶ this app
```

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Lucide,
PostgreSQL + Prisma 7, Zod 4, React Hook Form, and Better Auth for authentication.

## Quick start

```bash
cp .env.example .env              # fill DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
docker compose up -d              # or use any PostgreSQL 14+ database
npm install                       # also runs `prisma generate`
npm run db:migrate                # create tables
npm run db:seed                   # categories, collections, occasions + demo products
npm run admin:create -- --email you@example.com --name "Your Name" --role SUPER_ADMIN
npm run dev                       # http://localhost:3001
```

To generate a secret: `openssl rand -base64 32`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js on port 3001 |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | `prisma migrate dev` (development) |
| `npm run db:deploy` | `prisma migrate deploy` (production) |
| `npm run db:seed` | Idempotent seed |
| `npm run db:remove-demo -- --yes` | Delete all demo products and demo images (a dry run without `--yes`) |
| `npm run admin:create` | Create an admin. Reads the password from `ADMIN_PASSWORD` or prompts for it |
| `npm run test:api` | End-to-end API test against a running server (see below) |

## Environment variables

See `.env.example`. None of them are exposed to the browser.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | ✓ | 32+ random characters |
| `BETTER_AUTH_URL` | ✓ | Public URL of this app. Used for cookies and the CSRF origin check |
| `STOREFRONT_ORIGINS` | | Comma-separated origins allowed by CORS on `/api/public/*` |
| `STORAGE_PROVIDER` | | `local` (development) or `s3` (S3 / R2 / MinIO) |
| `STORAGE_PUBLIC_BASE_URL` | for s3 | Public CDN or bucket URL |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | for s3 | |
| `UPLOAD_MAX_MB` | | Default is 5 |

## Project layout

```
prisma/            schema, migrations, seed, remove-demo
scripts/           create-admin, api-smoke-test
src/proxy.ts       fast pre-check for /admin and /api/admin (Next 16 "proxy", formerly middleware)
src/app/login      sign-in page
src/app/admin/*    admin UI (dashboard, products, categories, subcategories, collections, occasions, brands, media, settings)
src/app/api/admin  authenticated CRUD API
src/app/api/public read-only storefront API
src/app/api/auth   Better Auth handler
src/app/media      serves files from the local storage provider
src/lib/auth       Better Auth config, session guards, role → permission map
src/lib/api        route wrappers (auth, CSRF, errors, CORS)
src/lib/services   all database logic (the only code that uses Prisma)
src/lib/dto        Prisma → public DTO mappers
src/lib/validations Zod schemas shared by forms and the server
src/lib/uploads    storage abstraction (local, s3) and image validation
src/types/public-api.ts   public API contract
storefront-integration/   drop-in API client for the customer website
```

## Security model

- **Authentication.** Better Auth with email and password. Passwords are hashed with scrypt, and sessions are stored in the database and can be revoked. Cookies are `httpOnly` and `SameSite=Lax`, and `Secure` in production. Sign-in is rate-limited to 5 attempts per 5 minutes per IP. Public sign-up is disabled.
- **Authorization.** Every admin page calls `requireAdminPage(permission)`, and every admin route is wrapped in `adminRoute(permission, …)`. The session, the `active` flag and the role are read from the database on every request. `proxy.ts` is only a fast pre-check.
- **Roles.** `SUPER_ADMIN` can do everything. `ADMIN` can manage the catalog and media. Permissions live in `src/lib/auth/permissions.ts`, so adding one means editing that single map. `role` and `active` are `input: false` in Better Auth, so clients cannot set them.
- **CSRF.** Mutations under `/api/admin/*` must send an `Origin` header that matches the app, and cookies are `SameSite=Lax`.
- **Validation.** All input is validated with Zod on the server, even though forms validate too. Unknown fields are stripped. Stock totals, stock status, effective price and image URLs are all derived on the server.
- **Money** is `NUMERIC(10,2)` in the database, decimal strings in the API, and never floats. The database also enforces price and stock `CHECK` constraints and allows only one primary image per product.
- **Uploads.** The file type is detected from its magic bytes (JPG, PNG, WebP, AVIF, GIF). SVG is rejected. Storage keys are generated on the server, and files are served with `nosniff`.
- **Public API.** GET only, active products only, a whitelist of fields (no exact stock or internal flags), CORS restricted to the allowed origins.

## Demo data

The seed creates 8 demo products. Their SKUs start with `DEMO-`, they have `isDemo = true`, and they use placeholder
images labelled "DEMO IMAGE". Remove them with `npm run db:remove-demo -- --yes`.

## API test

```bash
npm run build && npm start
TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:api
```
