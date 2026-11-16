import { securityHeaders } from "./lib/securityHeaders.mjs";

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't announce which framework runs the site.
  poweredByHeader: false,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Security headers on every page. If the Content-Security-Policy ever blocks something it
  // shouldn't, put CSP_REPORT_ONLY=true in frontend/.env.local and restart: the browser then
  // reports the problem in the Console instead of blocking it.
  async headers() {
    return securityHeaders({
      isProd,
      apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
      reportOnly: process.env.CSP_REPORT_ONLY === "true",
    });
  },
};

export default nextConfig;