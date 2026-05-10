import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    // API portu — tarayıcı WS bağlantısı için kullanılır
    NEXT_PUBLIC_API_PORT: process.env.API_PORT ?? "3000",
  },
};

export default nextConfig;
