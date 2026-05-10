import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo'da workspace dep'lerini standalone'a dahil et
  outputFileTracingRoot: path.join(__dirname, "../../"),
  env: {
    // API portu — tarayıcı WS bağlantısı için kullanılır
    NEXT_PUBLIC_API_PORT: process.env.API_PORT ?? "3000",
  },
};

export default nextConfig;
