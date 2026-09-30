import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep Mongoose and bcrypt as runtime Node dependencies (never bundled for the browser).
  serverExternalPackages: ["mongoose", "bcryptjs"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Admin pages must never be cached, so after logout the back button
        // re-requests the page and gets redirected to /login.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      { source: "/login", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/categories", destination: "/api/public/categories" },
      { source: "/api/categories/:path*", destination: "/api/public/categories/:path*" },
      { source: "/api/subcategories", destination: "/api/public/subcategories" },
      { source: "/api/subcategories/:path*", destination: "/api/public/subcategories/:path*" },
      { source: "/api/products", destination: "/api/public/products" },
      { source: "/api/products/:path*", destination: "/api/public/products/:path*" },
      { source: "/api/collections", destination: "/api/public/collections" },
      { source: "/api/collections/:path*", destination: "/api/public/collections/:path*" },
      { source: "/api/occasions", destination: "/api/public/occasions" },
      { source: "/api/occasions/:path*", destination: "/api/public/occasions/:path*" },
      { source: "/api/brands", destination: "/api/public/brands" },
      { source: "/api/brands/:path*", destination: "/api/public/brands/:path*" },
    ];
  },
};

export default nextConfig;
