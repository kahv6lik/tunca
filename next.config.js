const path = require("path");

// Uygulamada gösterilen sürüm, package.json'daki sürümden gelir.
// scripts/release.sh tag atmadan önce package.json'ı yükselttiği için
// arayüzdeki sürüm her zaman git tag'i ile aynıdır (tag = "v" + bu değer).
const { version } = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    APP_VERSION: version,
  },
  webpack: (config) => {
    // "@/..." alias'ını her ortamda (Docker dahil) garanti çözmek için
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
