import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

import { securityHeaders } from "./src/lib/security/headers"

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts")

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
        }),
      },
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default withNextIntl(nextConfig)
