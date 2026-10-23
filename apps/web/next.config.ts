import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared package ships TypeScript source (NodeNext-style `.js` imports).
  transpilePackages: ["@worlds/shared"],
  // Turbopack cannot map the shared package's NodeNext `./x.js` imports onto
  // its `.ts` sources, so dev and build run on webpack with an extension alias.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  images: {
    // Wikimedia Commons only, per the photography policy in
    // docs/design/landing-page-blueprint.md §9. Add hosts deliberately.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
      // Entity images supplied by Qloo through the API's graph and search responses.
      { protocol: "https", hostname: "images.qloo.com", pathname: "/i/**" },
    ],
  },
};

export default nextConfig;
