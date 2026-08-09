import type { NextConfig } from "next";

/** Fully client-side app: static export, deployable to any static host. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
