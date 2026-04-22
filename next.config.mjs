import bundleAnalyzer from "@next/bundle-analyzer";

/**
 * Long-lived caching for synced static assets under `/web/*`.
 *
 * - **Vercel / most CDNs:** These headers apply at the edge; `next build` ships
 *   `public/web` as static files. A new deployment still uses the same URL paths,
 *   so if you replace a file in place without renaming, clients may see a cached
 *   copy until `max-age` expires — prefer filename changes or `?v=` for urgent fixes.
 * - **Other hosts:** Ensure the platform forwards `Cache-Control` (or merges with
 *   its own rules) so behavior matches expectations.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  /** react-pdf 9 (CJS/ESM); `pdfjs-dist` 5.4 + Webpack löst oft `defineProperty on non-object` aus → pdfjs 4.8.69 (s. package.json). */
  transpilePackages: ["react-pdf"],
  async headers() {
    return [
      {
        source: "/web/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
