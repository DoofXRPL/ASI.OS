import type { NextConfig } from "next";

/**
 * ASI OS holds a single person's private records. Every authenticated route is
 * rendered per request against Supabase with the caller's own JWT, so there is
 * deliberately no caching, ISR, or prerendering layer configured here: a stale
 * page in this product is a dishonest page.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Type errors must fail the build. Linting runs as its own CI step, since
  // Next.js 16 no longer runs ESLint during `next build`.
  typescript: {
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
