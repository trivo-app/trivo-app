import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["dcwieoyzmyesvfugjrxn.supabase.co", "i3.ytimg.com"],
  },
  experimental: {
    reactCompiler: true,
  },
};

export default nextConfig;
