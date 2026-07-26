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

  /**
   * Development only, and loopback only.
   *
   * Next.js blocks its dev resources for any origin it was not told about, and
   * the failure is silent in a costly way: the page still renders and Server
   * Action forms still post, so everything looks fine while no client component
   * has hydrated. Reaching the dev server as 127.0.0.1 rather than localhost is
   * enough to trigger it. Both names for this machine are listed so that
   * whichever one you type, the interface you are testing is the real one.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],

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
