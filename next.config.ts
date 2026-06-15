import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auto-memoizes components/hooks (needs babel-plugin-react-compiler).
  // Next applies it only to relevant files via SWC, so build cost stays small.
  reactCompiler: true,
};

export default nextConfig;
