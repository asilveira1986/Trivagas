import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Logotipo da empresa (até 1 MB) enviado por Server Action, com folga para o multipart.
    serverActions: { bodySizeLimit: "1.2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
